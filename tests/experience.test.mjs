import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,FLIGHT} from '../Chaua-Educa-main/js/engine.mjs';
import {flightViewport} from '../Chaua-Educa-main/js/viewport.mjs';
import {snakeHeadRect} from '../Chaua-Educa-main/js/geometry.mjs';
import {planEncounter} from '../Chaua-Educa-main/js/encounters.mjs';
import {pilotTarget} from './helpers/pilot.mjs';
import DB from '../Chaua-Educa-main/js/database.js';

test('actual portrait viewport exposes at least 1.65s of predator reaction distance',()=>{
    for(const [w,h]of [[320,568],[390,844],[430,932],[768,1024],[844,390]]){
        const v=flightViewport(w,h),visible=v.w/v.scale;
        assert.ok(Math.abs(visible-v.worldWidth)<1e-8);
        const seconds=(v.worldLeft+visible-220-50)/350;
        assert.ok(seconds>=1.65,`${w}×${h}: only ${seconds}s`);
    }
});
test('safe areas of arbitrary sizes use the same layout rules without test-specific branches',()=>{
    for(const top of [0,12,23,24,25,47]){
        const v=flightViewport(390,844,{top,bottom:20,left:7,right:7});
        assert.ok(v.y>=top+124);assert.ok(v.y+v.h<=844-20-104+.001);
        assert.ok(Math.abs(v.w/v.scale-v.worldWidth)<1e-8);
    }
});
test('window changes do not move the player inside physical encounters',()=>{
    const g=new Game();g.state='playing';const x=g.x;
    for(const width of [960,1800,3000]){g.viewWidth=width;assert.equal(g.x,x);}
});
test('snake head collider follows the actual source crop on trunks and branches',()=>{
    const wood={x:400,bottom:420,snake:{retreat:false}};
    for(let age=0;age<2;age+=.05){
        wood.snake.age=age;const r=snakeHeadRect(wood);
        assert.ok(r.x>wood.x-75&&r.x+r.w<wood.x+70);
        assert.ok(r.y>wood.bottom-135&&r.y+r.h<wood.bottom+20);
        assert.ok(r.w>5&&r.h>5);
    }
    wood.snake.branch=true;const branch=snakeHeadRect(wood);
    assert.ok(branch.x<wood.x&&branch.y<wood.bottom+30);
});
test('branch encounter really spawns branch art, a branch collider and its snake',()=>{
    const g=new Game({seed:104});g.elapsed=40;g.sequence=2;
    let found=false;
    for(let i=0;i<70;i++){
        g.entities=[];g.spawn();const wood=g.entities.find(e=>e.kind==='wood'&&e.variant==='branch');
        if(wood){found=true;assert.ok(wood.snake?.branch);assert.ok(g.woodRects(wood).some(r=>r.x<wood.x));}
    }
    assert.ok(found,'previous branch pattern never set variant=branch');
});
test('friendly mode has measurably wider gaps and slower encounter cadence throughout the journey',()=>{
    for(const elapsed of [0,30,60,120]){
        const opts={sequence:Math.floor(elapsed/2),elapsed,lastCenter:320,lastPattern:null,random:()=>.2};
        const challenge=planEncounter({...opts,profile:FLIGHT.aventura,speed:245});
        const friendly=planEncounter({...opts,profile:FLIGHT.tranquilo,speed:205});
        assert.ok(friendly.gap-challenge.gap>=35);
        assert.ok(friendly.interval-challenge.interval>=.35);
    }
    assert.ok(FLIGHT.tranquilo.warning>FLIGHT.aventura.warning);
    assert.ok(FLIGHT.tranquilo.hawkAt>FLIGHT.aventura.hawkAt);
});
test('announced hawk lanes are real hazards and never retarget after spawning',()=>{
    const g=new Game({random:()=>.5});g.state='playing';g.y=320;g.elapsed=60;g.sequence=13;g.spawn();
    const hawk=g.entities.find(e=>e.kind==='hawk');assert.equal(hawk.startY,320);
    const lane=[hawk.startY,hawk.targetY,hawk.targetX];g.y=190;
    for(let i=0;i<60;i++) {g.y=190;g.vy=0;g.nextSpawn=Infinity;g.tick(STEP);}
    assert.deepEqual([hawk.startY,hawk.targetY,hawk.targetX],lane);
});
test('both difficulties remain playable with 120ms reaction and 30Hz decisions, without powers',()=>{
    for(const mode of ['aventura','tranquilo'])for(let seed=0;seed<12;seed++){
        const g=new Game({seed});g.reset(mode);g.state='playing';g.visibleRight=850;let nextDecision=0,pending=null;
        for(let i=0;i<200/STEP;i++){
            g.entities=g.entities.filter(e=>e.kind==='wood'||e.kind==='hawk');
            if(g.elapsed>=nextDecision&&g.state==='playing'){
                nextDecision=g.elapsed+1/30;
                const target=pilotTarget(g),predict=g.y+g.vy*.12+450*.12**2;
                if(pending===null&&predict>target+10&&g.vy>0)pending=g.elapsed+.12;
            }
            if(pending!==null&&g.elapsed>=pending){g.press();g.release();pending=null;}
            g.tick(STEP);
            if(g.state==='ended')break;
        }
        assert.equal(g.won,true,`${mode} seed ${seed}: ${g.reason}, ${g.elapsed.toFixed(1)}s`);
        assert.equal(g.fruits,0);assert.equal(g.shield,false);
    }
});
test('difficulty revision archives previous scores instead of mixing incompatible runs',()=>{
    const data=new Map([['db-chaua-floresta-v4',JSON.stringify([{playerName:'Ana',score_val:400,mode:'tranquilo'}])]]);
    globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};DB.memory=new Map();DB.storageAvailable=true;
    assert.ok(DB.previousScores().some(p=>p.ruleset==='floresta-v4'&&p.score_val===400));
    DB.upsertPlayerScore('Ana',50,'tranquilo');assert.equal(DB.get()[0].score_val,50);
    assert.equal(JSON.parse(data.get('db-chaua-floresta-v4'))[0].score_val,400);
});
