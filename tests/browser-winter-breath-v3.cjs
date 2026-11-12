// Dedicated real-art previews for the original four-cell clay-breath sheet.
// Used by the V3 final QA: do not synthesize substitute heads or silhouettes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out='test-results/climate-breath-v3';
fs.mkdirSync(out,{recursive:true});

(async()=>{
 const browser=await chromium.launch({
  executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']
 });
 try{
  for(const viewport of [{width:1366,height:638},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',route=>route.fulfill({body:'',contentType:'text/javascript'}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const results=await page.evaluate(async()=>{
    const [{Renderer,drawBird},{images},{winterBreathSettings}]=await Promise.all([
     import('/js/render.mjs'),import('/js/assets.mjs'),import('/js/winter-vfx.mjs')
    ]);
    const canvas=document.createElement('canvas');
    canvas.width=960;canvas.height=580;
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;background:#294a54';
    document.body.replaceChildren(canvas);
    const ctx=canvas.getContext('2d');
    const renderer=new Renderer(canvas);
    await renderer.ready;
    const breath=images.get('clay-breath');
    if(!breath||breath.naturalWidth!==512||breath.naturalHeight!==128)
      throw Error('Original breath atlas dimensions changed');
    const original=ctx.drawImage.bind(ctx);
    let breathDraws=0;
    ctx.drawImage=(...args)=>{
     if(args[0]===breath)breathDraws++;
     return original(...args);
    };
    const chooseTime=(kind)=>{
     let chosen=0,closest=Infinity;
     for(let i=0;i<1800;i++){
      const t=i/100,settings=winterBreathSettings(kind,1,t);
      if(!settings)continue;
      const phase=((settings.time/settings.period)%1+1)%1;
      const delta=Math.abs(phase-settings.duration*.5);
      if(delta<closest){closest=delta;chosen=t}
     }
     return chosen;
    };
    const draw=(kind,time,snow)=>{
     ctx.clearRect(0,0,canvas.width,canvas.height);
     ctx.fillStyle='#294a54';ctx.fillRect(0,0,canvas.width,canvas.height);
     const before=breathDraws;
     if(kind==='chaua')
       drawBird(ctx,{x:450,y:275,scale:1.9,time,wing:.30,snow,vy:0,flapImpulse:0});
     if(kind==='snake')
       renderer.snake({id:0,kind:'wood',x:390,top:120,bottom:410,
        snake:{kind:'snake',phase:'watching',age:2}},false,snow,0,time);
     if(kind==='hawk')
       renderer.hawk({id:0,kind:'hawk',x:440,y:275,phase:'crossing',warning:0,
        dive:false,retreat:false},time,false,false,0,false,snow,0);
     return breathDraws-before;
    };
    const rows=[];
    for(const kind of ['chaua','snake','hawk']){
      const time=chooseTime(kind);
      const cold=draw(kind,time,1);
      const frozen=canvas.toDataURL('image/png');
      const dry=draw(kind,time,0);
      const noWinter=canvas.toDataURL('image/png');
      rows.push({kind,time,cold,dry,frameCold:frozen,frameDry:noWinter});
    }
    return rows;
   });
   for(const row of results){
    assert.ok(row.cold>=1 && row.cold<=2,
     row.kind+' did not use existing breath animation in winter');
    assert.equal(row.dry,0,row.kind+' shows breath outside winter');
    for(const state of ['frameCold','frameDry']){
     const image=Buffer.from(row[state].split(',')[1],'base64');
     const file=path.join(out,viewport.width+'-'+row.kind+
      '-'+(state==='frameCold'?'winter':'dry')+'.png');
     fs.writeFileSync(file,image);
    }
    console.log('WINTER_BREATH_REAL_ART '+JSON.stringify({
     viewport,kind:row.kind,time:row.time,winterDrawCalls:row.cold,
     dryDrawCalls:row.dry
    }));
   }
   assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
