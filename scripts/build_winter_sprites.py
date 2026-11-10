#!/usr/bin/env python3
"""Generate the winter layers from the unchanged original v7 2x2 tree atlases.

Each WebP remains 1024x1024 (four variants in original positions).
For upper trees: NEVER place snow along the ceiling-attached top edge.
Only outward, upward-facing branch/leaf/moss shelves collect snow.
"""
from pathlib import Path
import math
import random
import base64
import zlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "Chaua-Educa-main" / "assets"
SRC = ASSETS / "v7"
DEST = ASSETS / "Seasons" / "Winter"
DEST.mkdir(parents=True, exist_ok=True)
SIZE = 1024

LOWER = [
    {"cut": (257, 25, 111), "leaves": [], "branches": [], "mushrooms": []},
    {"cut": (766, 25, 111), "leaves": [(632,96,31,9),(916,134,26,8)],
     "branches": [(615,127,18,5),(918,181,21,6)], "mushrooms": []},
    {"cut": (254,537,110), "leaves": [(115,569,24,8),(150,628,27,9),(346,612,24,8),
                                      (116,715,21,6),(359,748,16,5)],
     "branches": [], "mushrooms": [(378,715,18,7),(161,770,19,7)]},
    {"cut": (768,537,104), "leaves": [(571,571,25,7),(603,558,23,8)],
     "branches": [(594,639,36,6)], "mushrooms": []},
]
UPPER = [
    {"leaves": [], "branches": [], "moss": []},
    {"leaves": [(627,99,21,7),(655,113,18,5),(944,186,28,7),(982,220,17,5)],
     "branches": [(646,150,31,6),(922,216,35,7)], "moss": []},
    {"leaves": [(190,698,15,5),(339,815,15,5),(351,813,10,4)],
     "branches": [], "moss": [(176,684,32,10),(342,598,22,9),(165,837,14,7),(349,791,20,7)]},
    {"leaves": [(612,695,19,6),(865,563,21,7),(904,608,20,6)],
     "branches": [(830,636,38,9),(642,720,28,6)], "moss": []},
]

def shaded(layer, points, seed):
    # Continuous powder highlight -> cool blue-white shaded underside.
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    x0, x1 = max(0, int(min(xs))-4), min(SIZE, int(max(xs))+5)
    y0, y1 = max(0, int(min(ys))-4), min(SIZE, int(max(ys))+5)
    if x1<=x0 or y1<=y0: return
    w,h=x1-x0,y1-y0
    mask=Image.new("L",(w*3,h*3))
    ImageDraw.Draw(mask).polygon([((x-x0)*3,(y-y0)*3) for x,y in points],fill=255)
    mask=mask.resize((w,h),Image.Resampling.LANCZOS)
    yy,xx=np.mgrid[y0:y1,x0:x1]
    factor=np.clip((yy-min(ys))/max(3,max(ys)-min(ys)),0,1)**1.45
    noise=(np.sin(xx*.077+seed)+np.sin(xx*.155+yy*.089+seed*2))*.75
    out=np.empty((h,w,4),dtype=np.uint8)
    for i,(hi,lo) in enumerate(zip((251,253,255),(192,219,238))):
        out[:,:,i]=np.uint8(np.clip(hi+(lo-hi)*factor+noise,0,255))
    out[:,:,3]=np.asarray(mask)
    layer.alpha_composite(Image.fromarray(out,"RGBA"),(x0,y0))

def drift(layer,cx,y,hw,dep,stage,seed):
    if hw<2 or dep<1:return
    u=np.linspace(0,1,91)
    x=cx+(u*2-1)*hw
    bow=np.maximum(0,1-(2*u-1)**2)**.7
    loft=max(1.0,dep*(.34+.08*stage))
    upper=y-loft*bow + .55*np.sin(2*math.pi*u*3+seed*.3)*np.sin(math.pi*u)
    scallop=(np.sin((u*3.1+seed*.13)*math.pi)**8)*max(.45,dep*.11)
    lower=y+dep*bow*.78 + scallop*np.sin(math.pi*u)**.5
    shaded(layer,list(zip(x,upper))+list(zip(x[::-1],lower[::-1])),seed)

def cap(layer,x,y,hw,dep,stage,seed):
    u=np.linspace(0,1,121)
    xs=x+(2*u-1)*hw
    rise=np.maximum(0,1-(2*u-1)**2)**.55
    upper=y+5-(3+dep*.42)*rise + np.sin(u*2*math.pi+seed*.15)*np.sin(math.pi*u)
    lower=y+dep*(.30+.7*rise) +(np.sin((u*3.2+seed*.17)*math.pi)**8)*dep*.14
    shaded(layer,list(zip(xs,upper))+list(zip(xs[::-1],lower[::-1])),seed)

def sprinkle_cut(layer,x,y,hw,stage,seed):
    # Horizontal cut of the LOWER tree is exposed to falling snow.
    if stage==1:
        for i,(dx,dy,w) in enumerate([(-.77,29,19),(-.48,39,19),(-.17,45,24),(.24,45,18),(.70,30,20)]):
            drift(layer,x+dx*hw,y+dy,w,3.5,stage,seed+i)
        for i,(dx,dy,w) in enumerate([(-.46,9,18),(.41,7,14)]):
            drift(layer,x+dx*hw,y+dy,w,2.4,stage,seed+12+i)
    elif stage==2:
        for i,(dx,dy,w,d) in enumerate([(-.55,36,42,7),(.04,45,53,9),(.63,32,35,7)]):
            drift(layer,x+dx*hw,y+dy,w,d,stage,seed+i)
        for i,(dx,dy,w) in enumerate([(-.45,12,37),(.23,15,33)]):
            drift(layer,x+dx*hw,y+dy,w,5.5,stage,seed+12+i)
    elif stage==3:
        cap(layer,x,y+21,hw*.95,29,stage,seed)
        drift(layer,x-26,y+17,hw*.58,11,stage,seed+11)
        drift(layer,x+35,y+18,hw*.45,10,stage,seed+12)
    else:
        cap(layer,x,y+6,hw*.99,54,stage,seed)
        drift(layer,x,y+48,hw*.93,13,stage,seed+22)
        drift(layer,x-53,y+51,35,11,stage,seed+23)
        drift(layer,x+40,y+52,38,10,stage,seed+24)

