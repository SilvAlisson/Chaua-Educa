import { JOURNEY, JOURNEY_LENGTH, ARRIVAL_SECONDS, journeyStage } from './journey.mjs';
import { offerPower, POWER_BALANCE } from './powers.mjs';
import { advanceHawk, advanceSnake } from './animals.mjs';
import { planEncounter, seededRandom } from './encounters.mjs';
import { FRUITS } from './fruits.mjs';
import { QUESTIONS } from './questions.mjs';

export const WIDTH = 960;
export const HEIGHT = 640;
export const STEP = 1 / 120;
export const FEATHER_SECONDS = 10;
export const CONTACT = Object.freeze({top:20, bottom:HEIGHT-25, recoveryMargin:36, grace:1.6});
export const VICTORY_SCORE = 200;
export const QUIZ_INTERVAL = 30;
export const FLIGHT = Object.freeze({
    gravity: 900, fallLimit: 360, tapLift: 300,
    holdLift: 230, staminaLift: 50, flapInterval: .22, inputBuffer: .12,
    aventura: {speed: 245, gap: 185, minGap: 155},
    tranquilo: {speed: 205, gap: 220, minGap: 190},
});
export const STAGES = JOURNEY.map(s=>s.name);
export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class FlightClock {
    constructor(game) { this.game = game; this.accumulator = 0; }
    reset() { this.accumulator = 0; }
    advance(seconds) {
        if (!['playing', 'countdown', 'impact', 'arrival'].includes(this.game.state)) return this.reset();
        this.accumulator += Math.min(.25, Math.max(0, seconds));
        while (this.accumulator + 1e-10 >= STEP) {
            this.game.tick(STEP);
            this.accumulator -= STEP;
            if (!['playing', 'countdown', 'impact', 'arrival'].includes(this.game.state)) { this.reset(); break; }
        }
    }
}

// Only flight time advances physics, spawns, powers and warnings.
export class Game {
    constructor({ random, seed = Math.floor(Math.random()*4294967296), onEvent = () => {} } = {}) {
        this.width = WIDTH;
        this.reducedMotion = false;
        this.seed = seed >>> 0;
        this.randomOverride = random;
        this.onEvent = onEvent;
        this.reset();
    }

    snapshot() {
        this.previous = { arrivalOffset:this.arrival?.offset||0, y: this.y, angle: this.angle, entities: new Map(this.entities.map(e => [e.id, {x:e.x, y:e.y}])) };
    }

    visual(alpha) {
        if (!['playing','arrival'].includes(this.state) || !this.previous) return this;
        const lerp = (a,b) => a + (b-a) * Math.max(0, Math.min(1, alpha));
        const view = Object.create(this);
        if(this.arrival)view.arrival={...this.arrival,offset:lerp(this.previous.arrivalOffset,this.arrival.offset)};
        view.y = lerp(this.previous.y, this.y);
        view.angle = lerp(this.previous.angle, this.angle);
        view.entities = this.entities.map(e => {
            const old = this.previous.entities.get(e.id);
            return old ? {...e, x:lerp(old.x,e.x), y:lerp(old.y,e.y)} : e;
        });
        return view;
    }

    reset(mode = 'aventura') {
        this.random = this.randomOverride ?? seededRandom(this.seed ^ 0x9e3779b9);
        this.encounterRandom = this.randomOverride ?? seededRandom(this.seed);
        this.powerRandom = this.randomOverride ?? seededRandom(this.seed ^ 0x85ebca6b);
        Object.assign(this, {
            stageAge:0, refuge:null, arrival:null, afterCountdown:'playing', medal:false,
            scoreBreakdown:{passage:0,fruit:0,quiz:0,route:0}, routes:new Map(), powerSchedule:{nextAny:0,nextShield:0,nextFeather:18},
            mode, state: 'menu', elapsed: 0, distance: 0, score: 0, fruits: 0, correct: 0,
            shield: false, feather: 0, invincible: 0, held: false, holdAge: 0,
            flapCooldown: 0, pendingTap: 0, stamina: 1, wing: 0, angle: 0, y: HEIGHT * .48,
            vy: 0, countdown: 2.4, entities: [], particles: [], popups: [], collectPulse: 0, powerFade: 0, nextSpawn: 1.5,
            sequence: 0, lastGap: 320, lastPattern: null, encounterHistory: [], question: null, questionPool: [],
            answerResult: null, quizPending: false, nextQuizAt: QUIZ_INTERVAL, reviewIds: [], reason: '', stage: 0, nextId: 1, hit: null, impactRemaining: 0,
        });
        this.snapshot();
    }

