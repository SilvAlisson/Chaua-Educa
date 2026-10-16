import { ForestAudio } from './audio.mjs';
import { SOURCES } from './questions.mjs';
import { FRUITS } from './fruits.mjs';
import DB from './database.js';
import { Game, FlightClock, HEIGHT, STAGES, VICTORY_SCORE } from './engine.mjs';
import { Renderer, drawBird } from './render.mjs';

const $ = selector => document.querySelector(selector);
const app = $('#app');
const renderer = new Renderer($('#forest'));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const dialogs = [...document.querySelectorAll('dialog')];
const flightInputs = new Set();
let player = '', selectedMode = 'aventura', previousState = '', board = 'aventura';
let returnToResult = false, lastTime = 0, toastUntil = 0, pointsUntil = 0;
let resultAnimation = null, soundOn = false;
let assetsReady = false;
try { soundOn = localStorage.getItem('chaua-sound') === 'true'; } catch { /* Optional preference. */ }

const forestAudio=new ForestAudio();
forestAudio.setEnabled(soundOn);
function sound(type) { forestAudio.setEnabled(soundOn);forestAudio.play(type); }

function toast(text) {
    $('#toast').textContent = text;
    $('#toast').classList.add('visible');
    toastUntil = game.elapsed + 3;
    $('#screen-reader-status').textContent = text;
}

export const game = new Game({ onEvent(event) {
    sound(event.type);
    if (event.type === 'fruit') DB.unlock(event.fruit);
    const messages = { shield: 'Escudo de penas · um contato protegido', feather: 'Pena dourada · pontos ×2 por 10s de voo', 'shield-break': 'Escudo usado · um respiro para continuar', quiet: 'Uma clareira. Recupere o fôlego.' };
    if (messages[event.type]) toast(messages[event.type]);
    if (event.type === 'points') {
        $('#score-bonus').textContent = `+${event.value}`; pointsUntil = game.elapsed + 1;
        if(!reducedMotion.matches) {
            const score=$('#score');score.getAnimations().forEach(a=>a.cancel());
            score.animate([{transform:'scale(1)'},{transform:'scale(1.16)',color:'#b48c32'},{transform:'scale(1)'}],{duration:240});
        }
    }
} });
const clock = new FlightClock(game);

function resize() {
    renderer.resize();

}
new ResizeObserver(resize).observe(app);
window.addEventListener('resize', resize);

function clearInputs() { flightInputs.clear(); game.release(); $('#flap-button').classList.remove('is-held'); }
function hold(source) {
    if (game.state !== 'playing') return;
    flightInputs.add(source); game.press(); $('#flap-button').classList.add('is-held');
}
function release(source) {
    flightInputs.delete(source);
    if (!flightInputs.size) { game.release(); $('#flap-button').classList.remove('is-held'); }
}
function closeDialogs() { dialogs.forEach(dialog => { if (dialog.open) dialog.close(); }); }
function openDialog(id) { const dialog = $(id); if (!dialog.open) dialog.showModal(); }

function start() {
    if (!assetsReady) return;
    closeDialogs(); clearInputs();
    cancelAnimationFrame(resultAnimation);
    app.classList.add('in-flight'); $('#home').hidden = true; $('#hud').hidden = false;
    resize(); game.start(selectedMode); previousState = ''; clock.reset(); lastTime = 0;
    $('#score-bonus').textContent = ''; $('#toast').classList.remove('visible'); toastUntil = 0;
    $('#screen-reader-status').textContent = 'O voo vai começar. Toque, seta para cima ou espaço para bater asas. Solte para descer.';
    // Remove focus from the submitting/restarting button, avoiding Space clicks.
    document.activeElement?.blur();
    syncUI();
}
function home() {
    closeDialogs(); clearInputs(); cancelAnimationFrame(resultAnimation);
    game.reset(); previousState = ''; clock.reset(); lastTime = 0;
    $('#hud').hidden = true; $('#countdown').hidden = true; $('#home').hidden = false;
    app.classList.remove('in-flight'); resize(); $('#inputPlayer').focus({ preventScroll: true });
}

