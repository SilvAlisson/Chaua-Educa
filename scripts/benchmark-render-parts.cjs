// Isolate real Canvas 2D raster costs of forest, bird, trunk, snake, hawk and pickups.
// All outputs are diagnostics only; this does NOT change the shipped renderer.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const out='test-results/render-parts';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const results=await page.evaluate(async()=>{
   const {Renderer,drawBird}=await import('/js/render.mjs');
   const {Game}=await import('/js/engine.mjs');
   const {advanceSnake}=await import('/js/animals.mjs');
   const canvas=document.createElement('canvas');
   canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
   document.body.replaceChildren(canvas);
   const r=new Renderer(canvas);await r.ready;r.setQuality('high');
   const c=r.c,wood={id:9001,kind:'wood',x:520,top:140,bottom:460,variant:'plain',snake:{age:0}};
   advanceSnake(wood,.5,120);
   const hawk={id:9002,kind:'hawk',x:750,y:310,startX:750,startY:310,targetX:250,targetY:300,warning:0,age:2,dive:false,retreat:false};
   const fruit={id:9003,kind:'fruit',x:420,y:310,variety:0,collected:false};
   const pepper={id:9004,kind:'pepper',x:880,y:320,collected:false};
   const feather={id:9005,kind:'feather',x:980,y:300,collected:false};
   const g=new Game({seed:104});g.state='playing';g.y=320;g.wing=.5;g.elapsed=35;g.sceneTime=35;
   g.distance=15000;g.stage=2;g.stageAge=10;g.entities=[wood,hawk,fruit,pepper];
   const names=['forest','trunks','snake','hawk','pickups','bird','complete-scene'];
   const times=Object.fromEntries(names.map(x=>[x,[]]));
   const draw=(label,i)=>{
    const now=35+(i%120)/60,entity={...wood,snake:{...wood.snake,age:now,phase:'warning',warningAge:(i%35)/50}};
    switch(label){
     case 'forest':r.background(now,15000+i*1.5,2,false,false,1);break;
     case 'trunks':r.trunk('trunk-0',null,520,140,true,now,0);r.trunk('trunk-0',null,520,460,false,now,0);break;
     case 'snake':r.snake(entity,false);break;
     case 'hawk':r.hawk(hawk,now,false);break;
     case 'pickups':r.pickup(fruit,now,false);r.pickup(pepper,now,false);r.pickup(feather,now,false);break;
     case 'bird':drawBird(c,{x:450,y:400,scale:.74,wing:.5,time:now,vy:0});break;
     case 'complete-scene':g.elapsed=now;g.sceneTime=now;g.entities=[entity,hawk,fruit,pepper];r.game(g,false,now);break;
    }
   };
   const rounds=2,frames=70;
   for(let round=0;round<rounds;round++){
    const order=round%2?[...names].reverse():names;
    for(const label of order){
     for(let i=0;i<frames+8;i++){
      c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,r.canvas.width,r.canvas.height);
      c.setTransform(r.dpr,0,0,r.dpr,0,0);
      const begin=performance.now();
      draw(label,i+round*frames);
      c.getImageData(0,0,1,1); // Symmetric readback to flush deferred raster.
      if(i>=8)times[label].push(performance.now()-begin);
     }
    }
   }
   const stats={};
   for(const [label,t]of Object.entries(times)){
    const sorted=[...t].sort((a,b)=>a-b);
    const p=q=>sorted[Math.floor((sorted.length-1)*q)];
    stats[label]={count:t.length,medianMs:p(.5),p95Ms:p(.95),meanMs:t.reduce((a,b)=>a+b,0)/t.length,maxMs:Math.max(...t)};
   }
   return {backing:[r.canvas.width,r.canvas.height],dpr:r.dpr,units:'performance.now() ms including 1-pixel canvas readback',stats};
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/render-parts.json',JSON.stringify(results,null,2));
  console.log('RENDER_PARTS_RESULT '+JSON.stringify(results));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
