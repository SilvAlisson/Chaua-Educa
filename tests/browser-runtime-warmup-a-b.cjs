// Real browser verification of default preflight raster touches and A/B
// opt-outs. A prewarm remains a hypothesis until device A/B validates GPU work.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const [suffix,expected] of [['',{snake:true,food:true}],['?snakeWarmup=0&winterFoodWarmup=0',{snake:false,food:false}]]){
   const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto((process.env.GAME_URL||'http://127.0.0.1:5501/')+suffix,{waitUntil:'networkidle'});
   const flags=await page.evaluate(async()=>{
    const [{Renderer},{Game},{setWeatherMode}]=await Promise.all([
     import('/js/render.mjs'),import('/js/engine.mjs'),import('/js/weather.mjs')]);
    setWeatherMode('winter');
    const canvas=document.createElement('canvas');
    canvas.style.cssText='width:844px;height:390px;position:fixed;inset:0;';
    document.body.append(canvas);
    const renderer=new Renderer(canvas);
    await renderer.ready;
    const game=new Game({seed:177});
    game.start('aventura',[],177);game.state='countdown';game.countdown=2;
    for(let i=0;i<5;i++)renderer.game(game,false,i/60);
    const result={
      snake:renderer.snakeWarmupEnabled,
      index:renderer.snakeWarmupIndex,
      food:renderer.frozenFoodWarmupDone,
      foodEnabled:renderer.frozenFoodWarmupEnabled
    };
    canvas.remove();return result;
   });
   assert.equal(flags.snake,expected.snake);
   assert.equal(flags.foodEnabled,expected.food);
   assert.equal(flags.food,expected.food,'winter image should only warm during countdown if enabled');
   assert.equal(flags.index,expected.snake?5:0,'warm one A2 sheet per countdown render');
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS preflight GPU touch A/B: 5 snake sheets and frozen-food atlas warm only during countdown, optional disable switches retained');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
