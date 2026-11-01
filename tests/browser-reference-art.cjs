const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
 const p=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],out='test-results/reference-art';fs.mkdirSync(out,{recursive:true});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});await p.locator('#start-training:not([disabled])').waitFor();await p.screenshot({path:path.join(out,'inicio.png')});
 await p.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));await p.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{const {Renderer}=await import('/js/render.mjs'),{Game}=await import('/js/engine.mjs');const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';document.body.replaceChildren(canvas);const r=new Renderer(canvas);await r.ready;window.art={r,Game};});
 const checks=await p.evaluate(async()=>{const {SPRITES}=await import('/js/sprite-data.mjs'),{images}=await import('/js/assets.mjs'),c=document.createElement('canvas').getContext('2d');c.canvas.width=c.canvas.height=384;return SPRITES.snake.frames.map(f=>{
  c.clearRect(0,0,384,384);c.drawImage(images.get('snake-atlas'),...f.rect,0,0,384,384);const a=c.getImageData(0,0,384,384).data;let bottom=0,left=384,right=0;for(let y=280;y<384;y++)for(let x=0;x<384;x++)if(a[(y*384+x)*4+3]>150){bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}return {bottom,width:right-left+1};});});
 for(const f of checks){assert.ok(Math.abs(f.bottom-327)<=1,JSON.stringify(f));assert.ok(f.width>=237&&f.width<=245,JSON.stringify(f));}
 for(const [name,branch,age]of [['cobra-tronco',false,1.7],['cobra-alerta',true,2],['cobra-bote',true,2.7]]){
  await p.evaluate(({branch,age})=>{const {r,Game}=window.art,g=new Game();g.state='paused';g.y=300;g.sceneTime=44;g.elapsed=44;g.stage=1;g.stageAge=10;g.entities=[{id:2,kind:'wood',x:520,top:180,bottom:430,variant:branch?'branch':'plain',snake:{branch,phase:branch?'striking':'watching',phaseAge:age===2.7?.2:0,age,retreat:false}}];r.game(g,false,44);},{branch,age});await p.screenshot({path:path.join(out,name+'.png')});
 }
 assert.deepEqual(errors,[]);console.log('PASS v7 registered coil width/base in all 16 frames, home and animated trunk/branch scenes');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
