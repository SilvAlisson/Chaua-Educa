import DB from './database.js';
let move_speed = 3;
let gravity = 0.5;
let parrot = document.querySelector('.parrot');
let img = document.getElementById('parrot-1');
let parrot_props = parrot.getBoundingClientRect();
let background = document.querySelector('.background').getBoundingClientRect();
let message = document.querySelector('.message');
let score_title = document.querySelector('.score_title');
let game_state = 'Start';
let additionalScore = 5;
let playerName;
let score_val = document.querySelector('.score_val');
let sound_fruit = new Audio('Sounds/get-fruit.wav');
let sound_die = new Audio('Sounds/die.wav');

const inputPlayer = document.querySelector('#inputPlayer')
const btnStart = document.querySelector('#btnStart');
const btnRestart = document.querySelectorAll('#btnRestart');
const btnRanking = document.querySelector('#btnRanking');
const modal = document.querySelector('#modal');
const modalLogin = document.querySelector('#modalLogin');
const modalGameOver = document.querySelector('#modalGameOver');
const modalRanking = document.querySelector('#modalRanking');
const table = document.querySelector('#table');

const validatePlayer = ({target}) =>{
    if (target.value.length > 2) {
        btnStart.removeAttribute('disabled');
        playerName = target.value.trim().toUpperCase();

        btnStart.addEventListener('click', start)
        document.addEventListener('keydown', ({ key }) => {
            if (key === 'Enter' && target.value.length > 2) {
                start();
            }
        });
    } else {
        btnStart.setAttribute('disabled', '');
    }
};
inputPlayer.addEventListener('input', validatePlayer);

const cleanText = () => {
    inputPlayer.value = '';
    btnStart.setAttribute('disabled', '');
};

const start = () => {
    cleanText();

    modal.classList.remove('enable');
    modalLogin.classList.remove('active');
}


img.style.display = 'none';

let isPaused = false;

document.addEventListener('keydown', (e) => {
    if (e.key == 'Enter' && game_state != 'Play') {
        document.querySelectorAll('.tree').forEach((e) => {
            e.remove();
        });
        document.querySelectorAll('.fruit').forEach((e) => {
            e.remove();
        });
        img.style.display = 'block';
        parrot.style.top = '40vh';
        game_state = 'Play';
        message.innerHTML = '';
        score_title.innerHTML = 'Score : ';
        score_val.innerHTML = '0';
        message.classList.remove('messageStyle');
        play();
    }

    if (e.key == 'Escape' && game_state == 'Play') {
        if (!isPaused) {
            cancelAllAnimations();
            isPaused = true;
        } else {
            play();
            isPaused = false;
        }
    }
});

let parrot_dy = 0;
let controls_registered = false;

