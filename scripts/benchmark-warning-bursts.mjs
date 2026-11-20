// Independent CPU microbenchmark of notice placement; measures neither GPU nor FPS.
// Run with: node scripts/benchmark-warning-bursts.mjs
import {performance} from 'node:perf_hooks';
import {placeWarnings} from '../Chaua-Educa-main/js/animation.mjs';

function referenceWarnings(items,view,protectedRegions=[]){
 const result=[],gap=6,left=view.x+4,top=view.y+4;
 const area=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w+gap)-Math.max(a.x,b.x-gap))*
  Math.max(0,Math.min(a.y+a.h,b.y+b.h+gap)-Math.max(a.y,b.y-gap));
 for(const item of [...items].sort((a,b)=>b.h-a.h)){
  const box={...item,w:Math.min(item.w,Math.max(1,view.w-8)),h:Math.min(item.h,Math.max(1,view.h-8))};
  const right=Math.max(left,view.x+view.w-box.w-4),bottom=Math.max(top,view.y+view.h-box.h-4);
  box.x=Math.max(left,Math.min(right,item.x));box.y=Math.max(top,Math.min(bottom,item.y));
  const blockers=[...protectedRegions,...result];
  const xs=[box.x,left,right,...blockers.flatMap(b=>[b.x-box.w-gap,b.x+b.w+gap])];
  const ys=[box.y,top,bottom,...blockers.flatMap(b=>[b.y-box.h-gap,b.y+b.h+gap])];
  let best={x:box.x,y:box.y,overlap:Infinity,distance:Infinity};
  for(const x of new Set(xs))for(const y of new Set(ys)){
   if(x<left||x>right||y<top||y>bottom)continue;
   const candidate={x,y,w:box.w,h:box.h};
   const overlap=blockers.reduce((sum,b)=>sum+area(candidate,b),0);
   const distance=(x-box.x)**2+(y-box.y)**2;
   if(overlap<best.overlap||overlap===best.overlap&&distance<best.distance)best={x,y,overlap,distance};
  }
  result.push({...box,x:best.x,y:best.y});
 }
 return result;
}

const scenarios=[
 {label:'one-free',count:1,clustered:false},
 {label:'three-free',count:3,clustered:false},
 {label:'three-clustered',count:3,clustered:true},
 {label:'five-free',count:5,clustered:false}
];
const view={x:0,y:0,w:960,h:640},region=[{x:420,y:380,w:120,h:80}];
const data=scenarios.map(scenario=>{
 const notices=Array.from({length:scenario.count},(_,i)=>({
   type:'snake',entity:{id:i+1},x:scenario.clustered?220+i*5:32+i*182,y:scenario.clustered?380:100,w:160,h:26
 }));
 const repeat=500,warm=150;
 const stats={};
 for(const [name,fn] of [['reference',referenceWarnings],['candidate',placeWarnings]]){
  for(let i=0;i<warm;i++)fn(notices,view,region);
  const durations=[];
  for(let i=0;i<repeat;i++){
   const before=performance.now();
   const result=fn(notices,view,region);
   durations.push(performance.now()-before);
   if(result.length!==notices.length)throw new Error('Lost a notice');
  }
  durations.sort((a,b)=>a-b);
  stats[name]={medianMs:durations[Math.floor(repeat/2)],p95Ms:durations[Math.floor(repeat*.95)],
   meanMs:durations.reduce((sum,n)=>sum+n,0)/durations.length};
 }
 return {scenario:scenario.label,notices:scenario.count,...stats};
});
console.log('WARNING_BURST_BENCHMARK '+JSON.stringify({units:'CPU milliseconds per layout call (Node/V8, not FPS)',scenarios:data}));
