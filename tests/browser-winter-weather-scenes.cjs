// Visual reference captures for matching snow, rain and the fatal impact.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const OUT='test-results/winter-weather';
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const [width,height] of [[1366,768],[390,844]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.replaceChildren(canvas);
    window.renderer=new Renderer(canvas);await renderer.ready;
    window.game=new Game();game.state='playing';game.y=320;game.stageAge=5;
    game.entities=[{kind:'wood',id:1,x:620,top:120,bottom:520,variant:'plain'},
      {kind:'wood',id:2,x:900,top:150,bottom:530,variant:'plain'}];
   });
   for(const [mode,name,distance] of [
    ['auto','autumn-rain',7800],['auto','winter-transition',9900],
    ['auto','full-winter',11100],['auto','summer-return',16200],
    ['winter','manual-snow',0],['rain','manual-rain',7000]]){
    const result=await page.evaluate(({mode,distance})=>{
     const {game,renderer}=window;
     return import('/js/weather.mjs').then(({setWeatherMode})=>{
      setWeatherMode(mode);
      game.distance=distance;game.stage=Math.min(3,Math.floor(distance/7000));
      game.sceneTime=12.25;game.stageAge=5;renderer.game(game,false);
      return {width:renderer.w,height:renderer.h};
     });
    },{mode,distance});
    assert.ok(result.width>0&&result.height>0,'invalid render surface');
    await page.screenshot({path:path.join(OUT,width+'x'+height+'-'+name+'.png')});
   }
   assert.deepEqual(errors,[],'browser errors at '+width+'x'+height);
   console.log('PASS WINTER/RAIN visual captures '+width+'x'+height);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
