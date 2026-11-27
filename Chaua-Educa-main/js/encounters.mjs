import {challengeAt} from './challenge.mjs';
import {JOURNEY} from './journey.mjs';
// Declarative encounter vocabulary. Coordinates are always logical world units.
export const ENCOUNTERS = Object.freeze([
    {id:'central', unlock:0, shift:0, extraGap:0, interval:0, fruitOffsets:[[15,0]]},
    {id:'wide', unlock:0, shift:0, extraGap:12, interval:.15, fruitOffsets:[[15,0]]},
    {id:'climb', unlock:10, shift:-40, extraGap:4, interval:.1, fruitOffsets:[[15,0]]},
    {id:'descent', unlock:10, shift:40, extraGap:4, interval:.1, fruitOffsets:[[15,0]]},
    {id:'curve', unlock:20, shift:0, extraGap:6, interval:.2, fruitOffsets:[[-105,-.5],[15,.5],[135,-.5]]},
    {id:'branch', variant:'branch', unlock:22, shift:0, extraGap:4, interval:.1, fruitOffsets:[[15,0]]},
    {id:'choice-curve',unlock:40,shift:0,extraGap:60,interval:.3,optional:true,fruitOffsets:[[-125,.75],[15,1],[155,.75]]},
    {id:'choice', unlock:25, shift:0, extraGap:8, interval:.2, optional:true, fruitOffsets:[[-105,1],[15,1],[135,1]]},
]);
export function seededRandom(seed) {
    let state=seed>>>0;
    return () => {
        state=(state+0x6d2b79f5)>>>0;
        let t=Math.imul(state^(state>>>15),1|state);
        t^=t+Math.imul(t^(t>>>7),61|t);
        return ((t^(t>>>14))>>>0)/4294967296;
    };
}
export function planEncounter({sequence,elapsed,lastCenter,lastPattern,profile,speed,stage=0,random,recentPatterns=[]}) {
    let eligible=ENCOUNTERS.filter(p=>p.unlock<=elapsed && p.id!==lastPattern).flatMap(p=>JOURNEY[stage].patterns.includes(p.id)?[p,p]:[p]);
    const varied=eligible.filter(p=>!recentPatterns.slice(-3).includes(p.id));
    if(varied.length)eligible=varied;
    const pattern=sequence===0?ENCOUNTERS[0]:eligible[Math.min(eligible.length-1,Math.floor(random()*eligible.length))];
    const challenge=profile.actualSpeed?challengeAt(elapsed):null;
    const interval=Math.max(challenge?.minInterval??profile.minInterval,profile.interval-elapsed*profile.ramp)+pattern.interval;
    // Amigável keeps its original travel budget. Aventura uses its actual
    // speed and a tighter reversal budget to produce meaningful height changes.
    const available=Math.max(0,(interval*speed-(profile.clearance??220))/(profile.actualSpeed?speed:300)-(profile.turnaround??.45));
    const maxShift=Math.min(challenge?.shiftLimit??profile.shiftLimit??55,available*(challenge?.shiftRate??profile.shiftRate??100));
    const shift=Math.max(-maxShift,Math.min(maxShift,(pattern.shift||(sequence%2?1:-1)*(challenge?.drift??0))*(challenge?.shiftMultiplier??1)+(random()-.5)*16));
    const center=Math.max(200,Math.min(440,lastCenter+shift));
    const progression = Math.min(1, sequence / 25);
    const gap = Math.max(profile.minGap, Math.round(profile.gap - progression * (profile.gap - profile.minGap))) + pattern.extraGap * (1 - progression * 0.4);
    const amplitude=Math.max(0,gap/2-(profile.fruitMargin??48)), sign=random()<.5?-1:1;
    return {id:pattern.id, center,gap,interval,maxShift,optional:!!pattern.optional,variant:pattern.variant,
        fruits:pattern.fruitOffsets.map(([x,factor])=>({x,y:center+factor*amplitude*(pattern.optional?sign:1)}))};
}

// Introduce each authored attack once in its teaching order; later bags are
// independently seeded, contain all three attacks and avoid boundary repeats.
export function attackAt(order,index,seed,salt=0){
 const n=Math.max(0,Math.floor(Number.isFinite(index)?index:0));
 if(n<order.length)return order[n];
 const random=seededRandom((seed^salt)>>>0);let bag=[...order],previous=bag.at(-1);
 for(let block=1;block<=Math.floor(n/order.length);block++){
  bag=[...order];
  for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
  if(bag[0]===previous)[bag[0],bag[1]]=[bag[1],bag[0]];
  previous=bag.at(-1);
 }
 return bag[n%order.length];
}
