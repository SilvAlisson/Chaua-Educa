import {breeze,treeBend,winterAmount} from './living-motion.mjs';
import {drawForestLife} from './forest-life.mjs';
import {HAWK_ART,hawkUsesActionArt} from './hawk-geometry.mjs';
import {SeasonalBackdrop,drawSeasonParticles} from './seasons.mjs';
import {drawContinuousSnake} from './snake-render.mjs';
import {drawSnakeA2,preloadSnakeA2,isSnakeA2Ready} from './snake-a2.mjs';
import {parrotAction,hawkAction} from './action-states.mjs';
import {drawActionSheet,preloadActionSheets,ACTION_SPRITES_ENABLED} from './action-sheets.mjs';
import {SNAKE_WRAP} from './snake-wrap-data.mjs';
import {drawLivingTrunk,drawTreeVariant,drawRefugeTree} from './tree-art.mjs';
import {TREE_WIDTH} from './forest-geometry.mjs';
import {SPRITES} from './sprite-data.mjs';
import {birdAnimation,hawkAnimation,snakePlacement,placeWarnings} from './animation.mjs';
import {hawkAngle} from './collision.mjs';
import { canvasResolution } from './quality.mjs';
import { flightViewport, advanceFlightCamera, warningPosition, snakeWarningPosition } from './viewport.mjs';
import { images, loadAssets } from './assets.mjs';
import { impactPose, smoothstep } from './motion.mjs';
import { journeyRain, journeyStorm, journeyWind, journeyFog, drawJourneyRain, drawForegroundRain, drawSurfaceRainImpacts, drawJourneyFog, drawLightning } from './weather.mjs';
import { FRUITS } from './fruits.mjs';
import { WIDTH, HEIGHT } from './engine.mjs';

const TAU = Math.PI * 2;
const BACKGROUND_PALETTE=['#dbe7b5','#dde0a1','#e6d8a0','#d9e9b7'];
const TINT_PALETTE=['#bdcf8c','#e4c16b','#507b63','#92bf74'];

const mixColor = (a, b, t) => {
    const r = Math.round(parseInt(a.slice(1, 3), 16) * (1 - t) + parseInt(b.slice(1, 3), 16) * t);
    const g = Math.round(parseInt(a.slice(3, 5), 16) * (1 - t) + parseInt(b.slice(3, 5), 16) * t);
    const bl = Math.round(parseInt(a.slice(5, 7), 16) * (1 - t) + parseInt(b.slice(5, 7), 16) * t);
    return `rgb(${r},${g},${bl})`;
};

const spriteBlendBuffers=new Map();
function blendSprite(c, first, second, blend, extent=128) {
    // Separate reusable buffers avoid reallocating when switching bird sizes.
    let buffer=spriteBlendBuffers.get(extent);
    if(!buffer){
        const rasterScale=extent===180?320/HAWK_ART.size:2;
        const size=Math.ceil(extent*2*rasterScale);
        const surface=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(size,size):
            typeof document!=='undefined'?document.createElement('canvas'):null;
        if(!surface){(blend<.5?first:second)(c);return;}
        surface.width=size;surface.height=size;
        buffer={surface,layer:surface.getContext('2d'),rasterScale};spriteBlendBuffers.set(extent,buffer);
    }
    const {surface,layer,rasterScale}=buffer;
    layer.setTransform(1,0,0,1,0,0);layer.clearRect(0,0,surface.width,surface.height);
    layer.setTransform(rasterScale,0,0,rasterScale,extent*rasterScale,extent*rasterScale);
    layer.globalCompositeOperation='source-over';layer.globalAlpha=1;first(layer);
    layer.globalAlpha=blend;second(layer);
    layer.globalAlpha=1;
    c.drawImage(surface,-extent,-extent,extent*2,extent*2);
}

function atlasFrame(c,name,index,factor){
    const data=SPRITES[name],frame=data.frames[index],image=images.get(`${name}-atlas`);
    if(!image)return;
    c.drawImage(image,...frame.rect,-frame.anchor[0]*factor,-frame.anchor[1]*factor,data.cell*factor,data.cell*factor);
}
function atlasAnimation(c,name,clip,factor,extent=128){
    if(clip.blend>0&&clip.frame!==clip.next)blendSprite(c,layer=>atlasFrame(layer,name,clip.frame,factor),layer=>atlasFrame(layer,name,clip.next,factor),clip.blend,extent);
    else atlasFrame(c,name,clip.frame,factor);
}
function perchedSprite(c,clip,factor){
    // Blink changes only the eye. Switching whole idle poses moves the feet
    // because the generated closed-eye pose has a different body silhouette.
    atlasFrame(c,'chaua',12,factor);
    const closed=clip.frame===13?1-clip.blend:clip.next===13?clip.blend:0;
    if(closed<=0)return;
    const openEye=SPRITES.chaua.frames[12].eye;
    c.save();c.beginPath();
    c.ellipse((openEye[0]-192)*factor,(openEye[1]-192)*factor,21*factor,25*factor,0,0,TAU);c.clip();
    c.globalAlpha*=closed;
    atlasFrame(c,'chaua',13,factor);c.restore();
}

export function woodContactPosition(game,progress=0,reduced=false){
    const rect=game.impactContact;
    if(!rect||!['impact','ended'].includes(game.state)||game.won)return {x:game.x,y:game.y};
    const pose=reduced?{x:0,y:0,angle:0}:impactPose(progress),angle=game.angle+pose.angle;
    const clip=birdAnimation({wing:game.wing,defeated:true,impactProgress:progress,reduced});
    const factor=27.7027*.74/SPRITES.chaua.landmarkWidth;
    const cos=Math.cos(angle),sin=Math.sin(angle);
    let maxX=-Infinity;
    const f0=clip.frame,f1=clip.next;
    for(let pass=0;pass<2;pass++){
        const idx=pass===0?f0:f1;
        if(pass===1&&f1===f0)break;
        const [x,y,w,h]=SPRITES.chaua.frames[idx].content;
        const x0=(x-192)*factor,x1=(x+w-192)*factor;
        const y0=(y-192)*factor,y1=(y+h-192)*factor;
        const p0=x0*cos-y0*sin+pose.x;if(p0>maxX)maxX=p0;
        const p1=x1*cos-y0*sin+pose.x;if(p1>maxX)maxX=p1;
        const p2=x0*cos-y1*sin+pose.x;if(p2>maxX)maxX=p2;
        const p3=x1*cos-y1*sin+pose.x;if(p3>maxX)maxX=p3;
    }
    return {x:Math.min(game.x,rect.x-maxX-2),y:game.y};
}

function birdFoot(scale){
    const f=SPRITES.chaua.frames[12];return (f.content[1]+f.content[3]-5-f.anchor[1])*27.7027*scale/SPRITES.chaua.landmarkWidth;
}
function animatedBird(c,p){
    const {x,y,scale=1,angle=0,time=0,reduced=false,reaction=0,defeated=false,impactProgress=0,turbo=false,stamina=1,perched=false,surprise=false,won=false,landing=null,snow=0,rain=0}=p;
    const clip=birdAnimation({wing:p.wing,time,perched:perched&&!surprise,landing,defeated:defeated||surprise,impactProgress:surprise?1:impactProgress,reduced});
    const factor=27.7027*scale/SPRITES.chaua.landmarkWidth,size=125*scale;
    c.save();c.translate(x,y);
    if(defeated&&!reduced){const hit=impactPose(impactProgress);c.translate(hit.x,hit.y);c.rotate(angle+hit.angle);}
    else {
        const heave=(!reduced&&!perched&&p.flapImpulse>0)?p.flapImpulse*Math.sin(p.flapImpulse*Math.PI)*3.5:0;
        const heaveAngle=(!reduced&&!perched&&p.flapImpulse>0)?-p.flapImpulse*0.04:0;
        if(heave!==0)c.translate(0,-heave);
        c.rotate(angle+heaveAngle);
    }
    if(turbo&&!perched&&!reduced)drawTurboFlames(c,size,time);
    const action=parrotAction({...p,time,wing:p.wing,reduced,perched,landing,defeated,surprise,impactProgress});
    const newSprite=!!action&&drawActionSheet(c,action.sheet,action.frame,-77*scale,-77*scale,154*scale,154*scale);
    if(!newSprite){
        if(perched&&!surprise&&!defeated&&landing===null)perchedSprite(c,clip,factor);
        else atlasAnimation(c,'chaua',clip,factor);
    }
    const a=SPRITES.chaua.frames[clip.frame].eye,b=SPRITES.chaua.frames[clip.next].eye;
    const ex=(a[0]+(b[0]-a[0])*clip.blend-192)*factor,ey=(a[1]+(b[1]-a[1])*clip.blend-192)*factor;
    if(defeated||surprise){
        if(!newSprite){drawSpiralEye(c,ex,ey,size*.027,reduced?0:time);if(!reduced)drawOrbitingStars(c,ex,ey-size*.35,size,time);}
    }
    else if(reaction>0&&!reduced)drawFruitSparkles(c,size*.44,-size*.08,reaction,time);
    else if(stamina<.28&&!reduced&&!perched)drawSweatDrops(c,ex,ey,size,time);
    if(snow>0&&!reduced&&!defeated&&!surprise){
        drawAnimalBreath(c,44*scale,2*scale,snow,time,2.4,0.46,1,20*scale,-10*scale);
    }
    if(rain>0&&!reduced&&!perched&&!defeated){
        c.save();
        // Only a thin glint on the existing head contour. Do not draw an
        // oval that could be mistaken for a new forehead or duplicate head.
        c.globalAlpha=Math.min(.3,rain*.25);
        c.strokeStyle='#a5ced9';c.lineWidth=Math.max(.8,scale*1.4);
        c.lineCap='round';
        c.beginPath();
        c.moveTo(-14*scale,-32*scale);
        c.quadraticCurveTo(8*scale,-37*scale,24*scale,-29*scale);
        c.stroke();

        // 2. Light water beads, never full-white circles obscuring the face.
        c.globalAlpha=Math.min(.45,rain*.38);
        c.fillStyle='#add6df';
        c.beginPath();
        for(let i=0;i<4;i++){
            const hitCycle=(time*9+i*1.73)%1;
            const hitOriginX=(38-i*5)*scale;
            const hitOriginY=(-6-i*4)*scale;
            const spX=hitOriginX-hitCycle*(28+(i%2)*14)*scale;
            const spY=hitOriginY-Math.sin(hitCycle*Math.PI)*(10+(i%3)*4)*scale+hitCycle*7*scale;
            const spR=Math.max(0.7,(1-hitCycle)*2.2*scale);
            c.moveTo(spX+spR,spY);
            c.arc(spX,spY,spR,0,TAU);
        }

        // 3. Wing flap spray (water droplets cast off wingtips on downstroke)
        if(p.wing>0.08||p.flapImpulse>0.05){
            const wingPhase=1-(p.wing||0);
            for(let w=0;w<5;w++){
                const wt=(time*11+w*1.45)%1;
                const tipX=(-8+Math.sin(wingPhase*Math.PI)*18-wt*32)*scale;
                const tipY=(16+(w-2)*9+wt*22)*scale;
                const wr=Math.max(0.6,(1-wt)*2.0*scale);
                c.moveTo(tipX+wr,tipY);
                c.arc(tipX,tipY,wr,0,TAU);
            }
        }

        // 4. Subtle slipstream wake from tail
        for(let t=0;t<3;t++){
            const tt=(time*5+t*2.3)%1;
            const wakeX=(-42-tt*36)*scale;
            const wakeY=(4+Math.sin(time*3+t)*5)*scale;
            const wakeR=(1-tt)*1.8*scale;
            c.moveTo(wakeX+wakeR,wakeY);
            c.arc(wakeX,wakeY,wakeR,0,TAU);
        }
        c.fill();
        c.restore();
    }
    if(turbo&&!perched&&!reduced)drawTurboWindLines(c,size,time);
    if(won&&!reduced)drawRefugeHearts(c,0,-size*.25,size,time);
    c.restore();
}

