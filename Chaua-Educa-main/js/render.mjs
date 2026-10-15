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
    c.save(); c.translate(x, y); c.scale(scale, scale); c.rotate(angle);
    const breath = reduced ? 0 : Math.sin(time * 1.8) * .6;
    // Body and head keep the same anchor and scale throughout every wing pose.
    c.translate(0, breath);
    if (perched) {
        c.lineWidth = 5; c.strokeStyle = '#6d6545'; c.lineCap = 'round';
        for (const sx of [-6, 12]) { c.beginPath(); c.moveTo(sx, 28); c.lineTo(sx - 2, 40); c.moveTo(sx - 9, 42); c.lineTo(sx + 5, 42); c.stroke(); }
    }
    clay(c, -28, 22, 25, 9, '#479b6f', '#1b5e4f', -.55);
    clay(c, -20, 26, 23, 7, '#4a8b8e', '#295b64', -.7);
    // Far wing, main torso, near wing: no sprite swaps or size changes.
    clay(c, -7, -8, 30, 13, '#79b365', '#336d40', -.45 - wing * .7);
    clay(c, -2, 5, 27, 32, '#a6ce60', '#4b8a43', -.15);
    clay(c, 9, 10, 19, 25, '#badb76', '#72a746', .1);
    c.save(); c.translate(-10, 0); c.rotate(perched ? -.14 + wing * .15 : -.3 - wing * 1.4);
    clay(c, -8, 10, 15, 31, '#66a85b', '#347845', -.25);
    for (let i = 0; i < 4; i++) clay(c, -17 + i * 6, 24 - i * 2, 4.8, 13, i % 2 ? '#328680' : '#437f78', '#2d665e', -.25);
    clay(c, -8, 1, 12, 17, '#7eb457', '#508b43', -.25);
    c.restore();
    clay(c, 13, -21, 22, 24, '#a5c95c', '#5c963c', -.2);
    clay(c, 27, -21, 11, 15, '#e6ce69', '#c7ac50', -.2);
    clay(c, 13, -40, 16, 8, '#d6664a', '#a93a36', .08);
    clay(c, 5, -39, 9, 6, '#e08c52', '#c45239', -.3);
    // Gentle natural face, with a blink on the resting pose.
    const blinking = perched && !reduced && time % 5.7 > 5.5;
    clay(c, 26, -26, 6.5, surprise ? 8 : 6.7, '#f8edc3', '#d6d29f');
    if (blinking) { c.beginPath(); c.moveTo(22, -26); c.lineTo(30, -26); c.strokeStyle = '#2d3928'; c.lineWidth = 2; c.stroke(); }
    else { oval(c, 28, -26, surprise ? 3.8 : 3.3, surprise ? 5 : 4.2, '#233729'); oval(c, 29, -28, 1.2, 1.5, '#fffdf1'); }
    const beak = c.createLinearGradient(34, -25, 44, -7); beak.addColorStop(0, '#d2c39b'); beak.addColorStop(1, '#797958');
    c.beginPath(); c.moveTo(33, -24); c.quadraticCurveTo(50, -21, 41, -8); c.quadraticCurveTo(42, -17, 33, -15); c.closePath(); c.fillStyle = beak; c.fill();
    oval(c, 35, -21, 1, 1, '#4a4a35');
    c.restore();
}

