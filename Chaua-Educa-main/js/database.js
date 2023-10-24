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

        const existingPlayer = DB.find(p => p.playerName === playerName);

        if (existingPlayer) {
            // Player exists, update score if new score is higher
            if (existingPlayer.score_val < score) {
                existingPlayer.score_val = score;
                this.set(DB); // Salve as alterações no banco de dados
            }
        } else {
            // Player doesn't exist, add to database
            this.addPlayerScore(playerName, score);
        }
    }
}

export default DB;
