// Deferred visual QA for PR 07: capture impact/recovery using real art.
// Run after all climate work is composed, not as an extra standalone gate.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out='test-results/climate-impact-v3';
fs.mkdirSync(out,{recursive:true});

(async()=>{
 const browser=await chromium.launch({
  executablePath:process.env.CHROMIUM_PATH||undefined,
  args:['--no-sandbox']
 });
 try{
  for(const [width,height] of [[1366,638],[390,844]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',route=>route.fulfill({
    contentType:'text/javascript',body:''
   }));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{
    waitUntil:'networkidle'
   });
   await page.evaluate(async()=>{
    const [{Renderer},{Game},{setWeatherMode}]=await Promise.all([
     import('/js/render.mjs'),
     import('/js/engine.mjs'),
     import('/js/weather.mjs')
    ]);
    setWeatherMode('auto');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.replaceChildren(canvas);
    window.renderer=new Renderer(canvas);
    await renderer.ready;
    window.game=new Game({seed:104});
    game.state='playing';game.mode='aventura';
    game.distance=28000;game.stage=3;game.stageAge=12;game.y=320;
    game.score=560;game.sceneTime=40;
    game.nextSpawn=Infinity;game.entities=[];
   });
   const episodes=[
    ['fatal-wood','wood',false],
    ['fatal-hawk','hawk',false],
    ['fatal-snake','snake',false],
    ['shield-wood','wood',true],
    ['shield-hawk','hawk',true],
    ['shield-snake','snake',true]
   ];
   for(const [name,kind,shield] of episodes){
    const state=await page.evaluate(async ({kind,shield})=>{
     const {ACTION_TIMINGS}=await import('/js/action-states.mjs');
     game.start('aventura',[],104);
     game.state='playing';
     game.distance=28000;game.stage=3;game.stageAge=12;
     game.score=560;game.y=320;game.nextSpawn=Infinity;
     game.sceneTime=40;game.entities=[];
     game.shield=shield;
     let e,host,animal=false;
     if(kind==='hawk'){
      e={id:22,kind:'hawk',x:410,y:320,warning:0,
       startX:900,targetX:100,startY:320,targetY:320,age:0};
      host=e;animal=true;
     }else if(kind==='snake'){
      e={kind:'snake',phase:'watching',age:1};
      host={id:23,kind:'wood',x:420,top:150,bottom:520,
       snake:e,variant:'plain'};
      animal=true;
     }else{
      e={id:21,kind:'wood',x:420,top:150,bottom:520,
       variant:'plain',hitSide:'top'};
      host=e;
     }
     game.entities=[host];
     game.collide(e,animal,host);
     renderer.game(game,false);
     return {
      state:game.state,shield:game.shield,
      remaining:game.impactRemaining,
      invincible:game.invincible,
      impactDuration:ACTION_TIMINGS.parrotImpact,
      reboundDuration:ACTION_TIMINGS.shieldRebound
     };
    },{kind,shield});
    assert.equal(state.state,shield?'playing':'impact',name);
    assert.equal(state.shield,false,name);
    const file=label=>path.join(out,width+'x'+height+'-'+name+'-'+label+'.png');
    await page.screenshot({path:file('contact')});
    for(const [label,age] of shield?[
     ['recovering',.10],['recovered',.32]
    ]:[
     ['recoil',.16],['dazed',.50],['late-dazed',1.05],['gameover',1.23]
    ]){
     const current=await page.evaluate(async age=>{
      const {STEP}=await import('/js/engine.mjs');
      const to=Math.max(0,age-(window._impactElapsed||0));
      for(let i=0;i<Math.ceil(to/STEP);i++)game.tick(STEP);
      window._impactElapsed=age;
      renderer.game(game,false);
      return {state:game.state,remaining:game.impactRemaining,
       score:game.score,distance:game.distance};
     },age);
     assert.equal(current.score,560);
     assert.equal(current.distance,28000);
     if(!shield&&label==='late-dazed')assert.equal(current.state,'impact');
     if(!shield&&label==='gameover')assert.equal(current.state,'ended');
     if(shield)assert.equal(current.state,'playing');
     await page.screenshot({path:file(label)});
    }
    await page.evaluate(()=>{window._impactElapsed=0});
   }
   assert.deepEqual(errors,[],'browser errors at '+width+'x'+height);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
