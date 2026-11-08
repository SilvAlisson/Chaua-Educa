import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY } from '../Chaua-Educa-main/js/journey.mjs';
import { Game } from '../Chaua-Educa-main/js/engine.mjs';
import { journeyRain, drawWeatherForeground } from '../Chaua-Educa-main/js/weather.mjs';

test('rain fades in and out within the ancient trees stretch', () => {
    const start = JOURNEY[1].start + 1500;
    const end = JOURNEY[2].start - 1000;
    const values = [start, start + 700, start + 1400, end - 1400, end - 700, end];
    assert.deepEqual(values.map(distance => journeyRain(distance)), [0, .5, 1, 1, .5, 0]);
    assert.equal(journeyRain(start + 1400, true), 0);
});

test('wind boosts scrolling smoothly and stays out of training', () => {
    const game = new Game();
    game.distance = JOURNEY[2].start;
    const calm = game.speed;
    game.distance += 2000;
    assert.equal(game.speed, calm * 1.06);
    game.tutorial = true;
    assert.equal(game.speed, calm);
});

test('a fragile trunk breaks only on the struck side and respects shield rules', () => {
    for (const shield of [true, false]) {
        const game = new Game();
        game.state = 'playing';
        game.shield = shield;
        const tree = {id: 1, kind: 'wood', x: 240, top: 190, bottom: 440,
            fragileKind: 'hollow', fragileSide: 'bottom', hitSide: 'bottom'};
        game.entities = [tree];
        game.collide(tree);
        assert.equal(tree.brokenSide, 'bottom');
        assert.deepEqual(game.woodRects(tree).map(rect => rect.y), [0]);
        assert.equal(game.state, shield ? 'playing' : 'impact');
        assert.equal(game.shield, false);
    }
});

test('foreground rain is screen-space, disabled for reduced motion, and bounded',()=>{
 let lines=0;
 const c=new Proxy({},{get(target,key){if(key==='lineTo')return ()=>{lines++;};return ()=>{};},set(target,key,v){target[key]=v;return true;}});
 drawWeatherForeground(c,800,600,10,0,0,0,false,false);
 drawWeatherForeground(c,800,600,10,1,1,1,true,false);
 assert.equal(lines,0);
 drawWeatherForeground(c,800,600,10,1,1,1,false,false);
 assert.equal(lines,44);
 lines=0;
 drawWeatherForeground(c,800,600,10,1,1,1,false,true);
 assert.equal(lines,18);
});
