// Paired source-crop comparison against the original snake renderer.
// Same atlas, same deforming mesh, same poses. No game logic or artwork edits.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
fs.mkdirSync('test-results/snake-source-strips',{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const reports=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.route('**/js/snake-render-baseline.mjs',r=>r.fulfill({contentType:'text/javascript',
    body:fs.readFileSync('tests/fixtures/snake-render-original.mjs','utf8')}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const metrics=await page.evaluate(async()=>{
    const {images,loadAssets}=await import('/js/assets.mjs');
    const {drawContinuousSnake:baseline}=await import('/js/snake-render-baseline.mjs');
    const {drawContinuousSnake:optimized}=await import('/js/snake-render.mjs');
    await loadAssets();
    const image=images.get('snake-atlas');if(!image)throw Error('snake atlas unavailable');
    const make=()=>{
     const c=document.createElement('canvas');
     c.width=innerWidth>800?2048:780;c.height=innerWidth>800?1365:1688;
     return {canvas:c,c:c.getContext('2d')};
    };
    const regular=make(),candidate=make(),samples={regular:[],candidate:[]};
    for(let i=0;i<175;i++){
     const state={phase:['watching','warning','windup','striking','recovering','spent'][Math.floor(i/30)%6],
      age:i/30,warningAge:(i%30)/30,phaseAge:(i%30)/70,attackAge:(i%30)/70};
     const order=i%2?[[candidate,'candidate',optimized],[regular,'regular',baseline]]:
      [[regular,'regular',baseline],[candidate,'candidate',optimized]];
     for(const [ctx,label,draw] of order){
      const c=ctx.c;
      c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
      c.setTransform(2,0,0,2,100,450);
      const start=performance.now();
      for(const [dx,dy] of [[0,0],[350,30],[700,-50]]){
       c.save();c.translate(dx,dy);
       draw(c,image,state,.52,false);c.restore();
      }
      c.getImageData(0,0,1,1);
      if(i>=15)samples[label].push(performance.now()-start);
     }
    }
    const stat=v=>{
     const x=[...v].sort((a,b)=>a-b),at=t=>x[Math.floor((x.length-1)*t)];
     return {frames:v.length,meanMs:v.reduce((s,t)=>s+t,0)/v.length,
      p50Ms:at(.5),p95Ms:at(.95),p99Ms:at(.99),over16:v.filter(t=>t>16.67).length,
      over33:v.filter(t=>t>33.33).length};
    };
    return {regular:stat(samples.regular),candidate:stat(samples.candidate)};
   });
   assert.deepEqual(errors,[]);
   reports.push({viewport,...metrics});
   console.log('SNAKE_SOURCE_STRIP_AB '+JSON.stringify({viewport,...metrics}));
   await page.close();
  }
  fs.writeFileSync('test-results/snake-source-strips/results.json',JSON.stringify(reports,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
