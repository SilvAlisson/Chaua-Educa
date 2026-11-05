const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out='test-results/snake-diff';fs.mkdirSync(out,{recursive:true});
const original=fs.readFileSync('tests/fixtures/snake-render-original.mjs','utf8');
const optimized=fs.readFileSync('Chaua-Educa-main/js/snake-render.mjs','utf8');
const start=optimized.indexOf(' const flickCycle='),end=optimized.indexOf('\n}\n\nconst fallbackCache',start);
const a=original.indexOf(' if(pose.mouth>0){'),b=original.indexOf('\n}\n\nlet surface;',a);
assert.ok([start,end,a,b].every(n=>n>=0),'Cannot isolate cosmetic changes');
const optimizedWithoutNewArt=optimized.slice(0,start)+original.slice(a,b)+optimized.slice(end);

(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{
 const rows=[];
 for(const [viewName,view] of [['desktop',{width:960,height:640}],['mobile',{width:390,height:844}]]){
  const page=await browser.newPage({viewport:view,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.route('**/js/snake-render-baseline.mjs',r=>r.fulfill({contentType:'text/javascript',body:original}));
  await page.route('**/js/snake-render-no-art.mjs',r=>r.fulfill({contentType:'text/javascript',body:optimizedWithoutNewArt}));
  await page.goto('http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const result=await page.evaluate(async()=>{
   const {loadAssets,images}=await import('/js/assets.mjs');
   const baseline=(await import('/js/snake-render-baseline.mjs')).drawContinuousSnake;
   const noArt=(await import('/js/snake-render-no-art.mjs')).drawContinuousSnake;
   const current=(await import('/js/snake-render.mjs')).drawContinuousSnake;
   await loadAssets();const img=images.get('snake-atlas');
   const phases=[
      {phase:'watching',age:0},{phase:'watching',age:8},
      {phase:'warning',warningAge:0,age:3},
      {phase:'warning',warningAge:.3,age:3.3},
      {phase:'warning',warningAge:.65,age:3.65},
      {phase:'windup',phaseAge:.1,age:4},
      {phase:'windup',phaseAge:.35,age:4.25},
      {phase:'striking',phaseAge:.03,age:4.5},
      {phase:'striking',phaseAge:.14,age:4.6},
      {phase:'recovering',phaseAge:.15,age:4.9},
      {phase:'recovering',phaseAge:.4,age:5.2},
      {phase:'spent',age:8},{phase:'leaving',age:9},
      {phase:'spent',age:10,retreat:true,retreatTime:.4,retreatPose:{x:-4,y:0,angle:0,mouth:0}}
   ],positions=[{x:200,y:300,scale:1},{x:171.35,y:268.65,scale:1.2}];
   const make=()=>{const cv=document.createElement('canvas');cv.width=cv.height=400;return {cv,c:cv.getContext('2d',{willReadFrequently:true})};};
   const panels=[make(),make(),make()];
   const variants=[baseline,noArt,current];
   const buckets={
     original_vs_cache:{changedChannels:0,changedPixels:0,maxChannelDelta:0,byPhase:[]},
     cache_vs_art:{changedChannels:0,changedPixels:0,maxChannelDelta:0,byPhase:[]},
     original_vs_current:{changedChannels:0,changedPixels:0,maxChannelDelta:0,byPhase:[]}
   };
   const screenshots={};
   for(const reduced of [false,true])for(const pos of positions)for(const s of phases){
    for(let idx=0;idx<3;idx++){
      const p=panels[idx],c=p.c;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,400,400);
      c.translate(pos.x,pos.y);c.scale(pos.scale,pos.scale);
      variants[idx](c,img,{...s},.52,reduced);
    }
    const pix=panels.map(p=>p.c.getImageData(0,0,400,400).data);
    function diff(i,j,bucket){
      const d=buckets[bucket];let changed=0,pixels=0,max=0;
      for(let offset=0;offset<pix[i].length;offset+=4){
        let change=false;
        for(let k=0;k<4;k++){const n=Math.abs(pix[i][offset+k]-pix[j][offset+k]);if(n){changed++;change=true;max=Math.max(max,n);}}
        if(change)pixels++;
      }
      d.changedChannels+=changed;d.changedPixels+=pixels;
      d.maxChannelDelta=Math.max(d.maxChannelDelta,max);
      if(changed)d.byPhase.push({phase:s.phase,age:s.age,phaseAge:s.phaseAge,reduced,pos,channels:changed,pixels,max});
    }
    diff(0,1,'original_vs_cache');
    diff(1,2,'cache_vs_art');
    diff(0,2,'original_vs_current');
    if(!reduced&&pos.scale===1&&
       ((s.phase==='watching'&&s.age===0)||(s.phase==='striking'&&s.phaseAge===.14))){
       const key=s.phase;
       for(let i=0;i<3;i++)screenshots[key+'_'+['baseline','noart','current'][i]]=panels[i].cv.toDataURL('image/png').split(',')[1];
       const ds=make();const c=ds.c;const a=pix[0],b=pix[2],dst=c.createImageData(400,400);
       for(let n=0;n<a.length;n+=4){
          const changed=Array.from({length:4},(_,i)=>Math.abs(a[n+i]-b[n+i])).reduce((x,y)=>Math.max(x,y),0);
          dst.data[n]=Math.min(255,changed*4);dst.data[n+1]=0;dst.data[n+2]=Math.min(255,changed*3);dst.data[n+3]=changed>0?255:0;
       }
       c.putImageData(dst,0,0);
       screenshots[key+'_difference']=ds.cv.toDataURL('image/png').split(',')[1];
    }
   }
   return {buckets,images:screenshots,checked:phases.length*positions.length*2};
  });
  assert.deepEqual(errors,[]);
  for(const [name,b64] of Object.entries(result.images))
   fs.writeFileSync(path.join(out,viewName+'_'+name+'.png'),Buffer.from(b64,'base64'));
  delete result.images;rows.push({viewport:viewName,...result});
  console.log('SNAKE_DIFF '+JSON.stringify({viewport:viewName,checked:result.checked,
    original_vs_cache:{channels:result.buckets.original_vs_cache.changedChannels,pixels:result.buckets.original_vs_cache.changedPixels},
    cache_vs_art:{channels:result.buckets.cache_vs_art.changedChannels,pixels:result.buckets.cache_vs_art.changedPixels},
    original_vs_current:{channels:result.buckets.original_vs_current.changedChannels,pixels:result.buckets.original_vs_current.changedPixels}}));
  await page.close();
 }
 fs.writeFileSync(path.join(out,'analysis.json'),JSON.stringify(rows,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
