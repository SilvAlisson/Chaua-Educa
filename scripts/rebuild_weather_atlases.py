#!/usr/bin/env python3
"""Recreate the three weather-branch atlases from the game's OWN source art.

Keeps all scenery landmarks aligned in four seasons. Never overwrites v3/v7.
Requires Pillow; run: python scripts/rebuild_weather_atlases.py
"""
import json
import math
import random
import subprocess
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps, ImageEnhance

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
        if .16<x/SIZE[0]<.84: continue  # blossom on painted side foliage only
        if green(*pix[x,y])<.24: continue
        radius=rng.uniform(1.1,2.5)
        shade=rng.choice([(244,194,198,205),(255,223,223,230),(255,239,207,215)])
        d.ellipse((x-radius*1.4,y-radius*.62,x+radius*1.4,y+radius*.62),fill=shade)
        d.ellipse((x-radius*.15,y-radius*.8,x+radius*.85,y+radius*.2),
                  fill=(253,246,211,180))
        placed+=1
        if placed>=70: break
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

# Reuse the hand-painted, artistically consistent sprites from the incoming
# weather branch as source material, never the debug-colored v7 texture atlas.
# Pin source to the user's pre-rebuild commit so future regenerations are stable.
def hand_painted(rel):
    raw=subprocess.check_output(
        ['git','show',f'8ac0815c2fbf3c289508d74cba694dd335b2d8d1:{rel}'],
        cwd=ROOT)
    return Image.open(BytesIO(raw)).convert('RGBA')

def restore_painted_sheet(rel,out,saturation=1.035):
    source=hand_painted(rel)
    alpha=source.getchannel('A')
    painted=ImageEnhance.Color(source.convert('RGB')).enhance(saturation)
    painted.putalpha(alpha)
    # Original source already matches the game's 2.5D rendered style.
    # Pixel-art replacements, rectangles, artificial outlines are forbidden.
    save(painted,ASSET/out,lossless=True)

def particles():
    restore_painted_sheet('Chaua-Educa-main/assets/v10/season-particles.webp',
                          'v10/season-particles.webp',1.045)

def trees():
    # Keep the original hand-painted stump caps, unique knots and decorations.
    # The lowest strip of each cell is repurposed for a knot-free, seam-safe
    # bark texture. It is never painted as part of the cap.
    source=hand_painted('Chaua-Educa-main/assets/v9/tree-variants.webp')
    alpha=source.getchannel('A')
    sheet=ImageEnhance.Color(source.convert('RGB')).enhance(1.025)
    sheet.putalpha(alpha)
    splices=[181,180,180,182]
    for i,splice in enumerate(splices):
        ox=(i%2)*256; oy=(i//2)*256
        cell=sheet.crop((ox,oy,ox+256,oy+256))
        pixels=cell.load()
        profile=[]
        for x in range(64,192):
            samples=[]
            for y in range(splice-13,splice-2):
                r,g,b,a=pixels[x,y]
                if a>170 and r>g*1.1 and r>b*1.15:
                    samples.append((r,g,b))
            if not samples: profile.append(None)
            else:
                ordered=list(zip(*samples))
                profile.append(tuple(sorted(v)[len(v)//2] for v in ordered))
        valid=[x for x,v in enumerate(profile) if v is not None]
        if not valid: raise ValueError(f'No bark core in painted cell {i}')
        for x,v in enumerate(profile):
            if v is None:
                closest=min(valid,key=lambda k:abs(k-x))
                profile[x]=profile[closest]
        tile=Image.new('RGBA',(128,64))
        out=tile.load()
        for x in range(128):
            for y in range(64):
                # Same color at the top and bottom, with soft, original-hued
                # vertical grooves instead of endlessly duplicated knots.
                fade=math.sin(math.pi*y/63)**2
                variation=fade*(2.4*math.sin(x*.27+y*.13)+
                                1.5*math.sin(x*.11-y*.08))
                r,g,b=profile[x]
                out[x,y]=(byte(r+variation),byte(g+variation*.72),
                          byte(b+variation*.54),255)
        sheet.alpha_composite(tile,(ox+64,oy+192))
    save(sheet,ASSET/'v9/tree-variants.webp',lossless=True)

if __name__=='__main__':
    backgrounds()
    particles()
    trees()
