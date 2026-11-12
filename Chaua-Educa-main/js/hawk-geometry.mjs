// Collision geometry depends ONLY on the simulation state, never the
// presence, loading order, or quality of a WebP. v6 poses are intentionally
// used for the original inclined dive and warning (not as a failure fallback).
export const HAWK_ART = Object.freeze({size:280,atlasScale:.78});
export function hawkUsesActionArt(e){
 return e.retreat ? !!e.dazed : !e.dive && !(e.warning>0);
}
export function hawkBodyParts(e){
 return hawkUsesActionArt(e)?[[-12,35,31,22],[-68,16,22,20]]:
  [[-3*.78/.47,9*.78/.47,18*.78/.47,14*.78/.47],[-29*.78/.47,-7*.78/.47,10*.78/.47,10*.78/.47]];
}
