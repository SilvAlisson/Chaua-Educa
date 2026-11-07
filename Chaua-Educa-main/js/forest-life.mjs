import {breeze,winterAmount} from './living-motion.mjs';
export function drawForestLife(c,w,h,time,distance,rain,wind,reduced=false,low=false){
 const t=reduced?0:time,air=breeze(t,wind,reduced),snow=winterAmount(distance);
 c.save();
 if(snow>0){
  c.globalAlpha=snow*.09;c.fillStyle='#deefff';c.fillRect(0,0,w,h);
  if(!reduced)for(let layer=0;layer<2;layer++){
   c.globalAlpha=snow*(layer?.65:.32);c.fillStyle='#f4f9ff';c.beginPath();
   for(let i=0;i<(low?16:40);i++){
    const x=((i*139.73-t*(18+layer*17)+Math.sin(t*.6+i)*18+air*20)%(w+40)+w+40)%(w+40)-20;
    const y=(i*71.17+t*(18+layer*20))%(h+30)-15,r=layer?2.1:1;
    c.moveTo(x+r,y);c.arc(x,y,r,0,Math.PI*2);
   }c.fill();
  }
 }
 if(!low){
  const mist=c.createLinearGradient(0,h*.72,0,h);mist.addColorStop(0,'#d8e9df00');mist.addColorStop(1,'#d8e9df25');
  c.globalAlpha=.4+rain*.4;c.fillStyle=mist;c.translate(air*9,Math.sin(t*.21)*3);c.fillRect(-20,h*.72,w+40,h*.28+10);
 }
 c.restore();
}
