const assert=require('node:assert/strict');
const {existsSync}=require('node:fs');
const {chromium}=require('playwright');
function components(pixels,width,height,select){
 const seen=new Uint8Array(width*height),queue=new Int32Array(width*height),parts=[];
 const selected=i=>{const p=i*4;return select(pixels[p],pixels[p+1],pixels[p+2],pixels[p+3]);};
 for(let i=0;i<seen.length;i++)if(!seen[i]&&selected(i)){
  let read=0,write=1,minX=width,minY=height,maxX=0,maxY=0;queue[0]=i;seen[i]=1;
  while(read<write){const at=queue[read++],x=at%width,y=Math.floor(at/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(const n of [x>0?at-1:-1,x<width-1?at+1:-1,at-width,at+width,x>0?at-width-1:-1,x<width-1?at-width+1:-1,x>0?at+width-1:-1,x<width-1?at+width+1:-1])if(n>=0&&n<seen.length&&!seen[n]&&selected(n)){seen[n]=1;queue[write++]=n;}
  }
  parts.push({area:write,x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1});
 }
 return parts.sort((a,b)=>b.area-a.area);
}
(async()=>{
 const executablePath=process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 const browser=await chromium.launch({executablePath,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:512,height:512}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   const {Renderer,drawBird}=await import('/js/render.mjs');const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:512px;height:512px';document.body.replaceChildren(canvas);
   const r=new Renderer(canvas);await r.ready;window.visualTest={r,drawBird};
  });
  await page.evaluate(source=>{window.pixelComponents=Function('return ('+source+')')();},components.toString());
  const atlasChecks=await page.evaluate(async()=>{
   const {SPRITES}=await import('/js/sprite-data.mjs'),{images}=await import('/js/assets.mjs');
   const result=[];const cell=document.createElement('canvas');cell.width=384;cell.height=384;const c=cell.getContext('2d',{willReadFrequently:true});
   for(const [name,data]of Object.entries(SPRITES))for(let i=0;i<16;i++){
    c.clearRect(0,0,384,384);c.drawImage(images.get(`${name}-atlas`),...data.frames[i].rect,0,0,384,384);
    const p=c.getImageData(0,0,384,384).data;let gutter=0;
    for(let y=0;y<384;y++)for(let x=0;x<384;x++)if(x<10||y<10||x>=374||y>=374)gutter=Math.max(gutter,p[(y*384+x)*4+3]);
    const parts=window.pixelComponents(p,384,384,(r,g,b,a)=>a>100),total=parts.reduce((n,p)=>n+p.area,0);
    result.push({name,i,gutter,body:parts[0]?.area||0,connected:(parts[0]?.area||0)/total});
   }
   return result;
  });
  for(const f of atlasChecks){assert.equal(f.gutter,0,`${f.name} ${f.i}: clipped gutter`);assert.ok(f.body>300&&f.connected>.97,`${f.name} ${f.i}: missing or fragmented body`);}
  console.log('PASS 48 authored atlas cells: transparent gutters, complete principal silhouettes');
  const blinkChecks=await page.evaluate(async()=>{
   const {drawBird}=window.visualTest,{SPRITES}=await import('/js/sprite-data.mjs');
   const canvas=document.createElement('canvas');canvas.width=800;canvas.height=700;const c=canvas.getContext('2d',{willReadFrequently:true}),results=[];
   for(const scale of [.36,.74,2.145,4.16]){
    const factor=27.7027*scale/SPRITES.chaua.landmarkWidth,eye=SPRITES.chaua.frames[12].eye;
    const ex=400+(eye[0]-192)*factor,ey=250+(eye[1]-192)*factor;
    const draw=time=>{c.clearRect(0,0,800,700);drawBird(c,{x:400,y:250,scale,perched:true,time});return c.getImageData(0,0,800,700).data;};
    const initial=draw(0);let eyeChanges=0;
    for(const time of [3.6,3.66,3.775,3.86,3.99,4]){
     const pixels=draw(time);let outside=0;
     for(let y=0;y<700;y++)for(let x=0;x<800;x++){
      const k=(y*800+x)*4,changed=initial[k]!==pixels[k]||initial[k+1]!==pixels[k+1]||initial[k+2]!==pixels[k+2]||initial[k+3]!==pixels[k+3];
      if(!changed)continue;
      if(Math.abs(x-ex)>21*factor+2||Math.abs(y-ey)>25*factor+2)outside++;else eyeChanges++;
     }
     results.push({scale,time,outside});
    }
    results.push({scale,eyeChanges});
   }
   return results;
  });
  for(const r of blinkChecks){if('outside'in r)assert.equal(r.outside,0,`blink moves body/feet at scale ${r.scale}, time ${r.time}`);else assert.ok(r.eyeChanges>0,`blink missing at scale ${r.scale}`);}
  console.log('PASS perched blink at four scales: only the eye changes, body and feet stay registered');
  const snakeChecks=await page.evaluate(async()=>{
   const {images}=await import('/js/assets.mjs'),{Game}=await import('/js/engine.mjs'),{SPRITES}=await import('/js/sprite-data.mjs'),{snakePlacement}=await import('/js/animation.mjs');
   const {r}=window.visualTest,c=r.c,g=new Game();g.reducedMotion=true;const results=[];
   const original=c.drawImage;
   try{
    for(const branch of [false,true])for(const phase of ['watching','warning','windup','striking','recovering','spent','leaving'])for(const age of [.1,.4,.8,1.3,2]){
     const wood={kind:'wood',x:220,bottom:320,snake:{branch,phase,age,retreat:false}},calls=[];
     c.drawImage=function(image,...args){if(image===images.get('snake-atlas'))calls.push(args);return original.call(this,image,...args);};r.base();r.snake(wood,true);
     const [sx,sy,sw,sh,dx,dy,dw,dh]=calls[0],frame=SPRITES.snake.frames.find(f=>f.rect[0]===sx&&f.rect[1]===sy),[cx,cy,rx,ry]=frame.head,p=snakePlacement(wood);
     const shown={x:p.x+dx+(cx-rx)*dw/sw,y:p.y+dy+(cy-ry)*dh/sh,w:rx*2*dw/sw,h:ry*2*dh/sh},actual=g.snakeRects(wood)[0];
     results.push({branch,phase,age,delta:Math.max(...Object.keys(shown).map(k=>Math.abs(shown[k]-actual[k])))});
    }
   }finally{c.drawImage=original;}
   return results;
  });
  for(const r of snakeChecks)assert.ok(r.delta<1e-8,`reduced-motion head mismatch: ${JSON.stringify(r)}`);
  console.log('PASS reduced-motion snake geometry matches the actual rendered atlas frame on trunks and branches');
  const beaks=[];
  for(let i=0;i<60;i++){
   const beak=await page.evaluate(i=>{
    const {r,drawBird}=window.visualTest;r.base();const cases=[{}, {vy:360},{turbo:true},{reaction:.13},{stamina:.1},{defeated:true,impactProgress:0}];
    drawBird(r.c,{x:256,y:256,scale:.74,wing:(i%10)/9,time:2.5,...cases[Math.floor(i/10)%cases.length]});
    return window.pixelComponents(r.c.getImageData(0,0,512,512).data,512,512,(r,g,b,a)=>a>180&&r>180&&g>65&&g<200&&b<85).find(p=>p.x>270);
   },i);
   assert.ok(beak,'beak landmark missing');beaks.push(beak);
  }
  for(const key of ['w','h','x','y'])assert.ok(Math.max(...beaks.map(b=>b[key]))-Math.min(...beaks.map(b=>b[key]))<=2,`unstable beak ${key}`);
  console.log('PASS 60 bird frames: stable beak dimensions/anchor across poses, falling, turbo, pickups, fatigue and impact');
  for(let i=0;i<144;i++){
   const pieces=await page.evaluate(i=>{
    const {r}=window.visualTest;r.base();r.hawk({id:3,x:256,y:256,warning:0,dive:i>=72,startX:400,startY:256,targetX:100,targetY:i>=72?400:256},.01+(i%72)/60,false);
    return window.pixelComponents(r.c.getImageData(0,0,512,512).data,512,512,(r,g,b,a)=>a>100&&!(r>245&&g>245&&b>245&&a<140)).filter(p=>p.area>=3);
   },i);
   assert.equal(pieces.length,1,`detached predator fragments at frame ${i}: ${JSON.stringify(pieces)}`);
  }
  console.log('PASS 144 predator frames (crossing and dive): no detached visible fragments');
  assert.deepEqual(errors,[]);console.log('PASS no JavaScript errors during visual regression');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
