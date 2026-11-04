// Diagnostic-only architecture trial: compare one opaque Canvas with a cached
// backdrop displayed on a separate Canvas below a transparent dynamic Canvas.
// No production files or presets are changed by this experiment.
// The benchmark includes the backdrop refresh cost; compositor overhead is
// evaluated separately by native requestAnimationFrame, never by pixel readback.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const out='test-results/forest-layer-feasibility';
fs.mkdirSync(out,{recursive:true});
const pct=(a,p)=>{const x=[...a].sort((v,w)=>v-w);return x[Math.min(x.length-1,Math.floor((x.length-1)*p))]??null;};
const stats=a=>({count:a.length,meanMs:a.reduce((s,v)=>s+v,0)/Math.max(1,a.length),
 p50Ms:pct(a,.50),p95Ms:pct(a,.95),p99Ms:pct(a,.99),maxMs:a.length?Math.max(...a):0,
 above33:a.filter(x=>x>33.33).length,above50:a.filter(x=>x>50).length});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const rows=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   await page.route('**/js/script.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const result=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const build=async()=>{
     const canvas=document.createElement('canvas');
     canvas.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none';
     document.body.append(canvas);
     const r=new Renderer(canvas);await r.ready;r.setQuality('high');
     return r;
    };
    const direct=await build(),layered=await build();
    const base=document.createElement('canvas');
    base.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none';
    base.width=layered.canvas.width;base.height=layered.canvas.height;
    document.body.insertBefore(base,layered.canvas);
    const bc=base.getContext('2d');
    const drawOriginal=layered.c.drawImage.bind(layered.c);
    let blitsAvoided=0,backingRefreshes=0,previous=null,baseUpdated=false;
    layered.c.drawImage=(...args)=>{
     if(args.length===3&&args[0]===layered.fragmentedBackdrop?.surface&&args[1]===0&&args[2]===0){
      blitsAvoided++;
      return;
     }
     return drawOriginal(...args);
    };
    const renderLayered=(g,time)=>{
     const c=layered.c;
     c.save();c.setTransform(1,0,0,1,0,0);
     c.clearRect(0,0,layered.canvas.width,layered.canvas.height);c.restore();
     layered.game(g,false,time);
     const state=layered.fragmentedBackdrop;
     if(!state)throw Error('Layered mode requires the live production backdrop cache');
     const token=[state.surface,state.light,state.forestAlpha,state.sourceDrift];
     baseUpdated=!previous||token.some((v,i)=>v!==previous[i]);
     if(baseUpdated){
      bc.setTransform(1,0,0,1,0,0);
      bc.drawImage(state.surface,0,0);
      previous=token;
      backingRefreshes++;
     }
    };
    const makeGame=stage=>{
     const g=new Game({seed:104});
     g.state='playing';g.y=320;g.wing=.5;g.elapsed=35;g.sceneTime=35;
     g.distance=stage*7000+1250;g.stage=stage;g.stageAge=10;
     const tree={id:1,kind:'wood',x:480,top:140,bottom:465,variant:'branch',snake:{age:3}};
     advanceSnake(tree,.4,120);
     const hawk={id:2,kind:'hawk',x:740,y:290,startX:740,startY:290,targetX:270,targetY:305,warning:0,age:2,dive:false,retreat:false};
     const fruit={id:3,kind:'fruit',x:800,y:320,variety:0,collected:false};
     g.entities=[tree,hawk,fruit];
     return g;
    };
    const composed=document.createElement('canvas');
    composed.width=layered.canvas.width;composed.height=layered.canvas.height;
    const cc=composed.getContext('2d',{willReadFrequently:true});
    const compare=()=>{
     cc.setTransform(1,0,0,1,0,0);
     cc.clearRect(0,0,composed.width,composed.height);
     cc.drawImage(base,0,0);cc.drawImage(layered.canvas,0,0);
     const a=direct.c.getImageData(0,0,direct.canvas.width,direct.canvas.height).data;
     const b=cc.getImageData(0,0,composed.width,composed.height).data;
     let sum=0,max=0,above5=0,changed=0;
     for(let k=0;k<a.length;k++){
      const delta=Math.abs(a[k]-b[k]);sum+=delta;
      if(delta>0)changed++;if(delta>5)above5++;
      if(delta>max)max=delta;
     }
     return {mae:sum/a.length,maxDelta:max,over5Fraction:above5/a.length,changedFraction:changed/a.length};
    };
    const summarize=a=>{
     const z=[...a].sort((a,b)=>a-b);
     return {frames:a.length,meanMs:a.reduce((s,v)=>s+v,0)/a.length,
      p50Ms:z[Math.floor((z.length-1)*.50)],p95Ms:z[Math.floor((z.length-1)*.95)],
      maxMs:z[z.length-1]};
    };
    const reports=[];
    for(const stage of [2,3]){
     const g=makeGame(stage),samples={direct:[],layered:[]},visual=[];
     for(let i=0;i<75;i++){
      const time=35+i/60;g.elapsed=g.sceneTime=time;
      for(const label of i%2?['layered','direct']:['direct','layered']){
       const start=performance.now();
       if(label==='direct'){
        direct.game(g,false,time);
        direct.c.getImageData(0,0,1,1);
       }else{
        renderLayered(g,time);
        layered.c.getImageData(0,0,1,1);
        if(baseUpdated)bc.getImageData(0,0,1,1);
       }
       if(i>=10)samples[label].push(performance.now()-start);
      }
      if(i===10||i===29||i===55||i===74)visual.push({frame:i,...compare()});
     }
     // Native RAF intervals include actual browser scheduling/compositor work.
     // Render-only stage stress; not a complete flight or phone FPS proof.
     const native={};
     for(const label of ['direct','layered']){
      direct.canvas.style.display=label==='direct'?'block':'none';
      base.style.display=label==='layered'?'block':'none';
      layered.canvas.style.display=label==='layered'?'block':'none';
      const intervals=[];
      const duration=2800;
      await new Promise(resolve=>{
       let begin=0,last=0;
       const tick=now=>{
        if(!begin)begin=now;
        if(last)intervals.push(now-last);
        last=now;
        const time=60+(now-begin)/1000;g.elapsed=g.sceneTime=time;
        if(label==='direct')direct.game(g,false,time);
        else renderLayered(g,time);
        if(now-begin<duration)requestAnimationFrame(tick);else resolve();
       };
       requestAnimationFrame(tick);
      });
      native[label]={frames:intervals.length,
       fps:1000*intervals.length/intervals.reduce((a,b)=>a+b,0),
       p50Ms:(()=>{const x=[...intervals].sort((a,b)=>a-b);return x[Math.floor((x.length-1)*.5)];})(),
       p95Ms:(()=>{const x=[...intervals].sort((a,b)=>a-b);return x[Math.floor((x.length-1)*.95)];})(),
       p99Ms:(()=>{const x=[...intervals].sort((a,b)=>a-b);return x[Math.floor((x.length-1)*.99)];})(),
       above33:intervals.filter(x=>x>33.33).length,
       maxMs:Math.max(...intervals)};
     }
     const worst={maxDelta:Math.max(...visual.map(v=>v.maxDelta)),
      mae:Math.max(...visual.map(v=>v.mae)),
      over5Fraction:Math.max(...visual.map(v=>v.over5Fraction))};
     reports.push({stage,backingPixels:direct.canvas.width*direct.canvas.height,
      cost:{direct:summarize(samples.direct),layered:summarize(samples.layered)},
      visual,worst,native});
    }
    return {reports,blitsAvoided,backingRefreshes,
      extraRgbaBytes:base.width*base.height*4,
      caveats:['A/B render-only synthetic actors','Software renderer and current runner','Two DOM canvas layers, base updated only on cache change','Capture excludes full gameplay physics','Native RAF captures include compositor scheduling']};
   });
   assert.deepEqual(errors,[],'No browser errors');
   assert.ok(result.blitsAvoided>0,'Prototype failed to skip cached foreground blits');
   assert.ok(result.backingRefreshes>0,'Prototype did not paint the lower layer');
   // A standalone diagnostic must report visual deviations, not hide them.
   rows.push({viewport,...result});
   console.log('LAYERED_FOREST_ROW '+JSON.stringify({viewport,...result}));
   await page.close();
  }
  fs.writeFileSync(out+'/layered-prototype.json',JSON.stringify(rows,null,2));
  console.log('LAYERED_FOREST_SUMMARY '+JSON.stringify(rows.map(row=>({
   viewport:row.viewport,extraRgbaMB:+(row.extraRgbaBytes/1048576).toFixed(2),
   stages:row.reports.map(s=>({stage:s.stage,baselineP95:s.cost.direct.p95Ms,
    layeredP95:s.cost.layered.p95Ms,baselineMean:s.cost.direct.meanMs,
    layeredMean:s.cost.layered.meanMs,visual:s.worst,native:s.native}))
  }))));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
