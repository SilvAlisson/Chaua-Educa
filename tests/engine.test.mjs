import { QUESTIONS } from '../Chaua-Educa-main/js/questions.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, FlightClock, STEP, overlaps } from '../Chaua-Educa-main/js/engine.mjs';

function flight(options) { const game = new Game(options); game.state = 'playing'; game.nextSpawn = Infinity; return game; }
function advance(game, seconds) { for (let i = 0; i < Math.round(seconds / STEP); i++) game.tick(STEP); }
function wood(game, options = {}) { return { kind: 'wood', x: game.x - 18, top: 350, bottom: 550, variant: 'plain', ...options }; }

test('a tap lifts; release glides with bounded descent and gentle tilt', () => {
    const game = flight(); game.press(); game.release(); advance(game, .3);
    assert.ok(game.y < 307.2); assert.ok(game.angle >= -.23 && game.angle <= .28);
    game.y = 150; game.vy = 300; advance(game, .5);
    assert.ok(game.vy <= 125); assert.ok(game.y < 215);
});

test('a continuous hold loses lift and cannot supply infinite ascent', () => {
    const game = flight(); game.press();
    // Center vertically to isolate fatigue from boundary collisions.
    for (let i = 0; i < 480; i++) { game.y = 320; game.tick(STEP); }
    assert.ok(game.stamina <= .1); assert.ok(game.vy > 0);
    const energy = game.stamina; game.release(); advance(game, .25);
    assert.ok(game.stamina > energy);
});

test('30, 60 and 144 Hz advance the same physics and power clock', () => {
    const snapshots = [30, 60, 144].map(fps => {
        const game = flight(), clock = new FlightClock(game);
        game.power('feather'); game.press(); game.release();
        for (let i = 0; i < fps; i++) clock.advance(1 / fps);
        return [game.y, game.vy, game.feather, game.elapsed, game.angle];
    });
    for (const snapshot of snapshots.slice(1)) snapshot.forEach((n, i) => assert.ok(Math.abs(n - snapshots[0][i]) < 1e-8));
});

test('pauses freeze countdown, physics, warnings and powers without catch-up', () => {
    const game = flight(), clock = new FlightClock(game); game.power('feather');
    game.entities.push({kind:'hawk', x:900,y:100,startX:900,startY:100,targetX:100,targetY:100,warning:2,age:0});
    game.pause(); const snapshot = JSON.stringify(game); for (let i = 0; i < 100; i++) clock.advance(.1);
    assert.equal(JSON.stringify(game), snapshot); game.resume(); advance(game,1.5); clock.advance(STEP);
    assert.ok(game.feather < 10 && game.feather > 9.9);
    game.start(); game.pause(); advance(game, 3); assert.equal(game.countdown, 2.4);
});

test('quiz freezes timers and guarantees the captured multiplier on its answer', () => {
    const game = flight({random:()=>.2}); game.feather = .01; game.fruits = 1;
    game.collect({kind:'fruit',x:game.x,y:game.y});
    assert.equal(game.state, 'quiz'); assert.equal(game.score, 6);
    const time = game.feather; advance(game, 20); assert.equal(game.feather, time);
    game.feather = 0; game.answer(game.question.answer); game.answer(game.question.answer);
    assert.equal(game.score, 10); assert.equal(game.correct, 1);
    game.continueQuiz(); assert.equal(game.state, 'countdown');
});

test('questions do not repeat until the whole pool has been used', () => {
    const game = flight({random:()=>0}), seen = new Set();
    for (let i = 0; i < QUESTIONS.length; i++) {
        game.state = 'playing'; game.fruits = 1; game.collect({kind:'fruit',x:0,y:0});
        assert.ok(!seen.has(game.question.text)); seen.add(game.question.text);
        game.answer(game.question.answer); game.continueQuiz();
    }
    assert.equal(seen.size, QUESTIONS.length);
});

test('feathers refresh ten seconds and never multiply to four', () => {
    const game = flight(); game.power('feather'); advance(game, .5); game.power('feather');
    assert.equal(game.feather, 10); game.addScore(3); assert.equal(game.score, 6);
});

test('one shield breaks wood, grants escape time and no destruction points', () => {
    const game = flight(), obstacle = wood(game); game.entities = [obstacle];
    game.power('shield'); game.power('shield'); game.tick(STEP);
    assert.equal(game.shield, false); assert.equal(obstacle.broken, true); assert.ok(game.invincible > 1.5); assert.equal(game.state, 'playing');
    assert.equal(obstacle.brokenSide, 'top');
    assert.ok(game.woodRects(obstacle).some(rect=>rect.y===obstacle.bottom));
    obstacle.x = game.x - 200; game.tick(STEP); assert.equal(game.score, 0);
    game.invincible = 0; game.entities = [wood(game)]; game.tick(STEP); assert.equal(game.state, 'ended');
});