$('#inputPlayer').addEventListener('input', event => {
    const value = event.target.value;
    $('#btnStart').disabled = !assetsReady || value.trim().length < 3;
    $('#name-count').textContent = `${value.length}/24`;
    event.target.setCustomValidity('');
});
$('#start-form').addEventListener('submit', event => {
    event.preventDefault();
    player = $('#inputPlayer').value.trim();
    if (player.length < 3) { $('#inputPlayer').setCustomValidity('Use pelo menos 3 letras no seu nome.'); $('#inputPlayer').reportValidity(); return; }
    selectedMode = $('input[name=mode]:checked').value;
    sound('fruit'); start();
});
$('#restart-button').addEventListener('click', start);
$('.brand').addEventListener('click', event => { event.preventDefault(); home(); });
document.querySelectorAll('.back-home').forEach(button => button.addEventListener('click', home));
$('#pause-button').addEventListener('click', () => { clearInputs(); game.pause(); syncUI(); });
$('#resume-button').addEventListener('click', () => { $('#pause-dialog').close(); clearInputs(); game.resume(); syncUI(); });
$('#pause-dialog').addEventListener('cancel', event => { event.preventDefault(); $('#resume-button').click(); });
$('#quiz-dialog').addEventListener('cancel', event => event.preventDefault());
$('#result-dialog').addEventListener('cancel', event => { event.preventDefault(); home(); });

$('#flap-button').addEventListener('pointerdown', event => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); hold(`pointer-${event.pointerId}`);
});
$('#forest').addEventListener('pointerdown', event => {
    if (!app.classList.contains('in-flight')) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); hold(`pointer-${event.pointerId}`);
});
window.addEventListener('pointerup', event => release(`pointer-${event.pointerId}`));
window.addEventListener('pointercancel', event => release(`pointer-${event.pointerId}`));
$('#flap-button').addEventListener('lostpointercapture', event => release(`pointer-${event.pointerId}`));
$('#forest').addEventListener('lostpointercapture', event => release(`pointer-${event.pointerId}`));
$('#flap-button').addEventListener('click', event => { if (event.detail === 0) { game.press(); game.release(); } });
window.addEventListener('keydown', event => {
    if (game.state === 'quiz') {
        if (['v', 'f'].includes(event.key.toLowerCase()) && !event.repeat) { event.preventDefault(); answer(event.key.toLowerCase() === 'v'); }
        return;
    }
    if (!['playing', 'countdown'].includes(game.state)) return;
    if (['Escape', 'p', 'P'].includes(event.key) && !event.repeat) { event.preventDefault(); clearInputs(); game.pause(); syncUI(); return; }
    if (['ArrowUp', 'Space'].includes(event.code)) { event.preventDefault(); if (!event.repeat) hold(event.code); }
});
window.addEventListener('keyup', event => { if (['ArrowUp', 'Space'].includes(event.code)) release(event.code); });
function autoPause() { clearInputs(); game.pause(); forestAudio.update('paused',false,game.elapsed,game.stage); syncUI(); }
window.addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

function updateSoundButton() {
    const button = $('.sound-toggle');
    button.setAttribute('aria-pressed', String(soundOn));
    button.setAttribute('aria-label', soundOn ? 'Silenciar sons' : 'Ativar sons');
    $('.sound-slash').hidden = soundOn;
}
$('.sound-toggle').addEventListener('click', () => { soundOn = !soundOn; try { localStorage.setItem('chaua-sound', String(soundOn)); } catch { /* Optional. */ } updateSoundButton(); sound('fruit'); });
updateSoundButton();

