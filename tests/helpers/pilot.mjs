import {predictedHawkY} from '../../Chaua-Educa-main/js/animals.mjs';
// Test driver: respect the announced route instead of flying through every hawk.
export function pilotTarget(game) {
    const wood=game.entities.find(e=>e.kind==='wood'&&e.x+120>game.x&&e.x<=(game.visibleRight??Infinity));
    if(wood){
        // A2 occupies the lower part of the widened snake encounter.
        // Follow the same upper safety corridor used to place fruit.
        return wood.snake ? wood.top + Math.min(95,(wood.bottom-wood.top)*.38) : (wood.top+wood.bottom)/2+8;
    }
    const hawk=game.entities.find(e=>e.kind==='hawk'&&!e.harmless&&!e.retreat&&e.x+60>game.x);
    if(hawk){
        if(hawk.attackKind&&!hawk.targetLocked&&hawk.warning>0)return 320;
        const lane=predictedHawkY(hawk,game.x);
        // The inset head now occupies its actual forward position. Use the
        // full free lane, including room for the tap's vertical oscillation.
        return lane>=320?145:495;
    }
    return 320;
}
