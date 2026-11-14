import {FOOD_IDS} from './foods.mjs';
import { normalizeProgress, advanceProgress } from './missions.mjs';
import { activeProbe } from './perf-hooks.mjs';
import { ENTRIES, INITIAL_ENTRIES } from './collection.mjs';
export const RULES_VERSION = 'floresta-v11';
export default class DB {
    static dbName = `db-chaua-${RULES_VERSION}`;
    static storageAvailable = true;
    static memory = new Map();
    // Keep persistence synchronous and reliable until profiling establishes
    // whether these calls cause actual stutters. Measure without recording data
    // values, player names or personal history.
    static _readRaw(key) {
        const probe=activeProbe,t=probe?probe.begin('storage.read'):0;
        try{return localStorage.getItem(key);}
        finally{if(probe)probe.end('storage.read',t,{key});}
    }
    static _writeJSON(key,data) {
        const probe=activeProbe;
        let t=probe?probe.begin('storage.serialize'):0;
        const serialized=JSON.stringify(data);
        if(probe)probe.end('storage.serialize',t,{key,bytes:serialized.length});
        t=probe?probe.begin('storage.write'):0;
        try{localStorage.setItem(key,serialized);}
        finally{if(probe)probe.end('storage.write',t,{key,bytes:serialized.length});}
    }

    static get(legacy = false) {
        const key = legacy ? 'db-chaua' : this.dbName;
        let rows;
        try {rows=!this.storageAvailable&&this.memory.has(key)?this.memory.get(key):JSON.parse(this._readRaw(key)??'[]');}
        catch {this.storageAvailable=false;rows=this.memory.get(key)??[];}
        const valid=(Array.isArray(rows)?rows:[]).filter(p=>p&&typeof p.playerName==='string'&&Number.isFinite(p.score_val));
        if(legacy)return valid;
        return valid;
    }

    static readObject(key, fallback) {
        if (this.memory.has(key)) return this.memory.get(key);
        try { return JSON.parse(this._readRaw(key) ?? 'null') ?? fallback; }
        catch { return fallback; }
    }

    static previousScores() {
        const data = this.readObject('chaua-educa-v2', {});
        const archived=['floresta-v2','floresta-v3','floresta-v4','floresta-v5','floresta-v6','floresta-v7','floresta-v8','floresta-v9','floresta-v10'].flatMap(ruleset=>{
            const forest=this.readObject(`db-chaua-${ruleset}`,[]);
            return (Array.isArray(forest)?forest:[]).filter(s=>s && typeof s.playerName==='string' && Number.isFinite(s.score_val) && s.score_val>=0).map(s=>({...s,ruleset}));
        });
        return (Array.isArray(data?.scores) ? data.scores : [])
            .filter(s => s && typeof s.name === 'string' && Number.isFinite(s.score) && s.score >= 0)
            .map(s => ({playerName:s.name, score_val:s.score, mode:s.mode, ruleset:s.ruleset})).concat(archived);
    }

    static unlocked() {
        const old = this.readObject('chaua-educa-v2', {});
        const current = this.readObject('chaua-floresta-collection', []);
        // Versioned, non-destructive migration: retired discoveries remain in
        // the original save, but cannot unlock a different new food or artwork.
        if(this.readObject('chaua-food-catalog-version',0)!==2){
            this.memory.set('chaua-food-catalog-version',2);
            try{this._writeJSON('chaua-food-catalog-version',2);}
            catch{this.storageAvailable=false;}
        }
        return [...new Set([...(Array.isArray(old?.unlocked) ? old.unlocked : []), ...(Array.isArray(current) ? current : [])].filter(id => FOOD_IDS.has(id)))];
    }

