import {climateJourneyProgress} from './climate-progress.mjs';

// Atlas IDs are fixed by the existing artwork: 0=spring, 1=autumn,
// 2=summer, 3=winter. Never reorder the image cells or recreate character art.
export const SEASON_IDS=Object.freeze({spring:0,autumn:1,summer:2,winter:3});

// Calibrated around successful flight times, not points or capped world distance.
// The full winter scene is reached at 74% of reference flight time, leaving
// a visible winter even for the fastest (523s) successful seeded run.
export const CLIMATE_TRANSITIONS=Object.freeze([
 Object.freeze({start:.20,end:.27,from:0,to:2}),
 Object.freeze({start:.43,end:.50,from:2,to:1}),
 Object.freeze({start:.65,end:.74,from:1,to:3})
]);
const unit=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const smooth=x=>{const t=unit(x);return t*t*(3-2*t);};

export function seasonAtProgress(progress){
 const p=unit(progress);
 for(const step of CLIMATE_TRANSITIONS){
  if(p<step.start) return {from:step.from,to:step.from,mix:1};
  if(p<step.end) return {from:step.from,to:step.to,mix:smooth((p-step.start)/(step.end-step.start))};
 }
 return {from:3,to:3,mix:1};
}

export function seasonWeights(state){
 const weights=[0,0,0,0];
 weights[state.from]+=1-state.mix;
 weights[state.to]+=state.mix;
 return weights;
}

export function seasonFromFlight(game){
 return seasonAtProgress(climateJourneyProgress(game));
}
