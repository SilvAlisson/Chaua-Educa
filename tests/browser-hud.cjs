const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2,reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    let id=0,time=100;const callbacks=new Map();
    window.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};
    window.cancelAnimationFrame=id=>callbacks.delete(id);
    window.stepHud=seconds=>{time+=seconds*1000;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn(time));};
   });
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.locator('#start-training:not([disabled])').click();
   await page.evaluate(()=>{for(let i=0;i<120;i++)window.stepHud(1/30);});
   await page.locator('#pause-button').click();
   const values=await page.evaluate(async()=>{
    const {game:g}=await import('/js/script.js');
    const {journeyLength}=await import('/js/journey.mjs');g.tutorial=null;g.score=321;g.stage=1;g.distance=journeyLength(g.mode)*.321;g.shield=true;g.feather=4.2;g.pepper=3.4;g.stamina=.5;
    window.stepHud(.1);
    const text=id=>document.querySelector(id).textContent;
    return {state:g.state,score:text('#score'),stage:text('#stage-name'),destination:text('#journey-destination'),
     progress:document.querySelector('#progress-track').getAttribute('aria-valuenow'),
     shield:text('#shield-status span'),feather:text('#feather-status span'),pepper:text('#pepper-status span'),
     energy:document.querySelector('#energy').value};
   });
   assert.deepEqual(values,{state:'paused',score:'321',stage:'Árvores antigas',destination:'Abrigo · 32%',progress:'32',shield:'Escudo pronto',feather:'×2 · 5s',pepper:'Turbo · 4s',energy:.5});
   const redundant=await page.evaluate(()=>{
    const observer=new MutationObserver(()=>{});
    observer.observe(document.querySelector('#hud'),{subtree:true,attributes:true,childList:true,characterData:true});
    for(let i=0;i<30;i++)window.stepHud(.1);
    const count=observer.takeRecords().length;observer.disconnect();return count;
   });
   assert.equal(redundant,0,'unchanged HUD must not rewrite its DOM, including fractional progress');
   for(const fraction of [0,.25,.5,1]){
    const progress=await page.evaluate(async fraction=>{
     const {game:g}=await import('/js/script.js');const {journeyLength}=await import('/js/journey.mjs');g.score=321;g.distance=journeyLength(g.mode)*fraction;window.stepHud(.1);
     const fill=document.querySelector('#progress-fill'),track=document.querySelector('#progress-track');
     return {ratio:fill.getBoundingClientRect().width/track.getBoundingClientRect().width,aria:track.getAttribute('aria-valuenow'),inlineWidth:fill.style.width};
    },fraction);
    assert.ok(Math.abs(progress.ratio-fraction)<.002);assert.equal(progress.aria,String(fraction*100));assert.equal(progress.inlineWidth,'');
   }
   const training=await page.evaluate(async()=>{
    const {game:g}=await import('/js/script.js');g.tutorial={step:1};g.shield=false;g.feather=0;g.pepper=0;g.stamina=1;
    window.stepHud(.1);
    return {aria:document.querySelector('#progress-track').getAttribute('aria-valuenow'),label:document.querySelector('#progress-track').getAttribute('aria-label'),
     stage:document.querySelector('#stage-name').textContent,feather:document.querySelector('#feather-status span').textContent,pepper:document.querySelector('#pepper-status span').textContent,
     shield:document.querySelector('#shield-status').classList.contains('active'),golden:document.querySelector('#feather-status').classList.contains('golden'),
     spicy:document.querySelector('#pepper-status').classList.contains('spicy')};
   });
   assert.deepEqual(training,{aria:'16',label:'Etapas do treino',stage:'2 · Segure para subir',feather:'Pena ×2',pepper:'Pimenta turbo',shield:false,golden:false,spicy:false});
   await page.emulateMedia({reducedMotion:'no-preference'});
   assert.equal(await page.locator('#progress-fill').evaluate(node=>getComputedStyle(node).transitionProperty),'transform');
   await page.locator('#pause-dialog .back-home').click();
   await page.locator('#start-training').click();
   assert.equal(await page.locator('#score').textContent(),'0');
   assert.equal(await page.locator('#progress-track').getAttribute('aria-valuenow'),'0');
   assert.equal(await page.locator('#stage-name').textContent(),'1 · Toque para subir');
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS HUD: no redundant paused mutations, fractional progress, bar geometry, accessible values, powers, training and restart in desktop/mobile.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
