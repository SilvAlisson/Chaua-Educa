"""Pack generated poses into registered cells; keep source artwork unmodified.

This is deterministic asset preparation: component extraction, uniform registration,
transparent gutters and lossless WebP encoding. No character is redrawn here.
"""
from pathlib import Path
import json,sys,math
import numpy as np
from PIL import Image
from scipy.ndimage import label,binary_dilation
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'Chaua-Educa-main/assets/v6'
SOURCES={
 'chaua':'chaua-source.png',
 'hawk':'hawk-source.png',
 'snake':'snake-source.png',
}
CELL=384
manifest={}
for name,filename in SOURCES.items():
 source=Image.open(Path(sys.argv[1])/filename).convert('RGBA');a=np.asarray(source)
 labs,n=label(a[:,:,3]>100);counts=np.bincount(labs.ravel());counts[0]=0
 ids=[int(k) for k in counts.argsort()[-16:]]
 ids.sort(key=lambda k:(float(np.where(labs==k)[0].mean())//(source.height/4),float(np.where(labs==k)[1].mean())))
 frames=[]
 for frame_index,k in enumerate(ids):
  ys,xs=np.where(labs==k);x0=max(0,int(xs.min())-4);y0=max(0,int(ys.min())-4);x1=min(source.width,int(xs.max())+5);y1=min(source.height,int(ys.max())+5)
  crop=a[y0:y1,x0:x1].copy();component=binary_dilation(labs[y0:y1,x0:x1]==k,iterations=3)
  crop[:,:,3]=np.where(component&(crop[:,:,3]>8),crop[:,:,3],0)
  crop[crop[:,:,3]==0,:3]=0
  im=Image.fromarray(crop)
  rotation=0
  if name=='hawk' and frame_index in (10,11):
   # Source dive poses have an intrinsic pitch. Level the art so the shared
   # renderer/collider trajectory applies that pitch exactly once.
   rotation=-42 if frame_index==10 else -50
   im=im.rotate(rotation,Image.Resampling.BICUBIC,expand=True)
   im=im.crop(im.getbbox());crop=np.asarray(im).copy()
  r,g,b,alpha=[crop[:,:,j].astype(float) for j in range(4)]
  if name!='snake':
   orange=((r>200)&(g>140)&(g<230)&(b<110)&(alpha>150)) if name=='hawk' else ((r>170)&(g>65)&(g<210)&(b<110)&(alpha>150));ll,nn=label(orange);cs=np.bincount(ll.ravel());cs[0]=0
   candidates=[]
   for c in cs.argsort()[-15:]:
    if cs[c]<30:continue
    yy,xx=np.where(ll==c)
    if (name=='chaua' and xx.mean()>im.width*.58 and yy.mean()<im.height*.85) or (name=='hawk' and xx.mean()<im.width*.25):candidates.append((cs[c],c))
   if not candidates:raise RuntimeError(f'{name}: beak landmark not found')
   c=max(candidates)[1];yy,xx=np.where(ll==c);landmark=(float(xx.mean()),float(yy.mean()));lw=float(xx.max()-xx.min()+1)
  else:
   landmark=(im.width/2,im.height-3);lw=im.width-8
  frames.append({'im':im,'landmark':landmark,'lw':lw,'sourceBounds':[x0,y0,x1-x0,y1-y0],'rotation':rotation})
 anchor=(192,192) if name!='snake' else (192,328)
 target=(276,180) if name=='chaua' else (80,196) if name=='hawk' else anchor
 desired=60 if name=='chaua' else 52 if name=='hawk' else 260
 for f in frames:
  cx,cy=f['landmark'];w,h=f['im'].size
  limits=[(target[0]-14)/max(1,cx),(CELL-14-target[0])/max(1,w-cx),(target[1]-14)/max(1,cy),(CELL-14-target[1])/max(1,h-cy)]
  desired=min(desired,min(limits)*f['lw'])
 atlas=Image.new('RGBA',(CELL*4,CELL*4));metadata=[]
 for i,f in enumerate(frames):
  scale=desired/f['lw'];cx,cy=f['landmark'];im=f['im'];w=max(1,round(im.width*scale));h=max(1,round(im.height*scale))
  resized=im.resize((w,h),Image.Resampling.LANCZOS)
  dx=round(target[0]-cx*scale);dy=round(target[1]-cy*scale)
  assert dx>=10 and dy>=10 and dx+w<=CELL-10 and dy+h<=CELL-10,(name,i,dx,dy,w,h)
  cell=Image.new('RGBA',(CELL,CELL));cell.alpha_composite(resized,(dx,dy));atlas.alpha_composite(cell,((i%4)*CELL,(i//4)*CELL))
  item={'rect':[(i%4)*CELL,(i//4)*CELL,CELL,CELL],'anchor':list(anchor),'content':[dx,dy,w,h],'sourceBounds':f['sourceBounds'],'sourceRotation':f['rotation']}
  if name!='snake':
   ca=np.asarray(cell);rr,gg,bb,aa=[ca[:,:,j] for j in range(4)];yy0,xx0=np.indices(rr.shape)
   dark=(rr<65)&(gg<75)&(bb<85)&(aa>180)
   ex=target[0]+(-32 if name=='chaua' else 34);ey=target[1]-18
   dark &= (abs(xx0-ex)<45)&(abs(yy0-ey)<45)
   lab,nn=label(dark);sizes=np.bincount(lab.ravel());sizes[0]=0
   candidates=[]
   for cc in sizes.argsort()[-12:]:
    if sizes[cc]<12:continue
    yv,xv=np.where(lab==cc);candidates.append(((xv.mean()-ex)**2+(yv.mean()-ey)**2, float(xv.mean()),float(yv.mean())))
   if candidates:
    _,ex,ey=min(candidates)
   item['eye']=[round(ex,2),round(ey,2)]
  if name=='snake':
   ca=np.asarray(cell);rr,gg,bb,aa=[ca[:,:,j] for j in range(4)];dark=(rr<50)&(gg<50)&(bb<50)&(aa>200);ll,nn=label(dark);cs=np.bincount(ll.ravel());cs[0]=0;ii=int(cs.argmax());yy,xx=np.where(ll==ii)
   ew=float(xx.max()-xx.min()+1);eh=float(yy.max()-yy.min()+1)
   item['head']=[round(float(xx.mean())+ew*.6,2),round(float(yy.mean())+eh*.3,2),round(max(18,ew*2.1),2),round(max(15,eh*1.15),2)]
  metadata.append(item)
 atlas.save(OUT/f'{name}-atlas.webp',lossless=True,method=6)
 manifest[name]={'cell':CELL,'anchor':list(anchor),'landmarkWidth':round(desired,4),'frames':metadata,'source':filename}
 print(name,'16 frames',atlas.size,'reference',round(desired,2),'bytes',(OUT/f'{name}-atlas.webp').stat().st_size)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'Chaua-Educa-main/js/sprite-data.mjs').write_text('// Generated by scripts/prepare_sprite_atlases.py.\nexport const SPRITES = '+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
