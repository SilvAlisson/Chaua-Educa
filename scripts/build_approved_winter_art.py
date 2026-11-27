#!/usr/bin/env python3
"""Rebuild user-approved winter WebPs from the four JPEG source sheets.

Never replaces the original v7/v9 wood under transparent snow. Requires
Pillow, NumPy, opencv-python-headless. The source JPEGs are distributed in the
approved-art ZIP, not synthesized from the older repository-only artwork.

Usage: python scripts/build_approved_winter_art.py
"""
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent/'Chaua-Educa-main/assets'
SRC=Path(__file__).resolve().parent.parent/'art-source/winter'

def source_cells(path):
    image=Image.open(path).convert('RGB')
    if image.size!=(2048,2048):
        raise ValueError(f'Expected 2048x2048 four-cell source: {path}')
    return [np.asarray(image.crop(((k%2)*1024,(k//2)*1024,(k%2+1)*1024,(k//2+1)*1024)))
            for k in range(4)]

def snow_alpha(rgb):
    r,g,b=[rgb[:,:,k].astype(np.int16) for k in range(3)]
    strong=(b-r>=7)&(b>145)&(r>105)&(g-r>=2)&(b>=g-5)
    near=cv2.dilate(np.uint8(strong)*255,np.ones((9,9),np.uint8))>0
    pale=(r>=158)&(g>=160)&(b>=165)&(b>=r-3)&(b>=g-5)
    m=cv2.morphologyEx(np.uint8(strong|(near&pale))*255,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    n,labels,stats,_=cv2.connectedComponentsWithStats(m,8)
    clean=np.zeros(m.shape,np.uint8)
    for k in range(1,n):
        if stats[k,cv2.CC_STAT_AREA]>=55:clean[labels==k]=255
    return clean

def wood_box(rgb,alpha=None):
    r,g,b=[rgb[:,:,k].astype(np.float32) for k in range(3)]
    mask=(r>85)&(g>43)&(r>g*1.18)&(r>b*1.11)
    if alpha is not None:mask &= alpha>100
    ys,xs=np.where(mask)
    if len(xs)<20:raise ValueError('Unable to locate authored wood in cell')
    return np.percentile(xs,1),np.percentile(ys,1),np.percentile(xs,99),np.percentile(ys,99)

def align_overlay(src,base,kind,splice):
    old=wood_box(src)
    target=np.asarray(base.convert('RGBA'))
    dest=wood_box(target[:,:,:3],target[:,:,3])
    alpha=snow_alpha(src)
    ys,xs=np.where(alpha>0)
    if not len(xs):raise ValueError('Snow mask is empty')
    top=float(np.percentile(ys,1))
    if kind in ('lower','variants'):
        snow_top=7 if kind=='lower' else 4
        sy=(dest[3]-snow_top)/max(1,old[3]-top)
        ty=snow_top-top*sy
    else:
        sy=(dest[3]-dest[1])/max(1,old[3]-old[1])
        ty=dest[1]-old[1]*sy
    sx=(dest[2]-dest[0])/max(1,old[2]-old[0])
    tx=(dest[0]+dest[2])/2-(old[0]+old[2])/2*sx
    matrix=np.float32([[sx,0,tx],[0,sy,ty]])
    n=base.width
    A=cv2.warpAffine(cv2.GaussianBlur(alpha,(3,3),.75),matrix,(n,n),
                     flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    rgb=cv2.warpAffine(src,matrix,(n,n),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT)
    if kind in ('lower','variants'):
        margin=12 if kind=='lower' else 10
        feather=18 if kind=='lower' else 12
        limit=splice-margin
        for y in range(max(0,limit-feather),n):
            A[y,:]=np.uint8(A[y,:]*max(0,min(1,(limit-y)/feather)))
    if kind=='upper':
        # The wood anchored to the ceiling has no accumulated snow.
        for y in range(min(96,n)):
            A[y,:]=np.uint8(A[y,:]*max(0,min(1,(y-66)/30)))
    out=np.empty((n,n,4),np.uint8);out[:,:,:3]=rgb;out[:,:,3]=A
    return Image.fromarray(out,'RGBA'),{'source_wood':list(map(float,old)),
     'target_wood':list(map(float,dest)),'warp':matrix.tolist()}

def overlay_stage(sheet,stage):
    arr=np.array(sheet.convert('RGBA'))
    radius=(4-stage)*3
    if radius>0:arr[:,:,3]=cv2.erode(arr[:,:,3],np.ones((radius*2+1,radius*2+1),np.uint8))
    if stage<4:arr[:,:,3]=np.uint8(arr[:,:,3]*(.27+.73*stage/4))
    return Image.fromarray(arr,'RGBA')

def save(image,path):
    path.parent.mkdir(parents=True,exist_ok=True)
    image.save(path,'WEBP',lossless=True,method=6)

def main():
    meta={}
    specs=[
      ('variants','variants-original.jpg','v9/tree-variants.webp',256,[181,180,180,182]),
      ('lower','lower-original.jpg','v7/trees-lower.webp',512,[356,358,350,324]),
      ('upper','upper-original.jpg','v7/trees-upper.webp',512,[0,0,0,0])]
    for kind,source,wood,cell,splices in specs:
        base=Image.open(ROOT/wood).convert('RGBA')
        over=Image.new('RGBA',base.size)
        complete=Image.new('RGBA',base.size)
        meta[kind]=[]
        for i,img in enumerate(source_cells(SRC/source)):
            x,y=(i%2)*cell,(i//2)*cell
            old=base.crop((x,y,x+cell,y+cell))
            snow,details=align_overlay(img,old,kind,splices[i])
            meta[kind].append(details)
            over.alpha_composite(snow,(x,y))
            complete.paste(Image.alpha_composite(old,snow),(x,y))
        folder=ROOT/('v10' if kind=='variants' else 'Seasons/Winter')
        if kind=='variants':save(complete,folder/'tree-variants-snow.webp')
        else:
            save(complete,folder/f'trees-{kind}-snow-04.webp')
            for stage in range(1,5):
                overlay_folder=folder if stage==4 else SRC
                save(overlay_stage(over,stage),overlay_folder/f'trees-{kind}-overlay-0{stage}.webp')
    background=Image.open(SRC/'seasons-original.jpg').convert('RGB')
    if background.size!=(2048,1143):raise ValueError('Season JPEG must be 2048x1143')
    original=Image.open(ROOT/'v10/season-backgrounds.webp')
    w,h=original.size
    if (w,h)!=(1672,941):raise ValueError('The season atlas cell geometry has changed')
    combined=Image.new('RGB',(w,h))
    for i in range(4):
        crop=background.crop(((i%2)*1024,(i//2)*571,(i%2+1)*1024,571 if i<2 else 1143))
        rect=((i%2)*(w//2),(i//2)*(h//2))
        size=(w//2 if i%2==0 else w-w//2,h//2 if i<2 else h-h//2)
        combined.paste(crop.resize(size,Image.Resampling.LANCZOS),rect)
    save(combined.convert('RGBA'),ROOT/'v10/season-backgrounds.webp')
    (ROOT/'Seasons/Winter/alignment-metadata.json').write_text(json.dumps(meta,indent=2))
    print('Prepared four authorship-aligned sprite atlases and eight gradual snow overlays.')

if __name__=='__main__':main()
