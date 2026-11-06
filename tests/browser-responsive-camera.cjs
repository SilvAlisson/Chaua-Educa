// Exercise the actual in-game canvas layout and presentation-only camera
// at notebook, phone, short-window and desktop viewport sizes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const OUT='test-results/responsive-camera';
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const screens=[[1920,1080],[1366,768],[1280,720],[1024,600],[768,1024],[320,568],[390,844],[844,390]];
  for(const [width,height] of screens){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'domcontentloaded'});
   await page.screenshot({path:path.join(OUT,width+'x'+height+'-menu.png')});
   await page.fill('#inputPlayer','Tela responsiva');
   await page.waitForFunction(()=>!document.querySelector('#btnStart').disabled,{timeout:30000});
   await page.locator('#btnStart').click();
   const result=await page.evaluate(async()=>{
    const {game}=await import('/js/script.js');
    const {Renderer}=await import('/js/render.mjs');
    const {flightViewport}=await import('/js/viewport.mjs');
    const v=flightViewport(innerWidth,innerHeight);
    // Keep the main game visible for the screen capture; exercise a separate,
    // same-size render surface for deterministic camera bounds.
    const cv=document.createElement('canvas');
    cv.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;visibility:hidden;pointer-events:none';
    cv.style.zIndex='-1';
    document.querySelector('#app').append(cv);
    const r=new Renderer(cv);await r.ready;
    game.state='playing';game.entities=[];game.popups=[];game.particles=[];
    const positions=[];
    for(const y of [35,320,605]){
     game.y=y;game.sceneTime+=3;
     r.game(game,false);
     const actualY=v.y+(game.y-r.cameraTop)*v.scale;
     positions.push({y,cameraTop:r.cameraTop,actualY});
    }
    // A fixed, populated scene makes sprite sizing reviewable; the preceding
    // checks still exercise the actual game and its HUD.
    game.y=320;game.sceneTime+=1;
    game.entities=[{kind:'wood',id:901,x:650,y:0,top:130,bottom:520,variant:'plain',
      snake:{phase:'watching',age:0}},
      {kind:'fruit',id:902,x:530,y:285,variety:0},
      {kind:'hawk',id:903,x:900,y:260,warning:0,phase:'flight',age:1}];
    r.game(game,false);
    cv.style.visibility='visible';
    const body=document.body;
    const main=document.querySelector('#app');
    return {scale:v.scale,worldHeight:v.worldHeight,worldWidth:v.worldWidth,
       positions,bodyScrollHeight:body.scrollHeight,documentScrollHeight:document.documentElement.scrollHeight,
       appWidth:main.getBoundingClientRect().width,appHeight:main.getBoundingClientRect().height,
       inFlight:main.classList.contains('in-flight')};
   });
   assert.ok(result.inFlight,'not inside the gameplay screen');
   for(const {cameraTop,actualY} of result.positions){
    assert.ok(cameraTop>=0&&cameraTop<=640-result.worldHeight+1e-5,'camera left world');
    const top=height<=500?58:height<=850&&width>height?96:124;
    assert.ok(actualY>=top-1&&actualY<=height+1,'player left visible space');
   }
   assert.ok(result.appWidth<=width+1&&result.appHeight<=height+1,'app viewport overflows');
   assert.ok(result.documentScrollHeight<=height+2,'whole game scrolls vertically');
   if(width===1366||width===1280)assert.ok(result.scale>=1.05,'notebook sprites still too small');
   assert.deepEqual(errors,[],'runtime errors '+width+'x'+height);
   await page.screenshot({path:path.join(OUT,width+'x'+height+'.png')});
   console.log('PASS RESPONSIVE CAMERA '+JSON.stringify({width,height,scale:result.scale,worldHeight:result.worldHeight,positions:result.positions}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
