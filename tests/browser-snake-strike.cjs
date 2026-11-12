// Validate ONE official A2 snake renderer/physical hitbox in 3 viewports.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const out='test-results/snake-strike';fs.mkdirSync(out,{recursive:true});
  for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
   const p=await browser.newPage({viewport}),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await p.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const setup=await p.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const {advanceSnake}=await import('/js/animals.mjs');
    const {isSnakeA2Ready,snakeA2Pose,snakeA2CollisionRects,snakeA2HeadRect}=await import('/js/snake-a2.mjs');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.replaceChildren(canvas);
    const r=new Renderer(canvas);await r.ready;
    const g=new Game();g.state='paused';g.elapsed=50;g.sceneTime=50;g.y=300;g.stage=1;g.stageAge=10;
    const w={id:1,kind:'wood',x:400,top:120,bottom:450,variant:'plain',snake:{age:0}};
    g.entities=[w];window.snakeScene={g,w,r,advanceSnake,snakeA2Pose,snakeA2CollisionRects,snakeA2HeadRect};
    const mask=snakeA2CollisionRects(w),head=snakeA2HeadRect(w);
    return {ready:isSnakeA2Ready(),maskCount:mask.length,head};
   });
   assert.equal(setup.ready,true,'A2 must be rendered; no legacy fallback');
   assert.ok(setup.maskCount>20,'Official pixel mask missing');
   assert.ok(setup.head?.w>0);
   for(const [name,time,expected,state] of [
    ['alerta',.4,'warning','alert'],
    ['preparacao',.41,'windup','windup'],
    ['bote',.56,'striking','strike'],
    ['recuperacao',.2,'recovering','recover'],
    ['concluido',.7,'spent','spent']
   ]){
    const stateInfo=await p.evaluate(({time})=>{
     const {g,w,r,advanceSnake,snakeA2Pose,snakeA2CollisionRects}=window.snakeScene;
     advanceSnake(w,time,g.x);
     r.game(g,false,50);
     const pose=snakeA2Pose(w.snake);
     return {phase:w.snake.phase,count:w.snake.strikeCount||0,pose,rects:snakeA2CollisionRects(w).length};
    },{time});
    assert.equal(stateInfo.phase,expected);
    assert.equal(stateInfo.pose.state,state);
    assert.ok(stateInfo.rects>20);
    await p.screenshot({path:path.join(out,name+'-'+viewport.width+'.png')});
   }
   const once=await p.evaluate(()=>{
    const {g,w,r,advanceSnake}=window.snakeScene;
    for(let i=0;i<300;i++)advanceSnake(w,1/60,g.x);
    r.game(g,true,50);
    return {count:w.snake.strikeCount,phase:w.snake.phase};
   });
   assert.equal(once.count,1);assert.equal(once.phase,'spent');
   assert.deepEqual(errors,[]);
   await p.close();
  }
  console.log('PASS A2 snake: original illustrated hitbox, warning, single strike, recovery, 3 viewport sizes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
