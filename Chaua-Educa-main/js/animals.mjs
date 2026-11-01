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

export function advanceSnake(wood, dt, playerX) {
    const s=wood.snake;if(!s)return;
    s.age=(s.age||0)+dt;
    if(s.retreat){s.phase='retreat';s.retreatTime=(s.retreatTime||0)+dt;return;}
    // This is an occupied perch, not a tracking attack or an extending hitbox.
    if(wood.x+85<playerX-18)s.phase='leaving';
    else if(wood.x<playerX+140)s.phase='occupied';
    else if(wood.x<=800)s.phase='warning';
    else s.phase='watching';
}
