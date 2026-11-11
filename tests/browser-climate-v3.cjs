const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const OUT='test-results/climate-v3';
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const [mode,width,height] of [['aventura',1366,638],['tranquilo',390,844]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.evaluate(async(mode)=>{
    const [{Renderer},{Game},{setWeatherMode}]=await Promise.all([
     import('/js/render.mjs'),import('/js/engine.mjs'),import('/js/weather.mjs')
    ]);
    setWeatherMode('auto');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.replaceChildren(canvas);
    window.renderer=new Renderer(canvas);await renderer.ready;
    window.game=new Game({seed:104});game.state='playing';game.mode=mode;
    game.stage=3;game.stageAge=12;game.distance=28000;game.score=560;
    game.y=320;game.sceneTime=42;game.nextSpawn=Infinity;
    game.entities=[{kind:'wood',id:111,x:500,top:155,bottom:490,variant:'plain'},
      {kind:'wood',id:112,x:830,top:155,bottom:490,variant:'plain'}];
   },mode);
   for(const [name,progress,id] of [['spring',.10,0],['summer',.34,2],['autumn',.56,1],['winter',.84,3]]){
    const data=await page.evaluate(async({progress,id})=>{
     const [{climateReferenceSeconds},{journeySeason},{journeyRain},{winterAmount}]=await Promise.all([
      import('/js/climate-progress.mjs'),import('/js/seasons.mjs'),
      import('/js/weather.mjs'),import('/js/living-motion.mjs')
     ]);
     game.elapsed=climateReferenceSeconds(game.mode,game.seed)*progress;
     game.sceneTime=42+game.elapsed;
     renderer.game(game,false);
     const season=journeySeason(game);
     return {
      season,progress,score:game.score,distance:game.distance,
      rain:journeyRain(game),snow:winterAmount(game),
      frames:renderer.seasonalBackdrop.frames.size,width:renderer.w,height:renderer.h
     };
    },{progress,id});
    assert.equal(data.season.to,id,name+' season index mismatch');
    assert.equal(data.season.from,id,name+' scene not fully established');
    assert.equal(data.score,560);assert.equal(data.distance,28000);
    assert.ok(data.frames<=2&&data.frames>=1,'season surface cache overflow');
    assert.ok(data.width>0&&data.height>0,'empty canvas');
    if(name==='winter'){assert.equal(data.snow,1);assert.equal(data.rain,0)}
    if(name==='autumn')assert.ok(data.rain>.75);
    if(name==='summer')assert.equal(data.snow,0);
    await page.screenshot({path:path.join(OUT,mode+'-'+name+'.png')});
    console.log('CLIMATE_V3_SCENE '+JSON.stringify({mode,name,...data}));
   }
   assert.deepEqual(errors,[],'browser errors in '+mode);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
