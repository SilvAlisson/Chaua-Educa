// Exercise actual A2 WebP masks, fruit spawns and the 120 Hz collision path.
// GitHub Actions starts the same static HTTP server used by other browser tests.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:1200,height:720},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
   await page.goto((process.env.GAME_URL||'http://127.0.0.1:5501/'),{waitUntil:'domcontentloaded'});
   const result=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game,STEP}=await import('/js/engine.mjs');
    const {snakePlacement}=await import('/js/snake-a2.mjs');
    const {playerShapes}=await import('/js/collision.mjs');
    const {isSnakeA2Ready,drawSnakeA2,snakeA2HitsPlayer,snakeA2FruitHasClearance,placeA2Fruit}=await import('/js/snake-a2.mjs');
    const scratch=document.createElement('canvas');scratch.width=scratch.height=100;
    await new Renderer(scratch).ready;
    if(!isSnakeA2Ready())return {error:'A2 artwork or alpha masks unavailable'};
    const wood={id:44,kind:'wood',x:210,top:115,bottom:465,snake:{phase:'watching',age:2}};
    const canvas=document.createElement('canvas');canvas.width=650;canvas.height=640;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const states=[
     {phase:'watching',age:0},{phase:'watching',age:2},{phase:'warning',warningAge:.5},
     {phase:'windup',phaseAge:.05},{phase:'windup',phaseAge:.37},
     {phase:'striking',phaseAge:.03},{phase:'striking',phaseAge:.18},
     {phase:'recovering',phaseAge:.12},{phase:'recovering',phaseAge:.56}
    ];
    let samples=0,missed=0;
    for(const state of states){
     wood.snake=state;
     const p=snakePlacement(wood);
     ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
     ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.facing,1);
     if(!drawSnakeA2(ctx,state,p.factor))throw Error('WebP not drawn');
     ctx.restore();
     const pixels=ctx.getImageData(0,0,650,640).data;
     for(let y=wood.bottom-150;y<=wood.bottom-35;y+=6)for(let x=wood.x-68;x<=wood.x+92;x+=6){
      if(pixels[(y*650+x)*4+3]<192)continue;
      samples++;
      const bird=playerShapes(x,y),hit=snakeA2HitsPlayer(wood,bird);
      if(!hit)missed++;
     }
    }
    let checked=0,moved=0;
    const unsafe=[];
    for(const mode of ['aventura','tranquilo'])for(let seed=0;seed<50;seed++){
     const g=new Game({seed});g.reset(mode);
     for(let n=0;n<70;n++){
      g.elapsed=n*3;g.entities=[];g.sequence=n;g.nextSpawn=0;g.spawn();
      const s=g.entities.find(e=>e.kind==='wood'&&e.snake);
      if(!s)continue;
      const top=s.top+55,bottom=s.bottom-200;
      const fruits=g.entities.filter(e=>e.kind==='fruit');
      for(const f of fruits){
       checked++;
       if(!snakeA2FruitHasClearance(s,f.x,f.y)||f.y<top-.01||f.y>bottom+.01)
        unsafe.push({mode,seed,n,x:f.x,y:f.y,top,bottom});
       if(fruits.length===1&&Math.abs(f.x-(s.x+15))>.01)moved++;
      }
     }
    }
    // Seed the ordinary spawn path with a snake from a preceding encounter.
    // Align a real opaque head pixel with the new fruit's unadjusted center.
    const spawn=(previous=[])=>{
     const game=new Game({seed:104});game.reset('aventura');game.elapsed=24;game.sequence=3;
     game.entities.push(...previous);
     game.spawn();return {fruits:game.entities.filter(e=>e.kind==='fruit'),route:game.routes.get(3)};
    };
    const ordinary=spawn(),original=ordinary.fruits[0];
    const head={...wood,snake:{phase:'warning',warningAge:.5}};
    const p=snakePlacement(head);
    ctx.clearRect(0,0,650,640);
    ctx.save();ctx.translate(p.x,p.y);drawSnakeA2(ctx,head.snake,p.factor);ctx.restore();
    const headPixels=ctx.getImageData(0,0,650,640).data;
    let opaqueHead;
    for(let y=0;y<head.bottom-75&&!opaqueHead;y++)for(let x=0;x<650;x++){
     if(headPixels[(y*650+x)*4+3]>=224){opaqueHead={x,y};break;}
    }
    if(!opaqueHead)throw Error('No opaque raised A2 head pixel found');
    const dy=original.y-opaqueHead.y;
    const previous={...head,x:head.x+original.x-opaqueHead.x,top:head.top+dy,bottom:head.bottom+dy};
    const relocated=spawn([previous]);
    const blocked=spawn(Array.from({length:21},(_,i)=>({...previous,x:previous.x+(i-10)*40})));
    // Sample the rendered head directly as well as the gameplay mask. The
    // radius covers the pickup art, glow and vertical bobbing.
    const overlapsRenderedHead=fruit=>{
     const x=fruit.x-previous.x+head.x,y=fruit.y-dy,radius=38;
     for(let row=Math.max(0,Math.ceil(y-radius));row<=Math.min(639,Math.floor(y+radius));row++){
      for(let col=Math.max(0,Math.ceil(x-radius));col<=Math.min(649,Math.floor(x+radius));col++){
       if((row-y)**2+(col-x)**2<=radius**2&&headPixels[(row*650+col)*4+3]>=112)return true;
      }
     }
     return false;
    };
    const forced={
     overlaps:!snakeA2FruitHasClearance(previous,original.x,original.y),
     renderedOverlap:overlapsRenderedHead(original),
     count:relocated.fruits.length,expectedCount:ordinary.fruits.length,
     safe:relocated.fruits.every(f=>snakeA2FruitHasClearance(previous,f.x,f.y)&&!overlapsRenderedHead(f)),
     blockedCount:blocked.fruits.length,blockedRoute:!!blocked.route,
     rejected:placeA2Fruit([previous],original.x,original.y,original.y+1,original.y)===null
    };
    // Explicit engine-level contact: an opaque part of the new snake reaches
    // the parrot, even where the original sprite's hitboxes did not.
    const g=new Game({seed:1});g.state='playing';g.nextSpawn=1e9;
    const target={...wood,x:g.x+29,snake:{phase:'watching',age:2}};
    g.entities=[target];
    const collisionProbe=[];
    for(let y=wood.bottom-130;y<=wood.bottom-60;y+=4)
     if(snakeA2HitsPlayer(target,playerShapes(g.x,y)))collisionProbe.push(y);
    const probeY=collisionProbe[Math.floor(collisionProbe.length/2)];
    if(probeY!==undefined){g.y=probeY;g.vy=0;g.tick(STEP);}
    return {samples,missed,checked,moved,forced,unsafeCount:unsafe.length,unsafe:unsafe.slice(0,5),
      simulation:{probeY,state:g.state,cause:g.endCause}};
   });
   assert.equal(result.error,undefined,JSON.stringify(result));
   assert.ok(result.samples>200,'Not enough real pixels checked');
   assert.equal(result.missed,0,'Visible A2 pixels not covered by bird collision');
      assert.equal(result.unsafeCount,0,'Fruit overlaps snake: '+JSON.stringify(result.unsafe));
   assert.equal(result.forced.overlaps,true,'Fixture must overlap a real A2 silhouette');
   assert.equal(result.forced.renderedOverlap,true,'Fixture must overlap visible WebP pixels');
   assert.equal(result.forced.safe,true,'A previous encounter left a fruit inside the A2 silhouette');
   assert.equal(result.forced.count,result.forced.expectedCount,'A safe route must retain its fruit count');
   assert.equal(result.forced.blockedCount,0,'A blocked route must not spawn an unsafe fruit');
   assert.equal(result.forced.blockedRoute,false,'A blocked route must not leave an unreachable bonus');
   assert.equal(result.forced.rejected,true,'An empty corridor must reject the unsafe position');
   assert.ok(result.simulation.probeY!==undefined,'Could not find a live hitbox point');
   assert.equal(result.simulation.cause,'snake','Engine collision not using A2: '+JSON.stringify(result.simulation));
   assert.deepEqual(errors,[],'Browser page errors');
   console.log('PASS A2 HITBOX AND FRUIT '+JSON.stringify({viewport,samples:result.samples,fruits:result.checked,moved:result.moved}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
