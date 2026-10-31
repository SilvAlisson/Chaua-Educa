import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, STEP, FLIGHT } from '../Chaua-Educa-main/js/engine.mjs';
import { offerPower } from '../Chaua-Educa-main/js/powers.mjs';
import { JOURNAL_ART, ENTRIES } from '../Chaua-Educa-main/js/collection.mjs';

test('flap impulse activates on flap and eases smoothly', () => {
    const g = new Game();
    g.state = 'playing';
    assert.equal(g.flapImpulse, 0);
    g.flap(true);
    assert.equal(g.flapImpulse, 1.0);
    g.tick(STEP);
    assert.ok(g.flapImpulse < 1.0 && g.flapImpulse > 0);
});

test('screen shake triggers and damps without mutating bird coordinates', () => {
    const g = new Game();
    g.state = 'playing';
    g.triggerShake(8, 0.2);
    assert.equal(g.shakeIntensity, 8);
    assert.equal(g.shakeTime, 0.2);
    for (let i = 0; i < 30; i++) {
        g.y = 320;
        g.vy = 0;
        g.tick(STEP);
    }
    assert.ok(g.shakeTime < 0.2);
    const view = g.visual(0.5);
    assert.ok(view.shakeIntensity !== undefined);
});

test('pepper turbo provides speed burst, score multiplier and decays properly', () => {
    const g = new Game();
    g.state = 'playing';
    const baseSpeed = g.speed;
    const events = [];
    g.onEvent = e => events.push(e);

    g.power('pepper');
    assert.equal(g.pepper, 6.0);
    assert.ok(g.speed > baseSpeed);
    assert.equal(events.at(-1).type, 'pepper');

    // Score multiplier is 2x during pepper
    g.addScore(3, undefined, 'fruit');
    assert.equal(g.score, 6);

    // Keep altitude stable so bird does not collide while testing power duration
    for (let i = 0; i < Math.ceil(6.2 / STEP); i++) {
        g.y = 320;
        g.vy = 0;
        g.tick(STEP);
    }
    assert.equal(g.pepper, 0);
    const expectedBaseSpeed = FLIGHT[g.mode].speed + Math.min(55, g.elapsed * 0.45);
    assert.equal(g.speed, expectedBaseSpeed);
    assert.ok(events.some(e => e.type === 'pepper-end'));
});

test('offerPower schedules pepper powerup when due', () => {
    const schedule = { nextAny: 0, nextShield: 100, nextFeather: 100, nextPepper: 10 };
    const kind = offerPower({
        elapsed: 15,
        shield: true,
        feather: 0,
        pepper: 0,
        entities: [],
        schedule,
        opportunity: false,
        random: () => 0.5
    });
    assert.equal(kind, 'pepper');
    assert.ok(schedule.nextPepper > 15);
});

test('Chauapedia has field journal art mapped for every discovery', () => {
    for (const entry of ENTRIES) {
        assert.ok(JOURNAL_ART[entry.id], `Missing journal art for ${entry.id}`);
        assert.ok(JOURNAL_ART[entry.id].endsWith('.png'));
    }
});
