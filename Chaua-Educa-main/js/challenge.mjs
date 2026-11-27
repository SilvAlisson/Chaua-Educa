import {CAMPAIGN_TARGET_SECONDS} from './journey.mjs';
// Active flight time keeps progressing after the scenery reaches its last stage.
// All values are deterministic; no input tracking or hidden difficulty adaptation.
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export function challengeSpeedGain(seconds=0){
 const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
 return Math.min(185,t*.45+Math.max(0,t-40)*.35)+60*clamp((t-240)/300);
}
export function challengeAt(seconds=0){
 const t=Math.max(0,Number.isFinite(seconds)?seconds:0),pressure=clamp((t-30)/(CAMPAIGN_TARGET_SECONDS-30));
 const gain=challengeSpeedGain(t);
 return {pressure,speedGain:gain,shiftMultiplier:1+pressure*1.4,
  drift:pressure*24,shiftLimit:60+pressure*40,shiftRate:160+pressure*25,
  minInterval:1.16-pressure*.18,quietEvery:pressure<.32?6:pressure<.68?8:10,
  hawkEvery:pressure<.5?3:4,hawkBoost:50+pressure*45,
  name:pressure<.2?'Primeiras correntes':pressure<.48?'Travessia ágil':pressure<.78?'Asas experientes':'Voo de resistência'};
}
