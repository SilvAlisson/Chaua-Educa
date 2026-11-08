#!/usr/bin/env python3
"""Recreate the three weather-branch atlases from the game's OWN source art.

Keeps all scenery landmarks aligned in four seasons. Never overwrites v3/v7.
Requires Pillow; run: python scripts/rebuild_weather_atlases.py
"""
import json
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT=Path(__file__).resolve().parents[1]
ASSET=ROOT/'Chaua-Educa-main'/'assets'
JS=ROOT/'Chaua-Educa-main'/'js'
SIZE=(836,470)

def save(img,path,**kw):
    path.parent.mkdir(parents=True,exist_ok=True)
    img.save(path,'WEBP',method=6,**kw)
    print(f'{path.relative_to(ROOT)}: {img.width}x{img.height} ({path.stat().st_size} bytes)')

def byte(n): return max(0,min(255,int(round(n))))
def green(r,g,b): return max(0,min(1,(g-r*.77-b*.32-3)/44))

def grade(base,season):
    colors=[]
    for r,g,b in base.getdata():
        leaf=green(r,g,b)
        if season=='spring': out=(r*1.035+leaf*3,g*1.045+3,b*1.01)
        elif season=='summer': out=(r*1.06+4,g*1.045+6,b*.96)
        elif season=='autumn': out=(r*1.02+leaf*90,g*.96-leaf*18,b*.94-leaf*12)
        else: out=(r*.86+7,g*.90+12,b*1.00+23)
        colors.append(tuple(map(byte,out)))
    frame=Image.new('RGB',base.size)
    frame.putdata(colors)
    return frame

def blossoms(frame,original):
    rng=random.Random(2047)
    layer=Image.new('RGBA',SIZE)
    d=ImageDraw.Draw(layer,'RGBA')
    pix=original.load()
    placed=0
    for _ in range(1400):
        x=rng.randrange(20,SIZE[0]-20)
        y=rng.randrange(20,SIZE[1]-28)
        if .30<x/SIZE[0]<.72 and y>SIZE[1]*.24: continue
        if green(*pix[x,y])<.24: continue
        radius=rng.uniform(1.35,3.5)
        shade=rng.choice([(244,194,198,205),(255,223,223,230),(255,239,207,215)])
        d.ellipse((x-radius*1.4,y-radius*.62,x+radius*1.4,y+radius*.62),fill=shade)
        d.ellipse((x-radius*.15,y-radius*.8,x+radius*.85,y+radius*.2),
                  fill=(253,246,211,180))
        placed+=1
        if placed>=105: break
    return Image.alpha_composite(frame.convert('RGBA'),layer).convert('RGB')

def mist(img):
    layer=Image.new('RGBA',SIZE)
    d=ImageDraw.Draw(layer,'RGBA')
    for y in range(SIZE[1]):
        t=max(0,min(1,(y/SIZE[1]-.04)/.96))
        d.line((0,y,SIZE[0],y),fill=(203,220,224,round(62*t**1.4)))
    return Image.alpha_composite(img.convert('RGBA'),layer).convert('RGB')

def backgrounds():
    original=Image.open(ASSET/'v3/forest.webp').convert('RGB')
    base=ImageOps.fit(original,SIZE,Image.Resampling.LANCZOS,centering=(.5,.5))
    frames=[blossoms(grade(base,'spring'),base),grade(base,'summer'),
            grade(base,'autumn'),mist(grade(base,'cold'))]
    sheet=Image.new('RGB',(1672,941),(25,47,36))
    for frame,(x,y) in zip(frames,[(0,0),(836,0),(0,471),(836,471)]):
        sheet.paste(frame,(x,y))
    save(sheet,ASSET/'v10/season-backgrounds.webp',quality=90)

def polygon(d,points,fill,outline):
    d.polygon(points,fill=fill)
    d.line(points+[points[0]],fill=outline,width=2)

