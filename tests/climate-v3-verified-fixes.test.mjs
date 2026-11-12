import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP} from '../Chaua-Educa-main/js/engine.mjs';
import {ASSET_PATHS,images} from '../Chaua-Educa-main/js/assets.mjs';
import {drawTreeVariant} from '../Chaua-Educa-main/js/tree-art.mjs';
import {hawkAction} from '../Chaua-Educa-main/js/action-states.mjs';

test('240Hz visual interpolation moves particles and score popups without touching simulation',()=>{
 const game=new Game({seed:104});
 game.state='playing';game.nextSpawn=Infinity;
 game.particle({x:100,y:250,vx:120,vy:-60,life:.75,maxLife:.75,rotation:.3,spin:3,feather:true,color:'#fff'});
 game.popups.push({x:320,y:180,text:'+10',gold:false,life:.8});
 const before=JSON.stringify(game);
 game.advanceEffects(STEP);
 const currentParticle={...game.particles[0]},currentPopup={...game.popups[0]};
 const simulation=JSON.stringify(game);
 const v0=game.visual(0),x0=v0.particles[0].x,y0=v0.popups[0].y;
 const v25=game.visual(.25),x25=v25.particles[0].x;
 const v50=game.visual(.5),x50=v50.particles[0].x,y50=v50.popups[0].y;
 const v75=game.visual(.75),x75=v75.particles[0].x;
 const v100=game.visual(1),x100=v100.particles[0].x;
 assert.equal(x0,100);
 assert.equal(x100,currentParticle.x);
 assert.ok(Math.abs(x25-(100+(currentParticle.x-100)*.25))<1e-10);
 assert.ok(Math.abs(x50-(100+(currentParticle.x-100)*.5))<1e-10);
 assert.ok(Math.abs(x75-(100+(currentParticle.x-100)*.75))<1e-10);
 assert.ok(Math.abs(y0-180)<1e-10);
 assert.ok(Math.abs(y50-(180+(currentPopup.y-180)*.5))<1e-10);
 assert.equal(JSON.stringify(game),simulation,'render interpolation mutated real physics');
 assert.notEqual(before,simulation,'effects never advanced');
});

test('gavião keeps the same real flight atlas across the crossing to leaving boundary',()=>{
 const crossing=hawkAction({id:13,warning:0,dive:false,phase:'crossing'},2.5,false);
 const leaving=hawkAction({id:13,warning:0,dive:false,phase:'leaving'},2.5,false);
 assert.ok(crossing);
 assert.ok(leaving);
 assert.equal(crossing.sheet,'hawk-flight');
 assert.deepEqual(crossing,leaving,'gavião switched to a mismatched legacy sheet at x=player');
 assert.equal(hawkAction({dive:true,phase:'leaving',warning:0},2.5,false),null,
  'inclined dive must continue using its established original art');
});

test('unused winter textures stop loading, but all authored overlays and shedding remain available',()=>{
 for(const kind of ['lower','upper']){
  assert.equal(ASSET_PATHS[`trees-${kind}-snow`],undefined);
  for(const i of [1,2,3])assert.equal(ASSET_PATHS[`trees-${kind}-snow-0${i}`],undefined);
  assert.ok(ASSET_PATHS[`trees-${kind}-snow-04`]);
  for(const i of [1,2,3,4])assert.ok(ASSET_PATHS[`trees-${kind}-overlay-0${i}`]);
 }
 for(let i=0;i<6;i++)assert.ok(ASSET_PATHS[`trees-upper-shedding-0${i}`],
  'do not silently remove still-used winter falloff textures');
});

test('snow in variant trunks is painted on lower exposed cap once, not tiled along bark or inverted onto ceiling',t=>{
 const previous=new Map(images);
 t.after(()=>{images.clear();for(const [k,v] of previous)images.set(k,v)});
 const base={id:'base'},snow={id:'snow'};
 images.set('tree-variants',base);images.set('tree-variants-snow',snow);
 const draws=[];
 const ctx=new Proxy({}, {get(_,key){
  if(key==='drawImage')return (...args)=>draws.push(args);
  if(key==='createLinearGradient')return ()=>({addColorStop(){}});
  return ()=>{};
 },set(){return true;}});
 drawTreeVariant(ctx,400,190,false,'rot',undefined,1,0,0);
 const lower=draws.filter(args=>args[0]===snow);
 assert.equal(lower.length,1,'do not repeat snow bark strip over the entire trunk');
 draws.length=0;
 drawTreeVariant(ctx,400,190,true,'rot',undefined,1,0,0);
 const upper=draws.filter(args=>args[0]===snow);
 assert.equal(upper.length,0,'rotated cut-face snow would stick to the underside of hanging trees');
});
