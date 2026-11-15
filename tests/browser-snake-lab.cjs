const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const OUT='test-results/snake-lab';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const name=process.env.LAB_BROWSER||'chromium';
 const browser=await ({chromium,webkit}[name]).launch(name==='chromium'?{executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']}:{});
 const base=process.env.GAME_URL||'http://127.0.0.1:5501/';
 const reports=[];
 try{
  for(const [vp,viewport] of [['desktop',{width:1200,height:900}],['mobile',{width:390,height:844}]]){
   const page=await browser.newPage({viewport}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'lab-snake-compare.html');
   await page.waitForFunction(()=>window.snakeLab,{timeout:30000});
   for(const type of ['frontal','alto','varredura']){
    for(const [phase,t] of [['watching',.1],['windup',.3],['striking',.2],['recovering',.3],['stunned',.3]]){
     await page.evaluate(([type,phase,t])=>window.snakeLab.seek(type,phase,t),[type,phase,t]);
     await page.waitForFunction(p=>window.snakeLab.snapshot().state.phase===p,phase);
     const f=`${OUT}/${name}-${vp}-${type}-${phase}.png`;
     await page.locator('.stage-grid').screenshot({path:f});
     reports.push({vp,type,phase,file:f});
    }
   }
   await page.check('#showHitbox');await page.check('#showWireframe');
   await page.selectOption('#actorCount','12');
   await page.click('#btnTrigger');await page.waitForTimeout(650);
   await page.screenshot({path:`${OUT}/${name}-${vp}-guides.png`,fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow');
   await page.selectOption('#actorCount','1');await page.uncheck('#showHitbox');await page.uncheck('#showWireframe');
   await page.click('#btnPause');
   await page.locator('#seek').fill('450');await page.locator('#seek').dispatchEvent('input');
   await page.waitForTimeout(50);
   assert.equal(await page.evaluate(()=>window.snakeLab.snapshot().paused),true);
   // An endpoint inspection must not silently show the start pose.
   await page.selectOption('#phaseMode','striking');
   await page.locator('#seek').fill('1000');await page.locator('#seek').dispatchEvent('input');
   await page.waitForTimeout(300);
   assert.equal(await page.locator('#seek').inputValue(),'1000');
   for(const [mode,active,inactive] of [['official',0,1],['rig',1,0]]){
    await page.selectOption('#viewMode',mode);
    await page.waitForFunction(([a,b])=>{const r=window.snakeLab.report();return [r.raw.officialCpuMs,r.raw.rigCpuMs][a].length>=8&&[r.raw.officialCpuMs,r.raw.rigCpuMs][b].length===0;},[active,inactive]);
    const report=await page.evaluate(()=>window.snakeLab.report());
    assert.equal(report.settings.viewMode,mode);
    assert.ok(report.pageIntervalsMs.count>0);
    assert.equal(await page.locator(active?'#canvasArt':'#canvasA2').isVisible(),true);
    assert.equal(await page.locator(inactive?'#canvasArt':'#canvasA2').isVisible(),false);
   }
   const downloadEvent=page.waitForEvent('download');
   await page.click('#btnExport');const download=await downloadEvent;
   const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
   assert.equal(exported.settings.viewMode,'rig');assert.ok(exported.raw.rigCpuMs.length>0);
   assert.equal(exported.cpuMs.official.median,null);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  const reduced=await browser.newPage({reducedMotion:'reduce'});
  await reduced.goto(base+'lab-snake-compare.html');await reduced.waitForFunction(()=>window.snakeLab);
  assert.equal(await reduced.evaluate(()=>window.snakeLab.snapshot().paused),true);
  assert.equal(await reduced.isChecked('#reduced'),true);await reduced.close();
  const failed=await browser.newPage();
  await failed.route('**/experimental/rig-parts.webp',r=>r.fulfill({status:404,body:''}));
  await failed.goto(base+'lab-snake-compare.html');
  await failed.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Falha ao carregar:'));
  await failed.close();
  fs.writeFileSync(`${OUT}/${name}-report.json`,JSON.stringify({screenshots:reports.length,reducedMotion:true,assetFailure:true,errors:0,reports},null,2));
  console.log('SNAKE_LAB_QA',name,reports.length,'frames, responsive controls and graceful asset failure passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
