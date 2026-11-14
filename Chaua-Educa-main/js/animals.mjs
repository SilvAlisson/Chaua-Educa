import {snakeAttack} from './attack-patterns.mjs';
// Encounter phases use simulation time only. Predators snapshot a lane during warning, then keep the marked path.
// Shared intercept algebra for both physics and the warning's predicted Y.
export function hawkFlightProgress(e,x){
 const span=e.startX-e.targetX;
 return span>0?Math.max(0,Math.min(1,(e.startX-x)/span)):1;
}
export function predictedHawkY(e,x){
 const p=hawkFlightProgress(e,x);
 if(!e.attackKind)return e.startY+(e.targetY-e.startY)*p;
 const hit=hawkFlightProgress(e,e.attackX??220),q=Math.max(0,Math.min(1,p/Math.max(.01,hit)));
 const approach=e.attackKind==='rasante'?q*q:q*q*(3-2*q);
 const bend=e.attackKind==='gancho'?Math.sin(q*Math.PI)*(1-q)*(e.startY<320?90:-90):0;
 if(p<=hit)return e.startY+(e.targetY-e.startY)*approach+bend;
 const exit=(p-hit)/Math.max(.01,1-hit),direction=e.attackKind==='rasante'?-1:1;
 return Math.max(85,Math.min(555,e.targetY+direction*exit*65));
}
export function advanceHawk(e, dt, speed, playerX, playerY=320) {
    e.age = (e.age || 0) + dt;
    if (e.retreat) {
        e.phase = 'retreat';
        e.harmless = true;
        e.retreatTime = (e.retreatTime || 0) + dt;
        e.x += 150 * dt;
        if (e.dazed) {
            e.tumbleAngle=0;
            e.y+=(e.retreatY||-120)*.55*dt;
        } else {
            e.y += (e.retreatY || -180) * dt;
        }
        if (e.retreatTime >= 2) e.finished = true;
        return;
    }
    if (e.warning > 0) {
        e.phase='warning';e.warning=Math.max(0,e.warning-dt);
        if(e.attackKind&&!e.targetLocked&&e.warning<=(e.lockWarning??1.1)){
            e.targetY=Math.max(145,Math.min(495,playerY));e.attackX=playerX;e.targetLocked=true;
        }
        return;
    }
    const hawkBoost = e.boost !== undefined ? e.boost : 50;
    const p=hawkFlightProgress(e,e.x),charge=e.attackKind&&p>.55&&p<.98?(e.gentle?1.08:1.24):1;
    e.x -= (speed + hawkBoost) * charge * dt;
    e.y=predictedHawkY(e,e.x);
    e.phase=e.x+30<playerX-18?'leaving':'crossing';
    if(e.phase==='leaving')e.harmless=true;
}

export const SNAKE_TIMING=Object.freeze({noticeDistance:580,triggerDistance:210,warning:.8,windup:.45,strike:.22,recovery:.6});
export function advanceSnake(wood,dt,playerX,speed=0){
 const s=wood.snake;if(!s)return;
 s.age=(s.age||0)+dt;
 if(s.retreat){s.phase='retreat';s.retreatTime=(s.retreatTime||0)+dt;return;}
 const timing=snakeAttack(s);
 const dynamic=s.attackType?Math.max(0,speed):0;
 const notice=Math.max(SNAKE_TIMING.noticeDistance,dynamic*(SNAKE_TIMING.warning+timing.windup+timing.strike*.5+.25));
 const trigger=Math.max(SNAKE_TIMING.triggerDistance,dynamic*(timing.windup+timing.strike*.45+.2));
 const distance=wood.x-playerX;
 if(distance<=notice)s.warningAge=(s.warningAge||0)+dt;
 if(!s.attackStarted&&distance<=trigger&&(s.warningAge||0)>=SNAKE_TIMING.warning){
  s.attackStarted=true;s.attackAge=0;s.strikeCount=1;
 }else if(s.attackStarted)s.attackAge+=dt;
 if(s.attackStarted){
  const age=s.attackAge;
  if(age<timing.windup){s.phase='windup';s.phaseAge=age;}
  else if(age<timing.windup+timing.strike){s.phase='striking';s.phaseAge=age-timing.windup;}
  else if(age<timing.windup+timing.strike+timing.recovery){s.phase='recovering';s.phaseAge=age-timing.windup-timing.strike;}
  else {s.phase='spent';s.phaseAge=age-timing.windup-timing.strike-timing.recovery;}
 }else s.phase=distance<=notice?'warning':'watching';
 if(wood.x+110<playerX-18&&(!s.attackStarted||s.attackAge>=timing.windup+timing.strike+timing.recovery))s.phase='leaving';
}
