import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import DB from '../Chaua-Educa-main/js/database.js';

let stored;
beforeEach(()=>{
    stored=new Map();
    globalThis.localStorage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)};
    DB.memory=new Map(); DB.storageAvailable=true;
});

test('v2 records never modify or mix the legacy results',()=>{
    const original=JSON.stringify([{playerName:'Pioneiro',score_val:777}]);
    stored.set('db-chaua',original); DB.upsertPlayerScore('Novo',20,'aventura');
    assert.equal(stored.get('db-chaua'),original);
    assert.equal(DB.get()[0].playerName,'Novo'); assert.equal(DB.get(true)[0].playerName,'Pioneiro');
});

test('each player keeps only their best score per mode',()=>{
    assert.equal(DB.upsertPlayerScore('Asas',40,'aventura'),true);
    assert.equal(DB.upsertPlayerScore('Asas',25,'aventura'),false);
    assert.equal(DB.upsertPlayerScore('Asas',45,'aventura'),true);
    DB.upsertPlayerScore('Asas',10,'tranquilo');
    assert.deepEqual(DB.get().map(p=>[p.mode,p.score_val]),[['aventura',45],['tranquilo',10]]);
});

test('blocked storage keeps scores and best-score updates in session memory',()=>{
    globalThis.localStorage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
    DB.upsertPlayerScore('Asas',40); DB.upsertPlayerScore('Asas',25);
    assert.equal(DB.storageAvailable,false); assert.equal(DB.get()[0].score_val,40);
});

test('a full storage quota also preserves new scores in session memory',()=>{
    globalThis.localStorage.setItem=()=>{throw Error('quota');};
    DB.upsertPlayerScore('Asas',40); assert.equal(DB.get()[0].score_val,40);
});

test('malformed or incompatible saved data cannot prevent the game from opening',()=>{
    stored.set(DB.dbName,'not json'); assert.deepEqual(DB.get(),[]);
    DB.storageAvailable=true; stored.set(DB.dbName,JSON.stringify([{playerName:'bad',score_val:'100'},null,{playerName:'Valid',score_val:10}]));
    assert.deepEqual(DB.get(),[{playerName:'Valid',score_val:10}]);
});
