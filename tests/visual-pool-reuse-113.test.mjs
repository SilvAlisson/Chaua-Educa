import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../Chaua-Educa-main/js/engine.mjs';

function primeVisual(game, entity) {
    game.entities = [entity];
    game.snapshot();
    game.entities[0].x -= 10;
    return game.visual(.5).entities[0];
}

test('recycled tree visual never retains art or impact fields from another ID', () => {
    const game = new Game({seed:104});
    game.state='playing';
    const previous=primeVisual(game,{
        id:41, kind:'wood', x:700, y:0, top:180, bottom:390,
        fragileSide:'bottom', fragileKind:'rot',
        decorSide:'top', decorKind:'moss', broken:true, brokenSide:'bottom',
        breakFx:{age:.2}, dryBranchBroken:true, hitPart:'dry-branch',
        snake:{phase:'striking', attackType:'sweep', age:2, specialVisualState:1}
    });
    assert.equal(previous.fragileKind,'rot');
    const next=primeVisual(game,{
        id:42, kind:'wood', x:700, y:0, top:200, bottom:430,
        variant:'plain'
    });
    for(const key of [
        'fragileSide','fragileKind','decorSide','decorKind','broken',
        'brokenSide','breakFx','dryBranchBroken','hitPart'
    ]) assert.equal(Object.hasOwn(next,key),false,`leaked ${key} from previous tree`);
    assert.equal(next.snake,undefined);
    assert.equal(next.kind,'wood');
    assert.equal(next.x,695);
});

test('recycled snake visual never retains attack fields from previous snake', () => {
    const game = new Game({seed:104});
    game.state='playing';
    primeVisual(game,{
        id:7,kind:'wood',x:700,y:0,top:170,bottom:430,
        snake:{kind:'snake',phase:'striking',attackType:'sweep',age:4,warningAge:2,extraPose:'stale'}
    });
    const next=primeVisual(game,{
        id:8,kind:'wood',x:700,y:0,top:170,bottom:430,
        snake:{kind:'snake',phase:'watching',age:0}
    });
    assert.equal(next.snake.phase,'watching');
    assert.equal(next.snake.age,0);
    for(const key of ['attackType','extraPose']) {
        assert.equal(Object.hasOwn(next.snake,key),false,`leaked ${key} from previous snake`);
    }
});
