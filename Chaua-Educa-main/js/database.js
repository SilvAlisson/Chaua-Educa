export const RULES_VERSION = 'floresta-v3';
export default class DB {
    static dbName = `db-chaua-${RULES_VERSION}`;
    static storageAvailable = true;
    static memory = new Map();

    static get(legacy = false) {
        const key = legacy ? 'db-chaua' : this.dbName;
        if (!this.storageAvailable && this.memory.has(key)) return this.memory.get(key);
        try {
            const data = JSON.parse(localStorage.getItem(key) ?? '[]');
            return Array.isArray(data) ? data.filter(p => p && typeof p.playerName === 'string' && Number.isFinite(p.score_val)) : [];
        } catch {
            this.storageAvailable = false;
            return this.memory.get(key) ?? [];
        }
    }

    static readObject(key, fallback) {
        if (this.memory.has(key)) return this.memory.get(key);
        try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
        catch { return fallback; }
    }

    static previousScores() {
        const data = this.readObject('chaua-educa-v2', {});
        const forest=this.readObject('db-chaua-floresta-v2',[]);
        const archived=(Array.isArray(forest)?forest:[]).filter(s=>s && typeof s.playerName==='string' && Number.isFinite(s.score_val) && s.score_val>=0).map(s=>({...s,ruleset:'floresta-v2'}));
        return (Array.isArray(data?.scores) ? data.scores : [])
            .filter(s => s && typeof s.name === 'string' && Number.isFinite(s.score) && s.score >= 0)
            .map(s => ({playerName:s.name, score_val:s.score, mode:s.mode, ruleset:s.ruleset})).concat(archived);
    }

    static unlocked() {
        const old = this.readObject('chaua-educa-v2', {});
        const current = this.readObject('chaua-floresta-collection', []);
        return [...new Set([...(Array.isArray(old?.unlocked) ? old.unlocked : []), ...(Array.isArray(current) ? current : [])].filter(id => ['Goiaba','Semente','Manga','Mamao','Coquinho','Banana','Milho'].includes(id)))];
    }

    static unlock(id) {
        const data = [...new Set([...this.unlocked(), id])];
        this.memory.set('chaua-floresta-collection',data);
        try { localStorage.setItem('chaua-floresta-collection',JSON.stringify(data)); }
        catch { this.storageAvailable = false; }
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
        try { localStorage.setItem('chaua-discoveries',JSON.stringify(records)); }
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
        try { localStorage.setItem(this.dbName, JSON.stringify(data)); }
        catch { this.storageAvailable = false; }
        return record;
    }
}
