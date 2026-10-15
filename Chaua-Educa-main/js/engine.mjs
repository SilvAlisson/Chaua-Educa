import { QUESTIONS } from './questions.mjs';

export const HEIGHT = 640;
export const STEP = 1 / 120;
export const FEATHER_SECONDS = 10;
export const VICTORY_SCORE = 200;
export const STAGES = ['Primeiras asas', 'Entre raízes', 'Céu compartilhado', 'Coração da mata'];
export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class FlightClock {
    constructor(game) { this.game = game; this.accumulator = 0; }
    reset() { this.accumulator = 0; }
    advance(seconds) {
        if (!['playing', 'countdown'].includes(this.game.state)) return this.reset();
        this.accumulator += Math.min(.25, Math.max(0, seconds));
        while (this.accumulator + 1e-10 >= STEP) {
            this.game.tick(STEP);
            this.accumulator -= STEP;
            if (!['playing', 'countdown'].includes(this.game.state)) { this.reset(); break; }
        }
    }
}

// Only flight time advances physics, spawns, powers and warnings.
export class Game {
    constructor({ width = 960, random = Math.random, onEvent = () => {} } = {}) {
        this.width = width;
        this.random = random;
        this.onEvent = onEvent;
        this.reset();
    }

    reset(mode = 'aventura') {
        Object.assign(this, {
            mode, state: 'menu', elapsed: 0, score: 0, fruits: 0, correct: 0,
            shield: false, feather: 0, invincible: 0, held: false, holdAge: 0,
            flapCooldown: 0, stamina: 1, wing: 0, angle: 0, y: HEIGHT * .48,
            vy: 0, countdown: 2.4, entities: [], particles: [], nextSpawn: 1.5,
            sequence: 0, lastGap: 320, question: null, questionPool: [],
            answerResult: null, reason: '', stage: 0, nextId: 1,
        });
    }

