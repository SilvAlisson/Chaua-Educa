import assert from 'node:assert/strict';
import test from 'node:test';
import {Game,FlightClock,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {setWeatherMode} from '../Chaua-Educa-main/js/weather.mjs';
import {WINTER_REPLAY,WinterReplay} from '../Chaua-Educa-main/js/perf-replay.mjs';
import {frameBudget,summarizeFrameBudget} from '../Chaua-Educa-main/js/frame-summary.mjs';

test('the winter flight replays the same actions at 60 Hz, 120 Hz and after a stall',()=>{
 setWeatherMode('winter');
 try{
  const fly=cadence=>{
   const game=new Game();
   const route=new WinterReplay();
   const clock=new FlightClock(game);
   const tick=game=>route.beforeTick(game);
   game.viewWidth=WINTER_REPLAY.worldWidth;
   game.viewLeft=0;
   game.start(WINTER_REPLAY.mode,[],WINTER_REPLAY.seed);
   for(let frame=0;frame<12000&&game.state!=='ended';frame++){
    if(game.state==='quiz'){route.answerQuiz(game);clock.reset();}
    clock.advance(cadence(frame),tick);
   }
   route.finish(game);
   assert.equal(game.state,'ended');
   assert.ok(game.surfaceWeather.snow>.25,'the reference covers meaningful snow accumulation');
   return {...route.result(),score:game.score,distance:game.distance};
  };
  const reference=fly(()=>STEP);
  assert.equal(reference.completed,true,JSON.stringify(reference));
  assert.deepEqual(fly(()=>STEP*2),reference);
  assert.deepEqual(fly(frame=>frame%20===5?STEP*8:STEP),reference);
 }finally{
  setWeatherMode('auto');
 }
});

test('the frame budget counts a missed refresh at either target',()=>{
 const samples=[8.4,10,16.67,17.2,33.33].map(dt=>({dt}));
 assert.deepEqual(summarizeFrameBudget(samples,frameBudget(120)),{framesOutsideBudget:3,percentOutsideBudget:60});
 assert.deepEqual(summarizeFrameBudget(samples,frameBudget(60)),{framesOutsideBudget:1,percentOutsideBudget:20});
 assert.deepEqual(summarizeFrameBudget([],frameBudget(60)),{framesOutsideBudget:0,percentOutsideBudget:null});
});
