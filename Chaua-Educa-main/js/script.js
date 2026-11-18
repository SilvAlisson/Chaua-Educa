import {challengeAt} from './challenge.mjs';
import { VisualQuality } from './quality.mjs';
import { activeProbe } from './perf-hooks.mjs';
import { LESSONS, resultAdvice } from './tutorial.mjs';
import { MISSIONS, completedMissions, progressTitle, renderMissions } from './missions.mjs';
import { ENTRIES, discoveriesFor, renderCollection } from './collection.mjs';
import { journeyRain, journeyStorm, journeyWind, getWeatherMode, setWeatherMode } from './weather.mjs';
import { FlightInput } from './input.mjs';
import { isMobileFlightDevice, requestFlightLandscape, releaseFlightLandscape } from './flight-orientation.mjs';
import { ForestAudio } from './audio.mjs';
import { SOURCES } from './questions.mjs';
import { FOODS } from './foods.mjs';
import DB from './database.js';
import { Game, FlightClock, HEIGHT, STAGES, VICTORY_SCORE } from './engine.mjs';
import { Renderer, drawBird } from './render.mjs';
import {MatchPerformance,exportMatchReports,MATCH_PERF_SETTING} from './match-performance.mjs';

const $ = selector => document.querySelector(selector);
const app = $('#app');
// Mobile browsers can expose a desktop-sized layout viewport even with a
// portrait phone display. Use the device signals in addition to CSS widths.
const mobileDevice = isMobileFlightDevice(navigator, screen, matchMedia('(pointer: coarse)').matches);
app.classList.toggle('mobile-device', mobileDevice);
document.documentElement.classList.toggle('mobile-device', mobileDevice);
if(mobileDevice) $('.home-links').append($('#open-credits'));
const renderer = new Renderer($('#forest'));
const quality=new VisualQuality(DB.readObject('chaua-visual-quality','auto'));
const diagnosticLink=new URLSearchParams(location.search).get('perf-test')==='1';
const matchPerformance=new MatchPerformance({enabled:!diagnosticLink&&DB.readObject(MATCH_PERF_SETTING,true)!==false});
function applyVisualQuality() {
    if(quality.mode==='auto')renderer.setAutomaticQuality(quality.level);
    else renderer.setQuality(quality.level);
}
applyVisualQuality();
let lastHudTime=0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const dialogs = [...document.querySelectorAll('dialog')];
let player = '', selectedMode = 'aventura', previousState = '', board = 'aventura';
let returnToMissionsResult = false;
let returnToResult = false, lastTime = 0, toastUntil = 0, pointsUntil = 0;
let resultAnimation = null, soundOn = true;
let assetsReady = false, lastOrientation = null, openingFlight = false;
let flightMissionIds = [];
try { const saved = localStorage.getItem('chaua-sound'); soundOn = saved === null ? true : saved === 'true'; } catch { soundOn = true; }

const forestAudio=new ForestAudio();
forestAudio.setEnabled(soundOn);
forestAudio.setVolume(DB.readObject('chaua-volume',.7));
function sound(type) { forestAudio.setEnabled(soundOn);forestAudio.play(type); }

function toast(text) {
    $('#toast').textContent = text;
    $('#toast').classList.add('visible');
    toastUntil = game.elapsed + 3;
    $('#screen-reader-status').textContent = text;
}

