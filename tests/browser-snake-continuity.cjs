// Browser regression for the ONLY production snake implementation: official A2.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:640}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const checks=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs');
   const {advanceSnake}=await import('/js/animals.mjs');
   const {isSnakeA2Ready,snakeA2Pose,snakeA2HeadRect,snakeA2CollisionRects}=await import('/js/snake-a2.mjs');
   const canvas=document.createElement('canvas');
   canvas.width=960;canvas.height=640;
   canvas.style.cssText='position:fixed;inset:0;width:960px;height:640px';
   document.body.replaceChildren(canvas);
   const r=new Renderer(canvas);
   await r.ready;
   if(!isSnakeA2Ready())throw Error('Official A2 art failed to load');
   const ctx=r.c, original=ctx.drawImage.bind(ctx);
   let draws=0,legacy=0,wrongImage=0,nonA2Frames=0,opaque=0;
   ctx.drawImage=function(img,...args){
    draws++;
    const src=img.src||'';
    if(/\/assets\/v[678]\/(?:snake|snake-wrap)/.test(src))legacy++;
    if(!/\/public\/snake\/(?:base|attack|reactions)\//.test(src))wrongImage++;
    if(args.length!==8||args[2]!==384||args[3]!==384)nonA2Frames++;
    return original(img,...args);
   };
   const wood={id:11,kind:'wood',x:400,top:130,bottom:460,variant:'plain',snake:{age:0}};
   const phases=new Set(),sheets=new Set();let maxDraws=0,frames=0,validHeads=0;
   for(let i=0;i<410;i++){
    advanceSnake(wood,1/120,300);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,960,640);
    const before=draws;
    r.snake(wood,false,0,0,i/120,false);
    const frameDraws=draws-before;maxDraws=Math.max(maxDraws,frameDraws);
    const pose=snakeA2Pose(wood.snake,false);
    phases.add(pose.state);sheets.add(pose.key);
    const rects=snakeA2CollisionRects(wood,false),head=snakeA2HeadRect(wood,false);
    if(!head||head.w<=0||head.h<=0||rects.length<10)
     throw Error('A2 collision/head shape vanished during flight: '+pose.state);
    validHeads++;
    if(i%32===0){
     // Inspect the full raster: the A2 animation and mirror can move outside a fixed crop.
     // This still fails when the canvas is completely transparent.
     const p=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data;
     if(p.some((v,j)=>j%4===3&&v>0))opaque++;
    }
    frames++;
   }
   // Shield stun uses the original authored A2 reaction sheet, not legacy art.
   wood.snake={phase:'retreat',retreat:true,dazed:true,retreatTime:1.2,age:5};
   ctx.clearRect(0,0,960,640);
   const before=draws;r.snake(wood,false,0,0,5,false);
   const stun=snakeA2Pose(wood.snake);
   return {frames,draws,legacy,wrongImage,nonA2Frames,maxDraws,validHeads,opaque,
    phases:[...phases],sheets:[...sheets],stun,stunDraws:draws-before};
  });
  assert.equal(checks.frames,410);
  assert.equal(checks.draws,411,'A snake must be drawn once per frame; no duplicate head or body');
  assert.equal(checks.legacy,0,'Old v6/v7/v8 snake artwork must never render');
  assert.equal(checks.wrongImage,0,'Unexpected sprite source');
  assert.equal(checks.nonA2Frames,0,'Wrong A2 frame dimensions');
  assert.equal(checks.maxDraws,1);
  assert.equal(checks.stunDraws,1);
  assert.equal(checks.validHeads,410);
  assert.ok(checks.opaque>=8,'The illustrated snake must remain visible during the sequence');
  for(const p of ['alert','windup','strike','recover'])
   assert.ok(checks.phases.includes(p),'Missing playable snake state: '+p);
  assert.ok(checks.sheets.includes('attack'));
  assert.equal(checks.stun.key,'stunned');
  assert.deepEqual(errors,[]);
  if(process.env.CAPTURE_DEMO){
   const dest=path.resolve(process.env.CAPTURE_DEMO);fs.mkdirSync(path.dirname(dest),{recursive:true});
   await page.screenshot({path:dest.replace(/\.webm$/i,'.png')});
  }
  console.log('PASS A2 continuity: one official sprite per frame, no historic fallback, all phases and collision shapes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
