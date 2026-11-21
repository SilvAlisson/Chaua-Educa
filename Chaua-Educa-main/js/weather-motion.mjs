// Integrate changing weather velocities in active scene time. Multiplying a
// new wind/speed by the entire flight age teleports particles at transitions.
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
export class WeatherMotion {
 constructor(){this.time=null;this.seed=null;this.previous=null;this.travel={wind:0,storm:0,speed:0};}
 advance(time,{wind=0,storm=0,speed=250,seed=0}={}){
  time=Math.max(0,finite(time));
  const next={wind:finite(wind),storm:finite(storm),speed:finite(speed,250)};
  const dt=this.time===null?0:time-this.time;
  // A discontinuous seek/replay starts a reproducible static scene. A pause
  // (same time) never advances particles, even if controls change meanwhile.
  if(this.time===null||seed!==this.seed||dt<0||dt>1){
   for(const key of Object.keys(next))this.travel[key]=time*next[key];
  }else{
   for(const key of Object.keys(next))this.travel[key]+=dt*(this.previous[key]+next[key])*.5;
  }
  this.time=time;this.seed=seed;this.previous=next;
  return this.travel;
 }
}
