const playwright=require('playwright');
const browserName=process.env.WEATHER_BROWSER||'chromium';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await playwright[browserName].launch({executablePath:browserName==='chromium'?process.env.CHROMIUM_PATH||undefined:undefined,args:browserName==='chromium'?['--no-sandbox']:[]});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/script.js',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5501/',{waitUntil:'networkidle'});
  const measured=await page.evaluate(async()=>{
   const [{Renderer},{AnimalWeather,animalContactPoints},{ANIMAL_CONTACTS},{Game}]=await Promise.all([
    import('/js/render.mjs'),import('/js/animal-weather.mjs'),import('/js/animal-contact-data.mjs'),import('/js/engine.mjs')]);
   const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1120;canvas.id='animal-contact-proof';
   canvas.style.cssText='position:absolute;left:0;top:0;z-index:99999;background:#405e58';document.body.replaceChildren(canvas);
   const r=new Renderer(canvas);await r.ready;canvas.width=1600;canvas.height=1120;
   const c=canvas.getContext('2d');
   const paths={
    'parrot-flight':['public/parrot/fly/flight.webp',256], 'hawk-flight':['public/hawk/fly/flight.webp',320],
    chaua:['assets/v6/chaua-atlas.webp',384],hawk:['assets/v6/hawk-atlas.webp',384],
    'snake-idle':['public/snake/base/idle.webp',384],'snake-attack':['public/snake/attack/attack.webp',384],
    'snake-stunned':['public/snake/reactions/stunned.webp',384],
    'snake-high':['public/snake/attack/high.webp',384],'snake-sweep':['public/snake/attack/sweep.webp',384]};
   let anchors=0;
   const loaded={};
   for(const [key,[path,cell]] of Object.entries(paths)){
    const image=new Image();image.src=new URL(path,location.href);await image.decode();loaded[key]=image;
    const sample=document.createElement('canvas');sample.width=image.width;sample.height=image.height;
    const s=sample.getContext('2d',{willReadFrequently:true});s.drawImage(image,0,0);
    const pixels=s.getImageData(0,0,image.width,image.height).data;
    ANIMAL_CONTACTS[key].forEach((points,frame)=>points.forEach(([x,y])=>{
     const ox=(frame%(image.width/cell))*cell,oy=Math.floor(frame/(image.width/cell))*cell;
     if(pixels[((oy+y)*image.width+ox+x)*4+3]<235)throw Error(`${key}:${frame} contact is outside authored surface`);
     if(key.startsWith('snake-')&&y<cell*.64)throw Error('Snake contact overlaps head region');
     anchors++;
    }));
   }
   c.fillStyle='#405e58';c.fillRect(0,0,1600,1120);
   let row=0;
   for(const key of ['parrot-flight','hawk-flight','snake-idle','snake-attack']){
    const cell=paths[key][1],image=loaded[key];
    for(let frame=0;frame<8;frame++){
     const x=100+frame*200,y=145+row*270;
     c.save();c.translate(x,y);
     c.drawImage(image,frame%4*cell,Math.floor(frame/4)*cell,cell,cell,-95,-95,190,190);
     const fx=new AnimalWeather();fx.begin(c,{time:0,snow:row<2?1:.7,wet:1});
     fx.actor(c,{id:key,pose:{sheet:key,frame,rect:[-95,-95,190,190]}});fx.draw(c);
     c.fillStyle='#fff';c.font='13px sans-serif';c.fillText(`${key} ${frame}`,-90,110);c.restore();
    }
    row++;
   }
   // Exercise the production integration, not only the surface utility.
   const g=new Game({seed:42});g.state='playing';g.elapsed=80;g.sceneTime=80;g.surfaceWeather={snow:.7,wet:1,drip:0};
   g.entities=[{id:91,kind:'wood',x:500,top:120,bottom:420,snake:{phase:'striking',phaseAge:.08,age:2}},
    {id:92,kind:'hawk',x:720,y:260,warning:0,dive:true,startX:1000,targetX:100,retreat:false}];
   const seen=[];const actor=r.animalWeather.actor.bind(r.animalWeather);
   r.animalWeather.actor=(ctx,options)=>{seen.push(options);actor(ctx,options);};
   const testCanvas=document.createElement('canvas');testCanvas.width=1000;testCanvas.height=600;
   // Keep the contact gallery intact while checking the actual renderer.
   const originalContext=r.c;r.c=testCanvas.getContext('2d');
   r.game(g,false);r.c=originalContext;
   return {anchors,seen:seen.map(x=>({id:x.id,sheet:x.pose.sheet,frame:x.pose.frame,mirror:x.pose.mirror})),particles:r.animalWeather.particles.length};
  });
  console.log('Animal contact measurements',measured);
  assert.equal(measured.anchors,264);
  assert.ok(measured.seen.some(x=>x.id==='chaua'&&x.sheet==='parrot-flight'));
  assert.ok(measured.seen.some(x=>x.id==='snake:91'&&x.sheet==='snake-attack'&&x.mirror));
  assert.ok(measured.seen.some(x=>x.id==='hawk:92'));
  assert.deepEqual(errors,[]);
  await fs.mkdir('test-results/animal-weather',{recursive:true});
  await page.locator('#animal-contact-proof').screenshot({path:`test-results/animal-weather/contact-poses${browserName==='chromium'?'':'-'+browserName}.png`});
  console.log('PASS animal weather contact opacity and production pose selection',browserName,measured);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
