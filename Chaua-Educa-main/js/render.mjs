import { images, loadAssets, BIRD_ANCHORS, TRUNKS, SPECIAL, flightPose } from './assets.mjs';
import { FRUITS } from './fruits.mjs';
import { WIDTH, HEIGHT } from './engine.mjs';
const TAU = Math.PI * 2;
const mixColor = (a, b, t) => `rgb(${[1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)).join(',')})`;

function oval(c, x, y, rx, ry, color, angle = 0) {
    c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), angle, 0, TAU);
    c.fillStyle = color; c.fill();
}
function clay(c, x, y, rx, ry, light, dark, angle = 0) {
    const g = c.createRadialGradient(x - rx * .3, y - ry * .35, 1, x, y, Math.max(rx, ry) * 1.1);
    g.addColorStop(0, light); g.addColorStop(1, dark);
    oval(c, x, y, rx, ry, g, angle);
}
function leaf(c, x, y, size, rotation, light = '#87b36a', dark = '#3d7349') {
    c.save(); c.translate(x, y); c.rotate(rotation);
    clay(c, 0, 0, size, size * .46, light, dark, -.2);
    c.beginPath(); c.moveTo(-size * .7, 3); c.quadraticCurveTo(0, -2, size * .7, -2);
    c.strokeStyle = '#d9e6a64a'; c.lineWidth = Math.max(1, size * .04); c.stroke();
    c.restore();
}

export function drawBird(c, { x, y, scale = 1, angle = 0, wing = 0, perched = false, time = 0, surprise = false, reduced = false }) {
    const pose=flightPose(wing,reduced), image=images.get(perched?(surprise?'chaua-hero':'perch'):`chaua-${pose}`);
    if (!image) return;
    c.save(); c.translate(x,y); c.rotate(angle);
    const breath=reduced?1:1+Math.sin(time*1.8)*.008;
    const size=(perched?115:125)*scale, factor=size/image.naturalWidth;
    const [ax,ay]=perched?[.5,.52]:BIRD_ANCHORS[pose];
    c.scale(breath,breath);
    c.drawImage(image,-image.naturalWidth*factor*ax,-image.naturalHeight*factor*ay,image.naturalWidth*factor,image.naturalHeight*factor);
    c.restore();
}

// Shared attachment geometry keeps the authored perch joined to the side tree.
export function homePerchLayout(width, height) {
    const mobile=width<=700, scale=mobile?1.65:Math.min(3.6,width/370);
    const x=width*(mobile?.55:.765), y=mobile?height-238:height*.53;
    const size=115*scale*1.3, trunkWidth=Math.min(90,width*.16);
    return {mobile,scale,x,y,size,trunkWidth,trunkX:width-trunkWidth*.65,
        joinX:x+size*.40, joinY:y+scale*5+size*(727/900)*.225,
        rootX:width-trunkWidth*.15};
}

export class Renderer {
    constructor(canvas) { this.canvas = canvas; this.c = canvas.getContext('2d'); this.fruitImages = []; this.ready = loadAssets().then(()=>{this.fruitImages=FRUITS.map(f=>images.get(`fruit-${f.id}`));}); this.resize(); }
    resize() {
        const r = this.canvas.getBoundingClientRect();
        this.w = r.width; this.h = r.height;
        this.dpr = Math.min(2, window.devicePixelRatio || 1);
        this.canvas.width = this.w * this.dpr; this.canvas.height = this.h * this.dpr;
    }
    base() { this.c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.c.clearRect(0, 0, this.w, this.h); }

