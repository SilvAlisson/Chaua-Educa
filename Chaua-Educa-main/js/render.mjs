import { canvasResolution } from './quality.mjs';
import { flightViewport, warningPosition } from './viewport.mjs';
import { images, loadAssets, BIRD_ANCHORS, TRUNKS, SPECIAL } from './assets.mjs';
import { birdBlend, hawkBlend, impactPose, borderCells, smoothstep } from './motion.mjs';
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
    oval(c, 0, 0, size, size * .46, dark, -.2);
    oval(c, -size * .15, -size * .1, size * .68, size * .3, light, -.2);
    c.beginPath(); c.moveTo(-size * .7, 3); c.quadraticCurveTo(0, -2, size * .7, -2);
    c.strokeStyle = '#d9e6a64a'; c.lineWidth = Math.max(1, size * .04); c.stroke();
    c.restore();
}

function feather(c,x,y,size,rotation,color) {
    c.save();c.translate(x,y);c.rotate(rotation);
    c.beginPath();c.moveTo(0,-size);c.bezierCurveTo(size*.8,-size*.4,size*.55,size*.5,0,size);
    c.bezierCurveTo(-size*.55,size*.4,-size*.6,-size*.5,0,-size);c.fillStyle=color;c.fill();
    c.strokeStyle='#eff6cbb0';c.lineWidth=1;c.beginPath();c.moveTo(0,size*1.2);c.lineTo(0,-size*.8);c.stroke();
    c.restore();
}

function flightLayer(c,image,factor,ax,ay,bend) {
    const dx=-image.naturalWidth*factor*ax,dy=-image.naturalHeight*factor*ay;
    if(!bend){c.drawImage(image,dx,dy,image.naturalWidth*factor,image.naturalHeight*factor);return;}
    const sy=Math.round(ay*image.naturalHeight)-3,sw=180,sh=125;
    c.save();c.beginPath();c.rect(dx,dy,image.naturalWidth*factor,image.naturalHeight*factor);
    c.rect(dx,dy+sy*factor,sw*factor,sh*factor);c.clip('evenodd');
    c.drawImage(image,dx,dy,image.naturalWidth*factor,image.naturalHeight*factor);c.restore();
    c.save();c.translate(dx+sw*factor,dy+(sy+sh*.5)*factor);c.rotate(bend);
    c.drawImage(image,0,sy,sw,sh,-sw*factor,-sh*.5*factor,sw*factor,sh*factor);c.restore();
}