export const game = new Game({ onEvent(event) {
    matchPerformance.event(event.type,game);
    const probe=activeProbe;
    if(probe)probe.event('game:'+event.type,{
      gameSeconds:Math.round(game.elapsed*100)/100,stage:game.stage,
      fruit:event.type==='fruit'?event.fruit:undefined});
    if(probe){
      const t=probe.begin('audio.event');sound(event.type);probe.end('audio.event',t,{kind:event.type});
    }else sound(event.type);
    if(event.type==='tutorial-step'){
        if(game.tutorial.step!==2)flightInput.clear();
        $('#screen-reader-status').textContent=LESSONS[game.tutorial.step]?.instruction || 'Treino concluído!';
    }
    if(event.type==='tutorial-complete') DB.completeTutorial();
    if(game.tutorial)return;
    DB.discoverEntries(discoveriesFor(event));
    if(['fruit','correct','incorrect','stage','route-complete','win'].includes(event.type)) DB.advanceMissions(player,event);
    if (event.type === 'fruit') DB.unlock(event.fruit);
    if (['correct','incorrect'].includes(event.type)) DB.recordDiscovery(player,event.questionId,event.type==='correct');
    const messages = { shield: 'Escudo de penas · um contato protegido', feather: 'Pena dourada · pontos ×2 por 10s de voo', pepper: 'Pimenta da mata · Voo turbo com velocidade e pontos ×2!', 'shield-break': 'Escudo usado · proteção breve para retomar o voo', quiet: 'Uma clareira. Recupere o fôlego.' };
    if(event.type==='stage')toast(event.message);
    if(event.type==='refuge')toast('O bando espera no centro: alinhe o voo para pousar.');
    if(event.type==='medal')toast('1.000 pontos · abrigo liberado! Alinhe o voo com o bando.');
    if (messages[event.type]) toast(messages[event.type]);
    if(event.type==='shield-kept')toast('Seu escudo já está pronto · proteção mantida');
    if(event.type==='feather' && event.renewed)toast('Pena renovada · mais 10s de pontos ×2');
    if(event.type==='pepper' && event.renewed)toast('Pimenta renovada · mais 6s de turbo e pontos ×2');
    if(event.type==='route-complete')toast(`Trilha completa · +${event.points} pontos`);
    if (event.type === 'points') {
        $('#score-bonus').textContent = `+${event.value}`; pointsUntil = game.elapsed + 1;
        if(!reducedMotion.matches) {
            const score=$('#score');score.getAnimations().forEach(a=>a.cancel());
            const t=probe?probe.begin('ui.scoreAnimationSetup'):0;
            score.animate([{transform:'scale(1)'},{transform:'scale(1.16)',color:'#b48c32'},{transform:'scale(1)'}],{duration:240});
            if(probe)probe.end('ui.scoreAnimationSetup',t);
        }
    }
} });
const clock = new FlightClock(game);
const flightInput = new FlightInput(game, held => $('#flap-button').classList.toggle('is-held', held));

function resize() {
    const resizeProbe=activeProbe,resizeAt=resizeProbe?resizeProbe.begin('ui.resize'):0;
    const style=getComputedStyle(app);
    renderer.safeInsets=Object.fromEntries(['top','right','bottom','left'].map(side=>[side,parseFloat(style.getPropertyValue(`--safe-${side}`))||0]));
    renderer.resize();
    const orientation=innerWidth>innerHeight?'landscape':'portrait';
    if(lastOrientation && lastOrientation!==orientation && ['playing','countdown','arrival'].includes(game.state)) {
        clearInputs(); game.pause(); clock.reset(); syncUI();
    }
    lastOrientation=orientation;
    const view = renderer.getViewport();
    game.viewWidth = Math.max(960, Math.ceil(view.worldLeft + view.worldWidth));
    game.viewLeft = Math.floor(view.worldLeft);
    if(resizeProbe)resizeProbe.end('ui.resize',resizeAt);
}
const layoutObserver=new ResizeObserver(resize);
layoutObserver.observe(app);
layoutObserver.observe($('#forest'));
window.addEventListener('resize', resize);
// Dynamic browser bars and the software keyboard can resize the visible area
// without changing the layout viewport (notably on iOS). Never resize on pinch zoom.
function syncMobileViewport() {
    if(!mobileDevice)return;
    const vv=window.visualViewport;
    if(vv&&Math.abs(vv.scale-1)>.05)return;
    const height=Math.round(vv?.height||innerHeight);
    const value=`${height}px`;
    if(app.style.getPropertyValue('--app-height')!==value)app.style.setProperty('--app-height',value);
    const typing=document.activeElement?.matches('input:not([type=radio]):not([type=range]),textarea');
    app.classList.toggle('keyboard-open',!!typing&&height<innerHeight*.8);
}
window.visualViewport?.addEventListener('resize',syncMobileViewport);
window.addEventListener('resize',syncMobileViewport);
document.addEventListener('focusin',syncMobileViewport);
document.addEventListener('focusout',()=>queueMicrotask(syncMobileViewport));
syncMobileViewport();

