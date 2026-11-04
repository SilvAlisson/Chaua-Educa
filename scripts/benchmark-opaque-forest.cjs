// Diagnostic: determine whether the sky beneath the opaque forest is needless,
// then A/B identical stage-1 transition graphics with and without that sky.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const out='test-results/opaque-forest';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const report=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs');
   const {images}=await import('/js/assets.mjs');
   const {Game}=await import('/js/engine.mjs');
   const create=async()=>{
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none';
    document.body.append(canvas);
    const r=new Renderer(canvas);await r.ready;return r;
   };
   const before=await create(),after=await create(),forest=images.get('forest');
   if(!forest)throw Error('missing forest after ready');
   const source=document.createElement('canvas');
   source.width=forest.naturalWidth;source.height=forest.naturalHeight;
   const x=source.getContext('2d',{willReadFrequently:true});x.drawImage(forest,0,0);
   const px=x.getImageData(0,0,source.width,source.height).data;
   let opaque=0,translucent=0,transparent=0,minAlpha=255,maxAlpha=0;
   for(let i=3;i<px.length;i+=4){
    const alpha=px[i];minAlpha=Math.min(minAlpha,alpha);maxAlpha=Math.max(maxAlpha,alpha);
    if(alpha===255)opaque++;else if(alpha===0)transparent++;else translucent++;
   }
   const alpha={size:[source.width,source.height],opaque,translucent,transparent,minAlpha,maxAlpha};
   if(translucent||transparent)return {alpha,ab:null,reason:'Forest has transparency: sky cannot be removed safely'};
   after.paintSky=function(){};
   const g=new Game({seed:104});
   g.state='playing';g.y=320;g.wing=.5;g.stage=1;g.distance=7250;
   const samples={before:[],after:[]},visual=[];
   const pct=(v,p)=>[...v].sort((a,b)=>a-b)[Math.floor((v.length-1)*p)];
   const stat=v=>({count:v.length,mean:v.reduce((s,x)=>s+x,0)/v.length,
    median:pct(v,.5),p95:pct(v,.95),p99:pct(v,.99),max:Math.max(...v),
    above33:v.filter(x=>x>33.33).length});
   for(const r of [before,after]){r.background(35,15500,0,false,false,1);r.ensureTransitionBackdrop();}
   for(let i=0;i<132;i++){
    const frac=i/131;g.stageAge=4*frac;g.sceneTime=g.elapsed=35+4*frac;
    for(const label of i%2?['after','before']:['before','after']){
     const r=label==='before'?before:after,t=performance.now();
     r.game(g,false,g.sceneTime);
     r.c.getImageData(0,0,1,1);
     if(i>=10)samples[label].push(performance.now()-t);
    }
    if([10,30,70,100,131].includes(i)){
     const a=before.c.getImageData(0,0,before.canvas.width,before.canvas.height).data;
     const b=after.c.getImageData(0,0,after.canvas.width,after.canvas.height).data;
     let changed=0,maxDelta=0,mae=0;
     for(let k=0;k<a.length;k++){
      const delta=Math.abs(a[k]-b[k]);
      if(delta)changed++;
      maxDelta=Math.max(maxDelta,delta);mae+=delta;
     }
     visual.push({frame:i,changed,maxDelta,mae:mae/a.length});
    }
   }
   const native={};
   for(const label of ['before','after']){
    before.canvas.style.display=label==='before'?'block':'none';
    after.canvas.style.display=label==='after'?'block':'none';
    const r=label==='before'?before:after;
    r.background(35,15500,0,false,false,1);
    if(r.transitionBackdrop){r.transitionBackdrop.rowsDone=0;r.transitionBackdrop.target=null;r.transitionBackdrop.active=false;}
    const intervals=[];
    await new Promise(resolve=>{
     let t0=0,last=0;
     const draw=now=>{
      if(!t0)t0=now;if(last)intervals.push(now-last);last=now;
      const elapsed=(now-t0)/1000;
      g.stage=1;g.stageAge=Math.min(4,elapsed);g.sceneTime=g.elapsed=45+elapsed;
      r.game(g,false,g.sceneTime);
      if(elapsed<4.3)requestAnimationFrame(draw);else resolve();
     };
     requestAnimationFrame(draw);
    });
    native[label]={fps:1000*intervals.length/intervals.reduce((s,v)=>s+v,0),...stat(intervals)};
   }
   return {alpha,ab:{backing:[before.canvas.width,before.canvas.height],
    raster:{before:stat(samples.before),after:stat(samples.after)},visual,native}};
  });
  assert.deepEqual(errors,[]);
  if(report.ab)assert.ok(report.ab.visual.every(x=>x.changed===0),
    'The sky cannot be skipped without changing pixels: '+JSON.stringify(report.ab.visual));
  fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
  console.log('OPAQUE_FOREST_RESULT '+JSON.stringify(report));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