    get x() { return Math.max(85, Math.min(220, this.width * .23)); }
    get body() { return { x: this.x - 18, y: this.y - 18, w: 36, h: 36 }; }
    get speed() { return (this.mode === 'tranquilo' ? 119 : 140) + Math.min(35, this.elapsed * .32); }
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
        // Continuous holds lose lift; releasing restores wing energy.
        const lift = tap ? 165 + 45 * this.stamina : 125 * this.stamina;
        this.vy = Math.max(-220, this.vy - lift);
        this.flapCooldown = .24;
        this.wing = 1;
    }

    pause() {
        if (!['playing', 'countdown'].includes(this.state)) return;
        this.beforePause = this.state;
        this.state = 'paused';
        this.release();
    }
    resume() { if (this.state === 'paused') this.state = this.beforePause; }

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

    collide(entity, animal = false) {
        if (this.invincible > 0) return;
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
                const snakeSide = entity.snake?.branch ? 'bottom' : 'top';
                if (entity.snake && (!entity.brokenSide || entity.brokenSide === snakeSide)) { entity.snake.retreat = true; entity.snake.retreatTime = 0; }
            }
            this.onEvent({ type: 'shield-break', animal });
            this.burst(this.x, this.y, animal ? '#b7df92' : '#bb9765', 18);
        } else this.end(false, animal ? (entity.kind === 'hawk' ? 'Um gavião cruzou seu caminho.' : 'Você encostou na cobra do galho.') : 'Você esbarrou na madeira.');
    }

    end(won, reason) {
        if (this.state === 'ended') return;
        this.state = 'ended';
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
        if (!this.answerResult) this.end(false, 'Esta resposta não estava correta. Vamos aprender e tentar de novo?');
        else if (this.score >= VICTORY_SCORE) this.end(true, 'Você completou a aventura do Chauá!');
        else { this.state = 'playing'; this.release(); }
    }

    collect(entity) {
        entity.collected = true;
        if (entity.kind !== 'fruit') return this.power(entity.kind);
        const multiplier = this.feather > 0 ? 2 : 1;
        this.fruits++;
        this.addScore(3, multiplier);
        this.onEvent({ type: 'fruit' });
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

    woodRects(entity) {
        if (entity.broken && !entity.brokenSide) return [];
        const { x, top, bottom, variant } = entity;
        const solids = variant === 'hollow' && top > 150
            ? [{ x, y: 0, w: 58, h: top - 108 }, { x, y: top - 42, w: 58, h: 42 }]
            : [{ x, y: 0, w: 58, h: top }];
        solids.push({ x, y: bottom, w: 58, h: HEIGHT - bottom });
        if (variant === 'branch') solids.push({ x: x - 40, y: bottom + 20, w: 48, h: 19 });
        if (variant === 'broken') solids.push({ x: x + 52, y: top - 35, w: 26, h: 18 });
        return solids.filter(rect => !entity.broken || (rect.y >= entity.bottom ? 'bottom' : 'top') !== entity.brokenSide);
    }

    snakeRects(entity) {
        if (!entity.snake || entity.snake.retreat) return [];
        const { y, branch } = entity.snake, x = entity.x;
        return [
            { x: x + 2, y: y - 28, w: 62, h: 23 },
            { x: x + (branch ? -43 : 22), y: y - 12, w: 32, h: 24 },
            ...(branch ? [{ x: x - 27, y: y - 14, w: 40, h: 18 }] : []),
        ];
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
            this.nextSpawn = 4.4;
            this.onEvent({ type: 'quiet' });
            return;
        }
        const x = this.width + 80;
        const travel = (x - this.x) / this.speed;
        const gap = this.mode === 'tranquilo' ? 278 : Math.max(220, 270 - n * 2);
        const center = Math.max(200, Math.min(440, this.lastGap + (this.random() - .5) * 110));
        this.lastGap = center;
        const hawkAlone = soloHawk;
        if (hawkAlone) {
            const dive = this.elapsed > 75 && n % 2 === 0;
            const y = dive ? 100 : center < 320 ? 460 : 170;
            this.entities.push({ id: this.nextId++, kind: 'hawk', solo: true, x, y, startX: x, targetX: this.x - 60, startY: y, targetY: dive ? 420 : y,
                warning: Math.max(1.7, travel * .25), age: 0, dive, w: 66, h: 34 });
        } else {
            const variants = ['plain', 'broken', 'hollow', 'branch'];
            const variant = this.elapsed > 17 ? variants[n % variants.length] : 'plain';
            const wood = { id: this.nextId++, kind: 'wood', x, y: 0, top: center - gap / 2, bottom: center + gap / 2, variant, scored: false };
            if (this.elapsed > 22 && n % 2 === 0) wood.snake = { y: wood.top + 9, retreat: false };
            if (variant === 'branch') wood.snake = { y: wood.bottom + 12, branch: true, retreat: false };
            this.entities.push(wood);
            if (this.elapsed > 92 && n % 3 === 0) this.entities.push({
                id: this.nextId++, kind: 'hawk', x: x + 180, startX: x + 180, targetX: this.x - 60, y: center < 320 ? 600 : 40,
                startY: center < 320 ? 600 : 40, targetY: center < 320 ? 600 : 40,
                warning: 2, age: 0, dive: false, w: 66, h: 34,
            });
        }
        this.entities.push({ id: this.nextId++, kind: 'fruit', x: x + 15, y: center, variety: n % 4 });
        if (n % 4 === 0 || n % 4 === 2) this.entities.push({ id: this.nextId++, kind: n % 4 === 0 ? 'shield' : 'feather', x: x - 120, y: center });
        this.nextSpawn = Math.max(2.9, 3.6 - this.elapsed * .004);
    }

    tick(dt) {
        if (this.state === 'countdown') {
            this.countdown -= dt;
            if (this.countdown <= 0) this.state = 'playing';
            return;
        }
        if (this.state !== 'playing') return;
        this.elapsed += dt;
        this.stage = Math.min(3, Math.floor(this.elapsed / 30));
        this.feather = Math.max(0, this.feather - dt);
        this.invincible = Math.max(0, this.invincible - dt);
        this.flapCooldown = Math.max(0, this.flapCooldown - dt);
        this.wing = Math.max(0, this.wing - dt * 4);
        this.stamina = Math.max(.08, Math.min(1, this.stamina + (this.held ? -.44 : .65) * dt));
        if (this.held) { this.holdAge += dt; this.flap(); }
        this.vy = Math.min(this.held ? 250 : 125, this.vy + (this.held ? 470 : 230) * dt);
        this.y += this.vy * dt;
        const targetAngle = Math.max(-.23, Math.min(.28, this.vy / 750));
        this.angle += (targetAngle - this.angle) * (1 - Math.exp(-8 * dt));
        if (this.y < 20 || this.y > HEIGHT - 25) {
            this.end(false, this.y < 20 ? 'Você voou acima da copa. Solte para planar.' : 'Você chegou ao chão da floresta. Uma batida de asas ajuda!');
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
                if (e.retreat) { e.x += 330 * dt; e.y += e.retreatY * dt; }
                else e.y = e.startY + (e.targetY - e.startY) * Math.min(1, (e.startX - e.x) / (e.startX - e.targetX));
                if (!e.harmless && overlaps(this.body, { x: e.x - 30, y: e.y - 13, w: 60, h: 26 })) this.collide(e, true);
                continue;
            }
            e.x -= this.speed * dt;
            if (e.kind === 'wood') {
                if (e.snake?.retreat) e.snake.retreatTime += dt;
                if (e.snake && !e.snake.retreat) {
                    if (this.snakeRects(e).some(rect => overlaps(this.body, rect))) this.collide(e.snake, true);
                }
                const woodHit = this.woodRects(e).find(rect => overlaps(this.body, rect));
                if (woodHit) { e.hitSide = woodHit.y >= e.bottom ? 'bottom' : 'top'; this.collide(e); }
                if (!e.scored && e.x + 85 < this.x - 20) { e.scored = true; if (!e.broken) this.addScore(1); }
            } else if (!e.collected && overlaps(this.body, { x: e.x - 18, y: e.y - 18, w: 36, h: 36 })) this.collect(e);
        }
        this.entities = this.entities.filter(e => e.x > -150 && e.x < this.width + 800 && !e.collected);
        for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
        this.particles = this.particles.filter(p => p.life > 0);
        if (this.score >= VICTORY_SCORE && this.state === 'playing') this.end(true, 'Você completou a aventura do Chauá!');
    }
}