function clearInputs() { flightInput.clear(); }
function hold(source) { flightInput.press(source); }
function release(source) { flightInput.release(source); }
function closeDialogs() { dialogs.forEach(dialog => { if (dialog.open) dialog.close(); }); }
function openDialog(id) {
    const dialog=$(id);
    if(dialog.open)return;
    const probe=activeProbe,at=probe?probe.begin('ui.dialogOpen'):0;
    dialog.showModal();
    if(probe)probe.end('ui.dialogOpen',at,{dialog:id});
}

// Start only after the optional browser orientation request. This prevents
// the normal resize-on-rotation safeguard from pausing the countdown itself.
async function launchFlight(training = false) {
    training = training === true;
    if(openingFlight || !assetsReady || !['menu','ended','trained'].includes(game.state)) return;
    openingFlight = true;
    if(mobileDevice)document.activeElement?.blur();
    const mobile = isMobileFlightDevice(navigator, screen, matchMedia('(pointer: coarse)').matches);
    try {
        if(mobile) await requestFlightLandscape(app, document, screen);
    } finally {
        openingFlight = false;
    }
    start(training);
    if(mobile && window.innerHeight > window.innerWidth)
        toast('Para ampliar a visão, ative a rotação automática e vire o celular.');
}

function start(training = false) {
    training = training === true;
    if (!assetsReady || !['menu','ended','trained'].includes(game.state)) return;
    closeDialogs(); clearInputs();
    cancelAnimationFrame(resultAnimation);
    // Reassess the quality profile before the layout-changing in-flight class.
    // Otherwise the renderer may synchronously measure DOM during this transition.
    if(quality.beginFlight())applyVisualQuality();
    app.classList.add('in-flight'); document.documentElement.classList.add('in-flight'); $('#home').hidden = true; $('#hud').hidden = false;
    flightMissionIds = completedMissions(DB.missionProgress(player)).map(m=>m.id);
    // The new in-flight layout is observed after browser layout by the
    // app/canvas ResizeObserver. A synchronous resize here forced style/layout
    // immediately after changing classes and hiding the home screen.
    if(training)game.startTutorial();else game.start(selectedMode, DB.reviewTopics(player));
    matchPerformance.start(game,quality,renderer,training);
    app.classList.toggle('training',training);
    previousState = ''; clock.reset(); lastTime = 0;
    $('#score-bonus').textContent = ''; $('#toast').classList.remove('visible'); toastUntil = 0;
    $('#screen-reader-status').textContent = 'O voo vai começar. Toque, seta para cima ou espaço para bater asas. Solte para descer.';
    // Remove focus from the submitting/restarting button, avoiding Space clicks.
    document.activeElement?.blur();
    syncUI();
}
function home() {
    if(matchPerformance.finish('returned-to-menu',game,quality,renderer))refreshPerformanceControls();
    closeDialogs(); clearInputs(); cancelAnimationFrame(resultAnimation);
    game.reset(); previousState = ''; clock.reset(); lastTime = 0;
    releaseFlightLandscape(app, document, screen);
    $('#hud').hidden = true; $('#countdown').hidden = true; $('#home').hidden = false;
    app.classList.remove('in-flight','training'); document.documentElement.classList.remove('in-flight'); updateTrainingButton();

    resize(); if(!mobileDevice)$('#inputPlayer').focus({ preventScroll: true });
}

// Install menu controls exactly ONCE per page load, not whenever home() runs.
// Re-registering from home() caused a dead first-click and stacked listeners
// after returning from gameplay.
const WEATHER_MODES = [
    { id: 'auto', label: 'Automático 🍃', icon: '🌤️' },
    { id: 'summer', label: 'Sol de Verão ☀️', icon: '☀️' },
    { id: 'storm', label: 'Tempestade & Relâmpagos ⚡', icon: '⚡' },
    { id: 'rain', label: 'Chuva da Mata 🌧️', icon: '🌧️' },
    { id: 'winter', label: 'Inverno & Neve ❄️', icon: '❄️' },
    { id: 'autumn', label: 'Outono & Vento 🍂', icon: '🍂' },
    { id: 'spring', label: 'Primavera & Flores 🌸', icon: '🌸' }
];

const btnWeather = $('#btn-weather-quick');
const weatherSelect = $('#weather-mode');

