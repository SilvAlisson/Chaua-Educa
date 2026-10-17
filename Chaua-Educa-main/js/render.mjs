import { flightViewport, warningPosition } from './viewport.mjs';
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

export function drawBird(c, { x, y, scale = 1, angle = 0, wing = 0, perched = false, time = 0, surprise = false, reduced = false, reaction = 0 }) {
    const pose=flightPose(wing,reduced), image=images.get(perched?(surprise?'chaua-hero':'perch'):`chaua-${pose}`);
    if (!image) return;
    c.save(); c.translate(x,y); c.rotate(angle);
    const breath=reduced?1:1+Math.sin(time*1.8)*.008;
    const size=(perched?115:125)*scale, factor=size/image.naturalWidth;
    const [ax,ay]=perched?[.5,.52]:BIRD_ANCHORS[pose];
    const pop=reduced?1:1+Math.sin(Math.max(0,reaction)/.26*Math.PI)*.04;
    c.scale(breath*pop,breath*pop);
    const q=Math.max(0,(1-wing)*4), blend=!perched&&!reduced&&wing>0?Math.max(0,(q%1-.72)/.28):0;
    const next=images.get(`chaua-${[0,2,3,1][Math.min(3,Math.floor(q)+1)]}`);
    c.globalAlpha=1-blend;
    flightLayer(c,image,factor,ax,ay,perched||reduced?0:Math.sin(time*3)*.018-angle*.12);
    if(blend>0&&next) {
        const [nx,ny]=BIRD_ANCHORS[[0,2,3,1][Math.min(3,Math.floor(q)+1)]];
        c.globalAlpha=blend;flightLayer(c,next,factor,nx,ny,Math.sin(time*3)*.018-angle*.12);
    }
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
        for(let layer=0;layer<2;layer++) {
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
        for (let i = 0; i < 23; i++) {
            const x = ((i * 137.7 + (reduced ? 0 : Math.sin(time * .19 + i) * 22)) % w + w) % w;
            const y = ((i * 93.4 + (reduced ? 0 : time * 3)) % (h * .9));
            oval(c, x, y, 1.6, 1.6, '#ffedb275');
        }
        // Foliage is sculpted from rounded, softly lit forms.
        for (let edge = 0; edge < 2; edge++) {
            for (let i = 0; i < Math.ceil(w / 95) + 1; i++) {
                const x = i * 102 - ((offset * .25) % 102), y = edge ? h + 12 : -28;
                const sway = reduced ? 0 : Math.sin(time*.8)*.08+Math.sin(time*1.7+i)*.025;
                leaf(c, x, y, 74 + Math.sin(i * 3.1) * 18, (edge ? -.9 : .8) + Math.sin(i) * .5 + sway, edge ? '#4e8054' : '#729a55', edge ? '#1d513c' : '#335e37');
            }
        }
        // Small vines and flowers remain in the decorative border, never the passage.
        c.save();c.strokeStyle='#56754288';c.lineWidth=2;
        for(let i=0;i<Math.min(9,Math.ceil(w/180));i++) {
            const x=i*190-((offset*.28)%190), sway=reduced?0:Math.sin(time*.8)*7;
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
            leaf(c, this.w * 1.015, this.h * .20, 70, -1.15, '#b0c16c', '#497e49');
            leaf(c, this.w * .995, this.h * .17, 55, -.5, '#a5b96b', '#47794b');
            leaf(c, this.w * .61, this.h * .76, 45, -.7, '#92af5d', '#436f40');
        }
    }

    game(game, reduced, visualTime = 0) {
        this.base();
        const c = this.c;
        this.background(game.elapsed, game.distance, game.stage, false, reduced, reduced?1:Math.min(1,game.stageAge/4));
        const view = flightViewport(this.w, this.h, this.safeInsets);
        const s = view.scale;
        // Tiny, muted butterflies stay in the distant layer; no pickup glow or collision.
        c.save();c.globalAlpha=.32;
        for(let i=0;i<3;i++) {
            const t=reduced?0:game.elapsed;
            const bx=view.x+view.w*(.38+i*.2)+Math.sin(t*.3+i)*12;
            const by=view.y+view.h*.11+Math.sin(t*.5+i*2)*7;
            const wing=reduced?3:1.2+Math.abs(Math.sin(t*5+i))*2;
            oval(c,bx-wing,by,wing,2.5,'#687f6a',-.45);
            oval(c,bx+wing,by,wing,2.5,'#687f6a',.45);
        }
        c.restore();
        c.save(); c.beginPath(); c.rect(view.x,view.y,view.w,view.h); c.clip();
        c.translate(view.x-view.worldLeft*s,view.y); c.scale(s, s);
        c.beginPath(); c.rect(0,0,WIDTH,HEIGHT); c.clip();
        c.strokeStyle = '#d9edb6'; c.lineWidth = 2; c.strokeRect(0, 1, WIDTH, HEIGHT-2);
        if (game.feather > 0) {
            c.save();
            const remaining=Math.min(1,game.feather/3);
            c.globalAlpha=.4+.6*remaining;
            const radius=(43+15*remaining)*(reduced?1:1+Math.sin(game.elapsed*3)*.06);
            const aura=c.createRadialGradient(game.x,game.y,10,game.x,game.y,radius);
            aura.addColorStop(0,'#ffe29455');aura.addColorStop(.65,'#ffcd4538');aura.addColorStop(1,'#ffd85a00');
            oval(c,game.x,game.y,radius,radius,aura);
            if(!reduced) for(let i=1;i<8;i++)oval(c,game.x-i*9,game.y+Math.sin(game.elapsed*7-i)*7,3*(1-i/9),3,`rgba(255,219,112,${.7-i*.08})`);
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
                } else this.hawk(e.x, e.y, reduced ? 0 : game.elapsed, false, e.retreat ? Math.atan2(e.retreatY || -180,150) : e.dive ? -Math.atan2(e.targetY - e.startY, e.startX - e.targetX) : 0, !!e.retreat);
            } else if (!e.collected) this.pickup(e, game.elapsed, reduced);
        }
        if (game.shield || game.invincible > 0) {
            const r=43;
            c.save();c.globalAlpha=game.shield ? .95 : .45;
            c.strokeStyle='#d8ecae55';c.lineWidth=1;c.beginPath();c.arc(game.x,game.y,r,0,TAU);c.stroke();
            if(game.shield) for(let i=0;i<9;i++) {
                const a=i*TAU/9+(reduced?0:game.elapsed*.8);
                feather(c,game.x+Math.cos(a)*r,game.y+Math.sin(a)*r,10,a+Math.PI/2,i%2?'#d7edab':'#8fb969');
            } else {
                c.setLineDash([5,7]);c.strokeStyle='#d0e9ff';c.lineWidth=2;c.beginPath();c.arc(game.x,game.y,39,0,TAU);c.stroke();c.setLineDash([]);
            }
            c.restore();
        }

        if(game.refuge) {
            const r=game.refuge;
            this.trunk('hollow',SPECIAL.hollow,r.x+90,350,false);
            this.wood({x:r.x-30,y:352,w:140,h:16},1);
            drawBird(c,{x:r.x+50,y:332,scale:.40,perched:true,reduced});
            drawBird(c,{x:r.x+85,y:330,scale:.36,perched:true,reduced});
            if(game.state==='playing') {
                c.save();c.strokeStyle='#fff3ba';c.lineWidth=3;c.setLineDash([6,6]);
                c.beginPath();c.ellipse(r.x,r.y,48,60,0,0,TAU);c.stroke();c.restore();
            }
        }
        drawBird(c, { x: game.x, y: game.y, scale: .78, perched:game.state==='ended'&&game.won, angle: reduced ? 0 : game.angle, wing: reduced ? .2 : game.wing, time: game.elapsed, reaction:game.collectPulse, reduced });
        if (!reduced) for (const p of game.particles) {
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
        this.foreground(game.distance,game.elapsed,reduced);
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
            c.fillText(e.snake.branch?'Cobra no galho':'Cobra no tronco',x+68,y+17);c.restore();
        }
        if (game.state === 'ended' && game.won) {
            for (let i = 0; i < 32; i++) {
                const t = reduced ? 0 : visualTime * 25;
                const x = (i * 151.7) % this.w, y = (i * 79 + t) % this.h;
                leaf(c, x, y, 5 + i % 4, i + (reduced ? 0 : visualTime * .3), i % 3 ? '#b8cc6d' : '#f4c967', i % 3 ? '#79a05b' : '#d49c47');
            }
        }
    }

    obstacle(e, game, reduced=false) {
        const c=this.c, variant=(e.id??0)%3, preset=TRUNKS[variant];
        c.save();
        if(!reduced && game.hit && game.hit.id===e.id) {
            const t=game.hit.age;c.translate(Math.sin(t*95)*6*Math.max(0,1-t/.3),0);
        }
        if(e.breakFx&&!reduced) {
            c.save();c.globalAlpha=Math.max(0,1-e.breakFx.age/.24);c.translate(0,e.breakFx.age*35);
            this.trunk(`trunk-${variant}`,preset,e.x+29,e.breakFx.side==='top'?e.top:e.bottom,e.breakFx.side==='top');
            c.restore();
        }
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
            this.trunk(kind,SPECIAL[kind]??preset,e.x+29,e.bottom,false,reduced?0:game.elapsed);
            if(e.variant==='branch') {
                const image=images.get('branch');
                if(image && !e.snake?.retreat) this.snakeArt(image,e.x-70,e.bottom+8,160,160*image.naturalHeight/image.naturalWidth,'branch',reduced?0:game.elapsed);
                else this.wood({x:e.x-70,y:e.bottom+30,w:78,h:18},variant);
            }
        }
        if(e.variant==='broken'&&!e.dryBranchBroken&&(!e.broken||e.brokenSide!=='top'))this.wood({x:e.x+52,y:e.top-35,w:26,h:18},variant);
        c.restore();
    }

    trunk(key,preset,x,y,flip,time=0) {
        const image=images.get(key),c=this.c;
        if(!image)return;
        const factor=58/preset.coreWidth, h=image.naturalHeight*factor;
        c.save();c.translate(x,y);if(flip)c.scale(1,-1);
        // Extend the base with matching bark if a trunk is shorter than the viewport.
        this.wood({x:-29,y:Math.max(0,h-8),w:58,h:HEIGHT},0);
        if(key==='snake')this.snakeArt(image,-image.naturalWidth*factor*preset.originX,0,image.naturalWidth*factor,h,'snake',time);
        else c.drawImage(image,-image.naturalWidth*factor*preset.originX,0,image.naturalWidth*factor,h);
        c.restore();
    }

    wood({x,y,w,h},variant=0) {
        const image=images.get(`bark-${variant}`); if(!image||h<=0)return;
        const c=this.c, sx=image.naturalWidth*.34, sy=image.naturalHeight*.12, sw=image.naturalWidth*.32, sh=image.naturalHeight*.6, tileH=sh*w/sw;
        c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
        for(let offset=0,index=0;offset<h;offset+=tileH,index++) {
            c.save();c.translate(x,y+offset+(index%2?tileH:0));
            if(index%2)c.scale(1,-1);
            c.drawImage(image,sx,sy,sw,sh,0,0,w,tileH);c.restore();
        }
        c.restore();
    }

    snakeArt(image,x,y,w,h,kind,time) {
        const c=this.c, [sx,sy,sw,sh]=kind==='snake'?[165,90,86,68]:[77,0,86,56];
        const k=w/image.naturalWidth,dx=x+sx*k,dy=y+sy*k;
        // Move only the head region; the trunk, coils and collision remain stationary.
        c.save();c.beginPath();c.rect(x,y,w,h);c.rect(dx,dy,sw*k,sh*k);c.clip('evenodd');c.drawImage(image,x,y,w,h);c.restore();
        c.save();c.translate(dx+(kind==='snake'?2:sw-2)*k,dy+sh*k*.7);
        c.rotate(time===0?0:Math.sin(time*1.6)*.035);
        c.drawImage(image,sx,sy,sw,sh,-(kind==='snake'?2:sw-2)*k,-sh*k*.7,sw*k,sh*k);
        c.restore();
        if(time>0&&time%4.8>4.6) {
            const direction=kind==='snake'?1:-1,mx=kind==='snake'?dx+sw*k:dx,my=dy+sh*k*.67;
            c.save();c.strokeStyle='#bf6b62';c.lineWidth=1;c.beginPath();c.moveTo(mx,my);c.lineTo(mx+direction*4,my+1);c.lineTo(mx+direction*6,my-1);c.moveTo(mx+direction*4,my+1);c.lineTo(mx+direction*6,my+3);c.stroke();c.restore();
        }
    }

    foreground(distance,time,reduced) {
        const c=this.c, travel=reduced?0:distance*.65;
        for(let i=0;i<7;i++) {
            const x=i*180-(travel%180),sway=reduced?0:Math.sin(time*.8)*.09;
            // Only the outer 12 px: no vegetation crosses the navigable corridor.
            leaf(c,x,HEIGHT+23,31,-.8+sway,'#779a58','#315638');
            leaf(c,x+70,-26,32,.7+sway,'#8aa65b','#416542');
        }
    }

    hawk(x, y, time, warning, angle = 0, retreat = false) {
        const image=images.get(`hawk-${warning||time%5>2.4?1:Math.floor(time*6)%2}`);
        if (!image) return;
        const c=this.c, factor=(warning?49:110)/image.naturalWidth;
        c.save(); c.translate(x,y); c.rotate(angle); if(retreat)c.scale(-1,1);
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
