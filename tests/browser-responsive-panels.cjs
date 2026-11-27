// Verify real geometry and hit targets, including desktop windows like the report.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),playwright=require('playwright');
const name=process.env.PANEL_BROWSER||'chromium';
(async()=>{
 const browser=await playwright[name].launch({executablePath:name==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:name==='chromium'?['--no-sandbox']:[]});
 const out='test-results/responsive-panels';await fs.mkdir(out,{recursive:true});
 try{
  for(const [width,height,mobile] of [[1366,768,false],[1280,575,false],[1024,576,false],[640,384,false],[320,568,true],[390,844,true],[844,390,true],[568,320,true]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile&&name!=='firefox',reducedMotion:'reduce',...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36'}:{})});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{Element.prototype.requestFullscreen=async()=>{throw Error('unsupported');};});
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});await page.locator('#start-training:not([disabled])').waitFor();
   await page.evaluate(()=>document.fonts.ready);await page.locator('#inputPlayer').fill('Responsivo');
   await page.evaluate(async()=>{const {default:DB}=await import('/js/database.js');DB.discoverEntries(['chaua','habitat','alimentos','arvores','fauna','conservacao','fantasia']);for(let i=0;i<24;i++)DB.upsertPlayerScore('Aventureiro '+i,600-i,'aventura');});
   const target=async selector=>{
    const info=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),d=e.closest('dialog'),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,hit:hit===e||e.contains(hit),dialog:d.id};});
    assert.ok(info.x>=0&&info.y>=0&&info.right<=width+1&&info.bottom<=height+1,selector+' outside viewport '+JSON.stringify(info));
    assert.ok(info.h>=43&&info.w>=43,selector+' small target '+JSON.stringify(info));assert.equal(info.hit,true,selector+' obscured '+JSON.stringify(info));
   };
   const panel=async(id,actions)=>{
    const d=page.locator(id);await d.waitFor({state:'visible'});
    const geometry=await d.evaluate(d=>{const body=d.querySelector('.panel-body');return {w:d.clientWidth,sw:d.scrollWidth,h:d.clientHeight,sh:d.scrollHeight,bodyW:body.clientWidth,bodySW:body.scrollWidth,bodyH:body.clientHeight};});
    assert.ok(geometry.sw<=geometry.w+1&&geometry.bodySW<=geometry.bodyW+1,'Horizontal scroll '+id+' '+JSON.stringify({width,height,geometry}));
    assert.ok(geometry.sh<=geometry.h+1,'Outer panel must not scroll '+id+' '+JSON.stringify(geometry));assert.ok(geometry.bodyH>=40,'No usable reading area '+id+' '+JSON.stringify(geometry));
    for(const a of actions)await target(a);
    const body=d.locator(':scope > .panel-layout > .panel-body');await body.evaluate(e=>e.scrollTop=e.scrollHeight);
    for(const a of actions)await target(a);
    await body.evaluate(e=>e.scrollTop=0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    return geometry;
   };
   for(const [button,id] of [['#open-settings','#settings-dialog'],['#open-guide','#guide-dialog'],['#open-ranking','#ranking-dialog'],['#open-missions','#missions-dialog'],['#open-credits','#credits-dialog'],['#open-collection','#collection-dialog']]){
    await page.locator(button).click();const actions=[id+' .panel-heading-area .close-dialog'];if(['#settings-dialog','#guide-dialog'].includes(id))actions.push(id+' .panel-actions .primary');
    await panel(id,actions);await page.locator(id).screenshot({path:`${out}/${name}-${width}x${height}-${id.slice(1)}.png`});
    if(id==='#credits-dialog'){await page.locator('#open-beta-about').click();await panel('#beta-dialog',['#beta-start','#beta-download','#beta-dialog .panel-heading-area .close-dialog']);await page.locator('#beta-dialog').screenshot({path:`${out}/${name}-${width}x${height}-beta.png`});await page.locator('#beta-dialog .panel-heading-area .close-dialog').click();}
    if(id==='#collection-dialog'){
     await page.locator('.journal-card').filter({has:page.locator('.visual-conservacao')}).locator('.journal-open').click();await target('#collection-dialog .panel-heading-area .close-dialog');
     assert.equal(await page.locator('#collection-dialog .panel-body').evaluate(e=>e.scrollTop),0);await page.locator('.journal-back').click();
    }
    await page.locator(id+' .panel-heading-area .close-dialog').click();
   }
   await page.locator('label:has(input[name=mode][value=tranquilo])').click();assert.equal(await page.locator('input[name=mode][value=tranquilo]').isChecked(),true);await page.locator('#btnStart').click();await page.waitForFunction(()=>document.querySelector('#app').classList.contains('in-flight'));
   await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');g.state='playing';g.entities=[];g.nextSpawn=Infinity;g.elapsed=35;g.y=320;g.vy=0;g.quizPending=true;g.maybeOpenQuiz();const {QUESTIONS}=await import('/js/questions.mjs');g.question=QUESTIONS.reduce((a,b)=>a.text.length>b.text.length?a:b);});
   await panel('#quiz-dialog',['#answer-true','#answer-false','#open-observation']);
   const question=await page.locator('#question-text').evaluate(e=>{const r=e.getBoundingClientRect(),b=e.closest('.panel-body').getBoundingClientRect();return {top:r.top,bottom:r.bottom,bodyTop:b.top,bodyBottom:b.bottom};});
   assert.ok(question.top>=question.bodyTop-1&&question.bottom<=question.bodyBottom+1,'Initial question should be readable without scroll '+JSON.stringify({width,height,question}));
   await page.locator('#quiz-dialog').screenshot({path:`${out}/${name}-${width}x${height}-quiz.png`});await page.locator('#chapter-discovery summary').click();await panel('#quiz-dialog',['#answer-true','#answer-false','#open-observation']);
   await page.locator('#open-observation').click();await page.waitForFunction(()=>document.querySelector('#observation-image').naturalWidth>0);await panel('#observation-dialog',['#observation-close','#observation-return']);
   await page.locator('.observation-choices [data-observation-detail=cabeca]').click();await panel('#observation-dialog',['#observation-close','#observation-return']);await page.locator('#observation-dialog').screenshot({path:`${out}/${name}-${width}x${height}-observation.png`});
   await page.keyboard.press('Escape');await page.locator('#quiz-dialog').waitFor({state:'visible'});
   const answer=await page.evaluate(async()=>(await import('/js/script.js')).game.question.answer);await page.locator(answer?'#answer-true':'#answer-false').click();await panel('#quiz-dialog',['#quiz-continue']);
   const text=await page.locator('#answer-feedback').textContent();assert.ok(text.length>50);await page.locator('#quiz-dialog').screenshot({path:`${out}/${name}-${width}x${height}-feedback.png`});
   await page.locator('#quiz-continue').click();await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');g.state='playing';g.end(false,'Você encostou na cobra do galho.');});
   await panel('#result-dialog',['#restart-button','#result-ranking','#result-missions','#result-dialog .back-home']);await page.locator('#result-dialog').screenshot({path:`${out}/${name}-${width}x${height}-result.png`});
   await page.locator('#restart-button').click();await page.waitForFunction(()=>document.querySelector('#app').dataset.state==='countdown'&&!document.querySelector('#result-dialog').open);await page.evaluate(async()=>{const {game:g}=await import('/js/script.js');g.state='trained';});await panel('#training-dialog',['#training-home','#training-again']);await page.locator('#training-home').click();
   assert.deepEqual(errors,[]);await context.close();console.log('PASS RESPONSIVE PANELS',name,{width,height,mobile});
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
