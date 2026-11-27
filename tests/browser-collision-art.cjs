// Audit current opaque bird cores against actual rendered artwork and transforms.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:640}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const result=await page.evaluate(async()=>{
   const {Renderer,drawBird}=await import('/js/render.mjs');
   const {playerShapes,hawkShapes}=await import('/js/collision.mjs');
   const c=document.createElement('canvas');c.width=960;c.height=640;document.body.replaceChildren(c);
   const r=new Renderer(c);await r.ready;const ctx=c.getContext('2d',{willReadFrequently:true});
   let samples=0,misses=0,poses=0;const failures=[];
   const check=(polys,label)=>{
    const rgba=ctx.getImageData(0,0,960,640).data;
    for(const poly of polys){
     const center=poly.reduce((p,v)=>({x:p.x+v.x/poly.length,y:p.y+v.y/poly.length}),{x:0,y:0});
     for(const v of [center,...poly.map(v=>({x:center.x+(v.x-center.x)*.65,y:center.y+(v.y-center.y)*.65}))]){
      samples++;const x=Math.round(v.x),y=Math.round(v.y);
      if(rgba[(y*960+x)*4+3]<112){misses++;if(failures.length<8)failures.push({label,x,y});}
     }
    }
    poses++;
   };
   for(const reduced of [false,true])for(let frame=0;frame<8;frame++){
    ctx.clearRect(0,0,960,640);
    const p={x:300,y:320,scale:1.04,angle:-.2,time:frame*.1,wing:1-(frame+.1)/8,flapImpulse:.7,reduced};
    drawBird(ctx,p);check(playerShapes(p.x,p.y,p.angle,p),'parrot/'+frame+'/'+reduced);
   }
   for(const reduced of [false,true])for(const dive of [false,true])for(let frame=0;frame<8;frame++){
    ctx.clearRect(0,0,960,640);
    const e={id:0,x:420,y:320,warning:0,phase:'crossing',dive,startX:900,targetX:160,startY:105,targetY:320};
    const time=(frame+.1)/16;r.hawk(e,time,reduced);check(hawkShapes(e,time,reduced),'hawk/'+dive+'/'+frame+'/'+reduced);
   }
   const {COLLISION_ART}=await import('/js/collision-art-data.mjs');
   let maskTiles=0;
   for(const [kind,path,count,columns,cell] of [['fruit','assets/runtime/foods.webp',48,8,128],['feather','assets/v4/feather.webp',1,1,384],['shield','assets/v4/shield.webp',1,1,384]]){
    const image=new Image();image.src=path;await image.decode();
    for(let f=0;f<count;f++){
     ctx.clearRect(0,0,960,640);ctx.drawImage(image,f%columns*cell,Math.floor(f/columns)*cell,cell,cell,0,0,cell,cell);
     const rgba=ctx.getImageData(0,0,cell,cell).data,spans=COLLISION_ART.pickups[kind][f];
     for(let row=0;row<16;row++)for(let col=0;col<16;col++){
      let visible=false;
      for(let y=row*cell/16;y<(row+1)*cell/16&&!visible;y++)for(let x=col*cell/16;x<(col+1)*cell/16;x++)if(rgba[(y*cell+x)*4+3]>=112){visible=true;break;}
      const solid=spans.some(([x,y,w])=>row===y&&col>=x&&col<x+w);
      if(solid!==visible)throw Error('Stale pickup mask '+kind+'/'+f+'/'+row+'/'+col);
      maskTiles++;
     }
    }
   }
   // Human-readable overlay from the exact production geometry, not copied boxes.
   ctx.clearRect(0,0,960,640);ctx.fillStyle='#edf2df';ctx.fillRect(0,0,960,640);
   const p={x:280,y:280,scale:1.04,time:.2,wing:.6,flapImpulse:.6};drawBird(ctx,p);
   const e={id:0,x:620,y:300,warning:0};r.hawk(e,.2,false);
   ctx.strokeStyle='#c22';ctx.lineWidth=1.5;
   for(const poly of [...playerShapes(p.x,p.y,0,p),...hawkShapes(e,.2,false)]){
    ctx.beginPath();poly.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.stroke();
   }
   return {poses,samples,misses,failures,maskTiles};
  });
  assert.equal(result.misses,0,JSON.stringify(result));assert.equal(result.poses,48);assert.equal(result.maskTiles,12800);assert.deepEqual(errors,[]);
  fs.mkdirSync('test-results/collision-art',{recursive:true});await page.screenshot({path:'test-results/collision-art/current-bodies.png'});
  console.log('PASS CURRENT_COLLISION_ART '+JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
