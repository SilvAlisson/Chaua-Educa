// Verifies ordinary Github Pages URL: one local report per actual match,
// independent of the opt-in deep ?perf-test=1 profiler.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720},acceptDownloads:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#chaua-qa-panel').count(),0,'no opt-in overlay on normal URL');
  await page.locator('#inputPlayer').fill('Jogador Teste');
  await page.locator('#btnStart:not([disabled])').click();
  await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='playing');
  await page.waitForTimeout(550);
  assert.equal(await page.evaluate(()=>localStorage.getItem('chaua-performance-matches-v1')),null,'not saved until match ends');
  await page.evaluate(async()=>{
   const {game}=await import('/js/script.js');
   game.end(false,'Fim de teste',false);
  });
  await page.locator('#result-dialog').waitFor({state:'visible'});
  const reports=await page.evaluate(()=>JSON.parse(localStorage.getItem('chaua-performance-matches-v1')));
  assert.equal(reports.length,1);
  assert.equal(reports[0].schemaVersion,1);
  assert.equal(reports[0].endReason,'ended');
  assert.ok(reports[0].summary.frames>10);
  assert.equal(reports[0].measurement.deepInstrumentation,false);
  assert.equal(JSON.stringify(reports).includes('Jogador Teste'),false,'never capture the player name');
  const singleDownload=page.waitForEvent('download');
  await page.locator('#download-latest-match').click();
  const single=JSON.parse(await fs.readFile(await (await singleDownload).path(),'utf8'));
  assert.equal(single.id,reports[0].id);
  await page.locator('#restart-button').click();
  await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='playing');
  await page.waitForTimeout(150);
  await page.evaluate(async()=>{
   const {game}=await import('/js/script.js');game.end(false,'Outra partida',false);
  });
  await page.locator('#result-dialog').waitFor({state:'visible'});
  const count=await page.evaluate(()=>JSON.parse(localStorage.getItem('chaua-performance-matches-v1')).length);
  assert.equal(count,2,'reports stored separately per match');
  await page.locator('#result-dialog .back-home').click();
  await page.locator('#open-settings').click();
  await page.locator('#settings-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#auto-match-performance').isChecked(),true);
  const allDownload=page.waitForEvent('download');
  await page.locator('#download-match-history').click();
  const all=JSON.parse(await fs.readFile(await (await allDownload).path(),'utf8'));
  assert.equal(all.matches.length,2);
  await page.locator('#auto-match-performance').uncheck();
  await page.locator('#settings-dialog .close-dialog').click();
  await page.locator('#inputPlayer').fill('Outra pessoa');
  await page.locator('#btnStart').click();
  await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='playing');
  await page.evaluate(async()=>{
   const {game}=await import('/js/script.js');game.end(false,'Sem coleta',false);
  });
  await page.locator('#result-dialog').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chaua-performance-matches-v1')).length),2,'opt-out stops new reports');
  assert.deepEqual(errors,[]);
  await browser.close();
  console.log('PASS local per-match telemetry on ordinary URL, one-click export, persistent history and opt-out');
 }finally{if(browser.isConnected())await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
