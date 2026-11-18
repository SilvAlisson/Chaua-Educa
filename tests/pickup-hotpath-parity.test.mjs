import test from 'node:test';
import assert from 'node:assert/strict';
import {playerShapes,shapesIntersect} from '../Chaua-Educa-main/js/collision.mjs';
import {pickupShapes,pickupHitsPlayer} from '../Chaua-Educa-main/js/pickup-geometry.mjs';

// The public mask-to-polygons reference must remain authoritative: no shape
// shrinkage, expansion or missed alpha pixels is allowed to buy speed.
test('optimized pickup narrow-phase matches the authored SAT reference on all food frames',()=>{
 let cases=0;
 const kinds=['fruit','pepper','feather','shield'];
 for(const kind of kinds){
  const varieties=kind==='fruit'?12:1;
  for(let variety=0;variety<varieties;variety++)for(let frame=0;frame<4;frame++){
   for(const reduced of [false,true]){
    const item={kind,id:0,variety,x:220,y:320};
    const time=(frame+.25)/7;
    // Test edges and corners, not just easy center hits.
    for(const dx of [-80,-58,-42,-20,0,20,42,58,80])
     for(const dy of [-77,-48,-24,0,24,48,77]){
      const player=playerShapes(220+dx,320+dy,((frame+variety)%5-2)*.1);
      const expected=shapesIntersect(player,pickupShapes(item,time,reduced));
      const actual=pickupHitsPlayer(item,player,time,reduced);
      assert.equal(actual,expected,`${kind} variety=${variety} frame=${frame} reduced=${reduced} dx=${dx} dy=${dy}`);
      cases++;
     }
   }
  }
 }
 assert.ok(cases>5000);
});

test('pickup scratch grows with polygon count and has no history-dependent collisions',()=>{
 const item={kind:'fruit',id:21,variety:7,x:220,y:320};
 const a=playerShapes(220,320,.18),b=playerShapes(900,900,.18);
 const extra=[...a,...a,...a];
 assert.equal(pickupHitsPlayer(item,extra,5),shapesIntersect(extra,pickupShapes(item,5)));
 for(let n=0;n<25;n++){
  assert.equal(pickupHitsPlayer(item,b,5),false);
  assert.equal(pickupHitsPlayer(item,a,5),shapesIntersect(a,pickupShapes(item,5)));
 }
});
