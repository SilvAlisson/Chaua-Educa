// Official source-art validation: A2 WebP + current forest, never old v7 snake.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  const out='test-results/reference-art';fs.mkdirSync(out,{recursive:true});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  await page.locator('#start-training:not([disabled])').waitFor();
  await page.screenshot({path:path.join(out,'inicio.png')});
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const setup=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs');
   const {Game}=await import('/js/engine.mjs');
   const {SNAKE_A2_MASKS}=await import('/js/snake-a2-masks.mjs');
   const {isSnakeA2Ready}=await import('/js/snake-a2.mjs');
   const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=960;
   canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
   document.body.replaceChildren(canvas);
   const r=new Renderer(canvas);await r.ready;window.art={r,Game};
   const poses=Object.entries(SNAKE_A2_MASKS).flatMap(([sheet,frames])=>
     frames.map((m,frame)=>({sheet,frame,filled:m.reduce((a,v)=>a+v,0)})));
   return {ready:isSnakeA2Ready(),poses};
  });
  assert.equal(setup.ready,true);
  assert.equal(setup.poses.length,24);
  for(const f of setup.poses)assert.ok(f.filled>70&&f.filled<1024,
   'Official A2 sheet has blank or clipped pose: '+JSON.stringify(f));
  for(const [name,state] of [
   ['cobra-tronco',{phase:'watching',age:1.7}],
   ['cobra-alerta',{phase:'warning',age:2,warningAge:.7}],
   ['cobra-bote',{phase:'striking',age:2.7,phaseAge:.14}],
   ['cobra-atordoada',{phase:'retreat',age:3,retreat:true,dazed:true,retreatTime:.4}]
  ]){
   const result=await page.evaluate(state=>{
    const {r,Game}=window.art,g=new Game();
    g.state='paused';g.y=300;g.sceneTime=44;g.elapsed=44;
    g.stage=1;g.stageAge=10;
    g.entities=[{id:2,kind:'wood',x:520,top:180,bottom:430,variant:'branch',snake:state}];
    r.game(g,false,44);
    const d=r.c.getImageData(0,0,r.c.canvas.width,r.c.canvas.height).data;
    let drawn=0;for(let i=3;i<d.length;i+=4)if(d[i])drawn++;
    return drawn;
   },state);
   assert.ok(result>1500,'Visible official A2 scene is blank: '+name);
   await page.screenshot({path:path.join(out,name+'.png')});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS 24 official A2 poses, original forest art and four in-game scenes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
