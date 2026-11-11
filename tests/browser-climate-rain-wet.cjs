const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir='test-results/climate-rain-wet';
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const [width,height] of [[1366,638],[390,844]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.evaluate(async()=>{
    const [{Renderer},{Game},{setWeatherMode}]=await Promise.all([
     import('/js/render.mjs'),import('/js/engine.mjs'),import('/js/weather.mjs')]);
    setWeatherMode('auto');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.replaceChildren(canvas);
    window.renderer=new Renderer(canvas);await renderer.ready;
    window.game=new Game({seed:104});
    game.state='playing';game.mode='aventura';game.distance=28000;
    game.score=560;game.stage=3;game.stageAge=12;game.y=320;
    game.entities=[
     {kind:'wood',id:31,x:500,top:145,bottom:495,variant:'plain',
      fragileSide:'top',fragileKind:'rot',decorSide:'bottom',decorKind:'moss'},
     {kind:'wood',id:32,x:850,top:135,bottom:500,variant:'branch',
      fragileSide:'bottom',fragileKind:'hollow',
      snake:{kind:'snake',phase:'watching',retreat:false,age:1.5}},
     {kind:'hawk',id:33,x:740,y:290,startX:900,targetX:180,
      startY:290,targetY:290,age:3,warning:0,phase:'crossing',dive:false},
     {kind:'fruit',id:34,x:400,y:320,variety:2,optional:true}
    ];
   });
   for(const [name,progress,override] of [
    ['summer-dry',.36,'auto'],['autumn-rain',.56,'auto'],
    ['autumn-storm',.56,'storm'],['winter-dry',.85,'auto']
   ]){
    const status=await page.evaluate(async ({progress,override})=>{
     const [{climateReferenceSeconds},{setWeatherMode,journeyRain,journeyStorm},{winterAmount}]
      =await Promise.all([import('/js/climate-progress.mjs'),import('/js/weather.mjs'),
       import('/js/living-motion.mjs')]);
     setWeatherMode(override);
     game.elapsed=climateReferenceSeconds(game.mode,game.seed)*progress;
     game.sceneTime=42+game.elapsed;
     renderer.game(game,false);
     const rain=journeyRain(game),storm=journeyStorm(game,'aventura');
     return {score:game.score,distance:game.distance,
      rain,storm,snow:winterAmount(game),w:renderer.w,h:renderer.h};
    },{progress,override});
    assert.equal(status.score,560);assert.equal(status.distance,28000);
    assert.ok(status.w>0&&status.h>0);
    if(name==='summer-dry'||name==='winter-dry')assert.equal(status.rain,0);
    if(name==='autumn-rain')assert.ok(status.rain>.7);
    if(name==='autumn-storm'){assert.equal(status.rain,1);assert.equal(status.storm,1)}
    await page.screenshot({path:path.join(dir,width+'x'+height+'-'+name+'.png')});
    console.log('RAIN_WET_SCENE '+JSON.stringify({width,height,name,...status}));
   }
   assert.deepEqual(errors,[],'browser rendering errors');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
