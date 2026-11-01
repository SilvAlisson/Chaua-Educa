import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, STEP } from '../Chaua-Educa-main/js/engine.mjs';
import { birdBlend, hawkBlend, impactPose, borderCells } from '../Chaua-Educa-main/js/motion.mjs';
import { Renderer, drawBird } from '../Chaua-Educa-main/js/render.mjs';
import { images } from '../Chaua-Educa-main/js/assets.mjs';

function weights({pose,next,blend}) {
    const result=[0,0,0,0];result[pose]+=1-blend;result[next]+=blend;return result;
}
function close(a,b,tolerance=1e-4){assert.ok(Math.abs(a-b)<tolerance,`${a} vs ${b}`);}
function recordingContext(){
    const draws=[],rotations=[],clips=[],stack=[];
    const context=new Proxy({globalAlpha:1},{
        get(target,key){
            if(key==='save')return ()=>stack.push(target.globalAlpha);
            if(key==='restore')return ()=>{target.globalAlpha=stack.pop();};
            if(key==='drawImage')return (image,...args)=>{assert.ok(args.every(Number.isFinite));draws.push({image,alpha:target.globalAlpha,args});};
            if(key==='rotate')return angle=>rotations.push(angle);
            if(key==='clip')return rule=>clips.push(rule);
            if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
            return target[key]??(()=>{});
        }
    });
    return {context,draws,rotations,clips};
}

test('bird and hawk blends remain continuous across every pose boundary',()=>{
    for(const wing of [.75,.5,.25,0]){
        const a=weights(birdBlend(wing+1e-8)),b=weights(birdBlend(wing-1e-8));
        a.forEach((value,i)=>close(value,b[i]));
    }
    for(const t of [0,.25,.5,.75,1]){
        // Positive whole cycle avoids the intentional static time=0 preview.
        const a=weights(hawkBlend((t+1-1e-8)/3.2)),b=weights(hawkBlend((t+1+1e-8)/3.2));
        a.forEach((value,i)=>close(value,b[i]));
    }
    assert.deepEqual(birdBlend(1,true),{pose:1,next:1,blend:0});
    assert.deepEqual(hawkBlend(10,{reduced:true}),{pose:0,next:0,blend:0});
});

test('impact starts at the exact flight anchor and settles without a full-body spin',()=>{
    assert.deepEqual(impactPose(0),{angle:-0,x:-0,y:0});
    assert.ok(Math.abs(impactPose(.001).angle)<.00001);
    assert.ok(Math.abs(impactPose(1).angle)<Math.PI/2);
    assert.deepEqual(impactPose(1,true),impactPose(0));
    for(let i=0;i<4;i++)images.set('chaua-atlas',{naturalWidth:1536,naturalHeight:1536});
    const a=recordingContext();drawBird(a.context,{x:10,y:20,defeated:true,impactProgress:0,angle:.1});
    assert.equal(a.rotations[0],.1);
});

test('world-indexed terrain keeps the same leaves through wrap and covers ultrawide views',()=>{
    const before=borderCells(179.99,180,0,2200),after=borderCells(180.01,180,0,2200);
    for(const leaf of before){const next=after.find(n=>n.index===leaf.index);if(next)close(leaf.x-next.x,.02);}
    assert.ok(after.at(-1).x>=2200);assert.ok(after[0].x<=0);
});

test('flight interpolation includes terrain, wings and animals without mutating physics',()=>{
    const g=new Game();g.state='playing';g.nextSpawn=Infinity;g.wing=.7;
    g.entities=[{id:1,kind:'hawk',x:700,y:240,retreat:true,dazed:true,tumbleAngle:0,fallVy:-170},
        {id:2,kind:'wood',x:900,top:180,bottom:440,snake:{retreat:true,retreatTime:.2}}];
    g.tick(STEP);const before=JSON.stringify(g);const v=g.visual(.5);
    close(v.distance,g.distance/2);close(v.sceneTime,g.sceneTime/2);
    close(v.wing,(.7+g.wing)/2);
    close(v.entities[0].tumbleAngle,g.entities[0].tumbleAngle/2);
    close(v.entities[1].snake.retreatTime,(.2+g.entities[1].snake.retreatTime)/2);
    assert.equal(JSON.stringify(g),before);
    g.pause();const time=g.sceneTime;g.tick(1);assert.equal(g.sceneTime,time);
    g.state='quiz';g.tick(1);assert.equal(g.sceneTime,time);
    g.state='playing';g.end(false,'impact',true);g.tick(STEP);assert.ok(g.sceneTime>time);
});

