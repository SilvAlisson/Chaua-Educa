import {predictedHawkY} from '../../Chaua-Educa-main/js/animals.mjs';
// Test driver: respect the announced route instead of flying through every hawk.
export function pilotTarget(game) {
    const wood=game.entities.find(e=>e.kind==='wood'&&e.x+100>game.x&&e.x<=(game.visibleRight??Infinity));
    if(wood){
        // A2 occupies the lower part of the widened snake encounter.
        // Follow the same upper safety corridor used to place fruit.
        return wood.snake ? wood.top + Math.min(85,(wood.bottom-wood.top)*.35) : (wood.top+wood.bottom)/2;
    }
    const hawk=game.entities.find(e=>e.kind==='hawk'&&!e.harmless&&!e.retreat&&e.x+60>game.x);
    if(hawk){
        if(hawk.attackKind&&!hawk.targetLocked&&hawk.warning>0)return 320;
        const lane=predictedHawkY(hawk,game.x);
        // Follow a physically clear corridor for the official action-sheet
        // head/chest, not the smaller collider used by historical headless tests.
        return lane>=320?Math.max(145,lane-140):Math.min(495,lane+140);
    }
    return 320;
}
