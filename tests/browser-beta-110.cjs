const assert=require('node:assert/strict'),fs=require('node:fs/promises'),pw=require('playwright');
const name=process.env.BETA_BROWSER||'chromium',version=require('../package.json').version;
(async()=>{
 const browser=await pw[name].launch({args:name==='chromium'?['--no-sandbox']:[]});
 try{
  const context=await browser.newContext({viewport:{width:393,height:727},hasTouch:true,isMobile:name!=='firefox',reducedMotion:'reduce',userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Element.prototype.requestFullscreen=async()=>{throw Error('not available');};Object.defineProperty(screen,'orientation',{configurable:true,value:{lock:async()=>{}}});});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});await page.locator('#start-training:not([disabled])').waitFor();
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/\/(beta-ui|beta-session|frame-summary)\.mjs/.test(r.name))),false,'ordinary play must not import beta collectors');
  const storage=await page.evaluate(()=>JSON.stringify(localStorage));
  await page.locator('#open-credits').click();await page.locator('#open-beta-about').click();await page.locator('#beta-dialog').waitFor({state:'visible'});
  await page.locator('#beta-group').selectOption('iniciante');await page.locator('#beta-family').selectOption('android');await page.locator('#beta-environment').selectOption('emulado');await page.locator('#beta-model').fill('Aparelho de teste');await page.locator('#beta-browser').fill(name);
  await page.locator('#beta-start').click();await page.locator('#beta-dialog').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),storage,'beta opt-in must not write storage');assert.equal(await page.locator('#chaua-qa-panel').count(),0,'beta must not mount deep profiler');
  await page.locator('#inputPlayer').fill('NOME_NAO_EXPORTAR');await page.locator('#btnStart').click();await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='countdown');
  await page.evaluate(async()=>{const g=(await import('/js/script.js')).game;g.state='playing';g.entities=[];g.nextSpawn=Infinity;g.invincible=99;g.y=320;});await page.bringToFront();await page.locator('#flap-button').focus();await page.waitForFunction(()=>document.hasFocus()&&document.visibilityState==='visible'&&document.querySelector('#app').dataset.state==='playing');await page.waitForTimeout(2000);
  await page.locator('#pause-button').click();await page.locator('#pause-settings').click();await page.locator('#open-beta-settings').click();
  assert.equal(await page.locator('#beta-model').isDisabled(),true);
  await page.locator('#beta-fun').selectOption('4');await page.locator('#beta-clarity').selectOption('3');await page.locator('#beta-comfort').selectOption('5');await page.locator('#beta-category').selectOption('controles');await page.locator('#beta-severity').selectOption('moderado');await page.locator('#beta-problem').fill('Ao girar, não entendi o aviso.');await page.locator('[data-beta-task=treino]').check();
  const downloading=page.waitForEvent('download');await page.locator('#beta-download').click();const download=await downloading;const report=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  await fs.mkdir('test-results/beta-110',{recursive:true});await fs.writeFile(`test-results/beta-110/${name}-simulated.json`,JSON.stringify(report,null,2));
  assert.equal(report.version,version);assert.equal(report.device.environment,'emulado');assert.equal(report.device.group,'iniciante');assert.equal(report.feedback.category,'controles');assert.equal(report.feedback.fun,4);assert.equal(report.feedback.tasks.treino,'concluido');assert.equal(report.feedback.tasks.progresso,'nao-avaliado');assert.equal(report.active,false);assert.equal(report.validationStatus,'aguarda-revisao-humana-e-matriz-real');assert.equal(report.measurement.additionalInstrumentationObserved,false);assert.ok(report.measurement.summary.frames>5,JSON.stringify({summary:report.measurement.summary,transitions:report.transitions}));assert.ok(report.measurement.summary.fps>0);assert.equal(JSON.stringify(report).includes('NOME_NAO_EXPORTAR'),false);assert.equal(report.attempts.length,1);
  // A failed browser download keeps the report available for a later retry.
  await page.evaluate(()=>{window.originalURLCreate=URL.createObjectURL;URL.createObjectURL=()=>{throw Error('denied');};});await page.locator('#beta-download').click();assert.match(await page.locator('#beta-status').textContent(),/mantida nesta aba/);await page.evaluate(()=>{URL.createObjectURL=window.originalURLCreate;});
  const again=page.waitForEvent('download');await page.locator('#beta-download').click();const copy=JSON.parse(await fs.readFile(await (await again).path(),'utf8'));assert.deepEqual(copy.measurement.summary,report.measurement.summary);
  await fs.mkdir('test-results/beta-110',{recursive:true});await page.locator('#beta-dialog').screenshot({path:`test-results/beta-110/${name}-beta.png`});await fs.writeFile(`test-results/beta-110/${name}-simulated.json`,JSON.stringify(report,null,2));
  await page.locator('#beta-start').click();await page.locator('#pause-dialog').waitFor({state:'visible'});await page.locator('#pause-settings').click();await page.locator('#open-beta-settings').click();assert.equal(await page.locator('#beta-fun').inputValue(),'');assert.equal(await page.locator('#beta-problem').inputValue(),'');assert.equal(await page.locator('[data-beta-task=treino]').isChecked(),false);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS beta opt-in, local report, privacy, download retry, paused return and fresh session',name);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