test('shield repels animals and never destroys them', () => {
    const game = flight(), animal = {kind:'hawk',x:game.x,y:game.y,startX:game.x,startY:game.y,targetX:0,targetY:game.y,warning:0,age:0};
    game.power('shield'); game.entities = [animal]; game.tick(STEP);
    assert.equal(animal.retreat, true); assert.equal(animal.harmless, true); assert.equal(animal.broken, undefined); assert.equal(game.state, 'playing');
});

test('hollow cavities are passable; their wooden rims remain solid', () => {
    const game = flight(), obstacle = wood(game,{top:260,variant:'hollow'});
    const cavity = { x:game.x-18, y:170, w:36, h:36 };
    assert.equal(game.woodRects(obstacle).some(r=>overlaps(cavity,r)), false);
    assert.equal(game.woodRects(obstacle).some(r=>overlaps({...cavity,y:240},r)), true);
});

test('generation introduces snakes and hawks gradually and preserves open routes', () => {
    for (const random of [()=>0, ()=>.5, ()=>.999]) {
        const game = flight({random}); let lastCenter = 320;
        for (let i = 0; i < 45; i++) {
            game.elapsed = i * 3.6; game.entities = []; game.spawn();
            const obstacle = game.entities.find(e=>e.kind==='wood');
            const hawks = game.entities.filter(e=>e.kind==='hawk');
            if (game.elapsed < 22 && obstacle) assert.ok(!obstacle.snake);
            if (game.elapsed < 42) assert.equal(hawks.length, 0);
            if (obstacle) {
                assert.ok(obstacle.bottom-obstacle.top>=220);
                const center = (obstacle.top+obstacle.bottom)/2;
                assert.ok(Math.abs(center-lastCenter)<=55.01); lastCenter=center;
                for (const hawk of hawks) {
                    assert.ok(hawk.warning>=1.7);
                    assert.ok(Math.max(hawk.startY,hawk.targetY)+20<obstacle.top || Math.min(hawk.startY,hawk.targetY)-20>obstacle.bottom);
                }
                for (const item of game.entities.filter(e=>['fruit','feather','shield'].includes(e.kind))) assert.ok(item.y>obstacle.top+40 && item.y<obstacle.bottom-40);
            }
            for (const hawk of hawks) assert.ok(hawk.warning>=1.7);
        }
    }
});

test('wrong answers end distinctly; a correct final answer can win', () => {
    const wrong = flight(); wrong.fruits=1; wrong.collect({kind:'fruit',x:0,y:0}); wrong.answer(!wrong.question.answer); wrong.continueQuiz();
    assert.equal(wrong.state,'ended'); assert.equal(wrong.won,false); assert.match(wrong.reason,/resposta/);
    const right = flight(); right.score=198; right.fruits=1; right.collect({kind:'fruit',x:0,y:0});
    assert.equal(right.state,'quiz'); right.answer(right.question.answer); right.continueQuiz();
    assert.equal(right.state,'ended'); assert.equal(right.won,true);
});

test('desktop and portrait routes are flyable through the full progression', () => {
    for (const width of [296, 960]) {
        const game = new Game({width, random:()=>.5}); game.state='playing';
        let sawSnake=false, sawHawk=false, sawDive=false;
        for (let i=0;i<180/STEP;i++) {
            if (game.y>332 && game.vy>0 && game.flapCooldown<=0) {game.press();game.release();}
            if (game.state==='quiz') {game.answer(game.question.answer);game.continueQuiz();}
            game.tick(STEP);
            sawSnake ||= game.entities.some(e=>e.snake);
            sawHawk ||= game.entities.some(e=>e.kind==='hawk');
            sawDive ||= game.entities.some(e=>e.dive);
            if (game.state==='ended') break;
        }
        assert.equal(game.won,true,`width ${width}: ${game.reason}`);
        assert.ok(sawSnake && sawHawk && sawDive);
        assert.ok(game.fruits>10 && game.correct>5);
    }
});

test('a solo hawk waits for wood to clear, then holds the next encounter', () => {
    const game=flight({random:()=>.5}); game.elapsed=50; game.sequence=13;
    game.entities=[wood(game,{x:game.x+70})]; game.spawn();
    assert.equal(game.entities.filter(e=>e.kind==='hawk').length,0);
    assert.equal(game.sequence,13);
    game.entities=[]; game.spawn();
    assert.equal(game.entities.filter(e=>e.kind==='hawk').length,1);
    const sequence=game.sequence; game.spawn(); assert.equal(game.sequence,sequence);
});
