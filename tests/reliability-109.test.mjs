import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import DB from '../Chaua-Educa-main/js/database.js';
import {loadImage} from '../Chaua-Educa-main/js/image-loader.mjs';
let stored;
beforeEach(()=>{stored=new Map();globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};DB.memory=new Map();DB.unsavedKeys=new Set();DB.storageAvailable=true;DB.onStorageChange=null;});
test('storage events invalidate clean snapshots so sequential tabs retain other players',()=>{
 DB.upsertPlayerScore('Ana',40);const external=JSON.parse(stored.get(DB.dbName));external.push({playerName:'Bia',score_val:50,mode:'aventura'});stored.set(DB.dbName,JSON.stringify(external));
 DB.invalidateStorage(DB.dbName);DB.upsertPlayerScore('Ana',45);
 assert.deepEqual(DB.get().map(r=>[r.playerName,r.score_val]),[['Bia',50],['Ana',45]]);
});
test('quota failures retain session progress through external updates and clearing events',()=>{
 DB.upsertPlayerScore('Ana',40);globalThis.localStorage.setItem=()=>{throw Error('quota');};DB.upsertPlayerScore('Ana',80);
 DB.invalidateStorage(DB.dbName);DB.invalidateStorage(null);assert.equal(DB.get()[0].score_val,80);assert.equal(DB.storageAvailable,false);
});
test('already read progress survives a later denied read; availability changes are observable',()=>{
 stored.set('chaua-tutorial-v1','true');assert.equal(DB.tutorialCompleted(),true);
 const notices=[];DB.onStorageChange=v=>notices.push(v);globalThis.localStorage.getItem=()=>{throw Error('blocked');};DB.readObject('new-key',null);
 assert.equal(DB.tutorialCompleted(),true);assert.deepEqual(notices,[false]);
 DB.writeObject('new-key',42);assert.equal(DB.storageAvailable,true);assert.deepEqual(notices,[false,true]);
});
test('invalid score updates cannot destroy existing or legacy progress',()=>{
 DB.upsertPlayerScore('Ana',40);stored.set('db-chaua','[{"playerName":"Pioneiro","score_val":777}]');const current=stored.get(DB.dbName),legacy=stored.get('db-chaua');
 for(const score of [NaN,Infinity,-1,4.5,Number.MAX_SAFE_INTEGER+1])assert.equal(DB.upsertPlayerScore('Ana',score),false);
 for(const name of [null,{},'a','x'.repeat(25)])assert.equal(DB.upsertPlayerScore(name,80),false);
 assert.equal(DB.upsertPlayerScore('Ana',80,'invalid'),false);assert.equal(stored.get(DB.dbName),current);assert.equal(stored.get('db-chaua'),legacy);
 assert.doesNotThrow(()=>DB.missionProgress(null));assert.doesNotThrow(()=>DB.advanceMissions(null,{type:'fruit'}));assert.equal(DB.chapterCheckpoint(null),null);
});
test('image transfer and decoder hangs time out and detach callbacks',async()=>{
 const instances=[];globalThis.Image=class{constructor(){instances.push(this);}naturalWidth=10;naturalHeight=10;set src(v){if(v==='decode')queueMicrotask(()=>this.onload?.());}decode(){return new Promise(()=>{});}};
 await assert.rejects(loadImage('transfer',{timeoutMs:10}),/tempo limite/);await assert.rejects(loadImage('decode',{timeoutMs:10}),/tempo limite/);
 assert.ok(instances.every(i=>i.onload===null&&i.onerror===null));delete globalThis.Image;
});
test('invalid dimensions and decoder rejection cannot publish an image',async()=>{
 globalThis.Image=class{naturalWidth=10;naturalHeight=10;set src(v){if(v)queueMicrotask(()=>this.onload?.());}decode(){return Promise.reject(Error('decode'));}};
 await assert.rejects(loadImage('invalid',{width:20}),/dimensões/);await assert.rejects(loadImage('invalid'),/decodificação/);delete globalThis.Image;
});
test('failed action batches do not leak late successes; coalesced retry loads the complete art',async()=>{
 const {preloadActionSheets,hasActionSheet,ACTION_SHEET_DEFS}=await import('../Chaua-Educa-main/js/action-sheets.mjs?reliability109');
 let first=true;const late=[];globalThis.Image=class{
  set src(v){if(!v)return;const [key,def]=Object.entries(ACTION_SHEET_DEFS).find(([,d])=>v.endsWith(d.path.slice(2)));this.naturalWidth=def.columns*def.cell;this.naturalHeight=def.rows*def.cell;
   if(first){if(key==='hawk-flight')queueMicrotask(()=>this.onerror?.());else late.push(()=>this.onload?.());}else queueMicrotask(()=>this.onload?.());}
 };
 const a=preloadActionSheets();assert.equal(a,preloadActionSheets());await assert.rejects(a,/hawk-flight/);
 for(const callback of late)callback();await Promise.resolve();assert.ok(Object.keys(ACTION_SHEET_DEFS).every(k=>!hasActionSheet(k)));
 first=false;await preloadActionSheets();assert.ok(Object.keys(ACTION_SHEET_DEFS).every(hasActionSheet));delete globalThis.Image;
});
