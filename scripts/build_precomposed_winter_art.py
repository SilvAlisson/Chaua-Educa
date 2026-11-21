#!/usr/bin/env python3
"""Bake winter art from the game's exact approved WebP sheets.

Never redraws trees. States 0 and 15 reuse the original artwork byte-for-byte
for living trunks; intermediate states combine the original sheet with the
approved snow overlay, using the game's 32-column snowRevealHeight geometry.
Output is art-only: it does not change runtime rendering.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "Chaua-Educa-main" / "assets"
WINTER = ASSETS / "Seasons" / "Winter"
OUT = WINTER / "Precomposed"
LEVELS = 16
COLUMNS = 32
TREE_METADATA = ROOT / "Chaua-Educa-main" / "js" / "forest-art-data.mjs"

def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def load_meta() -> dict:
    src = TREE_METADATA.read_text(encoding="utf-8")
    match = re.search(r"export const FOREST_ART=(\{.*\});", src, re.S)
    if not match:
        raise RuntimeError("Cannot parse game's authoritative forest art geometry")
    return json.loads(match.group(1))

def open_rgba(p: Path) -> Image.Image:
    if not p.is_file():
        raise FileNotFoundError(p)
    return Image.open(p).convert("RGBA")

def snow_reveal_height(intensity: float, column: int) -> float:
    amount = max(0.0, min(1.0, intensity))
    progress = 1.0 - (1.0 - amount) ** 1.6
    delay = (((column + 1) * 73) % 101) / 101.0 * 0.18
    return max(0.0, min(1.0, (progress - delay) / (1.0 - delay)))

def fill_reveal(mask: Image.Image, x: int, y: int, width: int, height: int, intensity: float) -> None:
    draw = ImageDraw.Draw(mask)
    for i in range(COLUMNS):
        reach = snow_reveal_height(intensity, i)
        if reach <= 0:
            continue
        x0 = x + math.floor(i * width / COLUMNS)
        x1 = x + math.floor((i + 1) * width / COLUMNS)
        y1 = y + math.floor(height * reach)
        if x1 > x0 and y1 > y:
            draw.rectangle((x0, y, x1 - 1, y1 - 1), fill=255)

def save_lossless(im: Image.Image, dest: Path) -> None:
    im.save(dest, format="WEBP", lossless=True, method=4, exact=True)

def verify_untouched(base: Image.Image, baked: Image.Image, mask: Image.Image) -> None:
    # Test exact source pixels outside the snow reveal before WebP encoding.
    diff = ImageChops.difference(base, baked)
    unchanged_area = ImageChops.invert(mask)
    for rgba_band in diff.split():
        if ImageChops.multiply(rgba_band, unchanged_area).getbbox():
            raise AssertionError("Original tree pixels were altered outside snow-covered positions")

def bake_living(kind: str, meta: dict) -> dict:
    base_file = ASSETS / "v7" / f"trees-{kind}.webp"
    snow_file = WINTER / f"trees-{kind}-snow-04.webp"
    overlay_file = WINTER / f"trees-{kind}-overlay-04.webp"
    base = open_rgba(base_file)
    snow_full = open_rgba(snow_file)
    overlay = open_rgba(overlay_file)
    assert base.size == overlay.size == snow_full.size == (1024, 1024)
    generated = []
    for level in range(LEVELS):
        dest = OUT / f"trees-{kind}-snow-{level:02d}.webp"
        if level == 0:
            shutil.copyfile(base_file, dest)
        elif level == LEVELS - 1:
            shutil.copyfile(snow_file, dest)
        else:
            mask = Image.new("L", base.size, 0)
            for f in meta[kind]:
                sx, sy, _, _ = f["rect"]
                splice = int(f["spliceY"])
                top = splice if kind == "upper" else 0
                bottom = min(512, int(f["endY"]) + 30) if kind == "upper" else splice
                fill_reveal(mask, sx, sy + top, 512, bottom - top, level / (LEVELS - 1))
            snow_layer = overlay.copy()
            snow_layer.putalpha(ImageChops.multiply(overlay.getchannel("A"), mask))
            baked = Image.alpha_composite(base, snow_layer)
            verify_untouched(base, baked, mask)
            save_lossless(baked, dest)
        assert open_rgba(dest).size == base.size
        generated.append(dest)
    assert sha256(generated[0]) == sha256(base_file)
    assert sha256(generated[-1]) == sha256(snow_file)
    return {"base": str(base_file.relative_to(ROOT)),
            "overlay": str(overlay_file.relative_to(ROOT)),
            "fullSnow": str(snow_file.relative_to(ROOT)),
            "files": [str(p.relative_to(ROOT)) for p in generated],
            "hashes": [sha256(p) for p in generated]}

def bake_special() -> dict:
    # Original special cap geometry: tree-art.mjs's TREE_CAP_Y=8,
    # TREE_SPLICES=[181,180,180,182], four 256px cells in a 512px atlas.
    base_file = ASSETS / "v9" / "tree-variants.webp"
    snow_file = ASSETS / "v10" / "tree-variants-snow.webp"
    base = open_rgba(base_file)
    full_snow = open_rgba(snow_file)
    assert base.size == full_snow.size == (512, 512)
    splits = (181, 180, 180, 182)
    files = []
    for level in range(LEVELS):
        dest = OUT / f"tree-variants-snow-{level:02d}.webp"
        if level == 0:
            shutil.copyfile(base_file, dest)
        else:
            mask = Image.new("L", base.size, 0)
            for variant, splice in enumerate(splits):
                x, y = variant % 2 * 256, variant // 2 * 256
                fill_reveal(mask, x, y + 8, 256, splice - 8, level / (LEVELS - 1))
            baked = Image.composite(full_snow, base, mask)
            verify_untouched(base, baked, mask)
            save_lossless(baked, dest)
        files.append(dest)
    assert sha256(files[0]) == sha256(base_file)
    return {"base": str(base_file.relative_to(ROOT)), "fullSnow": str(snow_file.relative_to(ROOT)),
            "files": [str(p.relative_to(ROOT)) for p in files],
            "hashes": [sha256(p) for p in files]}

def write_preview(family: str, paths: list[str]) -> None:
    preview = Image.new("RGBA", (1024, 1024))
    for stage, rel in enumerate(paths):
        frame = open_rgba(ROOT / rel)
        thumb = frame.resize((256, 256), Image.Resampling.LANCZOS)
        preview.alpha_composite(thumb, ((stage % 4) * 256, (stage // 4) * 256))
    preview.save(OUT / f"preview-{family}.png")

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    meta = load_meta()
    manifest = {
        "generator": "scripts/build_precomposed_winter_art.py",
        "source": "Game original assets; no generative redrawing",
        "stages": LEVELS,
        "stageZero": "exact byte-for-byte original",
        "stage15LivingTrees": "exact byte-for-byte approved full-snow source",
        "intermediate": "approved snow overlay, 32-column reveal on original sheet",
        "upperCeilingRule": "snow reveal clipped to below upper splice",
        "size": {"living": [1024, 1024], "special": [512, 512]},
        "families": {},
    }
    manifest["families"]["lower"] = bake_living("lower", meta)
    manifest["families"]["upper"] = bake_living("upper", meta)
    manifest["families"]["special"] = bake_special()
    for name, entry in manifest["families"].items():
        write_preview(name, entry["files"])
        print(f"{name}: {len(entry['files'])} original-based stages")
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Saved {3 * LEVELS} unaltered-geometry WebP sheets to {OUT}")

if __name__ == "__main__":
    main()
