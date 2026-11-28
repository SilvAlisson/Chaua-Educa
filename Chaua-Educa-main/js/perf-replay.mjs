// A recorded reference route through the real winter flight. Tick indexes
// advance only while playing, so the recording is independent of RAF cadence.
export const WINTER_REPLAY = Object.freeze({
 id:'winter-aventura-v2',mode:'aventura',seed:3169729328,steps:4949,score:99,worldWidth:960,
 taps:Object.freeze([
  41,120,199,278,357,436,515,593,673,751,831,910,989,1068,1147,1226,
  1304,1384,1463,1542,1621,1700,1791,1872,1937,2011,2091,2166,2248,2327,
  2401,2484,2591,2618,2684,2760,2839,2918,2997,3082,3155,3240,3312,3449,
  3483,3539,3611,3665,3758,3825,3892,3968,4047,4126,4205,4284,4385,4449,
  4516,4592,4670,4749,4828,4907
 ]),
 quizStep:3844,quizAnswer:true
});

export class WinterReplay {
 constructor(){
  this.step=0;
  this.tap=0;
  this.quizAnswered=false;
  this.finished=false;
  this.error=null;
 }
 beforeTick(game){
  if(game.state!=='playing')return;
  if(this.step>=WINTER_REPLAY.steps){
   this.error='step-limit';
   game.end(false,'A trajetória do voo de referência mudou.');
   return;
  }
  if(WINTER_REPLAY.taps[this.tap]===this.step){
   game.press();
   game.release();
   this.tap++;
  }
  this.step++;
 }
 answerQuiz(game){
  if(game.state!=='quiz')return;
  if(this.quizAnswered||this.step!==WINTER_REPLAY.quizStep||game.question?.answer!==WINTER_REPLAY.quizAnswer){
   this.error='unexpected-quiz';
   game.end(false,'A pergunta do voo de referência mudou.');
   return;
  }
  this.quizAnswered=true;
  game.answer(WINTER_REPLAY.quizAnswer);
  game.continueQuiz();
 }
 finish(game){
  this.finished=true;
  if(!this.error&&(this.step!==WINTER_REPLAY.steps||game.score!==WINTER_REPLAY.score||
      this.tap!==WINTER_REPLAY.taps.length||!this.quizAnswered))this.error='flight-diverged';
 }
 result(){
  return {id:WINTER_REPLAY.id,completed:this.finished&&!this.error,steps:this.step,
   taps:this.tap,quizAnswered:this.quizAnswered,error:this.error};
 }
}
