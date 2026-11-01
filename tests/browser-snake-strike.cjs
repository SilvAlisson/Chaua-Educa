const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
const out='test-results/snake-strike';fs.mkdirSync(out,{recursive:true});
for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
 const p=await browser.newPage({viewport}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));await p.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
 const result=await p.evaluate(async()=>{
  const {Renderer}=await import('/js/render.mjs'),{Game}=await import('/js/engine.mjs'),{advanceSnake}=await import('/js/animals.mjs'),{images}=await import('/js/assets.mjs'),{SPRITES}=await import('/js/sprite-data.mjs'),{SNAKE_WRAP}=await import('/js/snake-wrap-data.mjs');
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';document.body.replaceChildren(canvas);const r=new Renderer(canvas);await r.ready;const g=new Game();g.state='paused';g.elapsed=50;g.sceneTime=50;g.y=300;g.stage=1;g.stageAge=10;const w={id:1,kind:'wood',x:400,top:120,bottom:450,variant:'plain',snake:{age:0}};g.entities=[w];window.snakeScene={g,w,r,advanceSnake};
  const probe=document.createElement('canvas');probe.width=384;probe.height=384;const c=probe.getContext('2d');let invalid=0;
  for(let i=0;i<16;i++){c.clearRect(0,0,384,384);c.drawImage(images.get('snake-atlas'),...SPRITES.snake.frames[i].rect,0,0,384,384);for(const [x,y,w,h]of SNAKE_WRAP.neckMasks[i])if(c.getImageData(Math.floor(x+w/2),Math.floor(y+h/2),1,1).data[3]<180)invalid++;}
  c.clearRect(0,0,384,384);c.drawImage(images.get('snake-wrap'),0,0);for(const [x,y,w,h]of SNAKE_WRAP.colliders){const px=(x+w/2+63)*384/126,py=(y+h/2+8)*384/126;if(c.getImageData(Math.floor(px),Math.floor(py),1,1).data[3]<180)invalid++;}
  return {invalid};
 });assert.equal(result.invalid,0,'body contact extends into transparent air');
 for(const [name,time,expected]of [['alerta',.4,'warning'],['preparacao',.41,'windup'],['bote',.56,'striking'],['recuperacao',.2,'recovering'],['concluido',.7,'spent']]){
  const state=await p.evaluate(({time})=>{const {g,w,r,advanceSnake}=window.snakeScene;advanceSnake(w,time,g.x);r.game(g,false,50);return {phase:w.snake.phase,count:w.snake.strikeCount||0};},{time});assert.equal(state.phase,expected);await p.screenshot({path:path.join(out,`${name}-${viewport.width}.png`)});
 }
 const once=await p.evaluate(()=>{const {g,w,r,advanceSnake}=window.snakeScene;for(let i=0;i<300;i++)advanceSnake(w,1/60,g.x);r.game(g,true,50);return {count:w.snake.strikeCount,phase:w.snake.phase};});assert.equal(once.count,1);assert.equal(once.phase,'spent');assert.deepEqual(errors,[]);await p.close();
}
console.log('PASS snake: real opaque-pixel masks, minimum warning, one strike, recovery and three viewports');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
