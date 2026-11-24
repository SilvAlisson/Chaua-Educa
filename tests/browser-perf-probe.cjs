const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const root=(process.env.GAME_URL||'http://127.0.0.1:5501/').replace(/\/?$/,'/');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root,{waitUntil:'networkidle'});
  assert.equal(await page.locator('#chaua-qa-panel').count(),0,'normal gameplay cannot show diagnostic UI');
  await page.goto(root+'?perf-test=1',{waitUntil:'networkidle'});
  await page.locator('#start-training:not([disabled])').click();
  await page.evaluate(async()=>{
   const {game}=await import('/js/script.js');
   game.startTutorial();game.state='playing';game.snapshot();
  });
  const panel=page.locator('#chaua-qa-panel');
  await panel.locator('button').first().click();
  await page.waitForTimeout(1900);
  const pending=page.waitForEvent('download');
  await panel.locator('button').last().click();
  const download=await pending;
  const report=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(report.schemaVersion,1);
  assert.equal(report.mode,'auto');
  assert.ok(report.summary.frames>30,'collect native RAF intervals while playing');
  assert.ok(report.summary.frameP95Ms>0);
  assert.ok(report.summary.onePercentLowFps>0);
  assert.equal(report.endReason,'manual-stop');
  assert.ok(Array.isArray(report.stutters));
  assert.ok(report.climateTimeline.length>0);
  assert.ok(report.transitions.some(e=>e.type==='season-change'));

  assert.ok(report.byStage['0']?.frames>0,'record gameplay stage');
  assert.ok(report.profileChanges?.length>0,'record graphics profile');
  assert.equal(report.samplesIncludeOnlyVisibleFocusedPlayingFrames,true);
  assert.deepEqual(errors,[]);
  await page.close();
  for(const diagnostic of [false,true]){
   const flight=await browser.newPage({viewport:{width:844,height:390},acceptDownloads:true});
   const flightErrors=[];flight.on('pageerror',e=>flightErrors.push(e.message));
   await flight.goto(root+(diagnostic?'?perf-test=1':''));
   if(diagnostic)await flight.locator('#chaua-qa-panel').getByRole('button',{name:'Iniciar'}).click();
   await flight.locator('#start-training:not([disabled])').waitFor();
   await flight.locator('#inputPlayer').fill('Teste JSON');
   await flight.locator('#btnStart').click();
   await flight.locator('#result-dialog').waitFor({state:'visible'});
   const button=flight.locator('#result-dialog').getByRole('button',{name:'Baixar JSON da partida'});
   const [saved]=await Promise.all([flight.waitForEvent('download'),button.click()]);
   const match=JSON.parse(await fs.readFile(await saved.path(),'utf8'));
   assert.ok(match.summary.frames>0,'record real playing frames before defeat');
   assert.equal(match.provenance.gameVersion,require('../package.json').version);
   assert.equal(await flight.evaluate(()=>localStorage.getItem('chaua-performance-matches-v1'))!==null,!diagnostic);
   if(!diagnostic){
    await flight.reload();
    await flight.locator('#open-settings').click();
    const historyButton=flight.getByRole('button',{name:'Baixar histórico de desempenho'});
    const [history]=await Promise.all([flight.waitForEvent('download'),historyButton.click()]);
    const previous=JSON.parse(await fs.readFile(await history.path(),'utf8'));
    assert.equal(previous.id,match.id,'recover the recorded match after refresh');
   }
   assert.deepEqual(flightErrors,[]);
   await flight.close();
  }
  console.log('PASS opt-in local-only physical-device diagnostics, download JSON, native frames and no regular UI');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
