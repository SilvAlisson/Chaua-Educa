// Pixel-perfect regression of the original snake silhouette and mouth: no duplicate teeth/tongue overlays in the candidate renderer.
// The pinned baseline is routed under /js/ so its relative imports resolve.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const results=[];
  for(const viewport of [{width:960,height:640},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.route('**/js/snake-render-baseline.mjs',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('tests/fixtures/snake-render-original.mjs','utf8')}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const result=await page.evaluate(async()=>{
    const {loadAssets,images}=await import('/js/assets.mjs');
    const {drawContinuousSnake:optimized}=await import('/js/snake-render.mjs');
    const {drawContinuousSnake:baseline}=await import('/js/snake-render-baseline.mjs');
    await loadAssets();
    const image=images.get('snake-atlas');
    if(!image)throw Error('Snake atlas missing');
    const make=()=>{
     const canvas=document.createElement('canvas');canvas.width=canvas.height=400;
     return {canvas,c:canvas.getContext('2d',{willReadFrequently:true})};
    };
    const a=make(),b=make(),phases=[
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
      {phase:'spent',age:8},
      {phase:'leaving',age:9},
      {phase:'spent',age:10,retreat:true,retreatTime:.4,retreatPose:{x:-4,y:0,angle:0,mouth:0}}
    ];
    const positions=[{x:200,y:300,scale:1},{x:171.35,y:268.65,scale:1.2}];
    let frames=0,totalChanged=0,maxChannelDelta=0,maxChangedPixels=0;
    const cases=[];
    for(const reduced of [false,true])for(const pos of positions)for(const s of phases){
     for(const item of [a,b]){
      const c=item.c;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,400,400);
      c.translate(pos.x,pos.y);c.scale(pos.scale,pos.scale);
     }
     baseline(a.c,image,s,.52,reduced);
     optimized(b.c,image,s,.52,reduced);
     const first=a.c.getImageData(0,0,400,400).data;
     const next=b.c.getImageData(0,0,400,400).data;
     let changed=0,max=0;
     for(let i=0;i<first.length;i++){
      const delta=Math.abs(first[i]-next[i]);
      if(delta){changed++;max=Math.max(max,delta);}
     }
     frames++;totalChanged+=changed;maxChangedPixels=Math.max(maxChangedPixels,changed);maxChannelDelta=Math.max(maxChannelDelta,max);
     if(changed)cases.push({phase:s.phase,reduced,position:pos,changedChannels:changed,maxChannelDelta:max});
    }
    return {frames,totalChanged,maxChangedPixels,maxChannelDelta,changedCases:cases.slice(0,16)};
   });
   assert.deepEqual(errors,[]);
   assert.equal(result.totalChanged,0,'optimized snake changed pixels; investigate before approval: '+JSON.stringify(result));
   results.push({viewport,...result});
   await page.close();
  }
  console.log('PASS snake 56-frame exact parity with original authored snake and open-mouth frames '+JSON.stringify(results));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
