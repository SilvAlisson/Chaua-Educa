class DB {
    static dbName = 'db-chaua';

    static get() {
        return JSON.parse(localStorage.getItem(this.dbName)) ?? [];
    }

    static set(database) {
        localStorage.setItem(this.dbName, JSON.stringify(database));
    }

    static addPlayerScore(playerName, score) {
        const DB = this.get();

        const Data = {
            playerName: playerName,
            score_val: score
        };
        
        DB.unshift(Data);
        this.set(DB);
    }

    static upsertPlayerScore(playerName, score) {
        const DB = this.get();
        
        const existingPlayerIndex = DB.findIndex(p => p.playerName === playerName);
        
        if (existingPlayerIndex > -1) {
            // Player exists, update score if new score is higher
            if (DB[existingPlayerIndex].score_val < score) {
                DB[existingPlayerIndex].score_val = score;
            }
        } else {
            // Player doesn't exist, add to database
            this.addPlayerScore(playerName, score);
            return; // Exit the method since we've added the player already
        }
        
        this.set(DB);
    }
}

export default DB;