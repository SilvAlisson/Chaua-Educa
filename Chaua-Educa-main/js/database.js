export const RULES_VERSION = 'floresta-v2';
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
