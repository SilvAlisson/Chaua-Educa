// Test C: original-art precomposed snow progression, 16 complete states.
import {PERF_AB_VARIANT} from './perf-ab.mjs';
export const PRECOMPOSED_SNOW_STAGES=16;
export const PRECOMPOSED_SNOW_ACTIVE=PERF_AB_VARIANT==='precomposed-snow';
export function precomposedSnowStage(snow){
 const amount=Number.isFinite(snow)?Math.max(0,Math.min(1,snow)):0;
 return Math.round(amount*(PRECOMPOSED_SNOW_STAGES-1));
}
export function precomposedAssetKey(kind,stage){
 const index=Math.max(0,Math.min(PRECOMPOSED_SNOW_STAGES-1,Math.floor(stage)||0));
 if(kind==='special'){
  if(index===0)return 'tree-variants';
  return 'tree-variants-precomposed-'+String(index).padStart(2,'0');
 }
 if(kind!=='lower'&&kind!=='upper')throw new RangeError('Invalid living tree kind');
 if(index===0)return 'trees-'+kind;
 if(index===PRECOMPOSED_SNOW_STAGES-1)return 'trees-'+kind+'-snow-04';
 return 'trees-'+kind+'-precomposed-'+String(index).padStart(2,'0');
}
