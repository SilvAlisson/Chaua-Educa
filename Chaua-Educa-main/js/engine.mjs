import { FRUITS } from './fruits.mjs';
import { QUESTIONS } from './questions.mjs';

export const WIDTH = 960;
export const HEIGHT = 640;
export const STEP = 1 / 120;
export const FEATHER_SECONDS = 10;
export const VICTORY_SCORE = 200;
export const FLIGHT = Object.freeze({
    gravity: 900, fallLimit: 360, tapLift: 300,
    holdLift: 230, staminaLift: 50, flapInterval: .22,
    aventura: {speed: 245, gap: 185, minGap: 155},
    tranquilo: {speed: 205, gap: 220, minGap: 190},
});
export const STAGES = ['Primeiras asas', 'Entre raízes', 'Céu compartilhado', 'Coração da mata'];
export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class FlightClock {
    constructor(game) { this.game = game; this.accumulator = 0; }
    reset() { this.accumulator = 0; }
    advance(seconds) {
        if (!['playing', 'countdown', 'impact'].includes(this.game.state)) return this.reset();
        this.accumulator += Math.min(.25, Math.max(0, seconds));
        while (this.accumulator + 1e-10 >= STEP) {
            this.game.tick(STEP);
            this.accumulator -= STEP;
            if (!['playing', 'countdown', 'impact'].includes(this.game.state)) { this.reset(); break; }
        }
    }
}

// Only flight time advances physics, spawns, powers and warnings.
export class Game {
    constructor({ random = Math.random, onEvent = () => {} } = {}) {
        this.width = WIDTH;
        this.reducedMotion = false;
        this.random = random;
        this.onEvent = onEvent;
        this.reset();
    }

    snapshot() {
        this.previous = { y: this.y, angle: this.angle, entities: new Map(this.entities.map(e => [e.id, {x:e.x, y:e.y}])) };
    }

    visual(alpha) {
        if (this.state !== 'playing' || !this.previous) return this;
        const lerp = (a,b) => a + (b-a) * Math.max(0, Math.min(1, alpha));
        const view = Object.create(this);
        view.y = lerp(this.previous.y, this.y);
        view.angle = lerp(this.previous.angle, this.angle);
        view.entities = this.entities.map(e => {
            const old = this.previous.entities.get(e.id);
            return old ? {...e, x:lerp(old.x,e.x), y:lerp(old.y,e.y)} : e;
        });
        return view;
    }

    reset(mode = 'aventura') {
        Object.assign(this, {
            mode, state: 'menu', elapsed: 0, score: 0, fruits: 0, correct: 0,
            shield: false, feather: 0, invincible: 0, held: false, holdAge: 0,
            flapCooldown: 0, stamina: 1, wing: 0, angle: 0, y: HEIGHT * .48,
            vy: 0, countdown: 2.4, entities: [], particles: [], nextSpawn: 1.5,
            sequence: 0, lastGap: 320, question: null, questionPool: [],
            answerResult: null, reason: '', stage: 0, nextId: 1, hit: null, impactRemaining: 0,
        });
        this.snapshot();
    }

    get x() { return Math.max(85, Math.min(220, this.width * .23)); }
    get body() { return { x: this.x - 18, y: this.y - 18, w: 36, h: 36 }; }
    get speed() { return FLIGHT[this.mode].speed + Math.min(55, this.elapsed * .45); }
    start(mode = 'aventura') { this.reset(mode); this.state = 'countdown'; }

    press() {
        if (this.state !== 'playing' || this.held) return;
        this.held = true;
        this.holdAge = 0;
        this.flap(true);
    }

    release() { this.held = false; this.holdAge = 0; }

    flap(tap = false) {
        if (this.flapCooldown > 0) return;
        // Every wingbeat restores upward velocity, including when tired or falling.
        // Fatigue softens sustained climbing without making the control ineffective.
        this.vy = -(tap ? FLIGHT.tapLift : FLIGHT.holdLift + FLIGHT.staminaLift * this.stamina);
        this.flapCooldown = FLIGHT.flapInterval;
        this.wing = 1;
    }