    static unlock(id) {
        // Avoid synchronously re-writing an already persisted fruit.
        const stored=this.readObject('chaua-floresta-collection',[]);
        if(Array.isArray(stored)&&stored.includes(id))return;
        if(!FOOD_IDS.has(id))return;
        const data = [...new Set([...(Array.isArray(stored)?stored:[]),...this.unlocked(), id])];
        this.memory.set('chaua-floresta-collection',data);
        try { this._writeJSON('chaua-floresta-collection',data); }
        catch { this.storageAvailable = false; }
    }

    static discoveredEntries() {
        const stored=this.readObject('chaua-nature-discoveries',[]);
        const ids=Array.isArray(stored)?stored:[];
        return [...new Set([...INITIAL_ENTRIES,...(this.unlocked().length?['alimentos']:[]),...ids.filter(id=>ENTRIES.some(entry=>entry.id===id))])];
    }

    static discoverEntries(ids) {
        const valid=ids.filter(id=>ENTRIES.some(entry=>entry.id===id));
        if(!valid.length)return;
        const stored=this.readObject('chaua-nature-discoveries',[]);
        if(Array.isArray(stored)&&valid.every(id=>stored.includes(id)))return;
        const data=[...new Set([...this.discoveredEntries(),...valid])];
        this.memory.set('chaua-nature-discoveries',data);
        try { this._writeJSON('chaua-nature-discoveries',data); }
        catch { this.storageAvailable=false; }
    }

    static tutorialCompleted(){return this.readObject('chaua-tutorial-v1',false)===true;}
    static completeTutorial(){
        this.memory.set('chaua-tutorial-v1',true);
        try {this._writeJSON('chaua-tutorial-v1',true);}
        catch {this.storageAvailable=false;}
    }

    static missionProgress(player) {
        const stored=this.readObject('chaua-missions-v1',[]);
        const row=Array.isArray(stored)?stored.find(r=>r?.player===player.trim()):null;
        return normalizeProgress(row?.progress);
    }

    static advanceMissions(player,event) {
        const name=player.trim();
        if(name.length<3 || name.length>24)return normalizeProgress(null);
        const previous=this.missionProgress(name);
        const progress=advanceProgress(previous,event);
        if(JSON.stringify(previous)===JSON.stringify(progress))return progress;
        const stored=this.readObject('chaua-missions-v1',[]);
        const records=(Array.isArray(stored)?stored:[]).filter(r=>r && typeof r.player==='string' && r.player!==name);
        records.push({player:name,progress});
        this.memory.set('chaua-missions-v1',records);
        try {this._writeJSON('chaua-missions-v1',records);}
        catch {this.storageAvailable=false;}
        return progress;
    }

    static reviewTopics(player) {
        const records = this.readObject('chaua-discoveries', []);
        const row = Array.isArray(records) ? records.find(r=>r?.player===player) : null;
        return Array.isArray(row?.mistakes) ? row.mistakes.filter(id=>typeof id==='string') : [];
    }

    static recordDiscovery(player, id, right) {
        if (!player || typeof id !== 'string') return;
        const stored = this.readObject('chaua-discoveries', []);
        const records = Array.isArray(stored) ? stored.filter(r=>r && typeof r.player==='string' && r.player!==player) : [];
        const mistakes = this.reviewTopics(player).filter(topic=>topic!==id);
        if (!right) mistakes.push(id);
        records.push({player,mistakes});
        this.memory.set('chaua-discoveries',records);
        try { this._writeJSON('chaua-discoveries',records); }
        catch { this.storageAvailable=false; }
    }

    static upsertPlayerScore(playerName, score, mode = 'aventura') {
        const data = this.get();
        const previous = data.find(p => p.playerName === playerName && p.mode === mode);
        const record = !previous || score > previous.score_val;
        if (previous) previous.score_val = Math.max(previous.score_val, score);
        else data.push({ playerName, score_val: score, mode });
        data.sort((a, b) => b.score_val - a.score_val);
        this.memory.set(this.dbName, data);
        try { this._writeJSON(this.dbName,data); }
        catch { this.storageAvailable = false; }
        return record;
    }
}
