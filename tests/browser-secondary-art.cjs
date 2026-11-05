const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out='test-results/secondary-art';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox'],executablePath:process.env.CHROMIUM_PATH||undefined});
 try{
  for(const viewport of [{width:960,height:640},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:2}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
   const r=await page.evaluate(async()=>{
    const {images,loadAssets}=await import('/js/assets.mjs');
    const {drawSnakeWrap}=await import('/js/snake-wrap-render.mjs');
    const {Renderer}=await import('/js/render.mjs');
    await loadAssets();
    const wrap=images.get('snake-wrap');
    const make=(width=750,height=510)=>{
      const cv=document.createElement('canvas');cv.width=width;cv.height=height;
      return {cv,ctx:cv.getContext('2d',{willReadFrequently:true})};
    };
    const a=make(),b=make(),c=make(),d=make();
    const draw=(surface,method,age,reduced,scale=3)=>{
      const ctx=surface.ctx;
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,750,510);
      ctx.translate(370,150);ctx.scale(scale,scale);
      if(method==='original')ctx.drawImage(wrap,-63,-8,126,99.0938);
      else drawSnakeWrap(ctx,wrap,{age,phase:'watching'},reduced);
    };
    draw(a,'original',0,false);draw(b,'new',0,false);
    draw(c,'new',.27,false);draw(d,'new',.27,true);
    const pix=item=>item.ctx.getImageData(0,0,750,510).data;
    const orig=pix(a),rest=pix(b),moving=pix(c),reduced=pix(d);
    let atRest=0,reducedChanged=0,motionChanged=0,outside=0;
    // The terminal curl lives to the left of the stump. The entire rest of
    // the image must remain unchanged, pixel for pixel.
    const worldX=x=>370+(-63+x/384*126)*3;
    const worldY=y=>150+(-8+y/302*99.0938)*3;
    const xRight=worldX(70),yTop=worldY(183),yBottom=worldY(284);
    for(let y=0;y<510;y++)for(let x=0;x<750;x++){
      const n=(y*750+x)*4;
      for(let q=0;q<4;q++){
       atRest+=Number(orig[n+q]!==rest[n+q]);
       reducedChanged+=Number(orig[n+q]!==reduced[n+q]);
       if(orig[n+q]!==moving[n+q]){
        motionChanged++;
        if(!(x>=worldX(0)-2&&x<=xRight+2&&y>=yTop-2&&y<=yBottom+2))outside++;
       }
      }
    }
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
    document.body.replaceChildren(canvas);
    const renderer=new Renderer(canvas);await renderer.ready;
    const snake={id:2,kind:'wood',x:430,top:160,bottom:440,snake:{age:8,retreat:true,dazed:true,retreatTime:.28,retreatPose:{x:0,y:0,angle:0,mouth:0}}};
    const hawk={id:3,kind:'hawk',x:660,y:285,warning:0,retreat:true,dazed:true,retreatTime:.28,phase:'retreat'};
    renderer.base();renderer.snake(snake,false);renderer.hawk(hawk,8,false);
    return {atRest,reducedChanged,motionChanged,outside,
      snakeArtUnchanged:images.get('snake-atlas')?.naturalWidth===1536,
      hawkArtUnchanged:images.get('hawk-atlas')?.naturalWidth===1536};
   });
   assert.deepEqual(errors,[],'browser errors');
   assert.equal(r.atRest,0,'original tail changed while motion=0');
   assert.equal(r.reducedChanged,0,'reduced motion changed original artwork');
   assert.ok(r.motionChanged>10,'tail lacks visible movement');
   assert.equal(r.outside,0,'pixels outside original tip unexpectedly changed');
   assert.equal(r.snakeArtUnchanged,true);
   assert.equal(r.hawkArtUnchanged,true);
   const shot=path.join(out,'shield-characters-'+viewport.width+'.png');
   await page.screenshot({path:shot});
   console.log('SECONDARY_ART_RESULT '+JSON.stringify({viewport,...r,screenshot:shot}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
