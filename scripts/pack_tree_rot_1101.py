#!/usr/bin/env python3
"""Pack generated rotten-tree artwork into the existing cells; no painting.
Other three cells retain their decoded RGBA pixels exactly.
"""
from pathlib import Path
from collections import deque
import base64, json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'art-source/trees'
OUT=ROOT/'test-results/tree-art-packed'
OUT.mkdir(parents=True,exist_ok=True)

def main_bounds(im):
    a=im.getchannel('A')
    mask=bytearray(1 if v>=64 else 0 for v in a.getdata())
    w,h=im.size
    best=(0,None)
    for start in range(w*h):
        if not mask[start]:continue
        mask[start]=0
        q=deque([start]);n=0;left=w;right=0;top=h;bottom=0
        while q:
            p=q.popleft();x=p%w;y=p//w;n+=1
            left=min(left,x);right=max(right,x);top=min(top,y);bottom=max(bottom,y)
            for z in ([p-1] if x else [])+([p+1] if x<w-1 else [])+([p-w] if y else [])+([p+w] if y<h-1 else []):
                if mask[z]:mask[z]=0;q.append(z)
        if n>best[0]:best=(n,(left,top,right+1,bottom+1))
    assert best[0]>10000,'Empty or tiny generated tree'
    return best[1]

def registration(im):
    box=main_bounds(im)
    a=im.getchannel('A')
    # Straight lower wood, below the last mushroom, defines the collision core.
    y=round(box[3]-(box[3]-box[1])*.09)
    xs=[x for x in range(box[0],box[2]) if a.getpixel((x,y))>=112]
    assert xs
    return box,(xs[0]+xs[-1]+1)/2,xs[-1]-xs[0]+1

base=Image.open(SRC/'rot-1101.png').convert('RGBA')
box,center,core=registration(base)
scale=min(128/core,200/(box[3]-box[1]))
bottom=8+(box[3]-box[1])*scale
report={}
base_tile=None
for snowy,source,path in [
    (False,'rot-1101.png','Chaua-Educa-main/assets/v9/tree-variants.webp'),
    (True,'rot-snow-1101.png','Chaua-Educa-main/assets/v10/tree-variants-snow.webp')
]:
    original=Image.open(ROOT/path).convert('RGBA')
    assert original.size==(512,512)
    im=Image.open(SRC/source).convert('RGBA')
    bounds,cx,cw=registration(im)
    s=scale if not snowy else min(128/cw,210/(bounds[3]-bounds[1]))
    tile=Image.new('RGBA',(256,256))
    crop=im.crop(bounds)
    crop=crop.resize((round(crop.width*s),round(crop.height*s)),Image.Resampling.LANCZOS)
    x=round(128-(cx-bounds[0])*s)
    y=8 if not snowy else round(bottom-crop.height)
    assert 0<=y and 0<=x and x+crop.width<=256 and y+crop.height<=256,(x,y,crop.size)
    tile.paste(crop,(x,y))
    if not snowy:
        base_tile=tile.copy()
    else:
        # The snow source supplies only snow. Keep every exposed wood pixel
        # from the registered bare sprite, avoiding a second generated base.
        pixels=list(tile.getdata())
        pixels=[(r,g,b,a if r>=150 and g>=160 and b>=170 and b>=r*.94 and g>=r*.94 else 0)
                for r,g,b,a in pixels]
        snow_only=Image.new('RGBA',tile.size);snow_only.putdata(pixels)
        tile=Image.alpha_composite(base_tile,snow_only)
    atlas=original.copy();atlas.paste(tile,(0,0))
    assert atlas.crop((256,0,512,512)).tobytes()==original.crop((256,0,512,512)).tobytes()
    assert atlas.crop((0,256,256,512)).tobytes()==original.crop((0,256,256,512)).tobytes()
    output=OUT/Path(path).name
    atlas.save(output,'WEBP',lossless=True,method=6)
    decoded=Image.open(output).convert('RGBA')
    # Invisible RGB values are irrelevant; visible pixels of untouched cells agree.
    for region in [(256,0,512,512),(0,256,256,512)]:
        a=list(original.crop(region).getdata());b=list(decoded.crop(region).getdata())
        assert all(pa==pb or (pa[3]==pb[3]==0) for pa,pb in zip(a,b))
    report[path]={'source':source,'bounds':bounds,'placement':[x,y,*crop.size],'bytes':output.stat().st_size}
    encoded=base64.b64encode(output.read_bytes()).decode()
    print('TREE_FILE_BEGIN '+path,flush=True)
    for offset in range(0,len(encoded),8000):print('TREE_FILE_CHUNK '+encoded[offset:offset+8000],flush=True)
    print('TREE_FILE_END',flush=True)
print('TREE_PACK_REPORT '+json.dumps(report),flush=True)
(OUT/'registration.json').write_text(json.dumps(report,indent=2))

bark=Image.open(SRC/'bark-1101.png').convert('RGBA').resize((256,512),Image.Resampling.LANCZOS)
assert bark.getchannel('A').getextrema()==(255,255),'Bark must fill the texture'
output=OUT/'tree-bark.webp';bark.save(output,'WEBP',lossless=True,method=6)
encoded=base64.b64encode(output.read_bytes()).decode()
print('TREE_FILE_BEGIN Chaua-Educa-main/assets/v11/tree-bark.webp',flush=True)
for offset in range(0,len(encoded),8000):print('TREE_FILE_CHUNK '+encoded[offset:offset+8000],flush=True)
print('TREE_FILE_END',flush=True)
