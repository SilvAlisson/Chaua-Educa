// End-to-end check of the normal post-match JSON in the opt-in forensic mode.
// A second RAF or manual profiler button must NOT be needed.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720},acceptDownloads:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.GAME_URL||'http://127.0.0.1:5501/';
  const url=new URL(base);
  url.searchParams.set('match-forensics','1');
  url.searchParams.set('test-seed','2448657347');
  url.searchParams.set('hawk-warmup','visible');
  await page.goto(url.href,{waitUntil:'networkidle'});
  assert.equal(await page.locator('#chaua-qa-panel').count(),0,'forensics uses the existing game RAF, not the manual probe UI');
  await page.locator('#inputPlayer').fill('Auditoria Técnica');
  await page.locator('#btnStart:not([disabled])').click();
  await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='playing',{timeout:45000});
  await page.waitForTimeout(600);
  await page.evaluate(async()=>{const {game}=await import('/js/script.js');game.end(false,'Fim de teste',false);});
  await page.locator('#result-dialog').waitFor({state:'visible'});
  const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('chaua-performance-matches-v1')).at(-1));
  assert.equal(report.provenance.testBranch,'test/forense-causal-raf-v114-20261120');
  assert.equal(report.measurement.deepInstrumentation,true);
  assert.equal(report.experiment.forensicEnabled,true);
  assert.equal(report.experiment.hawkWarmup,'visible');
  assert.equal(report.experiment.fixedSeed,2448657347);
  assert.ok(report.forensics?.gameEvents?.some(e=>e.name==='hawk-warmup-visible'));
  assert.ok(report.forensics?.measuredOperations?.['render.game']);
  assert.ok(Array.isArray(report.forensics.capabilities.observerTypes));
  assert.equal(JSON.stringify(report).includes('Auditoria Técnica'),false,'do not collect player names');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#download-latest-match').click();
  const downloaded=JSON.parse(await fs.readFile(await (await downloadPromise).path(),'utf8'));
  assert.equal(downloaded.id,report.id);
  assert.ok(downloaded.forensics?.gameEvents);
  assert.deepEqual(errors,[]);
  console.log('PASS opt-in automatic forensic JSON, bounded browser observers and onscreen hawk warmup');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
