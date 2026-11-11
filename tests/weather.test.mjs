import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY } from '../Chaua-Educa-main/js/journey.mjs';
import { Game } from '../Chaua-Educa-main/js/engine.mjs';
import { journeyRain } from '../Chaua-Educa-main/js/weather.mjs';

test('rain fades in and out within the ancient trees stretch', () => {
    const start = JOURNEY[1].start - 1500;
    const end = JOURNEY[1].start + 3800;
    const values = [start, start + 900, start + 1800, end - 1800, end - 900, end];
    assert.deepEqual(values.map(distance => journeyRain(distance)), [0, .5, 1, 1, .5, 0]);
    assert.equal(journeyRain(start + 1800, true), 0);
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

test('fatal fragile-tree impact does not retain contact against destroyed wood',()=>{
 const g=new Game();g.state='playing';
 const e={id:1,kind:'wood',x:g.x+10,top:160,bottom:440,fragileSide:'bottom',fragileKind:'hollow',hitSide:'bottom',hitRect:{x:g.x-16,y:440,w:110,h:200}};
 g.entities=[e];g.collide(e);assert.equal(e.brokenSide,'bottom');assert.equal(g.impactContact,null);
});
