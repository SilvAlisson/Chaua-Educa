// Compare official A2 collision geometry with every real WebP pixel cell.
// This replaces pixel-parity tests against the retired v7/v8 mesh renderer.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:640}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const result=await page.evaluate(async()=>{
   const {SNAKE_A2_MASKS}=await import('/js/snake-a2-masks.mjs');
   const {preloadSnakeA2,isSnakeA2Ready}=await import('/js/snake-a2.mjs');
   await preloadSnakeA2();
   if(!isSnakeA2Ready())throw Error('Official A2 sprites unavailable');
   const assets={idle:'/public/snake/base/idle.webp',attack:'/public/snake/attack/attack.webp',
      stunned:'/public/snake/reactions/stunned.webp',high:'/public/snake/attack/high.webp',sweep:'/public/snake/attack/sweep.webp'};
   const canvas=document.createElement('canvas');
   canvas.width=canvas.height=384;
   const c=canvas.getContext('2d',{willReadFrequently:true});
   let tiles=0,pixels=0,filled=0,mismatches=0;
   const examples=[];
   for(const [key,url] of Object.entries(assets)){
    const image=new Image();image.src=url;await image.decode();
    if(image.naturalWidth!==1536||image.naturalHeight!==768)
      throw Error('Invalid official A2 atlas: '+key);
    for(let frame=0;frame<8;frame++){
     c.clearRect(0,0,384,384);
     c.drawImage(image,(frame%4)*384,Math.floor(frame/4)*384,384,384,0,0,384,384);
     const rgba=c.getImageData(0,0,384,384).data;
     let frameFilled=0;
     for(let row=0;row<32;row++)for(let col=0;col<32;col++){
      let visible=false;
      for(let y=row*12;y<(row+1)*12&&!visible;y++)
       for(let x=col*12;x<(col+1)*12;x++){
        pixels++;
        if(rgba[(y*384+x)*4+3]>=112){visible=true;break;}
       }
      const expected=Boolean(SNAKE_A2_MASKS[key][frame][row*32+col]);
      if(expected!==visible){
       mismatches++;
       if(examples.length<6)examples.push({key,frame,row,col,expected,visible});
      }
      if(visible){filled++;frameFilled++;}
      tiles++;
     }
     if(frameFilled<70)throw Error('A2 empty pose '+key+'/'+frame);
    }
   }
   return {tiles,filled,pixels,mismatches,examples};
  });
  assert.equal(result.tiles,5*8*32*32);
  assert.equal(result.mismatches,0,'Collider does not match current A2 WebP: '+JSON.stringify(result.examples));
  assert.ok(result.filled>1000);
  assert.deepEqual(errors,[]);
  console.log('PASS A2 mask-pixel parity '+JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
