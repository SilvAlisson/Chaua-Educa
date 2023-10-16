let move_speed = 3;
let gravity = 0.5;
let parrot = document.querySelector('.parrot');
let img = document.getElementById('parrot-1');
let parrot_props = parrot.getBoundingClientRect();
let background = document.querySelector('.background').getBoundingClientRect();
let score_val = document.querySelector('.score_val');
let message = document.querySelector('.message');
let score_title = document.querySelector('.score_title');
let game_state = 'Start';
let additionalScore = 5;
let sound_fruit = new Audio('Sounds/get-fruit.wav');
let sound_die = new Audio('Sounds/die.wav');

img.style.display = 'none';
message.classList.add('messageStyle');

const QUESTIONS = [
    { prompt: "Os papagaio-chauá habitam o pantanal? Escolha (V) para verdadeiro ou (F) para falso", answer: "F" },
    { prompt: "A expectativa de vida dessas aves é de aproximadamente 45 anos? Escolha (V) para verdadeiro ou (F) para falso", answer: "V" },
    { prompt: "O periodo de incubação dessas aves é de 24 dias? Escolha (V) para verdadeiro ou (F) para falso", answer: "V" },
    { prompt: "Os papagaio-chauá podem chegar ao tamanho de até 90 centímetros? Escolha (V) para verdadeiro ou (F) para falso", answer: "F" },
    { prompt: "O papagaio-chauá é conhecido popularmente por papagaio da cabeça vermelha, papagaio de crista rosada ou papagaio com topete rosa? Escolha (V) para verdadeiro ou (F) para falso", answer: "V" },
    { prompt: "O papagaio-chauá se alimenta de frutos? Escolha (V) para verdadeiro ou (F) para falso", answer: "V" },
    { prompt: "O papagaio-chauá é uma ave que pode ser encontrada em outrs países a não ser no Brasil? Escolha (V) para verdadeiro ou (F) para falso", answer: "F" },
    { prompt: "O papagaio-chauá tem hábitos noturnos? Escolha (V) para verdadeiro ou (F) para falso", answer: "F" },
    { prompt: "O papagaio-chauá existe em abundância na natureza? Escolha (V) para verdadeiro ou (F) para falso", answer: "F" },
    { prompt: "O desmatamento da mata atlântica, capitura de ovos e filhotes são fatores para o desaparecimento da espécie da natureza? Escolha (V) para verdadeiro ou (F) para falso", answer: "V" }
];

function get_fresh_questions() {
    return QUESTIONS.slice();
}

let in_game_questions;

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
        in_game_questions = get_fresh_questions();
        play();
    }
});

let parrot_dy = 0;
let controls_registered = false;

function register_keyboard_controls() {
    if (controls_registered) return;

    document.addEventListener('keydown', (e) => {
        if (e.key == 'ArrowUp' || e.key == ' ') {
            img.src = 'images/parrot-b.png';
            parrot_dy = -7.6;
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key =='ArrowUp' || e.key == ' ') {
            img.src = 'images/parrot-a.png';
        }
    });

    controls_registered = true;
}

function play() {
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
                    game_state = 'End';
                    message.innerHTML = '<strong>Fim de jogo!</strong>'.fontcolor('red') + '<br>Pressione <strong>Enter</strong> para recomeçar';
                    message.classList.add('messageStyle');
                    img.style.display = 'none';
                    sound_die.play();
                    return;
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
                    if (in_game_questions.length === 0) in_game_questions = get_fresh_questions();

                    let randomIndex = Math.floor(Math.random() * in_game_questions.length);
                    let question = in_game_questions.splice(randomIndex, 1)[0]; // gets the question at index and also removes it from array
                    let answer = prompt(question.prompt);

                    if (answer === null) {
                    } else if (answer.toLowerCase() !== question.answer.toLowerCase()) { 
                        game_state = 'End';
                        message.innerHTML = '<strong>Fim de jogo!</strong>'.fontcolor('red') + '<p> <Resposta incorreta!!<p> Pressione <strong>Enter</strong> para reiniciar';
                        message.classList.add('messageStyle');
                        img.style.display = 'none';
                        sound_die.play();
                        return;
                    } else {
                        element.remove();
                        score_val.innerHTML = parseInt(score_val.innerHTML) + additionalScore;
                    }
                    sound_fruit.play();
                } else {
                    if (fruit_props.right < parrot_props.left && fruit_props.right + move_speed >= parrot_props.left && element.increase_score == '1') {
                        score_val.innerHTML = parseInt(score_val.innerHTML) + 1;
                        sound_fruit.play();
                    }
                    element.style.left = fruit_props.left - move_speed + 'px';
                }
            }
        });
        requestAnimationFrame(move);
    }
    requestAnimationFrame(move);

    parrot_dy = 0;
    function apply_gravity() {
        if (game_state != 'Play') return;
        parrot_dy = parrot_dy + gravity;
        
        register_keyboard_controls();

        if (parrot_props.top <= 0 || parrot_props.bottom >= background.bottom) {
            game_state = 'End';
            message.style.left = '28vw';
            window.location.reload();
            message.classList.remove('messageStyle');
            return;
        }
        parrot.style.top = parrot_props.top + parrot_dy + 'px';
        parrot_props = parrot.getBoundingClientRect();
        requestAnimationFrame(apply_gravity);
    }
    requestAnimationFrame(apply_gravity);

    let tree_separation = 0;
    let maxTopTreeHeight = 75;

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
        requestAnimationFrame(create_tree_pair);
    }

    requestAnimationFrame(create_tree_pair);

    let fruitImages = [
        'images/goiaba-verde.png',
        'images/semente-de-girassol.png',
        'images/manga-verde.png',
        'images/mamao-verde.png',
        'images/coquinho-verde.png',
        'images/banana-verde.png',
        // Adicione mais URLs de imagens de frutos, se necessário
    ];
    
    let fruit_separation = 0;
    
    function create_fruits() {
        if (game_state != 'Play') return;
    
        if (fruit_separation > 115) {
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
            if (randomFruitImage === 'images/goiaba-verde.png') {
                fruit_sprite1.classList.add('goiaba-verde');
            } else if (randomFruitImage === 'images/semente-de-girassol.png') {
                fruit_sprite1.classList.add('semente-de-girassol');
            } else if (randomFruitImage === 'images/manga-verde.png') {
                fruit_sprite1.classList.add('manga-verde');
            } else if (randomFruitImage === 'images/banana-verde.png') {
                fruit_sprite1.classList.add('banana-verde');
            } else if (randomFruitImage === 'images/coquinho-verde.png') {
                fruit_sprite1.classList.add('coquinho-verde');
            } else if (randomFruitImage === 'images/mamao-verde.png') {
                fruit_sprite1.classList.add('mamao-verde');
            }
    
            fruit_sprite1.style.left = fruit_x + 'px';
            let screenHeight = window.innerHeight;
            let fruit_y = (tree1_props.bottom + tree2_props.top) / 2 - screenHeight / 2;
            fruit_sprite1.style.top = screenHeight / 2 + fruit_y + 'px';
    
            fruit_sprite1.increase_score = '1';
    
            document.body.appendChild(fruit_sprite1);
        }
        fruit_separation++;
        requestAnimationFrame(create_fruits);
    }
    
    requestAnimationFrame(create_fruits);
}