def particles():
    factor=4
    sheet=Image.new('RGBA',(256*factor,256*factor))
    palettes=[
        ((246,167,179,235),(255,220,219,250),(172,86,103,195)),
        ((255,229,193,240),(255,249,222,255),(175,136,107,190)),
        ((175,79,56,245),(234,142,79,250),(101,57,39,210)),
        ((228,174,65,245),(252,218,126,252),(132,101,50,210)),
    ]
    for index,(body,light,shadow) in enumerate(palettes):
        s=factor
        cell=Image.new('RGBA',(128*s,128*s))
        d=ImageDraw.Draw(cell,'RGBA')
        cx=64*s;cy=63*s
        if index<2:
            pts=[(cx-30*s,cy-15*s),(cx-12*s,cy-31*s),(cx+26*s,cy-17*s),
                 (cx+33*s,cy+9*s),(cx+8*s,cy+29*s),(cx-23*s,cy+19*s)]
            polygon(d,pts,body,shadow)
            d.ellipse((cx-15*s,cy-20*s,cx+15*s,cy+10*s),fill=light)
            d.arc((cx-24*s,cy-13*s,cx+26*s,cy+24*s),205,340,fill=shadow,width=2*s)
        else:
            pts=[]
            for j in range(17):
                t=j/16
                pts.append((int(cx+27*s*math.sin(math.pi*t)),
                            int(cy-38*s+78*s*t)))
            for j in range(16,-1,-1):
                t=j/16
                pts.append((int(cx-25*s*math.sin(math.pi*t)),
                            int(cy-38*s+78*s*t)))
            polygon(d,pts,body,shadow)
            d.line((cx,cy-32*s,cx,cy+39*s),fill=light,width=2*s)
            for j in range(1,5):
                yy=cy-28*s+j*14*s
                reach=11*s+3*s*math.sin(j*.8)
                d.line((cx,yy,cx-reach,yy-9*s),fill=light,width=s)
                d.line((cx,yy,cx+reach,yy-8*s),fill=light,width=s)
        sheet.alpha_composite(cell,((index%2)*128*s,(index//2)*128*s))
    out=sheet.resize((256,256),Image.Resampling.LANCZOS)
    save(out,ASSET/'v10/season-particles.webp',lossless=True)

def trees():
    art=(JS/'forest-art-data.mjs').read_text('utf-8')
    frames=json.loads(art.split('export const FOREST_ART=',1)[1].strip().rstrip(';'))['lower']
    original=Image.open(ASSET/'v7/trees-lower.webp').convert('RGBA')
    sheet=Image.new('RGBA',(512,512))
    rng=random.Random(9874)
    for i,kind in enumerate(('rot','hollow','moss','vine')):
        f=frames[i]
        sx,sy,sw,sh=f['rect'];core=f['core']
        factor=128/(core[1]-core[0])
        sprite=original.crop((sx,sy,sx+sw,sy+sh))
        sprite=sprite.resize((round(sw*factor),round(sh*factor)),Image.Resampling.LANCZOS)
        cell=Image.new('RGBA',(256,256))
        ox=round(128-(core[0]+core[1])*.5*factor)
        oy=round(8-f['anchor'][1]*factor)
        cell.paste(sprite,(ox,oy),sprite)
        splice=round(8+(f['spliceY']-f['anchor'][1])*factor)
        pixels=cell.load()
        for y in range(splice,256):
            for x in range(256): pixels[x,y]=(0,0,0,0)
        d=ImageDraw.Draw(cell,'RGBA')
        if kind=='rot':
            for _ in range(14):
                x=128+rng.randrange(-39,40)
                y=rng.randrange(35,splice-18)
                d.arc((x-6,y-11,x+6,y+8),80,225,fill=(76,44,24,95),width=2)
        elif kind=='hollow':
            d.ellipse((110,62,146,125),fill=(57,37,25,200),outline=(156,110,70,155),width=5)
            d.ellipse((116,73,140,116),fill=(29,26,23,220))
            d.arc((109,62,146,125),60,170,fill=(228,179,107,120),width=3)
        elif kind=='moss':
            for _ in range(42):
                x=128+rng.choice([-1,1])*rng.randrange(29,54)
                y=rng.randrange(42,splice-10)
                d.ellipse((x-3,y-2,x+4,y+3),
                          fill=rng.choice([(65,113,58,135),(115,145,57,145),(58,94,56,165)]))
        else:
            d.line([(158,32),(153,61),(166,89),(151,112),(158,139),(146,170)],
                   fill=(34,81,45,175),width=5,joint='curve')
            for x,y in ((151,65),(164,89),(153,132)):
                d.ellipse((x-7,y-5,x+7,y+5),fill=(76,125,57,190))
        sheet.alpha_composite(cell,((i%2)*256,(i//2)*256))
        print(f'{kind}: splice={splice}')
        expected=[187,188,184,187][i]
        if splice!=expected:
            raise ValueError(f'Trunk {kind} requires splice={splice}; code expects {expected}')
    save(sheet,ASSET/'v9/tree-variants.webp',lossless=True)

if __name__=='__main__':
    backgrounds()
    particles()
    trees()
