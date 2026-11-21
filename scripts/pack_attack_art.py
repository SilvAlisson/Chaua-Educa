"""Pack complete generated silhouettes, preserving the authored anatomy/alpha.

Components, not nominal grid cuts, keep a tongue crossing a source-cell edge
from being duplicated/cut into the neighbour. All eight coils share a ground
anchor. Per-atlas sampling scale restores the original 280px coil width.
"""
from pathlib import Path
import json, statistics
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
SOURCES={key:ROOT/f'art-source/animal-weather/{key}.webp' for key in ['high','sweep']}
def pack(path):
 im=Image.open(path).convert('RGBA').resize((1536,768),Image.Resampling.LANCZOS)
 mask=im.getchannel('A').point(lambda x:255 if x>=112 else 0);pieces=[]
 for f in range(8):
  sx=f%4*384+194;sy=f//4*384+330
  assert mask.getpixel((sx,sy))==255,(f,'missing anchored coil')
  ImageDraw.floodfill(mask,(sx,sy),128)
  component=mask.point(lambda x:255 if x==128 else 0);box=component.getbbox();assert box
  # Lowest 40px of the illustrated coil excludes the articulating neck/head.
  base=component.crop((box[0],box[3]-40,box[2],box[3])).getbbox()
  ax=box[0]+(base[0]+base[2])/2;ay=box[3]
  pieces.append(dict(box=box,anchor=(ax,ay),width=base[2]-base[0]))
  mask=mask.point(lambda x:0 if x==128 else x)
 fit=min(1,*[min(180/(p['anchor'][0]-p['box'][0]),176/(p['box'][2]-p['anchor'][0]),338/(p['anchor'][1]-p['box'][1])) for p in pieces])
 atlas=Image.new('RGBA',(1536,768));rects=[]
 for f,p in enumerate(pieces):
  box=p['box'];pad=2;b=(max(0,box[0]-pad),max(0,box[1]-pad),min(im.width,box[2]+pad),min(im.height,box[3]+pad))
  crop=im.crop(b);crop=crop.resize((round(crop.width*fit),round(crop.height*fit)),Image.Resampling.LANCZOS)
  dx=round(194-(p['anchor'][0]-b[0])*fit);dy=round(355-(p['anchor'][1]-b[1])*fit)
  assert dx>=8 and dy>=8 and dx+crop.width<=376 and dy+crop.height<=376,(f,dx,dy,crop.size)
  atlas.alpha_composite(crop,(f%4*384+dx,f//4*384+dy));rects.append([dx,dy,crop.width,crop.height])
 return atlas,280/(statistics.median(p['width'] for p in pieces)*fit),rects
if __name__=='__main__':
 data={}
 for key,path in SOURCES.items():
  atlas,scale,rects=pack(path);dest=ROOT/f'Chaua-Educa-main/public/snake/attack/{key}.webp';atlas.save(dest,'WEBP',quality=94,method=6)
  data[key]={'scale':round(scale,7),'packedBounds':rects};print(key,scale,dest.stat().st_size)
 (ROOT/'Chaua-Educa-main/js/snake-attack-art.mjs').write_text('// Generated packing metadata; same physical coil width as the official A2 base.\nexport const SNAKE_ATTACK_ART='+json.dumps(data,separators=(',',':'))+';\n')

 for key,destination,size in [('feather','assets/v4/feather.webp',(384,384)),('shield','assets/v4/shield.webp',(384,384)),('season-particles','assets/v10/season-particles.webp',(256,256))]:
  im=Image.open(ROOT/f'art-source/animal-weather/{key}.webp').convert('RGBA').resize(size,Image.Resampling.LANCZOS)
  im.save(ROOT/'Chaua-Educa-main'/destination,'WEBP',quality=94,method=6)
