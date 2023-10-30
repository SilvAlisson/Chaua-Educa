import DB from './database.js';

// Variáveis Globais
let move_speed = 3;
let gravity = 0.5;
let parrot = document.querySelector('.parrot');
let img = document.getElementById('parrot-1');
let parrot_props = parrot.getBoundingClientRect();
let background = document.querySelector('.background').getBoundingClientRect();
let score_title = document.querySelector('.score_title');
let game_state = 'Start';
let additionalScore = 5;
let parrot_dy = 0;
let isPaused = false;
let controls_registered = false;
let tree_separation = 0;
let maxTopTreeHeight = 75;
let fruit_separation = 0;
let playerName;
let score_val = document.querySelector('.score_val');
let sound_fruit = new Audio('Sounds/get-fruit.wav');
let sound_die = new Audio('Sounds/die.wav');
let sound_winner = new Audio('Sounds/winner.wav');
let moveRequestId;
let applyGravityRequestId;
let createTreePairRequestId;
let createFruitsRequestId;
const sleep = document.querySelector('#sleep');
const txtSleep = document.querySelector('#txtSleep');

const fruitImages = [
    'images/Goiaba.png',
    'images/Semente.png',
    'images/Manga.png',
    'images/Mamao.png',
    'images/Coquinho.png',
    'images/Banana.png',
    'images/Milho.png',
];
// Perguntas
const QUESTIONS = [
    { prompt: "Os papagaios-chauá habitam o Pantanal? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
    { prompt: "A expectativa de vida dessas aves é de aproximadamente 45 anos? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
    { prompt: "O período de incubação dessas aves é de 24 dias? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
    { prompt: "Os papagaios-chauá podem chegar ao tamanho de até 90 centímetros? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
    { prompt: "O papagaios-chauá são conhecidos popularmente por papagaios da cabeça vermelha, papagaios de crista rosada ou papagaios com topete rosa? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
    { prompt: "Os papagaios-chauá se alimentam de frutos? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
    { prompt: "Os papagaios-chauá são aves que podem ser encontradas em outros países além do Brasil? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
    { prompt: "Os papagaios-chauá têm hábitos noturnos? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
    { prompt: "Os papagaios-chauá existem em abundância na natureza? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
    { prompt: "O desmatamento da Mata Atlântica, captura de ovos e filhotes são fatores para o desaparecimento da espécie na natureza? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
    { prompt: "A Mata Atlântica tem grande importância econômica e ecológica. As formações florestais ajudam a regular o clima e proteger o solo? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
    { prompt: "Desde a colonização do Brasil, ocorre exploração da Mata Atlântica? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" },
    { prompt: "A Mata Atlântica é encontrada na região central do Brasil? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
    { prompt: "A expansão da indústria, da agricultura, do turismo e da urbanização não causa impacto na biodiversidade da Mata Atlântica? Escolha (V) para verdadeiro ou (F) para falso.", answer: "F" },
    { prompt: "A riqueza da biodiversidade da Mata Atlântica tem números impressionantes, como: 1020 espécies de aves, 350 espécies de peixes, 340 espécies de anfíbios e 197 répteis? Escolha (V) para verdadeiro ou (F) para falso.", answer: "V" }

];

function get_fresh_questions() {
    return QUESTIONS.slice();
}

let in_game_questions;

const inputPlayer = document.querySelector('#inputPlayer')
const btnStart = document.querySelector('#btnStart');
const btnRestart = document.querySelectorAll('#btnRestart');
const btnRanking = document.querySelector('#btnRanking');
const modal = document.querySelector('#modal');
const modalLogin = document.querySelector('#modalLogin');
const modalGameOver = document.querySelector('#modalGameOver');
const modalRanking = document.querySelector('#modalRanking');
const modalCredits = document.querySelector('#modalCredits');
const table = document.querySelector('#table');

// Validar Jogador
const validatePlayer = ({target}) =>{
    if (target.value.length > 2) {
        btnStart.removeAttribute('disabled');
        playerName = target.value.trim().toUpperCase();
        register_controls();
    } else {
        btnStart.setAttribute('disabled', '');
    }
};
inputPlayer.addEventListener('input', validatePlayer);

const cleanText = () => {
    inputPlayer.value = '';
    btnStart.setAttribute('disabled', '');
};

img.style.display = 'none';

// Funções

// Inicializa o jogo
function intialize() {
    move_speed = 3;
    gravity = 0.5;
    parrot_dy = 0
    additionalScore = 5;
    isPaused = false;
    tree_separation = 0;
    maxTopTreeHeight = 70;
    fruit_separation = 0;

    img.style.display = 'block';
    parrot.style.top = '40vh';
    game_state = 'Play';
    score_title.innerHTML = 'Score : ';
    score_val.innerHTML = '0';

    parrot_props = parrot.getBoundingClientRect();
    in_game_questions = get_fresh_questions();
}


// Tela de Sleep
function sleepAsync(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  const startGameAfterSleep = async () => {
    sleep.classList.add('active');
    const sleepDuration = 5000; 
    for (let i = sleepDuration / 1000; i >= 0; i--) {
      txtSleep.innerHTML = i;
      await sleepAsync(1000);
    }

    sleep.classList.remove('active');
    intialize();
    play();
  };
  
  // Lida com a inicialização do jogo
  function handle_start_game(key_or_mouse_event) {
    const is_mouse_event = key_or_mouse_event instanceof MouseEvent;
  
    if ((is_mouse_event || key_or_mouse_event.key == 'Enter') && game_state != 'Play') {
      cleanText();
  
      modal.classList.remove('enable');
      modalLogin.classList.remove('active');
  
      document.querySelectorAll('.tree').forEach((e) => {
        e.remove();
      });
      document.querySelectorAll('.fruit').forEach((e) => {
        e.remove();
      });
  
      startGameAfterSleep();
    }
  }

  // Lida com a pausa do jogo
function handle_pause_game(key_event) {
    if (key_event.key == 'Escape' && game_state == 'Play') {
        if (!isPaused) {
            cancelAllAnimations();
            isPaused = true;
        } else {
            play();
            isPaused = false;
        }
    }
}

function handle_arrow_keydown(key_event) {
    if (!isPaused && (key_event.key == 'ArrowUp' || key_event.key == ' ')) {
        img.src = 'images/parrot-b.png';
        parrot_dy = -7.6;
    }
}

function handle_arrow_keyup(key_event) {
    if (!isPaused && (key_event.key =='ArrowUp' || key_event.key == ' ')) {
        img.src = 'images/parrot-a.png';
    }
}

// Reiniciar Jogo
function handle_restart_game(mouse_event) {
    game_state = 'Start';

    modalGameOver.classList.remove('active');
    modalRanking.classList.remove('active');
    modalCredits.classList.remove('active');

    modal.classList.add('enable');
    modalLogin.classList.add('active');
}

// Ranking
function handle_show_ranking(mouse_event) {
    showRankingScreen(modalGameOver, modalRanking)
}

//Controles
function register_controls() {
    if (controls_registered) return;

    btnStart.addEventListener('click', handle_start_game)

    document.addEventListener('keydown', (key_event) => {
        handle_start_game(key_event);
        handle_pause_game(key_event);
    });

    document.addEventListener('keydown', handle_arrow_keydown);
    document.addEventListener('keyup', handle_arrow_keyup);

    btnRestart.forEach((btn) => {
        btn.addEventListener('click', handle_restart_game);
    });
    
    btnRanking.addEventListener('click', handle_show_ranking);

    controls_registered = true;
}
// Lida com o fim de jogo
function gameOver() {
    game_state = 'End';
    cancelAllAnimations();
    sound_die.play();
    DB.upsertPlayerScore(playerName, parseInt(score_val.innerHTML));

    modal.classList.add('enable');
    modalGameOver.classList.add('active');
}
// Lida com a vitória no jogo
function gameWon() {
    game_state = 'End';
    cancelAllAnimations();
    sound_winner.play();
    DB.upsertPlayerScore(playerName, parseInt(score_val.innerHTML));
    img.style.display = 'none';
    modal.classList.add('enable');
    modalCredits.classList.add('active');
}
// Move o papagaio e verifica colisões
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

        if (parseInt(score_val.innerHTML) >= 200) {
            return gameWon();
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

                const probability = 0.60;
            
                if (randomChance <= probability) {

                let collidedFruitName = element.getAttribute('src').replace('images/', '').replace('.png', '');

                if (in_game_questions.length === 0) in_game_questions = get_fresh_questions();

                let randomIndex = Math.floor(Math.random() * in_game_questions.length);
                let question = in_game_questions.splice(randomIndex, 1)[0]; 
                let answer = prompt(`Para comer ${collidedFruitName}, responda:\n${question.prompt}`);

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
// Mostrando a tela de classificação
function showRankingScreen(modalGameOver, modalRanking) {
    modalGameOver.classList.remove('active');
    modalRanking.classList.add('active');

    resetRankingRows();
    createRankingTable();
}

// Reinicia as linhas da tabela de classificação
function resetRankingRows() {

    table.innerHTML = document.querySelector('.ranking-line1').outerHTML;
}

// Cria a tabela de classificação
function createRankingTable() {
    const classification = DB.get();


    classification.sort((a, b) => b.score_val - a.score_val);

    classification.forEach((item, index) => {
        let position = index + 1;
        let name = item.playerName;
        let score_val = item.score_val;
        createTable(position, name, score_val);
    });
}
// Cria linhas na tabela de classificação
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

// Aplica a gravidade ao papagaio
function apply_gravity() {
    if (game_state != 'Play') return;
    parrot_dy = parrot_dy + gravity;

    if (parrot_props.top <= 0 || parrot_props.bottom >= background.bottom) {
        return gameOver();
    }

    parrot.style.top = parrot_props.top + parrot_dy + 'px';
    parrot_props = parrot.getBoundingClientRect();
    applyGravityRequestId = requestAnimationFrame(apply_gravity);
}

// Cria um par de troncos de árvores
function create_tree_pair() {
    if (game_state != 'Play') return;
    
    if (tree_separation > 115) {
        tree_separation = 0;

        let gap_position = 40;

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

// Cria frutas
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

// Iniciando o jogo
function play() {
    moveRequestId = requestAnimationFrame(move);
    applyGravityRequestId = requestAnimationFrame(apply_gravity);
    createTreePairRequestId = requestAnimationFrame(create_tree_pair);
    createFruitsRequestId = requestAnimationFrame(create_fruits);
}

// Cancela todas as animações
function cancelAllAnimations() {
    cancelAnimationFrame(moveRequestId);
    cancelAnimationFrame(applyGravityRequestId);
    cancelAnimationFrame(createTreePairRequestId);
    cancelAnimationFrame(createFruitsRequestId);
}

// Event listeners e inicialização
document.addEventListener('DOMContentLoaded', () => {
    const creditsAnimation = document.querySelector('.credits-animation');

    const logo1 = document.querySelector('.logo-1');
    const logo2 = document.querySelector('.logo-2');
    const button = document.querySelector('.btn-restart-2');

    creditsAnimation.addEventListener('animationstart', () => {
        logo1.style.display = 'none';
        logo2.style.display = 'none';
        button.style.display = 'none';
    });

    creditsAnimation.addEventListener('animationend', () => {
        logo1.style.display = 'block';
        logo2.style.display = 'block';
        button.style.display = 'block';
    });
});