function oval(c, x, y, rx, ry, color, angle = 0) {
    c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), angle, 0, TAU);
    c.fillStyle = color; c.fill();
}
function clay(c, x, y, rx, ry, light, dark, angle = 0) {
    oval(c, x, y, rx, ry, dark, angle);
    oval(c, x - rx * .2, y - ry * .2, rx * .7, ry * .7, light, angle);
}
function leaf(c, x, y, size, rotation, light = '#87b36a', dark = '#3d7349') {
    c.save(); c.translate(x, y); c.rotate(rotation);
    c.beginPath();c.moveTo(-size,0);c.bezierCurveTo(-size*.4,-size*.65,size*.55,-size*.45,size,0);
    c.bezierCurveTo(size*.35,size*.45,-size*.5,size*.5,-size,0);
    if(light===dark){
        c.fillStyle=light;c.fill();
    }else{
        const shade=c.createLinearGradient(0,-size*.45,0,size*.45);shade.addColorStop(0,light);shade.addColorStop(.52,dark);shade.addColorStop(1,light);c.fillStyle=shade;c.fill();
    }
    c.beginPath();c.moveTo(-size*.9,0);c.bezierCurveTo(-size*.3,-size*.5,size*.5,-size*.35,size*.9,0);
    c.quadraticCurveTo(0,-size*.07,-size*.9,0);const opacity=Number.isFinite(c.globalAlpha)?c.globalAlpha:1;c.globalAlpha=opacity*.35;c.fillStyle=light;c.fill();c.globalAlpha=opacity;
    c.beginPath();c.moveTo(-size*.88,0);c.quadraticCurveTo(0,-size*.1,size*.85,0);
    c.strokeStyle='#d9e6a64a';c.lineWidth=Math.max(.7,size*.025);c.stroke();
    c.restore();
}

function feather(c,x,y,size,rotation,color) {
    c.save();c.translate(x,y);c.rotate(rotation);
    c.beginPath();c.moveTo(0,-size);c.bezierCurveTo(size*.8,-size*.4,size*.55,size*.5,0,size);
    c.bezierCurveTo(-size*.55,size*.4,-size*.6,-size*.5,0,-size);c.fillStyle=color;c.fill();
    c.strokeStyle='#eff6cbb0';c.lineWidth=1;c.beginPath();c.moveTo(0,size*1.2);c.lineTo(0,-size*.8);c.stroke();
    c.restore();
}

function drawSpiralEye(c, ex, ey, r, t) {
    c.save();
    c.beginPath();
    c.arc(ex, ey, r, 0, TAU);
    c.fillStyle = '#ffffff';
    c.fill();
    c.lineWidth = Math.max(.7,r*.2);
    c.strokeStyle = '#18311a';
    c.stroke();

    c.beginPath();
    const spin = t * 11;
    const maxA = 3.2 * Math.PI;
    for (let a = 0; a <= maxA; a += 0.16) {
        const rad = (a / maxA) * (r * 0.82);
        const px = ex + Math.cos(a + spin) * rad;
        const py = ey + Math.sin(a + spin) * rad;
        if (a === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
    }
    c.lineWidth = Math.max(.65,r*.22);
    c.strokeStyle = '#152b17';
    c.stroke();
    c.restore();
}

function drawOrbitingStars(c, hx, hy, size, t) {
    c.save();
    const rx = size * 0.32;
    const ry = size * 0.12;
    c.translate(hx, hy - 6);
    c.rotate(-0.14);

    for (let i = 0; i < 3; i++) {
        const phase = t * 5.5 + (i * TAU) / 3;
        const sx = Math.cos(phase) * rx;
        const sy = Math.sin(phase) * ry;
        const depth = Math.sin(phase);
        const s = (0.85 + depth * 0.3) * (size / 100);

        c.save();
        c.translate(sx, sy);
        c.rotate(t * 3.5 + i);
        c.scale(s, s);

        c.beginPath();
        const spikes = 5, outerR = 10, innerR = 4.6;
        for (let j = 0; j < spikes * 2; j++) {
            const rad = j % 2 === 0 ? outerR : innerR;
            const a = (j * Math.PI) / spikes - Math.PI / 2;
            const px = Math.cos(a) * rad;
            const py = Math.sin(a) * rad;
            if (j === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
        }
        c.closePath();
        c.fillStyle = depth < -0.2 ? '#e5be00' : '#ffe44d';
        c.fill();
        c.lineWidth = 1.4;
        c.strokeStyle = '#7c5200';
        c.stroke();

        if (depth > -0.2) {
            c.beginPath();
            c.arc(-1.5, -2, 2.2, 0, TAU);
            c.fillStyle = '#ffffff';
            c.fill();
        }
        c.restore();
    }
    c.restore();
}

function drawMiniSparkle(c, x, y, r, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.beginPath();
    c.moveTo(0, -r); c.lineTo(r * 0.28, -r * 0.28);
    c.lineTo(r, 0); c.lineTo(r * 0.28, r * 0.28);
    c.lineTo(0, r); c.lineTo(-r * 0.28, r * 0.28);
    c.lineTo(-r, 0); c.lineTo(-r * 0.28, -r * 0.28);
    c.closePath();
    c.fillStyle = '#fff4a8';
    c.fill();
    c.lineWidth = 1.2;
    c.strokeStyle = '#8c6600';
    c.stroke();
    c.restore();
}

function drawFruitSparkles(c, bx, by, reaction, t) {
    c.save();
    const progress = Math.max(0, Math.min(1, 1 - (reaction / 0.26)));
    const floatY = -progress * 34;
    const wobble = Math.sin(progress * 15) * 6;

    c.font = '800 18px Nunito, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffe959';
    c.strokeStyle = '#223d16';
    c.lineWidth = 2.6;
    const noteX = bx + 10 + wobble;
    const noteY = by - 10 + floatY;
    c.strokeText('♪', noteX, noteY);
    c.fillText('♪', noteX, noteY);

    const sp1X = bx + 22 + wobble * 0.5;
    const sp1Y = by - 18 + floatY * 0.8;
    drawMiniSparkle(c, sp1X, sp1Y, 6, t * 6);

    const sp2X = bx - 4 - wobble * 0.4;
    const sp2Y = by - 26 + floatY * 1.1;
    drawMiniSparkle(c, sp2X, sp2Y, 4.5, t * 8 + 1);
    c.restore();
}


export function drawAnimalBreath(c, x, y, snow, time, period = 2.4, duration = 0.45, dirX = 1, speedX = 18, liftY = -8) {
    if (snow <= 0.05) return;
    const cycle = (time / period) % 1;
    if (cycle >= duration) return;
    const phase = cycle / duration;
    const alphaBase = Math.sin(phase * Math.PI) * 0.85 * snow;
    const breathImg = images.get('clay-breath');
    c.save();
    if (breathImg) {
        for (let i = 0; i < 3; i++) {
            const delay = i * 0.15;
            if (phase < delay) continue;
            const p = (phase - delay) / (1 - delay);
            const frame = Math.min(3, Math.floor(p * 4));
            const sx = frame * 128;
            const sy = 0;
            const sw = 128;
            const sh = 128;
            const scale = (0.16 + p * 0.22) * (1 - i * 0.15);
            const dw = 128 * scale;
            const dh = 128 * scale;
            const px = x + dirX * p * (speedX + i * 5);
            const py = y + p * (liftY - i * 2);
            const pa = alphaBase * (1 - p * 0.35) * (1 - i * 0.2);
            c.save();
            c.globalAlpha = Math.max(0, Math.min(1, pa));
            c.translate(px, py);
            if (dirX < 0) c.scale(-1, 1);
            c.drawImage(breathImg, sx, sy, sw, sh, -dw * 0.35, -dh * 0.5, dw, dh);
            c.restore();
        }
    } else {
        for (let i = 0; i < 4; i++) {
            const delay = i * 0.14;
            if (phase < delay) continue;
            const p = (phase - delay) / (1 - delay);
            const px = x + dirX * p * (speedX + i * 6);
            const py = y + p * (liftY - i * 3);
            const pr = 2.8 + p * (6.5 + i * 2.5);
            const pa = alphaBase * (1 - p * 0.55);
            c.fillStyle = `rgba(255, 255, 255, ${pa})`;
            c.beginPath();
            c.arc(px, py, pr, 0, TAU);
            c.fill();
            c.fillStyle = `rgba(215, 238, 255, ${pa * 0.5})`;
            c.beginPath();
            c.arc(px - dirX * 1.2, py + 1.2, pr * 0.7, 0, TAU);
            c.fill();
        }
    }
    c.restore();
}

function drawTurboFlames(c, size, t) {
    c.save();
    const tailX = -size * 0.44;
    const tailY = size * 0.06;
    c.translate(tailX, tailY);

    for (let f = 0; f < 3; f++) {
        const angle = 0.08 * (f - 1) + Math.sin(t * 30 + f) * 0.06;
        const len = (size * 0.46 + Math.sin(t * 40 + f * 2) * (size * 0.15));
        const w = size * 0.10 - f * (size * 0.02);

        c.save();
        c.rotate(angle);
        c.beginPath();
        c.moveTo(2, -w * 0.6);
        c.quadraticCurveTo(-len * 0.5, -w, -len, 0);
        c.quadraticCurveTo(-len * 0.5, w, 2, w * 0.6);
        c.closePath();

        const grad = c.createLinearGradient(0, 0, -len, 0);
        if (f === 0) {
            grad.addColorStop(0, '#ff3700ee');
            grad.addColorStop(0.6, '#ff8000cc');
            grad.addColorStop(1, '#ff370000');
        } else if (f === 1) {
            grad.addColorStop(0, '#ffbb00ee');
            grad.addColorStop(0.5, '#ffe600cc');
            grad.addColorStop(1, '#ff800000');
        } else {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, '#ffffaacc');
            grad.addColorStop(1, '#ffea0000');
        }
        c.fillStyle = grad;
        c.fill();
        c.restore();
    }
    c.restore();
}

function drawTurboWindLines(c, size, t) {
    c.save();
    c.strokeStyle = '#ffffffaa';
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
        const offset = ((t * 800 + i * 45) % (size * 1.2)) - size * 0.6;
        const ly = (i - 1) * (size * 0.22);
        c.beginPath();
        c.moveTo(-offset - size * 0.2, ly);
        c.lineTo(-offset, ly);
        c.stroke();
    }
    c.restore();
}

