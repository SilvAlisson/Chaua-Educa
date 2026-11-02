const assert=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
const p=await browser.newPage({viewport:{width:960,height:640}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));await p.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
const checks=await p.evaluate(async()=>{
 const {loadAssets,images}=await import('/js/assets.mjs'),{drawContinuousSnake}=await import('/js/snake-render.mjs'),{snakeMotion,deformSnakePoint}=await import('/js/snake-motion.mjs'),{advanceSnake}=await import('/js/animals.mjs');await loadAssets();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=400;const c=canvas.getContext('2d',{willReadFrequently:true}),w={x:400,snake:{age:0}};let last=null,maxJump=0,maxError=0,minEye=Infinity,maxEye=0,base=null,baseChanges=0;
 for(let i=0;i<400;i++){
  advanceSnake(w,1/120,220);c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,400,400);c.translate(200,300);drawContinuousSnake(c,images.get('snake-atlas'),w.snake,.52,false);
  const pose=snakeMotion(w.snake),q=deformSnakePoint(142.19,129.35,pose),expected={x:200+(q.x-192)*.52,y:300+(q.y-328)*.52};let sx=0,sy=0,n=0;
  const left=Math.floor(expected.x-12),top=Math.floor(expected.y-12),pixels=c.getImageData(left,top,25,25).data;
  for(let j=0;j<625;j++){const a=j*4;if(pixels[a]<65&&pixels[a+1]<65&&pixels[a+2]<65&&pixels[a+3]>180){sx+=left+j%25;sy+=top+Math.floor(j/25);n++;}}
  if(n<10)throw Error('missing or duplicated pupil');const eye={x:sx/n,y:sy/n};maxError=Math.max(maxError,Math.hypot(eye.x-expected.x,eye.y-expected.y));if(last)maxJump=Math.max(maxJump,Math.hypot(eye.x-last.x,eye.y-last.y));last=eye;minEye=Math.min(minEye,n);maxEye=Math.max(maxEye,n);
  const coil=c.getImageData(150,282,100,16).data;if(base){if(coil.some((v,j)=>v!==base[j]))baseChanges++;}else base=coil;
 }
 return {maxJump,maxError,minEye,maxEye,baseChanges,count:w.snake.strikeCount};
});console.log(JSON.stringify(checks));assert.ok(checks.maxJump<4,'rendered head teleports');assert.ok(checks.maxError<2,'rendered eye leaves its continuous landmark');assert.ok(checks.maxEye/checks.minEye<1.2,'head changes size between poses');assert.equal(checks.baseChanges,0,'anchored coil changes its drawing');assert.equal(checks.count,1);
if(process.env.CAPTURE_DEMO){
 const dest=path.resolve(process.env.CAPTURE_DEMO);fs.mkdirSync(path.dirname(dest),{recursive:true});const download=p.waitForEvent('download');
 await p.evaluate(async()=>{
  const {Renderer}=await import('/js/render.mjs'),{advanceSnake}=await import('/js/animals.mjs');const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';document.body.replaceChildren(canvas);const r=new Renderer(canvas);await r.ready;const c=r.c,w={kind:'wood',id:1,x:-29,top:-240,bottom:0,variant:'plain',snake:{age:0}};
  const stream=canvas.captureStream(60),chunks=[],rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3500000});rec.ondataavailable=e=>chunks.push(e.data);
  await new Promise(resolve=>{let previous=performance.now(),elapsed=0;rec.onstop=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));a.download='cobra-suave.webm';a.click();stream.getTracks().forEach(t=>t.stop());resolve();};rec.start();function frame(now){const dt=Math.min(.04,(now-previous)/1000);previous=now;elapsed+=dt;advanceSnake(w,dt,-209);r.base();r.background(elapsed,0,0,false,false);c.save();c.translate(570,365);c.scale(2.3,2.3);r.obstacle(w,{sceneTime:elapsed,elapsed:50},false);c.restore();c.fillStyle='#fffae9ee';c.fillRect(22,22,300,115);c.fillStyle='#234a35';c.font='800 23px Nunito';c.fillText('Cobra · movimento contínuo',38,57);c.font='700 19px Nunito';c.fillText(({watching:'Repouso',warning:'Alerta',windup:'Preparação',striking:'Bote',recovering:'Recuperação',spent:'Respiração'})[w.snake.phase]||w.snake.phase,38,94);if(elapsed<4.5)requestAnimationFrame(frame);else rec.stop();}requestAnimationFrame(frame);});
 });const d=await download;await d.saveAs(dest);console.log('DEMO '+dest);
}
assert.deepEqual(errors,[]);console.log('PASS continuous snake pixels: stable coil, rigid head and smooth landmarks across all phases');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
