import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../Chaua-Educa-main/js/engine.mjs';

test('fruit corridor never inverts or overlaps tree clearance in late snake encounters',()=>{
 let checked=0;
 for(const mode of ['aventura','tranquilo'])for(let seed=0;seed<80;seed++){
  const g=new Game({seed});g.reset(mode);
  for(let n=0;n<70;n++){
   g.elapsed=n*3;g.entities=[];g.sequence=n;g.nextSpawn=0;g.spawn();
   const wood=g.entities.find(e=>e.kind==='wood'&&e.snake);
   if(!wood)continue;
   const top=wood.top+55,bottom=wood.bottom-200;
   assert.ok(top<=bottom+1e-8,mode+' seed '+seed+' n='+n+' inverted '+top+'..'+bottom);
   for(const fruit of g.entities.filter(e=>e.kind==='fruit')){
    assert.ok(fruit.y>=top-1e-8&&fruit.y<=bottom+1e-8,
      mode+' seed '+seed+' n='+n+' fruit '+fruit.y+' outside '+top+'..'+bottom);
    checked++;
   }
  }
 }
 assert.ok(checked>500,'expected hundreds of late game cases; got '+checked);
});
