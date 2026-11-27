import {climateJourneyProgress} from './climate-progress.mjs';

// Verified against the ORIGINAL assets/v10/season-backgrounds.webp and
// assets/v10/README.md: TL=spring, TR=summer, BL=autumn, BR=winter.
// These indices describe atlas CELLS, not an arbitrary enum order.
export const SEASON_IDS=Object.freeze({spring:0,summer:1,autumn:2,winter:3});

// Calibrated around successful flight times, not points or capped world distance.
// Full winter arrives at 74% of the six-minute reference, leaving time for
// progressive surface accumulation before the refuge.
export const CLIMATE_TRANSITIONS=Object.freeze([
 Object.freeze({start:.20,end:.27,from:0,to:1}),
 Object.freeze({start:.43,end:.50,from:1,to:2}),
 Object.freeze({start:.65,end:.74,from:2,to:3})
]);
const unit=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const smooth=x=>{const t=unit(x);return t*t*(3-2*t);};

export function seasonAtProgress(progress, out = null){
 const p=unit(progress);
 let from=3, to=3, mix=1;
 for(const step of CLIMATE_TRANSITIONS){
  if(p<step.start){from=step.from;to=step.from;mix=1;break;}
  if(p<step.end-1e-12){from=step.from;to=step.to;mix=smooth((p-step.start)/(step.end-step.start));break;}
 }
 if(out){out.from=from;out.to=to;out.mix=mix;return out;}
 return {from,to,mix};
}

export function seasonWeights(state, out = null){
 const weights=out||[0,0,0,0];
 weights[0]=0;weights[1]=0;weights[2]=0;weights[3]=0;
 weights[state.from]+=1-state.mix;
 weights[state.to]+=state.mix;
 return weights;
}

export function seasonFromFlight(game, out = null){
 return seasonAtProgress(climateJourneyProgress(game), out);
}
