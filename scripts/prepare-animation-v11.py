from PIL import Image
from pathlib import Path
import numpy as np,json
root=Path(__file__).resolve().parents[1]
source=root.parent/'chaua-review-812129/Chaua-Educa-main/assets/animation-art-v11-sources'
out=root/'Chaua-Educa-main/assets/v11'
manifest={}
for name in ['parrot','hawk','snake','forest']:
 im=Image.open(source/(name+'-parts.png')).convert('RGBA'); atlas=Image.new('RGBA',(1024,1024)); bounds=[]
 for i in range(16):
  x0=round(i%4*im.width/4);x1=round((i%4+1)*im.width/4);y0=round(i//4*im.height/4);y1=round((i//4+1)*im.height/4)
  crop=im.crop((x0,y0,x1,y1));a=np.array(crop);a[a[:,:,3]<48]=0;crop=Image.fromarray(a)
  box=crop.getbbox()
  if not box:raise ValueError((name,i))
  crop=crop.crop(box);crop.thumbnail((224,224),Image.Resampling.LANCZOS);px=i%4*256+(256-crop.width)//2;py=i//4*256+(256-crop.height)//2
  atlas.alpha_composite(crop,(px,py));bounds.append([px%256,py%256,crop.width,crop.height])
 atlas.save(out/(name+'.webp'),lossless=True);manifest[name]=bounds
(out/'parts.json').write_text(json.dumps(manifest))
(out/'parts.mjs').write_text('export const PARTS='+json.dumps(manifest)+';\n')
