// Prove that the game background paints the entire backing and that skipping
// the redundant clear changes no pixels — across stages and resolutions.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const report=[];
  for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const stats=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs'),{Game}=await import('/js/engine.mjs'),{advanceSnake}=await import('/js/animals.mjs');
    const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.replaceChildren(canvas);
    const r=new Renderer(canvas);await r.ready;
    const game=new Game({seed:104});
    game.state='playing';game.distance=15000;game.elapsed=50;game.sceneTime=50;game.y=320;game.wing=.6;
    const wood={id:1,kind:'wood',x:480,top:140,bottom:460,variant:'branch',snake:{age:2}};
    advanceSnake(wood,.4,game.x);
    game.entities=[wood,{id:2,kind:'hawk',x:650,y:250,startX:650,startY:250,targetX:270,targetY:255,age:3,warning:0,dive:false},
      {id:3,kind:'fruit',x:750,y:310,variety:0,collected:false}];
    let cases=0,changedChannels=0,notOpaque=0;
    for(const quality of ['high','low'])for(let stage=0;stage<4;stage++)
     for(const age of [0,2,10])for(const reduced of [false,true]){
      game.stage=stage;game.stageAge=age;r.setQuality(quality);
      // Explicit base() exactly reproduces the production renderer before
      // this change: clear first, then render the entire game.
      r.base();r.game(game,reduced,50);
      const old=r.c.getImageData(0,0,r.canvas.width,r.canvas.height).data;
      // Poison the whole previous image to catch any pixel not overwritten.
      r.c.setTransform(1,0,0,1,0,0);
      r.c.fillStyle='#ff00ff';r.c.fillRect(0,0,r.canvas.width,r.canvas.height);
      r.game(game,reduced,50);
      const now=r.c.getImageData(0,0,r.canvas.width,r.canvas.height).data;
      for(let i=0;i<old.length;i++){
       if(old[i]!==now[i])changedChannels++;
       if(i%4===3&&now[i]!==255)notOpaque++;
      }
      cases++;
     }
    return {cases,changedChannels,notOpaque,canvasPixels:r.canvas.width*r.canvas.height};
   });
   assert.deepEqual(errors,[]);
   assert.equal(stats.changedChannels,0,'Removing clear left unpainted or changed pixels: '+JSON.stringify(stats));
   assert.equal(stats.notOpaque,0,'Some game backdrop pixels are not fully opaque');
   report.push({viewport,...stats});await page.close();
  }
  console.log('PASS game clear removal: identical RGBA across 144 cases, 3 viewports, all stages and transition ages '+JSON.stringify(report));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
