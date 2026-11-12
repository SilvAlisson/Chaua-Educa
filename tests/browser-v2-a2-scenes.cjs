// Real in-game scene captures, including living forest, original trunk and A2.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const OUT='test-results/v2-a2-scenes';fs.mkdirSync(OUT,{recursive:true});
const URL=process.env.GAME_URL||'http://127.0.0.1:5501/';
const scenes=[['watching',4],['warning',4.2],['windup',4.6],['striking',4.8],['stunned',5.1]];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:1200,height:720},{width:390,height:844}]){
   for(const [variant,urlQuery] of [['A2','']]){
    const page=await browser.newPage({viewport,deviceScaleFactor:1});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(URL+urlQuery,{waitUntil:'domcontentloaded'});
    await page.fill('#inputPlayer','Auditoria V2');
    await page.waitForFunction(()=>!document.querySelector('#btnStart').disabled,{timeout:30000});
    await page.locator('#btnStart').click();
    const ready=await page.evaluate(async()=>{
     const {game}=await import('/js/script.js');
     const {isSnakeA2Ready}=await import('/js/snake-a2.mjs');
     game.tick=()=>{};
     window.__setA2Scene=(phase,t)=>{
       game.state='playing';game.sceneTime=t;game.elapsed=t;game.stage=0;game.stageAge=35;
       game.distance=950;game.y=300;game.vy=0;game.angle=0;game.wing=.7;
       game.flapImpulse=0;game.shield=false;game.invincible=0;game.shakeTime=0;game.hit=null;
       game.nextSpawn=1e8;game.particles=[];game.popups=[];
       const snake={kind:'snake',phase,age:5,warningAge:.6};
       if(phase==='windup'){snake.phaseAge=.23;snake.attackStarted=true;}
       if(phase==='striking'){snake.phaseAge=.12;snake.attackStarted=true;}
       if(phase==='stunned'){snake.phase='retreat';snake.retreat=true;snake.dazed=true;snake.retreatTime=.42;snake.retreatPose={x:0,y:0,angle:0,mouth:0};}
       const wood={id:77,kind:'wood',x:360,top:75,bottom:442,variant:'branch',scored:false,snake};
       game.entities=[wood];game.snapshot();
       return {phase,wood:wood.x,snake:snake.phase};
     };
     return {a2:isSnakeA2Ready()};
    });
    assert.equal(ready.a2,variant==='A2','A2 artwork did not load');
    for(const [phase,t] of scenes){
     await page.evaluate(([phase,t])=>window.__setA2Scene(phase,t),[phase,t]);
     await page.waitForTimeout(140);
     const file=path.join(OUT,viewport.width+'-'+variant+'-'+phase+'.png');
     await page.screenshot({path:file});
     console.log('A2_SCENE '+JSON.stringify({viewport,variant,phase,file}));
    }
    assert.deepEqual(errors,[],variant+' '+viewport.width+' uncaught page errors');
    await page.close();
   }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
