import test from 'node:test';
import assert from 'node:assert/strict';
import {QUESTIONS,SOURCES,CONTENT_REVIEWED} from '../Chaua-Educa-main/js/questions.mjs';
import {ENTRIES,discoveriesFor} from '../Chaua-Educa-main/js/collection.mjs';
import DB from '../Chaua-Educa-main/js/database.js';

test('question bank has unique IDs, explanations, sources and reachable collection entries',()=>{
 assert.equal(QUESTIONS.length,24);
 assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,24);
 for(const q of QUESTIONS){
  assert.equal(typeof q.answer,'boolean');assert.ok(q.explanation.length>20);
  assert.ok(SOURCES[q.source]);assert.ok(ENTRIES.some(e=>e.id===q.entry));
  assert.equal(q.reviewed,CONTENT_REVIEWED);
 }
 for(const id of ['habitat','pantanal','alagoas','cientifico','captura','floresta','protecao','todos'])assert.ok(QUESTIONS.some(q=>q.id===id));
});
test('both right and wrong answers unlock knowledge, collisions never do',()=>{
 for(const q of QUESTIONS){
  assert.deepEqual(discoveriesFor({type:'correct',questionId:q.id}),[q.entry]);
  assert.deepEqual(discoveriesFor({type:'incorrect',questionId:q.id}),[q.entry]);
 }
 assert.deepEqual(discoveriesFor({type:'shield-break'}),[]);
 assert.deepEqual(discoveriesFor({type:'incorrect',questionId:'unknown'}),[]);
 assert.deepEqual(discoveriesFor({type:'stage',stage:1}),['habitat','arvores']);
 assert.deepEqual(discoveriesFor({type:'stage',stage:2}),['conservacao']);
});
test('collection preserves legacy fruit unlocks, reloads, filters corrupt IDs and survives quota failure',()=>{
 const stored=new Map([['chaua-educa-v2',JSON.stringify({unlocked:['Goiaba']})]]);
 globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
 DB.memory=new Map();DB.storageAvailable=true;
 assert.ok(DB.discoveredEntries().includes('alimentos'));
 DB.discoverEntries(['arvores','unknown','arvores']);DB.memory=new Map();
 assert.equal(DB.discoveredEntries().filter(id=>id==='arvores').length,1);
 assert.ok(!DB.discoveredEntries().includes('unknown'));
 assert.deepEqual(DB.unlocked(),['Goiaba']);
 globalThis.localStorage.setItem=()=>{throw Error('quota');};
 DB.discoverEntries(['conservacao']);assert.ok(DB.discoveredEntries().includes('conservacao'));
 stored.set('chaua-nature-discoveries','{}');DB.memory=new Map();
 assert.ok(DB.discoveredEntries().includes('chaua'));
});
