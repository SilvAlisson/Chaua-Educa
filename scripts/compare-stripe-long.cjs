const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root='test-results/stripe-long';
const load=version=>JSON.parse(fs.readFileSync(path.join(root,version,'long-flight-high.json'),'utf8'));
const direct=load('no-sync'),candidate=load('synced');
assert.equal(direct.disableStripeSync,true);
assert.equal(candidate.disableStripeSync,false);
const phase=(report,stage,transition)=>{
 const key='stage-'+stage+'-'+transition+'-high';
 const data=report.phaseSegments[key];
 return data?{...data,slow33Per1000:Math.round(data.over33/data.frames*10000)/10}:null;
};
const fields=x=>({won:x.won,state:x.state,gameSeconds:x.gameSeconds,stages:x.stages,
 fps:x.fps,frames:x.frames,p95:x.frameP95Ms,p99:x.frameP99Ms,max:x.maxMs,
 framesAbove33:x.framesAbove33Ms,framesAbove50:x.framesAbove50Ms,
 framesAbove100:x.framesAbove100Ms});
const stages=Object.fromEntries([0,1,2,3].flatMap(stage=>['transition','settled'].map(part=>[
 stage+'-'+part,{direct:phase(direct,stage,part),synced:phase(candidate,stage,part)}
])));
const result={method:'two sequential native-RAF full gameplay flights, Chromium/SwiftShader, same CI runner',
 baseline:fields(direct),synced:fields(candidate),stages};
fs.writeFileSync(path.join(root,'comparison.json'),JSON.stringify(result,null,2));
console.log('STRIPE_LONG_PAIRED '+JSON.stringify(result));
