// Integration QA for a single active snake: A2. Bird/hawk action sprites remain independent.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const OUT='test-results/v2-action-integration';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
 for(const viewport of [{width:1200,height:720},{width:390,height:844}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const result=await page.evaluate(async()=>{
   const {Renderer,drawBird}=await import('/js/render.mjs');
   const {isSnakeA2Ready,snakeA2Pose}=await import('/js/snake-a2.mjs');
   const {hasActionSheet}=await import('/js/action-sheets.mjs');
   const cv=document.createElement('canvas');
   cv.width=innerWidth;cv.height=innerHeight;
   document.body.replaceChildren(cv);
   const r=new Renderer(cv);await r.ready;
   const ctx=r.c,read=()=>{const d=ctx.getImageData(0,0,cv.width,cv.height).data;let h=2166136261;
    for(let i=0;i<d.length;i++)h=Math.imul(h^d[i],16777619)>>>0;return h;};
   const states={
    watching:{phase:'watching',age:3},
    windup:{phase:'windup',phaseAge:.23,age:4},
    striking:{phase:'striking',phaseAge:.13,age:5},
    stunned:{phase:'retreat',retreat:true,dazed:true,retreatTime:.45,age:7}
   };
   const renderSnake=(snake)=>{
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
    const wood={id:77,kind:'wood',x:Math.min(280,innerWidth*.37),
      top:65,bottom:Math.min(540,innerHeight*.66),snake};
    r.snake(wood,false);
    return {hash:read(),pose:snakeA2Pose(snake)};
   };
   const results=Object.fromEntries(Object.entries(states).map(([k,v])=>[k,renderSnake(v)]));
   const bird=(age,reduced)=>{
    ctx.clearRect(0,0,cv.width,cv.height);
    drawBird(ctx,{x:innerWidth*.65,y:innerHeight*.25,scale:1.04,time:5.2,wing:.7,
      shieldHitAge:age,reduced});
    return read();
   };
   return {ready:isSnakeA2Ready(),action:hasActionSheet('parrot-flight'),
    results,originalBird:bird(null,false),shieldBird:bird(.06,false),
    reducedOriginal:bird(null,true),reducedShield:bird(.06,true)};
  });
  assert.equal(result.ready,true);
  assert.equal(result.action,true);
  const hashes=Object.values(result.results).map(v=>v.hash);
  assert.equal(new Set(hashes).size,4,'A2 poses are not visually distinct');
  assert.equal(result.results.stunned.pose.key,'stunned');
  assert.equal(result.results.striking.pose.key,'attack');
  assert.notEqual(result.shieldBird,result.originalBird,'Parrot shield contact is invisible');
  assert.equal(result.reducedShield,result.reducedOriginal,'Reduced motion unexpectedly changed the bird');
  assert.deepEqual(errors,[]);
  const file=path.join(OUT,viewport.width+'-official-a2.png');
  await page.screenshot({path:file});
  console.log('PASS OFFICIAL_A2_INTEGRATION '+JSON.stringify({viewport,poses:result.results,file}));
  await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