function drawSweatDrops(c, hx, hy, size, t) {
    c.save();
    c.translate(hx, hy);
    for (let i = 0; i < 2; i++) {
        const dropPhase = ((t * 2.6 + i * 0.5) % 1);
        const dx = -dropPhase * 36;
        const dy = -4 + dropPhase * 20;
        const alpha = Math.sin(dropPhase * Math.PI);
        const r = (size * 0.052) * (1 - dropPhase * 0.25);

        c.save();
        c.globalAlpha = Math.max(0, alpha);
        c.translate(dx, dy);
        c.rotate(-0.35);

        c.beginPath();
        c.arc(0, 0, r, 0, Math.PI);
        c.lineTo(0, -r * 2.0);
        c.closePath();

        c.fillStyle = '#5ac9ff';
        c.fill();
        c.lineWidth = 1.3;
        c.strokeStyle = '#1e6ea8';
        c.stroke();

        c.beginPath();
        c.arc(-r * 0.3, -r * 0.2, r * 0.35, 0, TAU);
        c.fillStyle = '#ffffff';
        c.fill();
        c.restore();
    }
    c.restore();
}

function drawRefugeHearts(c, x, y, size, t) {
    c.save();
    c.translate(x, y);
    for (let i = 0; i < 2; i++) {
        const phase = ((t * 1.5 + i * 0.5) % 1);
        const hx = Math.sin(phase * 4 + i) * 12;
        const hy = -phase * 35;
        const scale = (0.7 + phase * 0.4) * Math.sin(phase * Math.PI);

        c.save();
        c.translate(hx, hy);
        c.scale(scale, scale);
        c.beginPath();
        c.moveTo(0, 3);
        c.bezierCurveTo(-6, -4, -10, -10, 0, -16);
        c.bezierCurveTo(10, -10, 6, -4, 0, 3);
        c.fillStyle = '#ff5b79';
        c.fill();
        c.lineWidth = 1;
        c.strokeStyle = '#a61c3a';
        c.stroke();
        c.restore();
    }
    c.restore();
}

// Pre-rendered radial glows and static vector sprites for zero-cost drawImage in gameplay loop.
const pickupCaches = new Map();
function getPickupCache(key, radius, stops) {
    let surface = pickupCaches.get(key);
    if (surface) return surface;
    const size = radius * 2;
    surface = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) :
        typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!surface) return null;
    surface.width = size; surface.height = size;
    const gc = surface.getContext('2d');
    if (!gc) return null;
    const g = gc.createRadialGradient(radius, radius, stops[0][0], radius, radius, radius);
    for (const [, stop, color] of stops) g.addColorStop(stop, color);
    oval(gc, radius, radius, radius, radius, g);
    pickupCaches.set(key, surface);
    return surface;
}

let pepperVectorCache = null;
function getPepperSprite() {
    if (pepperVectorCache) return pepperVectorCache;
    const surface = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(48, 56) :
        typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!surface) return null;
    surface.width = 48; surface.height = 56;
    const gc = surface.getContext('2d');
    if (!gc) return null;
    gc.translate(24, 28);
    gc.beginPath();
    gc.moveTo(0, -14);
    gc.bezierCurveTo(14, -10, 16, 6, 4, 16);
    gc.bezierCurveTo(0, 20, -4, 18, -3, 15);
    gc.bezierCurveTo(-10, 6, -10, -8, 0, -14);
    const g = gc.createRadialGradient(-3, -2, 2, 0, 0, 18);
    g.addColorStop(0, '#ff785e');
    g.addColorStop(0.6, '#e62419');
    g.addColorStop(1, '#940f09');
    gc.fillStyle = g;
    gc.fill();
    gc.beginPath();
    gc.ellipse(-3, -2, 3, 7, -0.2, 0, TAU);
    gc.fillStyle = '#ffb3a6aa';
    gc.fill();
    gc.beginPath();
    gc.moveTo(0, -14);
    gc.quadraticCurveTo(4, -20, 8, -22);
    gc.strokeStyle = '#5a963b';
    gc.lineWidth = 3;
    gc.stroke();
    clay(gc, 0, -14, 5, 3, '#7ab852', '#3e6c27', 0);
    pepperVectorCache = surface;
    return surface;
}

export function drawBird(c, {
    x, y, scale = 1, angle = 0, wing = 0, perched = false, time = 0, surprise = false,
    reduced = false, reaction = 0, flapImpulse = 0, vy = 0,
    defeated = false, impactProgress = 0, turbo = false, stamina = 1, won = false, landing = null,
    shieldHitAge = null, snow = 0, rain = 0
}) {
    if(!images.has('chaua-atlas'))return;
    return animatedBird(c,{x,y,scale,angle,wing,perched,time,surprise,reduced,reaction,flapImpulse,vy,defeated,impactProgress,turbo,stamina,won,landing,shieldHitAge,snow,rain});
}

// Shared attachment geometry keeps the authored perch positioned harmoniously.
export function homePerchLayout(width, height) {
    const mobile=width<=700, scale=mobile?1.65:Math.min(3.2,Math.max(1.7,width/390));
    const x=width*(mobile?.55:.745), y=mobile?height-238:height*.52;
    const size=115*scale*1.3;
    return {mobile,scale,x,y,size,trunkWidth:0,trunkX:width,joinX:x,joinY:y,rootX:width};
}

