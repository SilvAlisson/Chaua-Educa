import test from 'node:test';
import assert from 'node:assert/strict';
import {images} from '../Chaua-Educa-main/js/assets.mjs';
import {drawBirdRig,drawSnakeRig} from '../Chaua-Educa-main/js/art-v11.mjs';
test('articulated characters draw one body/head and never full-character cells',()=>{
 const calls=[];
 const c=new Proxy({drawImage(image,x,y,...rest){assert.ok([x,y,...rest].every(Number.isFinite));calls.push(Math.floor(y/256)*4+Math.floor(x/256));}},{get:(o,k)=>o[k]??(()=>{})});
 for(const name of ['parrot','hawk','snake'])images.set('v11-'+name,{});
 try{
  for(let i=0;i<120;i++)for(const name of ['parrot','hawk']){
   calls.length=0;assert.equal(drawBirdRig(c,name,{time:i/60,wing:(i%30)/30,reduced:i===0}),true);
   assert.deepEqual([...calls].sort((a,b)=>a-b),[8,11,12,13,15]);
  }
  for(const phase of ['watching','warning','windup','striking','recovering','spent']){
   calls.length=0;drawSnakeRig(c,{phase,phaseAge:.1,warningAge:.4,age:1},.52);
   assert.equal(calls.length,3);assert.equal(calls[0],8);assert.equal(calls[1],9);assert.ok([10,11].includes(calls[2]));
  }
 }finally{for(const name of ['parrot','hawk','snake'])images.delete('v11-'+name);}
});
