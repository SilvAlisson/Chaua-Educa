// A/B regression: the consolidated build removes costly Canvas attack
// placards by default, while the complete visual pipeline remains optional.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  await page.locator('#open-settings').click();
  assert.equal(await page.locator('#show-text-warnings').isChecked(),false,'experimental default must hide text placards');
  await page.locator('#show-text-warnings').check();
  await page.keyboard.press('Escape');
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#open-settings').click();
  assert.equal(await page.locator('#show-text-warnings').isChecked(),true,'toggle must persist');
  await page.locator('#show-text-warnings').uncheck();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chaua-attack-warning-text'))),false);
  const actual=await page.evaluate(async()=>{
   const [{Renderer},{Game}]=await Promise.all([import('/js/render.mjs'),import('/js/engine.mjs')]);
   const canvas=document.createElement('canvas');
   canvas.style.cssText='position:fixed;inset:0;width:844px;height:390px';
   document.body.append(canvas);
   const renderer=new Renderer(canvas);await renderer.ready;renderer.setQuality('high');
   const game=new Game({seed:888});
   game.state='paused';game.elapsed=35;game.sceneTime=35;game.stage=1;game.stageAge=10;game.y=320;
   game.entities=[{id:50,kind:'wood',x:400,top:120,bottom:450,variant:'plain',
     snake:{age:.3,phase:'warning',warningAge:.3,phaseAge:.1}}];
   const text=[];
   const drawText=renderer.c.fillText.bind(renderer.c);
   renderer.c.fillText=(value,...args)=>{text.push(String(value));return drawText(value,...args);};
   renderer.showTextWarnings=false;
   renderer.game(game,false,35);
   const without=text.filter(x=>x.includes('Cobra'));text.length=0;
   renderer.showTextWarnings=true;
   renderer.game(game,false,35);
   const withText=text.filter(x=>x.includes('Cobra'));
   canvas.remove();
   return {without,withText};
  });
  assert.equal(actual.without.length,0,'no visible snake warning text when switch is off');
  assert.ok(actual.withText.length>0,'same scene must retain snake warning text when switch is on');
  assert.deepEqual(errors,[]);
  console.log('PASS text-warning A/B: default hidden, persisted toggle, identical danger scene with labels off/on.');
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
