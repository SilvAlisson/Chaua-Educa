// Encounter phases use simulation time only. Paths never retarget the player.
export function advanceHawk(e, dt, speed, playerX) {
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
        return;
    }
    const hawkBoost = e.boost !== undefined ? e.boost : 50;
    e.x -= (speed + hawkBoost) * dt;
    const span=e.startX-e.targetX;
    const progress=span>0?Math.max(0,Math.min(1,(e.startX-e.x)/span)):1;
    e.y=e.startY+(e.targetY-e.startY)*progress;
    e.phase=e.x+30<playerX-18?'leaving':'crossing';
    if(e.phase==='leaving')e.harmless=true;
}

export const SNAKE_TIMING=Object.freeze({noticeDistance:580,triggerDistance:210,warning:.8,windup:.45,strike:.22,recovery:.6});
export function advanceSnake(wood,dt,playerX){
 const s=wood.snake;if(!s)return;
 s.age=(s.age||0)+dt;
 if(s.retreat){s.phase='retreat';s.retreatTime=(s.retreatTime||0)+dt;return;}
 const distance=wood.x-playerX;
 if(distance<=SNAKE_TIMING.noticeDistance)s.warningAge=(s.warningAge||0)+dt;
 if(!s.attackStarted&&distance<=SNAKE_TIMING.triggerDistance&&(s.warningAge||0)>=SNAKE_TIMING.warning){
  s.attackStarted=true;s.attackAge=0;s.strikeCount=1;
 }else if(s.attackStarted)s.attackAge+=dt;
 if(s.attackStarted){
  const age=s.attackAge;
  if(age<SNAKE_TIMING.windup){s.phase='windup';s.phaseAge=age;}
  else if(age<SNAKE_TIMING.windup+SNAKE_TIMING.strike){s.phase='striking';s.phaseAge=age-SNAKE_TIMING.windup;}
  else if(age<SNAKE_TIMING.windup+SNAKE_TIMING.strike+SNAKE_TIMING.recovery){s.phase='recovering';s.phaseAge=age-SNAKE_TIMING.windup-SNAKE_TIMING.strike;}
  else {s.phase='spent';s.phaseAge=age-SNAKE_TIMING.windup-SNAKE_TIMING.strike-SNAKE_TIMING.recovery;}
 }else s.phase=distance<=SNAKE_TIMING.noticeDistance?'warning':'watching';
 if(wood.x+110<playerX-18)s.phase='leaving';
}
