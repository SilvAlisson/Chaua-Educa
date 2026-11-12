// Real production sprite QA. Never fabricate substitute images for the shipped art.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
 for(const viewport of [{width:1200,height:720},{width:390,height:844}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const result=await page.evaluate(async()=>{
   const sheets=await import('/js/action-sheets.mjs');
   const a2=await import('/js/snake-a2.mjs');
   const {Renderer,drawBird}=await import('/js/render.mjs');
   const c=document.createElement('canvas');c.width=1100;c.height=720;
   document.body.replaceChildren(c);
   const r=new Renderer(c);await r.ready;
   const keys=await sheets.preloadActionSheets();
   const required=['parrot-flight','parrot-impact','hawk-flight','hawk-stunned'];
   const ready=required.every(key=>sheets.hasActionSheet(key));
   const obsolete=['snake-strike','snake-stunned'].some(key=>sheets.hasActionSheet(key));
   const ctx=r.c;
   r.snake({id:2,kind:'wood',x:200,top:100,bottom:440,snake:{phase:'striking',phaseAge:.15,age:3}},false);
   r.snake({id:3,kind:'wood',x:440,top:100,bottom:440,snake:{phase:'retreat',retreat:true,dazed:true,retreatTime:.34}},false);
   r.hawk({id:4,kind:'hawk',x:760,y:200,warning:0,phase:'crossing'},2,false);
   r.hawk({id:5,kind:'hawk',x:920,y:340,warning:0,retreat:true,dazed:true,retreatTime:.25},2,false);
   drawBird(ctx,{x:250,y:570,scale:1,wing:.7,time:1});
   drawBird(ctx,{x:500,y:570,scale:1,defeated:true,impactProgress:.65,time:2});
   const pixels=ctx.getImageData(0,0,1100,720).data;let painted=0;
   for(let i=3;i<pixels.length;i+=4)if(pixels[i]>25)painted++;
   return {ready,a2:a2.isSnakeA2Ready(),obsolete,keys:keys.length,painted};
  });
  assert.equal(result.ready,true,'Genuine bird/hawk sheets missing');
  assert.equal(result.a2,true,'Official A2 snake not ready');
  assert.equal(result.obsolete,false,'Unused alternative snake sheets were still preloaded');
  assert.equal(result.keys,4);
  assert.ok(result.painted>15000,'Characters not rendered');
  assert.deepEqual(errors,[]);
  const folder='test-results/action-sprites';fs.mkdirSync(folder,{recursive:true});
  const file=path.join(folder,'official-'+viewport.width+'.png');
  await page.screenshot({path:file});
  console.log('PASS REAL_SPRITES '+JSON.stringify({viewport,...result,file}));
  await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