export class Renderer {
    constructor(canvas) { this.canvas = canvas; this.c = canvas.getContext('2d'); this.resize(); this.fruitImages = FRUITS.map(f => { const image = new Image(); image.src = `images/fruit-${f.id}.webp`; return image; }); }
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
        const light = reduced ? palette[stage] : mixColor(palette[Math.max(0, stage - 1)], palette[stage], Math.min(1, Math.max(0, (time - stage * 30) / 4)));
        bg.addColorStop(0, light); bg.addColorStop(.5, '#abc68d'); bg.addColorStop(1, '#355f45');
        c.fillStyle = bg; c.fillRect(0, 0, w, h);
        // Filtered sunlight through distant crowns.
        const sun = c.createRadialGradient(w * .7, h * .15, 0, w * .7, h * .15, h * .8);
        sun.addColorStop(0, '#fff4c299'); sun.addColorStop(.5, '#fff0b52a'); sun.addColorStop(1, '#fff0b500');
        c.fillStyle = sun; c.fillRect(0, 0, w, h);
        for (let layer = 0; layer < 3; layer++) {
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
        const x = mobile ? this.w * .55 : this.w * .765;
        const y = mobile ? this.h - 238 : this.h * .53;
        const scale = mobile ? 1.65 : Math.min(3.6, this.w / 370);
        c.save(); c.translate(x, y);
        // An old branch with a light-catching clay ridge.
        c.lineCap = 'round'; c.strokeStyle = '#496440'; c.lineWidth = scale * 19;
        c.beginPath(); c.moveTo(-scale * 74, scale * 62); c.bezierCurveTo(scale * 5, scale * 42, scale * 60, scale * 58, scale * 130, scale * 20); c.stroke();
        c.strokeStyle = '#8a9160'; c.lineWidth = scale * 12; c.stroke();
        c.strokeStyle = '#b0ab75'; c.lineWidth = scale * 3; c.beginPath(); c.moveTo(-scale * 66, scale * 56); c.quadraticCurveTo(scale * 30, scale * 40, scale * 114, scale * 26); c.stroke();
        c.strokeStyle = '#6c7b4e'; c.lineWidth = scale * 7; c.beginPath(); c.moveTo(scale * 56, scale * 47); c.lineTo(scale * 69, scale * 11); c.stroke();
        for (const [lx, ly, r, a] of [[65,9,20,-1.1],[85,17,21,-.3],[-64,55,19,-.3],[-81,64,18,-1.7],[111,32,18,-.7],[126,18,21,-1.2]]) leaf(c, lx * scale, ly * scale, r * scale, a, '#a5bf63', '#4b8047');
        drawBird(c, { x: 0, y: scale * 5, scale, perched: true, wing: reduced ? .08 : .07 + Math.sin(time * .9) * .06, time, reduced });
        c.restore();
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
                for (const rect of game.woodRects(e)) this.wood(rect);
                if (e.snake && (!e.snake.retreat || e.snake.retreatTime < .8)) {
                    c.save();
                    const retreat = e.snake.retreat ? e.snake.retreatTime / .8 : 0;
                    c.globalAlpha = 1 - retreat;
                    this.snake(e.x + retreat * 50, e.snake.y + retreat * (e.snake.y < 320 ? -40 : 40), e.snake.branch, reduced ? 0 : game.elapsed);
                    c.restore();
                }
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

    wood({ x, y, w, h }) {
        if (h <= 0) return;
        const c = this.c;
        c.save();
        const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#655d3e'); g.addColorStop(.3, '#a39765'); g.addColorStop(.65, '#8b8054'); g.addColorStop(1, '#5e5c3c');
        c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h, Math.min(7, h / 3)); c.fill();
        c.strokeStyle = '#c5bb8044'; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 12 + i * 14, y + 7); c.bezierCurveTo(x + 3 + i * 14, y + h * .4, x + 22 + i * 12, y + h * .6, x + 10 + i * 14, y + h - 5); c.stroke(); }
        // End-grain and moss stay within the solid collision shape.
        if (h > 30) { clay(c, x + w / 2, y > 0 ? y + 7 : y + h - 7, w / 2 - 3, 6, '#c8b17a', '#8c8052');
            for (let i = 0; i < 3; i++) leaf(c, x + 10 + i * 16, y > 0 ? y + 12 : y + h - 13, 8, i - .8, '#91a65a', '#5c8144'); }
        c.restore();
    }

    snake(x, y, branch, time) {
        const c = this.c, sx = x + (branch ? -27 : 38);
        c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
        c.strokeStyle = '#48623b'; c.lineWidth = 13;
        c.beginPath(); c.moveTo(x + 10, y - 10); c.bezierCurveTo(x + 65, y - 15, x + 55, y - 28, x + 8, y - 25); c.bezierCurveTo(x - 8, y - 21, x + 3, y - 5, sx, y); c.stroke();
        c.strokeStyle = '#91a858'; c.lineWidth = 7; c.stroke();
        clay(c, sx, y + Math.sin(time * 1.8) * 1.2, 16, 10, '#acb966', '#6a8a49');
        oval(c, sx - 8, y - 3, 2, 2.5, '#2e4230'); oval(c, sx - 8.5, y - 3.5, .7, .7, '#f5ecd1');
        c.restore();
    }

    hawk(x, y, time, warning, angle = 0) {
        const c = this.c, size = warning ? .65 : 1;
        c.save(); c.translate(x, y); c.rotate(angle); c.scale(size, size);
        const a = warning ? .25 : Math.sin(time * 4) * .17;
        clay(c, -14, 0, 37, 10, '#a8987a', '#766952', -.45 + a);
        clay(c, 5, 0, 30, 10, '#c4b59a', '#89785a', .5 - a);
        clay(c, -1, 5, 25, 14, '#c4bba3', '#9c8c6b');
        for (let i = 0; i < 3; i++) { c.strokeStyle = '#776d58'; c.lineWidth = 3; c.beginPath(); c.moveTo(-24 + i * 7, 2); c.lineTo(-35 + i * 9, 12); c.stroke(); }
        clay(c, -19, -4, 11, 12, '#d3c7ab', '#99896d');
        clay(c, -30, -2, 6, 4, '#beb392', '#797b65'); oval(c, -23, -7, 2, 2.3, '#3a3c2c');
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
            oval(c, 0, float, 22, 22, gold ? '#fff0b9' : '#dbedb9');
            c.strokeStyle = gold ? '#cfac54' : '#8eaf63'; c.lineWidth = 1; c.beginPath(); c.arc(0, float, 22, 0, TAU); c.stroke();
            if (gold) {
                leaf(c, 0, float, 15, -.85, '#ffe79b', '#d7a442');
                c.strokeStyle = '#fff6cb'; c.lineWidth = 2; c.beginPath(); c.moveTo(-11, 12 + float); c.lineTo(9, -11 + float); c.stroke();
                c.fillStyle = '#8b6928'; c.font = '900 8px Nunito'; c.textAlign = 'center'; c.fillText('×2', 0, 35);
            } else {
                c.beginPath(); c.moveTo(0, -14 + float); c.lineTo(13, -8 + float); c.quadraticCurveTo(14, 8 + float, 0, 15 + float); c.quadraticCurveTo(-14, 8 + float, -13, -8 + float); c.closePath(); c.fillStyle = '#73994d'; c.fill();
                leaf(c, 0, float, 10, -.9, '#e4f1b0', '#accc7b');
            }
        }
        c.restore();
    }
}
