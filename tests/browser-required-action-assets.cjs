// The game must never silently switch to deprecated graphics when a required
// action sheet is unavailable. This test deliberately blocks one real WebP.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async()=>{
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const root=process.env.GAME_URL||'http://127.0.0.1:5501/';
  const broken=await browser.newPage();
  let requests=0;
  await broken.route('**/public/hawk/fly/flight.webp',route=>{requests++;return route.abort('failed');});
  await broken.goto(root,{waitUntil:'networkidle'});
  await broken.waitForFunction(()=>document.querySelector('#asset-status')?.textContent.includes('Required action atlas unavailable'));
  const error=await broken.locator('#asset-status').textContent();
  assert.match(error,/hawk-flight/);
  assert.ok(requests>0);
  assert.equal(await broken.locator('#btnStart').isDisabled(),true);
  assert.equal(await broken.locator('#start-training').isDisabled(),true);
  await broken.close();

  const intact=await browser.newPage();
  await intact.goto(root,{waitUntil:'networkidle'});
  await intact.locator('#start-training:not([disabled])').waitFor();
  const actual=await intact.evaluate(async()=>{
   const {preloadActionSheets,hasActionSheet,ACTION_SHEET_DEFS}=await import('/js/action-sheets.mjs');
   await preloadActionSheets();
   return Object.keys(ACTION_SHEET_DEFS).map(key=>({key,ready:hasActionSheet(key)}));
  });
  assert.equal(actual.length,4);
  assert.ok(actual.every(x=>x.ready),JSON.stringify(actual));
  await intact.close();
  console.log('PASS required WebP fail-fast: no obsolete parrot/hawk art fallback, all 4 official sheets load normally');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
