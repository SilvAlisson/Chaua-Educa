import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SNAKE_A2_MASKS,SNAKE_A2_MASK_SOURCES} from '../Chaua-Educa-main/js/snake-a2-masks.mjs';
import {snakeA2HitsPlayer,snakeA2FruitHasClearance,snakeA2CollisionRects} from '../Chaua-Educa-main/js/snake-a2.mjs';
import {playerShapes} from '../Chaua-Educa-main/js/collision.mjs';

const files={idle:'base/idle.webp',attack:'attack/attack.webp',stunned:'reactions/stunned.webp'};
test('every A2 collision mask is tied to the exact official art SHA-256',()=>{
 for(const [key,filename] of Object.entries(files)){
  const bytes=readFileSync(new URL('../Chaua-Educa-main/public/snake/'+filename,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),SNAKE_A2_MASK_SOURCES[key],key);
  assert.equal(SNAKE_A2_MASKS[key].length,8);
  for(const cells of SNAKE_A2_MASKS[key]){
   assert.equal(cells.length,1024);
   assert.ok(cells.every(value=>value===0||value===1));
   assert.ok(cells.some(Boolean));
  }
 }
});

test('official A2 collision and fruit safety work before graphic decoding',()=>{
 const wood={kind:'wood',x:210,bottom:470,snake:{phase:'watching',age:0}};
 const rects=snakeA2CollisionRects(wood);
 assert.ok(rects.length>20);
 const {x,y,w,h}=rects.find(r=>r.y<wood.bottom-30&&r.w>10);
 const body=playerShapes(x+w/2,y+h/2);
 assert.equal(snakeA2HitsPlayer(wood,body),true);
 assert.equal(snakeA2FruitHasClearance(wood,x+w/2,y+h/2),false);
 wood.snake.retreat=true;
 assert.equal(snakeA2HitsPlayer(wood,body),false);
 assert.deepEqual(snakeA2CollisionRects(wood),[]);
});
