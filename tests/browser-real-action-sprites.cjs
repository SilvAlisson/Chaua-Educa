const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const OUT='test-results/real-action-qa';fs.mkdirSync(OUT,{recursive:true});
const cases=[
 ['01_parrot_flight','flight',4.3],
 ['02_parrot_shield_rebound','parrot-shield',4.4],
 ['03_parrot_fatal_impact','parrot-fatal',4.5],
 ['04_hawk_flight','hawk-flight',5.2],
 ['05_hawk_impact','hawk-impact',6.1],
 ['06_hawk_stunned','hawk-stunned',6.5],
 ['07_snake_warning','snake-warning',8.1],
 ['08_snake_windup','snake-windup',8.4],
 ['09_snake_strike','snake-strike',8.7],
 ['10_snake_stunned','snake-stunned',9.1],
];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':undefined),args:['--no-sandbox']});
 const reports=[];
 try{
 for(const [vpName,vp,which] of [
  ['desktop',{width:1200,height:720},cases],
  ['mobile',{width:390,height:844},cases.filter((_,i)=>[0,1,3,5,6,8,9].includes(i))]
 ]){
  for(const mode of ['original','new']){
   const page=await browser.newPage({viewport:vp,deviceScaleFactor:1});
   const errs=[];
   page.on('pageerror',e=>errs.push(e.message));
   await page.goto('http://127.0.0.1:5501/'+(mode==='new'?'?actionSprites=1':''),{waitUntil:'domcontentloaded'});
   await page.fill('#inputPlayer','Revisao visual');
   await page.waitForFunction(()=>!document.querySelector('#btnStart').disabled,{timeout:30000});
   await page.locator('#btnStart').evaluate(el=>el.click());
   const loaded=await page.evaluate(async()=>{
     const {game}=await import('/js/script.js');
     const action=await import('/js/action-sheets.mjs');
     const loaded=await action.preloadActionSheets();
     game.tick=function(){};
     window.__QA_set=(kind,t)=>{
       game.state='playing';game.sceneTime=t;game.elapsed=t;game.stage=0;game.stageAge=40;
       game.distance=950;game.y=320;game.vy=0;game.angle=0;game.wing=.76;
       game.flapImpulse=.1;game.shield=false;game.invincible=0;game.shakeTime=0;game.hit=null;
       game.nextSpawn=1e8;game.entities=[];game.particles=[];game.popups=[];
       const wood={id:11,kind:'wood',x:350,top:80,bottom:435,variant:'branch',scored:false,
        snake:{kind:'snake',phase:'watching',age:t,warningAge:0}};
       const hawk={id:12,kind:'hawk',x:625,y:282,warning:0,phase:'crossing',
        startX:900,startY:282,targetX:120,targetY:282,dive:false,retreat:false};
       switch(kind){
        case 'parrot-shield':game.hit={id:4,age:.14};game.invincible=.75;break;
        case 'parrot-fatal':game.state='impact';game.impactRemaining=.19;break;
        case 'hawk-flight':game.entities=[hawk];break;
        case 'hawk-impact':hawk.retreat=true;hawk.dazed=true;hawk.retreatTime=.10;hawk.harmless=true;
           game.entities=[hawk];game.invincible=.7;break;
        case 'hawk-stunned':hawk.retreat=true;hawk.dazed=true;hawk.retreatTime=.48;hawk.harmless=true;
           game.entities=[hawk];game.invincible=.7;break;
        case 'snake-warning':wood.snake.phase='warning';wood.snake.warningAge=.7;game.entities=[wood];break;
        case 'snake-windup':wood.snake.phase='windup';wood.snake.warningAge=.8;
           wood.snake.phaseAge=.23;wood.snake.attackStarted=true;game.entities=[wood];break;
        case 'snake-strike':wood.snake.phase='striking';wood.snake.phaseAge=.13;
           wood.snake.attackStarted=true;game.entities=[wood];break;
        case 'snake-stunned':wood.snake.phase='retreat';wood.snake.retreat=true;
           wood.snake.dazed=true;wood.snake.retreatTime=.43;
           wood.snake.retreatPose={x:3,y:0,angle:0,mouth:0};
           game.entities=[wood];game.invincible=.7;break;
       }
       game.snapshot();
       return {state:game.state,entities:game.entities.map(e=>e.kind),sceneTime:game.sceneTime};
     };
     return {keys:loaded,flag:action.ACTION_SPRITES_ENABLED};
   });
   const expected=mode==='new'?6:0;
   assert.equal(loaded.flag,mode==='new');
   assert.equal(loaded.keys.length,expected,'Missing real WebP sheets '+JSON.stringify(loaded));
   for(const [name,kind,t] of which){
    const state=await page.evaluate(([k,t])=>window.__QA_set(k,t),[kind,t]);
    await page.waitForTimeout(125);
    const file=path.join(OUT,vpName+'_'+mode+'_'+name+'.png');
    await page.screenshot({path:file});
    reports.push({viewport:vpName,variant:mode,case:name,file,state});
    console.log('REAL_ACTION_FRAME '+JSON.stringify({viewport:vpName,variant:mode,case:name,state}));
   }
   assert.deepEqual(errs,[],'Uncaught browser exceptions '+JSON.stringify(errs));
   await page.close();
  }
 }
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(reports,null,2));
 console.log('REAL_ACTION_SUMMARY '+JSON.stringify({screenshots:reports.length,allSheetsLoaded:true,errors:0}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
