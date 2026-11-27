import {COLLISION_ART} from './collision-art-data.mjs';
// Collision geometry depends ONLY on the simulation state, never the
// presence, loading order, or quality of a WebP. v6 poses are intentionally
// used for the original inclined dive and warning (not as a failure fallback).
export const HAWK_ART = Object.freeze({size:280,atlasScale:.78});
export function hawkUsesActionArt(e){
 return e.retreat ? !!e.dazed : !e.dive && !(e.warning>0);
}
export function hawkBodyParts(e){
 return hawkUsesActionArt(e)?COLLISION_ART.bodies.hawk:
  COLLISION_ART.bodies.hawkDive;
}
