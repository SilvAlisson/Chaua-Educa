const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const playwright=require('playwright');
const name=process.env.LEARNING_BROWSER||'chromium';
(async()=>{
 const browser=await playwright[name].launch({executablePath:name==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:name==='chromium'?['--no-sandbox']:[]});
 const out='test-results/learning-107';await fs.mkdir(out,{recursive:true});
 const prepare=async page=>{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  await page.locator('#inputPlayer').fill('Observador');await page.locator('input[name=mode][value=tranquilo]').check();await page.locator('#btnStart:not([disabled])').click();
  return page.evaluate(async()=>{
   const {game:g}=await import('/js/script.js');g.state='playing';g.elapsed=35;g.sceneTime=35;g.nextSpawn=Infinity;g.quizPending=true;g.feather=2;g.pepper=3;g.y=320;g.vy=0;
   g.entities=[{kind:'wood',x:900}];const danger=g.maybeOpenQuiz();g.entities=[];g.y=80;const boundary=g.maybeOpenQuiz();g.y=320;g.vy=200;const falling=g.maybeOpenQuiz();g.vy=0;const safe=g.maybeOpenQuiz();
   return {danger,boundary,falling,safe};
  });
 };
 const snapshot=page=>page.evaluate(async()=>{const {game:g}=await import('/js/script.js');return {elapsed:g.elapsed,sceneTime:g.sceneTime,distance:g.distance,score:g.score,feather:g.feather,pepper:g.pepper,question:g.question.id,pool:[...g.questionPool],answer:g.answerResult};});
 try{
  for(const viewport of [{width:1366,height:768},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   assert.deepEqual(await prepare(page),{danger:false,boundary:false,falling:false,safe:true});
   await page.locator('#quiz-dialog').waitFor({state:'visible'});
   assert.equal(await page.locator('#observation-image').getAttribute('src'),null,'photo must not load during startup');
   await page.locator('#chapter-discovery summary').click();assert.match(await page.locator('#chapter-discovery-text').textContent(),/pétalas/);
   assert.match(await page.locator('#chapter-discovery-source').getAttribute('href'),/^https:\/\/www.gov.br\//);
   const before=await snapshot(page);await page.locator('#open-observation').click();
   await page.locator('#observation-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#observation-image').naturalWidth>0);
   const photo=await page.locator('#observation-image').boundingBox(),marker=await page.locator('.observation-hotspot[data-observation-detail=cabeca]').boundingBox();
   assert.ok(marker.x>=photo.x+photo.width*.75,'head marker must leave the face unobstructed');
   await page.keyboard.press('v');await page.keyboard.press('f');await page.waitForTimeout(200);assert.deepEqual(await snapshot(page),before);
   await page.locator('.observation-hotspot[data-observation-detail=plumagem]').click();assert.match(await page.locator('#observation-detail-title').textContent(),/corpo/);
   const head=page.locator('.observation-choices [data-observation-detail=cabeca]');await head.focus();await page.keyboard.press('Enter');
   assert.match(await page.locator('#observation-detail-text').textContent(),/avermelhada/);assert.equal(await head.getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#observation-detail-source').getAttribute('href'),'https://zoo.df.gov.br/papagaio-chaua');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#observation-dialog').screenshot({path:`${out}/${name}-${viewport.width}-observation.png`});
   await page.keyboard.press('Escape');await page.locator('#quiz-dialog').waitFor({state:'visible'});
   assert.equal(await page.locator('#open-observation').evaluate(e=>e===document.activeElement),true);assert.deepEqual(await snapshot(page),before);
   await page.locator('#open-observation').click();await page.locator('.observation-choices [data-observation-detail=registro]').click();
   assert.equal(await page.locator('#observation-detail-source').isVisible(),false);await page.locator('#observation-return').click();
   const correct=await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');return g.question.answer;});await page.locator(correct?'#answer-true':'#answer-false').click();
   assert.match(await page.locator('#answer-feedback').textContent(),/15\/11\/2026/);assert.equal((await snapshot(page)).score,8);
   await page.locator('#quiz-continue').click();
   for(const stage of [1,2,3]){
    await page.evaluate(async stage=>{const {game:g}=await import('/js/script.js');g.state='playing';g.stage=stage;g.elapsed=Math.max(g.nextQuizAt,90*stage);g.entities=[];g.y=320;g.vy=0;g.quizPending=true;g.maybeOpenQuiz();},stage);
    await page.locator('#quiz-dialog').waitFor({state:'visible'});await page.locator('#chapter-discovery summary').click();
    assert.ok((await page.locator('#chapter-discovery-text').textContent()).length>30);
    await page.locator('#quiz-dialog').screenshot({path:`${out}/${name}-${viewport.width}-chapter-${stage}.png`});
    const answer=await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');return g.question.answer;});await page.locator(answer?'#answer-true':'#answer-false').click();await page.locator('#quiz-continue').click();
   }
   await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');g.end(false,'Encerramento da verificação');});await page.locator('#result-dialog').waitFor({state:'visible'});
   await page.locator('#flight-learning summary').click();assert.match(await page.locator('#flight-learning-items').textContent(),/Conheça o chauá/);
   await page.locator('#restart-button').click();
   assert.deepEqual(await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');return {open:g.observationOpen,details:g.observedDetails,chapters:g.chapterDiscoveries};}),{open:false,details:[],chapters:[]});
   assert.deepEqual(errors,[]);await page.close();console.log('PASS LEARNING 1.0.7',name,viewport);
  }
  const failed=await browser.newPage();await failed.route('**/assets/journal/chaua-portrait.webp',r=>r.abort());await prepare(failed);await failed.locator('#open-observation').click();
  await failed.waitForFunction(()=>document.querySelector('#observation-photo-status').textContent.includes('não carregou'));
  await failed.locator('.observation-choices [data-observation-detail=cabeca]').click();assert.match(await failed.locator('#observation-detail-text').textContent(),/testa/);
  await failed.locator('#observation-return').click();await failed.locator('#quiz-dialog').waitFor({state:'visible'});await failed.close();
  console.log('PASS observation photo failure remains usable',name);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
