import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,VICTORY_SCORE} from '../Chaua-Educa-main/js/engine.mjs';
import {ACTION_TIMINGS,parrotAction,hawkAction,snakeAction}
 from '../Chaua-Educa-main/js/action-states.mjs';
import {impactPose} from '../Chaua-Educa-main/js/motion.mjs';

const flight=()=>{const game=new Game({seed:104});game.state='playing';game.nextSpawn=Infinity;return game;};
const advance=(game,seconds)=>{for(let i=0;i<Math.ceil(seconds/STEP);i++)game.tick(STEP)};
const candidates=[
 {name:'wood',entity:{id:10,kind:'wood',x:308,top:380,bottom:550,hitSide:'bottom'},animal:false},
 {name:'hawk',entity:{id:11,kind:'hawk',x:308,y:320,warning:0,phase:'crossing'},animal:true},
 {name:'snake',entity:{kind:'snake',phase:'watching',age:1},host:{id:12,kind:'wood',x:308,top:180,bottom:450},animal:true},
 {name:'boundary',entity:{kind:'boundary',side:'top'},animal:false}
];

test('fatal contact with every obstacle holds the bird stunned until the Game Over boundary',()=>{
 assert.ok(ACTION_TIMINGS.parrotImpact>=1.1);
 assert.ok(ACTION_TIMINGS.parrotRecoil<=.35);
 assert.equal(ACTION_TIMINGS.shieldRebound,.30);
 assert.equal(VICTORY_SCORE,1000);
 for(const sample of candidates){
  const game=flight(),events=[];
  game.onEvent=e=>events.push(e.type);
  game.score=560;
  game.collide(sample.entity,sample.animal,sample.host||sample.entity);
  assert.equal(game.state,'impact',sample.name);
  assert.equal(game.impactRemaining,ACTION_TIMINGS.parrotImpact);
  assert.equal(game.won,false);
  const frozen={y:game.y,vy:game.vy,score:game.score,elapsed:game.elapsed,distance:game.distance};
  advance(game,ACTION_TIMINGS.parrotRecoil+.03);
  assert.equal(game.state,'impact',sample.name+' ended after initial recoil');
  const progress=Math.min(1,(ACTION_TIMINGS.parrotImpact-game.impactRemaining)/ACTION_TIMINGS.parrotRecoil);
  assert.equal(progress,1);
  assert.equal(parrotAction({defeated:true,impactProgress:progress}).state,'stunned');
  assert.equal(parrotAction({defeated:true,impactProgress:progress}).frame,5);
  assert.deepEqual(
   {y:game.y,vy:game.vy,score:game.score,elapsed:game.elapsed,distance:game.distance},
   frozen,
   sample.name+' altered gameplay while fatal animation was running');
  advance(game,.65);
  assert.equal(game.state,'impact',sample.name+' left daze before result');
  assert.equal(events.filter(t=>t==='lose').length,1,'loss event must fire only once');
  advance(game,.45);
  assert.equal(game.state,'ended',sample.name+' did not reach gameover');
  assert.equal(game.impactRemaining,0);
  assert.equal(events.filter(t=>t==='lose').length,1);
  advance(game,.5);
  assert.equal(events.filter(t=>t==='lose').length,1,'gameover duplicated loss event');
 }
});

test('shield contact always continues the run, expends one shield and recoils quickly',()=>{
 for(const sample of candidates){
  const game=flight(),events=[];
  game.onEvent=e=>events.push(e.type);
  game.shield=true;
  game.score=560;
  game.collide(sample.entity,sample.animal,sample.host||sample.entity);
  assert.equal(game.state,'playing',sample.name);
  assert.equal(game.shield,false);
  assert.equal(game.impactRemaining,0);
  assert.equal(game.won,false);
  assert.equal(game.score,560);
  assert.ok(game.invincible>1,'shield protection must remain');
  assert.equal(events.filter(t=>t==='shield-break').length,1);
  assert.equal(events.filter(t=>t==='lose').length,0);
  assert.equal(parrotAction({shieldHitAge:.1}).state,'shield-rebound');
  assert.equal(parrotAction({shieldHitAge:ACTION_TIMINGS.shieldRebound+.01}).state,'gliding');
  if(sample.animal){
   assert.equal(sample.entity.retreat,true,sample.name+' should recoil');
   assert.equal(sample.entity.dazed,true,sample.name+' should be stunned');
   assert.equal(sample.entity.harmless,true,sample.name+' should become harmless');
  }
 }
});

test('fatal pose settles without moving the bird throughout the prolonged daze',()=>{
 const a=impactPose(1),b=impactPose(1);
 assert.deepEqual(a,b);
 assert.equal(parrotAction({defeated:true,impactProgress:.2}).state,'impact');
 assert.equal(parrotAction({defeated:true,impactProgress:.7}).state,'impact');
 assert.equal(parrotAction({defeated:true,impactProgress:1}).state,'stunned');
 // Existing predator and snake animations are not replaced by the player
 // stun sequence; their own shield-recoil loops remain intact.
 assert.equal(hawkAction({retreat:true,dazed:true,retreatTime:.6}).sheet,'hawk-stunned');
 assert.equal(snakeAction({retreat:true,dazed:true,retreatTime:.6}).sheet,'snake-stunned');
});

test('reduced motion and non-contact losses do not delay the gameover dialog',()=>{
 const collision=flight();collision.reducedMotion=true;
 collision.collide({kind:'boundary',side:'bottom'});
 assert.equal(collision.state,'ended');
 assert.equal(collision.impactRemaining,0);
 const wrongQuiz=flight();wrongQuiz.end(false,'Resposta incorreta');
 assert.equal(wrongQuiz.state,'ended');
 assert.equal(wrongQuiz.impactRemaining,0);
});
