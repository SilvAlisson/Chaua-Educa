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
   await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
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
   // Check actual raster opacity at several accumulation levels, independently
   // of the seasonal timing and the moving game camera.
   const coverCheck=await page.evaluate(async()=>{
    const {drawLivingTrunk}=await import('/js/tree-art.mjs');
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
    const c=canvas.getContext('2d',{willReadFrequently:true}),rows=[];
    const render=(upper,snow)=>{
     c.clearRect(0,0,512,512);
     drawLivingTrunk(c,{x:256,y:upper?420:80,upper,width:180,length:600,variant:0,snow});
     return c.getImageData(0,0,512,512).data;
    };
    for(const upper of [false,true]){
     const base=render(upper,0),full=render(upper,1);
     let last=0;
     for(const snow of [.25,.5,.75,255/256]){
      const pixels=render(upper,snow);let solid=0,ghost=0,total=0;
      for(let i=0;i<full.length;i+=4){
       if(full[i+3]<250||full[i]<150||full[i+1]<150||full[i+2]<150)continue;
       const difference=(a,b)=>Math.max(...[0,1,2,3].map(k=>Math.abs(a[i+k]-b[i+k])));
       if(difference(base,full)<60)continue;
       total++;
       if(difference(pixels,full)<12)solid++;
       else if(difference(pixels,base)>12)ghost++;
      }
      if(!total||solid<=0||solid<last)throw Error('Snow cover is absent or receding: '+JSON.stringify({upper,snow,solid,last,total}));
      if(ghost>total*.08)throw Error('Snow still fades through translucent pixels: '+JSON.stringify({upper,snow,ghost,total}));
      rows.push({upper,snow,solid,ghost,total});last=solid;
     }
    }
    return rows;
   });
   console.log('WINTER_SOLID_COVER '+JSON.stringify(coverCheck));
   let last=-1;
   for(const [name,progress,mode] of [
    ['late-autumn',.60,'auto'],
    ['snow-entry',.675,'auto'],
    ['snow-transition',.695,'auto'],
    ['winter-accumulating',.78,'auto'],
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
     const {createSurfaceWeather,advanceSurfaceWeather,surfaceSnow}=await import('/js/surface-weather.mjs');
     const target=climateReferenceSeconds(game.mode,game.seed)*progress;
     const onset=.65*climateReferenceSeconds(game.mode,game.seed);
     game.elapsed=mode==='winter'?target:Math.min(target,onset);
     game.surfaceWeather=createSurfaceWeather();
     while(game.elapsed<target){const dt=Math.min(1/120,target-game.elapsed);game.elapsed+=dt;advanceSurfaceWeather(game,dt);}
     game.sceneTime=35.4;
     renderer.game(game,reduced);
     return {rain:journeyRain(game),snow:winterAmount(game),cover:surfaceSnow(game),
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
    if(name==='winter-accumulating'||name==='winter-late'||name==='manual-winter'){
     assert.equal(details.snow,1);
     assert.equal(details.rain,0);
    }
    if(name==='manual-winter')assert.equal(details.cover,0,'manual winter starts without instant full cover');
    if(name==='winter-accumulating')assert.ok(details.cover>0&&details.cover<1,'cover keeps accumulating after the backdrop reaches full winter');
    if(name==='winter-late')assert.equal(details.cover,1);
    await page.screenshot({path:path.join(out,w+'x'+h+'-'+name+'.png')});
    console.log('WINTER_V3_SCENE '+JSON.stringify({viewport:[w,h],name,...details}));
   }
   assert.deepEqual(errors,[],'runtime errors detected');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
