const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const expectedVersion=require('../package.json').version;

// Reproduce the exact project-site URL hierarchy used by GitHub Pages.
// No development server, Node process or prompt is needed by the visitor.
const url = process.env.PAGES_PREVIEW_URL ||
  'http://127.0.0.1:5502/Chaua-Educa/';

(async () => {
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[],badResponses=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{
   if(response.status()>=400)badResponses.push(response.status()+' '+response.url());
  });
  await page.goto(url,{waitUntil:'networkidle',timeout:45000});
  await page.waitForURL('**/Chaua-Educa/Chaua-Educa-main/',{timeout:12000});
  assert.equal(new URL(page.url()).pathname,'/Chaua-Educa/Chaua-Educa-main/');
  // Gameplay correctly requires a player name (at least 3 characters)
  // before enabling "Vamos voar". Previous test timed out before filling it.
  await page.locator('#start-training:not([disabled])').waitFor({timeout:25000});
  await page.locator('#inputPlayer').fill('Teste Pages');
  try {
   await page.locator('#btnStart:not([disabled])').waitFor({timeout:12000});
  } catch(error) {
   const status=await page.locator('#asset-status').textContent().catch(()=>null);
   throw new Error('GitHub Pages button never enabled after valid name; asset-status='+status+
    '; pageerrors='+JSON.stringify(errors)+'; networkErrors='+JSON.stringify(badResponses),{cause:error});
  }
  assert.deepEqual(errors,[],'JavaScript error on GitHub Pages subpath');
  assert.deepEqual(badResponses,[],'Missing assets or modules on GitHub Pages subpath');
  const loaded=await page.evaluate(async()=>{
   const {images,loadAssets}=await import('./js/assets.mjs');
   const {GAME_VERSION}=await import('./js/version.mjs');
   const {hasActionSheet}=await import('./js/action-sheets.mjs');
   await loadAssets();
   return {
    version:GAME_VERSION,versionLabel:document.querySelector('#build-version').textContent,
    css:!!document.querySelector('link[rel="stylesheet"]')?.sheet,
    images:images.size,
    seasonal:!!images.get('season-backgrounds')?.naturalWidth,
    requiredArt:['parrot-flight','parrot-impact','hawk-flight','hawk-stunned'].every(hasActionSheet),
    orientation:document.documentElement.className,
   };
  });
  assert.equal(loaded.version,expectedVersion);
  assert.ok(loaded.versionLabel.includes(expectedVersion));
  assert.ok(loaded.css,'CSS must load from the repository subdirectory');
  assert.ok(loaded.images>15,'Images must load from relative paths');
  assert.equal(loaded.seasonal,true);
  assert.equal(loaded.requiredArt,true,'All four required action atlases must be ready');
  await page.locator('#btnStart').click();
  await page.waitForFunction(()=>document.querySelector('#app')?.dataset.state==='playing',{timeout:15000});
  await page.waitForTimeout(1000);
  assert.deepEqual(errors,[],'No errors after starting a flight via GitHub Pages subpath');
  assert.deepEqual(badResponses,[],'No late-loading 404s during flight');
  // The bookmarked game subdirectory must remain directly accessible too.
  const directURL=new URL(page.url());
  await page.goto(directURL.href,{waitUntil:'networkidle'});
  await page.locator('#start-training:not([disabled])').waitFor({timeout:25000});
  assert.equal(new URL(page.url()).pathname,'/Chaua-Educa/Chaua-Educa-main/');
  assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
  // Root bookmarks must retain performance diagnostics on phones as well.
  // Only the path changes; query flags must survive the redirect.
  const diagnosticUrl=new URL(url);
  diagnosticUrl.search='?perf-test=1&perf-level=deep';
  await page.goto(diagnosticUrl.href,{waitUntil:'networkidle'});
  await page.waitForURL('**/Chaua-Educa/Chaua-Educa-main/?perf-test=1&perf-level=deep',{timeout:12000});
  assert.equal(new URL(page.url()).search,'?perf-test=1&perf-level=deep');
  await page.locator('#chaua-qa-panel').waitFor({timeout:15000});
  assert.equal(await page.locator('#chaua-perf-level').inputValue(),'deep');
  assert.deepEqual(errors,[],'Diagnostics must load without JavaScript errors');
  assert.deepEqual(badResponses,[],'Diagnostics must not request missing files');
  console.log('PASS GitHub Pages root preserves perf-test and perf-level, and game loads diagnostics',loaded);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
