// V2 compatibility gate: real WebP assets, gameplay, controls and responsive canvas.
const {firefox,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const BASE=process.env.GAME_URL||'http://127.0.0.1:5501/';
const OUTPUT='test-results/v2-cross-browser';
fs.mkdirSync(OUTPUT,{recursive:true});
(async()=>{
 for(const [name,engine] of [['firefox',firefox],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   for(const viewport of [{width:1200,height:720},{width:390,height:844}]){
    for(const [mode,query,expected] of [
     ['official-a2','',{a2:true,action:true}]
    ]){
     const page=await browser.newPage({viewport,deviceScaleFactor:1});
     const errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     page.on('response',r=>{
      if(r.status()>=400&&r.url().startsWith(BASE))errors.push(r.status()+' '+r.url());
     });
     try{
      await page.goto(BASE+query,{waitUntil:'domcontentloaded'});
      await page.locator('#inputPlayer').fill('Auditoria');
      await page.waitForFunction(()=>!document.querySelector('#btnStart').disabled,null,{timeout:30000});
      const state=await page.evaluate(async()=>{
       const {isSnakeA2Ready}=await import('/js/snake-a2.mjs');
       const {hasActionSheet}=await import('/js/action-sheets.mjs');
       const canvas=document.querySelector('#forest');
       return {a2:isSnakeA2Ready(),action:hasActionSheet('parrot-flight'),
        canvasReady:canvas.width>0&&canvas.height>0,overflow:document.documentElement.scrollWidth>innerWidth+1};
      });
      assert.deepEqual({a2:state.a2,action:state.action},expected,name+' '+mode+' atlas status');
      assert.ok(state.canvasReady,name+' '+mode+' missing canvas');
      assert.equal(state.overflow,false,name+' '+mode+' horizontal overflow');
      await page.locator('#btnStart').click();
      await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='playing',null,{timeout:10000});
      await page.waitForTimeout(250);
      assert.deepEqual(errors,[],name+' '+mode+' '+viewport.width+' page errors');
      const shot=path.join(OUTPUT,name+'-'+viewport.width+'-'+mode+'.png');
      await page.screenshot({path:shot});
      await page.locator('#pause-button').click();
      await page.locator('#pause-dialog').waitFor({state:'visible'});
      await page.locator('#resume-button').click();
      await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='playing');
      assert.deepEqual(errors,[],name+' '+mode+' '+viewport.width+' pause/resume errors');
      console.log('PASS CROSS_BROWSER '+JSON.stringify({name,viewport,mode,state,shot}));
     }finally{await page.close();}
    }
   }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
