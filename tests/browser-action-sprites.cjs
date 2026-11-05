const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const url=process.env.GAME_URL||'http://127.0.0.1:5501/';
const sheets={
 '/public/parrot/fly/flight.webp':[1024,512],
 '/public/parrot/animations/impact.webp':[768,512],
 '/public/hawk/fly/flight.webp':[1280,640],
 '/public/hawk/animations/stunned.webp':[960,640],
 '/public/snake/animations/strike.webp':[960,640],
 '/public/snake/animations/stunned.webp':[960,640],
};
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{
 for(const viewport of [{width:1200,height:720},{width:390,height:844}]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  const prepared={};
  for(const [name,[w,h]] of Object.entries(sheets)){
    const b64=await page.evaluate(({w,h})=>{
      const c=document.createElement('canvas');c.width=w;c.height=h;
      const ctx=c.getContext('2d');const n=Math.round(w/(w>=1024?4:3));
      const cols=w/n,rows=h/n;
      for(let i=0;i<cols*rows;i++){
        const x=i%cols*n,y=Math.floor(i/cols)*n;
        ctx.fillStyle='hsl('+(i*51%360)+',70%,70%)';
        ctx.fillRect(x+30,y+30,n-60,n-60);
      }
      return c.toDataURL('image/webp',.7).split(',')[1];
    },{w,h});
    prepared[name]=Buffer.from(b64,'base64');
  }
  await page.route('**/public/**',async route=>{
    const pathName=new URL(route.request().url()).pathname;
    if(prepared[pathName])await route.fulfill({body:prepared[pathName],contentType:'image/webp'});
    else await route.continue();
  });
  await page.goto(url+'?actionSprites=1',{waitUntil:'networkidle'});
  const results=await page.evaluate(async()=>{
    const sheets=await import('/js/action-sheets.mjs');
    const {Renderer,drawBird}=await import('/js/render.mjs');
    await sheets.preloadActionSheets();
    const hasAll=['parrot-flight','parrot-impact','hawk-flight','hawk-stunned','snake-strike','snake-stunned']
      .every(key=>sheets.hasActionSheet(key));
    const cv=document.createElement('canvas');cv.width=1100;cv.height=720;
    cv.style.cssText='position:fixed;z-index:999999;inset:0;background:#365a39';
    document.body.append(cv);const ctx=cv.getContext('2d',{willReadFrequently:true});
    const r=new Renderer(cv);await r.ready;
    const snake={id:2,kind:'wood',x:200,top:100,bottom:440,snake:{kind:'snake',phase:'striking',phaseAge:.15,age:3}};
    r.snake(snake,false);
    snake.snake={kind:'snake',retreat:true,dazed:true,retreatTime:.34,phase:'retreat'};
    snake.x=440;r.snake(snake,false);
    r.hawk({id:3,kind:'hawk',x:760,y:200,warning:0,phase:'crossing'},2,false);
    r.hawk({id:4,kind:'hawk',x:920,y:340,warning:0,retreat:true,dazed:true,retreatTime:.25},2,false);
    drawBird(ctx,{x:250,y:570,scale:1,wing:.7,time:1});
    drawBird(ctx,{x:500,y:570,scale:1,defeated:true,impactProgress:.65,time:2});
    const data=ctx.getImageData(0,0,1100,720).data;let painted=0;
    for(let k=3;k<data.length;k+=4)if(data[k]>25)painted++;
    return {hasAll,painted,enabled:sheets.ACTION_SPRITES_ENABLED};
  });
  assert.equal(results.enabled,true);
  assert.equal(results.hasAll,true);
  assert.ok(results.painted>15000,'characters not rendered');
  assert.deepEqual(pageErrors,[],'uncaught browser errors');
  const dir='test-results/action-sprites';fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'preview-'+viewport.width+'.png');
  await page.screenshot({path:file});
  console.log('ACTION_SPRITE_QA '+JSON.stringify({viewport,...results,file}));
  await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
