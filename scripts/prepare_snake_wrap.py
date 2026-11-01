"""Register generated torso art; no character redrawing."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy.ndimage import label,binary_dilation
root=Path(__file__).resolve().parents[1];out=root/'Chaua-Educa-main/assets/v8'
source=out/'snake-wrap-source.webp'
if not source.exists():
 import sys
 Image.open(sys.argv[1]).save(source,lossless=True,method=6)
a=np.array(Image.open(source).convert('RGBA'));labs,n=label(a[:,:,3]>100);counts=np.bincount(labs.ravel());counts[0]=0;k=counts.argmax();yy,xx=np.where(labs==k);x0,x1=xx.min()-3,xx.max()+4;y0,y1=yy.min()-3,yy.max()+4
x0=max(0,x0);y0=max(0,y0);x1=min(a.shape[1],x1);y1=min(a.shape[0],y1);crop=a[y0:y1,x0:x1].copy();mask=binary_dilation(labs[y0:y1,x0:x1]==k,iterations=2);crop[:,:,3]=np.where(mask,crop[:,:,3],0);crop[crop[:,:,3]==0,:3]=0
im=Image.fromarray(crop);im=im.resize((384,round(im.height*384/im.width)),Image.Resampling.LANCZOS);im.save(out/'snake-wrap.webp',lossless=True,method=6)
meta={'width':im.width,'height':im.height,'worldWidth':126,'worldHeight':round(im.height*126/im.width,4),'source':'snake-wrap-source.webp'}
# Inscribed row bands: transparent bark between turns is never a collider.
a=np.array(im);rects=[];scale=126/im.width
for y in range(0,im.height-12,12):
 opaque=(a[y:y+12,:,3]>180).mean(axis=0)>.9
 starts=np.where(np.diff(np.r_[False,opaque,False].astype(int))==1)[0];ends=np.where(np.diff(np.r_[False,opaque,False].astype(int))==-1)[0]
 for x,end in zip(starts,ends):
  if end-x>12:rects.append([round((x+3)*scale-63,4),round(y*scale-8,4),round((end-x-6)*scale,4),round(12*scale,4)])
meta['colliders']=rects
# Neck masks are measured inside the opaque sprite, preserving the empty air
# beside an S bend. Select the dominant authored pose during a crossfade.
atlas=np.array(Image.open(root/'Chaua-Educa-main/assets/v7/snake-atlas.webp').convert('RGBA'));neck=[]
for i in range(16):
 cell=atlas[(i//4)*384:(i//4+1)*384,(i%4)*384:(i%4+1)*384];bands=[]
 for y in range(136,276,12):
  opaque=(cell[y:y+12,:,3]>180).mean(axis=0)>.9
  starts=np.where(np.diff(np.r_[False,opaque,False].astype(int))==1)[0];ends=np.where(np.diff(np.r_[False,opaque,False].astype(int))==-1)[0]
  for x,end in zip(starts,ends):
   if end-x>10:bands.append([int(x+3),y,int(end-x-6),12])
 neck.append(bands)
meta['neckMasks']=neck
(root/'Chaua-Educa-main/js/snake-wrap-data.mjs').write_text('export const SNAKE_WRAP='+json.dumps(meta)+';\n')
print('snake-wrap:',im.size,'torso masks:',len(rects),'neck poses:',len(neck))
