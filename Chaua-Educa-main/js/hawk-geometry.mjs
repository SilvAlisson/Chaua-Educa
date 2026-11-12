import {hasActionSheet} from './action-sheets.mjs';
// Coordinates measured in the 280px action art; head and chest exclude wings,
// tail, feet and beak. The legacy atlas has its own authored anchor.
export const HAWK_ART = Object.freeze({size:280,legacyScale:.78});
export function hawkUsesActionArt(e){
 return e.retreat?!!e.dazed&&hasActionSheet('hawk-stunned'):
  !e.dive&&hasActionSheet('hawk-flight');
}
export function hawkBodyParts(e){
 return hawkUsesActionArt(e)?[[-12,35,31,22],[-68,16,22,20]]:
  [[-3*.78/.47,9*.78/.47,18*.78/.47,14*.78/.47],[-29*.78/.47,-7*.78/.47,10*.78/.47,10*.78/.47]];
}