    get x() { return Math.max(85, Math.min(220, this.width * .23))+(this.arrival?.offset||0); }
    get body() { return { x: this.x - 18, y: this.y - 18, w: 36, h: 36 }; }
    get speed() { return FLIGHT[this.mode].speed + Math.min(55, this.elapsed * .45); }
    start(mode = 'aventura', reviewIds = [], seed = Math.floor(Math.random()*4294967296)) { this.seed=seed>>>0; this.reset(mode); this.reviewIds = [...reviewIds]; this.state = 'countdown'; }

    press() {
        if (!['playing', 'countdown'].includes(this.state) || this.held) return;
        this.held = true;
        this.holdAge = 0;
        if (this.state === 'countdown') return;
        if (this.flapCooldown <= 0) this.flap(true);
        else if (this.flapCooldown <= FLIGHT.inputBuffer) this.pendingTap = FLIGHT.inputBuffer;
    }

    cancelInput() { this.release(); this.pendingTap = 0; }

    release() { this.held = false; this.holdAge = 0; }

    flap(tap = false) {
        if (this.flapCooldown > 0) return;
        // Every wingbeat restores upward velocity, including when tired or falling.
        // Fatigue softens sustained climbing without making the control ineffective.
        this.vy = -(tap ? FLIGHT.tapLift : FLIGHT.holdLift + FLIGHT.staminaLift * this.stamina);
        this.flapCooldown = FLIGHT.flapInterval;
        this.pendingTap = 0;
        this.wing = 1;
        this.onEvent({type:'flap'});
    }

    pause() {
        if (!['playing', 'countdown','arrival'].includes(this.state)) return;
        this.beforePause = this.state;
        this.state = 'paused';
        this.cancelInput();
    }
    resume() { if (this.state === 'paused') { this.afterCountdown=this.beforePause==='arrival'?'arrival':this.beforePause==='countdown'?this.afterCountdown:'playing'; this.countdown = Math.max(1.5, this.beforePause === 'countdown' ? this.countdown : 0); this.state = 'countdown'; this.snapshot(); } }

    addScore(value, multiplier = this.feather > 0 ? 2 : 1, source = 'passage') {
        this.score += value * multiplier;
        this.scoreBreakdown[source] += value * multiplier;
        if(!this.medal && this.score>=VICTORY_SCORE){this.medal=true;this.onEvent({type:'medal'});}
        this.onEvent({ type: 'points', value: value * multiplier });
        this.popups.push({x:this.x+28,y:this.y-30,text:`+${value*multiplier}`,gold:multiplier===2,life:.85});
        if(this.popups.length>6)this.popups.shift();
    }

    power(kind) {
        if (kind === 'shield' && this.shield) { this.onEvent({type:'shield-kept'}); return; }
        const renewed=kind==='feather' && this.feather>0;
        if (kind === 'shield') this.shield = true;
        if (kind === 'feather') {this.feather = FEATHER_SECONDS;this.powerFade=0;}
        this.onEvent({ type: kind, renewed });
        this.burst(this.x, this.y, kind === 'shield' ? '#aedf8d' : '#ffd76b', 12);
    }

    recover(host, boundary) {
        // Keep the visual interpolation from drawing a rescue through solid wood.
        if (Number.isFinite(host?.top) && Number.isFinite(host?.bottom)) {
            this.y = (host.top + host.bottom) / 2;
            this.vy = 0;
        } else if (boundary) {
            this.y = boundary === 'top' ? CONTACT.top + CONTACT.recoveryMargin : CONTACT.bottom - CONTACT.recoveryMargin;
            this.vy = boundary === 'top' ? 120 : -180;
        }
        this.previous.y = this.y;
    }

