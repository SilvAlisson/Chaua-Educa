// Secondary offsets use only the existing character art and simulation clocks.
const clamp = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
export function tailTipSwing(s = {}, reduced = false) {
    if(reduced)return 0;
    const age=Math.max(0,Number.isFinite(s.age)?s.age:0);
    if(s.retreat){
        if(!s.dazed)return 0;
        const t=Math.max(0,Number.isFinite(s.retreatTime)?s.retreatTime:0);
        if(t>=1)return 0;
        return Math.sin(t*21)*(1-clamp(t/1))*0.75;
    }
    const weight=(s.phase==='windup'||s.phase==='striking')?.4:1;
    return Math.sin(age*Math.PI*1.8)*weight;
}
export function hawkDazeVisual(time=0,reduced=false) {
    if(reduced)return {x:0,y:0,angle:0,stars:0};
    const t=Math.max(0,Number.isFinite(time)?time:0);
    if(t>=1.45)return {x:0,y:0,angle:0,stars:0};
    const onset=Math.sin(clamp(t/.12)*Math.PI/2);
    const fade=Math.pow(1-clamp(t/1.45),1.5);
    const e=onset*fade;
    return {x:Math.sin(t*11)*2.2*e,y:Math.sin(t*16)*3.2*e,
        angle:(Math.sin(t*14)*.13+Math.sin(t*8)*.055)*e,
        stars:1-clamp((t-.15)/1.15)};
}
export function snakeDazeVisual(time=0,reduced=false) {
    if(reduced)return {x:0,y:0,angle:0,stars:0};
    const t=Math.max(0,Number.isFinite(time)?time:0);
    if(t>=1)return {x:0,y:0,angle:0,stars:0};
    const e=Math.pow(1-clamp(t/1),1.4);
    return {x:Math.sin(t*18)*2.5*e,y:Math.sin(t*12)*1.4*e,
        angle:Math.sin(t*16)*.075*e,stars:1-clamp((t-.05)/1.05)};
}

export function parrotShieldVisual(age,reduced=false){
 if(reduced||!Number.isFinite(age)||age<0||age>=.30)return {x:0,y:0,angle:0};
 const fade=Math.pow(1-age/.30,1.5);
 const onset=Math.sin(Math.min(1,age/.09)*Math.PI/2);
 return {x:-2*onset*fade,y:Math.sin(age*25)*1.5*fade,angle:Math.sin(age*22)*.065*fade};
}
