const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const output='test-results/original-art';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:1200,height:720},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:1}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const result=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {images}=await import('/js/assets.mjs');
    const {drawContinuousSnake,snakeMeshStats}=await import('/js/snake-render.mjs');
    const {parrotShieldVisual,hawkDazeVisual,snakeDazeVisual}=await import('/js/secondary-motion.mjs');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:9999';
    document.body.replaceChildren(canvas);
    const r=new Renderer(canvas);await r.ready;
    const makeState=()=>{
     const g=new Game({seed:4141,onEvent:()=>{}});g.start('aventura',[],4141);
     g.state='paused';g.y=298;g.angle=0;g.elapsed=35;g.sceneTime=35;g.stage=1;g.stageAge=15;
     g.shield=true;g.invincible=0;g.entities=[
      {kind:'wood',id:77,x:415,top:140,bottom:430,variant:'branch',snake:{kind:'snake',phase:'watching',age:1.5,retreat:false}},
      {kind:'hawk',id:82,x:740,y:295,startX:850,startY:295,targetX:160,targetY:295,phase:'crossing',warning:0,age:1.2,dive:false}
     ];
     return g;
    };
    const scenarios=[
     ['snake-alert',g=>{g.entities[0].snake.phase='warning';g.entities[0].snake.warningAge=.65;}],
     ['snake-strike',g=>{g.entities[0].snake.phase='striking';g.entities[0].snake.phaseAge=.14;g.entities[0].snake.age=4.6;}],
     ['snake-stunned',g=>{const s=g.entities[0].snake;s.phase='retreat';s.retreat=true;s.dazed=true;s.retreatTime=.28;s.retreatPose={x:0,y:0,angle:0,mouth:0};}],
     ['hawk-stunned',g=>{const e=g.entities[1];e.phase='retreat';e.retreat=true;e.dazed=true;e.harmless=true;e.retreatTime=.28;}],
     ['shield-impact',g=>{g.invincible=3;g.hit={id:77,age:.08};}]
    ];
    window.__animationPreview={r,makeState,scenarios};
    const img=images.get('snake-atlas');
    const a=document.createElement('canvas');a.width=400;a.height=400;
    const c=a.getContext('2d',{willReadFrequently:true});
    const initial={phase:'spent',age:.1,phaseAge:.02};
    const poseOne={...initial},poseTwo={...initial,phaseAge:.23};
    const before=snakeMeshStats();
    const pixels=state=>{
      c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,400,400);
      c.translate(200,200);drawContinuousSnake(c,img,state,.52,false,987654);
      return c.getImageData(0,0,400,400).data;
    };
    const first=pixels(poseOne),middle=snakeMeshStats(),second=pixels(poseTwo),after=snakeMeshStats();
    let tongueDelta=0;
    for(let i=0;i<first.length;i++)if(first[i]!==second[i])tongueDelta++;
    return {tongueDelta,firstMeshRenders:middle.meshRenders-before.meshRenders,
      secondMeshRenders:after.meshRenders-middle.meshRenders,cache:after,
      neutralParrot:parrotShieldVisual(.31),
      neutralHawk:hawkDazeVisual(2),neutralSnake:snakeDazeVisual(2),
      sourceSnakeDimensions:[img.naturalWidth,img.naturalHeight],
      sourceHawkDimensions:[images.get('hawk-atlas').naturalWidth,images.get('hawk-atlas').naturalHeight],
      sourceParrotDimensions:[images.get('chaua-atlas').naturalWidth,images.get('chaua-atlas').naturalHeight]};
   });
   assert.equal(result.tongueDelta,0,'no procedural tongue remains when snake pose is unchanged');
   assert.equal(result.firstMeshRenders,1,'one mesh rasterization for the initial pose');
   assert.equal(result.secondMeshRenders,0,'stable host-id mesh is reused');
   assert.ok(result.cache.cacheEntries<=6,'bounded offscreen texture cache');
   assert.deepEqual(result.neutralParrot,{x:0,y:0,angle:0});
   assert.deepEqual(result.neutralHawk,{x:0,y:0,angle:0,stars:0});
   assert.deepEqual(result.neutralSnake,{x:0,y:0,angle:0,stars:0});
   for(const [name] of [['snake-alert'],['snake-strike'],['snake-stunned'],['hawk-stunned'],['shield-impact']]){
    await page.evaluate(name=>{
     const {r,makeState,scenarios}=window.__animationPreview;
     const g=makeState();scenarios.find(s=>s[0]===name)[1](g);
     r.game(g,false,35);
    },name);
    await page.screenshot({path:path.join(output,name+'-'+viewport.width+'.png')});
   }
   assert.deepEqual(errors,[]);
   console.log('ORIGINAL_ART_QA '+JSON.stringify({viewport,...result,scenarios:5}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