    boundaryContact(side) {
        if (this.invincible > 0) { for(const r of this.routes.values())r.failed=true; this.recover(null, side); return; }
        this.collide({kind:'boundary', side});
    }

    collide(entity, animal = false, host = entity) {
        if (this.state !== 'playing') return;
        const route=this.routes.get(host.route);if(route)route.failed=true;
        if(entity.kind==='boundary')for(const r of this.routes.values())r.failed=true;
        if(this.invincible>0)return;
        const boundary = entity.kind === 'boundary' ? entity.side : null;
        this.hit = boundary ? null : {id:host.id, age:0};
        if (this.shield) {
            this.shield = false;
            this.invincible = CONTACT.grace;
            if (host.kind === 'wood') host.contacted = true;
            if (animal) {
                entity.phase = 'retreat';
                entity.retreat = true;
                entity.retreatTime = 0;
                entity.harmless = true;
                entity.retreatY = entity.y < this.y ? -180 : 180;
            } else if (!boundary) {
                // Only the dry protruding branch breaks; living trunks remain intact.
                if (entity.hitPart === 'dry-branch') {
                    entity.dryBranchBroken = true;
                    this.woodBurst(this.x, this.y);
                } else this.burst(this.x, this.y, '#9aba67', 8);
            }
            this.featherBurst(['#d6edb0','#7ead5a','#e9f4ca'],12);
            this.recover(host, boundary);
            this.onEvent({ type: 'shield-break', animal, boundary });
        } else {
            const reason = boundary ? (boundary === 'top' ? 'Você voou acima da copa. Solte para descer.' : 'Você chegou ao chão da floresta. Uma batida de asas ajuda!')
                : animal ? (entity.kind === 'hawk' ? 'Um gavião cruzou seu caminho.' : 'Você encostou na cobra do galho.') : 'Você esbarrou na madeira.';
            this.end(false, reason, true);
        }
    }

    end(won, reason, collision = false) {
        if (['ended','impact'].includes(this.state)) return;
        this.impactRemaining = collision && !this.reducedMotion ? .42 : 0;
        this.state = this.impactRemaining > 0 ? 'impact' : 'ended';
        if(collision) this.featherBurst(['#48965b','#7db852','#3c8b91','#d7b85b'],18);
        this.won = won;
        this.reason = reason;
        this.cancelInput();
        this.onEvent({ type: won ? 'win' : 'lose' });
    }

    answer(value) {
        if (this.state !== 'quiz' || this.answerResult !== null) return;
        const right = value === this.question.answer;
        this.answerResult = right;
        if (right) { this.correct++; this.addScore(2, this.quizMultiplier, 'quiz'); }
        this.onEvent({ type: right ? 'correct' : 'incorrect', questionId:this.question.id });
        this.reviewIds = this.reviewIds.filter(id=>id!==this.question.id);
        if (!right) this.reviewIds.push(this.question.id);
    }

    continueQuiz() {
        if (this.state !== 'quiz' || this.answerResult === null) return;
        this.nextQuizAt = this.elapsed + QUIZ_INTERVAL;
        if (!this.answerResult && this.mode !== 'tranquilo') this.end(false, 'Esta resposta não estava correta. Vamos aprender e tentar de novo?');
        else { this.state = 'countdown'; this.countdown = 1.5; this.cancelInput(); this.snapshot(); }
    }

    collect(entity) {
        if(this.state!=='playing' || entity.collected)return;
        entity.collected = true;
        if (entity.kind !== 'fruit') return this.power(entity.kind);
        const multiplier = this.feather > 0 ? 2 : 1;
        this.fruits++;
        this.addScore(3, multiplier, 'fruit');
        const route=this.routes.get(entity.route);
        if(route && !route.failed && !route.awarded) {
            route.collected++;
            if(route.collected===route.total) {
                route.awarded=true;
                this.addScore(POWER_BALANCE.routeBonus,multiplier,'route');
                this.onEvent({type:'route-complete',points:POWER_BALANCE.routeBonus*multiplier});
            }
        }
        this.onEvent({ type: 'fruit', fruit: FRUITS[entity.variety ?? 0].id });
        this.collectPulse=.26;
        this.burst(entity.x, entity.y, multiplier===2?'#ffe39a':'#bce77f', 12);
        this.quizPending = true; // One pending discovery, regardless of fruit count.
    }