    background(time, offset = 0, stage = 0, home = false, reduced = false) {
        if (reduced) offset = 0;
        const c = this.c, w = this.w, h = this.h;
        const bg = c.createLinearGradient(0, 0, 0, h);
        const palette = ['#dbe7b5', '#dde0a1', '#e6d8a0', '#e7d2a1'];
        const light = reduced ? palette[stage] : mixColor(palette[Math.max(0, stage - 1)], palette[stage], Math.min(1, Math.max(0, (time - stage * 20) / 4)));
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
            c.drawImage(forest,(w-fw)/2+drift,(h-fh)/2,fw,fh);
            c.fillStyle=['#385e2810','#d6bf6010','#d89e3518','#365e6330'][stage]; c.fillRect(0,0,w,h);
        }
        // Long translucent light shafts, stable during flight.
        c.fillStyle = '#ffffcb10';
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(w * .65 + i * 95, 0); c.lineTo(w * .65 + 45 + i * 95, 0); c.lineTo(w * .13 + i * 110, h); c.lineTo(w * .13 - 120 + i * 110, h); c.fill(); }
        for (let i = 0; i < 23; i++) {
            const x = ((i * 137.7 + (reduced ? 0 : Math.sin(time * .19 + i) * 22)) % w + w) % w;
            const y = ((i * 93.4 + (reduced ? 0 : time * 3)) % (h * .9));
            oval(c, x, y, 1.6, 1.6, '#ffedb275');
        }
        // Foliage is sculpted from rounded, softly lit forms.
        for (let edge = 0; edge < 2; edge++) {
            for (let i = 0; i < Math.ceil(w / 95) + 1; i++) {
                const x = i * 102 - ((offset * .25) % 102), y = edge ? h + 12 : -28;
                const sway = reduced ? 0 : Math.sin(time * .5 + i) * .035;
                leaf(c, x, y, 74 + Math.sin(i * 3.1) * 18, (edge ? -.9 : .8) + Math.sin(i) * .5 + sway, edge ? '#4e8054' : '#729a55', edge ? '#1d513c' : '#335e37');
            }
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
        const {x,y,scale,size,trunkWidth,trunkX,joinX,joinY,rootX}=homePerchLayout(this.w,this.h);
        // A continuous side tree reaches both canvas edges; the branch grows from it.
        this.wood({x:trunkX,y:-20,w:trunkWidth,h:this.h+40},1);
        c.save(); c.lineCap='round';
        c.beginPath(); c.moveTo(joinX-12,joinY);
        c.bezierCurveTo(joinX+size*.12,joinY-8,rootX-20,joinY-30,rootX,joinY-45);
        c.lineWidth=size*.12; c.strokeStyle='#5c4c32'; c.stroke();
        c.lineWidth=size*.085; c.strokeStyle='#85744c'; c.stroke();
        c.lineWidth=size*.025; c.strokeStyle='#a5a15a'; c.stroke();
        c.restore();
        c.save(); c.translate(x, y);
        drawBird(c, { x: 0, y: scale * 5, scale: scale*1.3, perched: true, wing: reduced ? .08 : .07 + Math.sin(time * .9) * .06, time, reduced });
        c.restore();
        // Moss and leaves overlap the cut face in the source art and the new joint.
        leaf(c,joinX+size*.065,joinY-size*.035,size*.075,-.45,'#94a644','#476837');
        leaf(c,rootX-10,joinY-45,22,-1.15,'#a3b557','#4b713c');
        // Loose foreground leaves frame the diorama.
        if (!mobile) {
            leaf(c, this.w * .985, this.h * .41, 90, -1.15, '#b0c16c', '#497e49');
            leaf(c, this.w * .96, this.h * .36, 75, -.5, '#a5b96b', '#47794b');
            leaf(c, this.w * .61, this.h * .76, 45, -.7, '#92af5d', '#436f40');
        }
    }

    game(game, reduced, visualTime = 0) {
        this.base();
        const c = this.c;
        this.background(game.elapsed, game.elapsed * game.speed, game.stage, false, reduced);
        const s = Math.min(this.h / HEIGHT, this.w / WIDTH);
        const worldWidth = WIDTH;
        c.save(); c.translate((this.w - WIDTH*s)/2, (this.h-HEIGHT*s)/2); c.scale(s, s);
        c.beginPath(); c.rect(0,0,WIDTH,HEIGHT); c.clip();
        c.strokeStyle = '#d9edb6'; c.lineWidth = 2; c.strokeRect(0, 1, WIDTH, HEIGHT-2);
        if (game.feather > 0 && !reduced) {
            for (let i = 1; i < 8; i++) oval(c, game.x - i * 9, game.y + Math.sin(game.elapsed * 7 - i) * 7, 3 * (1 - i / 9), 3, `rgba(255,219,112,${.7 - i * .08})`);
        }
        for (const e of game.entities) {
            if (e.kind === 'wood') {
                this.obstacle(e, game);
            } else if (e.kind === 'hawk') {
                if (e.warning > 0) {
                    const wx = worldWidth - 52;
                    c.save(); c.strokeStyle = '#684b3c88'; c.lineWidth = 1.5; c.setLineDash([6, 8]);
                    c.beginPath(); c.moveTo(e.targetX, e.targetY); c.lineTo(e.startX, e.startY); c.stroke(); c.setLineDash([]);
                    c.fillStyle = '#fff0c8'; c.beginPath(); c.roundRect(wx - 40, e.startY - 31, 85, 55, 12); c.fill();
                    this.hawk(wx + 1, e.startY - 2, game.elapsed, true);
                    c.font = '800 8px Nunito'; c.fillStyle = '#684a32'; c.textAlign = 'center'; c.fillText(e.dive ? 'MERGULHO' : 'TRAVESSIA', wx + 1, e.startY + 17); c.restore();
                } else this.hawk(e.x, e.y, reduced ? 0 : game.elapsed, false, e.dive ? -Math.atan2(e.targetY - e.startY, e.startX - e.targetX) : 0);
            } else if (!e.collected) this.pickup(e, game.elapsed, reduced);
        }
        if (game.shield || game.invincible > 0) {
            const r = 42;
            c.save(); c.globalAlpha = game.shield ? .7 : .4;
            const shield = c.createRadialGradient(game.x - 10, game.y - 10, 10, game.x, game.y, r); shield.addColorStop(0, '#e1f8a505'); shield.addColorStop(.9, '#c2ee8670'); shield.addColorStop(1, '#d3f19baa');
            oval(c, game.x, game.y, r, r, shield); c.strokeStyle = '#d5eaa7'; c.lineWidth = 1.5; c.beginPath(); c.arc(game.x, game.y, r, 0, TAU); c.stroke();
            for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + (reduced ? 0 : game.elapsed); leaf(c, game.x + Math.cos(a) * r, game.y + Math.sin(a) * r, 7, a, '#e5f4ac', '#8bad59'); }
            c.restore();
        }
        drawBird(c, { x: game.x, y: game.y, scale: .78, angle: reduced ? 0 : game.angle, wing: reduced ? .2 : game.wing, time: game.elapsed, reduced });
        if (!reduced) for (const p of game.particles) { c.globalAlpha = p.life / .7; leaf(c, p.x, p.y, 3, p.life * 5, p.color, p.color); }
        c.globalAlpha = 1;
        c.restore();
        if (game.state === 'ended' && game.won) {
            for (let i = 0; i < 32; i++) {
                const t = reduced ? 0 : visualTime * 25;
                const x = (i * 151.7) % this.w, y = (i * 79 + t) % this.h;
                leaf(c, x, y, 5 + i % 4, i + (reduced ? 0 : visualTime * .3), i % 3 ? '#b8cc6d' : '#f4c967', i % 3 ? '#79a05b' : '#d49c47');
            }
        }
    }

    obstacle(e, game) {
        const c=this.c, variant=(e.id??0)%3, preset=TRUNKS[variant];
        const topRects=game.woodRects(e).filter(r=>r.y<e.bottom);
        // Clip only at real openings; leaves outside the wooden core remain decorative.
        if(topRects.length) {
            c.save(); c.beginPath();
            for(const r of topRects)c.rect(r.x-22,r.y,r.w+44,r.h);
            c.clip(); this.trunk(`trunk-${variant}`,preset,e.x+29,e.top,true);
            c.restore();
        }
        if(!e.broken || e.brokenSide!=='bottom') {
            const kind=e.snake&&!e.snake.branch&&!e.snake.retreat?'snake':e.variant==='hollow'?'hollow':`trunk-${variant}`;
            this.trunk(kind,SPECIAL[kind]??preset,e.x+29,e.bottom,false);
            if(e.variant==='branch') {
                const image=images.get('branch');
                if(image && !e.snake?.retreat) c.drawImage(image,e.x-70,e.bottom+8,160,160*image.naturalHeight/image.naturalWidth);
                else this.wood({x:e.x-70,y:e.bottom+30,w:78,h:18},variant);
            }
        }
        if(e.variant==='broken'&&(!e.broken||e.brokenSide!=='top'))this.wood({x:e.x+52,y:e.top-35,w:26,h:18},variant);
    }

    trunk(key,preset,x,y,flip) {
        const image=images.get(key),c=this.c;
        if(!image)return;
        const factor=58/preset.coreWidth, h=image.naturalHeight*factor;
        c.save();c.translate(x,y);if(flip)c.scale(1,-1);
        // Extend the base with matching bark if a trunk is shorter than the viewport.
        this.wood({x:-29,y:Math.max(0,h-8),w:58,h:HEIGHT},0);
        c.drawImage(image,-image.naturalWidth*factor*preset.originX,0,image.naturalWidth*factor,h);
        c.restore();
    }

    wood({x,y,w,h},variant=0) {
        const image=images.get(`bark-${variant}`); if(!image||h<=0)return;
        const c=this.c,tileH=image.naturalHeight*w/image.naturalWidth;
        c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
        for(let offset=0;offset<h;offset+=tileH)c.drawImage(image,x,y+offset,w,tileH);
        c.restore();
    }

    hawk(x, y, time, warning, angle = 0) {
        const image=images.get(`hawk-${warning?1:Math.floor(time*6)%2}`);
        if (!image) return;
        const c=this.c, factor=(warning?49:110)/image.naturalWidth;
        c.save(); c.translate(x,y); c.rotate(angle);
        c.drawImage(image,-image.naturalWidth*factor*.43,-image.naturalHeight*factor*.66,image.naturalWidth*factor,image.naturalHeight*factor);
        c.restore();
    }

    pickup(e, time, reduced) {
        const c = this.c, float = reduced ? 0 : Math.sin(time * 2 + e.id) * 2;
        c.save(); c.translate(e.x, e.y);
        if (e.kind === 'fruit') {
            const image = this.fruitImages[e.variety];
            if (image?.complete && image.naturalWidth) {
                const scale = 34 / Math.max(image.naturalWidth,image.naturalHeight);
                c.drawImage(image,-image.naturalWidth*scale/2,float-image.naturalHeight*scale/2,image.naturalWidth*scale,image.naturalHeight*scale);
            } else clay(c, 0, float, 13, 15, '#edbb66', '#cb7c42');
        } else {
            const gold = e.kind === 'feather';
            const glow = c.createRadialGradient(0, 0, 4, 0, 0, 34); glow.addColorStop(0, gold ? '#ffdf9aaa' : '#d0ef91aa'); glow.addColorStop(1, '#ffffff00');
            oval(c, 0, 0, 34, 34, glow);
            const image=images.get(e.kind);
            if(image) { const factor=42/Math.max(image.naturalWidth,image.naturalHeight); c.drawImage(image,-image.naturalWidth*factor/2,float-image.naturalHeight*factor/2,image.naturalWidth*factor,image.naturalHeight*factor); }
            if(gold) { c.fillStyle='#fff2b6'; c.font='900 10px Nunito'; c.textAlign='center'; c.fillText('×2',0,34); }
        }
        c.restore();
    }
}
