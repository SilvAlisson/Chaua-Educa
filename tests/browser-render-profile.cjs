const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   if(process.env.PROFILE_BASELINE_PATH)await page.route('**/js/render-baseline.mjs',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(process.env.PROFILE_BASELINE_PATH,'utf8')}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const result=await page.evaluate(async baseline=>{
    const {Renderer}=await import('/js/render.mjs'),{Game}=await import('/js/engine.mjs'),{advanceSnake}=await import('/js/animals.mjs');
    const make=async Class=>{
     const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';document.body.append(canvas);
     const r=new Class(canvas);await r.ready;return r;
    };
    const r=await make(Renderer),old=baseline?await make((await import('/js/render-baseline.mjs')).Renderer):null;
    const g=new Game({seed:104});g.state='playing';g.y=300;g.elapsed=50;g.sceneTime=50;g.stageAge=10;
    const wood={id:1,kind:'wood',x:400,top:120,bottom:450,variant:'plain',snake:{age:0}};
    advanceSnake(wood,.4,g.x);g.entities=[wood];
    g.particles=Array.from({length:40},(_,i)=>({x:100+i*4,y:280,life:.5,maxLife:1,color:'#ffd180',spark:true}));
    const checks=[];
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    const pixels=renderer=>renderer.c.getImageData(0,0,renderer.canvas.width,renderer.canvas.height).data;
    const identical=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
    // Pixel parity for presets and matching independent settings; optionally
    // compare against the pre-change renderer from an exact Git revision.
    for(const mode of ['high','low'])for(let stage=0;stage<4;stage++)for(const reduced of [false,true]){
     g.stage=stage;r.setQuality(mode);r.game(g,reduced,50);const before=pixels(r);
     r.setVisualProfile({resolution:mode,decoration:mode});r.game(g,reduced,50);
     check(identical(before,pixels(r)),`preset parity: ${mode}/${stage}/${reduced}`);
     if(old){old.setQuality(mode);old.game(g,reduced,50);check(identical(before,pixels(old)),`baseline parity: ${mode}/${stage}/${reduced}`);}
    }
    // Auto Low is resolution-only: its pixels and scene must match the full-
    // effects profile at exactly the same low backing resolution.
    for(let stage=0;stage<4;stage++)for(const reduced of [false,true]){
     g.stage=stage;
     r.setAutomaticQuality('low');r.game(g,reduced,50);
     const auto=pixels(r);
     check(r.quality==='low'&&r.resolution==='low'&&r.decoration==='high','automatic downgrade must preserve decoration');
     r.setVisualProfile({resolution:'low',decoration:'high'});r.game(g,reduced,50);
     check(identical(auto,pixels(r)),`Automatic low full-effects pixel parity: ${stage}/${reduced}`);
    }
    r.setAutomaticQuality('high');
    check(r.quality==='high'&&r.resolution==='high'&&r.decoration==='high','automatic restore must keep all effects');
    r.setQuality('low');
    check(r.quality==='low'&&r.resolution==='low'&&r.decoration==='low','manual Low still reduces decoration');
    r.setQuality('high');
    check(r.quality==='high'&&r.resolution==='high'&&r.decoration==='high','manual High still restores decoration');

    // Resolution changes must preserve the logical drawing commands, including
    // all particles and snake geometry; only the backing transform may differ.
    let commands=[];const context=r.c;
    const serial=value=>value&&typeof value==='object'?value.constructor.name:value;
    const record=(key,args)=>{
     // Context-bound gradients are now cached. Their constructor frequency
     // is an allocation detail, not logical geometry; compare their actual
     // fillStyle/draw commands instead (and still compare all preset pixels).
     if(key==='createLinearGradient'||key==='createRadialGradient')return;
     // Seasonal surfaces are blitted in physical pixels under the identity
     // transform. Check their pixel snapping, then compare logical placement.
     if(key==='drawImage' && [...r.seasonalBackdrop.frames.values()].includes(args[0])){
      const logicalX=Math.sin(50*.035)*24-26;
      check(args.length===3 && args[1]===Math.round(logicalX*r.dpr) && args[2]===0,
       'seasonal backdrop lost pixel-aligned placement');
      commands.push([key,'seasonal-surface',logicalX,0]);
     }else commands.push([key,...args.map(serial)]);
    };
    r.c=new Proxy(context,{
     get(target,key){const value=Reflect.get(target,key,target);return typeof value==='function'?(...args)=>{if(key!=='setTransform')record(key,args);return value.apply(target,args);}:value;},
     set(target,key,value){commands.push(['set',key,serial(value)]);return Reflect.set(target,key,value,target);}
    });
    g.stage=2;g.distance=14900;const gameBefore=JSON.stringify(g);
    for(const decoration of ['high','low']){
     const draw=resolution=>{r.setVisualProfile({resolution,decoration});commands=[];r.game(g,false,50);return JSON.stringify(commands);};
     const high=draw('high'),highSize=r.canvas.width*r.canvas.height;
     const low=draw('low'),lowSize=r.canvas.width*r.canvas.height;
     check(high===low,`resolution changed decoration or geometry: ${decoration}`);
     check(lowSize<highSize,'resolution did not reduce backing pixels');
     checks.push({decoration,highPixels:highSize,lowPixels:lowSize});
    }
    check(JSON.stringify(g)===gameBefore,'render profile mutated simulation');
    // Decoration alone must not resize/clear the backing canvas, even at DPR 2.
    r.setVisualProfile({resolution:'high',decoration:'high'});
    context.fillStyle='#ff00ff';context.fillRect(0,0,1,1);
    const marker=context.getImageData(0,0,1,1).data;
    const width=r.canvas.width,height=r.canvas.height;
    r.setVisualProfile({decoration:'low'});
    check(r.canvas.width===width&&r.canvas.height===height,'decoration changed resolution');
    check(identical(marker,context.getImageData(0,0,1,1).data),'decoration cleared canvas');
    commands=[];r.game(g,false,50);const sparse=commands.length;
    r.setVisualProfile({decoration:'high'});commands=[];r.game(g,false,50);
    check(commands.length>sparse,'decoration control did not restore full effects');
    // Existing preset selection must restore both axes after experimentation.
    for(const mode of ['high','low']){
     r.setQuality(mode);r.setVisualProfile({decoration:mode==='high'?'low':'high'});r.setQuality(mode);
     check(r.resolution===mode&&r.decoration===mode,`preset did not reset both axes: ${mode}`);
    }
    return {checks,baseline:!!old};
   },!!process.env.PROFILE_BASELINE_PATH);
   assert.deepEqual(errors,[]);console.log('PASS independent resolution/decoration:',viewport,result);await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
