const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1080,height:700},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'domcontentloaded'});
  const report=await page.evaluate(async()=>{
   const {loadAssets,images}=await import('/js/assets.mjs');
   await loadAssets();
   const keys=['frost-breath-fx','rain-splash-fx'],reports=[];
   const canvas=document.createElement('canvas');
   canvas.width=1072;canvas.height=604;
   const c=canvas.getContext('2d',{willReadFrequently:true});
   c.fillStyle='#22453f';c.fillRect(0,0,1072,604);
   for(let k=0;k<keys.length;k++){
    const img=images.get(keys[k]);
    if(!img||img.naturalWidth!==512||img.naturalHeight!==256)
      throw Error('Invalid or missing 4x2 atlas '+keys[k]);
    const drawn=[];
    for(let i=0;i<8;i++){
     const sx=i%4*128,sy=Math.floor(i/4)*128;
     const x=20+i*130,y=40+k*280;
     const tile=document.createElement('canvas');tile.width=128;tile.height=128;
     const tc=tile.getContext('2d',{willReadFrequently:true});
     tc.drawImage(img,sx,sy,128,128,0,0,128,128);
     const pixel=tc.getImageData(0,0,128,128).data;
     let populated=0;
     for(let p=3;p<pixel.length;p+=4)if(pixel[p]>2)populated++;
     drawn.push(populated);
     c.drawImage(img,sx,sy,128,128,x,y,120,120);
    }
    reports.push({key:keys[k],width:img.naturalWidth,height:img.naturalHeight,nonemptyPixels:drawn});
   }
   document.body.replaceChildren(canvas);
   return reports;
  });
  for(const atlas of report){
   assert.equal(atlas.nonemptyPixels.length,8);
   for(const [i,count] of atlas.nonemptyPixels.entries())
    assert.ok(count>12,atlas.key+' frame '+i+' is empty ('+count+')');
  }
  assert.deepEqual(errors,[]);
  fs.mkdirSync('test-results/weather-vfx',{recursive:true});
  await page.screenshot({path:'test-results/weather-vfx/frost-breath-and-rain-splash.png'});
  console.log('PASS local artistic VFX atlas loading and nonempty frames '+JSON.stringify(report));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
