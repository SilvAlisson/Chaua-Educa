import {snakeAttack} from './attack-patterns.mjs';
import {SNAKE_TIMING} from './animals.mjs';
export function labPhases(type){
 const t=snakeAttack({attackType:type});
 return [['watching',.7],['warning',SNAKE_TIMING.warning],['windup',t.windup],['striking',t.strike],['recovering',t.recovery],['spent',.5]];
}
export function labDuration(type,mode='auto'){
 const phases=labPhases(type);
 return mode==='auto'?phases.reduce((sum,[,d])=>sum+d,0):mode==='stunned'?2:phases.find(([p])=>p===mode)?.[1]??.7;
}
export function labState(type,mode,cursor){
 let age=Math.max(0,Number.isFinite(cursor)?cursor:0)%labDuration(type,mode),phase=mode,phaseAge=age;
 if(mode==='auto')for(const [p,duration] of labPhases(type)){
  if(phaseAge<duration){phase=p;break;}phaseAge-=duration;
 }
 return {kind:'snake',branch:true,attackType:type,age,phase,phaseAge,warningAge:phaseAge,
  retreat:mode==='stunned',dazed:mode==='stunned',retreatTime:mode==='stunned'?age:0};
}
