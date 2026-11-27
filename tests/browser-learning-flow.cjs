const playwright=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const name=process.env.LEARNING_BROWSER||'chromium';
(async()=>{
 const browser=await playwright[name].launch({executablePath:name==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:name==='chromium'?['--no-sandbox']:[]});
 try{
  for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
   const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.locator('#start-training:not([disabled])').waitFor();await page.locator('#inputPlayer').fill('Asas curiosas');
   await page.locator('#open-missions').click();assert.equal(await page.locator('#mission-items article').count(),8);
   await page.locator('#missions-dialog .close-dialog').click();
   await page.locator('#btnStart').click();
   await page.evaluate(async()=>{
    const {game:g}=await import('/js/script.js'),{journeyLength}=await import('/js/journey.mjs');
    g.state='playing';g.nextSpawn=Infinity;g.entities=[];g.y=320;g.vy=0;
    g.collect({kind:'fruit',id:999,variety:0,x:g.x,y:g.y});
    g.distance=journeyLength(g.mode)*.26;g.tick(1/120);
    g.elapsed=31;g.y=320;g.vy=0;g.entities=[];
    if(!g.maybeOpenQuiz())throw Error('Expected actual educational discovery');
    g.answer(!g.question.answer);g.continueQuiz();
   });
   await page.locator('#result-dialog').waitFor({state:'visible'});
   const learning=page.locator('#flight-learning');await learning.waitFor({state:'visible'});
   assert.equal(await learning.evaluate(e=>e.open),false);
   await learning.locator('summary').click();
   assert.match(await page.locator('#flight-learning-summary').textContent(),/1 pergunta respondida/);
   const entry=page.locator('#flight-learning-items button').filter({hasText:'Chauás revelam ipês'});await entry.click();
   await page.locator('#collection-dialog').waitFor({state:'visible'});assert.match(await page.locator('.journal-reading').textContent(),/Handroanthus/);
   assert.equal(await page.locator('.journal-back').evaluate(e=>e===document.activeElement),true);
   await page.locator('#collection-dialog .close-dialog').click();await page.locator('#result-dialog').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.activeElement?.closest('#flight-learning-items')&&document.activeElement.textContent.includes('Chauás revelam ipês'));
   assert.equal(await entry.evaluate(e=>e===document.activeElement),true);
   assert.ok(await page.locator('#result-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   fs.mkdirSync('test-results/learning-flow',{recursive:true});await page.locator('#result-dialog').screenshot({path:`test-results/learning-flow/${name}-${viewport.width}-recap.png`});
   await page.locator('#restart-button').click();
   await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');g.state='playing';g.boundaryContact('bottom');});
   await page.locator('#result-dialog').waitFor({state:'visible'});assert.equal(await learning.isVisible(),false,'new flight must clear the prior recap');
   assert.deepEqual(errors,[]);console.log('PASS LEARNING FLOW',name,viewport);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