function answer(value) {
    game.answer(value);
    const result = game.answerResult;
    if (result === null) return;
    $('#answer-true').disabled = true; $('#answer-false').disabled = true;
    const feedback = $('#answer-feedback');
    feedback.textContent = result ? `Boa descoberta! +${2 * game.quizMultiplier} pontos.` : `A afirmação é ${game.question.answer ? 'verdadeira' : 'falsa'}. Guarde essa descoberta para o próximo voo.`;
    feedback.textContent += ` ${game.question.explanation}`;
    const source = SOURCES[game.question.source];
    const link = document.createElement('a'); link.href = source.url; link.textContent = ' Fonte: ' + source.label; link.target = '_blank'; link.rel = 'noopener noreferrer'; feedback.append(link);
    feedback.classList.toggle('incorrect', !result);
    $('#quiz-continue').hidden = false;
    $('#quiz-continue').textContent = result || game.mode === 'tranquilo' ? 'Continuar o voo →' : 'Ver meu voo →';
    $('#quiz-continue').focus();
}
$('#answer-true').addEventListener('click', () => answer(true));
$('#answer-false').addEventListener('click', () => answer(false));
$('#quiz-continue').addEventListener('click', () => { $('#quiz-dialog').close(); clearInputs(); game.continueQuiz(); syncUI(); });

function result() {
    clearInputs();
    const record = DB.upsertPlayerScore(player, game.score, selectedMode);
    const panel = $('#result-dialog .result'); panel.classList.toggle('victory', game.won);
    $('#result-title').textContent = game.won ? 'A floresta celebra você!' : 'Opa! Vamos de novo?';
    $('#result-eyebrow').textContent = game.won ? 'UM VOO PARA GUARDAR' : 'CADA VOO É UM COMEÇO';
    $('#result-reason').textContent = game.reason;
    $('#new-record').hidden = !record || game.score === 0;
    $('#result-fruits').textContent = game.fruits; $('#result-correct').textContent = game.correct;
    $('#storage-note').textContent = DB.storageAvailable ? 'Seu recorde fica salvo neste navegador.' : 'Armazenamento indisponível: recorde mantido apenas nesta sessão.';
    const birdCanvas = document.createElement('canvas'); birdCanvas.width = 300; birdCanvas.height = 210;
    const bc = birdCanvas.getContext('2d'); bc.scale(2, 2); drawBird(bc, { x: 68, y: 53, scale: 1.05, perched: true, surprise: !game.won, reduced: true });
    $('#result-bird').replaceChildren(birdCanvas);
    openDialog('#result-dialog'); $('#restart-button').focus();
    $('#screen-reader-status').textContent = `${game.won ? 'Vitória' : 'Fim de voo'}. ${game.score} pontos, ${game.fruits} frutos, ${game.correct} respostas corretas. ${game.reason}`;
    const begin = performance.now(), target = game.score;
    function count(now) {
        const fraction = reducedMotion.matches ? 1 : Math.min(1, (now - begin) / 650);
        $('#result-score').textContent = Math.round(target * (1 - (1 - fraction) ** 3));
        if (fraction < 1) resultAnimation = requestAnimationFrame(count);
    }
    resultAnimation = requestAnimationFrame(count);
}

function showRanking(fromResult = false) {
    returnToResult = fromResult;
    if (fromResult) $('#result-dialog').close();
    board = fromResult ? selectedMode : 'aventura'; renderRanking(); openDialog('#ranking-dialog');
}
function renderRanking() {
    document.querySelectorAll('[data-board]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.board === board)));
    const rows = (board === 'previous' ? DB.previousScores() : DB.get(board === 'legacy')).filter(p => ['legacy','previous'].includes(board) || p.mode === board).sort((a, b) => b.score_val - a.score_val);
    $('#ranking-empty').hidden = rows.length !== 0;
    $('#ranking-body').replaceChildren(...rows.map((row, index) => {
        const tr = document.createElement('tr');
        tr.style.setProperty('--row-delay', `${Math.min(index, 7) * 45}ms`);
        for (const text of [String(index + 1).padStart(2, '0'), board === 'previous' ? `${row.playerName} · ${row.mode} · ${row.ruleset || 'original'}` : row.playerName, row.score_val]) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
        return tr;
    }));
}
$('#open-ranking').addEventListener('click', () => showRanking());
$('#result-ranking').addEventListener('click', () => showRanking(true));
document.querySelectorAll('[data-board]').forEach(button => button.addEventListener('click', () => { board = button.dataset.board; renderRanking(); }));
$('#ranking-dialog').addEventListener('close', () => { if (returnToResult && game.state === 'ended') openDialog('#result-dialog'); returnToResult = false; });
$('#open-guide').addEventListener('click', () => openDialog('#guide-dialog'));
$('#open-credits').addEventListener('click', () => openDialog('#credits-dialog'));
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));