    get quizDue() { return this.quizPending && this.elapsed >= this.nextQuizAt; }

    maybeOpenQuiz() {
        if (this.state !== 'playing' || !this.quizDue || this.refuge) return false;
        // Drain existing encounters before the pause; nothing dangerous remains ahead.
        const danger = this.entities.some(e =>
            (e.kind === 'wood' && e.x + 85 > this.x - 36) ||
            (e.kind === 'hawk' && !e.harmless && e.x + 30 > this.x - 36));
        if (danger || this.y < 120 || this.y > HEIGHT - 120 || Math.abs(this.vy) > 160) return false;
        if (!this.questionPool.length) this.questionPool = QUESTIONS.map((_,i)=>i);
        const review = this.questionPool.find(i=>this.reviewIds.includes(QUESTIONS[i].id));
        const themed=this.questionPool.filter(i=>JOURNEY[this.stage].topics.includes(QUESTIONS[i].topic));
        const candidates=themed.length?themed:this.questionPool;
        const index=review===undefined?this.questionPool.indexOf(candidates[Math.floor(this.random()*candidates.length)]):this.questionPool.indexOf(review);
        this.question = QUESTIONS[this.questionPool.splice(index,1)[0]];
        // Capture the power at the actual discovery, then freeze it with the flight.
        this.quizMultiplier = this.feather > 0 ? 2 : 1;
        this.quizPending = false;
        this.answerResult = null;
        this.state = 'quiz';
        this.cancelInput();
        this.nextSpawn = Math.max(this.nextSpawn, 1.5);
        return true;
    }

    burst(x, y, color, count) {
        for(let i=0;i<count;i++) {
            const a=i*Math.PI*2/count, speed=55+(i*29)%85;
            this.particle({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-25,life:.6,maxLife:.6,color,spark:true});
        }
    }

    featherBurst(colors, count) {
        // Cosmetic variation must not consume the obstacle/question random stream.
        for(let i=0;i<count;i++) {
            const angle=i*Math.PI*2/count, speed=125+(i*37)%95;
            this.particle({x:this.x,y:this.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-55,
                life:.48,maxLife:.48,color:colors[i%colors.length],feather:true,rotation:angle,spin:i%2?9:-7});
        }
    }

    particle(p) {
        if(this.particles.length>=96)this.particles.shift();
        this.particles.push(p);
    }

    woodBurst(x,y) {
        for(let i=0;i<16;i++) {
            const a=i*2.39996;
            this.particle({x,y,vx:Math.cos(a)*(90+i*5),vy:Math.sin(a)*110-75,
                life:.65,maxLife:.65,color:i%3?'#9d7545':'#9aba67',chip:i%3!==0,
                size:3+i%5,rotation:a,spin:i%2?7:-9});
        }
    }