def growth(layer,entries,stage,seed,kind):
    for i,(x,y,hw,dep) in enumerate(entries):
        if stage==1 and i%3==2:continue
        if stage==2 and i%4==3:continue
        scale=[0,.38,.59,.78,1][stage] * (1.05 if kind=="branch" else .85 if kind=="moss" else 1)
        drift(layer,x,y,hw*scale,dep*(.55+stage*.33),stage,seed+i*17+3)

def make_overlay(original,kind,stage):
    snow=Image.new("RGBA",(SIZE,SIZE),(0,0,0,0))
    if kind=="lower":
        for n,t in enumerate(LOWER):
            seed=n*41+19
            sprinkle_cut(snow,*t["cut"],stage,seed)
            growth(snow,t["leaves"],stage,seed+32,"leaves")
            growth(snow,t["branches"],stage,seed+40,"branch")
            growth(snow,t["mushrooms"],stage,seed+70,"leaves")
    else:
        for n,t in enumerate(UPPER):
            seed=n*41+38
            # No snow on top edge y=0..44 and y=534..558; attached to canopy.
            # No snow on jagged lower cut because it faces the ground.
            growth(snow,t["leaves"],stage,seed,"leaves")
            growth(snow,t["branches"],stage,seed+62,"branch")
            growth(snow,t["moss"],stage,seed+99,"moss")
    near_original=original.getchannel("A").filter(ImageFilter.MaxFilter(31))
    a=np.array(snow.getchannel("A"),dtype=np.uint16)
    b=np.array(near_original,dtype=np.uint16)
    snow.putalpha(Image.fromarray(((a*b)//255).astype("uint8"),"L"))
    if kind=="upper":
        pixel_alpha=np.asarray(snow.getchannel("A"))
        assert not pixel_alpha[:45,:].any(), "Snow detected at attached ceiling"
        assert not pixel_alpha[534:550,140:372].any(), "Snow detected at bottom-row ceiling"
        assert not pixel_alpha[534:550,645:820].any(), "Snow detected at bottom-row ceiling"
    return snow


def clean_main_atlas(image, kind):
    """Restore transparent silhouette using the approved original PNG alpha mask.

    Old v7 WebPs have red/yellow rectangular contamination in nominally
    transparent regions. Exact shapes were taken from the 1024x1024 user
    reference PNGs and stored as losslessly compressed 1-bit silhouette data.
    This discards only transparent-area artifacts; the wood RGB is untouched.
    """
    text=(ROOT/"scripts"/"winter-masks"/f"{kind}_silhouette.b64").read_text().strip()
    packed=zlib.decompress(base64.b64decode(text,validate=True))
    assert len(packed)==(SIZE*SIZE)//8, (kind,len(packed))
    bits=np.unpackbits(np.frombuffer(packed,dtype=np.uint8)).reshape(SIZE,SIZE)
    # Subpixel antialiasing while keeping all silhouettes at original positions.
    mask=Image.fromarray((bits*255).astype(np.uint8),"L")
    mask=mask.filter(ImageFilter.GaussianBlur(.48))
    image.putalpha(mask)
    return image

for kind in ("lower","upper"):
    original=Image.open(SRC/f"trees-{kind}.webp").convert("RGBA")
    original=clean_main_atlas(original,kind)
    assert original.size==(1024,1024), (kind,original.size)
    for stage in range(1,5):
        overlay=make_overlay(original,kind,stage)
        combined=Image.alpha_composite(original,overlay)
        # WebP lossless with alpha and dimensions identical to original atlas.
        output=DEST/f"trees-{kind}-snow-{stage:02d}.webp"
        combined.save(output,format="WEBP",lossless=True,method=3,exact=True)
        overlay.save(DEST/f"trees-{kind}-overlay-{stage:02d}.webp",
                     format="WEBP",lossless=True,method=3,exact=True)
        old=np.asarray(original)
        new=np.asarray(combined)
        untouched=np.asarray(overlay.getchannel("A"))==0
        assert np.array_equal(old[untouched],new[untouched]), output
        print(output.relative_to(ROOT), output.stat().st_size)

# Small independent loop frames of snow falling from upper tree branches.
for frame in range(6):
    layer=Image.new("RGBA",(SIZE,SIZE))
    drawer=ImageDraw.Draw(layer,"RGBA")
    for idx,(x,y,salt) in enumerate([(650,151,3),(946,234,7),(335,655,11),
                                      (178,727,13),(840,686,17),(630,743,23),(355,828,29)]):
        for n in range(7):
            t=(frame/6+n/7+idx*.11)%1.
            xx=x+(2*n-5)*3+9*math.sin(t*math.pi*2+salt)
            yy=y+12+85*t
            r=(1.4+(idx+n)%3*.65)*(1-.24*t)
            alpha=int(225*(1-.75*t))
            drawer.ellipse((xx-r,yy-r,xx+r,yy+r),fill=(235,246,255,alpha))
    layer.save(DEST/f"trees-upper-shedding-{frame:02d}.webp",
               format="WEBP",lossless=True,method=3,exact=True)
print("Winter assets generated successfully")
