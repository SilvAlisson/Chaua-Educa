// Real browser interaction: native keyboard ownership, touch capture, lifecycle,
// persistent controls and safe-area layout. Audio device faults also have unit tests.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const playwright=require('playwright'),name=process.env.ACCESS_BROWSER||'chromium';
(async()=>{
 const browser=await playwright[name].launch({executablePath:name==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:name==='chromium'?['--no-sandbox']:[]});
 const out='test-results/accessibility-108';await fs.mkdir(out,{recursive:true});
 try{
 for(const [width,height] of [[1366,768],[320,568],[568,320],[390,844],[844,390]]){
  const mobile=width<1000,context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile&&name!=='firefox',reducedMotion:'reduce',...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36'}:{})});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Element.prototype.requestFullscreen=async()=>{throw Error('fullscreen unavailable');};});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  await page.locator('#open-settings').click();await page.locator('#controls-side').selectOption('left');await page.locator('#warning-sounds').uncheck();await page.locator('#settings-sound').uncheck();
  await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});
  await page.locator('#open-settings').click();assert.equal(await page.locator('#controls-side').inputValue(),'left');assert.equal(await page.locator('#warning-sounds').isChecked(),false);assert.equal(await page.locator('#settings-sound').isChecked(),false);
  await page.locator('#warning-sounds').check();await page.locator('#settings-sound').check();await page.locator('#audio-volume').focus();await page.keyboard.press('Home');assert.equal(await page.locator('#volume-value').textContent(),'0%');await page.keyboard.press('End');
  await page.locator('#settings-dialog').screenshot({path:`${out}/${name}-${width}-settings.png`});await page.keyboard.press('Escape');
  await page.locator('#inputPlayer').fill('Voo Acessível');await page.locator('#btnStart:not([disabled])').click();
  await page.waitForFunction(()=>document.querySelector('#app').classList.contains('in-flight'));
  const stable=()=>page.evaluate(async()=>{const {game:g}=await import('/js/script.js');g.state='countdown';g.countdown=90;g.entities=[];g.nextSpawn=Infinity;g.y=320;g.vy=0;g.feather=8;g.pepper=5;g.cancelInput();});
  await stable();
  await page.evaluate(()=>{const a=document.querySelector('#app');for(const [s,n] of Object.entries({top:10,right:20,bottom:12,left:25}))a.style.setProperty('--safe-'+s,n+'px');});
  const flap=await page.locator('#flap-button').boundingBox(),pause=await page.locator('#pause-button').boundingBox();
  assert.ok(flap.x>=25&&flap.x+flap.width<=width-20&&flap.height>=44&&flap.y+flap.height<=height-12,JSON.stringify({width,height,flap}));
  assert.ok(pause.x>=25&&pause.x+pause.width<=width-20&&pause.height>=44);
  // Real pointer capture continues after leaving the button; cancellation clears held input.
  await page.locator('#flap-button').evaluate(e=>e.addEventListener('pointerdown',event=>{window.testPointerId=event.pointerId;},{once:true}));
  await page.mouse.move(flap.x+flap.width/2,flap.y+flap.height/2);await page.mouse.down();
  assert.equal(await page.evaluate(async()=>(await import('/js/script.js')).game.held),true);
  await page.mouse.move(width/2,height/2);await page.locator('#flap-button').dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>window.testPointerId)});await page.mouse.up();
  assert.equal(await page.evaluate(async()=>(await import('/js/script.js')).game.held),false);
  await stable();await page.locator('#flap-button').focus();await page.keyboard.down('Space');assert.equal(await page.evaluate(async()=>(await import('/js/script.js')).game.held),true);await page.keyboard.up('Space');
  assert.equal(await page.evaluate(async()=>(await import('/js/script.js')).game.held),false);
  // Space on a native pause control must activate that control, without a flap.
  await page.locator('#pause-button').focus();await page.keyboard.press('Space');await page.locator('#pause-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#resume-button').evaluate(e=>e===document.activeElement),true);
  const snapshot=()=>page.evaluate(async()=>{const g=(await import('/js/script.js')).game;return [g.state,g.elapsed,g.sceneTime,g.distance,g.feather,g.pepper,g.held,g.pendingTap];});
  const frozen=await snapshot();await page.waitForTimeout(180);assert.deepEqual(await snapshot(),frozen);
  await page.locator('#pause-settings').click();await page.locator('#controls-side').selectOption('right');await page.locator('#audio-volume').focus();await page.keyboard.press('ArrowLeft');
  assert.equal((await snapshot())[0],'paused');await page.keyboard.press('Escape');await page.locator('#pause-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#pause-settings').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Escape');assert.equal((await snapshot())[0],'countdown');assert.equal(await page.locator('#flap-button').evaluate(e=>e===document.activeElement),true);
  // Browsers may omit visibilitychange during history cache transitions.
  for(const event of ['blur','pagehide']){
   await stable();await page.locator('#flap-button').focus();await page.keyboard.down('Space');await page.evaluate(type=>window.dispatchEvent(new Event(type)),event);await page.keyboard.up('Space');
   await page.locator('#pause-dialog').waitFor({state:'visible'});const before=await snapshot();assert.equal(before[6],false);assert.equal(before[7],0);
   await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
   await page.waitForTimeout(100);assert.deepEqual(await snapshot(),before);await page.locator('#resume-button').click();assert.equal((await snapshot())[0],'countdown');
  }
  await stable();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  const hiddenState=await snapshot();assert.equal(hiddenState[0],'paused');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(100);assert.deepEqual(await snapshot(),hiddenState);
  await page.locator('#resume-button').click();
  await stable();await page.evaluate(async()=>{const g=(await import('/js/script.js')).game;g.state='playing';g.entities=[];g.invincible=99;g.y=320;g.vy=0;});
  await page.setViewportSize({width:height,height:width});await page.locator('#pause-dialog').waitFor({state:'visible'});assert.match(await page.locator('#pause-message').textContent(),/orientação/);
  await page.setViewportSize({width,height});
  if(height<=500){
   for(const selector of ['#resume-button','#pause-settings','#pause-dialog .back-home']){const b=await page.locator(selector).boundingBox();assert.ok(b.y>=0&&b.y+b.height<=height&&b.height>=44,'Short pause action must be visible: '+JSON.stringify({selector,b,width,height}));}
  }
  await page.locator('#pause-dialog').screenshot({path:`${out}/${name}-${width}-pause.png`});
  await page.locator('#resume-button').click();await stable();
  await page.evaluate(()=>document.dispatchEvent(new Event('fullscreenchange')));await page.locator('#pause-dialog').waitFor({state:'visible'});assert.match(await page.locator('#pause-message').textContent(),/tela cheia/);
  await page.locator('#pause-dialog .back-home').click();assert.equal(await page.locator('#home').isVisible(),true);
  assert.equal(await page.evaluate(()=>scrollY),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(errors,[]);console.log('PASS ACCESSIBILITY 1.0.8',name,width,height);await context.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
