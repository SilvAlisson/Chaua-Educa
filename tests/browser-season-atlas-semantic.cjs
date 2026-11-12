// A *content-based* atlas regression: checks the actual shipped WebP,
// not just enum constants that could be simultaneously wrong.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const OUT='test-results/season-atlas-semantic';
fs.mkdirSync(OUT,{recursive:true});

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:768}});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const data=await page.evaluate(async()=>{
   const [{loadAssets,images},{SEASON_IDS},{journeySeason},{setWeatherMode}]=await Promise.all([
    import('/js/assets.mjs'),import('/js/climate-timeline.mjs'),
    import('/js/seasons.mjs'),import('/js/weather.mjs')
   ]);
   await loadAssets();
   const atlas=images.get('season-backgrounds');
   if(!atlas)throw Error('Season background WebP was not loaded');
   const w=atlas.naturalWidth,h=atlas.naturalHeight;
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(atlas,0,0);
   const cellW=w/2,cellH=Math.floor(h/2);
   const scores=[];
   for(let id=0;id<4;id++){
    const sx=(id%2)*cellW,sy=id<2?0:h-cellH;
    const {data:rgba,width:pw,height:ph}=ctx.getImageData(sx,sy,cellW,cellH);
    let warm=0,samples=0;
    for(let y=38;y<ph-26;y+=7)for(let x=20;x<pw-20;x+=7){
     const k=(y*pw+x)*4,r=rgba[k],g=rgba[k+1],b=rgba[k+2];
     if(r>g*1.10 && r>b*1.38 && g>b*1.15 && r>85)warm++;
     samples++;
    }
    scores.push(warm/samples);
   }
   setWeatherMode('auto');
   const ids=Object.fromEntries(['spring','summer','autumn','winter'].map(k=>[k,SEASON_IDS[k]]));
   const {climateReferenceSeconds}=await import('/js/climate-progress.mjs');
   return {w,h,warmScores:scores,ids,
    actualSeason:[0,.34,.56,.85].map(progress=>{
     const mode='aventura',seed=104,elapsed=climateReferenceSeconds(mode,seed)*progress;
     return journeySeason({mode,seed,elapsed,distance:28000,score:560}).to;
    })};
  });
  // The original atlas is ordered spring, summer, autumn, winter and
  // autumn is distinctly warmer/redder than summer (verified in actual art).
  assert.deepEqual(data.ids,{spring:0,summer:1,autumn:2,winter:3});
  assert.deepEqual(data.actualSeason,[0,1,2,3]);
  assert.equal(data.w,1672);assert.equal(data.h,941);
  const [spring,summer,autumn,winter]=data.warmScores;
  assert.ok(autumn>summer*2.0 && autumn>spring*1.35,
   'Autumn is no longer the reddish-orange atlas cell: '+JSON.stringify(data.warmScores));
  assert.ok(autumn>winter*2.0,'Winter atlas unexpectedly contains autumn-orange leaves');
  fs.writeFileSync(path.join(OUT,'actual-webp-semantic.json'),JSON.stringify(data,null,2));
  console.log('ATLAS_VISUAL_SEMANTIC '+JSON.stringify(data));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
