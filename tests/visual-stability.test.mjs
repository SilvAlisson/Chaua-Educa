import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {playerShapes,hawkShapes,shapesIntersect,shapesHitRect,rectShape,intersects} from '../Chaua-Educa-main/js/collision.mjs';

test('body ellipses reject empty rectangular corners but retain solid body contacts',()=>{
 const body=playerShapes(100,100);
 assert.equal(shapesHitRect(body,{x:81,y:84,w:2,h:2}),false);
 assert.equal(shapesHitRect(body,{x:97,y:96,w:6,h:8}),true);
 assert.equal(shapesHitRect(body,{x:115,y:90,w:3,h:3}),true);
 assert.equal(shapesHitRect(body,{x:65,y:65,w:4,h:4}),false,'wing tips are decorative');
});
test('rotation follows the head and never stretches the body polygons',()=>{
 const plain=playerShapes(0,0,0),turned=playerShapes(0,0,.28);
 const area=p=>Math.abs(p.reduce((s,v,i)=>{const n=p[(i+1)%p.length];return s+v.x*n.y-n.x*v.y;},0)/2);
 plain.forEach((shape,i)=>assert.ok(Math.abs(area(shape)-area(turned[i]))<1e-8));
 assert.notDeepEqual(plain[1],turned[1]);
});
test('predator head and chest collide while wing and tail tips remain forgiving',()=>{
 const h={x:300,y:300,dive:false},body=hawkShapes(h);
 assert.equal(shapesIntersect(playerShapes(270,294),body),true);
 assert.equal(shapesIntersect(playerShapes(310,220),body),false);
 assert.equal(shapesIntersect(playerShapes(360,300),body),false);
});
test('convex contact handles crossing, containment, separation and exact tangency',()=>{
 const a=rectShape({x:0,y:0,w:10,h:10});
 for(const [r,expected]of [[{x:4,y:4,w:2,h:2},true],[{x:9,y:4,w:4,h:4},true],[{x:10,y:0,w:5,h:5},false],[{x:-20,y:-20,w:2,h:2},false]]){
  const b=rectShape(r);assert.equal(intersects(a,b),expected);assert.equal(intersects(b,a),expected);
 }
});
test('refuge starts fully outside each viewport and moves continuously into view',()=>{
 for(const right of [960,1400,2200]){
  const g=new Game();g.state='playing';g.distance=28000;g.viewWidth=right;g.nextSpawn=Infinity;
  g.advanceJourney(STEP);assert.ok(g.refuge.x-48>right);
  const before=g.refuge.x;g.snapshot();g.advanceJourney(STEP);
  assert.ok(g.refuge.x<before);assert.ok(before-g.refuge.x<3);
  assert.equal(g.visual(.5).refuge.x,(before+g.refuge.x)/2);
  g.pause();const x=g.refuge.x;g.tick(2);assert.equal(g.refuge.x,x);
 }
});
test('fatal impact retains the exact wing pose and powers cannot resize collision geometry',()=>{
 const g=new Game();g.state='playing';g.wing=.63;g.nextSpawn=Infinity;
 const before=playerShapes(g.x,g.y,g.angle);g.power('pepper');g.power('feather');assert.deepEqual(playerShapes(g.x,g.y,g.angle),before);
 g.end(false,'hit',true);for(let i=0;i<60;i++)g.tick(STEP);assert.equal(g.wing,.63);
});
