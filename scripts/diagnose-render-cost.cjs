// Diagnostic only. Reports browser frame intervals and CPU-side render timings.
// It does not change gameplay, persisted settings or published rendering.
// npm start (other terminal), then npm run benchmark:hotspots
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.floor((sorted.length-1)*fraction)];
}
function summarize(values) {
  return {
    count: values.length,
    meanMs: values.length ? values.reduce((a,b)=>a+b,0)/values.length : null,
    p50Ms: percentile(values,.5),
    p95Ms: percentile(values,.95),
    maxMs: values.length ? Math.max(...values) : null
  };
}

(async()=>{
  const browser = await chromium.launch({
    executablePath:process.env.CHROMIUM_PATH||undefined,
    args:['--no-sandbox']
  });
  try {
    const scenarios = [
      {name:'open-forest',stage:0,actors:false},
      {name:'fragmented-forest',stage:2,actors:false},
      ...(process.env.PERF_ISOLATE==='1'?[
        {name:'fragmented-wood-only',stage:2,actors:'wood'},
        {name:'fragmented-wood-and-snake',stage:2,actors:'snake'},
        {name:'fragmented-hawk-only',stage:2,actors:'hawk'},
        {name:'fragmented-pickups-only',stage:2,actors:'pickups'}
      ]:[]),
      {name:'fragmented-forest-with-actors',stage:2,actors:'all'}
    ];
    const seconds=Math.max(2,Math.min(30,Number(process.env.PERF_SECONDS)||6));
    const results=[];
    for(const scenario of scenarios){
      const page=await browser.newPage({
        viewport:{width:1440,height:960},deviceScaleFactor:2
      });
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{
        localStorage.setItem('chaua-visual-quality',JSON.stringify('high'));
        const native=window.requestAnimationFrame;
        window.__profileIntervals=[];
        window.__captureProfile=false;
        let previous=0;
        window.requestAnimationFrame=callback=>native.call(window,now=>{
          if(callback.name==='frame'){
            if(window.__captureProfile && previous)window.__profileIntervals.push(now-previous);
            previous=now;
          }
          callback(now);
        });
      });
      await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
      await page.locator('#start-training:not([disabled])').click();
      await page.evaluate(async scene=>{
        const {game}=await import('/js/script.js');
        const {Renderer}=await import('/js/render.mjs');
        const {Game,FlightClock}=await import('/js/engine.mjs');
        const {advanceSnake}=await import('/js/animals.mjs');
        window.__profileOps={};
        const record=(prototype,name)=>{
          const original=prototype[name];
          assertMethod(typeof original==='function',name);
          prototype[name]=function(...args){
            const start=performance.now();
            try{return original.apply(this,args);}
            finally{
              if(window.__captureProfile){
                (window.__profileOps[name]??=[]).push(performance.now()-start);
              }
            }
          };
        };
        function assertMethod(condition,name){if(!condition)throw Error('Missing method: '+name);}
        for(const name of ['background','game','trunk','obstacle','hawk','pickup','snake'])
          record(Renderer.prototype,name);
        record(Game.prototype,'visual');
        record(FlightClock.prototype,'advance');
        const wood={id:9001,kind:'wood',x:490,top:155,bottom:465,variant:'plain',snake:{age:0}};
        advanceSnake(wood,.4,game.x);
        const bareWood={...wood,snake:null};
        const hawk={id:9002,kind:'hawk',x:680,y:255,startX:700,startY:255,targetX:280,targetY:230,warning:0,age:2,dive:false};
        const fruit={id:9003,kind:'fruit',x:455,y:315,variety:0,collected:false};
        const pepper={id:9004,kind:'pepper',x:790,y:310,collected:false};
        const groups={wood:[bareWood],snake:[wood],hawk:[hawk],pickups:[fruit,pepper],all:[wood,hawk,fruit,pepper]};
        if(scene.actors){
          const actual=Renderer.prototype.game;
          Renderer.prototype.game=function(view,...rest){
            // Render-only isolated actor A/B: no extra physics or encounter planning.
            const renderView=Object.create(view);
            renderView.entities=groups[scene.actors]??groups.all;
            return actual.call(this,renderView,...rest);
          };
        }
        game.startTutorial();
        game.state='playing';
        game.elapsed=scene.stage===2?35:5;
        game.sceneTime=game.elapsed;
        game.distance=scene.stage===2?15000:1000;
        game.stage=scene.stage;
        game.stageAge=10;
        game.y=320;
        game.nextSpawn=Infinity;
        game.entities=[];
        game.snapshot();
      },scenario);
      await page.waitForTimeout(1000);
      await page.evaluate(()=>{
        window.__profileOps={};
        window.__profileIntervals=[];
        window.__captureProfile=true;
      });
      await page.waitForTimeout(seconds*1000);
      const result=await page.evaluate(async()=>{
        window.__captureProfile=false;
        const {game}=await import('/js/script.js');
        const ops=Object.fromEntries(Object.entries(window.__profileOps).map(([name,values])=>[name,values]));
        const canvas=document.querySelector('#forest');
        return {
          state:game.state,
          activeStage:game.stage,
          canvasPixels:canvas.width*canvas.height,
          width:canvas.width,
          height:canvas.height,
          intervals:window.__profileIntervals,
          ops,
          heapBytes:performance.memory?.usedJSHeapSize??null
        };
      });
      assert.equal(result.state,'playing','game must remain active');
      assert.deepEqual(errors,[],'no JavaScript errors');
      assert.ok(result.intervals.length>=10,'must capture native frames');
      const {intervals,ops,...info}=result;
      const stats=Object.fromEntries(Object.entries(ops).map(([name,values])=>[name,summarize(values)]));
      const row={
        scenario:scenario.name,
        ...info,
        elapsedCaptureSeconds:seconds,
        frames:intervals.length,
        fps:1000*intervals.length/intervals.reduce((a,b)=>a+b,0),
        frameInterval:summarize(intervals),
        framesOver33ms:intervals.filter(v=>v>33.33).length,
        framesOver50ms:intervals.filter(v=>v>50).length,
        cpuTimings:stats
      };
      results.push(row);
      console.log(JSON.stringify(row));
      await page.close();
    }
    const gpu=(await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo')).gpu;
    console.log(JSON.stringify({
      browser:browser.version(),
      notes:'CPU-side method timers omit asynchronous raster/GPU work; sample actors are render-only, not full encounters. Use for prioritization, not claimed production FPS.',
      gpuRenderer:gpu.devices?.[0]?.deviceString,
      results
    },null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
