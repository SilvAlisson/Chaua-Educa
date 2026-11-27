const assert=require('node:assert/strict'),fs=require('node:fs/promises'),playwright=require('playwright');
const name=process.env.REFINEMENT_BROWSER||'chromium',expectedVersion=require('../package.json').version;
(async()=>{
 const browser=await playwright[name].launch({executablePath:name==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:name==='chromium'?['--no-sandbox']:[]});
 const out='test-results/three-screen-refinement';await fs.mkdir(out,{recursive:true});
 try{
  for(const [width,height] of [[384,706],[393,727],[320,480],[320,568],[844,390],[568,320],[1280,575],[1366,638],[1280,600],[1024,600],[768,600]]){
   const mobile=width<1000&&!(width===768&&height===600),context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile&&name!=='firefox',reducedMotion:'reduce',...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36'}:{})});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{Element.prototype.requestFullscreen=async()=>{};Object.defineProperty(screen,'orientation',{configurable:true,value:{lock:async()=>{}}});});
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});await page.locator('#start-training:not([disabled])').waitFor();await page.evaluate(()=>document.fonts.ready);
   const moduleCheck=await page.evaluate(async()=>{
    const {game:g}=await import('./js/script.js'),{Renderer}=await import('./js/render.mjs');
    const revision=document.querySelector('meta[name=chaua-build]').content;
    return {revision,game:g.state,renderer:typeof Renderer,resources:performance.getEntriesByType('resource').map(r=>r.name).filter(x=>/\/js\/.*\.(mjs|js)(\?|$)/.test(x))};
   });
   assert.ok(moduleCheck.revision===expectedVersion||moduleCheck.revision.startsWith(expectedVersion+'-'));assert.equal(moduleCheck.game,'menu');assert.equal(moduleCheck.renderer,'function');assert.ok(moduleCheck.resources.every(url=>new URL(url).searchParams.get('v')===moduleCheck.revision));
   const target=async selector=>{const b=await page.locator(selector).boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1&&b.height>=(mobile?43:27),selector+' '+JSON.stringify({width,height,b}));};
   for(const selector of ['#btnStart','#start-training','#open-ranking','#open-guide','#open-collection','#open-missions','#open-settings','#open-credits'])await target(selector);
   if(width>=350&&width<=600&&height>=650){
    const preview=await page.locator('.home-preview').boundingBox(),form=await page.locator('#start-form').boundingBox();assert.ok(preview&&preview.height>=90&&preview.y+preview.height<=form.y+1,'Portrait character slot must be separate from the form');
   }
   await page.screenshot({path:`${out}/${name}-${width}x${height}-home.png`});
   await page.locator('#inputPlayer').fill('Refino');await page.locator('#btnStart').click();await page.waitForFunction(()=>document.querySelector('#app').classList.contains('in-flight'));
   await page.evaluate(async()=>{const {game:g}=await import('./js/script.js');g.state='countdown';g.countdown=90;g.nextSpawn=Infinity;g.entities=[];g.y=320;g.vy=0;});
   await page.locator('#pause-button').click();await page.locator('#pause-dialog').waitFor({state:'visible'});
   for(const selector of ['#resume-button','#pause-settings','#pause-dialog .back-home'])await target(selector);
   await page.locator('#pause-dialog').screenshot({path:`${out}/${name}-${width}x${height}-pause.png`});await page.locator('#resume-button').click();
   await page.evaluate(async()=>{const {game:g}=await import('./js/script.js');g.state='playing';g.score=321;g.fruits=8;g.correct=4;g.onEvent({type:'fruit',fruit:'Manga'});g.end(false,'Você encostou na cobra do galho.');});
   await page.locator('#result-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#result-score').textContent==='321');
   for(const selector of ['#restart-button','#result-ranking','#result-missions','#result-dialog .back-home'])await target(selector);
   const summary=async()=>page.locator('.result-overview').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom};});const before=await summary();assert.ok(before.top>=0&&before.bottom<=height);
   await page.locator('#flight-learning summary').click();await page.locator('#result-dialog .panel-body').evaluate(e=>e.scrollTop=e.scrollHeight);
   const after=await summary();assert.ok(after.top>=0&&after.bottom<=height,'Overview must remain visible while reading recap');assert.equal(await page.locator('#result-score').textContent(),'321');
   await page.locator('#result-dialog').screenshot({path:`${out}/${name}-${width}x${height}-result.png`});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);await context.close();console.log('PASS THREE SCREENS',name,width,height);
  }
  // Real resize after orientation-lock resolution, as observed on phones.
  const context=await browser.newContext({viewport:{width:393,height:727},hasTouch:true,isMobile:name!=='firefox',userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36'}),page=await context.newPage();
  await page.addInitScript(()=>{Element.prototype.requestFullscreen=async()=>{};Object.defineProperty(screen,'orientation',{configurable:true,value:{lock:async()=>{}}});});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});await page.locator('#inputPlayer').fill('Rotação');await page.locator('#btnStart:not([disabled])').click();
  await page.waitForTimeout(120);await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='countdown');assert.equal(await page.locator('#pause-dialog').isVisible(),false,'Initial automatic rotation must not pause the launch');
  await page.evaluate(async()=>{const g=(await import('./js/script.js')).game;g.state='playing';g.entities=[];g.nextSpawn=Infinity;g.invincible=99;});await page.setViewportSize({width:393,height:727});await page.locator('#pause-dialog').waitFor({state:'visible'});
  assert.match(await page.locator('#pause-message').textContent(),/orientação/);await context.close();console.log('PASS delayed launch rotation and safe in-flight rotation',name);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
