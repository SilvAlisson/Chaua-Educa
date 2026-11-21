const assert=require('node:assert/strict'),fs=require('node:fs/promises'),playwright=require('playwright');
const name=process.env.RELIABILITY_BROWSER||'chromium',root=process.env.GAME_URL||'http://127.0.0.1:5501/';
(async()=>{
 const browser=await playwright[name].launch({executablePath:name==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:name==='chromium'?['--no-sandbox']:[]});
 const out='test-results/reliability-109';await fs.mkdir(out,{recursive:true});
 try{
  for(const file of ['assets/v3/forest.webp','public/hawk/fly/flight.webp','public/snake/attack/high.webp']){
   const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let blocked=true,requests=0;
   await page.route('**/'+file,r=>{requests++;return blocked?r.abort('failed'):r.continue();});
   await page.goto(root,{waitUntil:'networkidle'});await page.locator('#retry-assets:not([hidden])').waitFor();
   assert.equal(await page.locator('#btnStart').isDisabled(),true);assert.equal(await page.locator('#start-training').isDisabled(),true);
   await page.evaluate(async()=>{const {default:DB}=await import('/js/database.js');DB.upsertPlayerScore('Ana',88);DB.unlock('Manga');});
   await page.screenshot({path:`${out}/${name}-${file.includes('snake')?'snake':file.includes('hawk')?'hawk':'forest'}-failure.png`});
   blocked=false;await page.locator('#retry-assets').click();await page.locator('#start-training:not([disabled])').waitFor({timeout:25000});
   assert.ok(requests>=2);assert.equal(await page.locator('#retry-assets').isHidden(),true);
   assert.deepEqual(await page.evaluate(async()=>{const {default:DB}=await import('/js/database.js');return {score:DB.get()[0].score_val,fruit:DB.unlocked().includes('Manga')};}),{score:88,fruit:true});
   await page.locator('#inputPlayer').fill('Ana');await page.locator('#btnStart').click();await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='playing');
   assert.deepEqual(errors,[]);await context.close();console.log('PASS RETRY without reload or progress loss',name,file);
  }
  const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root,{waitUntil:'networkidle'});await page.locator('#start-training:not([disabled])').waitFor();
  const expected=await page.evaluate(async()=>{
   const {default:DB}=await import('/js/database.js');localStorage.setItem('db-chaua','[{"playerName":"Pioneiro","score_val":777}]');
   localStorage.setItem('db-chaua-floresta-v13','[{"playerName":"Ana","score_val":123,"mode":"aventura"}]');
   DB.upsertPlayerScore('Ana',88);DB.unlock('Manga');DB.discoverEntries(['arvores']);DB.recordDiscovery('Ana','habitat',false);DB.advanceMissions('Ana',{type:'fruit',fruit:'Manga'});
   DB.saveChapterCheckpoint('Ana',{version:1,mode:'tranquilo',stage:2,seed:66,elapsed:120,sequence:4,snakeSequence:1,hawkSequence:1,foodSequence:2});DB.writeObject('chaua-controls-side','left');DB.writeObject('chaua-sound',false);DB.writeObject('chaua-volume',.25);
   return {chapter:DB.chapterCheckpoint('Ana'),missions:DB.missionProgress('Ana')};
  });
  const other=await context.newPage();await other.goto(root,{waitUntil:'networkidle'});await other.locator('#start-training:not([disabled])').waitFor();
  await other.evaluate(async()=>{const {default:DB}=await import('/js/database.js');DB.upsertPlayerScore('Bia',99);DB.unlock('Goiaba');});
  await page.waitForFunction(async()=>{const {default:DB}=await import('/js/database.js');return DB.get().some(p=>p.playerName==='Bia')&&DB.unlocked().includes('Goiaba');});
  await page.evaluate(async()=>{const {default:DB}=await import('/js/database.js');DB.upsertPlayerScore('Ana',90);});await page.reload({waitUntil:'networkidle'});
  const actual=await page.evaluate(async()=>{const {default:DB}=await import('/js/database.js');return {scores:DB.get().map(p=>[p.playerName,p.score_val]),chapter:DB.chapterCheckpoint('Ana'),missions:DB.missionProgress('Ana'),foods:DB.unlocked(),entries:DB.discoveredEntries(),review:DB.reviewTopics('Ana'),legacy:DB.get(true),previous:DB.previousScores(),sound:document.querySelector('.sound-toggle').getAttribute('aria-pressed'),volume:DB.readObject('chaua-volume',null),side:document.querySelector('#app').dataset.controlsSide};});
  assert.deepEqual(actual.scores,[['Bia',99],['Ana',90]]);assert.deepEqual(actual.chapter,expected.chapter);assert.deepEqual(actual.missions,expected.missions);
  assert.ok(actual.foods.includes('Manga')&&actual.foods.includes('Goiaba'));assert.ok(actual.entries.includes('arvores'));assert.deepEqual(actual.review,['habitat']);assert.equal(actual.legacy[0].score_val,777);assert.ok(actual.previous.some(p=>p.score_val===123&&p.ruleset==='floresta-v13'));assert.equal(actual.side,'left');assert.equal(actual.sound,'false');assert.equal(actual.volume,.25);
  await page.locator('#inputPlayer').fill('Ana');await page.locator('input[name=mode][value=tranquilo]').check();await page.locator('#continue-chapter-menu:not([hidden])').click();
  assert.equal(await page.evaluate(async()=>(await import('/js/script.js')).game.resumed),true);assert.equal(await page.evaluate(async()=>(await import('/js/script.js')).game.stage),2);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS persistence after reload, sequential tabs, legacy preservation and chapter resume',name);
  const denied=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:name!=='firefox',userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36'});await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked storage');};Storage.prototype.setItem=()=>{throw Error('blocked storage');};});
  const blocked=await denied.newPage(),blockedErrors=[];blocked.on('pageerror',e=>blockedErrors.push(e.message));await blocked.goto(root,{waitUntil:'networkidle'});await blocked.locator('#start-training:not([disabled])').waitFor();
  await blocked.locator('#persistence-status:not([hidden])').waitFor();assert.match(await blocked.locator('#persistence-status').textContent(),/apenas nesta aba/);
  assert.deepEqual(await blocked.evaluate(async()=>{const {default:DB}=await import('/js/database.js');DB.upsertPlayerScore('Ana',42);DB.upsertPlayerScore('Ana',20);DB.unlock('Manga');return [DB.get()[0].score_val,DB.unlocked().includes('Manga'),DB.storageAvailable];}),[42,true,false]);
  for(const viewport of [{width:320,height:568},{width:568,height:320},{width:390,height:844}]){await blocked.setViewportSize(viewport);await blocked.waitForTimeout(80);}
  assert.deepEqual(blockedErrors,[]);await denied.close();console.log('PASS blocked storage remains playable and explains session-only progress',name);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
