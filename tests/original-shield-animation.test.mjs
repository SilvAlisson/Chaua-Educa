import test from 'node:test';
import assert from 'node:assert/strict';
import {birdAnimation,hawkAnimation,CLIPS} from '../Chaua-Educa-main/js/animation.mjs';
import {hawkDazedHeading,hawkDazeVisual,parrotShieldVisual} from '../Chaua-Educa-main/js/secondary-motion.mjs';

test('Chaua remains on original authored flight frames until a real shield-hit event',()=>{
 for(let i=0;i<200;i++){
  const wing=i/200,time=i/60;
  assert.deepEqual(birdAnimation({wing,time,shieldHitAge:null}),birdAnimation({wing,time}));
 }
 assert.equal(birdAnimation({wing:.6,time:2,shieldHitAge:.03}).frame,14);
 assert.equal(birdAnimation({wing:.6,time:2,shieldHitAge:.10}).frame,15);
 for(const t of [.01,.10,.16]){
  const c=birdAnimation({wing:.6,time:2,shieldHitAge:t});
  assert.equal(c.next,c.frame);assert.equal(c.blend,0);
 }
 assert.deepEqual(birdAnimation({wing:.6,time:2,shieldHitAge:.22}),birdAnimation({wing:.6,time:2}));
 assert.deepEqual(birdAnimation({wing:.6,time:2,shieldHitAge:.05,reduced:true}),
                  birdAnimation({wing:.6,time:2,reduced:true}));
 assert.equal(birdAnimation({defeated:true,impactProgress:.95,shieldHitAge:.02}).frame,15);
 assert.equal(birdAnimation({perched:true,shieldHitAge:.03}).frame,12);
 assert.ok(Math.abs(parrotShieldVisual(.12).angle)>0);
 assert.deepEqual(parrotShieldVisual(.32),{x:0,y:0,angle:0});
});
test('predator keeps every original non-shield flight, glide and dive clip',()=>{
 for(let i=0;i<240;i++){
  const t=i/80;
  for(const config of [{id:5,phase:'crossing',warning:0,dive:false},
    {id:5,phase:'crossing',warning:0,dive:true},
    {id:5,phase:'leaving',warning:0,dive:false},
    {id:5,phase:'warning',warning:1,dive:false}]){
   const a=hawkAnimation(config,t);
   assert.ok([...CLIPS.hawk.flight,...CLIPS.hawk.glide,...CLIPS.hawk.dive].includes(a.frame));
   assert.equal(a.frame,a.next);assert.equal(a.blend,0);
  }
 }
 assert.equal(hawkAnimation({retreat:true,retreatTime:2}).frame,15,
   'ordinary original retreat unaffected');
});
test('shielded hawk expresses recoil, disorientation, bank and original flight exit',()=>{
 for(const [time,frame] of [[.05,12],[.25,13],[.48,14],[.75,15]]){
  const c=hawkAnimation({id:5,retreat:true,dazed:true,retreatTime:time},time);
  assert.deepEqual(c,{frame,next:frame,blend:0});
 }
 assert.ok(CLIPS.hawk.glide.includes(hawkAnimation({retreat:true,dazed:true,retreatTime:1.03},1.03).frame));
 assert.ok(CLIPS.hawk.flight.includes(hawkAnimation({retreat:true,dazed:true,retreatTime:1.7},1.7).frame));
 assert.deepEqual(hawkAnimation({retreat:true,dazed:true,retreatTime:1.1},1.1,true),
                  {frame:15,next:15,blend:0});
 assert.equal(hawkDazedHeading(.2),1);
 assert.equal(hawkDazedHeading(.4,true),1);
 assert.equal(hawkDazedHeading(1.1),-1);
 for(let i=0;i<180;i++){
  const k=hawkDazedHeading(i/100);
  assert.ok(k>=-1&&k<=1,'safe horizontal mirror scale');
 }
 assert.deepEqual(hawkDazeVisual(2),{x:0,y:0,angle:0,stars:0});
});
