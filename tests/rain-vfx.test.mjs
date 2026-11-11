import test from 'node:test';
import assert from 'node:assert/strict';
import {drawJourneyRain,drawForegroundRain,drawRainRipples,drawSurfaceRainImpacts,
 journeyRain,journeyStorm,getWeatherMode,setWeatherMode} from '../Chaua-Educa-main/js/weather.mjs';
import {drawWetBarkSheen} from '../Chaua-Educa-main/js/tree-art.mjs';
import {climateReferenceSeconds} from '../Chaua-Educa-main/js/climate-progress.mjs';

function recordingContext(){
 const trace=[];
 const c={
  globalAlpha:1,lineWidth:1,lineCap:'butt',
  save(){trace.push(['save']);},restore(){trace.push(['restore'])},
  beginPath(){trace.push(['begin'])},rect(...p){trace.push(['rect',...p])},
  clip(){trace.push(['clip'])},fillRect(...p){trace.push(['fillRect',...p])},
  moveTo(...p){trace.push(['move',...p])},
  quadraticCurveTo(...p){trace.push(['curve',...p])},
  ellipse(...p){trace.push(['ellipse',...p])},
  stroke(){trace.push(['stroke',c.strokeStyle,c.globalAlpha])},
  fill(){trace.push(['fill',c.fillStyle,c.globalAlpha])},
  createLinearGradient(){return{addColorStop(){}}}
 };
 return {c,trace};
}

test('depth-layered rain uses restrained blue translucent droplets and no long white lines',()=>{
 const {c,trace}=recordingContext();
 drawJourneyRain(c,960,640,25.5,.85,false,false,.45,.70,340);
 drawForegroundRain(c,960,640,25.5,.85,false,false,.45,.70,340);
 assert.ok(trace.filter(x=>x[0]==='curve').length>=40,'rainfall must have curved short trails');
 assert.ok(trace.filter(x=>x[0]==='ellipse').length>=45,'drop heads and ripples must exist');
 assert.ok(trace.filter(x=>x[0]==='stroke').length>=10,'depth bands and ripples missing');
 assert.ok(trace.filter(x=>x[0]==='fillRect').length<=1,'full-screen rain is flooding the scene');
 assert.ok(!trace.some(x=>x[0]==='stroke'&&/^(#fff|#ffffff|#f0f8ff|#f5faff)$/i.test(x[1])),'avoid pure white rain streaks');
 const trace2=recordingContext();
 drawJourneyRain(trace2.c,960,640,25.5,.85,false,false,.45,.70,340);
 drawForegroundRain(trace2.c,960,640,25.5,.85,false,false,.45,.70,340);
 assert.deepEqual(trace2.trace,trace,'rain animation should be deterministic for fixed time');
});
test('reduced motion retains the atmospheric wash and suppresses rain particles',()=>{
 const {c,trace}=recordingContext();
 drawJourneyRain(c,390,844,10,.7,true,true,.2,.3);
 drawForegroundRain(c,390,844,10,.7,true,true,.2,.3);
 assert.equal(trace.filter(x=>x[0]==='fillRect').length,1);
 assert.equal(trace.filter(x=>x[0]==='curve'||x[0]==='ellipse').length,0);
 const empty=recordingContext();
 drawJourneyRain(empty.c,390,844,10,0,false,true);
 drawForegroundRain(empty.c,390,844,10,0,false,true);
 assert.equal(empty.trace.length,0);
});
test('rain contact effects are small, local and absent in reduced-motion mode',()=>{
 const {c,trace}=recordingContext();
 drawSurfaceRainImpacts(c,200,180,.75,3.4,12,false,false);
 const ellipses=trace.filter(x=>x[0]==='ellipse');
 assert.equal(ellipses.length,4);
 assert.ok(ellipses.every(x=>Math.abs(x[1]-200)<=30&&Math.abs(x[2]-180)<=9),
  'impacts must stay on the existing object surface');
 const reduced=recordingContext();
 drawSurfaceRainImpacts(reduced.c,200,180,.75,3.4,12,true,true);
 assert.equal(reduced.trace.length,0);
});
test('wet tree glints stay thin and do not paint rectangular patches over authored sprites',()=>{
 const dry=recordingContext();
 drawWetBarkSheen(dry.c,100,190,82,0,2,3);
 assert.equal(dry.trace.length,0);
 const wet=recordingContext();
 drawWetBarkSheen(wet.c,100,190,82,.86,2,3);
 assert.equal(wet.trace.filter(x=>x[0]==='stroke').length,2);
 assert.equal(wet.trace.filter(x=>x[0]==='fillRect').length,0);
 assert.ok(wet.trace.every(x=>x[0]!=='rect'&&x[0]!=='fillRect'));
});
test('rain occupies autumn, but not snow; no point value controls it',()=>{
 const old=getWeatherMode();
 try{
  setWeatherMode('auto');
  const game={mode:'aventura',seed:104,distance:28000,score:560,
   elapsed:climateReferenceSeconds('aventura',104)*.56};
  assert.ok(journeyRain(game)>.7&&journeyStorm(game,'aventura')>.4);
  for(const score of [0,200,560,999,1000])
   assert.equal(journeyRain({...game,score}),journeyRain(game));
  const winter={...game,elapsed:climateReferenceSeconds('aventura',104)*.85};
  assert.equal(journeyRain(winter),0);
  assert.equal(journeyStorm(winter,'aventura'),0);
  setWeatherMode('winter');
  assert.equal(journeyRain(game),0);
  assert.equal(journeyStorm(game,'aventura'),0);
 }finally{setWeatherMode(old);}
});
