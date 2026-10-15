// Pack reviewed alpha sprites; source artwork is not recreated procedurally.
// Usage: node scripts/pack_expansion.cjs snake.png hollow.png hawks.png perch.png feather.png shield.png branch.png
const sharp=require('sharp'),fs=require('node:fs/promises'),path=require('node:path');
const out=path.join(__dirname,'../public/assets/v4');
async function bounds(buf) {
 const {data,info}=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=0,bottom=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
 return {left,top,width:right-left+1,height:bottom-top+1};
}
(async()=>{
 const [snake,hollow,hawks,perch,feather,shield,branch]=process.argv.slice(2);if(!branch)throw Error('Seven source paths required');
 await fs.mkdir(out,{recursive:true});const metadata={};
 for(const [key,source]of Object.entries({snake,hollow,perch,feather,shield,branch})){
  const buf=await sharp(source).png().toBuffer(),box=await bounds(buf);
  const max=key==='branch'?640:key==='perch'?900:(key==='feather'||key==='shield')?192:1024;
  await sharp(buf).extract(box).resize({width:max,height:max,fit:'inside',withoutEnlargement:true}).webp({quality:90,alphaQuality:100}).toFile(`${out}/${key}.webp`);
  if(key==='snake'||key==='hollow'){
   const {data,info}=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const row=Math.floor(info.height*0.88);let l=info.width,r=0;
   for(let x=0;x<info.width;x++)if(data[(row*info.width+x)*4+3]>220){l=Math.min(l,x);r=x}
   const ratio=Math.min(max/box.width,max/box.height,1);
   metadata[key]={originX:((l+r)/2-box.left)/box.width,coreWidth:(r-l)*ratio};
  }
 }
 const hm=await sharp(hawks).metadata();const w=Math.floor(hm.width/2);
 for(let i=0;i<2;i++)await sharp(hawks).extract({left:i*w,top:0,width:w,height:hm.height}).resize({width:543}).webp({quality:90,alphaQuality:100}).toFile(`${out}/hawk-${i}.webp`);
 await fs.writeFile(path.join(__dirname,'../src/game/assets/expansion.json'),JSON.stringify(metadata,null,2)+'\n');
 console.log(metadata);
})().catch(e=>{console.error(e);process.exitCode=1});
