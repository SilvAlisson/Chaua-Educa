// Compare exactly the same deterministic flight with 8 and 12 stripes.
// Only High-quality renderer's stage-one stripe count is different.
const fs=require('node:fs'),path=require('node:path');
const root='test-results/stage-one-tiles/native';
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n,'long-flight-high.json'),'utf8'));
const a=read('8-stripes'),b=read('12-stripes');
if(a.stageOneStripes!==8||b.stageOneStripes!==12)
 throw Error('Misconfigured native stripe A/B');
for(const [name,r] of [['eight',a],['twelve',b]]){
 if(!r.won||r.stages.length!==4)throw Error(name+' did not finish full flight');
}
const stats=r=>({fps:r.fps,p95:r.frameP95Ms,p99:r.frameP99Ms,over33:r.framesAbove33Ms,
 over50:r.framesAbove50Ms,max:r.maxMs,frames:r.frames});
const stage=r=>r.phaseSegments?.['stage-1-transition-high'];
const transition=r=>{const v=stage(r);return v?{fps:v.fps,p95:v.p95Ms,p99:v.p99Ms,over33:v.over33,over50:v.over50,
 slowPer1000:v.over33/v.frames*1000,frames:v.frames}:null;};
const result={eight:{overall:stats(a),stageOneTransition:transition(a)},
 twelve:{overall:stats(b),stageOneTransition:transition(b)},
 note:'Same runner and seed; successive runs are not perfectly identical in CPU scheduling. Compare native intervals and CI raster A/B together.'};
fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(result,null,2));
console.log('NATIVE_STAGE_ONE_STRIPES '+JSON.stringify(result));
