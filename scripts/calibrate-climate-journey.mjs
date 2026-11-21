// Deterministic calibration, not gameplay logic. Uses the real Game loop,
// scoring, encounters, quizzes, power pickups and victory/refuge rules.
// Reports successful runs and failed pilot attempts separately.
// A pilot is NOT a substitute for real-player telemetry.
import {predictedHawkY} from '../Chaua-Educa-main/js/animals.mjs';
import {Game,STEP,MEDAL_SCORE} from '../Chaua-Educa-main/js/engine.mjs';
import {journeyLength,JOURNEY_LENGTHS,CAMPAIGN_TARGET_SECONDS} from '../Chaua-Educa-main/js/journey.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';

export const CALIBRATION_SEEDS=Object.freeze([104,217,451,999]);
// Generous cap beyond the six-minute route, including alignment time.
const MAX_SECONDS=600;
const q=(values,p)=>{
 if(!values.length)return null;
 const a=[...values].sort((x,y)=>x-y);
 const n=(a.length-1)*p,lo=Math.floor(n),hi=Math.ceil(n);
 return Math.round((a[lo]+(a[hi]-a[lo])*(n-lo))*100)/100;
};
const summary=(xs,field)=>({
 count:xs.length,p10:q(xs.map(x=>x[field]),.10),
 median:q(xs.map(x=>x[field]),.5),
 p90:q(xs.map(x=>x[field]),.90)
});

export function simulateFlight(mode,seed,maxSeconds=MAX_SECONDS){
 const game=new Game({seed});
 game.start(mode,[],seed);
 // The UI's introductory countdown must not count as flying time.
 game.state='playing';
 let pending=null,nextDecision=0;
 let score560=null,medal=null;
 let firstRefuge=null;
 let previousState=game.state;
 const sampledStages=new Set([game.stage]);
 const maxTicks=Math.round(maxSeconds/STEP);
 for(let tick=0;tick<maxTicks;tick++){
  if(game.state==='quiz'){
   game.answer(game.question.answer);
   game.continueQuiz();
   pending=null;
  }
  if(game.state==='playing'){
   const wood=game.entities.find(e=>e.kind==='wood'&&e.x+120>game.x&&e.x<=(game.visibleRight??Infinity));
   const hawk=game.entities.find(e=>e.kind==='hawk'&&!e.harmless&&!e.retreat&&e.x+60>game.x);
   let target=wood?(wood.snake?wood.top+Math.min(95,(wood.bottom-wood.top)*.38):(wood.top+wood.bottom)/2+8):320;
   if(!wood&&hawk){
    const lane=predictedHawkY(hawk,game.x);
    target=hawk.attackKind&&!hawk.targetLocked?320:lane>=320?145:495;
   }
   if(game.elapsed>=nextDecision){
    nextDecision=game.elapsed+1/30;
    const predicted=game.y+game.vy*.12+450*.12**2;
    if(pending===null&&predicted>target+12&&game.vy>0)pending=game.elapsed+.12;
   }
   if(pending!==null&&game.elapsed>=pending){
    game.press();game.release();pending=null;
   }
  }
  game.tick(STEP);
  sampledStages.add(game.stage);
  if(score560===null&&game.score>=560)score560={distance:game.distance,seconds:game.elapsed,score:game.score};
  if(medal===null&&game.score>=MEDAL_SCORE)medal={distance:game.distance,seconds:game.elapsed,score:game.score};
  if(firstRefuge===null&&game.refuge)firstRefuge={distance:game.distance,seconds:game.elapsed};
  if(game.state==='ended')break;
  if(game.state!==previousState && game.state==='impact')pending=null;
  previousState=game.state;
 }
 return {
  mode,seed,won:game.won,state:game.state,reason:game.reason||null,
  distance:Math.round(game.distance),routeLength:journeyLength(mode),seconds:Math.round(game.elapsed*100)/100,
  score:game.score,fruits:game.fruits,correct:game.correct,
  stages:[...sampledStages].sort(),at560:score560,at1000:medal,refuge:firstRefuge
 };
}

export function makeReport(samples){
 const byMode=Object.fromEntries(['aventura','tranquilo'].map(mode=>{
  const all=samples.filter(s=>s.mode===mode),wins=all.filter(s=>s.won);
  return [mode,{
   attempts:all.length,wins:wins.length,winRate:wins.length/all.length,
   winningDistance:summary(wins,'distance'),winningSeconds:summary(wins,'seconds'),
   // The optional medal is independent of reaching the route destination.
   medalDistance:summary(wins.filter(w=>w.at1000).map(w=>({...w,distance:w.at1000.distance})),'distance'),
   score560Distance:summary(wins.filter(w=>w.at560).map(w=>({...w,distance:w.at560.distance})),'distance'),
   failedPilots:all.filter(s=>!s.won).map(s=>({seed:s.seed,reason:s.reason,distance:s.distance,score:s.score}))
  }];
 }));
 return {type:'climate-journey-calibration',seedCount:CALIBRATION_SEEDS.length,
  source:'actual Game simulation, scripted autopilot (not human telemetry)',
  medalScore:MEDAL_SCORE,routeLengths:JOURNEY_LENGTHS,targetSeconds:CAMPAIGN_TARGET_SECONDS,byMode,samples};
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const samples=[];
 for(const mode of ['aventura','tranquilo'])for(const seed of CALIBRATION_SEEDS){
  const result=simulateFlight(mode,seed);
  samples.push(result);
  console.log('CLIMATE_CALIBRATION_SAMPLE '+JSON.stringify(result));
 }
 const result=makeReport(samples);
 console.log('CLIMATE_CALIBRATION_REPORT '+JSON.stringify(result));
 mkdirSync('test-results/climate-calibration',{recursive:true});
 writeFileSync('test-results/climate-calibration/report.json',JSON.stringify(result,null,2)+'\n');
 const winners=samples.filter(s=>s.won);
 if(winners.length<2)throw Error('Calibration inconclusive: fewer than two successful runs');
}
