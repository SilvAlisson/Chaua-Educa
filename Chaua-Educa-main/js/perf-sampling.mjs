// Bounded and reproducible slow-frame sampler: no more first-150 bias.
// Frames above 50ms are retained preferentially for late-flight diagnosis.
export function diagnosticStutterSlot(seen,limit,frame,frameMs,selected=[]) {
 if(!Number.isInteger(seen)||seen<1||limit<=0)return -1;
 if(seen<=limit)return seen-1;
 if(frameMs>50){
  const replace=selected.findIndex(event=>event.frameMs<=50);
  if(replace>=0)return replace;
 }
 let value=(Math.imul(seen,0x9e3779b1)^Math.imul(frame,0x85ebca6b))>>>0;
 value=Math.imul(value^(value>>>16),0x7feb352d)>>>0;
 value=Math.imul(value^(value>>>15),0x846ca68b)>>>0;
 value=(value^(value>>>16))>>>0;
 const position=Math.floor(value/4294967296*seen);
 if(position>=limit)return -1;
 if(selected[position]?.frameMs>50&&frameMs<=50)return -1;
 return position;
}
