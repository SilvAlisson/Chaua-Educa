const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out='test-results/climate-winter-v3';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const [w,h] of [[1366,638],[390,844]]){
   const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.evaluate(async()=>{
    const [{Renderer},{Game},{setWeatherMode}]=await Promise.all([
     import('/js/render.mjs'),import('/js/engine.mjs'),import('/js/weather.mjs')
    ]);
    setWeatherMode('auto');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.replaceChildren(canvas);
    window.renderer=new Renderer(canvas);await renderer.ready;
    window.game=new Game({seed:104});
    game.mode='aventura';game.state='playing';game.stage=3;
    game.stageAge=12;game.distance=28000;game.score=560;
    game.y=320;game.sceneTime=35.4;game.nextSpawn=Infinity;
    game.entities=[
     {kind:'wood',id:11,x:410,top:150,bottom:490,variant:'plain',fragileSide:'top',fragileKind:'rot',decorSide:'bottom',decorKind:'moss'},
     {kind:'wood',id:12,x:750,top:150,bottom:500,variant:'branch',fragileSide:'bottom',fragileKind:'hollow',snake:{kind:'snake',phase:'watching',retreat:false,age:2}},
     {kind:'hawk',id:13,x:870,y:220,warning:0,age:3,phase:'crossing',dive:false,startX:1100,targetX:190,startY:220,targetY:220},
     {kind:'fruit',id:14,x:560,y:320,variety:2}
    ];
   });
   let last=-1;
   for(const [name,progress,mode] of [
    ['late-autumn',.60,'auto'],
    ['snow-entry',.675,'auto'],
    ['snow-transition',.695,'auto'],
    ['winter-full',.78,'auto'],
    ['winter-late',.96,'auto'],
    ['manual-winter',.10,'winter'],
    ['reduced-winter',.84,'auto']
   ]){
    const reduced=name==='reduced-winter';
    const details=await page.evaluate(async({progress,mode,reduced})=>{
     const [{climateReferenceSeconds},{setWeatherMode,journeyRain},{winterAmount},
       {journeySeason}]=await Promise.all([
      import('/js/climate-progress.mjs'),import('/js/weather.mjs'),
      import('/js/living-motion.mjs'),import('/js/seasons.mjs')
     ]);
     setWeatherMode(mode);
     game.elapsed=climateReferenceSeconds(game.mode,game.seed)*progress;
     game.sceneTime=35.4;
     renderer.game(game,reduced);
     return {rain:journeyRain(game),snow:winterAmount(game),
      season:journeySeason(game),score:game.score,distance:game.distance,
      cached:renderer.seasonalBackdrop?.frames.size||0,
      width:renderer.w,height:renderer.h};
    },{progress,mode,reduced});
    assert.equal(details.score,560);assert.equal(details.distance,28000);
    assert.ok(details.width>0&&details.height>0);
    assert.ok(details.cached>0&&details.cached<=2);
    if(name==='late-autumn')assert.equal(details.snow,0);
    if(name==='snow-entry'||name==='snow-transition'){
     assert.ok(details.snow>0&&details.snow<1,'snow progression not gradual');
     assert.ok(details.snow>last,'snow should intensify');
     last=details.snow;
    }
    if(name==='winter-full'||name==='winter-late'||name==='manual-winter'){
     assert.equal(details.snow,1);
     assert.equal(details.rain,0);
    }
    await page.screenshot({path:path.join(out,w+'x'+h+'-'+name+'.png')});
    console.log('WINTER_V3_SCENE '+JSON.stringify({viewport:[w,h],name,...details}));
   }
   assert.deepEqual(errors,[],'runtime errors detected');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
