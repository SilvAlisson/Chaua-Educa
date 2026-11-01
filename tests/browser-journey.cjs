const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  for(const [mode,viewport]of [['aventura',{width:1440,height:960}],['tranquilo',{width:390,height:844}]]){
   const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    let id=0,time=100,callbacks=new Map();
    window.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};
    window.cancelAnimationFrame=id=>callbacks.delete(id);
    window.stepFlight=()=>{time+=1000/30;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn(time));};
   });
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   await page.locator('#inputPlayer').fill('Voo completo');await page.locator(`input[value=${mode}]`).check();await page.locator('#btnStart:not([disabled])').click();
   const summary=await page.evaluate(async()=>{
    const {game:g}=await import('/js/script.js');const {flightViewport}=await import('/js/viewport.mjs');
    g.start(g.mode,[],104);let pending=null,nextDecision=0,hits=new Set(),stages=new Set();
    for(let frame=0;frame<7000;frame++){
     if(g.state==='playing'){
      const v=flightViewport(innerWidth,innerHeight),right=v.worldLeft+v.w/v.scale;
      const wood=g.entities.find(e=>e.kind==='wood'&&e.x+100>g.x&&e.x<=right);
      const hawk=g.entities.find(e=>e.kind==='hawk'&&!e.harmless&&!e.retreat&&e.x+60>g.x);
      let target=wood?(wood.top+wood.bottom)/2:320;
      if(!wood&&hawk){const t=Math.max(0,Math.min(1,(hawk.startX-g.x)/(hawk.startX-hawk.targetX)));const lane=hawk.startY+(hawk.targetY-hawk.startY)*t;target=lane>=320?Math.max(145,lane-125):Math.min(495,lane+125);}
      if(g.elapsed>=nextDecision){nextDecision=g.elapsed+1/30;const predicted=g.y+g.vy*.12+450*.12**2;if(pending===null&&predicted>target+10&&g.vy>0)pending=g.elapsed+.12;}
      if(pending!==null&&g.elapsed>=pending){window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));pending=null;}
      for(const e of g.entities){if(e.kind==='hawk')hits.add(e.dive?'dive':'hawk');if(e.snake)hits.add(e.snake.branch?'branch-snake':'snake');}
      stages.add(g.stage);
     }
     window.stepFlight();
     if(g.state==='quiz') {document.querySelector(g.question.answer?'#answer-true':'#answer-false').click();document.querySelector('#quiz-continue').click();pending=null;}
     if(g.state==='ended')break;
    }
    return {mode:g.mode,won:g.won,reason:g.reason,score:g.score,correct:g.correct,elapsed:g.elapsed,stages:[...stages],encounters:[...hits]};
   });
   console.log(JSON.stringify(summary));assert.equal(summary.won,true,summary.reason);assert.equal(summary.stages.length,4);assert.ok(summary.correct>=2);assert.ok(summary.encounters.includes('hawk'));assert.ok(summary.encounters.includes('snake'));assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
