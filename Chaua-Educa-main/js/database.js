const setDB = (database) => {
    localStorage.setItem('db-chaua', database)
};

const getDB = () =>{
    return JSON.parse(localStorage.getItem('db-chaua')) ?? [];
};

const DBTemp = (playerName, score) =>{

    let DB = getDB();

    let Data = {
        playerName: playerName,
        score_val: score
    }
    DB.unshift(Data);

    setDB(JSON.stringify(DB));
};

export {setDB, getDB, DBTemp };