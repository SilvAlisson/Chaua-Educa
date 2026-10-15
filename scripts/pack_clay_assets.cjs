// Packaging only: preserves generated artwork, alpha and aspect ratios.
// node scripts/pack_clay_assets.cjs BIRD.png FRUITS.png TRUNKS.png FOREST.png
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const out = path.join(__dirname, '../public/assets/v3');
async function trim(buffer) {
  const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let l=info.width,t=info.height,r=-1,b=-1;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(data[(y*info.width+x)*4+3]>8){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y)}
  if(r<l) throw Error('Empty sprite');
  return {left:l,top:t,width:r-l+1,height:b-t+1};
}
(async()=>{
 const [bird,fruits,trunks,forest]=process.argv.slice(2);
 if(!forest) throw Error('Provide bird, fruits, trunks and forest source paths.');
 await fs.mkdir(out,{recursive:true});
 const bm=await sharp(bird).metadata(); const cell=Math.floor(bm.width/2);
 for(let i=0;i<4;i++) await sharp(bird).extract({left:(i%2)*cell,top:Math.floor(i/2)*cell,width:cell,height:cell}).webp({quality:90,alphaQuality:100,effort:6}).toFile(`${out}/chaua-${i}.webp`);
 const hero=await sharp(bird).extract({left:cell,top:0,width:cell,height:cell}).png().toBuffer();
 await sharp(hero).extract(await trim(hero)).webp({quality:90,alphaQuality:100,effort:6}).toFile(`${out}/chaua-hero.webp`);
 const fm=await sharp(fruits).metadata();
 const ids=['Goiaba','Semente','Manga','Mamao','Coquinho','Banana','Milho'];
 for(let i=0;i<ids.length;i++) {
   const left=Math.round(i%4*fm.width/4)+(i===1 ? 60 : 0),right=Math.round((i%4+1)*fm.width/4),top=Math.round(Math.floor(i/4)*fm.height/2),bottom=Math.round((Math.floor(i/4)+1)*fm.height/2);
   const buf=await sharp(fruits).extract({left,top,width:right-left,height:bottom-top}).png().toBuffer();
   await sharp(buf).extract(await trim(buf)).resize({width:192,height:192,fit:'inside'}).webp({quality:90,alphaQuality:100,effort:6}).toFile(`${out}/fruit-${ids[i]}.webp`);
 }
 const tm=await sharp(trunks).metadata();const manifest=[];
 const cores=[[192,426],[656,885],[1114,1348]];
 for(let i=0;i<3;i++) {
   const left=i*512,buf=await sharp(trunks).extract({left,top:0,width:512,height:tm.height}).png().toBuffer();
   const box=await trim(buf),core=cores[i];
   await sharp(buf).extract(box).webp({quality:90,alphaQuality:100,effort:6}).toFile(`${out}/trunk-${i}.webp`);
   await sharp(trunks).extract({left:core[0]+16,top:200,width:core[1]-core[0]-32,height:400}).webp({quality:90,alphaQuality:100,effort:6}).toFile(`${out}/bark-${i}.webp`);
   manifest.push({originX:((core[0]+core[1])/2-left-box.left)/box.width,coreWidth:core[1]-core[0],height:box.height});
 }
 await fs.writeFile(`${out}/trunks.json`,JSON.stringify(manifest,null,2)+'\n');
 await sharp(forest).resize(1920,1080,{fit:'cover'}).webp({quality:86}).toFile(`${out}/forest.webp`);
 console.log('Packed 4 poses, hero, 7 collectibles, 3 trunks with bark extensions, forest and geometry metadata.');
})().catch(e=>{console.error(e);process.exitCode=1});
