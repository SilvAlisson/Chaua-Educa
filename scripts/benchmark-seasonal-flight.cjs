// Benchmark the REAL four-season flight timeline instead of the legacy
// distance-only API. Distance is deliberately saturated at 28,000; only
// active flight time changes between spring, summer, autumn and winter.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const scenes=[['spring',.10,0],['summer',.35,1],['autumn',.56,2],['winter',.85,3]];
(async()=>{
 const browser=await chromium.launch({
  executablePath:process.env.CHROMIUM_PATH||undefined,
  args:['--no-sandbox']
 });
 try{
  const results=[];
  for(const [width,height,mode] of [[1366,638,'aventura'],[390,844,'tranquilo']]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const rows=await page.evaluate(async({mode,scenes})=>{
    const percentile=(a,p)=>{const v=[...a].sort((x,y)=>x-y);return v[Math.floor((v.length-1)*p)];};
    const [{Renderer},{Game},{climateReferenceSeconds},{journeySeason},{journeyRain},{winterAmount}]
      =await Promise.all([
       import('/js/render.mjs'),import('/js/engine.mjs'),
       import('/js/climate-progress.mjs'),import('/js/seasons.mjs'),
       import('/js/weather.mjs'),import('/js/living-motion.mjs')
      ]);
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.replaceChildren(canvas);
    const renderer=new Renderer(canvas);
    await renderer.ready;
    renderer.setQuality('high');
    const game=new Game({seed:104});
    game.state='playing';game.mode=mode;game.y=320;game.stage=3;
    game.stageAge=12;game.distance=28000;game.score=560;
    game.entities=[
     {kind:'wood',id:11,x:410,top:160,bottom:490,variant:'plain',
      fragileSide:'top',fragileKind:'rot',decorSide:'bottom',decorKind:'moss'},
     {kind:'hawk',id:12,x:760,y:260,warning:0,phase:'crossing',dive:false},
     {kind:'fruit',id:13,x:500,y:320,variety:2}
    ];
    const flightReference=climateReferenceSeconds(mode,game.seed);
    const rows=[];
    for(const [name,progress,expectedAtlasId] of scenes){
     const cpu=[],frameIntervals=[];
     let prev=null;
     const startTime=flightReference*progress;
     for(let i=0;i<180;i++){
      const stamp=await new Promise(requestAnimationFrame);
      if(prev!==null)frameIntervals.push(stamp-prev);
      prev=stamp;
      game.elapsed=startTime+i/60;
      game.sceneTime=game.elapsed;
      const start=performance.now();
      renderer.game(game,false);
      cpu.push(performance.now()-start);
      if(renderer.seasonalBackdrop?.frames?.size>2)
       throw Error('season cache exceeds two ready frames');
     }
     const season=journeySeason(game);
     if(season.from!==expectedAtlasId||season.to!==expectedAtlasId)
      throw Error('Expected '+name+' atlas '+expectedAtlasId+' got '+JSON.stringify(season));
     rows.push({
      name,progress,mode,score:game.score,distance:game.distance,
      season:season.to,rain:journeyRain(game),snow:winterAmount(game),
      cpuP50:percentile(cpu,.5),cpuP95:percentile(cpu,.95),
      cpuMax:Math.max(...cpu),frameP95:percentile(frameIntervals,.95),
      over33ms:frameIntervals.filter(ms=>ms>33.34).length,
      frames:frameIntervals.length
     });
    }
    return rows;
   },{mode,scenes});
   assert.deepEqual(errors,[],'browser console errors');
   assert.ok(rows.every(r=>r.score===560&&r.distance===28000),
    'benchmark accidentally relied on score/distance triggers');
   assert.equal(rows.find(r=>r.name==='winter').snow,1);
   assert.ok(rows.find(r=>r.name==='autumn').rain>.7);
   results.push({viewport:{width,height},mode,scenes:rows});
   await page.close();
  }
  fs.mkdirSync('test-results/season-performance',{recursive:true});
  fs.writeFileSync(
   'test-results/season-performance/'+(process.env.PERF_LABEL||'current')+'.json',
   JSON.stringify(results,null,2)
  );
  console.log('REAL_CLIMATE_FRAME_PROFILE '+JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
