const assert=require('node:assert/strict'),fs=require('node:fs/promises'),pw=require('playwright');
const name=process.env.REFINEMENT_BROWSER||'chromium';
(async()=>{
 const browser=await pw[name].launch({args:name==='chromium'?['--no-sandbox']:[]});
 try{
  const context=await browser.newContext({viewport:{width:393,height:727},hasTouch:true,isMobile:name!=='firefox',reducedMotion:'reduce',userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let full=null;Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>full});
   Element.prototype.requestFullscreen=async function(){full=this;document.dispatchEvent(new Event('fullscreenchange'));};
   document.exitFullscreen=async()=>{full=null;document.dispatchEvent(new Event('fullscreenchange'));};
   Object.defineProperty(screen,'orientation',{configurable:true,value:{lock:async()=>{},unlock(){}}});
   const vv=new EventTarget();vv.height=727;vv.width=393;vv.scale=1;Object.defineProperty(window,'visualViewport',{configurable:true,value:vv});
  });
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});await page.locator('#start-training:not([disabled])').waitFor();
  await page.locator('#inputPlayer').fill('Polimento');
  await page.locator('#topbar .fullscreen-toggle').click();assert.equal(await page.locator('#topbar .fullscreen-toggle').getAttribute('aria-pressed'),'true');
  await page.locator('#topbar .fullscreen-toggle').click();assert.equal(await page.locator('#topbar .fullscreen-toggle').getAttribute('aria-pressed'),'false');
  await page.locator('#inputPlayer').focus();await page.evaluate(()=>{visualViewport.height=400;visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>document.querySelector('#app').classList.contains('keyboard-open'));
  const start=await page.locator('#btnStart').boundingBox();assert.ok(start.y>=0&&start.y+start.height<=400,'Start remains available above keyboard');
  await page.evaluate(()=>{visualViewport.height=727;visualViewport.dispatchEvent(new Event('resize'));document.activeElement.blur();});
  await page.locator('#btnStart').click();await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='countdown');
  assert.equal(await page.locator('#pause-dialog').isVisible(),false);
  await page.locator('#hud .fullscreen-toggle').click();await page.locator('#pause-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#pause-dialog .fullscreen-toggle').getAttribute('aria-pressed'),'false');
  await page.locator('#pause-dialog .fullscreen-toggle').click();assert.equal(await page.locator('#pause-dialog .fullscreen-toggle').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#pause-dialog').isVisible(),true);
  await page.locator('#resume-button').click();await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='countdown');
  await page.evaluate(async()=>{const g=(await import('/js/script.js')).game;g.state='playing';g.score=42;g.end(false,'Fim do teste');});await page.locator('#result-dialog').waitFor({state:'visible'});
  await page.locator('#result-dialog .fullscreen-toggle').click();assert.equal(await page.locator('#result-score').textContent(),'42');
  await fs.mkdir('test-results/three-screen-refinement',{recursive:true});await page.screenshot({path:`test-results/three-screen-refinement/${name}-fullscreen-result.png`});
  await page.locator('#result-dialog .back-home').click();
  await page.evaluate(()=>{Element.prototype.requestFullscreen=async()=>{throw Error('Denied');};});await page.locator('#topbar .fullscreen-toggle').click();assert.match(await page.locator('#toast').textContent(),/não permitiu/);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS polish fullscreen exit/reentry, paused state, keyboard and denied API',name);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
