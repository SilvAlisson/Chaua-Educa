// Shared by animation, timing, collision and telegraphs. Never retarget after lock.
export const SNAKE_ATTACKS=Object.freeze({
 frontal:Object.freeze({key:'attack',label:'Bote frontal',windup:.45,strike:.22,recovery:.6,clearance:170}),
 alto:Object.freeze({key:'high',label:'Bote alto',windup:.56,strike:.28,recovery:.7,clearance:215}),
 varredura:Object.freeze({key:'sweep',label:'Varredura baixa',windup:.62,strike:.34,recovery:.75,clearance:185})
});
export const SNAKE_ATTACK_ORDER=Object.freeze(Object.keys(SNAKE_ATTACKS));
const gentle=Object.fromEntries(Object.entries(SNAKE_ATTACKS).map(([key,p])=>[key,Object.freeze({...p,windup:p.windup*1.2,strike:p.strike*1.15})]));
export const snakeAttack=s=>(s?.gentle?gentle:SNAKE_ATTACKS)[s?.attackType]??SNAKE_ATTACKS.frontal;
export const HAWK_ATTACKS=Object.freeze({
 mergulho:Object.freeze({label:'Mergulho',startY:105}),
 rasante:Object.freeze({label:'Rasante',startY:535}),
 gancho:Object.freeze({label:'Gancho',startY:105})
});
export const HAWK_ATTACK_ORDER=Object.freeze(Object.keys(HAWK_ATTACKS));
