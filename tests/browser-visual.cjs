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
