// Real-time pilot and native-RAF long-session diagnostic (no production changes).
// Unlike browser-journey.cjs, this does NOT replace requestAnimationFrame with a
// synthetic clock; physical wall time and visual frame intervals are measured.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const out=process.env.LONG_OUTPUT||'test-results/long-flight';
const requestedMode=['auto','high','low'].includes(process.env.LONG_MODE)?process.env.LONG_MODE:'auto';
const requestedDpr=Number(process.env.LONG_DPR)||null;
const disableStaging=process.env.LONG_DISABLE_STAGING==='1';
const disableStripeSync=process.env.LONG_NO_STRIPE_SYNC==='1';
const keepOpaqueSky=process.env.LONG_KEEP_OPAQUE_SKY==='1';
const keepOpaqueLightKey=process.env.LONG_KEEP_OPAQUE_LIGHTKEY==='1';
const drawAllEntities=process.env.LONG_DRAW_ALL_ENTITIES==='1';
fs.mkdirSync(out,{recursive:true});
const pct=(xs,p)=>{if(!xs.length)return null;const ys=[...xs].sort((a,b)=>a-b);return ys[Math.floor((ys.length-1)*p)];};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({mode,dpr})=>{
   localStorage.setItem('chaua-visual-quality',JSON.stringify(mode));
   if(dpr>0)Object.defineProperty(window,'devicePixelRatio',{configurable:true,get:()=>dpr});
   const native=requestAnimationFrame;
   let previous=0;
   window.longFrames=[];window.longStageFrames=[];
   window.requestAnimationFrame=callback=>native.call(window,now=>{
    if(callback.name==='frame'&&window.longCapture){
     if(previous){const dt=now-previous;window.longFrames.push(dt);window.longStageFrames.push({dt,stage:window.__longGame?.stage??-1,stageAge:window.__longGame?.stageAge??0,quality:window.__longRenderer?.quality??'unknown',decoration:window.__longRenderer?.decoration??'unknown',elapsed:window.__longGame?.elapsed??0,wall:now-(window.longStart||now)});}
     previous=now;
    }
    callback(now);
   });
  },{mode:requestedMode,dpr:requestedDpr});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  await page.locator('#inputPlayer').fill('Teste prolongado');
  await page.locator('input[value=aventura]').check();
  await page.locator('#btnStart:not([disabled])').click();
  await page.bringToFront();
  const seconds=Math.max(30,Math.min(140,Number(process.env.LONG_SECONDS)||90));
  await page.evaluate(async ({seconds,requestedMode,disableStaging,disableStripeSync,keepOpaqueSky,keepOpaqueLightKey,drawAllEntities})=>{
   const {game:g}=await import('/js/script.js');
   const {flightViewport}=await import('/js/viewport.mjs');
   const {Renderer}=await import('/js/render.mjs');
   // Benchmark-only A/B: keep the deployed game/assets identical and switch
   // only the incremental transition path. The old direct path remains
   // available as the production fallback whenever staging is disabled.
   if(disableStaging)Renderer.prototype.prepareStagedBackdrop=()=>null;
   if(disableStripeSync){
    const original=Renderer.prototype.prepareStagedBackdrop;
    Renderer.prototype.prepareStagedBackdrop=function(...args){this.transitionSyncEnabled=false;return original.apply(this,args);};
   }
   if(keepOpaqueSky){
    const original=Renderer.prototype.game;
    Renderer.prototype.game=function(...args){this.opaqueForestSkyEnabled=false;return original.apply(this,args);};
   }
   if(keepOpaqueLightKey){
    const original=Renderer.prototype.game;
    Renderer.prototype.game=function(...args){this.opaqueForestLightKeyEnabled=false;return original.apply(this,args);};
   }
   const qualityChanges=[];
   for(const method of ['setQuality','setAutomaticQuality']){
    const change=Renderer.prototype[method];
    Renderer.prototype[method]=function(level){
     const old=this.quality,oldDecoration=this.decoration;
     const result=change.call(this,level);
     if(this.quality!==old||this.decoration!==oldDecoration)
      qualityChanges.push({method,level:this.quality,at:performance.now(),stage:g.stage,gameSeconds:g.elapsed,decoration:this.decoration,oldDecoration});
     return result;
    };
   }
   const draw=Renderer.prototype.game;
   Renderer.prototype.game=function(...args){window.__longRenderer=this;if(drawAllEntities)this.drawOffscreenEntitiesForTest=true;return draw.apply(this,args);};
   g.start('aventura',[],104);window.__longGame=g;
   window.longCapture=true;
   window.longStart=performance.now();
   const encounters=new Set(),stages=new Set(),pickups=new Set();
   let questions=0,failures=0,pending=null,nextDecision=0,decisions=0,done=false;
   const finish=()=>{
    if(done)return;done=true;window.longCapture=false;
    clearInterval(pilot);clearTimeout(deadline);
    const elapsed=(performance.now()-window.longStart)/1000;
    window.longResult={
     requestedMode,disableStaging,disableStripeSync,keepOpaqueSky,keepOpaqueLightKey,drawAllEntities,elapsedWallSeconds:elapsed,gameSeconds:g.elapsed,state:g.state,reason:g.reason,
     won:g.won,stages:[...stages],encounters:[...encounters],pickups:[...pickups],
     questions,failures,decisions,qualityChanges,
     canvasWidth:document.querySelector('#forest').width,
     canvasHeight:document.querySelector('#forest').height,
     frameIntervals:window.longFrames,stageFrames:window.longStageFrames
    };
    window.longDone=true;
   };
   const pilot=setInterval(()=>{
    if(done)return;
    if(g.state==='quiz'){
     try{
      document.querySelector(g.question.answer?'#answer-true':'#answer-false').click();
      document.querySelector('#quiz-continue').click();
      questions++;pending=null;
     }catch{failures++;}
     return;
    }
    if(g.state==='ended'||g.state==='trained'){finish();return;}
    if(g.state!=='playing')return;
    stages.add(g.stage);
    for(const entity of g.entities){
     if(entity.kind==='hawk')encounters.add(entity.dive?'diving-hawk':'hawk');
     if(entity.kind==='wood')encounters.add('wood');
     if(entity.snake)encounters.add(entity.snake.branch?'branch-snake':'snake');
     if(['feather','shield','pepper'].includes(entity.kind))pickups.add(entity.kind);
    }
    const v=flightViewport(innerWidth,innerHeight);
    const right=v.worldLeft+v.w/v.scale;
    const wood=g.entities.find(e=>e.kind==='wood'&&e.x+100>g.x&&e.x<=right);
    const hawk=g.entities.find(e=>e.kind==='hawk'&&!e.harmless&&!e.retreat&&e.x+60>g.x);
    let target=wood?(wood.top+wood.bottom)/2:320;
    if(!wood&&hawk){
     const t=Math.max(0,Math.min(1,(hawk.startX-g.x)/(hawk.startX-hawk.targetX)));
     const lane=hawk.startY+(hawk.targetY-hawk.startY)*t;
     target=lane>=320?Math.max(145,lane-125):Math.min(495,lane+125);
    }
    if(g.elapsed>=nextDecision){
     nextDecision=g.elapsed+1/30;
     const predicted=g.y+g.vy*.12+450*.12**2;
     if(pending===null&&predicted>target+10&&g.vy>0)pending=g.elapsed+.12;
    }
    if(pending!==null&&g.elapsed>=pending){
     window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));
     window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));
     pending=null;decisions++;
    }
   },16);
   const deadline=setTimeout(finish,seconds*1000);
   window.longDone=false;
  },{seconds,requestedMode,disableStaging,disableStripeSync,keepOpaqueSky,keepOpaqueLightKey,drawAllEntities});
  await page.waitForFunction(()=>window.longDone,null,{timeout:(seconds+20)*1000,polling:250});
  const captured=await page.evaluate(()=>window.longResult);
  const {frameIntervals:frames,stageFrames,...details}=captured;
  assert.ok(frames.length>100,'native frames must be captured');
  assert.deepEqual(errors,[]);
  const grouped={};
  for(const sample of stageFrames){
   const key='stage-'+sample.stage+'-'+sample.quality+'-decoration-'+sample.decoration;
   (grouped[key]??=[]).push(sample.dt);
  }
  const segments=Object.fromEntries(Object.entries(grouped).map(([key,dt])=>[key,{
   frames:dt.length,fps:1000*dt.length/dt.reduce((a,b)=>a+b,0),
   p95Ms:pct(dt,.95),p99Ms:pct(dt,.99),over33:dt.filter(t=>t>33.33).length,over50:dt.filter(t=>t>50).length
  }]));
  const transitionGroups={};
  for(const sample of stageFrames){
   const phase=sample.stageAge<4?'transition':'settled';
   const key='stage-'+sample.stage+'-'+phase+'-'+sample.quality;
   (transitionGroups[key]??=[]).push(sample.dt);
  }
  const phaseSegments=Object.fromEntries(Object.entries(transitionGroups).map(([key,dt])=>[key,{
   frames:dt.length,fps:1000*dt.length/dt.reduce((a,b)=>a+b,0),
   p95Ms:pct(dt,.95),p99Ms:pct(dt,.99),over33:dt.filter(t=>t>33.33).length,
   over50:dt.filter(t=>t>50).length,over100:dt.filter(t=>t>100).length
  }]));
  const stats={...details,requestedDpr,segments,phaseSegments,frames:frames.length,
    fps:1000*frames.length/frames.reduce((a,b)=>a+b,0),
    frameP50Ms:pct(frames,.50),frameP95Ms:pct(frames,.95),
    frameP99Ms:pct(frames,.99),maxMs:Math.max(...frames),
    framesAbove33Ms:frames.filter(t=>t>33.33).length,
    framesAbove50Ms:frames.filter(t=>t>50).length,
    framesAbove100Ms:frames.filter(t=>t>100).length};
  fs.writeFileSync(path.join(out,'long-flight-'+requestedMode+'.json'),JSON.stringify(stats,null,2));
  console.log('LONG_FLIGHT_RESULT '+JSON.stringify(stats));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
