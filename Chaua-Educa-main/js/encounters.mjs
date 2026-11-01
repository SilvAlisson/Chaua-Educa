import {JOURNEY} from './journey.mjs';
// Declarative encounter vocabulary. Coordinates are always logical world units.
export const ENCOUNTERS = Object.freeze([
    {id:'central', unlock:0, shift:0, extraGap:0, interval:0, fruitOffsets:[[15,0]]},
    {id:'wide', unlock:0, shift:0, extraGap:12, interval:.15, fruitOffsets:[[15,0]]},
    {id:'climb', unlock:10, shift:-40, extraGap:4, interval:.1, fruitOffsets:[[15,0]]},
    {id:'descent', unlock:10, shift:40, extraGap:4, interval:.1, fruitOffsets:[[15,0]]},
    {id:'curve', unlock:20, shift:0, extraGap:6, interval:.2, fruitOffsets:[[-105,-.5],[15,.5],[135,-.5]]},
    {id:'branch', variant:'branch', unlock:22, shift:0, extraGap:4, interval:.1, fruitOffsets:[[15,0]]},
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
export function planEncounter({sequence,elapsed,lastCenter,lastPattern,profile,speed,stage=0,random}) {
    const eligible=ENCOUNTERS.filter(p=>p.unlock<=elapsed && p.id!==lastPattern).flatMap(p=>JOURNEY[stage].patterns.includes(p.id)?[p,p]:[p]);
    const pattern=sequence===0?ENCOUNTERS[0]:eligible[Math.min(eligible.length-1,Math.floor(random()*eligible.length))];
    const interval=Math.max(profile.minInterval,profile.interval-elapsed*profile.ramp)+pattern.interval;
    // Conservative travel budget after clearing 220 units of wood/branches,
    // allowing 0.45s to release, reverse or wait for a wingbeat.
    const available=Math.max(0,(interval*speed-220)/300-.45);
    const maxShift=Math.min(55,available*100);
    const shift=Math.max(-maxShift,Math.min(maxShift,pattern.shift+(random()-.5)*16));
    const center=Math.max(200,Math.min(440,lastCenter+shift));
    const progression = Math.min(1, sequence / 25);
    const gap = Math.max(profile.minGap, Math.round(profile.gap - progression * (profile.gap - profile.minGap))) + pattern.extraGap * (1 - progression * 0.4);
    const amplitude=Math.max(0,gap/2-48), sign=random()<.5?-1:1;
    return {id:pattern.id, center,gap,interval,maxShift,optional:!!pattern.optional,variant:pattern.variant,
        fruits:pattern.fruitOffsets.map(([x,factor])=>({x,y:center+factor*amplitude*(pattern.optional?sign:1)}))};
}
