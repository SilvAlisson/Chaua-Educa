import {TREE_WIDTH} from './forest-geometry.mjs';
const TAU=Math.PI*2;
function bark(c,width,length,variant){
 const shades=[['#4b3426','#92663e','#b18855','#58402b'],['#493828','#836445','#aa885c','#53412c'],['#513c28','#957248','#b08d5b','#5c432c']][variant%3];
 const light=c.createLinearGradient(-width/2,0,width/2,0);[0,.28,.58,1].forEach((p,i)=>light.addColorStop(p,shades[i]));c.fillStyle=light;c.fillRect(-width/2-3,-4,width+6,length+8);
 c.lineWidth=2;c.strokeStyle='#3e30254d';
 for(let j=0;j<7;j++){const x=-width/2+7+j*(width-14)/6;c.beginPath();c.moveTo(x,0);for(let y=0;y<length;y+=77)c.bezierCurveTo(x+Math.sin(j*2.7+y*.011)*9,y+22,x-5,y+50,x+Math.sin(j*1.7+y*.009)*7,y+77);c.stroke();}
 c.strokeStyle='#d0ad7340';c.lineWidth=1.5;for(let j=0;j<3;j++){c.beginPath();c.moveTo(-width*.3+j*width*.28,20);c.bezierCurveTo(-width*.16+j*width*.24,110,-width*.4+j*width*.24,180,-width*.27+j*width*.24,length);c.stroke();}
 for(let j=0;j<2;j++){const x=(j%2?1:-1)*width*.16,y=130+j*263;if(y>length-35)break;c.beginPath();c.moveTo(x,y-30);c.bezierCurveTo(x-19,y-9,x-11,y+22,x,y+30);c.bezierCurveTo(x+16,y+5,x+10,y-13,x,y-30);c.strokeStyle='#47342788';c.lineWidth=2;c.stroke();c.beginPath();c.ellipse(x,y,4,12,.15,0,TAU);c.fillStyle='#513c2988';c.fill();}

}
export function drawLivingTrunk(c,{x,y,upper=false,width=TREE_WIDTH,length=900,variant=0,time=0}){
 c.save();c.translate(x,y);if(upper)c.scale(1,-1);
 c.beginPath();c.moveTo(-width*.5,length);c.bezierCurveTo(-width*.53,length*.6,-width*.46,75,-width*.5,25);c.quadraticCurveTo(-width*.48,3,-width*.26,1);c.quadraticCurveTo(-width*.1,8,width*.08,2);c.bezierCurveTo(width*.34,-2,width*.48,5,width*.5,25);c.bezierCurveTo(width*.47,110,width*.53,length*.5,width*.5,length);c.closePath();
 c.save();c.clip();bark(c,width,length,variant);c.restore();c.strokeStyle='#483726';c.lineWidth=1.5;c.stroke();
 
 c.restore();
}
export function drawLivingBranch(c,{rootX,rootY,tipX,tipY,thickness=35,variant=0}){
 const left=tipX<rootX?-1:1,span=Math.abs(rootX-tipX);
 c.save();c.beginPath();c.moveTo(rootX,rootY-thickness*.55);c.bezierCurveTo(rootX+left*span*.3,rootY-thickness*.28,tipX-left*span*.22,tipY-9,tipX,tipY);c.quadraticCurveTo(tipX-left*4,tipY+9,tipX-left*18,tipY+14);c.bezierCurveTo(rootX+left*span*.55,tipY+24,rootX+left*span*.3,rootY+thickness*.5,rootX,rootY+thickness*.65);c.closePath();
 const light=c.createLinearGradient(0,tipY-10,0,rootY+thickness);light.addColorStop(0,'#af8958');light.addColorStop(.35,'#947044');light.addColorStop(1,'#58402c');c.fillStyle=light;c.fill();c.strokeStyle='#5f442d';c.lineWidth=1.5;c.stroke();
 c.beginPath();c.moveTo(rootX,rootY-thickness*.18);c.bezierCurveTo(rootX+left*span*.3,rootY,tipX-left*span*.22,tipY+4,tipX-left*12,tipY+6);c.strokeStyle='#d5b57b55';c.stroke();c.restore();
}
export function drawRefugeTree(c,r,support,time=0){
 const rootX=r.x+220;
 // Branch roots are behind the trunk, so there is no cut line pasted onto its bark.
 drawLivingBranch(c,{rootX,rootY:support+66,tipX:r.x-74,tipY:support-6,thickness:91});
 drawLivingBranch(c,{rootX:rootX+20,rootY:170,tipX:rootX+175,tipY:82,thickness:62});
 drawLivingTrunk(c,{x:rootX,y:-150,width:215,length:1030,variant:1,time});
}
