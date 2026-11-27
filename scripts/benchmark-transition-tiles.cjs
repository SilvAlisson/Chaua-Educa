// Prototype only: verify that rendering one quarter of a large backdrop
// each RAF can flatten a 40ms recompose spike without seams or detail loss.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const x=await page.evaluate(async()=>{
   const {Renderer}=await import('/js/render.mjs');
   const {images}=await import('/js/assets.mjs');
   const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';
   document.body.append(canvas);
   const r=new Renderer(canvas);await r.ready;
   const forest=images.get('forest');
   if(!forest)throw Error('forest missing');
   const w=r.canvas.width,h=r.canvas.height,dpr=r.dpr;
   const create=()=>{
    const c=new OffscreenCanvas(w,h),ctx=c.getContext('2d',{alpha:false,willReadFrequently:true});
    return {c,ctx};
   };
   const full=create(),tiles=create();
   const light='rgb(226,220,160)',alpha=.78,drift=2.125;
   const factor=Math.max(r.w/forest.naturalWidth,r.h/forest.naturalHeight)*1.08;
   const fw=forest.naturalWidth*factor,fh=forest.naturalHeight*factor;
   const paint=(c,y0,y1)=>{
    c.save();c.setTransform(1,0,0,1,0,0);
    c.beginPath();c.rect(0,y0,w,y1-y0);c.clip();
    c.setTransform(dpr,0,0,dpr,0,0);
    c.globalAlpha=1;r.paintSky(c,light);
    c.globalAlpha=alpha;
    c.drawImage(forest,(r.w-fw)/2+drift,(r.h-fh)/2,fw,fh);
    c.restore();
   };
   paint(full.ctx,0,h);
   for(let i=0;i<4;i++)paint(tiles.ctx,Math.floor(h*i/4),i===3?h:Math.floor(h*(i+1)/4));
   const a=full.ctx.getImageData(0,0,w,h).data,b=tiles.ctx.getImageData(0,0,w,h).data;
   let changes=0,max=0,total=0,over5=0;
   for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d)changes++;total+=d;max=Math.max(max,d);if(d>5)over5++;}
   const times={full:[],tile0:[],tile1:[],tile2:[],tile3:[]};
   for(let k=0;k<44;k++){
    for(const kind of k%2?['tile','full']:['full','tile']){
     const target=kind==='tile'?tiles:full;
     if(kind==='full'){
      const t=performance.now();paint(target.ctx,0,h);target.ctx.getImageData(0,0,1,1);
      if(k>=4)times.full.push(performance.now()-t);
     }else{
      for(let i=0;i<4;i++){
       const y0=Math.floor(h*i/4),y1=i===3?h:Math.floor(h*(i+1)/4);
       const t=performance.now();
       paint(target.ctx,y0,y1);
       target.ctx.getImageData(0,y0,1,1);
       if(k>=4)times['tile'+i].push(performance.now()-t);
      }
     }
    }
   }
   const calc=a=>{
    const s=[...a].sort((a,b)=>a-b);return {mean:a.reduce((x,y)=>x+y,0)/a.length,
     median:s[Math.floor((s.length-1)*.5)],p95:s[Math.floor((s.length-1)*.95)],max:s[s.length-1]};
   };
   return {pixels:w*h,visual:{changedChannels:changes,maxDelta:max,mae:total/a.length,over5Fraction:over5/a.length},
    timings:Object.fromEntries(Object.entries(times).map(([name,values])=>[name,calc(values)]))};
  });
  assert.deepEqual(errors,[]);
  console.log('TILE_PROTOTYPE_RESULT '+JSON.stringify(x));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