test('snake retreat never changes or fades the supporting procedural trunk',()=>{
    const r=Object.create(Renderer.prototype),kinds=[];
    r.c=recordingContext().context;r.trunk=(kind)=>kinds.push(kind);r.wood=()=>{};r.snake=()=>{};
    for(const retreatTime of [0,.5,1.5])r.obstacle({id:1,x:450,top:180,bottom:440,variant:'plain',snake:{retreat:true,retreatTime}},{elapsed:4},false);
    assert.equal(kinds.length,6);assert.deepEqual(kinds.slice(0,2),kinds.slice(2,4));assert.deepEqual(kinds.slice(0,2),kinds.slice(4,6));
});

test('reduced motion fixes the hawk pose and removes all tumble rotation',()=>{
    const r=Object.create(Renderer.prototype);images.set('hawk-atlas',{naturalWidth:1536,naturalHeight:1536});
    const capture=recordingContext();r.c=capture.context;
    r.hawk({x:400,y:320,retreat:true,dazed:true,tumbleAngle:9},0,true);
    assert.deepEqual(capture.rotations,[0]);
});

test('legacy hollow art no longer cuts a rectangular hole through the tree',()=>{
    const capture=recordingContext(),r=Object.create(Renderer.prototype);r.c=capture.context;r.trunk=()=>{};r.wood=()=>{};
    r.obstacle({id:3,x:400,top:200,bottom:440,variant:'hollow'},{elapsed:1},false);
    assert.equal(capture.clips.length,0);
});

test('pepper, feather and their combination apply consistently to fruit, route and quiz',()=>{
    for(const [feather,pepper,multiplier] of [[0,0,1],[5,0,2],[0,5,2],[5,5,4]]){
        const g=new Game();g.state='playing';g.feather=feather;g.pepper=pepper;g.nextSpawn=Infinity;
        g.routes.set(1,{total:2,collected:0,awarded:false,failed:false});
        for(let i=0;i<2;i++)g.collect({id:i,kind:'fruit',route:1,variety:0,x:400,y:300});
        assert.equal(g.score,(6+2)*multiplier);
        g.elapsed=30;assert.equal(g.maybeOpenQuiz(),true);assert.equal(g.quizMultiplier,multiplier);
        g.answer(g.question.answer);g.answer(g.question.answer);
        assert.equal(g.score,10*multiplier);assert.equal(g.correct,1);
    }
});

test('simultaneous fatal hazards stop scoring and emit one loss',()=>{
    const events=[],g=new Game({onEvent:e=>events.push(e)});g.state='playing';g.y=300;g.nextSpawn=Infinity;
    g.entities=[{id:1,kind:'wood',x:g.x,top:350,bottom:500},
        {id:2,kind:'fruit',x:g.x,y:g.y,variety:0},
        {id:3,kind:'hawk',x:g.x,y:g.y,startX:g.x,startY:g.y,targetX:0,targetY:g.y,warning:0}];
    g.tick(STEP);g.end(false,'another call');
    assert.equal(events.filter(e=>e.type==='lose').length,1);assert.equal(g.score,0);assert.equal(g.fruits,0);
});

test('stage palette starts smoothly and the recoiling hawk leaves without tumbling',async()=>{
    const g=new Game();g.state='playing';g.distance=6999.9;g.stageAge=40;g.y=300;g.nextSpawn=Infinity;
    g.tick(STEP);assert.equal(g.stage,1);assert.ok(g.visual(.1).stageAge<STEP*2);
    const {advanceHawk}=await import('../Chaua-Educa-main/js/animals.mjs');
    const hawk={x:400,y:300,retreat:true,dazed:true,fallVy:0};
    advanceHawk(hawk,.1,200,220);assert.equal(hawk.fallVy,0);assert.equal(hawk.tumbleAngle,0);assert.equal(hawk.y,293.4);assert.equal(hawk.x,415);
});
