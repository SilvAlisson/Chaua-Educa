const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=process.env.GAME_URL||'http://127.0.0.1:5501/',out=process.env.SCREENSHOT_DIR||'test-results/immersion';
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});const errors=[];try{
 for(const viewport of [{width:1440,height:960},{width:390,height:844},{width:320,height:568}]){
  const p=await browser.newPage({viewport});p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await p.goto(root,{waitUntil:'networkidle'});await p.locator('#start-training:not([disabled])').waitFor();
  await p.locator('#open-collection').click();await p.waitForTimeout(450);
  assert.equal(await p.locator('.journal-card').count(),7);assert.equal(await p.locator('.journal-card:not(.is-locked)').count(),3);
  const width=await p.locator('.journal-card').first().evaluate(e=>e.getBoundingClientRect().width);assert.ok(width>=230,`unreadable card ${width}`);
  assert.equal(await p.locator('#collection-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1),true);
  await p.screenshot({path:path.join(out,`chauapedia-${viewport.width}.png`)});
  await p.locator('.journal-open:not([disabled])').first().click();await p.waitForTimeout(150);assert.equal(await p.locator('.journal-reading').isVisible(),true);assert.match(await p.locator('.journal-reading').innerText(),/Amazona/);await p.screenshot({path:path.join(out,`leitura-${viewport.width}.png`)});await p.locator('.journal-back').click();
  assert.equal(await p.locator('.journal-open:not([disabled])').first().evaluate(e=>e===document.activeElement),true);
  await p.locator('#journal-food-tab').click();assert.equal(await p.locator('.journal-food').count(),7);assert.equal(await p.locator('#nature-items').isVisible(),false);await p.screenshot({path:path.join(out,`alimentos-${viewport.width}.png`)});
  await p.locator('#journal-nature-tab').click();await p.keyboard.press('ArrowRight');assert.equal(await p.locator('#journal-food-tab').getAttribute('aria-selected'),'true');await p.locator('#collection-dialog .close-dialog').click();
  for(const [open,dialog]of [['#open-guide','#guide-dialog'],['#open-settings','#settings-dialog']]){
   await p.locator(open).click();const x=p.locator(`${dialog} .icon-btn`);await x.click({timeout:2000});assert.equal(await p.locator(dialog).isVisible(),false);
  }
  await p.close();
 }
 const p=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});await p.goto(root,{waitUntil:'networkidle'});await p.mouse.move(810,320);await p.mouse.wheel(0,900);await p.waitForTimeout(300);
 const rect=await p.locator('#btnStart').boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=390,'start remains unreachable in landscape');await p.screenshot({path:path.join(out,'paisagem-rolagem.png')});await p.close();
 const art=await browser.newPage({viewport:{width:1440,height:960}});await art.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));await art.goto(root,{waitUntil:'networkidle'});
 await art.evaluate(async()=>{
  const {Renderer}=await import('/js/render.mjs'),{Game}=await import('/js/engine.mjs');const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';document.body.replaceChildren(canvas);const r=new Renderer(canvas);await r.ready;window.scene={r,Game};
 });
 for(const [name,mode]of [['floresta','forest'],['cobra','snake'],['abrigo','refuge'],['impacto','impact']]){
  const metrics=await art.evaluate(mode=>{
   const {r,Game}=window.scene,g=new Game();g.state='paused';g.y=300;g.wing=.65;g.sceneTime=44;g.elapsed=44;g.stage=1;g.stageAge=10;g.distance=9000;
   g.entities=mode==='refuge'?[]:[{id:1,kind:'wood',x:520,top:180,bottom:430,variant:mode==='snake'?'branch':'plain',snake:mode==='snake'?{branch:true,phase:'occupied',age:2,retreat:false}:null}];
   if(mode==='refuge'){g.refuge={x:330,y:320};g.y=320;g.won=true;g.state='ended';g.arrival={offset:110,age:1.6};}
   if(mode==='impact'){g.state='playing';g.entities=[{id:2,kind:'wood',x:g.x-10,top:350,bottom:550,variant:'plain'}];g.nextSpawn=Infinity;g.tick(1/120);g.tick(.18);}
   r.game(g,false,44);return {state:g.state,impactContact:g.impactContact};
  },mode);if(mode==='impact')assert.ok(metrics.impactContact);await art.screenshot({path:path.join(out,name+'.png')});
 }
 // The refuge contains the player only, not scaled-down copies on a plank.
 const count=await art.evaluate(async()=>{const {images}=await import('/js/assets.mjs'),{r,Game}=window.scene,g=new Game();g.state='playing';g.refuge={x:330,y:320};g.entities=[];const c=r.c,original=c.drawImage;let count=0;c.drawImage=function(img,...args){if(img===images.get('chaua-atlas'))count++;return original.call(this,img,...args);};try{r.game(g,true);}finally{c.drawImage=original;}return count;});assert.equal(count,1);
 const penetration=await art.evaluate(async()=>{
  const {drawBird,woodContactPosition}=await import('/js/render.mjs'),{impactPose}=await import('/js/motion.mjs'),{r}=window.scene;let overlapping=0;
  for(const reduced of [false,true])for(const progress of [0,.1,.25,.5,.75,1]){
   const g={x:220,y:300,wing:.6,angle:.12,state:'impact',impactContact:{x:210,y:0,w:110,h:350}},p=woodContactPosition(g,progress,reduced);r.base();
   drawBird(r.c,{x:p.x,y:p.y,scale:.74,wing:g.wing,angle:g.angle,defeated:true,impactProgress:progress,reduced,time:1});
   const pixels=r.c.getImageData(210,0,110,350).data,hit=impactPose(progress,reduced),angle=g.angle+hit.angle,factor=27.7027*.74/60;
   const bx=p.x+hit.x+84*factor*Math.cos(angle)+12*factor*Math.sin(angle),by=p.y+hit.y+84*factor*Math.sin(angle)-12*factor*Math.cos(angle);
   for(let k=0;k<pixels.length;k+=4){const red=pixels[k],green=pixels[k+1],blue=pixels[k+2],alpha=pixels[k+3],x=210+(k/4)%110,y=Math.floor(k/4/110);
    // Golden stars are intentional contact effects, not the animal. Check green
    // plumage plus orange pixels around the registered beak, excluding those stars.
    if(alpha>100&&((green>red*1.2&&green>blue*.85)||(red>170&&green>65&&green<210&&blue<110&&Math.hypot(x-bx,y-by)<20)))overlapping++;
   }
  }
  return overlapping;
 });assert.equal(penetration,0,'visible bird pixels enter the wood after contact');
 await art.close();assert.deepEqual(errors,[]);console.log('PASS redesigned Chauapedia: three sizes, readable cards, detail, food tab, keyboard, back focus, sources and no missing resources');console.log('PASS close buttons, landscape touch viewport, organic-world screenshots, refuge without miniature birds and fatal-contact rendering');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