    pause() {
        if (!['playing', 'countdown'].includes(this.state)) return;
        this.beforePause = this.state;
        this.state = 'paused';
        this.release();
    }
    resume() { if (this.state === 'paused') { this.countdown = Math.max(1.5, this.beforePause === 'countdown' ? this.countdown : 0); this.state = 'countdown'; this.snapshot(); } }

    addScore(value, multiplier = this.feather > 0 ? 2 : 1) {
        this.score += value * multiplier;
        this.onEvent({ type: 'points', value: value * multiplier });
    }

    power(kind) {
        if (kind === 'shield') this.shield = true;
        if (kind === 'feather') this.feather = FEATHER_SECONDS;
        this.onEvent({ type: kind });
        this.burst(this.x, this.y, kind === 'shield' ? '#aedf8d' : '#ffd76b', 12);
    }

    collide(entity, animal = false, host = entity) {
        if (this.state !== 'playing' || this.invincible > 0) return;
        this.hit = {id:host.id, age:0};
        if (this.shield) {
            this.shield = false;
            this.invincible = 1.6;
            if (animal) {
                entity.retreat = true;
                entity.retreatTime = 0;
                entity.harmless = true;
                entity.retreatY = entity.y < this.y ? -180 : 180;
            } else {
                entity.broken = true;
                entity.brokenSide = entity.hitSide;
                const snakeSide = 'bottom';
                if (entity.snake && (!entity.brokenSide || entity.brokenSide === snakeSide)) { entity.snake.retreat = true; entity.snake.retreatTime = 0; }
            }
            this.onEvent({ type: 'shield-break', animal });
            this.featherBurst(['#d6edb0','#7ead5a','#e9f4ca'],12);
        } else this.end(false, animal ? (entity.kind === 'hawk' ? 'Um gavião cruzou seu caminho.' : 'Você encostou na cobra do galho.') : 'Você esbarrou na madeira.', true);
    }

    end(won, reason, collision = false) {
        if (['ended','impact'].includes(this.state)) return;
        this.impactRemaining = collision && !this.reducedMotion ? .42 : 0;
        this.state = this.impactRemaining > 0 ? 'impact' : 'ended';
        if(collision) this.featherBurst(['#48965b','#7db852','#3c8b91','#d7b85b'],18);
        this.won = won;
        this.reason = reason;
        this.release();
        this.onEvent({ type: won ? 'win' : 'lose' });
    }

    answer(value) {
        if (this.state !== 'quiz' || this.answerResult !== null) return;
        const right = value === this.question.answer;
        this.answerResult = right;
        if (right) { this.correct++; this.addScore(2, this.quizMultiplier); }
        this.onEvent({ type: right ? 'correct' : 'incorrect' });
    }

    continueQuiz() {
        if (this.state !== 'quiz' || this.answerResult === null) return;
        if (!this.answerResult && this.mode !== 'tranquilo') this.end(false, 'Esta resposta não estava correta. Vamos aprender e tentar de novo?');
        else if (this.score >= VICTORY_SCORE) this.end(true, 'Você completou a aventura do Chauá!');
        else { this.state = 'countdown'; this.countdown = 1.5; this.release(); this.snapshot(); }
    }

    collect(entity) {
        entity.collected = true;
        if (entity.kind !== 'fruit') return this.power(entity.kind);
        const multiplier = this.feather > 0 ? 2 : 1;
        this.fruits++;
        this.addScore(3, multiplier);
        this.onEvent({ type: 'fruit', fruit: FRUITS[entity.variety ?? 0].id });
        this.burst(entity.x, entity.y, '#ffc45b', 10);
        if (this.fruits % 2 === 0) {
            if (!this.questionPool.length) this.questionPool = QUESTIONS.map((_, i) => i);
            const index = Math.floor(this.random() * this.questionPool.length);
            this.question = QUESTIONS[this.questionPool.splice(index, 1)[0]];
            this.quizMultiplier = multiplier;
            this.answerResult = null;
            this.state = 'quiz';
            this.release();
        }
    }

    burst(x, y, color, count) {
        for (let i = 0; i < count; i++) this.particles.push({ x, y, vx: (this.random() - .5) * 160, vy: (this.random() - .5) * 160, life: .7, color });
    }

