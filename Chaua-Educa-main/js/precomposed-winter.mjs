import {PERF_AB_VARIANT} from './perf-ab.mjs';
import {WINTER_CAP_ART} from './winter-cap-data.mjs';

export const PRECOMPOSED_SNOW_STAGES=WINTER_CAP_ART.stages;
export const PRECOMPOSED_SNOW_STAGE_PREFETCH=PERF_AB_VARIANT==='winter-caps-stage-prefetch';
export const PRECOMPOSED_SNOW_STAGE_CACHE=PRECOMPOSED_SNOW_STAGE_PREFETCH||PERF_AB_VARIANT==='winter-caps-stage-cache';
export const PRECOMPOSED_SNOW_COMPACT_STAGES=PERF_AB_VARIANT==='winter-caps-compact-stages';
export const PRECOMPOSED_SNOW_ACTIVE=[
 'precomposed-snow',
 'winter-caps-bitmap',
 'winter-caps-stage-cache',
 'winter-caps-stage-prefetch',
 'winter-caps-compact-stages',
 'snow-flakes-off',
 'static-season-bg'
].includes(PERF_AB_VARIANT);
export const winterCapKey=page=>'winter-caps-'+page;
export const winterStageKey=stage=>'winter-caps-stage-'+stage;
export function precomposedSnowStage(snow){
 const amount=Number.isFinite(snow)?Math.max(0,Math.min(1,snow)):0;
 // Start with a light dusting and reserve the completely coated art for 100%.
 return Math.floor(amount*(PRECOMPOSED_SNOW_STAGES-1)+1e-8);
}
export function winterCapFrame(kind,stage,variant){
 return WINTER_CAP_ART.frames[kind][stage]?.[variant];
}
export function winterStageFrame(kind,stage,variant){
 return WINTER_CAP_ART.stageFrames?.[kind]?.[stage]?.[variant];
}
