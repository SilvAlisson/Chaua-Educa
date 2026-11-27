const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:800}});
  await page.goto((process.env.GAME_URL||'http://127.0.0.1:5501/')+'?clima=winter&perf-test=1&perf-ab=direct-snow',{waitUntil:'networkidle'});
  const results=await page.evaluate(async()=>{
   const {images,loadAssets}=await import('/js/assets.mjs');await loadAssets();
   const pixels=key=>{
    const img=images.get(key),canvas=document.createElement('canvas');
    canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0);
    return {w:canvas.width,h:canvas.height,data:c.getImageData(0,0,canvas.width,canvas.height).data};
   };
   const output=[];
   for(const kind of ['lower','upper']){
    const base=pixels(`trees-${kind}`),overlay=pixels(`trees-${kind}-overlay-04`),snow=pixels(`trees-${kind}-snow-04`);
    let same=0,changed=0,ceiling=0,icicle=0;
    for(let i=0;i<base.data.length;i+=4){
     const y=Math.floor((i/4)/base.w)%512;
     if(overlay.data[i+3]===0 && base.data[i+3]>0){
      for(let k=0;k<4;k++)if(Math.abs(base.data[i+k]-snow.data[i+k])>1)
       throw new Error(`${kind}: original wood changed at pixel ${i/4}`);
      same++;
     }
     if(overlay.data[i+3]>30)changed++;
     if(kind==='upper'&&y<55&&overlay.data[i+3]>5)ceiling++;
     if(kind==='upper'&&y>480&&overlay.data[i+3]>30)icicle++;
    }
    output.push({kind,same,changed,ceiling,icicle});
   }
   const {RUNTIME_ART}=await import('/js/runtime-art-data.mjs');
   const season=pixels('season-backgrounds');
   return {output,background:[season.w,season.h],
    shedding:[0,1,2,3,4,5].every(i=>Object.keys(RUNTIME_ART.fx.frames).some(k=>k.startsWith(`snow-${i}-`)))};
  });
  assert.deepEqual(results.background,[1672,941]);
  assert.equal(results.shedding,true);
  for(const r of results.output){
   assert.ok(r.same>30_000&&r.changed>2_000,JSON.stringify(r));
   if(r.kind==='upper'){assert.equal(r.ceiling,0);assert.ok(r.icicle>50);}
  }
  console.log('PASS NEW WINTER ART transparent snow, unchanged original wood, ice tips, weather atlas, shedding',results);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