function drawSpiralEye(c, ex, ey, r, t) {
    c.save();
    c.beginPath();
    c.arc(ex, ey, r, 0, TAU);
    c.fillStyle = '#ffffff';
    c.fill();
    c.lineWidth = 1.6;
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
    c.lineWidth = 2.0;
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
    c.lineWidth = 1.4;
    c.strokeStyle = '#18311a';
    c.stroke();

    c.beginPath();
    c.arc(ex, ey + 3, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
    c.lineWidth = 2.8;
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
    defeated = false, impactProgress = 0, turbo = false, stamina = 1, won = false
}) {
    const {pose,next:nextPose,blend} = birdBlend(defeated?0:wing, reduced);
    const image = images.get(perched ? (surprise ? 'chaua-hero' : 'perch') : `chaua-${pose}`);
    if (!image) return;

    c.save();
    c.translate(x, y);

    let renderAngle = angle;
    if (defeated && !reduced) {
        const impact = impactPose(impactProgress);
        renderAngle += impact.angle;
        c.translate(impact.x, impact.y);
    }
    c.rotate(renderAngle);

    const breath = reduced ? 1 : 1 + Math.sin(time * 1.8) * .008;
    const size = (perched ? 115 : 125) * scale;
    const factor = size / image.naturalWidth;
    const [ax, ay] = perched ? [.5, .52] : BIRD_ANCHORS[pose];
    const pop = reduced ? 1 : 1 + Math.sin(Math.max(0, reaction) / .26 * Math.PI) * .08;
    const spring = !perched && !reduced && !defeated ? Math.sin(Math.max(0, Math.min(1, flapImpulse)) * Math.PI) * .07 : 0;
    const velSquash = !perched && !reduced ? Math.max(-0.08, Math.min(0.12, (vy || 0) / 3000)) : 0;

    const turboStretchX = turbo && !reduced ? 1.10 : 1;
    const turboStretchY = turbo && !reduced ? 0.92 : 1;
    const fatiguePant = !perched && !reduced && stamina < 0.28 ? Math.sin(time * 12) * 0.04 : 0;

    const stretchY = (1 + spring - velSquash + fatiguePant) * turboStretchY;
    const stretchX = (1 - spring * 0.5 + velSquash * 0.5) * turboStretchX;
    c.scale(breath * pop * stretchX, breath * pop * stretchY);

    if (turbo && !perched && !reduced) {
        drawTurboFlames(c, size, time);
    }

    const blendAlpha = perched ? 0 : blend;
    const next = images.get(`chaua-${nextPose}`);
    const bend=perched || reduced ? 0 : Math.sin(time * 3) * .018 - angle * .12;
    if (blendAlpha > 0 && next) {
        const [nx, ny] = BIRD_ANCHORS[nextPose];
        blendSprite(c,layer=>flightLayer(layer,image,factor,ax,ay,bend),
            layer=>flightLayer(layer,next,factor,nx,ny,bend),blendAlpha);
    } else flightLayer(c,image,factor,ax,ay,bend);

    const eyeX = size * 0.198;
    const eyeY = -size * 0.088;
    const eyeRadius = size * 0.075;
    const headX = size * 0.16;
    const headY = -size * 0.17;
    const beakX = size * 0.40;
    const beakY = -size * 0.03;

    if (defeated && !perched) {
        drawSpiralEye(c, eyeX, eyeY, eyeRadius, time);
        if (!reduced) {
            drawOrbitingStars(c, headX, headY, size, time);
        }
    } else if (reaction > 0 && !perched) {
        drawHappyEye(c, eyeX, eyeY, eyeRadius);
        if (!reduced) {
            drawFruitSparkles(c, beakX, beakY, reaction, time);
        }
    } else if (!perched && !reduced && stamina < 0.28) {
        drawSweatDrops(c, headX, headY, size, time);
    }

    if (turbo && !perched && !reduced) {
        drawTurboWindLines(c, size, time);
    }

    if (won && perched && !reduced) {
        drawRefugeHearts(c, 0, -size * 0.2, size, time);
    }

    c.restore();
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
        // Foliage is sculpted from rounded, softly lit forms.
        for (let edge = 0; edge < 2; edge++) {
            for (const {index:i,x} of borderCells(offset*.25,102,0,w)) {
                const y = edge ? h + 12 : -28;
                const sway = reduced ? 0 : Math.sin(time*.8)*.08+Math.sin(time*1.7+i)*.025;
                leaf(c, x, y, 74 + Math.sin(i * 3.1) * 18, (edge ? -.9 : .8) + Math.sin(i) * .5 + sway, edge ? '#4e8054' : '#729a55', edge ? '#1d513c' : '#335e37');
            }
        }
        // Small vines and flowers remain in the decorative border, never the passage.
        c.save();c.strokeStyle='#56754288';c.lineWidth=2;
        for(const {index:i,x} of borderCells(offset*.28,190,0,w)) {
            const sway=reduced?0:Math.sin(time*.8+i)*7;
            c.beginPath();c.moveTo(x,0);c.quadraticCurveTo(x+sway,24,x+10+sway,43);c.stroke();
            leaf(c,x+10+sway,40,7,.9,'#9ab66a','#4a7243');
            if(stage>=1) for(let k=0;k<4;k++)leaf(c,x+40,h-7,12,-1.8+k*.4,stage===3?'#d6a05f':'#b39176','#765c48');
        }
        c.restore();
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
        c.save(); c.beginPath(); c.rect(view.x, view.y, view.w, view.h); c.clip();
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
                if (e.warning > 0) {
                    c.save(); c.strokeStyle = '#684b3caa'; c.lineWidth = 2; c.setLineDash([6, 8]);
                    c.beginPath(); c.moveTo(e.targetX, e.targetY); c.lineTo(e.startX, e.startY); c.stroke(); c.restore();
                } else this.hawk(e, reduced ? 0 : sceneTime, reduced);
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
            const r=game.refuge;
            this.trunk('hollow',SPECIAL.hollow,r.x+90,350,false);
            drawBird(c,{x:r.x+62,y:355,scale:.38,perched:true,reduced});
            drawBird(c,{x:r.x+110,y:360,scale:.36,perched:true,reduced});
            if(game.state==='playing') {
                c.save();c.strokeStyle='#fff3ba';c.lineWidth=3;c.setLineDash([6,6]);
                c.beginPath();c.ellipse(r.x,r.y,48,60,0,0,TAU);c.stroke();c.restore();
            }
        }
        const isDefeated = (game.state === 'ended' && !game.won) || game.state === 'impact';
        const impactProg = game.state === 'impact' ? Math.max(0, 1 - (game.impactRemaining || 0) / 0.42) : (game.state === 'ended' && !game.won ? 1 : 0);
        drawBird(c, {
            x: game.x, y: game.y, scale: .74, perched: game.state === 'ended' && game.won,
            angle: reduced ? 0 : game.angle, wing: reduced ? .2 : game.wing, time: sceneTime,
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
        this.foreground(game.distance,sceneTime,reduced,view.worldLeft,view.w/s);
        c.restore();
        // Warning labels are CSS-pixel sized, independent of world zoom.
        for (const e of game.entities) if(e.kind==='hawk' && e.warning>0) {
            const p=warningPosition(view,e.startY);
            c.save(); c.fillStyle='#fff0c8'; c.strokeStyle='#684b3c'; c.lineWidth=1.5;
            c.beginPath();c.roundRect(p.x,p.y,108,36,9);c.fill();c.stroke();
            c.font='800 12px Nunito';c.textAlign='center';c.fillStyle='#483427';
            c.fillText(e.dive?'MERGULHO':'TRAVESSIA',p.x+58,p.y+15);
            c.beginPath();c.moveTo(p.x+19,p.y+8);c.lineTo(p.x+10,p.y+(e.dive?17:8));
            c.lineTo(p.x+10,p.y+11);c.moveTo(p.x+10,p.y+(e.dive?17:8));c.lineTo(p.x+16,p.y+(e.dive?17:13));c.stroke();
            c.font='700 11px Nunito';c.fillText(`Gavião · ${Math.max(1,Math.ceil(e.warning))}s`,p.x+54,p.y+29);c.restore();
        }
        for(const e of game.entities) if(e.kind==='wood' && e.snake?.phase==='warning') {
            const x=Math.max(view.x+4,Math.min(view.x+view.w-140,view.x+(e.x-view.worldLeft)*s-30));
            const y=Math.min(view.y+view.h-29,view.y+(e.bottom+35)*s);
            c.save();c.fillStyle='#fff0d9';c.strokeStyle='#70513d';c.lineWidth=1;
            c.beginPath();c.roundRect(x,y,136,25,8);c.fill();c.stroke();
            c.font='800 12px Nunito';c.fillStyle='#49372c';c.textAlign='center';
            c.fillText('Cobra no tronco',x+56,y+17);c.restore();
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
        const c=this.c, variant=(e.id??0)%3, preset=TRUNKS[variant];
        const time=reduced?0:(game.sceneTime??game.elapsed);
        c.save();
        if(!reduced && game.hit && game.hit.id===e.id) {
            const t = game.hit.age;
            const decay = Math.max(0, 1 - t / 0.3);
            c.translate(Math.sin(t * 95) * 8 * decay, Math.cos(t * 110) * 3 * decay);
        }
        if(e.breakFx&&!reduced) {
            c.save();c.globalAlpha=Math.max(0,1-e.breakFx.age/.24);c.translate(0,e.breakFx.age*35);
            this.trunk(`trunk-${variant}`,preset,e.x+29,e.breakFx.side==='top'?e.top:e.bottom,e.breakFx.side==='top',0,variant);
            c.restore();
        }
        if (!e.broken || e.brokenSide !== 'top') {
            c.save(); c.beginPath();
            c.rect(e.x - 180, -1000, 360, e.top + 1000);
            // Match the passable hollow to woodRects; never draw solid bark over it.
            if(e.variant==='hollow' && e.top>150)c.roundRect(e.x-2,e.top-110,62,70,8);
            c.clip('evenodd');
            this.trunk(`trunk-${variant}`, preset, e.x + 29, e.top, true, time, variant);
            if(e.variant==='hollow' && e.top>150){
                c.strokeStyle='#70452c';c.lineWidth=4;
                c.beginPath();c.roundRect(e.x-2,e.top-110,62,70,8);c.stroke();
            }
            c.restore();
        }
        if (!e.broken || e.brokenSide !== 'bottom') {
            c.save(); c.beginPath();
            const snakeActive = !!e.snake;
            const clipTop = snakeActive ? e.bottom - 45 : e.bottom;
            c.rect(e.x - 180, clipTop, 360, HEIGHT + 1000);
            c.clip();
            const kind = snakeActive && !e.snake.branch ? 'snake' : e.variant === 'hollow' ? 'hollow' : `trunk-${variant}`;
            const retreatTime = e.snake?.retreat ? (reduced?1:Math.max(.000001,e.snake.retreatTime||0)) : 0;
            this.trunk(kind, SPECIAL[kind] ?? preset, e.x + 29, e.bottom, false, time, variant, retreatTime);
            c.restore();
            if (e.variant === 'branch') {
                const image = images.get('branch');
                const branchSnakeActive = !!e.snake;
                if (image && branchSnakeActive) {
                    this.snakeArt(image, e.x - 70, e.bottom + 8, 160, 160 * image.naturalHeight / image.naturalWidth, 'branch', time, retreatTime);
                } else this.wood({ x: e.x - 70, y: e.bottom + 30, w: 78, h: 18 }, variant);
            }
        }
        if (e.variant === 'broken' && !e.dryBranchBroken && (!e.broken || e.brokenSide !== 'top')) {
            this.wood({ x: e.x + 52, y: e.top - 35, w: 26, h: 18 }, variant);
        }
        c.restore();
    }

    trunk(key, preset, x, y, flip, time = 0, variant = 0, retreatTime = 0) {
        const image = images.get(key), c = this.c;
        if (!image) return;
        const factor = 58 / preset.coreWidth;
        const h = image.naturalHeight * factor;
        const w = image.naturalWidth * factor;
        const originX = preset.originX ?? 0.5;
        const left = -w * originX;
        c.save();
        c.translate(x, y);
        if (flip) c.scale(1, -1);

        // 1. Solid bark column extends continuously 1400 units away from opening (into canopy or roots)
        const trunkW = key === 'hollow' ? w : w * 0.58;
        const trunkLeft = left + (w - trunkW) * 0.5;
        this.wood({ x: trunkLeft, y: h - 4, w: trunkW, h: 1400 }, variant);

        // 2. Draw authored details & cut opening
        if (key === 'snake') {
            this.snakeArt(image, left, 0, w, h, 'snake', time, retreatTime);
        } else if (key === 'hollow') {
            c.drawImage(image, left, 0, w, h);
        } else {
            // Full high-resolution 3D tree trunk with foliage, mushrooms and cut rings
            c.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, left, 0, w, h);
        }

        const wind = time===0?0:Math.sin(time*1.1+variant*1.7)*.045;
        // 3. Canopy foliage (flip=true) or forest floor roots (flip=false) anchoring the trunk to edges
        if (flip) {
            leaf(c, left - 12, 180, 42, -0.65+wind, '#87b36a', '#3d7349');
            leaf(c, left + w + 12, 210, 46, 0.72+wind, '#729a55', '#3d7349');
            leaf(c, left - 16, 320, 52, -0.85+wind, '#5d8c4e', '#2a5233');
            leaf(c, left + w + 16, 360, 56, 0.88+wind, '#7aa660', '#355f45');
        } else {
            leaf(c, left - 14, 200, 38, -1.05+wind, '#4e8054', '#1d513c');
            leaf(c, left + w + 14, 230, 42, 1.10+wind, '#537b4a', '#244e40');
            leaf(c, left - 20, 310, 50, -1.25+wind, '#355f45', '#163828');
            leaf(c, left + w + 20, 340, 54, 1.25+wind, '#355f45', '#163828');
        }

        c.restore();
    }

    wood({ x, y, w, h }, variant = 0) {
        const image = images.get(`bark-${variant}`) || images.get('bark-0');
        if (!image || h <= 0) return;
        const c = this.c;
        const sx = image.naturalWidth * 0.2;
        const sy = image.naturalHeight * 0.1;
        const sw = image.naturalWidth * 0.6;
        const sh = image.naturalHeight * 0.75;
        const tileH = sh * w / sw;
        c.save();
        c.beginPath();
        c.rect(x, y, w, h);
        c.clip();
        for (let offset = 0, index = 0; offset < h; offset += tileH, index++) {
            c.save();
            c.translate(x, y + offset + (index % 2 ? tileH : 0));
            if (index % 2) c.scale(1, -1);
            c.drawImage(image, sx, sy, sw, sh, 0, 0, w, tileH + 1);
            c.restore();
        }
        c.restore();
    }

    snakeArt(image, x, y, w, h, kind, time, retreatTime = 0) {
        const c = this.c, [sx, sy, sw, sh] = kind === 'snake' ? [130, 10, 185, 140] : [77, 0, 86, 56];
        const k = w / image.naturalWidth;
        const dx = x + sx * k, dy = y + sy * k;
        const progress = smoothstep(retreatTime);
        // The bark, branch and coiled body stay opaque; only the head withdraws.
        c.save();
        c.beginPath(); c.rect(x, y, w, h); c.rect(dx, dy, sw * k, sh * k); c.clip('evenodd');
        c.drawImage(image, x, y, w, h); c.restore();
        c.save();
        c.globalAlpha *= 1 - progress;
        c.translate(dx + (kind === 'snake' ? 2 : sw - 2) * k + (kind === 'snake' ? 1 : -1) * progress * 24 * k,
            dy + sh * k * .7 + progress * 12 * k);
        c.rotate(time === 0 ? 0 : Math.sin(time * 1.6) * .025);
        c.drawImage(image, sx, sy, sw, sh, -(kind === 'snake' ? 2 : sw - 2) * k, -sh * k * .7, sw * k, sh * k);

        // Dizzy stars over snake head when atordoada
        if (retreatTime > 0 && retreatTime < 1.0) {
            const hx = -(kind === 'snake' ? 2 : sw - 2) * k + (kind === 'snake' ? sw * 0.7 : sw * 0.3) * k;
            const hy = -sh * k * 0.75;
            for (let i = 0; i < 2; i++) {
                const a = retreatTime * 8 + i * Math.PI;
                const starX = hx + Math.cos(a) * 16 * k;
                const starY = hy + Math.sin(a) * 7 * k;
                drawMiniSparkle(c, starX, starY, 4.5 * k, retreatTime * 5 + i);
            }
        }
        c.restore();
        if (retreatTime === 0 && time > 0 && time % 4.8 > 4.6) {
            const direction = kind === 'snake' ? 1 : -1, mx = kind === 'snake' ? dx + sw * k : dx, my = dy + sh * k * .67;
            c.save(); c.strokeStyle = '#bf6b62'; c.lineWidth = 1; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + direction * 4, my + 1); c.lineTo(mx + direction * 6, my - 1); c.moveTo(mx + direction * 4, my + 1); c.lineTo(mx + direction * 6, my + 3); c.stroke(); c.restore();
        }
    }

    foreground(distance,time,reduced,left=0,width=WIDTH) {
        const c=this.c, travel=reduced?0:distance*.65;
        for(const {index:i,x} of borderCells(travel,180,left,width)) {
            const swayBottom=reduced?0:Math.sin(time*1.2+i*0.9)*0.04+Math.cos(time*0.7+i*1.4)*0.02;
            const swayTop=reduced?0:Math.sin(time*1.0+i*0.8)*0.04+Math.cos(time*0.6+i*1.2)*0.02;
            leaf(c,x-12,HEIGHT+24,38,-0.9+swayBottom,'#5d8c4e','#264e32');
            leaf(c,x+24,HEIGHT+28,44,-0.7+swayBottom*1.2,'#7aa858','#34613b');
            leaf(c,x+60,-28,36,0.75+swayTop,'#8bb25e','#3e6b42');
            leaf(c,x+95,-32,42,0.60+swayTop*1.1,'#68964d','#2c5333');
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
            angle = e.dive ? -Math.atan2(e.targetY - e.startY, e.startX - e.targetX) : 0;
        } else {
            x = entityOrX;
            y = yOrTime;
            time = timeOrReduced;
        }

        const reduced = typeof entityOrX === 'object' ? timeOrReduced === true : time === 0;
        const {pose,next,blend} = hawkBlend(time,{dive:e?.dive,dazed:retreat||e?.dazed,reduced:reduced||warning,id:e?.id||0});
        const image = images.get(`hawk-${pose}`) || images.get('hawk-0');
        const nextImage = images.get(`hawk-${next}`);
        if (!image) return;

        const factor = (warning ? 49 : 115) / image.naturalWidth;
        const w = image.naturalWidth * factor;
        const h = image.naturalHeight * factor;

        // Keep the body on the announced path; wing movement is decorative only.

        // Tumble rotation during defeat vs aerodynamic banking
        let renderAngle = angle;
        if (reduced) {
            renderAngle = 0;
        } else if (retreat || e?.dazed) {
            renderAngle = e?.tumbleAngle !== undefined ? e.tumbleAngle : (time * 14);
        } else if (!warning && time > 0) {
            renderAngle += Math.sin(time * 4.2) * 0.05;
        }

        c.save();
        c.translate(x, y);
        c.rotate(renderAngle);

        if (retreat && !e?.dazed) {
            c.scale(-1, 1);
        }

        // Wingtip air trails during high-speed swoop or dive
        if (!warning && !retreat && (e?.dive || (e?.boost && e.boost > 60))) {
            c.save();
            c.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            c.lineWidth = 2.5;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(w * 0.42, -h * 0.55);
            c.lineTo(w * 0.42 + 45, -h * 0.55 - 12);
            c.stroke();
            c.beginPath();
            c.moveTo(-w * 0.35, -h * 0.15);
            c.lineTo(-w * 0.35 + 40, -h * 0.15 - 8);
            c.stroke();
            c.restore();
        }

        // Draw raptor sprite centered on anchor
        if(blend>0&&nextImage)blendSprite(c,
            layer=>layer.drawImage(image,-w*.43,-h*.66,w,h),
            layer=>layer.drawImage(nextImage,-w*.43,-h*.66,w,h),blend);
        else c.drawImage(image,-w*.43,-h*.66,w,h);

        // Dizzy spinning stars above head when dazed/defeated
        if ((retreat || e?.dazed) && time > 0 && !reduced) {
            const headX = -w * 0.28, headY = -h * 0.42;
            for (let i = 0; i < 3; i++) {
                const a = time * 7.5 + i * (Math.PI * 2 / 3);
                const sx = headX + Math.cos(a) * 22;
                const sy = headY + Math.sin(a) * 9;
                c.save();
                c.translate(sx, sy);
                c.rotate(a + time * 3);
                c.fillStyle = i % 2 ? '#ffe042' : '#fff385';
                c.strokeStyle = '#c99a18';
                c.lineWidth = 1;
                c.beginPath();
                for (let k = 0; k < 5; k++) {
                    const rot = k * Math.PI / 2.5 - Math.PI / 2;
                    c.lineTo(Math.cos(rot) * 6, Math.sin(rot) * 6);
                    const innerRot = rot + Math.PI / 5;
                    c.lineTo(Math.cos(innerRot) * 2.8, Math.sin(innerRot) * 2.8);
                }
                c.closePath();
                c.fill();
                c.stroke();
                c.restore();
            }
        }

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
