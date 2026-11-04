// Diagnostic A/B: when forest is fully opaque, use the standard one-surface
// cache in stage 1 rather than striped transitions. Is this actually faster?
// Production renderer remains untouched; both paths draw identical full art.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
fs.mkdirSync('test-results/stage1-direct',{recursive:true});
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{
 const rows=[];
 for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const report=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs'),{Game}=await import('/js/engine.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const pct=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)]:null;
    const stat=a=>({count:a.length,fps:a.length?1000*a.length/a.reduce((s,v)=>s+v,0):0,
      median:pct(a,.50),p95:pct(a,.95),p99:pct(a,.99),max:a.length?Math.max(...a):0,
      above33:a.filter(x=>x>33.33).length,above50:a.filter(x=>x>50).length});
    const make=async()=>{
      const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none';
      document.body.append(canvas);const r=new Renderer(canvas);await r.ready;r.setQuality('high');return r;
    };
    const staged=await make(),direct=await make();
    const old=direct.prepareStagedBackdrop.bind(direct);
    direct.prepareStagedBackdrop=function(forest,light,drift,alpha,settled){
      if(alpha===1)return this.prepareFragmentedBackdrop(forest,light,drift,alpha);
      return old(forest,light,drift,alpha,settled);
    };
    const g=new Game({seed:104});g.state='playing';g.y=320;g.wing=.55;g.stage=1;g.distance=7250;g.stageAge=0;
    const wood={id:1,kind:'wood',x:480,top:160,bottom:480,variant:'branch',snake:{age:3}};
    advanceSnake(wood,.4,120);
    g.entities=[wood,{id:2,kind:'hawk',x:750,y:270,startX:750,startY:270,targetX:240,targetY:275,
      warning:0,age:2,dive:false,retreat:false}];
    const reps=[];
    for(let round=0;round<2;round++){
      for(const [name,r] of round?[['direct',direct],['staged',staged]]:[['staged',staged],['direct',direct]]){
        g.stage=0;g.stageAge=10;g.sceneTime=g.elapsed=37;
        r.background(g.sceneTime,7000,0,false,false,1);
        if(r.transitionBackdrop){r.transitionBackdrop.rowsDone=0;r.transitionBackdrop.target=null;r.transitionBackdrop.active=false;}
        r.canvas.style.display='block';(name==='direct'?staged:direct).canvas.style.display='none';
        const samples=[],draw=[],startValues=[];
        await new Promise(resolve=>{
          let begin=0,last=null;
          const tick=now=>{
            if(!begin)begin=now;
            const elapsed=(now-begin)/1000;
            if(last!==null)samples.push(now-last);
            last=now;
            g.stage=1;g.distance=7250;g.stageAge=Math.min(4,elapsed);g.sceneTime=g.elapsed=37+elapsed;
            const t=performance.now();r.game(g,false,g.sceneTime);draw.push(performance.now()-t);
            if(elapsed<4.4)requestAnimationFrame(tick);else resolve();
          };
          requestAnimationFrame(tick);
        });
        reps.push({round,name,frame:stat(samples),draw:stat(draw)});
      }
    }
    // Compare final full-screen art under the same time and stage; this is not
    // a temporal continuity oracle, but catches accidental raster divergence.
    for(const r of [staged,direct]){r.game(g,false,g.sceneTime);}
    const a=staged.c.getImageData(0,0,staged.canvas.width,staged.canvas.height).data,
      b=direct.c.getImageData(0,0,direct.canvas.width,direct.canvas.height).data;
    let total=0,max=0,over5=0;
    for(let i=0;i<a.length;i++){const diff=Math.abs(a[i]-b[i]);total+=diff;max=Math.max(max,diff);if(diff>5)over5++;}
    return {backing:[staged.canvas.width,staged.canvas.height],reps,
      visual:{mae:total/a.length,maxDelta:max,over5Fraction:over5/a.length}};
  });
  assert.deepEqual(errors,[]);
  console.log('STAGE1_DIRECT_ROW '+JSON.stringify({viewport,...report}));
  rows.push({viewport,...report});await page.close();
 }
 fs.writeFileSync('test-results/stage1-direct/metrics.json',JSON.stringify(rows,null,2));
 console.log('STAGE1_DIRECT_SUMMARY '+JSON.stringify(rows.map(x=>({viewport:x.viewport,
  reps:x.reps.map(r=>({round:r.round,mode:r.name,fps:r.frame.fps,slow33:r.frame.above33,p95:r.frame.p95,
  drawP95:r.draw.p95})),visual:x.visual}))));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
