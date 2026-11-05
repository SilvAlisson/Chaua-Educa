const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const out='test-results/simulated-gameplay-pr48';
fs.mkdirSync(out,{recursive:true});
const STEP=1/120;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const report=[];
 try{
 for(const viewport of [{width:1200,height:720},{width:390,height:844}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   const {Game,STEP}=await import('/js/engine.mjs');
   const {Renderer}=await import('/js/render.mjs');
   const cv=document.createElement('canvas');
   cv.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none';
   document.body.replaceChildren(cv);
   const renderer=new Renderer(cv);await renderer.ready;
   const events=[];
   const game=new Game({seed:2026,onEvent:event=>events.push(event.type)});
   game.start('aventura',[],2026);
   game.viewWidth=1200;game.viewLeft=0;
   // The real engine and authored renderer drive this capture; the auto-pilot
   // uses a long grace period solely to avoid instant test termination.
   game.invincible=9999;
   game.nextSpawn=.6;
   const draw=()=>renderer.game(game.visual(.5),false,game.sceneTime);
   const advance=(ticks)=>{
    for(let i=0;i<ticks;i++){
     if(game.state==='playing'){
      if(game.y>335&&game.vy>10&&game.flapCooldown<=0){
       game.press();game.release();
      }
      if(game.state==='quiz'){game.state='playing';game.quizPending=false;}
     }
     game.tick(STEP);
     if(game.state==='quiz'){game.state='playing';game.quizPending=false;}
     if(game.state==='ended'||game.state==='impact'){throw Error('unexpected auto-pilot end '+game.endCause);}
    }
    draw();
    return {ticks,gameSeconds:+game.elapsed.toFixed(2),state:game.state,
     score:game.score,stage:game.stage,entityKinds:game.entities.map(e=>e.kind),
     events:events.length,shield:game.shield};
   };
   const controlledSnake=()=>{
    game.entities=[];
    game.nextSpawn=Infinity;
    game.state='playing';game.y=298;game.vy=0;game.shield=true;game.invincible=0;
    game.hit=null;
    const host={kind:'wood',id:777,x:405,top:140,bottom:425,variant:'branch',
      snake:{kind:'snake',phase:'warning',age:3.2,phaseAge:.1,warningAge:.64,retreat:false}};
    game.entities.push(host);draw();return host;
   };
   const controlledHawk=()=>{
    game.entities=[];
    game.nextSpawn=Infinity;game.state='playing';game.y=298;game.vy=0;
    game.shield=true;game.invincible=0;game.hit=null;
    const hawk={kind:'hawk',id:888,x:510,y:297,startX:700,startY:297,targetX:160,targetY:297,
      phase:'crossing',warning:0,age:1,dive:false,retreat:false};
    game.entities.push(hawk);draw();return hawk;
   };
   window.flightCapture={game,renderer,events,draw,advance,controlledSnake,controlledHawk};
   draw();
  });
  const capture=async(name,action)=>{
   const info=await page.evaluate(action);
   const file=path.join(out,name+'-'+viewport.width+'.png');
   await page.screenshot({path:file});
   report.push({viewport:viewport.width,name,file,...info});
   console.log('SIMULATED_GAMEPLAY_CAPTURE '+JSON.stringify(report.at(-1)));
  };
  await capture('01-partida-inicio',()=>{
    const q=window.flightCapture;
    return q.advance(360);
  });
  await capture('02-voo-encontros',()=>{
    const q=window.flightCapture;
    return q.advance(650);
  });
  await capture('03-travessia-floresta',()=>{
    const q=window.flightCapture;
    return q.advance(1100);
  });
  await capture('04-cobra-alerta',()=>{
    const q=window.flightCapture,h=q.controlledSnake();
    return {state:q.game.state,phase:h.snake.phase,woodId:h.id};
  });
  await capture('05-cobra-bote',()=>{
    const q=window.flightCapture,s=q.game.entities[0].snake;
    s.phase='striking';s.phaseAge=.10;s.warningAge=.8;s.age+=.9;
    q.draw();return {state:q.game.state,phase:s.phase,phaseAge:s.phaseAge};
  });
  await capture('06-cobra-contato-escudo',()=>{
    const q=window.flightCapture,host=q.game.entities[0],s=host.snake;
    q.game.collide(s,true,host);
    q.advance(6);
    assert.equal(s.dazed,true,'shield should daze snake via engine');
    assert.equal(q.game.shield,false,'shield should be consumed');
    return {shield:q.game.shield,phase:s.phase,dazed:s.dazed,retreatTime:s.retreatTime};
  });
  await capture('07-cobra-atordoada',()=>{
    const q=window.flightCapture,s=q.game.entities[0].snake;
    q.advance(27);return {phase:s.phase,dazed:s.dazed,retreatTime:s.retreatTime};
  });
  await capture('08-gaviao-antes-colisao',()=>{
    const q=window.flightCapture,e=q.controlledHawk();
    return {hawkPhase:e.phase,shield:q.game.shield};
  });
  await capture('09-gaviao-impacto-escudo',()=>{
    const q=window.flightCapture,e=q.game.entities[0];q.game.collide(e,true,e);
    q.advance(7);assert.equal(e.dazed,true);assert.equal(e.harmless,true);
    return {phase:e.phase,dazed:e.dazed,retreatTime:e.retreatTime,harmless:e.harmless};
  });
  await capture('10-gaviao-atordoado',()=>{
    const q=window.flightCapture,e=q.game.entities[0];
    q.advance(39);return {phase:e.phase,dazed:e.dazed,retreatTime:e.retreatTime};
  });
  await capture('11-gaviao-curva',()=>{
    const q=window.flightCapture,e=q.game.entities[0];
    q.advance(48);return {phase:e.phase,dazed:e.dazed,retreatTime:e.retreatTime};
  });
  await capture('12-gaviao-retirada',()=>{
    const q=window.flightCapture,e=q.game.entities[0];
    q.advance(50);return {phase:e.phase,dazed:e.dazed,retreatTime:e.retreatTime};
  });
  assert.deepEqual(errors,[],'No uncaught JS errors allowed');
  await page.close();
 }
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));
 console.log('SIMULATED_GAMEPLAY_COMPLETE '+JSON.stringify({shots:report.length,viewports:[1200,390],usesRealFixedStep:true,shieldContactsControlled:true,errors:0}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});