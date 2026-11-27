import test from 'node:test';
import assert from 'node:assert/strict';
import {FOODS} from '../Chaua-Educa-main/js/foods.mjs';
import {drawFood,prewarmFoodArt} from '../Chaua-Educa-main/js/food-art.mjs';

// DOM-dependent raster comparisons run in browser-pickup-weather-cache.cjs.
// Ensure the module is safe to import in Node before any image has loaded.
test('frozen artwork is an optional prewarm, without changing the twelve-food catalog',()=>{
 assert.equal(prewarmFoodArt(),false);
 assert.equal(FOODS.length,12);
 assert.ok(FOODS.every(f=>typeof f.slot==='number'));
 assert.equal(typeof drawFood,'function');
});
