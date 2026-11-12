const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:700}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const root=process.env.GAME_URL||'http://127.0.0.1:5501/';
  await page.goto(root,{waitUntil:'networkidle'});
  // Returning to the main menu repeatedly must never stack climate listeners.
  for(let i=0;i<3;i++)await page.locator('.brand').evaluate(el=>el.click());
  await page.locator('#btn-weather-quick').evaluate(el=>el.click());
  const first=await page.evaluate(async()=>{
   const m=await import('/js/weather.mjs');
   return {mode:m.getWeatherMode(),
     toast:document.querySelector('#toast').textContent,
     persisted:localStorage.getItem('chaua-weather-mode')};
  });
  assert.equal(first.mode,'summer','quick weather button did not cycle from auto');
  assert.equal(first.persisted,'summer','selection not saved');
  assert.match(first.toast,/Clima: Sol de Verão/,'quick weather button did not announce choice');
  // A completely unrelated query parameter MUST NOT disable persisted mode.
  await page.goto(root+'?perf-test=1',{waitUntil:'networkidle'});
  const restored=await page.evaluate(async()=>{
   const weather=await import('/js/weather.mjs');
   return {mode:weather.getWeatherMode(),icon:document.querySelector('#btn-weather-quick').textContent};
  });
  assert.equal(restored.mode,'summer','unrelated query ignored saved preference');
  assert.equal(restored.icon,'☀️');
  // Explicit weather selection has precedence over saved choice.
  await page.goto(root+'?perf-test=1&weather=winter',{waitUntil:'networkidle'});
  const overridden=await page.evaluate(async()=>({
   mode:(await import('/js/weather.mjs')).getWeatherMode(),
   selected:document.querySelector('#weather-mode').value
  }));
  assert.equal(overridden.mode,'winter');
  assert.equal(overridden.selected,'winter');
  // Manual storm must not be silently reinterpreted as winter.
  await page.evaluate(async()=>{
   const weather=await import('/js/weather.mjs');
   weather.setWeatherMode('storm');
   const {journeySeason}=await import('/js/seasons.mjs');
   const state=journeySeason({elapsed:260,mode:'aventura',seed:104,distance:28000});
   if(state.to===3&&state.from===3)throw Error('Storm was incorrectly remapped to winter');
   if(weather.journeyStorm({elapsed:260,mode:'aventura',seed:104})!==1)
    throw Error('Manual storm no longer triggers storm weather');
  });
  assert.deepEqual(errors,[],'uncaught UI/audio/weather exception: '+JSON.stringify(errors));
  console.log('WEATHER_UI_REGRESSION '+JSON.stringify({first,restored,overridden,errors}));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