    featherBurst(colors, count) {
        // Cosmetic variation must not consume the obstacle/question random stream.
        for(let i=0;i<count;i++) {
            const angle=i*Math.PI*2/count, speed=125+(i*37)%95;
            this.particles.push({x:this.x,y:this.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-55,
                life:.48,maxLife:.48,color:colors[i%colors.length],feather:true,rotation:angle,spin:i%2?9:-7});
        }
    }

    advanceEffects(dt) {
        if(this.hit) {this.hit.age+=dt;if(this.hit.age>=.3)this.hit=null;}
        for(const p of this.particles) {
            p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
            if(p.feather) {p.vy+=210*dt;p.rotation+=p.spin*dt;}
        }
        this.particles=this.particles.filter(p=>p.life>0);
    }

    woodRects(entity) {
        if (entity.broken && !entity.brokenSide) return [];
        const { x, top, bottom, variant } = entity;
        const solids = variant === 'hollow' && top > 150
            ? [{ x, y: 0, w: 58, h: top - 108 }, { x, y: top - 42, w: 58, h: 42 }]
            : [{ x, y: 0, w: 58, h: top }];
        solids.push({ x, y: bottom, w: 58, h: HEIGHT - bottom });
        if (variant === 'branch') solids.push({ x: x - 70, y: bottom + 30, w: 78, h: 18 });
        if (variant === 'hollow') solids.push({x:x-22,y:bottom+140,w:24,h:30});
        if (variant === 'broken') solids.push({ x: x + 52, y: top - 35, w: 26, h: 18 });
        return solids.filter(rect => !entity.broken || (rect.y >= entity.bottom ? 'bottom' : 'top') !== entity.brokenSide);
    }

    snakeRects(entity) {
        if (!entity.snake || entity.snake.retreat) return [];
        const x=entity.x, y=entity.bottom;
        return entity.snake.branch
            ? [{x:x-52,y:y+12,w:31,h:15},{x:x-20,y:y+21,w:62,h:12}]
            : [{x:x+51,y:y+28,w:30,h:17},{x:x-3,y:y+35,w:62,h:23}];
    }

    spawn() {
        const n = this.sequence++;
        const soloHawk = this.elapsed > 42 && n % 3 === 1;
        // Reserve the first encounters: finish the preceding wood before a
        // solo hawk, and let that hawk leave before presenting another trunk.
        const waitingForSolo = this.entities.some(e => e.kind === 'hawk' && e.solo && !e.harmless && e.x > this.x - 100);
        if (waitingForSolo || (soloHawk && this.entities.some(e => e.kind === 'wood' && e.x + 85 > this.x - 40))) {
            this.sequence--; this.nextSpawn = .4; return;
        }
        if (n > 0 && n % 6 === 5) {
            this.nextSpawn = 2.8;
            this.onEvent({ type: 'quiet' });
            return;
        }
        const x = this.width + 80;
        const travel = (x - this.x) / this.speed;
        const profile = FLIGHT[this.mode];
        const gap = Math.max(profile.minGap, profile.gap - n * 1.5);
        const center = Math.max(200, Math.min(440, this.lastGap + (this.random() - .5) * 110));
        this.lastGap = center;
        const hawkAlone = soloHawk;
        if (hawkAlone) {
            const dive = this.elapsed > 55 && n % 2 === 0;
            const y = dive ? 100 : center < 320 ? 460 : 170;
            this.entities.push({ id: this.nextId++, kind: 'hawk', solo: true, x, y, startX: x, targetX: this.x - 60, startY: y, targetY: dive ? 420 : y,
                warning: Math.max(1.7, travel * .25), age: 0, dive, w: 66, h: 34 });
        } else {
            const variants = ['plain', 'broken', 'hollow', 'branch'];
            const variant = this.elapsed > 17 ? variants[n % variants.length] : 'plain';
            const wood = { id: this.nextId++, kind: 'wood', x, y: 0, top: center - gap / 2, bottom: center + gap / 2, variant, scored: false };
            if (this.elapsed > 22 && n % 2 === 0) wood.snake = { y: wood.bottom + 35, retreat: false };
            if (variant === 'branch') wood.snake = { y: wood.bottom + 12, branch: true, retreat: false };
            this.entities.push(wood);
            if (this.elapsed > 92 && n % 3 === 0) this.entities.push({
                id: this.nextId++, kind: 'hawk', x: x + 180, startX: x + 180, targetX: this.x - 60, y: center < 320 ? 600 : 40,
                startY: center < 320 ? 600 : 40, targetY: center < 320 ? 600 : 40,
                warning: 2, age: 0, dive: false, w: 66, h: 34,
            });
        }
        this.entities.push({ id: this.nextId++, kind: 'fruit', x: x + 15, y: center, variety: n % FRUITS.length });
        if (n % 4 === 0 || n % 4 === 2) this.entities.push({ id: this.nextId++, kind: n % 4 === 0 ? 'shield' : 'feather', x: x - 120, y: center });
        this.nextSpawn = Math.max(1.65, 2.15 - this.elapsed * .003);
    }

