const playwright=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const engine=process.env.UI_BROWSER||'chromium';
(async()=>{
 const browser=await playwright[engine].launch({executablePath:engine==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:engine==='chromium'?['--no-sandbox']:[]});
 try{
  for(const viewport of [{width:1366,height:900},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.locator('#start-training:not([disabled])').waitFor();await page.evaluate(()=>document.fonts.ready);
   await page.locator('#inputPlayer').fill('Caderno da mata');
   await page.evaluate(async()=>{
    const {default:DB}=await import('/js/database.js'),{FOODS}=await import('/js/foods.mjs');
    DB.discoverEntries(['chaua','habitat','alimentos','arvores','fauna','conservacao','fantasia']);for(const f of FOODS)DB.unlock(f.id);
    DB.upsertPlayerScore('Caderno da mata',742,'aventura');DB.upsertPlayerScore('Asas livres',550,'aventura');
    DB.advanceMissions('Caderno da mata',{type:'win'});DB.advanceMissions('Caderno da mata',{type:'stage',stage:2});
   });
   await fs.mkdir('test-results/editorial-ui',{recursive:true});
   for(const [button,dialog,name]of [['#open-ranking','#ranking-dialog','ranking'],['#open-missions','#missions-dialog','missions'],['#open-guide','#guide-dialog','guide'],['#open-collection','#collection-dialog','journal']]){
    await page.locator(button).click();await page.locator(dialog).waitFor({state:'visible'});
    if(name==='journal'){
     await page.locator('.journal-intro img').evaluate(async img=>img.decode());
     const art=await page.locator(dialog).evaluate(d=>({canvases:d.querySelectorAll('canvas').length,paths:[...d.querySelectorAll('img')].map(im=>im.getAttribute('src')),text:d.textContent}));
     assert.equal(art.canvases,0,'encyclopedia must not repaint gameplay sprites');
     assert.ok(art.paths.length>=2&&art.paths.every(p=>p.startsWith('assets/journal/')));
     const overlap=await page.locator('.journal-art').evaluateAll(arts=>arts.filter(a=>!a.querySelector('img')).some(a=>a.querySelector('.journal-visual > span').getBoundingClientRect().top<a.querySelector('.journal-state').getBoundingClientRect().bottom));
     assert.equal(overlap,false,'discovery badge overlaps factual heading');
     assert.ok(art.text.includes('Vulnerável')&&art.text.includes('2026')&&art.text.includes('CC BY 2.0'));
     await page.locator('#journal-food-tab').click();assert.equal(await page.locator('#collection-items canvas').count(),0);assert.equal(await page.locator('#collection-items .journal-food').count(),12);
     await page.locator('#journal-nature-tab').click();
     await page.locator('.visual-conservacao').scrollIntoViewIfNeeded();
     await page.locator('.journal-card').filter({has:page.locator('.visual-conservacao')}).locator('button').click();
     assert.ok((await page.locator('.journal-reading').textContent()).includes('4.607'));
     await page.locator('.journal-back').click();await page.locator(dialog).evaluate(d=>d.scrollTop=0);
    }
    await page.locator(dialog).screenshot({path:`test-results/editorial-ui/${engine}-${viewport.width}-${name}.png`});
    assert.ok(await page.locator(dialog).evaluate(d=>d.scrollWidth<=d.clientWidth+1),'Dialog scrolls horizontally: '+dialog);
    const box=await page.locator(dialog).boundingBox();assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);
    await page.locator(dialog).evaluate(d=>d.close());
   }
   await page.locator('#btnStart').click();await page.waitForFunction(()=>document.querySelector('#app').classList.contains('in-flight'));
   await page.evaluate(async()=>{const {game}=await import('/js/script.js');const {journeyLength}=await import('/js/journey.mjs');game.state='playing';game.elapsed=320;game.distance=journeyLength(game.mode)*.94;game.stage=3;game.score=942;game.fruits=177;game.correct=20;game.endCause='quiz';game.end(false,'Um novo voo começa com o que você aprendeu.');});
   await page.locator('#result-dialog').waitFor({state:'visible'});
   await page.locator('#result-dialog').screenshot({path:`test-results/editorial-ui/${engine}-${viewport.width}-result.png`});
   assert.ok((await page.locator('#result-mode').textContent()).includes('Voo de resistência'));
   assert.deepEqual(errors,[]);console.log('PASS EDITORIAL UI',engine,viewport);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