function syncUI() {
    if (game.state !== previousState) {
        app.dataset.state = game.state;
        clearInputs();
        if (game.state === 'paused') openDialog('#pause-dialog');
        if (game.state === 'quiz') {
            $('#question-text').textContent = game.question.text;
            $('#quiz-bonus').textContent = game.quizMultiplier === 2 ? 'Pena dourada garantida nesta resposta: +4 pontos ao acertar.' : 'Uma resposta certa vale +2 pontos.';
            $('#answer-feedback').textContent = ''; $('#quiz-continue').hidden = true;
            $('#answer-true').disabled = false; $('#answer-false').disabled = false;
            openDialog('#quiz-dialog');
        }
        if (game.state === 'ended') result();
        previousState = game.state;
    }
    $('#countdown').hidden = game.state !== 'countdown';
    if (game.state === 'countdown') $('#count-number').textContent = Math.max(1, Math.ceil(game.countdown));
    $('#score').textContent = game.score;
    $('#stage-name').textContent = STAGES[game.stage];
    $('#progress-fill').style.width = `${Math.min(100, game.score / VICTORY_SCORE * 100)}%`;
    $('#energy').value = game.stamina;
    $('#shield-status').classList.toggle('active', game.shield);
    $('#shield-status span').textContent = game.shield ? 'Escudo pronto' : 'Sem escudo';
    $('#feather-status').classList.toggle('golden', game.feather > 0);
    $('#feather-status').classList.toggle('active', game.feather > 0);
    $('#feather-status span').textContent = game.feather > 0 ? `×2 · ${Math.ceil(game.feather)}s` : 'Pena ×2';
    $('#feather-status progress').value = game.feather;
    if (toastUntil < game.elapsed) $('#toast').classList.remove('visible');
    if (pointsUntil < game.elapsed) $('#score-bonus').textContent = '';
}

function frame(time) {
    const delta = lastTime ? Math.min(.25, Math.max(0, (time - lastTime) / 1000)) : 0;
    lastTime = time;
    game.reducedMotion=reducedMotion.matches;
    clock.advance(delta);
    syncUI();
    forestAudio.update(game.state,!document.hidden&&document.hasFocus(),time/1000,game.stage);
    if (game.state === 'menu') renderer.home(reducedMotion.matches ? 0 : time / 1000, reducedMotion.matches);
    else renderer.game(game.visual(clock.accumulator / (1 / 120)), reducedMotion.matches, time / 1000);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function showCollection() {
    const unlocked = DB.unlocked();
    $('#collection-items').replaceChildren(...FRUITS.map(f => {
        const card = document.createElement('article');
        const title = document.createElement('h3'); title.textContent = f.name;
        const img = new Image(); img.src = `images/fruit-${f.id}.webp`; img.alt = f.name; img.width = 64; img.height = 64; img.style.objectFit = 'contain';
        const text = document.createElement('p'); text.textContent = unlocked.includes(f.id) ? f.description : 'Recolha este alimento para desbloquear a descoberta.';
        card.append(img,title,text); return card;
    }));
    openDialog('#collection-dialog');
}
$('#open-collection').addEventListener('click', showCollection);

renderer.ready.then(() => {
    assetsReady=true;
    $('#asset-status').hidden=true;
    $('#btnStart').disabled=$('#inputPlayer').value.trim().length<3;
}).catch(error => {
    $('#asset-status').textContent=error.message;
    $('#btnStart').disabled=true;
});
