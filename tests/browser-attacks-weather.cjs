const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const playwright=require('playwright');
const browserName=process.env.WEATHER_BROWSER||'chromium';
(async()=>{
 const browser=await playwright[browserName].launch({executablePath:browserName==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:browserName==='chromium'?['--no-sandbox']:[]});
 try{
  await fs.mkdir('test-results/attacks-weather',{recursive:true});
  for(const [width,height] of [[1366,768],[844,390],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({body:'',contentType:'text/javascript'}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const visibility=await page.evaluate(async()=>{
    const [{Renderer},{Game},weather,{drawSnowfall}]=await Promise.all([import('/js/render.mjs'),import('/js/engine.mjs'),import('/js/weather.mjs'),import('/js/winter-vfx.mjs')]);
    const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';document.body.replaceChildren(canvas);
    window.renderer=new Renderer(canvas);await renderer.ready;window.game=new Game({seed:42});game.state='playing';game.y=290;game.stageAge=5;
    // Pixel visibility on green AND pale winter backgrounds, in both budgets.
    // No fullscreen atmospheric wash is included in these measurements.
    const a=document.createElement('canvas');a.width=960;a.height=640;const c=a.getContext('2d',{willReadFrequently:true});
    const result=[];
    for(const bg of ['#496b49','#d5e7ed'])for(const low of [false,true])for(const kind of ['rain','snow','wind']){
     const draw=(time,reduced=false)=>{
      c.fillStyle=bg;c.fillRect(0,0,960,640);
      if(kind==='rain')weather.drawForegroundRain(c,960,640,time,1,reduced,low,0,.7,340);
      if(kind==='snow')drawSnowfall(c,960,640,time,1,reduced,low,.7,false);
      if(kind==='wind')weather.drawWindGusts(c,960,640,time,.9,low,reduced);
      return c.getImageData(0,0,960,640).data;
     };
     const baseline=draw(0,true),pixels=draw(42),paused=draw(42),moving=draw(42.1);let visible=0,changed=0;
     for(let i=0;i<pixels.length;i+=4){
      const delta=Math.max(Math.abs(pixels[i]-baseline[i]),Math.abs(pixels[i+1]-baseline[i+1]),Math.abs(pixels[i+2]-baseline[i+2]));
      if(delta>=12)visible++;
      if(pixels[i]!==moving[i]||pixels[i+1]!==moving[i+1]||pixels[i+2]!==moving[i+2])changed++;
      if(pixels[i]!==paused[i]||pixels[i+1]!==paused[i+1]||pixels[i+2]!==paused[i+2])throw Error('paused weather changed');
     }
     if(visible<100||changed<100)throw Error(`${kind}/${bg}/low=${low}: effect not legible (${visible}/${changed})`);
     result.push({bg,low,kind,visible,changed});
    }
    return result;
   });
   for(const [name,attackType,weatherMode,progress,low] of [
    ['frontal-rain','frontal','rain',.56,false],['high-snow','alto','snow',.85,false],
    ['sweep-wind','varredura','wind',.55,false],['rain-low','alto','rain',.56,true],
    ['snow-low','varredura','snow',.85,true],['wind-low','frontal','wind',.55,true]
   ]){
    await page.evaluate(async({attackType,weatherMode,progress,low})=>{
     const [{setWeatherMode},{climateReferenceSeconds},{snakeAttack},{predictedHawkY},{HAWK_ATTACK_ORDER}]=await Promise.all([import('/js/weather.mjs'),import('/js/climate-progress.mjs'),import('/js/attack-patterns.mjs'),import('/js/animals.mjs'),import('/js/attack-patterns.mjs')]);
     setWeatherMode(weatherMode==='snow'?'winter':weatherMode==='wind'?'autumn':weatherMode);renderer.decoration=low?'low':'high';
     game.elapsed=climateReferenceSeconds(game.mode,game.seed)*progress;game.sceneTime=42;game.distance=16000;game.stage=2;
     game.surfaceWeather={snow:weatherMode==='snow'?.55:0,wet:weatherMode==='rain'?1:0,drip:weatherMode==='rain'?.7:0};
     game.entities=[{id:7,kind:'wood',x:485,top:190,bottom:540,variant:'branch',snake:{kind:'snake',attackType,phase:'striking',phaseAge:snakeAttack({attackType}).strike*.2,age:3}}];
     // A real encounter contains one predator. Compare each attack in its
     // own scene instead of creating overlapping birds and warning labels.
     const attackKind=HAWK_ATTACK_ORDER[attackType==='frontal'?0:attackType==='alto'?1:2];
     const x=730,h={id:20,kind:'hawk',attackKind,startX:1040,targetX:160,attackX:220,startY:attackKind==='rasante'?535:105,targetY:330,x,warning:0,targetLocked:true,age:3,dive:attackKind==='mergulho',ascent:attackKind==='rasante',phase:'crossing'};
     h.y=predictedHawkY(h,x);game.entities.push(h);
     renderer.game(game,false);
    },{attackType,weatherMode,progress,low});
    await page.screenshot({path:`test-results/attacks-weather/${browserName}-${width}x${height}-${name}.png`});
   }
   assert.deepEqual(errors,[]);console.log('PASS visible paused/moving weather and attack production scenes',browserName,width,height,visibility);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
