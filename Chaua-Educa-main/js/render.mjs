import {drawLivingTrunk,drawLivingBranch,drawRefugeTree} from './tree-art.mjs';
import {TREE_WIDTH} from './forest-geometry.mjs';
import {SPRITES} from './sprite-data.mjs';
import {birdAnimation,hawkAnimation,snakeAnimation,snakePlacement,placeWarnings} from './animation.mjs';
import {hawkAngle} from './collision.mjs';
import { canvasResolution } from './quality.mjs';
import { flightViewport, warningPosition } from './viewport.mjs';
import { images, loadAssets } from './assets.mjs';
import { impactPose, smoothstep } from './motion.mjs';
import { FRUITS } from './fruits.mjs';
import { WIDTH, HEIGHT } from './engine.mjs';
const TAU = Math.PI * 2;
const mixColor = (a, b, t) => `rgb(${[1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)).join(',')})`;

let blendSurface;
function blendSprite(c, first, second, blend) {
    // Add the two weighted sprites on transparency, then composite once onto
    // the forest. Source-over crossfades make opaque bodies look like ghosts.
    if(!blendSurface && typeof OffscreenCanvas!=='undefined')blendSurface=new OffscreenCanvas(512,512);
    if(!blendSurface && typeof document!=='undefined') {
        blendSurface=document.createElement('canvas');blendSurface.width=512;blendSurface.height=512;
    }
    if(!blendSurface){(blend<.5?first:second)(c);return;}
    const layer=blendSurface.getContext('2d');
    layer.setTransform(1,0,0,1,0,0);layer.clearRect(0,0,512,512);
    layer.setTransform(2,0,0,2,256,256);
    layer.globalCompositeOperation='source-over';layer.globalAlpha=1-blend;first(layer);
    layer.globalCompositeOperation='lighter';layer.globalAlpha=blend;second(layer);
    layer.globalAlpha=1;layer.globalCompositeOperation='source-over';
    c.drawImage(blendSurface,-128,-128,256,256);
}

