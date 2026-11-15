import {loadAssets} from './assets.mjs';
import {drawLivingTrunk} from './tree-art.mjs';
import {TREE_WIDTH} from './forest-geometry.mjs';
import {preloadSnakeA2,drawSnakeA2,snakeA2CollisionRects,snakePlacement,snakeA2Pose} from './snake-a2.mjs';
import {SNAKE_TIMING} from './animals.mjs';
import {preloadArticulatedSnakeProto,drawArticulatedSnakeProto,articulatedSnakeCircles} from './snake-articulated-proto.mjs';
import {labDuration,labState,labCursor} from './snake-lab-timeline.mjs';
const $=id=>document.getElementById(id);
const contexts=[$('canvasA2').getContext('2d'),$('canvasArt').getContext('2d')];
const wood={x:230,bottom:315,snake:{}};
let cursor=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,lastLabel=0,frame=0;
let samples=[[],[]],intervals=[],warmup=0;
const cards=[...document.querySelectorAll('.card')];
const active=()=> $('viewMode').value==='official'?[0]:$('viewMode').value==='rig'?[1]:[0,1];
$('reduced').checked=paused;
function pause(value){if(paused!==value)clearMetrics();paused=value;$('btnPause').textContent=paused?'Reproduzir':'Pausar';}
pause(paused);
function clearMetrics(){samples=[[],[]];intervals=[];warmup=0;last=0;lastLabel=0;}
function reset(){cursor=0;clearMetrics();}
for(const id of ['attackType','phaseMode','actorCount','reduced','timeScale','viewMode','showWireframe','showHitbox','showAnchor'])$(id).addEventListener('change',reset);
$('viewMode').addEventListener('change',()=>{
 const visible=active();cards.forEach((card,i)=>{card.hidden=!visible.includes(i);});
 document.querySelector('.stage-grid').classList.toggle('solo',visible.length===1);
});
$('btnExport').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify(report(),null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`chaua-cobra-${$('viewMode').value}-${Date.now()}.json`;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('btnPause').addEventListener('click',()=>pause(!paused));
$('btnTrigger').addEventListener('click',()=>{$('phaseMode').value='auto';reset();cursor=.7+SNAKE_TIMING.warning;pause(false);});
$('seek').addEventListener('input',()=>{pause(true);cursor=Number($('seek').value)/1000*labDuration($('attackType').value,$('phaseMode').value);});
function push(list,value){list.push(value);if(list.length>600)list.shift();}
const percentile=(list,p)=>list.length?[...list].sort((a,b)=>a-b)[Math.floor((list.length-1)*p)]:0;
function report(){
 const summarize=list=>({count:list.length,median:list.length?percentile(list,.5):null,p95:list.length?percentile(list,.95):null,p99:list.length?percentile(list,.99):null});
 return {schemaVersion:1,createdAt:new Date().toISOString(),url:location.href,userAgent:navigator.userAgent,
  viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
  settings:Object.fromEntries(['viewMode','attackType','phaseMode','actorCount','timeScale','reduced','showHitbox','showWireframe','showAnchor'].map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),
  paused,warmupFrames:30,windowLimit:600,
  scope:'CPU command submission only; page intervals include active panels. Not GPU timing, VRAM or game FPS.',
  cpuMs:{official:summarize(samples[0]),rig:summarize(samples[1])},
  pageIntervalsMs:{...summarize(intervals),over33:intervals.filter(x=>x>1000/30).length,over50:intervals.filter(x=>x>50).length},
  raw:{officialCpuMs:[...samples[0]],rigCpuMs:[...samples[1]],pageIntervalsMs:[...intervals]}};
}
function render(index){
 const c=contexts[index],count=Number($('actorCount').value),reduced=$('reduced').checked;
 c.clearRect(0,0,480,420);
 const place=snakePlacement(wood);
 let cpu=0;
 for(let i=0;i<count;i++){
  c.save();
  if(count>1){c.translate((i%4)*120,Math.floor(i/4)*140);c.scale(.25,.31);}
  drawLivingTrunk(c,{x:place.x,y:wood.bottom,upper:false,width:TREE_WIDTH,length:300,variant:3,time:wood.snake.age});
  const start=performance.now();
  c.save();c.translate(place.x,place.y);
  if(index===0)drawSnakeA2(c,wood.snake,place.factor,reduced);
  else drawArticulatedSnakeProto(c,wood.snake,place.factor,reduced);
  c.restore();cpu+=performance.now()-start;
  if($('showWireframe').checked&&index===1){
   const {points}=resolveRig(wood.snake,reduced);
   c.save();c.translate(place.x,place.y);c.scale(place.factor,place.factor);
   c.strokeStyle='#00f5d4';c.beginPath();c.moveTo(points[0].x,points[0].y);c.bezierCurveTo(points[1].x,points[1].y,points[2].x,points[2].y,points[3].x,points[3].y);c.stroke();
   for(const p of [points[0],points[3]]){c.beginPath();c.arc(p.x,p.y,5,0,Math.PI*2);c.stroke();}c.restore();
  }
  if($('showHitbox').checked){
   c.strokeStyle=index?'#00f5d4':'#ff3b30';
   if(!index)for(const r of snakeA2CollisionRects(wood,reduced))c.strokeRect(r.x,r.y,r.w,r.h);
   else for(const r of articulatedSnakeCircles(wood,reduced)){c.beginPath();c.arc(r.x,r.y,r.r,0,Math.PI*2);c.stroke();}
  }
  if($('showAnchor').checked){c.save();c.strokeStyle='#ffe600';c.setLineDash([4,4]);c.beginPath();c.moveTo(place.x-90,place.y);c.lineTo(place.x+90,place.y);c.stroke();c.restore();}
  c.restore();
 }
 return cpu;
}
import {resolveRealSnakeRig as resolveRig} from './snake-articulated-proto.mjs';
function loop(now){
 const elapsed=last?(now-last)/1000:0;last=now;
 if(document.hidden){last=0;requestAnimationFrame(loop);return;}
 if(!paused)cursor+=Math.min(.05,elapsed)*Number($('timeScale').value);
 const mode=$('phaseMode').value,type=$('attackType').value,duration=labDuration(type,mode);
 cursor=labCursor(type,mode,cursor,paused);
 wood.snake=labState(type,mode,cursor,paused);
 // Alternate first draw to reduce systematic submission-order bias.
 const visible=active(),order=(frame++%2?[1,0]:[0,1]).filter(i=>visible.includes(i));
 warmup++;
 for(const index of order){const ms=render(index);if(warmup>30)push(samples[index],ms);}
 if(elapsed>0&&warmup>30)push(intervals,elapsed*1000);
 if(now-lastLabel>250){
  lastLabel=now;
  const pose=snakeA2Pose(wood.snake,$('reduced').checked);
  for(const [i,id] of [[0,'metricsA2'],[1,'metricsArt']])$(id).textContent=`${wood.snake.phase} · ${i?'peças':`${pose.key}[${pose.frame}]`} · CPU de desenho: mediana ${percentile(samples[i],.5).toFixed(3)} ms · p95 ${percentile(samples[i],.95).toFixed(3)} ms · ${samples[i].length} amostras`;
  $('frameStats').textContent=`Intervalo da página: mediana ${percentile(intervals,.5).toFixed(1)} ms · p95 ${percentile(intervals,.95).toFixed(1)} ms · ${active().length===2?'duas versões simultâneas':$('viewMode').selectedOptions[0].text}; primeiras 30 renderizações descartadas.`;
  $('seek').value=Math.round(cursor/duration*1000);$('position').value=Math.round(cursor/duration*100)+'%';
 }
 requestAnimationFrame(loop);
}
try{
 await Promise.all([loadAssets(),preloadSnakeA2(),preloadArticulatedSnakeProto()]);
 $('status').textContent='Pronto para comparar · experimento isolado do jogo';
 // QA and manual inspection share exactly the same state and drawing path.
 window.snakeLab={seek(type,mode,t){$('attackType').value=type;$('phaseMode').value=mode;pause(true);cursor=t;},snapshot:()=>({state:wood.snake,paused,samples:samples.map(x=>x.length)}),report};
 requestAnimationFrame(loop);
}catch(error){$('status').textContent=`Falha ao carregar: ${error.message}`;console.error(error);}
