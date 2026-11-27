const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:false,args:['--no-sandbox','--window-size=1400,900']});
 try{
  const page=await browser.newPage({viewport:null,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  await page.locator('#inputPlayer').fill('Tela real');await page.locator('#btnStart:not([disabled])').click();
  await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='countdown');
  await page.evaluate(async()=>{const g=(await import('/js/script.js')).game;g.state='playing';g.entities=[];g.nextSpawn=Infinity;g.invincible=99;g.y=320;g.vy=0;});
  await page.locator('#hud .fullscreen-toggle').click();
  await page.waitForFunction(()=>document.fullscreenElement?.id==='app');
  await page.waitForTimeout(700);
  const result=await page.locator('#resume-button').evaluate(e=>{
   const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
   return {nativeFullscreen:document.fullscreenElement?.id,pauseOpen:document.querySelector('#pause-dialog').open,resumeHit:hit===e||e.contains(hit),hit:hit?.tagName,viewport:[innerWidth,innerHeight]};
  });
  await fs.mkdir('test-results/fullscreen-native',{recursive:true});
  await fs.writeFile('test-results/fullscreen-native/result.json',JSON.stringify({result,errors},null,2));
  await page.screenshot({path:'test-results/fullscreen-native/state.png'});
  if(process.env.FULLSCREEN_EXPECT_BLOCKED==='1'){assert.equal(result.pauseOpen,true);assert.equal(result.resumeHit,false,'Original top-layer freeze must be reproducible with the real API');console.log('NATIVE_BASELINE_REPRODUCED',JSON.stringify(result));}
  else {
   assert.equal(result.pauseOpen,true,'Pause must be open in native fullscreen');
   assert.equal(result.resumeHit,true,'Pause must be actionable after entering real fullscreen');
   const before=await page.evaluate(async()=>{const g=(await import('/js/script.js')).game;return {elapsed:g.elapsed,y:g.y};});
   await page.waitForTimeout(250);
   assert.deepEqual(await page.evaluate(async()=>{const g=(await import('/js/script.js')).game;return {elapsed:g.elapsed,y:g.y};}),before,'Fullscreen must preserve the paused simulation');
   await page.locator('#resume-button').click();
   await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='countdown');
   await page.locator('#hud .fullscreen-toggle').click();
   await page.waitForFunction(()=>!document.fullscreenElement&&document.querySelector('#pause-dialog').open);
   await page.locator('#resume-button').click();
   await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='countdown');
   // Re-entry during the countdown also needs an actionable pause.
   await page.locator('#hud .fullscreen-toggle').click();
   await page.waitForFunction(()=>document.fullscreenElement?.id==='app'&&document.querySelector('#pause-dialog').open);
   await page.locator('#resume-button').click();
   await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='countdown');
   console.log('PASS NATIVE FULLSCREEN',JSON.stringify(result));
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});