function updateWeatherUI() {
    const cur = getWeatherMode();
    const m = WEATHER_MODES.find(w => w.id === cur) || WEATHER_MODES[0];
    if (btnWeather) {
        btnWeather.textContent = m.icon;
        btnWeather.title = `Clima atual: ${m.label} (clique para alternar)`;
    }
    if (weatherSelect) weatherSelect.value = cur;
}

if (btnWeather) {
    btnWeather.addEventListener('click', () => {
        const cur = getWeatherMode();
        const idx = WEATHER_MODES.findIndex(w => w.id === cur);
        const next = WEATHER_MODES[(idx + 1) % WEATHER_MODES.length];
        setWeatherMode(next.id);
        updateWeatherUI();
        toast(`Clima: ${next.label}`);
    });
}

if (weatherSelect) {
    weatherSelect.addEventListener('change', event => {
        setWeatherMode(event.target.value);
        updateWeatherUI();
    });
}


updateWeatherUI();

$('#inputPlayer').addEventListener('input', event => {
    const value = event.target.value;
    $('#btnStart').disabled = !assetsReady || value.trim().length < 3;
    $('#name-count').textContent = `${value.length}/24`;
    event.target.setCustomValidity('');
});
$('#start-form').addEventListener('submit', event => {
    event.preventDefault();
    if(game.state!=='menu')return;
    player = $('#inputPlayer').value.trim();
    if (player.length < 3 || player.length > 24) { $('#inputPlayer').setCustomValidity('Use de 3 a 24 caracteres no seu nome.'); $('#inputPlayer').reportValidity(); return; }
    selectedMode = $('input[name=mode]:checked').value;
    sound('fruit'); void launchFlight();
});
$('#restart-button').addEventListener('click', () => { void launchFlight(); });
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
window.addEventListener('pointercancel', event => flightInput.cancel(`pointer-${event.pointerId}`));
$('#flap-button').addEventListener('lostpointercapture', event => flightInput.cancel(`pointer-${event.pointerId}`));
$('#forest').addEventListener('lostpointercapture', event => flightInput.cancel(`pointer-${event.pointerId}`));
$('#flap-button').addEventListener('click', event => { if (event.detail === 0) { hold('activation'); release('activation'); } });
window.addEventListener('keydown', event => {
    if (game.state === 'quiz') {
        if (['v', 'f'].includes(event.key.toLowerCase()) && !event.repeat) { event.preventDefault(); answer(event.key.toLowerCase() === 'v'); }
        return;
    }
    if (!['playing', 'countdown','arrival'].includes(game.state)) return;
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
$('.sound-toggle').addEventListener('click', () => { soundOn = !soundOn; try { localStorage.setItem('chaua-sound', String(soundOn)); } catch { /* Optional. */ } updateSoundButton();

sound('fruit'); });
updateSoundButton();

const unlockAudio = () => {
    if (soundOn) {
        forestAudio.ensure();
        if (forestAudio.context && forestAudio.context.state === 'suspended') {
            forestAudio.context.resume().catch(() => {});
        }
    }
};
['pointerdown', 'keydown', 'touchstart'].forEach(evt => window.addEventListener(evt, unlockAudio, { passive: true, once: true }));


function answer(value) {
    if(game.state!=='quiz' || game.answerResult!==null)return;
    game.answer(value);
    const result = game.answerResult;
    if (result === null) return;
    $('#answer-true').disabled = true; $('#answer-false').disabled = true;
    const feedback = $('#answer-feedback');
    feedback.textContent = result ? `Boa descoberta! +${2 * game.quizMultiplier} pontos.` : `A afirmação é ${game.question.answer ? 'verdadeira' : 'falsa'}. ${game.mode === 'tranquilo' ? 'Você pode continuar o voo.' : 'No Desafio, esta resposta encerra o voo.'}`;
    feedback.textContent += ` ${game.question.explanation}`;
    const source = SOURCES[game.question.source];
    const link = document.createElement('a'); link.href = source.url; link.textContent = ' Fonte: ' + source.label; link.target = '_blank'; link.rel = 'noopener noreferrer';
    if(game.question.source !== 'game') feedback.append(link);
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
    $('#result-title').textContent = game.won ? 'A floresta celebra: você encontrou o bando!' : 'Opa! Vamos de novo?';
    $('#result-eyebrow').textContent = game.won ? 'O BANDO ESTÁ REUNIDO' : 'CADA VOO É UM COMEÇO';
    $('#result-reason').textContent = game.reason;
    $('#result-advice').textContent = resultAdvice(game);
    $('#result-mode').textContent = selectedMode==='tranquilo'?'Modo Amigável':`Desafio · ${challengeAt(game.elapsed).name}`;
    const progress=DB.missionProgress(player);
    const earned=completedMissions(progress).filter(m=>!flightMissionIds.includes(m.id));
    $('#mission-result').textContent=earned.length ? `Novos selos: ${earned.map(m=>m.title).join(' · ')}` : `${progressTitle(progress)} · ${completedMissions(progress).length}/${MISSIONS.length} selos conquistados`;
    $('#journey-result').textContent=game.won?`Jornada concluída${game.medal?' · medalha de 1.000 pontos':''}`:`${Math.floor(Math.min(1,game.score/VICTORY_SCORE)*100)}% do caminho · ${STAGES[game.stage]}`;
    $('#new-record').hidden = !record || game.score === 0;
    $('#score-breakdown').textContent=`Passagens ${game.scoreBreakdown.passage} · Alimentos ${game.scoreBreakdown.fruit} · Respostas ${game.scoreBreakdown.quiz} · Trilhas ${game.scoreBreakdown.route}. Valores já incluem os bônus da pena e da pimenta.`;
    $('#result-fruits').textContent = game.fruits; $('#result-correct').textContent = game.correct;
    $('#storage-note').textContent = DB.storageAvailable ? 'Seu recorde fica salvo neste navegador.' : 'Armazenamento indisponível: recorde mantido apenas nesta sessão.';
    // Reuse the same raster surface across flights; keep the authored result art.
    const birdProbe=activeProbe,birdAt=birdProbe?birdProbe.begin('ui.resultBird'):0;
    const birdCanvas = $('#result-bird canvas');
    const bc = birdCanvas.getContext('2d');
    bc.setTransform(1,0,0,1,0,0);
    bc.clearRect(0,0,birdCanvas.width,birdCanvas.height);
    bc.setTransform(2,0,0,2,0,0);
    drawBird(bc, { x: 68, y: 53, scale: 1.05, perched: true, surprise: !game.won, reduced: true });
    if(birdProbe)birdProbe.end('ui.resultBird',birdAt);
    openDialog('#result-dialog'); $('#restart-button').focus({preventScroll:true}); $('#result-dialog').scrollTop=0;
    $('#screen-reader-status').textContent = `${game.won ? 'Vitória' : 'Fim de voo'}. ${game.score} pontos, ${game.fruits} alimentos, ${game.correct} respostas corretas. ${game.reason}`;
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

// HUD nodes belong to the fixed page template, unlike dynamically built dialogs.
const hudNodes=new Map();
let lastHudProgress;
function hud(selector){
    if(!hudNodes.has(selector))hudNodes.set(selector,$(selector));
    return hudNodes.get(selector);
}
function hudText(selector,value){
    const node=hud(selector),text=String(value);
    if(node.textContent!==text)node.textContent=text;
}
function hudAttribute(selector,name,value){
    const node=hud(selector),text=String(value);
    if(node.getAttribute(name)!==text)node.setAttribute(name,text);
}
function hudValue(selector,value){const node=hud(selector);if(node.value!==value)node.value=value;}
function hudClass(selector,name,active){
    const node=hud(selector);
    if(node.classList.contains(name)!==active)node.classList.toggle(name,active);
}

function syncUI() {
    if (game.state !== previousState) {
        app.dataset.state = game.state;
        if (!(previousState === 'countdown' && game.state === 'playing')) clearInputs();
        if (game.state === 'paused') openDialog('#pause-dialog');
        if (game.state === 'quiz') {
            $('#question-text').textContent = game.question.text;
            $('#quiz-bonus').textContent = game.quizMultiplier > 1 ? `Bônus ×${game.quizMultiplier} garantido nesta resposta: +${2*game.quizMultiplier} pontos ao acertar.` : 'Uma resposta certa vale +2 pontos.';
            $('#quiz-bonus').textContent += game.mode === 'tranquilo' ? ' Amigável: errar permite continuar.' : ' Desafio: errar encerra o voo.';
            $('#answer-feedback').textContent = ''; $('#quiz-continue').hidden = true;
            $('#answer-true').disabled = false; $('#answer-false').disabled = false;
            openDialog('#quiz-dialog');
        }
        if(game.state==='ended'||game.state==='trained'){
            if(matchPerformance.finish(game.state,game,quality,renderer))refreshPerformanceControls();
        }
        if (game.state === 'ended') result();
        if (game.state === 'trained') {openDialog('#training-dialog');$('#training-home').focus();}
        previousState = game.state;
    }
    const hideCountdown=game.state!=='countdown';
    if(hud('#countdown').hidden!==hideCountdown)hud('#countdown').hidden=hideCountdown;
    if (game.state === 'countdown') hudText('#count-number',Math.max(1, Math.ceil(game.countdown)));
    hudText('#score',game.score);
    hudText('#stage-name',game.tutorial ? (LESSONS[game.tutorial.step]?.title || 'Treino concluído') : STAGES[game.stage]);
    hudText('#journey-destination',game.tutorial ? (LESSONS[game.tutorial.step]?.instruction || 'Pronto para a aventura!') : game.refuge?'Alinhe o voo com o bando':`Abrigo · ${Math.floor(Math.min(1,game.score/VICTORY_SCORE)*100)}%`);
    const progress=game.tutorial ? game.tutorial.step/LESSONS.length*100 : Math.min(100,Math.min(1,game.score/VICTORY_SCORE)*100);
    if(progress!==lastHudProgress){hud('#progress-fill').style.transform=`scaleX(${progress/100})`;lastHudProgress=progress;}
    hudAttribute('#progress-track','aria-valuenow',Math.floor(progress));
    hudAttribute('#progress-track','aria-label',game.tutorial?'Etapas do treino':'Pontos para liberar o abrigo');
    hudValue('#energy',game.stamina);
    hudClass('#shield-status','active',game.shield);
    hudText('#shield-status span',game.shield ? 'Escudo pronto' : 'Sem escudo');
    hudClass('#feather-status','golden',game.feather>0);
    hudClass('#feather-status','active',game.feather>0);
    hudText('#feather-status span',game.feather > 0 ? `×2 · ${Math.ceil(game.feather)}s` : 'Pena ×2');
    hudValue('#feather-status progress',game.feather);
    const pepperChip = hud('#pepper-status');
    if (pepperChip) {
        hudClass('#pepper-status','spicy',game.pepper>0);
        hudClass('#pepper-status','active',game.pepper>0);
        if (hud('#pepper-status span')) hudText('#pepper-status span',game.pepper > 0 ? `Turbo · ${Math.ceil(game.pepper)}s` : 'Pimenta turbo');
        if (hud('#pepper-status progress')) hudValue('#pepper-status progress',game.pepper);
    }
    if (toastUntil < game.elapsed) hudClass('#toast','visible',false);
    if (pointsUntil < game.elapsed) hudText('#score-bonus','');
}

function frame(time) {
    // Include update, UI, audio and drawing work within the RAF callback.
    // This elapsed JS wall time is diagnostic, not a GPU timing measurement.
    const frameWorkStart=performance.now();
    const probe=activeProbe;
    if(probe)probe.beginFrame(time,game.stage);
    const delta = lastTime ? Math.min(.25, Math.max(0, (time - lastTime) / 1000)) : 0;
    lastTime = time;
    game.reducedMotion=reducedMotion.matches;
    const clockAt=probe?probe.begin('engine.advance'):0;
    clock.advance(delta);
    if(probe)probe.end('engine.advance',clockAt);
    if(game.state!==previousState || time-lastHudTime>=80){
        const hudAt=probe?probe.begin('ui.sync'):0;
        syncUI();lastHudTime=time;
        if(probe)probe.end('ui.sync',hudAt);
    }
    forestAudio.update(game.state,!document.hidden&&document.hasFocus(),time/1000,game.stage,
        journeyRain(game, game.tutorial), journeyStorm(game, game.mode, game.tutorial),
        journeyWind(game, game.mode, game.tutorial));
    if(document.hidden){
        matchPerformance.frame(time,game,quality,renderer,0,false);
        quality.sample(delta,false);
        if(probe)probe.endFrame();
        requestAnimationFrame(frame);return;
    }
    if (game.state === 'menu'){
        const homeAt=probe?probe.begin('render.home'):0;
        renderer.home(reducedMotion.matches ? 0 : time / 1000, reducedMotion.matches);
        if(probe)probe.end('render.home',homeAt);
    }else{
        const view = renderer.getViewport();
        game.viewWidth = Math.max(960, Math.ceil(view.worldLeft + view.worldWidth));
        game.viewLeft = Math.floor(view.worldLeft);
        const visualAt=probe?probe.begin('engine.visual'):0;
        const frameView=game.visual(clock.accumulator / (1 / 120));
        if(probe)probe.end('engine.visual',visualAt,{particles:frameView.particles.length});
        const drawAt=probe?probe.begin('render.game'):0;
        renderer.game(frameView, reducedMotion.matches, time / 1000);
        if(probe)probe.end('render.game',drawAt);
    }
    if(probe)probe.endFrame();
    const activeFlight=document.hasFocus()&&game.state==='playing';
    const frameWorkMs=performance.now()-frameWorkStart;
    if(quality.sample(delta,activeFlight,frameWorkMs))applyVisualQuality();
    matchPerformance.frame(time,game,quality,renderer,frameWorkMs,activeFlight);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function showCollection() {
    const unlocked = DB.unlocked();
    const discovered = DB.discoveredEntries();
    renderCollection($('#nature-items'),discovered,{foods:unlocked,foodContainer:$('#collection-items'),detailContainer:$('#journal-detail')});
    $('#collection-progress').textContent=`${discovered.length} de ${ENTRIES.length} temas descobertos · ${unlocked.length} de ${FOODS.length} alimentos registrados`;
    setJournalTab('nature');
    openDialog('#collection-dialog');
}
function setJournalTab(tab){
    const nature=tab==='nature';
    $('#collection-dialog .journal-shell').classList.remove('is-reading');
    $('#nature-items').hidden=!nature;$('#collection-items').hidden=nature;$('#journal-detail').hidden=true;
    $('#journal-nature-tab').setAttribute('aria-selected',String(nature));$('#journal-food-tab').setAttribute('aria-selected',String(!nature));
}
$('#journal-nature-tab').addEventListener('click',()=>setJournalTab('nature'));
$('#journal-food-tab').addEventListener('click',()=>setJournalTab('foods'));
for(const id of ['journal-nature-tab','journal-food-tab'])$('#'+id).addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const nature=event.key==='Home'||(event.key!=='End'&&id==='journal-food-tab');setJournalTab(nature?'nature':'foods');$(nature?'#journal-nature-tab':'#journal-food-tab').focus();}
});
$('#open-collection').addEventListener('click', showCollection);

renderer.ready.then(() => {
    assetsReady=true;
    updateTrainingButton();
    $('#asset-status').hidden=true;
    $('#btnStart').disabled=$('#inputPlayer').value.trim().length<3;
}).catch(error => {
    $('#asset-status').textContent=error.message;
    $('#btnStart').disabled=true;
});

function showMissions(fromResult=false) {
    const name=(fromResult?player:$('#inputPlayer').value).trim();
    if(name.length<3 || name.length>24){
        $('#inputPlayer').setCustomValidity('Digite seu nome para consultar suas missões.');
        $('#inputPlayer').reportValidity();return;
    }
    returnToMissionsResult=fromResult;
    if(fromResult)$('#result-dialog').close();
    const progress=DB.missionProgress(name);
    $('#missions-player').textContent=`${name} · ${progressTitle(progress)}`;
    $('#missions-summary').textContent=`${completedMissions(progress).length}/${MISSIONS.length} selos conquistados. Jogue no seu ritmo: ambos os modos contam.`;
    $('#missions-storage').textContent=DB.storageAvailable?'Progresso salvo por nome neste navegador. Use sempre o mesmo nome.':'Armazenamento indisponível: o progresso novo fica apenas nesta sessão.';
    renderMissions($('#mission-items'),progress);
    openDialog('#missions-dialog');
}
$('#open-missions').addEventListener('click',()=>showMissions());
$('#result-missions').addEventListener('click',()=>showMissions(true));
$('#missions-dialog').addEventListener('close',()=>{
    if(returnToMissionsResult){returnToMissionsResult=false;openDialog('#result-dialog');$('#result-missions').focus();}
});

function updateTrainingButton(){
    $('#start-training').disabled=!assetsReady;
    $('#start-training').textContent=DB.tutorialCompleted()?'Repetir treino de voo':'Experimentar o voo · treino seguro';
}
$('#start-training').addEventListener('click',()=>{ void launchFlight(true); });
$('#training-again').addEventListener('click',()=>{ void launchFlight(true); });
$('#training-home').addEventListener('click',home);
$('#training-dialog').addEventListener('cancel',event=>{event.preventDefault();home();});
updateTrainingButton();

let settingsFromPause=false;
function showSettings(fromPause=false){
    settingsFromPause=fromPause;
    if(fromPause)$('#pause-dialog').close();
    $('#quality-mode').value=quality.mode;
    if($('#auto-match-performance')){
      $('#auto-match-performance').checked=matchPerformance.enabled;
      $('#auto-match-performance').disabled=diagnosticLink;
    }
    refreshPerformanceControls();
    if($('#weather-mode')) $('#weather-mode').value=getWeatherMode();
    $('#audio-volume').value=Math.round(forestAudio.volume*100);
    $('#volume-value').textContent=`${Math.round(forestAudio.volume*100)}%`;
    openDialog('#settings-dialog');
}
function saveSetting(key,value){
    DB.memory.set(key,value);
    try {localStorage.setItem(key,JSON.stringify(value));} catch {DB.storageAvailable=false;}
}
$('#open-settings').addEventListener('click',()=>showSettings());
$('#pause-settings').addEventListener('click',()=>showSettings(true));
$('#settings-dialog').addEventListener('close',()=>{
    if(settingsFromPause && game.state==='paused'){openDialog('#pause-dialog');$('#pause-settings').focus();}
    settingsFromPause=false;
});
$('#quality-mode').addEventListener('change',event=>{
    quality.setMode(event.target.value);applyVisualQuality();saveSetting('chaua-visual-quality',quality.mode);
});
$('#audio-volume').addEventListener('input',event=>{
    forestAudio.setVolume(Number(event.target.value)/100);
    $('#volume-value').textContent=`${Math.round(forestAudio.volume*100)}%`;
    saveSetting('chaua-volume',forestAudio.volume);
});

// Lightweight match telemetry never uploads data or opens a second RAF loop.
function refreshPerformanceControls(){
 const last=matchPerformance.latest(),count=matchPerformance.all().length;
 for(const selector of ['#download-latest-match','#download-training-match']){
  const node=$(selector);if(node)node.disabled=!last;
 }
 const history=$('#download-match-history');if(history)history.disabled=!count;
 const status=$('#performance-history-status');
 if(status)status.textContent=count?
  `${count} partida(s) salvas. Última: ${last?.summary?.fps??'—'} FPS; ${last?.summary?.framesOver33Ms??0} quadros acima de 33 ms.`:
  'Cada partida gera um registro automaticamente neste navegador.';
}
function downloadLatestMatch(){
 const last=matchPerformance.latest();
 if(last)exportMatchReports([last],`chaua-partida-${last.id}.json`);
}
$('#download-latest-match')?.addEventListener('click',downloadLatestMatch);
$('#download-training-match')?.addEventListener('click',downloadLatestMatch);
$('#download-match-history')?.addEventListener('click',()=>{
 const reports=matchPerformance.all();
 if(reports.length)exportMatchReports(reports,'chaua-desempenho-ultimas-partidas.json');
});
$('#auto-match-performance')?.addEventListener('change',event=>{
 matchPerformance.setEnabled(event.target.checked&&!diagnosticLink);
 refreshPerformanceControls();
});
window.addEventListener('pagehide',()=>matchPerformance.finish('pagehide',game,quality,renderer));
refreshPerformanceControls();

// Deep diagnostic tooling is opt-in and never loaded in normal gameplay.
// All measurements remain in the device until the player downloads the JSON.
if(new URLSearchParams(location.search).get('perf-test')==='1'){
    import('./perf-probe.mjs')
        .then(({mountPerformanceProbe})=>mountPerformanceProbe({game,quality,renderer}))
        .catch(error=>console.error('Falha ao iniciar diagnóstico local:',error));
}
