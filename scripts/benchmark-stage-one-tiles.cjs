// Controlled A/B of stage-one stripe count without changing sprites or assets.
// 8 and 12 stripe renderers draw the same complete encounter, alternating
// call order in one browser and flushing both with a one-pixel readback.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const dir='test-results/stage-one-tiles';
const stress=process.env.STAGE_ONE_STRESS==='1';
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const reports=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const report=await page.evaluate(async(stress)=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const make=async stripes=>{
     const c=document.createElement('canvas');
     c.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
     document.body.append(c);
     const r=new Renderer(c);await r.ready;
     r.setQuality('high');
     r.stageOneStripeCount=stripes;
     r.base();r.background(39,9000,0,false,false,1);
     return r;
    };
    const baseline=await make(8),candidate=await make(12);
    const sampleCanvas=document.createElement('canvas');
    sampleCanvas.width=96;sampleCanvas.height=64;
    const sample=sampleCanvas.getContext('2d',{willReadFrequently:true});
    const g=new Game({seed:104});
    const wood={id:9001,kind:'wood',x:510,top:150,bottom:460,variant:'branch',snake:{age:2}};
    advanceSnake(wood,.4,100);
    const hawk={id:9002,kind:'hawk',x:740,y:260,startX:740,startY:260,targetX:260,targetY:300,warning:0,age:2,dive:false};
    const fruit={id:9003,kind:'fruit',x:750,y:320,variety:0,collected:false};
    g.state='playing';g.stage=1;g.stageAge=0;g.elapsed=39;g.sceneTime=39;
    g.distance=9200;g.y=320;g.wing=.5;g.entities=[wood,hawk,fruit];
    if(stress){
     // Future progressive-difficulty load: extra actors and hazards, but
     // never modify the actual game's spawn rules or visual effects.
     const extraWood={...wood,id:9011,x:960,top:125,bottom:465,snake:{age:2}};
     advanceSnake(extraWood,.4,100);
     const extraHawk={...hawk,id:9012,x:1000,y:350,startX:1000,startY:350,targetX:330,targetY:360};
     g.entities.push(extraWood,extraHawk,
      {id:9013,kind:'fruit',x:830,y:390,variety:1,collected:false},
      {id:9014,kind:'fruit',x:990,y:280,variety:2,collected:false},
      {id:9015,kind:'feather',x:900,y:315,collected:false},
      {id:9016,kind:'pepper',x:1070,y:340,collected:false});
    }
    const samples={eight:[],twelve:[]},visual=[];
    let previousEight=null,previousTwelve=null;
    const scratch=a=>{
     sample.clearRect(0,0,96,64);
     sample.drawImage(a.canvas,0,0,96,64);
     return sample.getImageData(0,0,96,64).data;
    };
    for(let i=0;i<195;i++){
     const mix=Math.min(1,i/180),clock=39+i/60;
     g.stageAge=4*mix;g.elapsed=clock;g.sceneTime=clock;
     const order=i%2?[[candidate,'twelve'],[baseline,'eight']]:[[baseline,'eight'],[candidate,'twelve']];
     for(const [r,key] of order){
      const start=performance.now();
      r.game(g,false,clock);
      r.c.getImageData(0,0,1,1);
      if(i>=15)samples[key].push(performance.now()-start);
     }
     const a=scratch(baseline),b=scratch(candidate);
     let sum=0,max=0,over5=0,temporal=0;
     for(let j=0;j<a.length;j++){
      const delta=Math.abs(a[j]-b[j]);
      sum+=delta;max=Math.max(max,delta);if(delta>5)over5++;
      if(previousEight)temporal+=Math.abs((a[j]-previousEight[j])-(b[j]-previousTwelve[j]));
     }
     visual.push({mix,mae:sum/a.length,maxDelta:max,over5Fraction:over5/a.length,
      motionDifference:previousEight?temporal/a.length:null});
     previousEight=a;previousTwelve=b;
    }
    const stats=v=>{
     const a=[...v].sort((x,y)=>x-y),at=q=>a[Math.floor((a.length-1)*q)];
     return {frames:v.length,meanMs:v.reduce((s,t)=>s+t,0)/v.length,
      medianMs:at(.5),p95Ms:at(.95),p99Ms:at(.99),maxMs:a[a.length-1],
      above33:v.filter(t=>t>33.33).length,above16:v.filter(t=>t>16.67).length};
    };
    return {backing:[baseline.canvas.width,baseline.canvas.height],
     baseline:stats(samples.eight),candidate:stats(samples.twelve),
     visual:{worstMae:Math.max(...visual.map(x=>x.mae)),
      worstMotionDifference:Math.max(...visual.map(x=>x.motionDifference||0)),
      worstDelta:Math.max(...visual.map(x=>x.maxDelta)),
      worstOver5Fraction:Math.max(...visual.map(x=>x.over5Fraction)),
      worstFrames:[...visual].sort((a,b)=>b.mae-a.mae).slice(0,3)}};
   },stress);
   assert.deepEqual(errors,[],'unexpected browser errors');
   // 12 stripes can increase age of the cached background; enforce similar
   // visual continuity to the 8-stripe already approved artwork.
   assert.ok(report.visual.worstMae<1.1&&report.visual.worstMotionDifference<1.6,
    'Stage 1 visual quality regressed: '+JSON.stringify(report.visual));
   if(viewport.width===1440){
    // Reject higher stripe count when it creates more high-cost draw frames.
    assert.ok(report.candidate.above33<=report.baseline.above33,
     'More than 8 stripes increased slow raster frames: '+JSON.stringify(report));
   }
   reports.push({viewport,stress,...report});
   console.log('STAGE_ONE_TILE_AB '+JSON.stringify({viewport,stress,...report}));
   await page.close();
  }
  fs.writeFileSync(dir+(stress?'/stage-one-tiles-stress.json':'/stage-one-tiles.json'),JSON.stringify(reports,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
