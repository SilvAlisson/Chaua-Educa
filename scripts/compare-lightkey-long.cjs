const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root='test-results/lightkey-long';
const load=name=>JSON.parse(fs.readFileSync(path.join(root,name,'long-flight-high.json'),'utf8'));
const before=load('old-key'),after=load('light-key');
assert.equal(before.keepOpaqueLightKey,true);assert.equal(after.keepOpaqueLightKey,false);
const fields=s=>({won:s.won,state:s.state,gameSeconds:s.gameSeconds,stages:s.stages,
 fps:s.fps,frames:s.frames,p95:s.frameP95Ms,p99:s.frameP99Ms,max:s.maxMs,
 over33:s.framesAbove33Ms,over50:s.framesAbove50Ms,over100:s.framesAbove100Ms});
const stage=(r,i,part)=>{
 const s=r.phaseSegments['stage-'+i+'-'+part+'-high'];
 return s?{...s,slow33Per1000:+(s.over33/s.frames*1000).toFixed(1)}:null;
};
const parts=Object.fromEntries([0,1,2,3].flatMap(i=>['transition','settled'].map(part=>
 [i+'-'+part,{original:stage(before,i,part),fast:stage(after,i,part)}])));
const result={method:'Paired 140s High-quality native RAF flights; both omit invisible sky, comparing cache palette invalidation only',
 original:fields(before),fast:fields(after),segments:parts};
fs.writeFileSync(path.join(root,'comparison.json'),JSON.stringify(result,null,2));
console.log('LIGHTKEY_LONG_PAIRED '+JSON.stringify(result));
