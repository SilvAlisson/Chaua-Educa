import test from 'node:test';
import assert from 'node:assert/strict';
import {placeWarnings} from '../Chaua-Educa-main/js/animation.mjs';

// Frozen copy of the preceding implementation: the optimized algorithm must
// reproduce every candidate position and overlap tie-break exactly.
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
test('warning allocation optimization preserves all original screen placements',()=>{
 let checked=0,seed=12345678;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const viewport of [{x:0,y:0,w:320,h:180},{x:48,y:72,w:720,h:400},{x:0,y:0,w:960,h:640}]){
  for(let i=0;i<140;i++){
   const items=Array.from({length:i%4+1},()=>({type:'hawk',x:viewport.x+rnd()*viewport.w,y:viewport.y+rnd()*viewport.h,w:38+Math.floor(rnd()*118),h:20+Math.floor(rnd()*65)}));
   const protectedRegions=Array.from({length:i%3},()=>({x:viewport.x+rnd()*viewport.w,y:viewport.y+rnd()*viewport.h,w:30+rnd()*100,h:15+rnd()*80}));
   const before=JSON.stringify(items);
   assert.deepEqual(placeWarnings(items,viewport,protectedRegions),referenceWarnings(items,viewport,protectedRegions),`case=${checked}`);
   assert.equal(JSON.stringify(items),before,'source warning array must remain untouched');
   checked++;
  }
 }
 assert.equal(checked,420);
});

test('three independent snake warnings do not move or cover one another',()=>{
 const view={x:0,y:0,w:960,h:640};
 const protectedRegions=[{x:415,y:250,w:180,h:130}];
 const notices=[
  {type:'snake',entity:{id:1},x:75,y:120,w:160,h:26},
  {type:'snake',entity:{id:2},x:365,y:120,w:160,h:26},
  {type:'snake',entity:{id:3},x:720,y:120,w:160,h:26}
 ];
 const actual=placeWarnings(notices,view,protectedRegions);
 assert.deepEqual(actual,referenceWarnings(notices,view,protectedRegions));
 for(let i=0;i<notices.length;i++)
  assert.deepEqual([actual[i].x,actual[i].y],[notices[i].x,notices[i].y]);
 // Retain full search and exact parity when three notices share one position.
 const crowded=notices.map((item,i)=>({...item,x:170+i*2,y:260}));
 assert.deepEqual(placeWarnings(crowded,view,protectedRegions),referenceWarnings(crowded,view,protectedRegions));
});
