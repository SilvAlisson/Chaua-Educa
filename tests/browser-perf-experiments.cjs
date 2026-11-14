// Controlled opt-in warmup A/B and result-canvas regression; no FPS claims in CI.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const base=process.env.GAME_URL||'http://127.0.0.1:5501/';
const root=base.endsWith('/')?base:base+'/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const enabled of [false,true]){
   const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1,acceptDownloads:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(root+'?perf-test=1&snakeWarmup='+(enabled?'1':'0'),{waitUntil:'networkidle'});
   await page.locator('#start-training:not([disabled])').waitFor();
   const original=page.locator('#result-bird canvas');
   assert.equal(await original.count(),1,'result bird canvas exists before any flight');
   await original.evaluate(node=>node.dataset.reused='yes');
   const panel=page.locator('#chaua-qa-panel');
   await panel.locator('button').first().click();
   await page.locator('#start-training').click();
   await page.waitForTimeout(650);
   await page.evaluate(async()=>{
    const {game}=await import('/js/script.js');
    game.tutorial=null;
    game.state='playing';
    game.snapshot();
   });
   await page.waitForTimeout(130);
   await page.evaluate(async()=>{
    const {game}=await import('/js/script.js');
    game.end(false,'Fim de teste controlado.');
   });
   await page.locator('#result-dialog').waitFor({state:'visible'});
   const {marker,width,height}=await original.evaluate(node=>({marker:node.dataset.reused,width:node.width,height:node.height}));
   assert.deepEqual({marker,width,height},{marker:'yes',width:300,height:210},'result preserves the original canvas node');
   // A modal dialog occupies the browser's top layer; close it before
   // clicking the QA panel, which deliberately remains outside dialogs.
   await page.locator('#result-dialog').evaluate(dialog=>dialog.close());
   const pending=page.waitForEvent('download');
   await panel.locator('button').last().click();
   const downloaded=await pending;
   const report=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));
   assert.equal(report.experiments.snakeWarmupEnabled,enabled);
   const warmups=report.forensics.gameEvents.filter(e=>e.name==='snake-warmup');
   if(enabled){
    assert.deepEqual(warmups.map(e=>e.sheet),['idle','attack','stunned','high','sweep'],'warm each sheet once, in order');
    assert.equal(report.experiments.snakeSheetsWarmed,5);
    assert.equal(report.forensics.measuredOperations['snake.warmupMs']?.count,5);
   }else{
    assert.equal(warmups.length,0,'no hidden warmup in the baseline');
    assert.equal(report.experiments.snakeSheetsWarmed,0);
    assert.equal(report.forensics.measuredOperations['snake.warmupMs'],undefined);
   }
   assert.ok(report.forensics.measuredOperations['ui.resultBird']?.count>=1);
   assert.ok(report.forensics.measuredOperations['ui.dialogOpen']?.count>=1);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS opt-in snake warmup A/B events and persistent result canvas.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
