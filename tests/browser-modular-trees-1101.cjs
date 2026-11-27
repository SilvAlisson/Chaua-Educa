const assert=require('node:assert/strict'),fs=require('node:fs/promises'),pw=require('playwright');
(async()=>{
 const name=process.env.TREE_BROWSER||'chromium',browser=await pw[name].launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/js\/script\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:''}));
  // Static art probes jump between snow levels without a flight clock.
   const artUrl=new URL(process.env.GAME_URL||'http://127.0.0.1:5501/');
   artUrl.searchParams.set('perf-test','1');
   artUrl.searchParams.set('perf-ab','pixi-webgl-winter');
   artUrl.searchParams.set('perf-winter','eager');
   await page.goto(artUrl.toString(),{waitUntil:'networkidle'});
  const result=await page.evaluate(async()=>{
   const {loadAssets,images}=await import('/js/assets.mjs');await loadAssets();
   const {drawLivingTrunk,drawTreeVariant,prepareTreeWeather}=await import('/js/tree-art.mjs');
   const {TREE_WIDTH}=await import('/js/forest-geometry.mjs');
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=900;
   document.body.replaceChildren(canvas);document.body.style.margin=0;
   const c=canvas.getContext('2d',{willReadFrequently:true});
   prepareTreeWeather(c);
   // Once warmed, changing tree length, weather and pose must not allocate patterns.
   const create=c.createPattern.bind(c);let latePatterns=0;
   c.createPattern=(...args)=>{latePatterns++;return create(...args);};
   const probes=[];
   for(const upper of [false,true])for(let variant=0;variant<4;variant++){
    c.clearRect(0,0,1280,900);
    const y=upper?600:100;
    drawLivingTrunk(c,{x:300,y,upper,variant,length:800});
    const p=c.getImageData(0,0,1280,900).data;
    const at=(x,y,k=3)=>p[(Math.round(y)*1280+Math.round(x))*4+k];
    const extensionStart=upper?10:400,extensionEnd=upper?300:880;
    const colors=new Set();
    for(let y=extensionStart;y<extensionEnd;y+=7){
     if(at(300,y)<240)throw Error('Gap in bark '+upper+'/'+variant+'/'+y);
     if(at(300-TREE_WIDTH/2-5,y)>0||at(300+TREE_WIDTH/2+5,y)>0)throw Error('Extension escapes collision core');
     colors.add([at(300,y,0),at(300,y,1),at(300,y,2)].join(','));
    }
    if(colors.size<12)throw Error('Bark detail collapsed into a stretched scanline');
    probes.push({upper,variant,colors:colors.size});
   }
   for(const upper of [false,true])for(const kind of ['rot','hollow','moss','vine']){
    c.clearRect(0,0,1280,900);drawTreeVariant(c,300,upper?600:100,upper,kind,undefined,1,1,0,800);
    const p=c.getImageData(300,upper?20:850,1,1).data;
    if(p[3]<240)throw Error('Variant bark gap '+kind+'/'+upper);
   }
   if(latePatterns)throw Error('Tree patterns rebuilt after asset warmup: '+latePatterns);
   // Exact same frozen scene must render identically, including weather and fracture.
   const draw=(snow,age)=>{
    c.clearRect(0,0,1280,900);c.fillStyle='#e9eddf';c.fillRect(0,0,1280,900);
    const names=['Viva 1','Viva 2','Viva 3','Viva 4','Podre','Oca'];
    for(let i=0;i<6;i++){
     const x=105+i*210;
     if(i<4){
      drawLivingTrunk(c,{x,y:310,upper:true,variant:i,length:900,snow,rain:.6});
      drawLivingTrunk(c,{x,y:440,variant:i,length:900,snow,rain:.6});
     }else{
      drawTreeVariant(c,x,310,true,i===4?'rot':'hollow',age,snow,.6,0,900);
      drawTreeVariant(c,x,440,false,i===4?'rot':'hollow',age,snow,.6,0,900);
     }
     c.fillStyle='#153c29';c.font='18px sans-serif';c.textAlign='center';c.fillText(names[i],x,380);
    }
   };
   window.drawTrees=draw;
   draw(.5,undefined);const first=c.getImageData(0,0,1280,900).data;
   draw(.5,undefined);const second=c.getImageData(0,0,1280,900).data;
   if(!first.every((v,i)=>v===second[i]))throw Error('Paused trees change between renders');
   return {probes,latePatterns};
  });
  await fs.mkdir('test-results/modular-trees',{recursive:true});
  for(const [label,snow,age] of [['bare',0,null],['winter',1,null],['breaking',.5,.12]]){
   await page.evaluate(({snow,age})=>drawTrees(snow,age===null?undefined:age),{snow,age});
   await page.screenshot({path:'test-results/modular-trees/'+name+'-'+label+'.png'});
   if(name==='chromium'){
    const preview=await page.locator('canvas').evaluate(e=>e.toDataURL('image/webp',.8).split(',')[1]);
    console.log('TREE_PREVIEW_BEGIN '+label);
    for(let i=0;i<preview.length;i+=8000)console.log('TREE_PREVIEW_CHUNK '+preview.slice(i,i+8000));
    console.log('TREE_PREVIEW_END');
   }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS MODULAR TREES '+name+' '+JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
