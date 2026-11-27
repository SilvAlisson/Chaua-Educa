// Deterministic visual comparison: High, Manual Low, and Auto Low with full effects.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out=process.env.VISUAL_OUTPUT||'test-results/auto-visual';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const results=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   // Avoid the live game loop so every capture uses identical time and state.
   await page.route(/\/js\/script\.js(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const canvas=document.createElement('canvas');canvas.id='auto-visual-canvas';
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.replaceChildren(canvas);
    const r=new Renderer(canvas);await r.ready;
    const g=new Game({seed:104});g.state='playing';g.y=320;g.wing=.6;g.elapsed=44;g.sceneTime=44;
    g.distance=13000;g.stage=2;g.stageAge=10;
    const wood={id:1,kind:'wood',x:480,top:140,bottom:460,variant:'branch',snake:{age:2,phase:'warning',warningAge:.6}};
    advanceSnake(wood,.4,g.x);
    g.entities=[wood,{id:2,kind:'hawk',x:650,y:280,startX:670,startY:280,targetX:270,targetY:280,warning:0,age:2,dive:false},
     {id:3,kind:'fruit',x:760,y:320,variety:0,collected:false}];
    g.particles=Array.from({length:55},(_,i)=>({x:100+i*7,y:280+(i%5)*15,life:.6,maxLife:1,color:'#ffd180',spark:true}));
    window.compareScene={r,g};
   });
   const metrics=await page.evaluate(()=>{
    const {r,g}=window.compareScene;
    const paint=mode=>{
     if(mode==='auto-low')r.setAutomaticQuality('low');
     else r.setQuality(mode==='manual-low'?'low':'high');
     r.game(g,false,44);
     const d=r.c.getImageData(0,0,r.canvas.width,r.canvas.height).data;
     return {width:r.canvas.width,height:r.canvas.height,resolution:r.resolution,decoration:r.decoration,pixels:new Uint8ClampedArray(d)};
    };
    const auto=paint('auto-low'),low=paint('manual-low');
    let changed=0;
    for(let i=0;i<auto.pixels.length;i+=4){
     if(auto.pixels[i]!==low.pixels[i]||auto.pixels[i+1]!==low.pixels[i+1]||auto.pixels[i+2]!==low.pixels[i+2]||auto.pixels[i+3]!==low.pixels[i+3])changed++;
    }
    const high=paint('high');
    return {changedPixelsAutoVsManualLow:changed,
     auto:{width:auto.width,height:auto.height,resolution:auto.resolution,decoration:auto.decoration},
     manualLow:{width:low.width,height:low.height,resolution:low.resolution,decoration:low.decoration},
     high:{width:high.width,height:high.height,resolution:high.resolution,decoration:high.decoration}};
   });
   assert.equal(metrics.auto.decoration,'high');
   assert.equal(metrics.manualLow.decoration,'low');
   assert.deepEqual([metrics.auto.width,metrics.auto.height],[metrics.manualLow.width,metrics.manualLow.height]);
   assert.ok(metrics.changedPixelsAutoVsManualLow>0,'Automatic must visibly retain extra decoration at same pixel budget');
   assert.ok(metrics.high.width*metrics.high.height>metrics.auto.width*metrics.auto.height);
   for(const [id,setting] of [['alto','high'],['baixo-manual','manual-low'],['automatico','auto-low']]){
    await page.evaluate(setting=>{
     const {r,g}=window.compareScene;
     if(setting==='auto-low')r.setAutomaticQuality('low');
     else r.setQuality(setting==='manual-low'?'low':'high');
     r.game(g,false,44);
    },setting);
    await page.locator('#auto-visual-canvas').screenshot({path:path.join(out,viewport.width+'x'+viewport.height+'-'+id+'.png')});
   }
   assert.deepEqual(errors,[]);
   results.push({viewport,...metrics});
   await page.close();
  }
  fs.writeFileSync(path.join(out,'visual-comparison.json'),JSON.stringify(results,null,2));
  console.log('PASS automatic full-effects visual comparison '+JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
