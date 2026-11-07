const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {
  fs.mkdirSync('test-results/weather-trees',{recursive:true});
  for(const [width,height] of [[1366,638],[390,844]]){
   const page=await browser.newPage({viewport:{width,height}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
   await page.goto('http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.mjs');
    const {Game}=await import('/js/engine.mjs');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='width:100vw;height:100vh;position:fixed;inset:0';
    document.body.replaceChildren(canvas);
    window.renderer=new Renderer(canvas);await renderer.ready;
    window.game=new Game();game.state='playing';game.y=320;game.stageAge=5;
   });
   for(const [name,distance] of [['dawn',0],['summer',8000],['storm',11000],['transition',14900],['wind',16500],['clear',22000]]){
    const info=await page.evaluate(({distance})=>{
     game.distance=distance;game.stage=Math.min(3,Math.floor(distance/7000));game.sceneTime=42;
     game.entities=[
      {kind:'wood',id:11,x:390,top:130,bottom:500,variant:'plain',fragileSide:'top',fragileKind:'rot',decorSide:'bottom',decorKind:'moss'},
      {kind:'wood',id:12,x:670,top:130,bottom:500,variant:'plain',fragileSide:'bottom',fragileKind:'hollow',decorSide:'top',decorKind:'vine'}
     ];
     renderer.game(game,false);
     // At the trunk center, bark must continue above the flight corridor.
     const view=renderer.getViewport();
     const x=view.x+(419-view.worldLeft)*view.scale;
     const ratio=renderer.c.canvas.width/innerWidth;
     const sample=()=>Array.from(renderer.c.getImageData(Math.round(x*ratio),Math.round((view.y-8)*ratio),1,1).data);
     const bark=sample();
     const trees=game.entities;game.entities=[];renderer.game(game,false);
     const background=sample();game.entities=trees;renderer.game(game,false);
     const continuous=x<0 || x>=innerWidth || view.y<9 || bark.some((v,i)=>Math.abs(v-background[i])>10);
     const frozen=renderer.c.getImageData(0,0,renderer.c.canvas.width,renderer.c.canvas.height).data;
     renderer.game(game,false);
     const repeat=renderer.c.getImageData(0,0,renderer.c.canvas.width,renderer.c.canvas.height).data;
     return {continuous,stable:frozen.every((v,i)=>v===repeat[i]),width:innerWidth,height:innerHeight};
    },{distance});
    assert.ok(info.stable,'paused rendering changes');
    assert.ok(info.continuous,'trunk is cut off above flight corridor');
    await page.screenshot({path:`test-results/weather-trees/${width}-${name}.png`});
   }
   for(const age of [0,.06,.12,.2]) {
    await page.evaluate(async(age)=>{
     const {drawTreeVariant}=await import('/js/tree-art.mjs');
     const c=renderer.c;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,c.canvas.width,c.canvas.height);
     drawTreeVariant(c,140,250,true,'rot',age);drawTreeVariant(c,300,250,false,'hollow',age);
    },age);
    await page.screenshot({path:`test-results/weather-trees/${width}-break-${age}.png`});
   }
   assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
