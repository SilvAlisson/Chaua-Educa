import {journeyLength} from '../Chaua-Educa-main/js/journey.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,FLIGHT} from '../Chaua-Educa-main/js/engine.mjs';
import {flightViewport} from '../Chaua-Educa-main/js/viewport.mjs';
import {snakeA2HeadRect as snakeHeadRect} from '../Chaua-Educa-main/js/snake-a2.mjs';
import {planEncounter} from '../Chaua-Educa-main/js/encounters.mjs';
import {pilotTarget} from './helpers/pilot.mjs';
import DB from '../Chaua-Educa-main/js/database.js';

test('marked predator routes provide at least 1.65s to evade across real speed and turbo budgets',async()=>{
 const {advanceHawk}=await import('../Chaua-Educa-main/js/animals.mjs');
 const {hawkShapes,playerShapes,shapesIntersect}=await import('../Chaua-Educa-main/js/collision.mjs');
 for(const [w,h]of [[320,568],[390,844],[430,932],[768,1024],[844,390]])
 for(const mode of ['aventura','tranquilo'])for(const elapsed of [80,180,350,720])for(const pepper of [0,6])for(let pattern=0;pattern<3;pattern++){
  const v=flightViewport(w,h),g=new Game({seed:104});g.reset(mode);
  g.state='playing';g.elapsed=elapsed;g.distance=journeyLength(mode)*Math.min(1,elapsed/360);
  g.y=320;g.pepper=pepper;g.sequence=1;g.hawkSequence=pattern;
  g.viewWidth=Math.max(960,v.worldLeft+v.worldWidth);g.spawn();
  const hawk=g.entities.find(e=>e.kind==='hawk');assert.ok(hawk);
  let t=0,marked=null,hit=null;const player=playerShapes(g.x,g.y);
  for(;t<20;t+=STEP){
   advanceHawk(hawk,STEP,g.speed,g.x,g.y);
   if(hawk.targetLocked&&marked===null)marked=t;
   if(hawk.warning<=0&&Math.abs(hawk.x-g.x)<180&&shapesIntersect(player,hawkShapes(hawk))){hit=t;break;}
  }
  assert.notEqual(marked,null);assert.notEqual(hit,null,'the marked route must be a real contact threat');
  assert.ok(hit-marked>=1.65,`${w}×${h}/${mode}/${elapsed}/turbo=${pepper}: ${hit-marked}s`);
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
    let found=false;
    // Pattern probabilities changed in v14: verify actual branch encounters
    // across fixed seeds rather than requiring one historical RNG trace.
    for(let seed=0;seed<8;seed++){
        const g=new Game({seed});g.elapsed=40;g.sequence=2;
        for(let i=0;i<70;i++){
            g.entities=[];g.spawn();const wood=g.entities.find(e=>e.kind==='wood'&&e.variant==='branch'&&e.snake);
            if(wood){found=true;assert.ok(wood.snake?.branch);assert.ok(g.woodRects(wood).some(r=>r.x<wood.x));}
        }
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
test('announced hawk snapshots the lane once with time to evade and never homes after lock',()=>{
    const g=new Game({random:()=>.5});g.state='playing';g.y=320;g.elapsed=60;g.sequence=13;g.spawn();
    const hawk=g.entities.find(e=>e.kind==='hawk');assert.equal(hawk.startY,105);
    g.nextSpawn=Infinity;
    while(!hawk.targetLocked){g.y=190;g.vy=0;g.tick(STEP);}
    assert.ok(hawk.warning>=1.08);assert.ok(Math.abs(hawk.targetY-190)<.1);
    for(let i=0;i<120;i++){g.y=450;g.vy=0;g.tick(STEP);}
    assert.ok(Math.abs(hawk.targetY-190)<.1);assert.equal(hawk.attackX,220);
});
test('both difficulties remain playable with 120ms reaction and 30Hz decisions, without powers',()=>{
    for(const mode of ['aventura','tranquilo'])for(let seed=0;seed<12;seed++){
        const g=new Game({seed});g.reset(mode);g.state='playing';g.visibleRight=850;let nextDecision=0,pending=null;
        for(let i=0;i<600/STEP;i++){
            g.entities=g.entities.filter(e=>e.kind==='wood'||e.kind==='hawk');
            if(g.elapsed>=nextDecision&&g.state==='playing'){
                nextDecision=g.elapsed+1/30;
                const target=pilotTarget(g),predict=g.y+g.vy*.12+450*.12**2;
                if(pending===null&&predict>target+12&&g.vy>0)pending=g.elapsed+.12;
            }
            if(pending!==null&&g.elapsed>=pending){g.press();g.release();pending=null;}
            g.tick(STEP);
            if(g.state==='ended'||g.distance>=journeyLength(g.mode))break;
        }
        assert.equal(g.distance,journeyLength(g.mode),`${mode} seed ${seed}: ${g.reason}, ${g.elapsed.toFixed(1)}s`);
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
