"""Measure contact points on authored alpha contours; never rewrite character art.

Only rear wings/back (birds) and exposed lower coils (snake) are eligible.
Points sit three source pixels inside an opaque 7px run; faces, stars and mouths
are excluded. Re-run after replacing any production animal atlas.
"""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'Chaua-Educa-main'
SHEETS={
 'parrot-flight':('public/parrot/fly/flight.webp',256,8,'chaua'),
 'hawk-flight':('public/hawk/fly/flight.webp',320,8,'hawk'),
 'chaua':('assets/v6/chaua-atlas.webp',384,16,'chaua'),
 'hawk':('assets/v6/hawk-atlas.webp',384,16,'hawk'),
 **{f'snake-{k}':(f'public/snake/{folder}/{name}.webp',384,8,'snake') for k,folder,name in [('idle','base','idle'),('attack','attack','attack'),('stunned','reactions','stunned'),('high','attack','high'),('sweep','attack','sweep')]}
}
def measure():
 data={}
 for key,(path,cell,count,kind) in SHEETS.items():
  im=Image.open(APP/path).convert('RGBA');frames=[]
  for f in range(count):
   col=f%(im.width//cell);row=f//(im.width//cell)
   a=im.crop((col*cell,row*cell,(col+1)*cell,(row+1)*cell)).getchannel('A')
   box=a.getbbox()
   if not box:frames.append([]);continue
   left,top,right,bottom=box
   fractions=(.18,.34,.49) if kind=='chaua' else (.55,.70,.83) if kind=='hawk' else (.27,.5,.73)
   pts=[]
   for q in fractions:
    x=round(left+(right-left)*q)
    floor=round(cell*.64) if kind=='snake' else top
    for y in range(floor,bottom-4):
     if all(a.getpixel((xx,yy))>=235 for yy in range(y,y+4) for xx in range(x-3,x+4)):
      pts.append([x,y+3]);break
   assert len(pts)==3,(key,f,pts)
   frames.append(pts)
  data[key]=frames
 return data
if __name__=='__main__':
 text='// Generated from unchanged authored alpha by scripts/build_animal_weather.py.\nexport const ANIMAL_CONTACTS='+json.dumps(measure(),separators=(',',':'))+';\n'
 (APP/'js/animal-contact-data.mjs').write_text(text)
