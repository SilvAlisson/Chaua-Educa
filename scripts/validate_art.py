"""Verify exported native artwork, then generate the GIF and high-density atlas."""
from pathlib import Path
from PIL import Image
import json
root = Path(__file__).resolve().parents[1] / 'art/v2'
for p in (root/'png').glob('*.png'):
    im = Image.open(p).convert('RGBA')
    if 'atmosphere' not in p.name:
        assert im.getchannel('A').getextrema()[0] == 0, p
sheet = Image.open(root/'png/chaua-flight-sheet.png').convert('RGBA')
assert sheet.size == (1280, 640)
for i in range(8):
    im = Image.open(root/'png'/f'chaua-flight-{i:02}.png').convert('RGBA')
    b = im.getbbox()
    assert b and b[0] > 0 and b[1] > 0 and b[2] < 320 and b[3] < 320, (i, b)
    # SVG rendering may differ by subpixel rounding when translated in the atlas.
    tile = sheet.crop((i % 4 * 320, i // 4 * 320, (i % 4 + 1) * 320, (i // 4 + 1) * 320))
    assert tile.getbbox() == b, (i, 'atlas bounds')
frames = []
for i in range(8):
    bg = Image.new('RGB', (480, 360), '#e6edde')
    bird = Image.open(root/'png'/f'chaua-flight-{i:02}.png').convert('RGBA')
    bg.paste(bird, (80, 20), bird)
    frames.append(bg)
frames[0].save(root/'review/Chaua-Voo.gif', save_all=True, append_images=frames[1:], duration=[83]*8, loop=0)
meta = json.loads((root/'chaua-flight-atlas.json').read_text(encoding='utf-8'))
meta['meta']['image'] = 'chaua-flight-sheet@2x.png'
meta['meta']['size'] = {'w': 2560, 'h': 1280}
meta['meta']['scale'] = '2'
for f in meta['frames'].values():
    for k in ['frame', 'spriteSourceSize', 'sourceSize']:
        f[k] = {a: v*2 for a, v in f[k].items()}
(root/'chaua-flight-atlas@2x.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
pub_v2 = root.parents[0] / 'public/assets/v2'
if pub_v2.exists():
    (pub_v2 / 'chaua-flight-atlas@2x.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
    (pub_v2 / 'chaua-flight-atlas.json').write_text((root/'chaua-flight-atlas.json').read_text(encoding='utf-8'), encoding='utf-8')
print('Verified transparent PNGs, eight unclipped frames and atlas bounds. GIF and 2x atlas exported.')
