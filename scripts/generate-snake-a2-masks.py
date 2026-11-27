#!/usr/bin/env python3
"""Generate deterministic A2 collision masks from the OFFICIAL WebP atlases.

Run `python scripts/generate-snake-a2-masks.py --check` after changing A2 art.
This is a build-time process; gameplay never needs canvas pixel readbacks.
"""
from __future__ import annotations
import argparse
import hashlib
import base64
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / 'Chaua-Educa-main/public/snake'
OUTPUT = ROOT / 'Chaua-Educa-main/js/snake-a2-masks.mjs'
ASSETS = {'idle': 'base/idle.webp', 'attack': 'attack/attack.webp', 'stunned': 'reactions/stunned.webp', 'high':'attack/high.webp', 'sweep':'attack/sweep.webp'}
CELL = 384
MASK_CELL = 12
SIDE = CELL // MASK_CELL
THRESHOLD = 112


def mask_frames(image: Image.Image):
    alpha = image.convert('RGBA').getchannel('A')
    if alpha.size != (4 * CELL, 2 * CELL):
        raise ValueError(f'Expected official A2 atlas size 1536x768, received {alpha.size}')
    masks = []
    for frame in range(8):
        frame_x = frame % 4 * CELL
        frame_y = frame // 4 * CELL
        filled = []
        for row in range(SIDE):
            for col in range(SIDE):
                x = frame_x + col * MASK_CELL
                y = frame_y + row * MASK_CELL
                box = alpha.crop((x, y, x + MASK_CELL, y + MASK_CELL))
                filled.append(1 if box.getextrema()[1] >= THRESHOLD else 0)
        packed = bytearray(128)
        for i, value in enumerate(filled):
            if value:
                packed[i // 8] |= 1 << (i % 8)
        masks.append(bytes(packed).hex())
    return masks


def generate():
    sources, chunks = {}, {}
    for key, relative in ASSETS.items():
        path = ASSET_ROOT / relative
        sources[key] = hashlib.sha256(path.read_bytes()).hexdigest()
        with Image.open(path) as im:
            chunks[key] = mask_frames(im)
    # Share one dictionary of exact 32-bit rows across the 40 animation poses.
    # Little-endian uint16 indices represent each row; this is lossless and synchronous
    # to decode in modern browsers without canvas readbacks or decompression APIs.
    unique_rows, row_index = [], {}
    sequence = bytearray()
    for key in ASSETS:
        for hex_frame in chunks[key]:
            raw = bytes.fromhex(hex_frame)
            for offset in range(0, len(raw), 4):
                row = raw[offset:offset + 4]
                if row not in row_index:
                    row_index[row] = len(unique_rows)
                    unique_rows.append(row)
                sequence.extend(row_index[row].to_bytes(2,'little'))
    assert len(unique_rows) <= 65536 and len(sequence) == len(ASSETS) * 8 * 32 * 2
    dictionary = b''.join(unique_rows).hex()
    indices = base64.b64encode(sequence).decode('ascii')
    lines = [
        '// GENERATED from the official A2 WebP spritesheets. DO NOT EDIT.',
        '// Regenerate: python scripts/generate-snake-a2-masks.py',
        f'// Pixel alpha >= {THRESHOLD}; a {MASK_CELL}px tile is solid if ANY pixel qualifies.',
        '// Each 32x32 mask stores exact bitmap rows, using a shared row dictionary.',
        'export const SNAKE_A2_MASK_SOURCES = Object.freeze({',
    ]
    lines += [f"  {key}: '{sources[key]}'," for key in ASSETS]
    lines += [
        '});',
        "const ROWS_HEX = '" + dictionary + "';",
        "const FRAME_ROWS_B64 = '" + indices + "';",
        'const decodeMasks = () => {',
        '  const rowIndices = atob(FRAME_ROWS_B64);',
        '  const masks = {};',
        '  let next = 0;',
        f"  for (const key of {list({'idle':1,'attack':1,'stunned':1,'high':1,'sweep':1})!r}) {{",
        '    masks[key] = Array.from({length:8}, () => {',
        '      const cells = new Uint8Array(1024);',
        '      for (let row=0; row<32; row++) {',
        '        const index = rowIndices.charCodeAt(next++) | (rowIndices.charCodeAt(next++)<<8);',
        '        const offset = index*8;',
        '        for (let k=0; k<4; k++) {',
        '          const bits = parseInt(ROWS_HEX.slice(offset+k*2,offset+k*2+2),16);',
        '          for (let bit=0; bit<8; bit++) cells[row*32+k*8+bit] = (bits>>bit)&1;',
        '        }',
        '      }',
        '      return cells;',
        '    });',
        '  }',
        '  return masks;',
        '};',
        'export const SNAKE_A2_MASKS = decodeMasks();',
        '',
    ]
    return '\n'.join(lines)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='Fail if official sprite geometry changed without regeneration')
    args = ap.parse_args()
    content = generate()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            raise SystemExit('A2 collision masks are stale. Regenerate them from official spritesheets.')
        print('PASS: A2 collision masks match the official WebP assets byte-for-byte')
    else:
        OUTPUT.write_text(content)
        print(f'Wrote {OUTPUT} ({len(content)} characters)')
