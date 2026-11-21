import {CAMPAIGN_TARGET_SECONDS} from './journey.mjs';
// Planned six-minute campaign. Seasons use active flight time, never score.
// The small per-seed variation is retained; pauses and quizzes freeze time.
export const CLIMATE_FLIGHT_REFERENCE = Object.freeze({
 aventura:CAMPAIGN_TARGET_SECONDS,
 tranquilo:CAMPAIGN_TARGET_SECONDS
});

const clamp01 = x => Math.min(1,Math.max(0,Number.isFinite(x)?x:0));

// No points or progress bar enter this formula. Flight time continues to
// advance even when the world-distance cap is reached and stops on pause/quiz.
// The tiny deterministic per-run offset avoids a mechanical identical timestamp.
export function climateReferenceSeconds(mode='aventura',seed=0){
 const baseline=CLIMATE_FLIGHT_REFERENCE[mode]??CLIMATE_FLIGHT_REFERENCE.aventura;
 const hash=Math.imul((Number(seed)||0)>>>0,0x9e3779b1)>>>0;
 const offset=(hash/4294967295-.5)*.08;
 return baseline*(1+offset);
}

export function climateJourneyProgress({elapsed=0,mode='aventura',seed=0}={}){
 return clamp01(Number(elapsed)/climateReferenceSeconds(mode,seed));
}