function register_keyboard_controls() {
    if (controls_registered) return;

    document.addEventListener('keydown', (e) => {
        if (!isPaused && (e.key == 'ArrowUp' || e.key == ' ')) {
            img.src = 'images/parrot-b.png';
            parrot_dy = -7.6;
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (!isPaused && (e.key =='ArrowUp' || e.key == ' ')) {
            img.src = 'images/parrot-a.png';
        }
    });

    controls_registered = true;
}


let moveRequestId;
let applyGravityRequestId;
let createTreePairRequestId;
let createFruitsRequestId;

function gameOver() {
    game_state = 'End';
    cancelAllAnimations();
    sound_die.play();
    DB.upsertPlayerScore(playerName, parseInt(score_val.innerHTML));

    modal.classList.add('enable');
    modalGameOver.classList.add('active');
}

function move() {
    if (game_state != 'Play') return;

    let tree_sprites = document.querySelectorAll('.tree');
    tree_sprites.forEach((element) => {
        let tree_props = element.getBoundingClientRect();
        parrot_props = parrot.getBoundingClientRect();

        if (tree_props.right <= 0) {
            element.remove();
        } else {
            if (parrot_props.left < tree_props.left + tree_props.width && parrot_props.left + parrot_props.width > tree_props.left && parrot_props.top < tree_props.top + tree_props.height && parrot_props.top + parrot_props.height > tree_props.top) {
                return gameOver();
            } else {
                if (tree_props.right < parrot_props.left && tree_props.right + move_speed >= parrot_props.left && element.increase_score == '1') {
                    score_val.innerHTML = parseInt(score_val.innerHTML) + 1;
                }
                element.style.left = tree_props.left - move_speed + 'px';
            }
        }
        
    });

    let fruit_sprites = document.querySelectorAll('.fruit');
    fruit_sprites.forEach((element) => {
        let fruit_props = element.getBoundingClientRect();
        parrot_props = parrot.getBoundingClientRect();

        if (fruit_props.right <= 0) {
            element.remove();
        } else {
            if (parrot_props.left <= fruit_props.left + fruit_props.width && parrot_props.left + parrot_props.width >= fruit_props.left && parrot_props.top <= fruit_props.top + fruit_props.height && parrot_props.top + parrot_props.height >= fruit_props.top) {
                const randomChance = Math.random();

                const probability = 0.68;
            
                if (randomChance <= probability) {

                let collidedFruitName = element.getAttribute('src').replace('images/', '').replace('.png', '');
                
                let questions = [
                    { prompt: "Os papagaios-chauá habitam o pantanal? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
                    { prompt: "A expectativa de vida dessas aves é de aproximadamente 45 anos? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
                    { prompt: "O periodo de incubação dessas aves é de 24 dias? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
                    { prompt: "Os papagaio-chauá podem chegar ao tamanho de até 90 centímetros? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
                    { prompt: "O papagaio-chauá é conhecido popularmente por papagaio da cabeça vermelha, papagaio de crista rosada ou papagaio com topete rosa? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
                    { prompt: "O papagaio-chauá se alimenta de frutos? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
                    { prompt: "O papagaio-chauá é uma ave que pode ser encontrada em outros países a não ser no Brasil? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
                    { prompt: "O papagaio-chauá tem hábitos noturnos? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
                    { prompt: "O papagaio-chauá existe em abundância na natureza? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
                    { prompt: "O desmatamento da Mata Atlântica, captura de ovos e filhotes são fatores para o desaparecimento da espécie na natureza? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" }
                ];

                let randomIndex = Math.floor(Math.random() * questions.length);
                let question = questions[randomIndex];
                let answer = prompt(`Para comer ${collidedFruitName}, responda:
${question.prompt}`);

                if (answer === null) {
                } else if (answer.toLowerCase() !== question.answer.toLowerCase()) { 
                    return gameOver();
                } else {
                    element.remove();
                    score_val.innerHTML = parseInt(score_val.innerHTML) + additionalScore;
                }
                sound_fruit.play();
            } else {
                element.remove();
                score_val.innerHTML = parseInt(score_val.innerHTML) + additionalScore -2;
                sound_fruit.play();
            }
            } else {
                if (fruit_props.right < parrot_props.left && fruit_props.right + move_speed >= parrot_props.left && element.increase_score == '1') {
                    score_val.innerHTML = parseInt(score_val.innerHTML) + 1;
                    sound_fruit.play();
                }
                element.style.left = fruit_props.left - move_speed + 'px';
            }
        }
    }
    );
    moveRequestId = requestAnimationFrame(move);
}

function restartGame() {
    location.reload(true);
}

function rankingScreen(modalGameOver, modalRanking, rankingTable) {
    modalGameOver.classList.remove('active');
    modalRanking.classList.add('active');
    rankingTable();
}

function rankingTable(createTable) {
    const classification = DB.get();

    // sort by scores in descening order
    classification.sort((a, b) => b.score_val - a.score_val);

    classification.forEach((item, index) => {
        let position = index + 1;
        let name = item.playerName;
        let score_val = item.score_val;
        createTable(position, name, score_val);
    });
}

function createTable(position, name, score_val) {
    const elementHTML = document.createElement('tr');
    elementHTML.classList.add('ranking-line');
    elementHTML.innerHTML = `
        <td class="ranking-column">${position}</td>
        <td class="ranking-column">${name}</td>
        <td class="ranking-column">${score_val}</td>
    `;
    table.appendChild(elementHTML);
}

function apply_gravity() {
    if (game_state != 'Play') return;
    parrot_dy = parrot_dy + gravity;
    
    register_keyboard_controls();

    if (parrot_props.top <= 0 || parrot_props.bottom >= background.bottom) {
        return gameOver();
    }
    parrot.style.top = parrot_props.top + parrot_dy + 'px';
    parrot_props = parrot.getBoundingClientRect();
    applyGravityRequestId = requestAnimationFrame(apply_gravity);
}

function create_tree_pair() {
    if (game_state != 'Play') return;
    
    if (tree_separation > 115) {
        tree_separation = 0;

        let gap_position = 45;

        let tree_posi = Math.floor(Math.random() * (maxTopTreeHeight - 2 * gap_position)) + gap_position;

        if (tree_posi > maxTopTreeHeight) {
            tree_posi = maxTopTreeHeight;
        }

        let tree_sprite1 = document.createElement('img');
        tree_sprite1.className = 'tree';
        tree_sprite1.src = 'images/tree.png';
        tree_sprite1.style.top = tree_posi - maxTopTreeHeight + 'vh';
        tree_sprite1.style.left = '100vw';
        tree_sprite1.increase_score = '1';

        document.body.appendChild(tree_sprite1);

        let tree_sprite2 = document.createElement('img');
        tree_sprite2.className = 'tree tree-inverted';
        tree_sprite2.src = 'images/tree.png';
        tree_sprite2.style.top = tree_posi + gap_position + 'vh';
        tree_sprite2.style.left = '100vw';

        document.body.appendChild(tree_sprite2);
    }
    tree_separation++;
    createTreePairRequestId = requestAnimationFrame(create_tree_pair);
}

function create_fruits() {
    if (game_state != 'Play') return;
    
    if (fruit_separation > 350) {
        fruit_separation = 0;

        let tree_sprites = document.querySelectorAll('.tree');
        if (tree_sprites.length < 2) {
            return;
        }

        let tree1 = tree_sprites[tree_sprites.length - 2];
        let tree2 = tree_sprites[tree_sprites.length - 1];
        let tree1_props = tree1.getBoundingClientRect();
        let tree2_props = tree2.getBoundingClientRect();

        let fruit_x = (tree1_props.right + tree2_props.left) / 2;

        if (fruit_x > 10) {
            fruit_x -= 60; 
        }

        let randomFruitImage = fruitImages[Math.floor(Math.random() * fruitImages.length)];

        let fruit_sprite1 = document.createElement('img');
        fruit_sprite1.classList.add("fruit")
        fruit_sprite1.src = randomFruitImage;
        if (randomFruitImage === 'images/Goiaba.png') {
            fruit_sprite1.classList.add('Goiaba');
        } else if (randomFruitImage === 'images/Semente.png') {
            fruit_sprite1.classList.add('Semente');
        } else if (randomFruitImage === 'images/Manga.png') {
            fruit_sprite1.classList.add('Manga');
        } else if (randomFruitImage === 'images/Banana.png') {
            fruit_sprite1.classList.add('Banana');
        } else if (randomFruitImage === 'images/Coquinho.png') {
            fruit_sprite1.classList.add('Coquinho');
        } else if (randomFruitImage === 'images/Mamao.png') {
            fruit_sprite1.classList.add('Mamao');
        }  else if (randomFruitImage === 'images/Milho.png') {
            fruit_sprite1.classList.add('Milho');
        } 

        fruit_sprite1.style.left = fruit_x + 'px';
        let screenHeight = window.innerHeight;
        let fruit_y = (tree1_props.bottom + tree2_props.top) / 2 - screenHeight / 2;
        fruit_sprite1.style.top = screenHeight / 2 + fruit_y + 'px';

        fruit_sprite1.increase_score = '1';

        document.body.appendChild(fruit_sprite1);
    }
    fruit_separation++;
    createFruitsRequestId = requestAnimationFrame(create_fruits);
}

let tree_separation = 0;
let maxTopTreeHeight = 75;

let fruitImages = [
    'images/Goiaba.png',
    'images/Semente.png',
    'images/Manga.png',
    'images/Mamao.png',
    'images/Coquinho.png',
    'images/Banana.png',
    'images/Milho.png',
];

let fruit_separation = 0;

function play() {
    parrot_dy = 0;
    moveRequestId = requestAnimationFrame(move);
    applyGravityRequestId = requestAnimationFrame(apply_gravity);
    createTreePairRequestId = requestAnimationFrame(create_tree_pair);
    createFruitsRequestId = requestAnimationFrame(create_fruits);
}

function cancelAllAnimations() {
    cancelAnimationFrame(moveRequestId);
    cancelAnimationFrame(applyGravityRequestId);
    cancelAnimationFrame(createTreePairRequestId);
    cancelAnimationFrame(createFruitsRequestId);
}

btnRestart.forEach((btn) => {
    btn.addEventListener('click', restartGame);
});

btnRanking.addEventListener('click', () => rankingScreen(modalGameOver, modalRanking, () => rankingTable(createTable)));
