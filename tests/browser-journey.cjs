const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  for(const [mode,viewport,seed]of [['aventura',{width:1440,height:960},451],['tranquilo',{width:390,height:844},104]]){
   const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    let id=0,time=100,callbacks=new Map();
    window.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};
    window.cancelAnimationFrame=id=>callbacks.delete(id);
    window.stepFlight=()=>{time+=1000/30;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn(time));};
   });
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.locator('#inputPlayer').fill('Voo completo');await page.locator(`input[value=${mode}]`).check();await page.locator('#btnStart:not([disabled])').click();
   const summary=await page.evaluate(async(seed)=>{
    const {predictedHawkY}=await import('/js/animals.mjs');const {game:g}=await import('/js/script.js');const {isSnakeA2Ready}=await import('/js/snake-a2.mjs');
    if(!isSnakeA2Ready())throw Error('A2 must load on the default game URL');const {flightViewport}=await import('/js/viewport.mjs');
    g.start(g.mode,[],seed);let hits=new Set(),stages=new Set();
    for(let frame=0;frame<40000;frame++){
     if(g.state==='playing'){
      const v=flightViewport(innerWidth,innerHeight),right=v.worldLeft+v.w/v.scale;
      const wood=g.entities.find(e=>e.kind==='wood'&&e.x+100>g.x&&e.x<=right);
      const hawk=g.entities.find(e=>e.kind==='hawk'&&!e.harmless&&!e.retreat&&e.x+60>g.x);
      let target=wood?(wood.snake?wood.top+Math.min(85,(wood.bottom-wood.top)*.35):(wood.top+wood.bottom)/2):320;
      if(!wood&&hawk){const lane=predictedHawkY(hawk,g.x);target=hawk.attackKind&&!hawk.targetLocked?320:lane>=320?Math.max(145,lane-140):Math.min(495,lane+140);}
      // Expert navigation gate, not a human win-rate estimate: time a tap at
      // the lower part of the clear corridor, leaving room for its 50px ascent.
      if(g.y>target+26&&g.vy>0&&g.flapCooldown<=0){window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));}
      for(const e of g.entities){if(e.kind==='hawk')hits.add(e.dive?'dive':'hawk');if(e.snake)hits.add(e.snake.branch?'branch-snake':'snake');}
      stages.add(g.stage);
     }
     window.stepFlight();
     if(g.state==='quiz') {document.querySelector(g.question.answer?'#answer-true':'#answer-false').click();document.querySelector('#quiz-continue').click();}
     if(g.state==='ended')break;
    }
    return {mode:g.mode,seed,won:g.won,reason:g.reason,score:g.score,correct:g.correct,elapsed:g.elapsed,stages:[...stages],encounters:[...hits],nearestWoods:g.entities.filter(e=>e.kind==='wood'&&Math.abs(e.x-g.x)<260).map(e=>({x:Math.round(e.x),top:Math.round(e.top),bottom:Math.round(e.bottom),variant:e.variant,snake:e.snake?.phase})).slice(0,3)};
   },seed);
   console.log(JSON.stringify(summary));assert.equal(summary.won,true,summary.reason);
   await page.locator('#result-dialog').waitFor({state:'visible'});await page.waitForTimeout(750);
   assert.equal(await page.locator('#result-dialog').evaluate(d=>d.querySelector('h2').getBoundingClientRect().top>=d.getBoundingClientRect().top),true,'result opens with the complete title visible');assert.equal(summary.stages.length,4);assert.ok(summary.correct>=2);assert.ok(summary.encounters.includes('hawk'));assert.ok(summary.encounters.includes('snake'));assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
