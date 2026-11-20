import test from 'node:test';
import assert from 'node:assert/strict';
import {playerShapes,shapesHitRect,shapesIntersect,rectShape} from '../Chaua-Educa-main/js/collision.mjs';

test('optimized rectangle collision preserves SAT exactly across player rotations and boundaries',()=>{
 let checked=0;
 for(const angle of [-.28,-.19,0,.12,.28])
  for(const x of [-100,-55,-35,-24,-12,0,12,24,35,55,100])
   for(const y of [-100,-55,-35,-24,-12,0,12,24,35,55,100])
    for(const size of [1,4,12,30,65]){
     const player=playerShapes(220,320,angle);
     const rect={x:220+x,y:320+y,w:size,h:size};
     const want=shapesIntersect(player,[rectShape(rect)]);
     const actual=shapesHitRect(player,rect);
     assert.equal(actual,want,`angle=${angle} x=${x} y=${y} size=${size}`);
     checked++;
    }
 assert.ok(checked>=3000);
});
