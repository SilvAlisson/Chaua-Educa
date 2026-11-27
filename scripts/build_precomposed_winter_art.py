#!/usr/bin/env python3
"""Bake and pack only the visible caps from the approved tree and snow art."""
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "Chaua-Educa-main"
WINTER = GAME / "assets/Seasons/Winter"
OUT = WINTER / "Precomposed"
JS = GAME / "js"
LEVELS, PAGE_STAGES, GUTTER = 16, 4, 2
FAMILIES = ("lower", "upper", "special")


def rgba(path):
    with Image.open(path) as image:
        return image.convert("RGBA")


def reveal_mask(size, level, variant):
    """A connected, lightly feathered snow edge that grows monotonically."""
    width, height = size
    progress = level / (LEVELS - 1)
    mask = Image.new("L", size)
    for x in range(width):
        u = x / max(1, width - 1)
        phase = variant * 1.41
        delay = .09 + .045 * math.sin(u * 9 + phase) + .025 * math.sin(u * 23 + phase)
        reach = (max(0, progress - delay) / (1 - delay)) ** .86
        edge = height * min(1, reach)
        for y in range(min(height, math.ceil(edge + 1))):
            mask.putpixel((x, y), round(255 * min(1, max(0, (edge - y) / 1.5))))
    return mask


def source_caps():
    geometry = json.loads((JS / "forest-art-data.mjs").read_text().split("FOREST_ART=", 1)[1].rstrip().rstrip(";"))
    out = {}
    for kind in FAMILIES:
        if kind == "special":
            base = rgba(GAME / "assets/v9/tree-variants.webp")
            overlay = rgba(GAME / "assets/v10/tree-variants-snow.webp")
            boxes = [(i % 2 * 256, i // 2 * 256, 256, h) for i, h in enumerate((181, 180, 180, 182))]
        else:
            base = rgba(GAME / f"assets/v7/trees-{kind}.webp")
            overlay = rgba(WINTER / f"trees-{kind}-overlay-04.webp")
            boxes = []
            for frame in geometry[kind]:
                sx, sy, _, _ = frame["rect"]
                cx, _, width, _ = frame["content"]
                splice = frame["spliceY"]
                top = splice if kind == "upper" else 0
                end = min(512, frame["endY"] + 30) if kind == "upper" else splice - 1
                boxes.append((sx + cx, sy + top, width, end - top))
        out[kind] = [(base.crop((x, y, x + w, y + h)), overlay.crop((x, y, x + w, y + h)))
                     for x, y, w, h in boxes]
    return out


def bake(base, snow, kind, level, variant):
    if level == LEVELS - 1:
        return snow  # Only special caps need a packed final frame.
    mask = reveal_mask(base.size, level, variant)
    if kind == "special":
        return Image.composite(snow, base, mask)
    coating = snow.copy()
    coating.putalpha(ImageChops.multiply(snow.getchannel("A"), mask))
    return Image.alpha_composite(base, coating)


def pack_rows(rows):
    width = max(sum(im.width + 2 * GUTTER for im in row) for _, _, row in rows)
    height = sum(max(im.height for im in row) + 2 * GUTTER for _, _, row in rows)
    canvas = Image.new("RGBA", (width, height))
    coords = []
    y = GUTTER
    for kind, level, row in rows:
        x = GUTTER
        boxes = []
        for im in row:
            canvas.paste(im, (x, y))
            boxes.append([x, y, im.width, im.height])
            x += im.width + 2 * GUTTER
        coords.append((kind, level, boxes))
        y += max(im.height for im in row) + 2 * GUTTER
    return canvas, coords


def save_webp(image, path):
    # Preserve the authored silhouette exactly. High quality WebP keeps
    # the color detail while making the production download practical.
    image.save(path, quality=94, method=6, alpha_quality=100, exact=True)
    assert rgba(path).getchannel("A").tobytes() == image.getchannel("A").tobytes()


def main():
    OUT.mkdir(exist_ok=True)
    sources = source_caps()
    baked = {kind: [None] * LEVELS for kind in FAMILIES}
    for level in range(1, LEVELS):
        for kind, variants in sources.items():
            if level == LEVELS - 1 and kind != "special":
                continue
            baked[kind][level] = [bake(*art, kind, level, i) for i, art in enumerate(variants)]

    frames = {kind: [None] * LEVELS for kind in FAMILIES}
    pages = []
    for start in range(1, LEVELS, PAGE_STAGES):
        rows = []
        for level in range(start, min(start + PAGE_STAGES, LEVELS)):
            for kind in FAMILIES:
                if baked[kind][level] is not None:
                    rows.append((kind, level, baked[kind][level]))
        page, coords = pack_rows(rows)
        page_idx = len(pages)
        for kind, level, boxes in coords:
            frames[kind][level] = [[page_idx, x, y, w, h] for x, y, w, h in boxes]
        name = f"winter-caps-{page_idx}.webp"
        path = OUT / name
        save_webp(page, path)
        pages.append({"file": name, "width": page.width, "height": page.height,
                      "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        print(name, page.size, path.stat().st_size)

    stage_frames = {kind: [None] * LEVELS for kind in FAMILIES}
    stage_pages = [None] * LEVELS
    for level in range(1, LEVELS):
        rows = [(kind, level, baked[kind][level]) for kind in FAMILIES if baked[kind][level] is not None]
        strip, coords = pack_rows(rows)
        for kind, _, boxes in coords:
            stage_frames[kind][level] = boxes
        name = f"winter-caps-stage-{level:02d}.webp"
        path = OUT / name
        save_webp(strip, path)
        stage_pages[level] = {"stage": level, "file": name, "width": strip.width, "height": strip.height,
                              "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        print(name, strip.size, path.stat().st_size)

    manifest = {"stages": LEVELS, "pages": pages, "frames": frames,
                "stagePages": stage_pages, "stageFrames": stage_frames}
    (OUT / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    (JS / "winter-cap-data.mjs").write_text(
        "// Generated by scripts/build_precomposed_winter_art.py.\n"
        f"export const WINTER_CAP_ART={json.dumps(manifest, separators=(',', ':'))};\n"
    )


if __name__ == "__main__":
    main()
