// Test driver: respect the announced route instead of flying through every hawk.
export function pilotTarget(game) {
    const wood=game.entities.find(e=>e.kind==='wood'&&e.x+100>game.x&&e.x<=(game.visibleRight??Infinity));
    if(wood)return (wood.top+wood.bottom)/2;
    const hawk=game.entities.find(e=>e.kind==='hawk'&&!e.harmless&&!e.retreat&&e.x+60>game.x);
    if(hawk){
        const t=Math.max(0,Math.min(1,(hawk.startX-game.x)/(hawk.startX-hawk.targetX)));
        const lane=hawk.startY+(hawk.targetY-hawk.startY)*t;
        return lane>=320?Math.max(145,lane-125):Math.min(495,lane+125);
    }
    return 320;
}