export class Renderer {
    constructor(canvas) {
        this.quality = 'high';
        this.resolution = 'high';
        this.decoration = 'high';
        this.canvas = canvas;
        this.c = canvas.getContext('2d');
        this.fruitImages = [];
        this.forestCache = null;
        this.fragmentedBackdrop = null;
        this.transitionBackdrop = null;
        this.transitionRasterDisabled = false;
        this.transitionSlowReadbacks = 0;
        // Forced GPU readbacks are opt-in diagnostics: they can stall production frames.
        // ?transitionSync=1 tests the slow/unsupported-readback fallback explicitly.
        this.transitionSyncEnabled = typeof location !== 'undefined' &&
            new URLSearchParams(location.search).get('transitionSync') === '1';
        // The forest WebP is fully opaque; the sky behind an alpha=1 forest is invisible.
        // Keep an A/B override to verify exact parity against the original composition.
        this.opaqueForestSkyEnabled = true;
        this.opaqueForestLightKeyEnabled = true;
        // Pre-scales the 4MP forest texture once per viewport resize with breeze margins
        // so wind drift and 8-stripe transitions blit 1:1 without bilinear rescaling.
        this.scaledForestCacheEnabled = true;
        this.cachedView = null;
        this.ready = Promise.all([loadAssets(),preloadSnakeA2(),preloadActionSheets()]).then(() => {
            this.fruitImages = FRUITS.map(f => images.get(`fruit-${f.id}`));
            // Warm up pickup radial caches during asset load so first spawn never stalls.
            getPickupCache('fruit-glow', 28, [[4, 0, '#ffffffaa'], [4, 0.5, '#f4d87c44'], [4, 1, '#ffffff00']]);
            getPickupCache('pepper-glow', 36, [[4, 0, '#ff5233bb'], [4, 0.6, '#ff803355'], [4, 1, '#ffffff00']]);
            getPickupCache('feather-glow', 42, [[6, 0, '#ffe399dd'], [6, 0.6, '#ffd55e66'], [6, 1, '#ffffff00']]);
            getPickupCache('shield-glow', 42, [[6, 0, '#a8f5d0dd'], [6, 0.6, '#46e49e66'], [6, 1, '#ffffff00']]);
            getPepperSprite();
            const particlesImg = images.get('season-particles');
            if (particlesImg && !particlesImg._rasterized) {
                const pw = particlesImg.naturalWidth || particlesImg.width;
                const ph = particlesImg.naturalHeight || particlesImg.height;
                const off = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(pw, ph) : document.createElement('canvas');
                off.width = pw; off.height = ph;
                off.getContext('2d').drawImage(particlesImg, 0, 0);
                off._rasterized = true;
                images.set('season-particles', off);
            }
            this.seasonalBackdrop=new SeasonalBackdrop();
            this.seasonalBackdrop.prepare(images.get('season-backgrounds'),this.w,this.h,this.dpr,0);
            // Initialize the enlarged predator compositor while assets load,
            // before the start button is enabled, not at its first encounter.
            this.c.save();this.c.translate(-1000,-1000);
            this.hawk({id:1,x:0,y:0,warning:0,phase:'crossing'},0,false);
            this.c.restore();
        });
        this.resize();
    }
    setQuality(level) {
        const next=level==='low'?'low':'high';
        this.quality=next;
        this.setVisualProfile({resolution:next,decoration:next});
    }
    // Auto changes only the pixel budget; the living forest retains its effects.
    // Explicit High/Low presets still set both axes through setQuality().
    setAutomaticQuality(level) {
        const next=level==='low'?'low':'high';
        this.quality=next;
        this.setVisualProfile({resolution:next,decoration:'high'});
    }
    setVisualProfile({resolution=this.resolution,decoration=this.decoration}={}) {
        const nextResolution=resolution==='low'?'low':'high';
        this.decoration=decoration==='low'?'low':'high';
        if(this.resolution===nextResolution)return;
        this.resolution=nextResolution;this.resize();
    }
    getViewport() {
        const s = this.safeInsets;
        const cv = this.cachedView;
        if (cv && cv.w === this.w && cv.h === this.h &&
            cv.top === (s?.top || 0) && cv.right === (s?.right || 0) &&
            cv.bottom === (s?.bottom || 0) && cv.left === (s?.left || 0)) {
            return cv.view;
        }
        const view = flightViewport(this.w, this.h, s);
        this.cachedView = {
            w: this.w, h: this.h,
            top: s?.top || 0, right: s?.right || 0, bottom: s?.bottom || 0, left: s?.left || 0,
            view
        };
        return view;
    }
    resize() {
        const r = this.canvas.getBoundingClientRect();
        this.w = r.width; this.h = r.height;
        this.cachedView = null;
        const size=canvasResolution(this.w,this.h,window.devicePixelRatio,this.resolution);
        this.dpr=size.dpr;
        if(this.canvas.width!==size.width)this.canvas.width=size.width;
        if(this.canvas.height!==size.height)this.canvas.height=size.height;
        if(this.skyCache&&(this.skyCache.width!==size.width||this.skyCache.height!==size.height||this.skyCache.dpr!==this.dpr)){
            this.skyCache.surface.width=0;this.skyCache=null;
        }
        if(this.forestCache&&(this.forestCache.viewW!==size.width||this.forestCache.viewH!==size.height||this.forestCache.dpr!==this.dpr)){
            this.forestCache.surface.width=0;this.forestCache.surface.height=0;
            this.forestCache=null;
        }
        if(this.fragmentedBackdrop&&(this.fragmentedBackdrop.width!==size.width||this.fragmentedBackdrop.height!==size.height||this.fragmentedBackdrop.dpr!==this.dpr)){
            this.fragmentedBackdrop.surface.width=0;this.fragmentedBackdrop.surface.height=0;
            this.fragmentedBackdrop=null;
        }
        if(this.transitionBackdrop&&(this.transitionBackdrop.width!==size.width||this.transitionBackdrop.height!==size.height||this.transitionBackdrop.dpr!==this.dpr)){
            this.transitionBackdrop.surface.width=0;this.transitionBackdrop.surface.height=0;
            this.transitionBackdrop=null;
        }
    }
    // Standalone draws require a clean frame; complete scenes immediately paint an opaque backdrop.
    base(clear = true) {
        this.c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        if (clear) this.c.clearRect(0, 0, this.w, this.h);
    }
    paintSky(c,light){
        const w=this.w,h=this.h;
        const bg = c.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, light); bg.addColorStop(.5, '#abc68d'); bg.addColorStop(1, '#355f45');
        c.fillStyle = bg; c.fillRect(0, 0, w, h);
        // Filtered sunlight through distant crowns.
        const sun = c.createRadialGradient(w * .7, h * .15, 0, w * .7, h * .15, h * .8);
        sun.addColorStop(0, '#fff4c299'); sun.addColorStop(.5, '#fff0b52a'); sun.addColorStop(1, '#fff0b500');
        c.fillStyle = sun; c.fillRect(0, 0, w, h);
    }
    prepareSky(light){
        if(typeof OffscreenCanvas==='undefined'&&typeof document==='undefined')return null;
        const width=this.canvas.width,height=this.canvas.height;
        let cache=this.skyCache;
        if(!cache||cache.light!==light||cache.dpr!==this.dpr||cache.w!==this.w||cache.h!==this.h){
            const surface=cache?.surface??(typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):document.createElement('canvas'));
            surface.width=width;surface.height=height;
            const layer=surface.getContext('2d',{alpha:false});layer.setTransform(this.dpr,0,0,this.dpr,0,0);
            this.paintSky(layer,light);
            cache=this.skyCache={surface,light,width,height,dpr:this.dpr,w:this.w,h:this.h};
        }
        return cache;
    }
    skyLayer(light,cacheAllowed){
        const cache=cacheAllowed?this.prepareSky(light):null;
        if(!cache){this.paintSky(this.c,light);return;}
        // The cache is already at backing resolution: copy without rescaling.
        this.c.save();this.c.setTransform(1,0,0,1,0,0);this.c.drawImage(cache.surface,0,0);this.c.restore();
    }

    // Pre-renders forest.webp at exact scaled backing dimensions (including the 1.08 breeze margin)
    // so subsequent wind shifts perform fast 1:1 blits instead of 4MP bilinear rescaling.
    prepareScaledForest(forest) {
        if(!this.scaledForestCacheEnabled)return null;
        if(typeof OffscreenCanvas==='undefined'&&typeof document==='undefined')return null;
        const viewW=this.canvas.width,viewH=this.canvas.height;
        const scale=Math.max(this.w/forest.naturalWidth,this.h/forest.naturalHeight)*1.08;
        const fw=forest.naturalWidth*scale,fh=forest.naturalHeight*scale;
        const pixelW=Math.max(1,Math.ceil(fw*this.dpr)),pixelH=Math.max(1,Math.ceil(fh*this.dpr));
        // Cap the secondary image, especially when landscape art fills portrait screens.
        if(pixelW*pixelH>6_000_000||pixelW*pixelH>viewW*viewH*1.6)return null;
        let cache=this.forestCache;
        if(!cache||cache.viewW!==viewW||cache.viewH!==viewH||cache.dpr!==this.dpr||cache.forest!==forest||cache.pixelW!==pixelW||cache.pixelH!==pixelH){
            if(cache){cache.surface.width=0;cache.surface.height=0;}
            const surface=typeof OffscreenCanvas!=='undefined'?
                new OffscreenCanvas(pixelW,pixelH):document.createElement('canvas');
            surface.width=pixelW;surface.height=pixelH;
            const c=surface.getContext('2d',{alpha:false});
            if(!c)return null;
            c.setTransform(this.dpr,0,0,this.dpr,0,0);
            c.drawImage(forest,0,0,fw,fh);
            cache=this.forestCache={surface,viewW,viewH,dpr:this.dpr,forest,fw,fh,pixelW,pixelH};
        }
        return cache;
    }

    drawForestSource(c,forest,sourceDrift){
        const scaled=this.prepareScaledForest(forest);
        if(scaled){
            const dx=(this.w-scaled.fw)/2+sourceDrift/this.dpr,dy=(this.h-scaled.fh)/2;
            c.save();
            c.setTransform(1,0,0,1,0,0);
            c.drawImage(scaled.surface,dx*this.dpr,dy*this.dpr);
            c.restore();
            return;
        }
        const scale=Math.max(this.w/forest.naturalWidth,this.h/forest.naturalHeight)*1.08;
        const fw=forest.naturalWidth*scale,fh=forest.naturalHeight*scale;
        c.drawImage(forest,(this.w-fw)/2+sourceDrift/this.dpr,(this.h-fh)/2,fw,fh);
    }

    prepareFragmentedBackdrop(forest,light,drift,forestAlpha=.6) {
        if(typeof OffscreenCanvas==='undefined'&&typeof document==='undefined')return null;
        const width=this.canvas.width,height=this.canvas.height;
        const driftSteps=forestAlpha===1?4:2;
        const sourceDrift=Math.round(drift*this.dpr*driftSteps)/driftSteps;
        let cache=this.fragmentedBackdrop;
        if(!cache||cache.width!==width||cache.height!==height||cache.dpr!==this.dpr||cache.forest!==forest){
            if(cache){cache.surface.width=0;cache.surface.height=0;}
            const surface=typeof OffscreenCanvas!=='undefined'?
                new OffscreenCanvas(width,height):document.createElement('canvas');
            surface.width=width;surface.height=height;
            const c=surface.getContext('2d',{alpha:false});
            if(!c)return null;
            cache=this.fragmentedBackdrop={surface,c,width,height,dpr:this.dpr,light,forest,forestAlpha,sourceDrift:null};
        }
        // The opaque source hides the sky palette entirely. A change to a
        // hidden sky must not invalidate millions of cached pixels. Still
        // invalidate for the visible opacity and for forest drift.
        const skyHidden=forestAlpha===1&&this.opaqueForestSkyEnabled!==false&&
            this.opaqueForestLightKeyEnabled!==false;
        if((!skyHidden&&cache.light!==light)||cache.forestAlpha!==forestAlpha){
            cache.forestAlpha=forestAlpha;cache.sourceDrift=null;
        }
        cache.light=light;
        if(cache.sourceDrift!==sourceDrift){
            const c=cache.c;
            c.setTransform(this.dpr,0,0,this.dpr,0,0);
            c.globalAlpha=1;
            // Source forest.webp has 2,073,600 opaque pixels, and the scaled
            // image covers the entire viewport. The hidden sky is redundant
            // when drawing that source at full opacity.
            if(forestAlpha!==1||this.opaqueForestSkyEnabled===false)
                this.paintSky(c,light);
            c.globalAlpha=forestAlpha;
            this.drawForestSource(c,forest,sourceDrift);
            c.globalAlpha=1;
            cache.sourceDrift=sourceDrift;
        }
        return cache;
    }
    ensureTransitionBackdrop(refuge=false) {
        const width=this.canvas.width,height=this.canvas.height;
        const pixels=width*height;
        if(this.transitionRasterDisabled||pixels<(refuge?1_300_000:1_800_000)||pixels>4_500_000)return null;
        let state=this.transitionBackdrop;
        if(state&&state.width===width&&state.height===height&&state.dpr===this.dpr)return state;
        if(state){state.surface.width=0;state.surface.height=0;}
        const surface=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):
            typeof document!=='undefined'?document.createElement('canvas'):null;
        if(!surface)return null;
        surface.width=width;surface.height=height;
        const c=surface.getContext('2d',{alpha:false});
        if(!c)return null;
        // A smaller backing canvas can publish the Refúgio blend in four
        // passes, keeping the alpha ramp closer to the current frame.
        const stripeCount=pixels<1_800_000?4:8;
        return this.transitionBackdrop={surface,c,width,height,dpr:this.dpr,stripeCount,target:null,rowsDone:0,active:false};
    }
    prepareStagedBackdrop(forest,light,drift,forestAlpha,settled=false,refuge=false) {
        const normal=this.fragmentedBackdrop;
        if(!normal||normal.width!==this.canvas.width||normal.height!==this.canvas.height||
            normal.dpr!==this.dpr||normal.forest!==forest){
            return this.prepareFragmentedBackdrop(forest,light,drift,forestAlpha);
        }
        const pending=this.ensureTransitionBackdrop(refuge);
        if(!pending)return this.prepareFragmentedBackdrop(forest,light,drift,forestAlpha);
        pending.active=true;
        const driftSteps=forestAlpha===1?4:2;
        const sourceDrift=Math.round(drift*this.dpr*driftSteps)/driftSteps;
        if(!pending.target){
            const skyHidden=forestAlpha===1&&this.opaqueForestSkyEnabled!==false&&
                this.opaqueForestLightKeyEnabled!==false;
            if((skyHidden||normal.light===light)&&normal.forestAlpha===forestAlpha&&normal.sourceDrift===sourceDrift){
                normal.light=light;
                if(settled&&forestAlpha===1)pending.active=false;
                return normal;
            }
            pending.target={light,forestAlpha,sourceDrift};
            pending.rowsDone=0;
        }
        const stripe=pending.rowsDone++;
        const y0=Math.floor(pending.height*stripe/pending.stripeCount);
        const y1=Math.floor(pending.height*(stripe+1)/pending.stripeCount);
        const c=pending.c;
        c.save();
        c.setTransform(1,0,0,1,0,0);
        c.beginPath();c.rect(0,y0,pending.width,y1-y0);c.clip();
        c.setTransform(this.dpr,0,0,this.dpr,0,0);
        c.globalAlpha=1;
        if(pending.target.forestAlpha!==1||this.opaqueForestSkyEnabled===false)
            this.paintSky(c,pending.target.light);
        c.globalAlpha=pending.target.forestAlpha;
        this.drawForestSource(c,forest,pending.target.sourceDrift);
        c.restore();
        // Canvas 2D can defer clipped raster passes until the
        // completed buffer is presented. Flushing one pixel after each pass
        // distributes that work across frames without altering output pixels.
        // On GPUs where readback itself is costly or unsupported, abandon
        // incremental staging rather than making repeated slow frames.
        if(this.transitionSyncEnabled){
            let readMs;
            try {
                const start=performance.now();
                c.getImageData(0,y0,1,1);
                readMs=performance.now()-start;
            } catch {
                this.transitionRasterDisabled=true;
            }
            if(readMs!==undefined){
                this.transitionSlowReadbacks=readMs>18?
                    this.transitionSlowReadbacks+1:0;
                if(this.transitionSlowReadbacks>=2)
                    this.transitionRasterDisabled=true;
            }
            if(this.transitionRasterDisabled){
                pending.surface.width=0;
                pending.surface.height=0;
                this.transitionBackdrop=null;
                return this.prepareFragmentedBackdrop(forest,light,drift,forestAlpha);
            }
        }

        if(pending.rowsDone===pending.stripeCount){
            const previousSurface=normal.surface,previousContext=normal.c;
            normal.surface=pending.surface;normal.c=pending.c;
            normal.light=pending.target.light;
            normal.forestAlpha=pending.target.forestAlpha;
            normal.sourceDrift=pending.target.sourceDrift;
            pending.surface=previousSurface;pending.c=previousContext;
            pending.rowsDone=0;pending.target=null;
            if(settled&&forestAlpha===1&&normal.light===light&&normal.forestAlpha===forestAlpha)
                pending.active=false;
        }
        return normal;
    }
    background(time, offset = 0, stage = 0, home = false, reduced = false, stageMix = 1, rain = 0, storm = 0, fog = 0, wind = 0, seasonDistance = null, rainSpeed = 250) {
        if (reduced) offset = 0;
        const c = this.c, w = this.w, h = this.h;
        const palette=BACKGROUND_PALETTE;
        const light = reduced||stageMix===1 ? palette[stage] : mixColor(palette[Math.max(0, stage - 1)], palette[stage], stageMix);
        const seasonal=seasonDistance!==null && images.get('season-backgrounds');
        const forest=seasonal?null:images.get('forest');
        const backdropMix=stageMix===1?1:Math.round(Math.max(0,Math.min(1,stageMix))*64)/64;
        const backdropLight=stageMix===1?light:mixColor(palette[Math.max(0,stage-1)],palette[stage],backdropMix);
        const backdropAlpha=stage===2?1-.4*backdropMix:stage===3?.6+.4*backdropMix:1;
        const cachedBackdrop=!home&&!reduced&&forest?
            (stage>0&&(stageMix<1||this.transitionBackdrop?.active)?
                this.prepareStagedBackdrop(forest,backdropLight,Math.sin(time*.035)*Math.min(24,
                    (forest.naturalWidth*Math.max(w/forest.naturalWidth,h/forest.naturalHeight)*1.08-w)/2),
                    backdropAlpha,stageMix===1,stage===3):
                this.prepareFragmentedBackdrop(forest,backdropLight,Math.sin(time*.035)*Math.min(24,
                    (forest.naturalWidth*Math.max(w/forest.naturalWidth,h/forest.naturalHeight)*1.08-w)/2),
                    backdropAlpha)):null;
        if(cachedBackdrop){
            c.save();c.setTransform(1,0,0,1,0,0);
            c.drawImage(cachedBackdrop.surface,0,0);c.restore();
        }else if(!seasonal)this.skyLayer(light,stage===2&&stageMix===1);
        for (let layer = 0; !images.has('forest') && !seasonal && layer < 3; layer++) {
            const gap = 180 - layer * 25, travel = (offset * (.07 + layer * .06)) % gap;
            c.globalAlpha = .12 + layer * .08;
            for (let i = -1; i < w / gap + 2; i++) {
                const x = i * gap - travel + Math.sin(i * 7 + layer) * 30;
                c.fillStyle = layer === 2 ? '#255841' : '#527f54';
                c.beginPath(); c.moveTo(x - 18 - layer * 5, h); c.quadraticCurveTo(x + 15, h * .5, x - 10, -20); c.lineTo(x + 18, -20); c.quadraticCurveTo(x + 1, h * .6, x + 35 + layer * 8, h); c.fill();
                for (let j = 0; j < 3; j++) oval(c, x + (j - 1) * 65, h * (.08 + layer * .05) + Math.sin(i * 2 + j) * 55, 120, 90, '#426e42');
            }
        }
        c.globalAlpha = 1;
        if (forest&&!cachedBackdrop) {
            const scale=Math.max(w/forest.naturalWidth,h/forest.naturalHeight)*1.08;
            const fw=forest.naturalWidth*scale, fh=forest.naturalHeight*scale;
            const drift=reduced?0:Math.sin(time*.035)*Math.min(24,(fw-w)/2);
            c.save();c.globalAlpha=stage===2?1-.4*stageMix:stage===3?.6+.4*stageMix:1;
            this.drawForestSource(c,forest,drift*this.dpr);
            c.restore();
        }
        if(seasonal){
            this.seasonalBackdrop ??= new SeasonalBackdrop();
            this.seasonalBackdrop.draw(c,seasonal,w,h,this.dpr,time,seasonDistance,reduced);
        }
        if (!images.has('forest') && !seasonal) {
            if(this.decoration!=='low') {
                c.save();c.globalAlpha=.08;c.fillStyle='#e6f0d9';
                for(let i=0;i<3;i++){
                    const drift=reduced?0:Math.sin(time*.12+i*2)*w*.045;
                    c.beginPath();c.ellipse(w*(.18+i*.34)+drift,h*(.48+i*.1),w*.35,h*.035,0,0,TAU);c.fill();
                }
                c.restore();
            }
            // Low-contrast tree layers are behind gameplay, at distinct parallax speeds.
            for(let layer=0;layer<(this.decoration==='low'?1:2);layer++) {
                const spacing=layer?340:240, travel=offset*(layer?.22:.09);
                c.save();c.globalAlpha=layer?.075:.045;
                for(let i=-1;i<=Math.ceil(w/spacing)+1;i++) {
                    const worldIndex=i+Math.floor(travel/spacing);
                    const x=i*spacing-(travel%spacing)+Math.sin(worldIndex*8.2)*20;
                    c.fillStyle=layer?'#244e40':'#b8ce9c';
                    c.beginPath();c.moveTo(x-14,h);c.quadraticCurveTo(x+7,h*.5,x-3,-10);c.lineTo(x+14,-10);c.quadraticCurveTo(x+22,h*.6,x+28,h);c.fill();
                    oval(c,x,h*.08,110+layer*20,70,'#537b4a');
                }
                c.restore();
            }
        }
        const transition=stageMix;
        c.save();c.globalAlpha=.10;c.fillStyle=transition===1?TINT_PALETTE[stage]:mixColor(TINT_PALETTE[Math.max(0,stage-1)],TINT_PALETTE[stage],transition);c.fillRect(0,0,w,h);c.restore();
        // Sunlight and shade breathe slowly with the same wind as leaves and vines.
        c.fillStyle = '#ffffcb10';
        c.save();c.globalAlpha = 1 - rain * .9;
        c.translate(reduced?0:Math.sin(time*.22)*18,0);
        c.beginPath();
        for (let i = 0; i < 3; i++) {
            c.moveTo(w * .65 + i * 95, 0);
            c.lineTo(w * .65 + 45 + i * 95, 0);
            c.lineTo(w * .13 + i * 110, h);
            c.lineTo(w * .13 - 120 + i * 110, h);
        }
        c.fill();
        c.restore();
        if(seasonal)drawSeasonParticles(c,images.get('season-particles'),w,h,time,seasonDistance,reduced,this.decoration==='low',wind);
        drawForestLife(c,w,h,time,seasonDistance??0,rain,wind,reduced,this.decoration==='low',storm);
        drawJourneyFog(c, w, h, fog);
        drawJourneyRain(c, w, h, time, rain, reduced, this.decoration === 'low', storm, wind, rainSpeed);
        drawLightning(c, w, h, time, storm, reduced);
        if (wind > 0 && !reduced) {
            c.save();
            c.globalAlpha = wind * .24;
            c.strokeStyle = '#e2edcb';
            c.beginPath();
            const streaks = this.decoration === 'low' ? 8 : 18;
            for (let i = 0; i < streaks; i++) {
                const x = w + 32 - ((i * 137.7 + time * 250) % (w + 64));
                const y = (i * 93.4) % h;
                c.moveTo(x, y);
                c.quadraticCurveTo(x - 12, y - 4, x - 26, y + 1);
            }
            c.stroke();
            c.restore();
        }
        c.save();c.globalAlpha = 1 - rain;
        c.fillStyle = '#ffedb275';
        c.beginPath();
        const dustCount = this.decoration==='low'?8:23;
        for (let i = 0; i < dustCount; i++) {
            const x = ((i * 137.7 + (reduced ? 0 : Math.sin(time * .19 + i) * 22)) % w + w) % w;
            const y = ((i * 93.4 + (reduced ? 0 : time * 3)) % (h * .9));
            c.moveTo(x + 1.6, y);
            c.arc(x, y, 1.6, 0, TAU);
        }
        c.fill();
        c.restore();
        if (home) {
            const wash = c.createLinearGradient(0, 0, w * .7, 0);
            wash.addColorStop(0, '#f1f2da'); wash.addColorStop(.66, '#f0f1d9ef'); wash.addColorStop(1, '#e7edcb00');
            c.fillStyle = wash; c.fillRect(0, 0, w, h);
        }
    }

    home(time, reduced) {
        this.base(false);
        const c = this.c, mobile = this.w <= 700;
        this.background(time, 0, 0, !mobile, reduced);
        if (mobile) {
            const wash = c.createLinearGradient(0, this.h * .50, 0, this.h * .78); wash.addColorStop(0, '#f0f1da'); wash.addColorStop(1, '#f0f1da00');
            c.fillStyle = '#f0f1da'; c.fillRect(0, 0, this.w, this.h * .5); c.fillStyle = wash; c.fillRect(0, this.h * .5, this.w, this.h * .28);
        }
        const {x,y,scale}=homePerchLayout(this.w,this.h);
        c.save(); c.translate(x, y);
        if(images.has('chaua-atlas'))drawRefugeTree(c,{x:0},scale*5+birdFoot(scale*1.3),time,scale*95,scale*1.3*9.65*27.7027/60);
        drawBird(c, { x: 0, y: scale * 5, scale: scale*1.3, perched: true, wing: reduced ? .08 : .07 + Math.sin(time * .9) * .06, time, reduced });
        c.restore();
        // Loose foreground leaves frame the diorama naturally.
        if (!mobile) {
            leaf(c, this.w * .985, this.h * .38, 75, -1.15, '#b0c16c', '#497e49');
            leaf(c, this.w * .965, this.h * .34, 55, -.5, '#a5b96b', '#47794b');
            leaf(c, this.w * .61, this.h * .76, 45, -.7, '#92af5d', '#436f40');
        }
    }

    game(game, reduced, visualTime = 0) {
        this.base(false);
        if(game.state==='countdown'){
            this.prepareSky(BACKGROUND_PALETTE[2]);
            const forest=images.get('forest');
            if(forest){
                this.prepareScaledForest(forest);
                this.prepareFragmentedBackdrop(forest,BACKGROUND_PALETTE[0],0,1);
                this.ensureTransitionBackdrop();
            }
        }
        const c = this.c;
        const sceneTime = game.sceneTime ?? game.elapsed;
        // One flight-time climate state drives every visible layer. Physics and
        // stage geometry retain their existing world-distance calculations.
        const rain = journeyRain(game, game.tutorial);
        const storm = journeyStorm(game, game.mode, game.tutorial);
        const fog = journeyFog(game, game.tutorial);
        const wind = journeyWind(game, game.mode, game.tutorial);
        const snow = winterAmount(game);
        this.background(sceneTime, game.distance, game.stage, false, reduced, reduced?1:Math.min(1,game.stageAge/4),
            rain, storm, fog, wind, game.tutorial?null:game, game.speed||250);
        const baseView = this.getViewport();
        // Follow the player only on screens that cannot fit the full world at
        // the improved sprite scale. The camera does not touch gameplay math.
        const resetCamera=!Number.isFinite(this.cameraTime)||sceneTime<this.cameraTime;
        this.cameraTop=advanceFlightCamera(baseView,game.y,
            resetCamera?undefined:this.cameraTop,sceneTime-(this.cameraTime??sceneTime),reduced);
        this.cameraTime=sceneTime;
        const view={...baseView,worldTop:this.cameraTop};
        const s = view.scale;
        // Tiny, muted butterflies stay in the distant layer; no pickup glow or collision.
        c.save();c.globalAlpha=.32;
        for(let i=0;i<(this.decoration==='low'?1:3);i++) {
            const t=reduced?0:game.elapsed;
            const bx=view.x+view.w*(.38+i*.2)+Math.sin(t*.3+i)*12;
            const by=view.y+view.h*.11+Math.sin(t*.5+i*2)*7;
            const wing=reduced?3:1.2+Math.abs(Math.sin(t*5+i))*2;
            oval(c,bx-wing,by,wing,2.5,'#687f6a',-.45);
            oval(c,bx+wing,by,wing,2.5,'#687f6a',.45);
        }
        c.restore();
        let shakeX = 0, shakeY = 0;
        if (!reduced && game.shakeTime > 0 && game.shakeDuration > 0) {
            const factor = game.shakeTime / game.shakeDuration;
            const mag = (game.shakeIntensity || 6) * factor;
            shakeX = Math.sin(game.shakeTime * 65) * mag;
            shakeY = Math.cos(game.shakeTime * 80) * mag;
        }
        // Trees continue into the canopy and ground outside the flight corridor.
        // Keep horizontal camera clipping, but do not cut their trunks at the HUD.
        c.save(); c.beginPath(); c.rect(view.x, 0, view.w, this.h); c.clip();
        c.translate(view.x - view.worldLeft * s + shakeX, view.y - view.worldTop * s + shakeY);
        c.scale(s, s);
        for (const e of game.entities) {
            if (e.kind === 'wood' && (this.drawOffscreenEntitiesForTest === true ||
                !Number.isFinite(e.x) || (e.x >= view.worldLeft - 320 &&
                e.x <= view.worldLeft + view.worldWidth + 320))) this.obstacle(e, game, reduced);
        }
        c.restore();
        c.save(); c.beginPath(); c.rect(view.x, view.y, view.w, view.h); c.clip();
        c.translate(view.x - view.worldLeft * s + shakeX, view.y - view.worldTop * s + shakeY); c.scale(s, s);
        c.beginPath(); c.rect(view.worldLeft - 120, view.worldTop - 600, Math.max(WIDTH, view.worldWidth) + 240, view.worldHeight + 1200); c.clip();
        if (game.pepper > 0) {
            c.save();
            const remaining = Math.min(1, game.pepper / 2);
            c.globalAlpha = 0.5 + 0.5 * remaining;
            const turboRadius = (46 + 14 * remaining) * (reduced ? 1 : 1 + Math.sin(game.elapsed * 12) * 0.08);
            const auraSurface = getPickupCache('chaua-pepper-aura', 60, [[8, 0, '#ff523366'], [8, 0.5, '#ff883344'], [8, 1, '#ff330000']]);
            if (auraSurface) c.drawImage(auraSurface, game.x - turboRadius, game.y - turboRadius, turboRadius * 2, turboRadius * 2);
            else {
                const aura = c.createRadialGradient(game.x, game.y, 8, game.x, game.y, turboRadius);
                aura.addColorStop(0, '#ff523366'); aura.addColorStop(0.5, '#ff883344'); aura.addColorStop(1, '#ff330000');
                oval(c, game.x, game.y, turboRadius, turboRadius, aura);
            }
            if (!reduced) {
                for (let i = 1; i <= 8; i++) {
                    const trailX = game.x - i * 14;
                    const trailY = game.y + Math.sin(game.elapsed * 16 - i * 0.8) * 8;
                    const sz = (8 - i) * 1.5;
                    oval(c, trailX, trailY, sz * 1.8, sz * 0.8, `rgba(255, ${Math.floor(80 + i * 18)}, 40, ${0.8 - i * 0.09})`, -0.2);
                }
                c.strokeStyle = '#ffecd166';
                c.lineWidth = 1.8;
                c.beginPath();
                for (let i = 0; i < 4; i++) {
                    const lx = ((game.elapsed * 800 + i * 220) % (view.w + 200)) - 100;
                    const ly = 80 + (i * 135) % (HEIGHT - 160);
                    c.moveTo(lx, ly);
                    c.lineTo(lx - 60 - i * 20, ly);
                }
                c.stroke();
            }
            c.restore();
        }
        if (game.feather > 0) {
            c.save();
            const remaining = Math.min(1, game.feather / 3);
            c.globalAlpha = 0.5 + 0.5 * remaining;
            const radius = (66 + 18 * remaining) * (reduced ? 1 : 1 + Math.sin(game.elapsed * 3) * 0.06);
            const auraSurface = getPickupCache('chaua-feather-aura', 84, [[16, 0, 'rgba(255, 235, 140, 0.45)'], [16, 0.65, 'rgba(255, 205, 60, 0.28)'], [16, 1, 'rgba(255, 216, 80, 0)']]);
            if (auraSurface) c.drawImage(auraSurface, game.x - radius, game.y - radius, radius * 2, radius * 2);
            else {
                const aura = c.createRadialGradient(game.x, game.y, 16, game.x, game.y, radius);
                aura.addColorStop(0, 'rgba(255, 235, 140, 0.45)');
                aura.addColorStop(0.65, 'rgba(255, 205, 60, 0.28)');
                aura.addColorStop(1, 'rgba(255, 216, 80, 0)');
                oval(c, game.x, game.y, radius, radius, aura);
            }
            if (!reduced) {
                for (let i = 1; i < 9; i++) {
                    oval(c, game.x - i * 11, game.y + Math.sin(game.elapsed * 7 - i) * 8, 4 * (1 - i / 10), 4, `rgba(255, 225, 110, ${0.8 - i * 0.08})`);
                }
            }
            c.restore();
        }
        if(game.powerFade>0) {
            c.save();c.globalAlpha=game.powerFade/.5;c.strokeStyle='#ebd586';c.lineWidth=2;
            c.beginPath();c.arc(game.x,game.y,reduced?48:48+(1-game.powerFade/.5)*22,0,TAU);c.stroke();c.restore();
        }
        // Collection trails suggest optional trajectories, never solid obstacles.
        this._routesMap ??= new Map();
        this._routesLists ??= [];
        for (const list of this._routesMap.values()) {
            list.length = 0;
            this._routesLists.push(list);
        }
        this._routesMap.clear();
        for (const e of game.entities) if (e.kind === 'fruit' && e.route !== undefined && !e.collected) {
            let list = this._routesMap.get(e.route);
            if (!list) {
                list = this._routesLists.pop() || [];
                this._routesMap.set(e.route, list);
            }
            list.push(e);
        }
        for (const fruit of this._routesMap.values()) if (fruit.length > 1) {
            fruit.sort((a,b) => a.x - b.x);
            c.save(); c.strokeStyle = fruit[0].optional ? '#f4d77caa' : '#e9f3cf99';
            c.lineWidth = 2; c.setLineDash([4, 8]); c.beginPath(); c.moveTo(fruit[0].x, fruit[0].y);
            for (let i = 1; i < fruit.length; i++) c.lineTo(fruit[i].x, fruit[i].y);
            c.stroke(); c.restore();
        }
        const visibleLeft=view.worldLeft,visibleRight=view.worldLeft+view.worldWidth;
        for (const e of game.entities) {
            const margin=e.kind==='wood'?320:e.kind==='hawk'?180:100;
            const drawSprite=this.drawOffscreenEntitiesForTest===true||
                !Number.isFinite(e.x)||(e.x>=visibleLeft-margin&&e.x<=visibleRight+margin);
            if (e.kind === 'wood') continue;
            if (e.kind === 'hawk') {
                if (e.warning > 0 || (!e.harmless && e.x>game.x+180)) {
                    c.save(); c.strokeStyle = '#684b3caa'; c.lineWidth = 2; c.setLineDash([6, 8]);
                    c.beginPath(); c.moveTo(e.targetX, e.targetY); c.lineTo(e.startX, e.startY); c.stroke(); c.restore();
                }
                if(e.warning<=0&&drawSprite)this.hawk(e, reduced ? 0 : sceneTime, reduced, false, 0, false, snow, rain);
            } else if (!e.collected&&drawSprite) this.pickup(e, game.elapsed, reduced, snow, rain);
        }
        if (game.shield || game.invincible > 0) {
            const r = 68;
            c.save();
            c.globalAlpha = game.shield ? 0.95 : 0.45;
            const aura = c.createRadialGradient(game.x, game.y, 38, game.x, game.y, r + 10);
            aura.addColorStop(0, 'rgba(46, 245, 195, 0.04)');
            aura.addColorStop(0.7, 'rgba(46, 245, 195, 0.28)');
            aura.addColorStop(1, 'rgba(46, 245, 195, 0)');
            c.fillStyle = aura;
            c.beginPath(); c.arc(game.x, game.y, r + 10, 0, TAU); c.fill();
            c.strokeStyle = '#2ef5c3aa'; c.lineWidth = 2;
            c.beginPath(); c.arc(game.x, game.y, r, 0, TAU); c.stroke();
            const shieldImg = images.get('shield');
            if (game.shield) {
                const count = 8;
                const baseAngle = reduced ? 0 : game.elapsed * 1.2;
                for (let i = 0; i < count; i++) {
                    const a = i * TAU / count + baseAngle;
                    const fx = game.x + Math.cos(a) * r;
                    const fy = game.y + Math.sin(a) * r;
                    c.save();
                    c.translate(fx, fy);
                    c.rotate(a + Math.PI / 2);
                    if (shieldImg) {
                        const fw = 30, fh = 30 * shieldImg.naturalHeight / shieldImg.naturalWidth;
                        c.drawImage(shieldImg, -fw / 2, -fh / 2, fw, fh);
                    } else {
                        feather(c, 0, 0, 16, 0, i % 2 ? '#d7edab' : '#8fb969');
                    }
                    c.restore();
                }
            } else {
                c.setLineDash([5, 7]); c.strokeStyle = '#d0e9ff'; c.lineWidth = 2;
                c.beginPath(); c.arc(game.x, game.y, 48, 0, TAU); c.stroke(); c.setLineDash([]);
            }
            c.restore();
        }

        if(game.refuge) {
            const support=320+birdFoot(1.04);
            drawRefugeTree(c,game.refuge,support,reduced?0:sceneTime);
        }
        const isDefeated = (game.state === 'ended' && !game.won) || game.state === 'impact';
        const impactProg = game.state === 'impact' ? Math.max(0, 1 - (game.impactRemaining || 0) / 0.42) : (game.state === 'ended' && !game.won ? 1 : 0);
        const contact=woodContactPosition(game,impactProg,reduced);
        drawBird(c, {
            x: contact.x, y: contact.y, scale: 1.04, perched: game.state === 'ended' && game.won,
            angle: game.angle, wing: reduced ? .2 : game.wing, time: game.state==='ended'&&game.won?visualTime:sceneTime,
            landing: game.arrival&&!game.won?Math.min(1,game.arrival.age/1.6):null,
            reaction: game.collectPulse, flapImpulse: game.flapImpulse || 0, vy: game.vy || 0, reduced,
            shieldHitAge:game.hit&&game.invincible>0?game.hit.age:null,
            defeated: isDefeated, impactProgress: impactProg, turbo: (game.pepper || 0) > 0,
            stamina: game.stamina !== undefined ? game.stamina : 1, won: game.state === 'ended' && game.won,
            snow, rain
        });
        if (!reduced) {
            const pList = this.decoration==='low'?game.particles:game.particles;
            const pLimit = this.decoration==='low'?Math.min(32,pList.length):pList.length;
            for (let i = 0; i < pLimit; i++) {
                const p = pList[i];
                c.globalAlpha=Math.max(0,p.life/(p.maxLife??.7));
                if(p.feather)feather(c,p.x,p.y,7,p.rotation,p.color);
                else if(p.chip) {
                    c.save();
                    c.translate(p.x,p.y);
                    c.rotate(p.rotation);
                    c.fillStyle=p.color;
                    if(p.splinter) {
                        c.beginPath();
                        c.moveTo(-p.size*0.35,0);
                        c.lineTo(0,-p.size*1.6);
                        c.lineTo(p.size*0.35,0);
                        c.lineTo(0,p.size*1.6);
                        c.closePath();
                        c.fill();
                    } else {
                        c.fillRect(-p.size/2,-p.size/4,p.size,p.size/2);
                    }
                    c.restore();
                }
                else if(p.seed) {
                    c.save();
                    c.translate(p.x, p.y);
                    c.rotate(p.rotation);
                    const sw = p.size || 6.5, sh = sw * 1.65;
                    // 1. Sombra suave de relevo 3D
                    c.fillStyle = 'rgba(0,0,0,0.28)';
                    c.beginPath();
                    c.ellipse(1.5, 2.5, sw * 0.9, sh * 0.9, 0, 0, Math.PI * 2);
                    c.fill();

                    // 2. Casca anatômica de argila em gota
                    c.fillStyle = p.color || '#a0582c';
                    c.beginPath();
                    c.moveTo(0, -sh);
                    c.bezierCurveTo(sw * 1.05, -sh * 0.25, sw * 1.05, sh * 0.65, 0, sh);
                    c.bezierCurveTo(-sw * 1.05, sh * 0.65, -sw * 1.05, -sh * 0.25, 0, -sh);
                    c.fill();

                    // 3. Contorno sutil de profundidade
                    c.strokeStyle = 'rgba(40, 20, 8, 0.45)';
                    c.lineWidth = 1.2;
                    c.stroke();

                    // 4. Embrião / núcleo interno com textura de argila
                    c.fillStyle = 'rgba(255, 235, 175, 0.38)';
                    c.beginPath();
                    c.ellipse(-sw * 0.22, -sh * 0.15, sw * 0.42, sh * 0.5, -0.15, 0, Math.PI * 2);
                    c.fill();

                    // 5. Brilho especular de polpa úmida
                    c.fillStyle = 'rgba(255, 255, 255, 0.75)';
                    c.beginPath();
                    c.ellipse(-sw * 0.32, -sh * 0.35, sw * 0.25, sh * 0.28, -0.2, 0, Math.PI * 2);
                    c.fill();

                    // 6. Cicatriz do ápice (hilo)
                    c.fillStyle = 'rgba(45, 20, 10, 0.7)';
                    c.beginPath();
                    c.arc(0, -sh + 1.8, sw * 0.22, 0, Math.PI * 2);
                    c.fill();

                    c.restore();
                }
                else if(p.puff) {
                    const scale = 1 + (1 - p.life / (p.maxLife ?? .28)) * 1.6;
                    oval(c, p.x, p.y, (p.size || 4) * scale, (p.size || 4) * scale * 0.7, p.color);
                }
                else if(p.spark) oval(c,p.x,p.y,p.size||2,p.size||2,p.color);
                else leaf(c,p.x,p.y,8,p.life*5,p.color,p.color);
            }
        }
        c.globalAlpha = 1;
        if(game.popups.length) {
            c.font='800 18px Nunito';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#254a35';
            for(const p of game.popups) {
                c.save();c.globalAlpha=Math.min(1,p.life*3);
                c.strokeText(p.text,p.x,p.y);
                c.fillStyle=p.gold?'#ffe392':'#f1ffd4';c.fillText(p.text,p.x,p.y);c.restore();
            }
        }
        c.restore();
        if(rain>0&&!reduced){
            const rWind=journeyWind(game,game.mode,game.tutorial);
            const rStorm=journeyStorm(game,game.mode,game.tutorial);
            drawForegroundRain(c,this.w,this.h,sceneTime,rain,reduced,this.decoration==='low',rStorm,rWind,game.speed||250);
        }
        // Natural viewport flight boundary
        const notices=[];
        for(const e of game.entities)if(e.kind==='hawk'&&!e.harmless&&e.x>game.x+100){
            const p=warningPosition(view,e.startY);notices.push({...p,w:116,h:38,type:'hawk',entity:e});
        }else if(e.kind==='wood'&&['warning','windup','striking'].includes(e.snake?.phase)){
            notices.push({...snakeWarningPosition(view,e,isSnakeA2Ready()),w:136,h:26,type:'snake',entity:e});
        }
        if(notices.length){
            for(const box of placeWarnings(notices,view)){
                c.save();c.fillStyle='#fff4dbee';c.strokeStyle='#70513d';c.lineWidth=1.2;
                c.beginPath();c.roundRect(box.x,box.y,box.w,box.h,8);c.fill();c.stroke();
                c.fillStyle='#49372c';c.textAlign='center';c.font='800 12px Nunito';
                if(box.type==='snake')c.fillText(box.entity.snake.phase==='striking'?'Bote!':box.entity.snake.phase==='windup'?'Cobra vai atacar':'Cobra à frente',box.x+box.w/2,box.y+18);
                else {const e=box.entity;c.fillText(e.dive?'↙ MERGULHO':'← TRAVESSIA',box.x+box.w/2,box.y+15);c.font='700 11px Nunito';c.fillText(e.warning>0?`Gavião · ${Math.max(1,Math.ceil(e.warning))}s`:'Em aproximação',box.x+box.w/2,box.y+30);}
                c.restore();
            }
        }
        if (game.state === 'ended' && game.won) {
            for (let i = 0; i < (this.decoration==='low'?12:32); i++) {
                const t = reduced ? 0 : visualTime * 25;
                const x = (i * 151.7) % this.w, y = (i * 79 + t) % this.h;
                leaf(c, x, y, 5 + i % 4, i + (reduced ? 0 : visualTime * .3), i % 3 ? '#b8cc6d' : '#f4c967', i % 3 ? '#79a05b' : '#d49c47');
            }
        }
    }

    obstacle(e, game, reduced=false) {
        const c = this.c;
        const time = game.sceneTime ?? game.elapsed;
        const variant = (e.id ?? 0) % 3;
        const x = e.x + 29;
        const wind = reduced ? 0 : journeyWind(game, game.mode, game.tutorial);
        const rain = reduced ? 0 : journeyRain(game, game.tutorial);
        const snow = reduced ? 0 : winterAmount(game);
        for (const side of ['top', 'bottom']) {
            const upper = side === 'top';
            const y = e[side];
            const broken = e.broken && e.brokenSide === side;
            if (broken && (reduced || !e.breakFx)) continue;
            if (e.fragileSide === side) {
                drawTreeVariant(c, x, y, upper, e.fragileKind, broken ? e.breakFx.age : undefined, snow, rain, time);
                continue;
            }
            if (broken) continue;
            const hit = game.hit;
            const lean = treeBend(time, wind, e.id ?? 0, hit?.id === e.id && hit.side === side ? hit.age : null, reduced);
            if (lean) {
                c.save();
                c.transform(1, 0, lean, 1, -lean * y, 0);
            }
            if (e.decorSide === side) drawTreeVariant(c, x, y, upper, e.decorKind, undefined, snow, rain, time);
            else this.trunk(`trunk-${variant}`, null, x, y, upper, time,
                !upper && e.variant === 'branch' ? 3 : variant, snow, rain);
            if (lean) c.restore();
            if(rain>.03&&!reduced)
                drawSurfaceRainImpacts(c,x,upper?y+3:y-3,rain,time,e.id||0,
                    this.decoration==='low',reduced);
            if (!upper && e.snake) this.snake(e, reduced, snow, rain, time);
        }
    }
    trunk(key,preset,x,y,flip,time=0,variant=0,snow=0,rain=0){
        drawLivingTrunk(this.c,{x,y,upper:flip,width:TREE_WIDTH,length:1000,variant,time,snow,rain});
    }
    snake(wood,reduced,snow=0,rain=0,time=0){
        const s=wood.snake,place=snakePlacement(wood),c=this.c;
        c.save();c.translate(place.x,place.y);c.scale(place.facing,1);
        if(!drawSnakeA2(c,s,place.factor,reduced)){
            const wrap=images.get('snake-wrap');
            if(wrap)c.drawImage(wrap,-SNAKE_WRAP.worldWidth/2,-8,SNAKE_WRAP.worldWidth,SNAKE_WRAP.worldHeight);
            // Rejected legacy snake sheet includes a duplicate coil and must
            // never be rendered over the historical snake-wrap. A2 is the
            // only full-body replacement; otherwise draw original art.
            drawContinuousSnake(c,images.get('snake-atlas'),s,place.factor,reduced,wood.id);
        }
        if(s.retreat&&s.dazed&&!reduced)drawOrbitingStars(c,0,-165,65,s.retreatTime||0);
        if(snow>0&&!reduced&&!s.retreat){
            const t=(time||0)+(wood.id||0)*1.3;
            drawAnimalBreath(c,-45,-90,snow,t,3.4,0.46,-1,18,-12);
        }
        if(rain>0&&!reduced){
            // Two tiny wet highlights on existing scales, not a pale new body.
            c.save();c.globalAlpha=Math.min(.27,rain*.22);
            c.strokeStyle='#a9cdd5';c.lineWidth=1.35;c.lineCap='round';
            c.beginPath();c.moveTo(-30,-88);c.quadraticCurveTo(-20,-98,-8,-88);
            c.moveTo(3,-56);c.quadraticCurveTo(14,-53,18,-43);c.stroke();
            c.restore();
        }
        c.restore();
    }
    flightBorders(view) {}
    hawk(entityOrX, yOrTime = 0, timeOrReduced = 0, warning = false, angle = 0, retreat = false, snow = 0, rain = 0) {
        const c = this.c;
        let x, y, time, e = null;
        if (typeof entityOrX === 'object') {
            e = entityOrX;
            x = e.x;
            y = e.y;
            time = typeof yOrTime === 'number' ? yOrTime : 0;
            warning = e.warning > 0;
            retreat = !!e.retreat;
            angle = hawkAngle(e);
        } else {
            x = entityOrX;
            y = yOrTime;
            time = timeOrReduced;
        }

        const reduced=typeof entityOrX==='object'?timeOrReduced===true:time===0;
        if(!images.has('hawk-atlas'))return;
        const entity=e??{x,y,warning:warning?1:0,retreat,dive:false};
        const clip=hawkAnimation(entity,time,reduced),cAngle=retreat?0:angle;
        const action=hawkAction(entity,time,reduced) ?? (reduced&&hawkUsesActionArt(entity)?{sheet:entity.retreat?'hawk-stunned':'hawk-flight',frame:entity.retreat?2:0}:null);
        let dynamicY=0,dynamicAngle=0;
        if(!reduced&&!warning&&!retreat){
            if(entity.dive){
                const span=(entity.startX||1)-(entity.targetX||0);
                const p=span>0?Math.max(0,Math.min(1,((entity.startX||x)-x)/span)):.5;
                dynamicY=Math.sin(p*Math.PI)*7;
                dynamicAngle=(p-.5)*.16;
            }else if(!action){
                dynamicY=Math.sin(time*2.8+(entity.id||0)*1.5)*3.5;
                dynamicAngle=Math.cos(time*2.8+(entity.id||0)*1.5)*.035;
            }
        }
        c.save();c.translate(x,y+dynamicY+(action?.offsetY||0));
        c.rotate(cAngle+dynamicAngle+(action?.angle||0));
        let newHawk=false;
        if(action){
            const draw=(layer,frame)=>drawActionSheet(layer,action.sheet,frame,-HAWK_ART.size/2,-HAWK_ART.size/2,HAWK_ART.size,HAWK_ART.size);
            const activeFrame=action.blend<0.5?action.frame:action.next;
            newHawk=draw(c,activeFrame);
        }
        if(!newHawk)atlasAnimation(c,'hawk',clip,HAWK_ART.legacyScale,180);
        if(retreat&&!reduced)drawOrbitingStars(c,-35,-60,110,time);
        if(snow>0&&!reduced&&!retreat){
            const t=(time||0)+((entity?.id)||0)*0.7;
            drawAnimalBreath(c,-86,14,snow,t,1.5,0.48,1,40,-6);
        }
        if(rain>0&&!reduced&&!retreat){
            c.save();
            c.globalAlpha=Math.min(.50,rain*.44);
            c.fillStyle='#abd5df';
            c.beginPath();
            for(let i=0;i<4;i++){
                const dropCycle=(time*10+i*1.8+((entity?.id)||0)*1.3)%1;
                const shearX=-86+dropCycle*(45+(i%2)*15);
                const shearY=14-Math.sin(dropCycle*Math.PI)*(8+(i%3)*4)+dropCycle*10;
                const sr=Math.max(0.6,(1-dropCycle)*2.0);
                c.moveTo(shearX+sr,shearY);
                c.arc(shearX,shearY,sr,0,TAU);
            }
            c.fill();
            c.restore();
        }
        c.restore();
    }

    pickup(e, time, reduced, snow = 0, rain = 0) {
        const c = this.c, float = reduced ? 0 : Math.sin(time * 2 + e.id) * 3;
        const pulse = reduced ? 1 : 1 + Math.sin(time * 3.2 + e.id) * 0.07;
        c.save(); c.translate(e.x, e.y);
        c.scale(pulse, pulse);
        if (e.kind === 'fruit') {
            const glowSurface = getPickupCache('fruit-glow', 28, [[4, 0, '#ffffffaa'], [4, 0.5, '#f4d87c44'], [4, 1, '#ffffff00']]);
            if (glowSurface) c.drawImage(glowSurface, -28, float - 28, 56, 56);
            else {
                const glow = c.createRadialGradient(0, float, 4, 0, float, 28);
                glow.addColorStop(0, '#ffffffaa'); glow.addColorStop(0.5, '#f4d87c44'); glow.addColorStop(1, '#ffffff00');
                oval(c, 0, float, 28, 28, glow);
            }
            const image = this.fruitImages[e.variety];
            if (image?.complete && image.naturalWidth) {
                const scale = 50 / Math.max(image.naturalWidth, image.naturalHeight);
                c.drawImage(image, -image.naturalWidth * scale / 2, float - image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
            } else clay(c, 0, float, 18, 20, '#edbb66', '#cb7c42');
            if (snow > 0) {
                c.save();
                c.fillStyle = `rgba(245, 250, 255, ${Math.min(1, snow * 1.2)})`;
                c.beginPath();
                c.ellipse(0, float - 21, 14, 5, 0, 0, TAU);
                c.fill();
                c.fillStyle = `rgba(255, 255, 255, ${Math.min(1, snow * 1.2)})`;
                c.beginPath();
                c.ellipse(-2, float - 22, 9, 3, -0.1, 0, TAU);
                c.fill();
                c.restore();
            } else if (rain > 0) {
                c.save();
                c.fillStyle = `rgba(235, 248, 255, ${rain * 0.45})`;
                c.beginPath();
                c.ellipse(6, float - 8, 3.5, 6, 0.4, 0, TAU);
                c.fill();
                c.restore();
            }
            if (!reduced && this.decoration !== 'low') {
                const sa = time * 2.5 + e.id * 1.5;
                drawMiniSparkle(c, Math.cos(sa) * 22, Math.sin(sa) * 16 + float, 3, time * 5);
            }
        } else if (e.kind === 'pepper') {
            const glowSurface = getPickupCache('pepper-glow', 36, [[4, 0, '#ff5233bb'], [4, 0.6, '#ff803355'], [4, 1, '#ffffff00']]);
            if (glowSurface) c.drawImage(glowSurface, -36, -36, 72, 72);
            else {
                const glow = c.createRadialGradient(0, 0, 4, 0, 0, 36);
                glow.addColorStop(0, '#ff5233bb'); glow.addColorStop(0.6, '#ff803355'); glow.addColorStop(1, '#ffffff00');
                oval(c, 0, 0, 36, 36, glow);
            }
            c.save();
            c.translate(0, float);
            c.rotate(reduced ? 0 : Math.sin(time * 3 + e.id) * 0.15);
            const pepSprite = getPepperSprite();
            if (pepSprite) {
                c.drawImage(pepSprite, -24, -28, 48, 56);
            } else {
                c.beginPath();
                c.moveTo(0, -14);
                c.bezierCurveTo(14, -10, 16, 6, 4, 16);
                c.bezierCurveTo(0, 20, -4, 18, -3, 15);
                c.bezierCurveTo(-10, 6, -10, -8, 0, -14);
                const g = c.createRadialGradient(-3, -2, 2, 0, 0, 18);
                g.addColorStop(0, '#ff785e');
                g.addColorStop(0.6, '#e62419');
                g.addColorStop(1, '#940f09');
                c.fillStyle = g;
                c.fill();
                c.beginPath();
                c.ellipse(-3, -2, 3, 7, -0.2, 0, Math.PI * 2);
                c.fillStyle = '#ffb3a6aa';
                c.fill();
                c.beginPath();
                c.moveTo(0, -14);
                c.quadraticCurveTo(4, -20, 8, -22);
                c.strokeStyle = '#5a963b';
                c.lineWidth = 3;
                c.stroke();
                clay(c, 0, -14, 5, 3, '#7ab852', '#3e6c27', 0);
            }
            c.restore();
            c.fillStyle = '#ffe9b6'; c.font = '900 10px Nunito'; c.textAlign = 'center'; c.fillText('TURBO', 0, 32);
        } else {
            const gold = e.kind === 'feather';
            const glowSurface = gold ?
                getPickupCache('feather-glow', 42, [[6, 0, '#ffe399dd'], [6, 0.6, '#ffd55e66'], [6, 1, '#ffffff00']]) :
                getPickupCache('shield-glow', 42, [[6, 0, '#a8f5d0dd'], [6, 0.6, '#46e49e66'], [6, 1, '#ffffff00']]);
            if (glowSurface) c.drawImage(glowSurface, -42, -42, 84, 84);
            else {
                const glow = c.createRadialGradient(0, 0, 6, 0, 0, 42);
                glow.addColorStop(0, gold ? '#ffe399dd' : '#a8f5d0dd');
                glow.addColorStop(0.6, gold ? '#ffd55e66' : '#46e49e66');
                glow.addColorStop(1, '#ffffff00');
                oval(c, 0, 0, 42, 42, glow);
            }
            const image = images.get(e.kind);
            if (image) {
                const targetSize = gold ? 64 : 58;
                const factor = targetSize / Math.max(image.naturalWidth, image.naturalHeight);
                c.drawImage(image, -image.naturalWidth * factor / 2, float - image.naturalHeight * factor / 2, image.naturalWidth * factor, image.naturalHeight * factor);
            }
            if (!reduced && this.decoration !== 'low') {
                const sa = time * 2.8 + e.id * 2;
                drawMiniSparkle(c, Math.cos(sa) * 28, Math.sin(sa) * 20 + float, gold ? 4.5 : 3.5, time * 6);
                drawMiniSparkle(c, Math.cos(sa + Math.PI) * 24, Math.sin(sa + Math.PI) * 18 + float, 3, time * 5 + 1);
            }
            if (gold) {
                c.fillStyle = '#fff4c2'; c.font = '900 12px Nunito'; c.textAlign = 'center';
                c.fillText('×2', 0, 38);
            }
        }
        c.restore();
    }
}
