const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const playwright=require('playwright');
const name=process.env.GAMEPLAY_BROWSER||'chromium';
(async()=>{
 const browser=await playwright[name].launch({executablePath:name==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:name==='chromium'?['--no-sandbox']:[]});
 const out='test-results/gameplay-106';await fs.mkdir(out,{recursive:true});
 try{
  for(const viewport of [{width:1366,height:768},{width:1280,height:600},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.locator('#inputPlayer').fill('Ana retomada');await page.locator('input[name=mode][value=tranquilo]').check();
   await page.locator('#btnStart:not([disabled])').click();
   await page.evaluate(async()=>{
    const {game:g}=await import('/js/script.js');const {journeyLength}=await import('/js/journey.mjs');
    g.state='playing';g.entities=[];g.y=320;g.vy=0;g.nextSpawn=Infinity;g.elapsed=90;g.distance=journeyLength(g.mode)/4-.01;
    g.tick(1/120);g.addScore(12);g.end(false,'Teste de retomada');
   });
   await page.locator('#result-dialog').waitFor({state:'visible'});
   await page.waitForTimeout(750);
   assert.equal(await page.locator('#result-dialog').evaluate(d=>d.querySelector('h2').getBoundingClientRect().top>=d.getBoundingClientRect().top),true,'checkpoint result must open at its title');
   const button=page.locator('#continue-chapter-result');assert.match(await button.textContent(),/trecho 2/);assert.equal(await button.isVisible(),true);
   await page.locator('#result-dialog').screenshot({path:`${out}/${name}-${viewport.width}-result.png`});
   await button.click();
   const resumed=await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');return {resumed:g.resumed,score:g.score,stage:g.stage,state:g.state,entities:g.entities.length,held:g.held};});
   assert.deepEqual(resumed,{resumed:true,score:0,stage:1,state:'countdown',entities:0,held:false});
   await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');g.state='playing';g.addScore(999);g.end(false,'Pontos da retomada');});
   await page.locator('#result-dialog').waitFor({state:'visible'});
   assert.equal(await page.evaluate(async()=>{const {default:DB}=await import('/js/database.js');return DB.get().find(r=>r.playerName==='Ana retomada'&&r.mode==='tranquilo').score_val;}),12);
   assert.match(await page.locator('#storage-note').textContent(),/retomada/);
   await page.reload({waitUntil:'networkidle'});
   await page.locator('#inputPlayer').fill('Ana retomada');await page.locator('input[name=mode][value=tranquilo]').check();
   const menu=page.locator('#continue-chapter-menu');await menu.waitFor({state:'visible'});
   assert.match(await menu.textContent(),/trecho 2/);
   assert.equal(await page.locator('#chapter-menu-note').isVisible(),true,'score consequence must remain visible on compact screens');
   await page.locator('#inputPlayer').fill('Beto');assert.equal(await menu.isVisible(),false);
   await page.locator('#inputPlayer').fill('Ana retomada');await page.locator('input[name=mode][value=aventura]').check();assert.equal(await menu.isVisible(),false);
   await page.locator('input[name=mode][value=tranquilo]').check();assert.equal(await menu.isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await menu.scrollIntoViewIfNeeded();
   const rect=await menu.boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=viewport.height+1,'checkpoint control inaccessible');
   await page.screenshot({path:`${out}/${name}-${viewport.width}-menu.png`,fullPage:true});
   await menu.click();
   await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');g.state='playing';g.end(true,'Jornada concluída');});
   await page.locator('#result-dialog').waitFor({state:'visible'});assert.equal(await button.isVisible(),false);
   assert.equal(await page.evaluate(async()=>{const {default:DB}=await import('/js/database.js');return DB.chapterCheckpoint('Ana retomada');}),null);
   assert.deepEqual(errors,[]);await page.close();console.log('PASS GAMEPLAY 1.0.6',name,viewport);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
