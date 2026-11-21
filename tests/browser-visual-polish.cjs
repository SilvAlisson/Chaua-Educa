const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const playwright=require('playwright');
const browserName=process.env.POLISH_BROWSER||'chromium';
(async()=>{
 const browser=await playwright[browserName].launch({executablePath:browserName==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:browserName==='chromium'?['--no-sandbox']:[]});
 const out='test-results/visual-polish';await fs.mkdir(out,{recursive:true});
 const report=[];
 try{
  for(const [width,height] of [[1366,768],[844,390],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.evaluate(async()=>{
    const [{Renderer},{Game}]=await Promise.all([import('/js/render.mjs'),import('/js/engine.mjs')]);
    const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';document.body.replaceChildren(canvas);
    window.r=new Renderer(canvas);await r.ready;window.g=new Game({seed:104});
    g.state='playing';g.y=320;g.stageAge=5;g.elapsed=300;g.sceneTime=300;
   });
   for(const [weather,attackType] of [['summer','frontal'],['rain','alto'],['winter','varredura']])for(const profile of ['high','low','reduced']){
    const result=await page.evaluate(async({weather,attackType,profile})=>{
     const [{setWeatherMode},{flightWarnings},{snakeAttack}]=await Promise.all([import('/js/weather.mjs'),import('/js/flight-warnings.mjs'),import('/js/attack-patterns.mjs')]);
     setWeatherMode(weather);r.decoration=profile==='low'?'low':'high';const reduced=profile==='reduced';
     g.sceneTime+=.016;g.surfaceWeather={snow:weather==='winter'?.6:0,wet:weather==='rain'?1:0,drip:weather==='rain'?.7:0};
     g.entities=[{id:7,kind:'wood',x:485,top:190,bottom:540,variant:'branch',snake:{kind:'snake',attackType,phase:'striking',phaseAge:snakeAttack({attackType}).strike*.2,age:3}},
      {id:20,kind:'hawk',x:730,y:260,warning:0,phase:'crossing',age:3}];
     const labels=[],original=r.c.roundRect.bind(r.c);
     r.c.roundRect=(...args)=>{if(r.c.fillStyle==='#fff4db')labels.push({x:args[0],y:args[1],w:args[2],h:args[3]});return original(...args);};
     r.game(g,reduced);r.c.roundRect=original;
     const view={...r.getViewport(),worldTop:r.cameraTop};
     const layout=flightWarnings(g,view,reduced);
     const assertInside=box=>box.x>=view.x&&box.y>=view.y&&box.x+box.w<=view.x+view.w+.001&&box.y+box.h<=view.y+view.h+.001;
     const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
     if(labels.length!==2||!labels.every(assertInside))throw Error('Production warning missing or clipped');
     if(labels.some(a=>layout.protectedRegions.some(b=>overlap(a,b)))||overlap(...labels))throw Error('Warning covers an actor or another notice');
     const hash=async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',r.c.getImageData(0,0,r.canvas.width,r.canvas.height).data))).map(x=>x.toString(16).padStart(2,'0')).join('');
     const before=await hash();r.game(g,reduced);const after=await hash();
     if(before!==after)throw Error('Paused production scene changed pixels');
     const travel={...r.weatherMotion.travel};g.speed+=200;r.game(g,reduced);
     if(JSON.stringify(travel)!==JSON.stringify(r.weatherMotion.travel))throw Error('Weather moved without scene time advancing');
     g.speed-=200;r.game(g,reduced);
     return {weather,attackType,profile,labels,protectedRegions:layout.protectedRegions,pausedHash:before};
    },{weather,attackType,profile});
    await page.screenshot({path:`${out}/${browserName}-${width}x${height}-${weather}-${profile}.png`});
    report.push({width,height,...result});
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  await fs.writeFile(`${out}/${browserName}-report.json`,JSON.stringify(report,null,2));
  console.log('PASS visual polish',browserName,report.length,'production frames, warning clearance and paused pixels');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