function atlasFrame(c,name,index,factor){
    const data=SPRITES[name],frame=data.frames[index],image=images.get(`${name}-atlas`);
    if(!image)return;
    c.drawImage(image,...frame.rect,-frame.anchor[0]*factor,-frame.anchor[1]*factor,data.cell*factor,data.cell*factor);
}
function atlasAnimation(c,name,clip,factor){
    if(clip.blend>0&&clip.frame!==clip.next)blendSprite(c,layer=>atlasFrame(layer,name,clip.frame,factor),layer=>atlasFrame(layer,name,clip.next,factor),clip.blend);
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
    const points=[];const factor=27.7027*.74/SPRITES.chaua.landmarkWidth;
    for(const i of new Set([clip.frame,clip.next])){
        const f=SPRITES.chaua.frames[i],[x,y,w,h]=f.content;
        for(const [px,py]of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){
            const dx=(px-192)*factor,dy=(py-192)*factor;
            points.push({x:dx*Math.cos(angle)-dy*Math.sin(angle)+pose.x,y:dx*Math.sin(angle)+dy*Math.cos(angle)+pose.y});
        }
    }
    const maxX=Math.max(...points.map(p=>p.x));
    return {x:Math.min(game.x,rect.x-maxX-2),y:game.y};
}
function birdFoot(scale){
    const f=SPRITES.chaua.frames[12];return (f.content[1]+f.content[3]-f.anchor[1])*27.7027*scale/SPRITES.chaua.landmarkWidth;
}
function animatedBird(c,p){
    const {x,y,scale=1,angle=0,time=0,reduced=false,reaction=0,defeated=false,impactProgress=0,turbo=false,stamina=1,perched=false,surprise=false,won=false,landing=null}=p;
    const clip=birdAnimation({wing:p.wing,time,perched:perched&&!surprise,landing,defeated:defeated||surprise,impactProgress:surprise?1:impactProgress,reduced});
    const factor=27.7027*scale/SPRITES.chaua.landmarkWidth,size=125*scale;
    c.save();c.translate(x,y);
    if(defeated&&!reduced){const hit=impactPose(impactProgress);c.translate(hit.x,hit.y);c.rotate(angle+hit.angle);}else c.rotate(angle);
    if(turbo&&!perched&&!reduced)drawTurboFlames(c,size,time);
    if(perched&&!surprise&&!defeated&&landing===null)perchedSprite(c,clip,factor);
    else atlasAnimation(c,'chaua',clip,factor);
    const a=SPRITES.chaua.frames[clip.frame].eye,b=SPRITES.chaua.frames[clip.next].eye;
    const ex=(a[0]+(b[0]-a[0])*clip.blend-192)*factor,ey=(a[1]+(b[1]-a[1])*clip.blend-192)*factor;
    if(defeated||surprise){drawSpiralEye(c,ex,ey,size*.027,reduced?0:time);if(!reduced)drawOrbitingStars(c,ex,ey-size*.35,size,time);}
    else if(reaction>0&&!reduced)drawFruitSparkles(c,size*.44,-size*.08,reaction,time);
    else if(stamina<.28&&!reduced&&!perched)drawSweatDrops(c,ex,ey,size,time);
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
    const shade=c.createLinearGradient(0,-size*.45,0,size*.45);shade.addColorStop(0,light);shade.addColorStop(.52,dark);shade.addColorStop(1,light);c.fillStyle=shade;c.fill();
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

function drawHappyEye(c, ex, ey, r) {
    c.save();
    c.beginPath();
    c.arc(ex, ey, r, 0, TAU);
    c.fillStyle = '#ffffff';
    c.fill();
    c.lineWidth = Math.max(.7,r*.2);
    c.strokeStyle = '#18311a';
    c.stroke();

    c.beginPath();
    c.arc(ex, ey + 3, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
    c.lineWidth = Math.max(.9,r*.3);
    c.strokeStyle = '#152b17';
    c.lineCap = 'round';
    c.stroke();
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

export function drawBird(c, {
    x, y, scale = 1, angle = 0, wing = 0, perched = false, time = 0, surprise = false,
    reduced = false, reaction = 0, flapImpulse = 0, vy = 0,
    defeated = false, impactProgress = 0, turbo = false, stamina = 1, won = false, landing = null
}) {
    if(!images.has('chaua-atlas'))return;
    return animatedBird(c,{x,y,scale,angle,wing,perched,time,surprise,reduced,reaction,flapImpulse,vy,defeated,impactProgress,turbo,stamina,won,landing});
}


// Shared attachment geometry keeps the authored perch positioned harmoniously.
export function homePerchLayout(width, height) {
    const mobile=width<=700, scale=mobile?1.65:Math.min(3.2,Math.max(1.7,width/390));
    const x=width*(mobile?.55:.745), y=mobile?height-238:height*.52;
    const size=115*scale*1.3;
    return {mobile,scale,x,y,size,trunkWidth:0,trunkX:width,joinX:x,joinY:y,rootX:width};
}

export class Renderer {
    constructor(canvas) { this.quality = 'high'; this.canvas = canvas; this.c = canvas.getContext('2d'); this.fruitImages = []; this.ready = loadAssets().then(()=>{this.fruitImages=FRUITS.map(f=>images.get(`fruit-${f.id}`));}); this.resize(); }
    setQuality(level) {
        const next=level==='low'?'low':'high';
        if(this.quality===next)return;
        this.quality=next;this.resize();
    }
    resize() {
        const r = this.canvas.getBoundingClientRect();
        this.w = r.width; this.h = r.height;
        const size=canvasResolution(this.w,this.h,window.devicePixelRatio,this.quality);
        this.dpr=size.dpr;
        if(this.canvas.width!==size.width)this.canvas.width=size.width;
        if(this.canvas.height!==size.height)this.canvas.height=size.height;
    }
    base() { this.c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.c.clearRect(0, 0, this.w, this.h); }

    background(time, offset = 0, stage = 0, home = false, reduced = false, stageMix = 1) {
        if (reduced) offset = 0;
        const c = this.c, w = this.w, h = this.h;
        const bg = c.createLinearGradient(0, 0, 0, h);
        const palette = ['#dbe7b5', '#dde0a1', '#e6d8a0', '#d9e9b7'];
        const light = reduced ? palette[stage] : mixColor(palette[Math.max(0, stage - 1)], palette[stage], stageMix);
        bg.addColorStop(0, light); bg.addColorStop(.5, '#abc68d'); bg.addColorStop(1, '#355f45');
        c.fillStyle = bg; c.fillRect(0, 0, w, h);
        // Filtered sunlight through distant crowns.
        const sun = c.createRadialGradient(w * .7, h * .15, 0, w * .7, h * .15, h * .8);
        sun.addColorStop(0, '#fff4c299'); sun.addColorStop(.5, '#fff0b52a'); sun.addColorStop(1, '#fff0b500');
        c.fillStyle = sun; c.fillRect(0, 0, w, h);
        for (let layer = 0; !images.has('forest') && layer < 3; layer++) {
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
        const forest=images.get('forest');
        if (forest) {
            const scale=Math.max(w/forest.naturalWidth,h/forest.naturalHeight)*1.08;
            const fw=forest.naturalWidth*scale, fh=forest.naturalHeight*scale;
            const drift=reduced?0:Math.sin(time*.035)*Math.min(24,(fw-w)/2);
            c.save();c.globalAlpha=stage===2?1-.4*stageMix:stage===3?.6+.4*stageMix:1;
            c.drawImage(forest,(w-fw)/2+drift,(h-fh)/2,fw,fh);c.restore();

        }
        if(this.quality!=='low') {
            c.save();c.globalAlpha=.08;c.fillStyle='#e6f0d9';
            for(let i=0;i<3;i++){
                const drift=reduced?0:Math.sin(time*.12+i*2)*w*.045;
                c.beginPath();c.ellipse(w*(.18+i*.34)+drift,h*(.48+i*.1),w*.35,h*.035,0,0,TAU);c.fill();
            }
            c.restore();
        }
        // Low-contrast tree layers are behind gameplay, at distinct parallax speeds.
        for(let layer=0;layer<(this.quality==='low'?1:2);layer++) {
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
        const transition=stageMix;
        const tint=['#bdcf8c','#e4c16b','#507b63','#92bf74'];
        c.save();c.globalAlpha=.10;c.fillStyle=mixColor(tint[Math.max(0,stage-1)],tint[stage],transition);c.fillRect(0,0,w,h);c.restore();
        // Sunlight and shade breathe slowly with the same wind as leaves and vines.
        c.fillStyle = '#ffffcb10';
        c.save();c.translate(reduced?0:Math.sin(time*.22)*18,0);
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(w * .65 + i * 95, 0); c.lineTo(w * .65 + 45 + i * 95, 0); c.lineTo(w * .13 + i * 110, h); c.lineTo(w * .13 - 120 + i * 110, h); c.fill(); }
        c.restore();
        for (let i = 0; i < (this.quality==='low'?8:23); i++) {
            const x = ((i * 137.7 + (reduced ? 0 : Math.sin(time * .19 + i) * 22)) % w + w) % w;
            const y = ((i * 93.4 + (reduced ? 0 : time * 3)) % (h * .9));
            oval(c, x, y, 1.6, 1.6, '#ffedb275');
        }
        if (home) {
            const wash = c.createLinearGradient(0, 0, w * .7, 0);
            wash.addColorStop(0, '#f1f2da'); wash.addColorStop(.66, '#f0f1d9ef'); wash.addColorStop(1, '#e7edcb00');
            c.fillStyle = wash; c.fillRect(0, 0, w, h);
        }
    }

    home(time, reduced) {
        this.base();
        const c = this.c, mobile = this.w <= 700;
        this.background(time, 0, 0, !mobile, reduced);
        if (mobile) {
            const wash = c.createLinearGradient(0, this.h * .50, 0, this.h * .78); wash.addColorStop(0, '#f0f1da'); wash.addColorStop(1, '#f0f1da00');
            c.fillStyle = '#f0f1da'; c.fillRect(0, 0, this.w, this.h * .5); c.fillStyle = wash; c.fillRect(0, this.h * .5, this.w, this.h * .28);
        }
        const {x,y,scale}=homePerchLayout(this.w,this.h);
        c.save(); c.translate(x, y);
        if(images.has('chaua-atlas'))this.branch(-scale*60,scale*5+birdFoot(scale*1.3),this.w-x+80,scale*5+birdFoot(scale*1.3)+12,Math.max(12,scale*8));
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
        this.base();
        const c = this.c;
        const sceneTime = game.sceneTime ?? game.elapsed;
        this.background(sceneTime, game.distance, game.stage, false, reduced, reduced?1:Math.min(1,game.stageAge/4));
        const view = flightViewport(this.w, this.h, this.safeInsets);
        const s = view.scale;
        // Tiny, muted butterflies stay in the distant layer; no pickup glow or collision.
        c.save();c.globalAlpha=.32;
        for(let i=0;i<(this.quality==='low'?1:3);i++) {
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
        c.save(); c.beginPath(); c.rect(view.x, 0, view.w, this.h); c.clip();
        c.translate(view.x - view.worldLeft * s + shakeX, view.y + shakeY); c.scale(s, s);
        c.beginPath(); c.rect(view.worldLeft - 120, -600, Math.max(WIDTH, view.worldWidth) + 240, HEIGHT + 1200); c.clip();
        if (game.pepper > 0) {
            c.save();
            const remaining = Math.min(1, game.pepper / 2);
            c.globalAlpha = 0.5 + 0.5 * remaining;
            const turboRadius = (46 + 14 * remaining) * (reduced ? 1 : 1 + Math.sin(game.elapsed * 12) * 0.08);
            const aura = c.createRadialGradient(game.x, game.y, 8, game.x, game.y, turboRadius);
            aura.addColorStop(0, '#ff523366'); aura.addColorStop(0.5, '#ff883344'); aura.addColorStop(1, '#ff330000');
            oval(c, game.x, game.y, turboRadius, turboRadius, aura);
            if (!reduced) {
                for (let i = 1; i <= 8; i++) {
                    const trailX = game.x - i * 14;
                    const trailY = game.y + Math.sin(game.elapsed * 16 - i * 0.8) * 8;
                    const sz = (8 - i) * 1.5;
                    oval(c, trailX, trailY, sz * 1.8, sz * 0.8, `rgba(255, ${Math.floor(80 + i * 18)}, 40, ${0.8 - i * 0.09})`, -0.2);
                }
                c.strokeStyle = '#ffecd166';
                c.lineWidth = 1.8;
                for (let i = 0; i < 4; i++) {
                    const lx = ((game.elapsed * 800 + i * 220) % (view.w + 200)) - 100;
                    const ly = 80 + (i * 135) % (HEIGHT - 160);
                    c.beginPath();
                    c.moveTo(lx, ly);
                    c.lineTo(lx - 60 - i * 20, ly);
                    c.stroke();
                }
            }
            c.restore();
        }
        if (game.feather > 0) {
            c.save();
            const remaining = Math.min(1, game.feather / 3);
            c.globalAlpha = 0.5 + 0.5 * remaining;
            const radius = (66 + 18 * remaining) * (reduced ? 1 : 1 + Math.sin(game.elapsed * 3) * 0.06);
            const aura = c.createRadialGradient(game.x, game.y, 16, game.x, game.y, radius);
            aura.addColorStop(0, 'rgba(255, 235, 140, 0.45)');
            aura.addColorStop(0.65, 'rgba(255, 205, 60, 0.28)');
            aura.addColorStop(1, 'rgba(255, 216, 80, 0)');
            oval(c, game.x, game.y, radius, radius, aura);
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
        const routes=new Map();
        for(const e of game.entities) if(e.kind==='fruit' && e.route!==undefined && !e.collected) {
            if(!routes.has(e.route))routes.set(e.route,[]);
            routes.get(e.route).push(e);
        }
        for(const fruit of routes.values()) if(fruit.length>1) {
            fruit.sort((a,b)=>a.x-b.x);c.save();c.strokeStyle=fruit[0].optional?'#f4d77caa':'#e9f3cf99';
            c.lineWidth=2;c.setLineDash([4,8]);c.beginPath();c.moveTo(fruit[0].x,fruit[0].y);
            for(const f of fruit.slice(1))c.lineTo(f.x,f.y);c.stroke();c.restore();
        }
        for (const e of game.entities) {
            if (e.kind === 'wood') {
                this.obstacle(e, game, reduced);
            } else if (e.kind === 'hawk') {
                if (e.warning > 0 || (!e.harmless && e.x>game.x+180)) {
                    c.save(); c.strokeStyle = '#684b3caa'; c.lineWidth = 2; c.setLineDash([6, 8]);
                    c.beginPath(); c.moveTo(e.targetX, e.targetY); c.lineTo(e.startX, e.startY); c.stroke(); c.restore();
                }
                if(e.warning<=0)this.hawk(e, reduced ? 0 : sceneTime, reduced);
            } else if (!e.collected) this.pickup(e, game.elapsed, reduced);
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
                for (let i = 0; i < count; i++) {
                    const a = i * TAU / count + (reduced ? 0 : game.elapsed * 1.2);
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
            const support=320+birdFoot(.74);
            drawRefugeTree(c,game.refuge,support,reduced?0:sceneTime);
        }
        const isDefeated = (game.state === 'ended' && !game.won) || game.state === 'impact';
        const impactProg = game.state === 'impact' ? Math.max(0, 1 - (game.impactRemaining || 0) / 0.42) : (game.state === 'ended' && !game.won ? 1 : 0);
        const contact=woodContactPosition(game,impactProg,reduced);
        drawBird(c, {
            x: contact.x, y: contact.y, scale: .74, perched: game.state === 'ended' && game.won,
            angle: game.angle, wing: reduced ? .2 : game.wing, time: game.state==='ended'&&game.won?visualTime:sceneTime,
            landing: game.arrival&&!game.won?Math.min(1,game.arrival.age/1.6):null,
            reaction: game.collectPulse, flapImpulse: game.flapImpulse || 0, vy: game.vy || 0, reduced,
            defeated: isDefeated, impactProgress: impactProg, turbo: (game.pepper || 0) > 0,
            stamina: game.stamina !== undefined ? game.stamina : 1, won: game.state === 'ended' && game.won
        });
        if (!reduced) for (const p of (this.quality==='low'?game.particles.slice(0,32):game.particles)) {
            c.globalAlpha=Math.max(0,p.life/(p.maxLife??.7));
            if(p.feather)feather(c,p.x,p.y,7,p.rotation,p.color);
            else if(p.chip) { c.save(); c.translate(p.x,p.y); c.rotate(p.rotation); c.fillStyle=p.color; c.fillRect(-p.size/2,-p.size/4,p.size,p.size/2); c.restore(); }
            else if(p.spark) oval(c,p.x,p.y,2,2,p.color);
            else leaf(c,p.x,p.y,3,p.life*5,p.color,p.color);
        }
        c.globalAlpha = 1;
        for(const p of game.popups) {
            c.save();c.globalAlpha=Math.min(1,p.life*3);c.font='800 18px Nunito';c.textAlign='center';
            c.lineWidth=3;c.strokeStyle='#254a35';c.strokeText(p.text,p.x,p.y);
            c.fillStyle=p.gold?'#ffe392':'#f1ffd4';c.fillText(p.text,p.x,p.y);c.restore();
        }
        c.restore();
        this.flightBorders(view);
        const notices=[];
        for(const e of game.entities)if(e.kind==='hawk'&&!e.harmless&&e.x>game.x+100){
            const p=warningPosition(view,e.startY);notices.push({...p,w:116,h:38,type:'hawk',entity:e});
        }else if(e.kind==='wood'&&e.snake?.phase==='warning'){
            notices.push({x:view.x+(e.x-view.worldLeft)*s-30,y:view.y+(e.bottom+42)*s,w:136,h:26,type:'snake',entity:e});
        }
        for(const box of placeWarnings(notices,view)){
            c.save();c.fillStyle='#fff4dbee';c.strokeStyle='#70513d';c.lineWidth=1.2;
            c.beginPath();c.roundRect(box.x,box.y,box.w,box.h,8);c.fill();c.stroke();
            c.fillStyle='#49372c';c.textAlign='center';c.font='800 12px Nunito';
            if(box.type==='snake')c.fillText(box.entity.snake.branch?'Cobra no galho':'Cobra no tronco',box.x+box.w/2,box.y+18);
            else {const e=box.entity;c.fillText(e.dive?'↙ MERGULHO':'← TRAVESSIA',box.x+box.w/2,box.y+15);c.font='700 11px Nunito';c.fillText(e.warning>0?`Gavião · ${Math.max(1,Math.ceil(e.warning))}s`:'Em aproximação',box.x+box.w/2,box.y+30);}
            c.restore();
        }
        if (game.state === 'ended' && game.won) {
            for (let i = 0; i < (this.quality==='low'?12:32); i++) {
                const t = reduced ? 0 : visualTime * 25;
                const x = (i * 151.7) % this.w, y = (i * 79 + t) % this.h;
                leaf(c, x, y, 5 + i % 4, i + (reduced ? 0 : visualTime * .3), i % 3 ? '#b8cc6d' : '#f4c967', i % 3 ? '#79a05b' : '#d49c47');
            }
        }
    }

    obstacle(e, game, reduced=false) {
        const c=this.c,time=reduced?0:(game.sceneTime??game.elapsed),variant=(e.id??0)%3,cx=e.x+29;
        if(!e.broken||e.brokenSide!=='top')this.trunk(`trunk-${variant}`,null,cx,e.top,true,time,variant);
        if(!e.broken||e.brokenSide!=='bottom'){
            if(e.variant==='branch')drawLivingBranch(c,{rootX:cx+12,rootY:e.bottom+77,tipX:cx-102,tipY:e.bottom+28,thickness:39});
            this.trunk(`trunk-${variant}`,null,cx,e.bottom,false,time,variant);
            if(e.snake)this.snake(e,reduced);
        }
        if(e.variant==='broken'&&!e.dryBranchBroken)drawLivingBranch(c,{rootX:cx+40,rootY:e.top-55,tipX:cx+79,tipY:e.top-30,thickness:15});
    }
    trunk(key,preset,x,y,flip,time=0,variant=0){
        drawLivingTrunk(this.c,{x,y,upper:flip,width:TREE_WIDTH,length:1000,variant,time});
    }
    branch(x1,y1,x2,y2,width=12){
        drawLivingBranch(this.c,{rootX:x2,rootY:y2,tipX:x1,tipY:y1,thickness:width*1.8});
    }
    snake(wood,reduced){
        const s=wood.snake,place=snakePlacement(wood),clip=snakeAnimation(s,reduced),c=this.c;
        c.save();c.translate(place.x,place.y);c.scale(place.facing,1);
        if(s.retreat)c.globalAlpha=Math.max(0,1-smoothstep(((s.retreatTime||0)-.95)/.35));
        atlasAnimation(c,'snake',clip,place.factor);c.restore();
    }
    flightBorders(view){
        const c=this.c;
        for(const [y,label,upper]of [[20,'COPA',true],[615,'CHÃO',false]]){
            const py=view.y+y*view.scale;
            c.save();const shade=c.createLinearGradient(0,py-12,0,py+12);shade.addColorStop(0,upper?'#385d3940':'#385d3900');shade.addColorStop(1,upper?'#385d3900':'#385d3940');c.fillStyle=shade;c.fillRect(view.x,py-12,view.w,24);
            c.strokeStyle='#dce6b5bb';c.lineWidth=1;c.setLineDash([3,6]);c.beginPath();c.moveTo(view.x,py);c.lineTo(view.x+view.w,py);c.stroke();c.setLineDash([]);
            c.font='800 9px Nunito';c.fillStyle='#284c32';c.textAlign='right';c.fillText(label,view.x+view.w-8,py+(upper?12:-5));c.restore();
        }
    }
    hawk(entityOrX, yOrTime = 0, timeOrReduced = 0, warning = false, angle = 0, retreat = false) {
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
        c.save();c.translate(x,y);c.rotate(cAngle);
        atlasAnimation(c,'hawk',clip,.4);
        if(retreat&&!reduced)drawOrbitingStars(c,-24,-35,70,time);
        c.restore();
    }

    pickup(e, time, reduced) {
        const c = this.c, float = reduced ? 0 : Math.sin(time * 2 + e.id) * 2;
        c.save(); c.translate(e.x, e.y);
        if (e.kind === 'fruit') {
            const glow = c.createRadialGradient(0, float, 4, 0, float, 28);
            glow.addColorStop(0, '#ffffffaa'); glow.addColorStop(0.5, '#f4d87c44'); glow.addColorStop(1, '#ffffff00');
            oval(c, 0, float, 28, 28, glow);
            const image = this.fruitImages[e.variety];
            if (image?.complete && image.naturalWidth) {
                const scale = 50 / Math.max(image.naturalWidth, image.naturalHeight);
                c.drawImage(image, -image.naturalWidth * scale / 2, float - image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
            } else clay(c, 0, float, 18, 20, '#edbb66', '#cb7c42');
        } else if (e.kind === 'pepper') {
            const glow = c.createRadialGradient(0, 0, 4, 0, 0, 36);
            glow.addColorStop(0, '#ff5233bb'); glow.addColorStop(0.6, '#ff803355'); glow.addColorStop(1, '#ffffff00');
            oval(c, 0, 0, 36, 36, glow);
            c.save();
            c.translate(0, float);
            c.rotate(reduced ? 0 : Math.sin(time * 3 + e.id) * 0.15);
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
            c.restore();
            c.fillStyle = '#ffe9b6'; c.font = '900 10px Nunito'; c.textAlign = 'center'; c.fillText('TURBO', 0, 32);
        } else {
            const gold = e.kind === 'feather';
            const glow = c.createRadialGradient(0, 0, 6, 0, 0, 42);
            glow.addColorStop(0, gold ? '#ffe399dd' : '#a8f5d0dd');
            glow.addColorStop(0.6, gold ? '#ffd55e66' : '#46e49e66');
            glow.addColorStop(1, '#ffffff00');
            oval(c, 0, 0, 42, 42, glow);
            const image = images.get(e.kind);
            if (image) {
                const targetSize = gold ? 64 : 58;
                const factor = targetSize / Math.max(image.naturalWidth, image.naturalHeight);
                c.drawImage(image, -image.naturalWidth * factor / 2, float - image.naturalHeight * factor / 2, image.naturalWidth * factor, image.naturalHeight * factor);
            }
            if (gold) {
                c.fillStyle = '#fff4c2'; c.font = '900 12px Nunito'; c.textAlign = 'center';
                c.fillText('×2', 0, 38);
            }
        }
        c.restore();
    }
}
