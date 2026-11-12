// Measure the official A2 draw path, never the abandoned triangle/mesh renderer.
// Browser/canvas cost is diagnostic; it does not establish device FPS.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const pct=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor((b.length-1)*p)]};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:640}});
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const stats=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs');
   const c=document.createElement('canvas');c.width=960;c.height=640;
   c.style.cssText='position:fixed;inset:0;width:960px;height:640px';
   document.body.replaceChildren(c);
   const renderer=new Renderer(c);await renderer.ready;
   const ctx=renderer.c,phases=['watching','warning','windup','striking','recovering','spent'];
   const batches=26,perBatch=32,samples=[];
   let draws=0,painted=0;
   for(let batch=0;batch<batches;batch++){
    const start=performance.now();
    for(let i=0;i<perBatch;i++){
     const n=batch*perBatch+i;
     const wood={id:1,kind:'wood',x:420,top:120,bottom:465,
       snake:{phase:phases[n%phases.length],age:n/60,phaseAge:(n%30)/60,warningAge:(n%60)/60}};
     ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);
     renderer.snake(wood,false,0,0,n/60,false);
     draws++;
    }
    // One diagnostic readback per batch, not a GPU sync on every draw.
    const rgba=ctx.getImageData(0,0,c.width,c.height).data;
    if(rgba.some((value,index)=>index%4===3&&value>0))painted++;
    const ms=performance.now()-start;
    if(batch>=3)samples.push(ms/perBatch);
   }
   return {samples,draws,painted,batches};
  });
  assert.equal(stats.samples.length,23);assert.equal(stats.draws,26*32);
  assert.equal(stats.painted,stats.batches,'All batches must render real visible A2 pixels');
  const out={samples:stats.samples.length,medianMs:pct(stats.samples,.5),p95Ms:pct(stats.samples,.95),
    p99Ms:pct(stats.samples,.99),browser:browser.version()};
  console.log('A2_RENDER_PROFILE '+JSON.stringify(out));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