    tick(dt) {
        this.snapshot();
        if(this.state==='impact') {
            this.advanceEffects(dt);this.impactRemaining-=dt;
            if(this.impactRemaining<=1e-10 || this.reducedMotion)this.state='ended';
            return;
        }
        if (this.state === 'countdown') {
            this.countdown -= dt;
            if (this.countdown <= 1e-10) this.state = 'playing';
            return;
        }
        if (this.state !== 'playing') return;
        this.elapsed += dt;
        this.stage = Math.min(3, Math.floor(this.elapsed / 20));
        this.feather = Math.max(0, this.feather - dt);
        this.invincible = Math.max(0, this.invincible - dt);
        this.flapCooldown = Math.max(0, this.flapCooldown - dt);
        this.wing = Math.max(0, this.wing - dt * 4);
        this.stamina = Math.max(.08, Math.min(1, this.stamina + (this.held ? -.44 : .65) * dt));
        if (this.held) { this.holdAge += dt; this.flap(); }
        this.vy = Math.min(FLIGHT.fallLimit, this.vy + FLIGHT.gravity * dt);
        this.y += this.vy * dt;
        const targetAngle = Math.max(-.23, Math.min(.28, this.vy / 750));
        this.angle += (targetAngle - this.angle) * (1 - Math.exp(-8 * dt));
        if (this.y < 20 || this.y > HEIGHT - 25) {
            this.end(false, this.y < 20 ? 'Você voou acima da copa. Solte para descer.' : 'Você chegou ao chão da floresta. Uma batida de asas ajuda!', true);
            return;
        }
        this.nextSpawn -= dt;
        if (this.nextSpawn <= 0) this.spawn();
        for (const e of this.entities) {
            if (this.state !== 'playing') break;
            if (e.kind === 'hawk') {
                e.age += dt;
                if (e.warning > 0) { e.warning -= dt; continue; }
                e.x -= (this.speed + 50) * dt;
                if (e.retreat) { e.x += (this.speed + 200) * dt; e.y += e.retreatY * dt; }
                else e.y = e.startY + (e.targetY - e.startY) * Math.min(1, (e.startX - e.x) / (e.startX - e.targetX));
                if (!e.harmless && overlaps(this.body, { x: e.x - 30, y: e.y - 13, w: 60, h: 26 })) this.collide(e, true);
                continue;
            }
            e.x -= this.speed * dt;
            if (e.kind === 'wood') {
                if (e.snake?.retreat) e.snake.retreatTime += dt;
                if (e.snake && !e.snake.retreat) {
                    if (this.snakeRects(e).some(rect => overlaps(this.body, rect))) this.collide(e.snake, true, e);
                }
                const woodHit = this.woodRects(e).find(rect => overlaps(this.body, rect));
                if (woodHit) { e.hitSide = woodHit.y >= e.bottom ? 'bottom' : 'top'; this.collide(e); }
                if (!e.scored && e.x + 85 < this.x - 20) { e.scored = true; if (!e.broken) this.addScore(1); }
            } else if (!e.collected && overlaps(this.body, { x: e.x - 18, y: e.y - 18, w: 36, h: 36 })) this.collect(e);
        }
        this.entities = this.entities.filter(e => e.x > -150 && e.x < this.width + 800 && !e.collected);
        this.advanceEffects(dt);
        if (this.score >= VICTORY_SCORE && this.state === 'playing') this.end(true, 'Você completou a aventura do Chauá!');
    }
}