    advanceEffects(dt) {
        this.collectPulse=Math.max(0,this.collectPulse-dt);
        this.powerFade=Math.max(0,this.powerFade-dt);
        for(const p of this.popups){p.life-=dt;if(!this.reducedMotion)p.y-=24*dt;}
        this.popups=this.popups.filter(p=>p.life>0);
        for(const e of this.entities)if(e.breakFx){e.breakFx.age+=dt;if(e.breakFx.age>=.24)delete e.breakFx;}
        if(this.hit) {this.hit.age+=dt;if(this.hit.age>=.3)this.hit=null;}
        for(const p of this.particles) {
            p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
            if(p.feather||p.chip) {p.vy+=(p.chip?380:210)*dt;p.rotation+=p.spin*dt;}
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
        if (variant === 'broken' && !entity.dryBranchBroken) solids.push({ x: x + 52, y: top - 35, w: 26, h: 18, part:'dry-branch' });
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
        const plan=planEncounter({sequence:n,elapsed:this.elapsed,lastCenter:this.lastGap,lastPattern:this.lastPattern,profile,speed:this.speed,stage:this.stage,random:this.encounterRandom});
        const {gap,center}=plan;
        if(this.stage===2)plan.interval+=.4;
        if(this.stage===3)plan.interval+=.2;
        this.lastGap = center;
        this.lastPattern = plan.id;
        this.encounterHistory.push({sequence:n,pattern:soloHawk?'hawk':plan.id,center,gap,elapsed:this.elapsed});
        if(this.encounterHistory.length>12)this.encounterHistory.shift();
        const hawkAlone = soloHawk;
        if (hawkAlone) {
            const dive = this.elapsed > 55 && n % 2 === 0;
            const y = dive ? 100 : center < 320 ? 460 : 170;
            this.entities.push({ id: this.nextId++, kind: 'hawk', solo: true, x, y, startX: x, targetX: this.x - 60, startY: y, targetY: dive ? 420 : y,
                warning: Math.max(1.7, travel * .25), phase:'warning', age: 0, dive, w: 66, h: 34 });
        } else {
            const variants = ['plain', 'broken', 'hollow', 'branch'];
            const variant = plan.variant ?? (this.stage===1 && n%2===0?'hollow':this.elapsed > 17 ? variants[n % variants.length] : 'plain');
            const wood = { id: this.nextId++, kind: 'wood', x, y: 0, top: center - gap / 2, bottom: center + gap / 2, variant, scored: false, route:n, encounter:plan.id };
            if (this.elapsed > 22 && n % 2 === 0) wood.snake = { y: wood.bottom + 35, phase:'watching', retreat: false };
            if (variant === 'branch') wood.snake = { y: wood.bottom + 12, branch: true, phase:'watching', retreat: false };
            this.entities.push(wood);
        }
        const fruits=hawkAlone?[{x:15,y:center}]:plan.fruits;
        if(fruits.length>1)this.routes.set(n,{total:fruits.length,collected:0,awarded:false,failed:false});
        for(const [index,point] of fruits.entries()) this.entities.push({ id: this.nextId++, kind:'fruit', x:x+point.x, y:point.y,
            variety:(n+index)%FRUITS.length, route:n, optional:!hawkAlone&&plan.optional });
        const kind=hawkAlone?null:offerPower({elapsed:this.elapsed,shield:this.shield,feather:this.feather,entities:this.entities,schedule:this.powerSchedule,opportunity:fruits.length>1,random:this.powerRandom});
        if(kind)this.entities.push({id:this.nextId++,kind,x:x+fruits[0].x-125,y:fruits[0].y});
        this.nextSpawn = plan.interval;
    }

    advanceJourney(dt) {
        if(this.distance<JOURNEY_LENGTH)return;
        const danger=this.entities.some(e=>(e.kind==='wood'&&e.x+85>this.x-36)||(e.kind==='hawk'&&!e.harmless&&e.x+30>this.x-36));
        if(danger || (this.quizDue&&!this.refuge))return;
        if(!this.refuge){this.refuge={x:800,y:320};this.onEvent({type:'refuge'});}
        this.refuge.x=Math.max(330,this.refuge.x-this.speed*dt);
        if(this.refuge.x<=330 && Math.abs(this.y-this.refuge.y)<=60) {
            this.state='arrival';this.arrival={age:0,offset:0,fromY:this.y};this.cancelInput();this.snapshot();
        }
    }

    tick(dt) {
        this.snapshot();
        if(this.state==='arrival') {
            this.arrival.age=this.reducedMotion?ARRIVAL_SECONDS:Math.min(ARRIVAL_SECONDS,this.arrival.age+dt);
            const t=this.arrival.age/ARRIVAL_SECONDS, ease=t*t*(3-2*t);
            this.arrival.offset=110*ease;this.y=this.arrival.fromY+(320-this.arrival.fromY)*ease;
            this.angle=0;this.advanceEffects(dt);
            if(t>=1)this.end(true,'Você chegou ao abrigo e reencontrou o bando!');
            return;
        }
        if(this.state==='impact') {
            this.advanceEffects(dt);this.impactRemaining-=dt;
            if(this.impactRemaining<=1e-10 || this.reducedMotion)this.state='ended';
            return;
        }
        if (this.state === 'countdown') {
            this.countdown -= dt;
            if (this.countdown <= 1e-10) {
                this.state = this.afterCountdown;
                // A fresh held command starts immediately; old cooldown must not delay resume.
                if (this.held && this.state==='playing') { this.flapCooldown = 0; this.flap(true); }
            }
            return;
        }
        if (this.state !== 'playing') return;
        this.elapsed += dt;
        this.distance = Math.min(JOURNEY_LENGTH,this.distance+this.speed*dt);
        const nextStage=journeyStage(this.distance);
        if(nextStage!==this.stage){this.stage=nextStage;this.stageAge=0;this.onEvent({type:'stage',message:JOURNEY[this.stage].message});}
        this.stageAge+=dt;
        const previousFeather=this.feather;
        this.feather = Math.max(0, this.feather - dt);
        if(previousFeather>0 && this.feather===0){this.powerFade=.5;this.onEvent({type:'feather-end'});}
        this.invincible = Math.max(0, this.invincible - dt);
        this.flapCooldown = Math.max(0, this.flapCooldown - dt);
        this.wing = Math.max(0, this.wing - dt * 4);
        this.stamina = Math.max(.08, Math.min(1, this.stamina + (this.held ? -.44 : .65) * dt));
        if (this.pendingTap > 0 && this.flapCooldown === 0) this.flap(true);
        this.pendingTap = Math.max(0, this.pendingTap - dt);
        if (this.held) { this.holdAge += dt; this.flap(); }
        this.vy = Math.min(FLIGHT.fallLimit, this.vy + FLIGHT.gravity * dt);
        this.y += this.vy * dt;
        const targetAngle = Math.max(-.23, Math.min(.28, this.vy / 750));
        this.angle += (targetAngle - this.angle) * (1 - Math.exp(-8 * dt));
        if (this.y < CONTACT.top || this.y > CONTACT.bottom) {
            this.boundaryContact(this.y < CONTACT.top ? 'top' : 'bottom');
            if (this.state !== 'playing') return;
        }
        this.nextSpawn -= dt;
        if (this.nextSpawn <= 0 && !this.quizDue && this.distance<JOURNEY_LENGTH) this.spawn();
        for (const e of this.entities) {
            if (this.state !== 'playing') break;
            if (e.kind === 'hawk') {
                advanceHawk(e,dt,this.speed,this.x);
                if (e.phase !== 'warning' && !e.harmless && overlaps(this.body, { x: e.x - 30, y: e.y - 13, w: 60, h: 26 })) this.collide(e, true);
                continue;
            }
            e.x -= this.speed * dt;
            if (e.kind === 'wood') {
                advanceSnake(e,dt,this.x);
                if (e.snake && !e.snake.retreat) {
                    if (this.snakeRects(e).some(rect => overlaps(this.body, rect))) this.collide(e.snake, true, e);
                }
                const woodHit = this.woodRects(e).find(rect => overlaps(this.body, rect));
                if (woodHit) { e.hitPart = woodHit.part; e.hitSide = woodHit.y >= e.bottom ? 'bottom' : 'top'; this.collide(e); }
                if (this.state !== 'playing') break;
                if (!e.scored && e.x + 85 < this.x - 20) { e.scored = true; if (!e.broken && !e.contacted) this.addScore(1); }
            } else if (!e.collected && overlaps(this.body, { x: e.x - 18, y: e.y - 18, w: 36, h: 36 })) this.collect(e);
        }
        this.entities = this.entities.filter(e => e.x > -150 && e.x < this.width + 800 && !e.collected && !e.finished);
        for(const id of this.routes.keys())if(!this.entities.some(e=>e.kind==='fruit'&&e.route===id))this.routes.delete(id);
        this.advanceEffects(dt);
        this.maybeOpenQuiz();
        if(this.state==='playing')this.advanceJourney(dt);
    }
}
