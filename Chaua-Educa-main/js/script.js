import {MatchPerformance,exportMatchReports,MATCH_PERF_SETTING} from './match-performance.mjs';
import {seededRandom} from './encounters.mjs';
import {FlightCues, nativeKeyboardTarget} from './flight-accessibility.mjs';
import {OBSERVATION_DETAILS} from './chapter-learning.mjs';
import {JOURNAL_PHOTOS} from './journal-content.mjs';
import {chapterCheckpoint} from './chapter-checkpoints.mjs';
import {createFlightLearning,advanceFlightLearning,flightLearningEntries} from './flight-learning.mjs';
import {challengeAt} from './challenge.mjs';
import { VisualQuality } from './quality.mjs';
import { activeProbe } from './perf-hooks.mjs';
import { LESSONS, resultAdvice, tutorialInstruction } from './tutorial.mjs';
import { MISSIONS, completedMissions, progressTitle, renderMissions } from './missions.mjs';
import { ENTRIES, discoveriesFor, renderCollection } from './collection.mjs';
import { journeyRain, journeyStorm, journeyWind, getWeatherMode, setWeatherMode } from './weather.mjs';
import { FlightInput } from './input.mjs';
import { isMobileFlightDevice, requestFlightLandscape, releaseFlightLandscape } from './flight-orientation.mjs';
import { ForestAudio } from './audio.mjs';
import { SOURCES } from './questions.mjs';
import { FOODS } from './foods.mjs';
import DB from './database.js';
import { Game, FlightClock, HEIGHT, STAGES } from './engine.mjs';
import {journeyProgress} from './journey.mjs';
import {GAME_VERSION} from './version.mjs';
import { Renderer, drawBird } from './render.mjs';

const $ = selector => document.querySelector(selector);
const app = $('#app');
let betaRuntime=null,betaLoad=null;
DB.onStorageChange=available=>{
    const notice=$('#persistence-status');notice.hidden=available;
    if(!available)notice.textContent='O salvamento neste navegador está indisponível. Novos avanços ficam apenas nesta aba até conseguir salvá-los; mantenha-a aberta.';
};
window.addEventListener('storage',event=>{
    DB.invalidateStorage(event.key);
    if(game.state==='menu')updateChapterButtons();
});
const versionLabel=$('#build-version');
const interfaceBuild=$('meta[name=chaua-build]')?.content||GAME_VERSION;
if(versionLabel)versionLabel.textContent=`Versão ${GAME_VERSION.replace(/-(\d+)$/,'.$1')} · interface ${interfaceBuild} · preparação para a 2.0`;
// Mobile browsers can expose a desktop-sized layout viewport even with a
// portrait phone display. Use the device signals in addition to CSS widths.
const mobileDevice = isMobileFlightDevice(navigator, screen, matchMedia('(pointer: coarse)').matches);
app.classList.toggle('mobile-device', mobileDevice);
document.documentElement.classList.toggle('mobile-device', mobileDevice);
if(mobileDevice) $('.home-links').append($('#open-credits'));
const renderer = new Renderer($('#forest'));
renderer.homeMobileLayout=mobileDevice;
const quality=new VisualQuality(DB.readObject('chaua-visual-quality','auto'));
// Deterministic seed for controlled winter A/B/C tests; normal gameplay is random.
const diagnosticParams=new URLSearchParams(location.search);
const diagnosticLink=diagnosticParams.get('perf-test')==='1';
const matchPerformance=new MatchPerformance({enabled:!diagnosticLink&&DB.readObject(MATCH_PERF_SETTING,true)!==false});
const matchDownloadButtons=document.querySelectorAll('[data-match-download]');

const seedQuery=diagnosticParams.get('test-seed');
let benchmarkFlight=null;
const beforeBenchmarkTick=game=>benchmarkFlight.replay.beforeTick(game);
const fixedTestSeed=seedQuery!==null&&/^\d{1,10}$/.test(seedQuery)&&
 Number(seedQuery)<=0xffffffff?Number(seedQuery):null;
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
let resultAnimation = null, soundOn = true, audioInterrupted = false;
const flightCues = new FlightCues();
const controlsSide=DB.readObject('chaua-controls-side','right');
app.dataset.controlsSide=controlsSide==='left'?'left':'right';
let warningSounds=DB.readObject('chaua-warning-sounds',true)!==false;
let assetsReady = false, lastOrientation = null, openingFlight = false;
let flightMissionIds = [];
let flightLearning=createFlightLearning(),learningReturnFocus=null;
{const saved=DB.readObject('chaua-sound',true);soundOn=typeof saved==='boolean'?saved:true;}

const forestAudio=new ForestAudio();
forestAudio.setEnabled(soundOn);
forestAudio.setVolume(DB.readObject('chaua-volume',.7));
function sound(type) { forestAudio.setEnabled(soundOn);if(!audioInterrupted&&!document.hidden)forestAudio.play(type); }

function toast(text) {
    $('#toast').textContent = text;
    $('#toast').classList.add('visible');
    toastUntil = game.elapsed + 3;
    $('#screen-reader-status').textContent = text;
}

export const game = new Game({ onEvent(event) {
    betaRuntime?.event(event.type);
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
        $('#screen-reader-status').textContent=tutorialInstruction(game.tutorial);
    }
    if(['tutorial-retry','tutorial-trial'].includes(event.type)){flightInput.clear();$('#screen-reader-status').textContent=tutorialInstruction(game.tutorial);}
    if(event.type==='tutorial-complete') DB.completeTutorial();
    if(game.tutorial)return;
    flightLearning=advanceFlightLearning(flightLearning,event);
    if(!benchmarkFlight){
        if(event.type==='stage'&&game.mode==='tranquilo')DB.saveChapterCheckpoint(player,chapterCheckpoint(game));
        if(event.type==='win'&&game.mode==='tranquilo')DB.saveChapterCheckpoint(player,null);
        DB.discoverEntries(discoveriesFor(event));
        if(['fruit','correct','incorrect','stage','route-complete','win'].includes(event.type)) DB.advanceMissions(player,event);
        if (event.type === 'fruit') DB.unlock(event.fruit);
        if (['correct','incorrect'].includes(event.type)) DB.recordDiscovery(player,event.questionId,event.type==='correct');
    }
    const messages = { shield: 'Escudo de penas · um contato protegido', feather: 'Pena dourada · pontos ×2 por 10s de voo', pepper: 'Pimenta da mata · Voo turbo com velocidade e pontos ×2!', 'shield-break': 'Escudo usado · proteção breve para retomar o voo', quiet: 'Uma clareira. Recupere o fôlego.' };
    if(event.type==='stage')toast(event.message);
    if(event.type==='refuge')toast('O bando espera no centro: alinhe o voo para pousar.');
    if(event.type==='medal')toast('1.000 pontos · medalha conquistada! Continue a jornada até o abrigo.');
    if (messages[event.type]) toast(messages[event.type]);
    if(event.type==='shield-kept')toast('Seu escudo já está pronto · proteção mantida');
    if(event.type==='feather' && event.renewed)toast('Pena renovada · mais 10s de pontos ×2');
    if(event.type==='pepper' && event.renewed)toast('Pimenta renovada · mais 6s de turbo e pontos ×2');
    if(event.type==='route-offer')toast('Trilha dourada opcional · +4 sem contato. O centro continua livre.');
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
    const preview=$('.home-preview'),slot=preview?.getBoundingClientRect();
    renderer.homePreview=slot?.width>0&&slot.height>0?{x:slot.x-app.getBoundingClientRect().x+slot.width/2,y:slot.y-app.getBoundingClientRect().y+slot.height/2,scale:Math.min(slot.width/165,slot.height/170),clip:{x:slot.x-app.getBoundingClientRect().x,y:slot.y-app.getBoundingClientRect().y,width:slot.width,height:slot.height}}:null;
    const orientation=innerWidth>innerHeight?'landscape':'portrait';
    if(!openingFlight && lastOrientation && lastOrientation!==orientation && ['playing','countdown','arrival'].includes(game.state)) {
        pauseFlight('A tela mudou de orientação. Confira os controles e continue quando estiver pronto.');
    }
    lastOrientation=orientation;
    if(!benchmarkFlight){
        const view = renderer.getViewport();
        game.viewWidth = Math.max(960, Math.ceil(view.worldLeft + view.worldWidth));
        game.viewLeft = Math.floor(view.worldLeft);
    }
    if(resizeProbe)resizeProbe.end('ui.resize',resizeAt);
}
// Canvas mutations belong to the next animation frame, outside observer delivery.
// Coalesce app/canvas notifications to avoid WebKit's undelivered resize loop.
let observedResize=0;
const layoutObserver=new ResizeObserver(()=>{
    if(observedResize)return;
    observedResize=requestAnimationFrame(()=>{observedResize=0;resize();});
});
layoutObserver.observe(app);
layoutObserver.observe($('#forest'));
layoutObserver.observe($('.home-preview'));
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
    renderer.homeHideCharacter=app.classList.contains('keyboard-open');
}
window.visualViewport?.addEventListener('resize',syncMobileViewport);
window.addEventListener('resize',syncMobileViewport);
document.addEventListener('focusin',syncMobileViewport);
document.addEventListener('focusout',()=>queueMicrotask(syncMobileViewport));
syncMobileViewport();

function clearInputs() { flightInput.clear(); }
function hold(source) { if(!benchmarkFlight)flightInput.press(source); }
function release(source) { flightInput.release(source); }
function closeDialogs() { dialogs.forEach(dialog => { if (dialog.open) dialog.close(); }); }
function resetPanelScroll(dialog) {
    dialog.scrollTop=0; const body=dialog.querySelector('.panel-body'); if(body)body.scrollTop=0;
}
function openDialog(id) {
    const dialog=$(id);
    if(dialog.open)return;
    const probe=activeProbe,at=probe?probe.begin('ui.dialogOpen'):0;
    dialog.showModal(); resetPanelScroll(dialog);
    if(probe)probe.end('ui.dialogOpen',at,{dialog:id});
}

function settleOpeningViewport() {
    return new Promise(resolve=>{
        const started=performance.now();let changedAt=started,lastSize='',frame;
        const finish=()=>{clearTimeout(limit);cancelAnimationFrame(frame);resolve();};
        const check=()=>{
            const now=performance.now(),size=`${innerWidth}x${innerHeight}:${window.visualViewport?.height||innerHeight}`;
            if(size!==lastSize){lastSize=size;changedAt=now;}
            if(document.hidden||(now-started>=400&&now-changedAt>=160)){finish();return;}
            frame=requestAnimationFrame(check);
        };
        const limit=setTimeout(finish,1500);frame=requestAnimationFrame(check);
    });
}
// Start only after the optional browser orientation request. This prevents
// the normal resize-on-rotation safeguard from pausing the countdown itself.
async function launchFlight(training = false, checkpoint = null, benchmark = null) {
    training = training === true;
    if(openingFlight || !assetsReady || !['menu','ended','trained'].includes(game.state)) return;
    openingFlight = true;
    if(mobileDevice)document.activeElement?.blur();
    const mobile = isMobileFlightDevice(navigator, screen, matchMedia('(pointer: coarse)').matches);
    try {
        if(mobile){await requestFlightLandscape(app, document, screen);await settleOpeningViewport();resize();}
    } finally {
        openingFlight = false;
    }
    if(document.hidden)return;
    benchmark?.startCapture();
    start(training,checkpoint,benchmark);
    if(mobile && window.innerHeight > window.innerWidth)
        toast('Para ampliar a visão, ative a rotação automática e vire o celular.');
}

function start(training = false, checkpoint = null, benchmark = null) {
    training = training === true;
    if (!assetsReady || !['menu','ended','trained'].includes(game.state)) return;
    const leavingBenchmark=benchmarkFlight&&!benchmark;
    benchmarkFlight=benchmark;
    game.cosmeticRandom=benchmark?seededRandom(benchmark.fixture.seed ^ 0xa5b35705):null;
    closeDialogs(); clearInputs(); flightCues.reset(); $('#flight-alert').textContent='';
    cancelAnimationFrame(resultAnimation);
    // Reassess the quality profile before the layout-changing in-flight class.
    // Otherwise the renderer may synchronously measure DOM during this transition.
    if(quality.beginFlight())applyVisualQuality();
    app.classList.add('in-flight'); document.documentElement.classList.add('in-flight'); $('#home').hidden = true; $('#hud').hidden = false;
    flightMissionIds = completedMissions(DB.missionProgress(player)).map(m=>m.id);
    // The new in-flight layout is observed after browser layout by the
    // app/canvas ResizeObserver. A synchronous resize here forced style/layout
    // immediately after changing classes and hiding the home screen.
    flightLearning=createFlightLearning(checkpoint?.stage??0);learningReturnFocus=null;
    if(benchmark){
        const {mode,seed,worldWidth}=benchmark.fixture;
        game.viewWidth=worldWidth;game.viewLeft=0;
        game.start(mode,[],seed);
    }else{
        if(leavingBenchmark){
            const view=renderer.getViewport();
            game.viewWidth=Math.max(960,Math.ceil(view.worldLeft+view.worldWidth));
            game.viewLeft=Math.floor(view.worldLeft);
        }
        if(training)game.startTutorial();
        else if(checkpoint){selectedMode='tranquilo';game.resumeChapter(checkpoint,DB.reviewTopics(player));}
        else game.start(selectedMode,DB.reviewTopics(player),fixedTestSeed===null?undefined:fixedTestSeed);
    }
    matchPerformance.start(game,quality,renderer,training);
    if(!diagnosticLink)for(const button of matchDownloadButtons)button.hidden=true;
    forestAudio.beginFlight();
    if(betaRuntime?.active)betaRuntime.attempt();
    renderer.resetFlightPresentation();
    app.classList.toggle('training',training);
    previousState = ''; clock.reset(); lastTime = 0;
    $('#score-bonus').textContent = ''; $('#toast').classList.remove('visible'); toastUntil = 0;
    $('#screen-reader-status').textContent = checkpoint?`Retomando ${STAGES[game.stage]}. Novos pontos nesta tentativa; seu recorde permanece preservado.`:'O voo vai começar. Toque, seta para cima ou espaço para bater asas. Solte para descer.';
    // Remove focus from the submitting/restarting button, avoiding Space clicks.
    $('#flap-button').focus({preventScroll:true});
    syncUI();
}
function home() {
    finishMatchPerformance('returned-to-menu');
    closeDialogs(); clearInputs(); cancelAnimationFrame(resultAnimation);
    game.reset(); flightCues.reset(); previousState = ''; clock.reset(); lastTime = 0;
    releaseFlightLandscape(app, document, screen);
    $('#hud').hidden = true; $('#countdown').hidden = true; $('#home').hidden = false;
    app.classList.remove('in-flight','training'); document.documentElement.classList.remove('in-flight'); updateTrainingButton();updateChapterButtons();

    resize(); if(!mobileDevice)$('#inputPlayer').focus({ preventScroll: true });
}


const fullscreenButtons=[...document.querySelectorAll('.fullscreen-toggle')];
function syncFullscreenControls(){
    const active=document.fullscreenElement===app;
    for(const button of fullscreenButtons){
        button.hidden=typeof app.requestFullscreen!=='function';
        const label=active?'Sair da tela cheia':'Entrar em tela cheia';
        button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(active));button.title=label;
        const text=button.querySelector('.fullscreen-label');if(text)text.textContent=label;
        button.querySelector('use')?.setAttribute('href',active?'#i-collapse':'#i-expand');
    }
}
for(const button of fullscreenButtons)button.addEventListener('click',async()=>{
    if(['playing','countdown','arrival'].includes(game.state))pauseFlight('Ajuste a tela e continue quando estiver pronto.');
    try{
        if(document.fullscreenElement===app)await document.exitFullscreen();
        else await app.requestFullscreen();
    }catch{toast('Este navegador não permitiu alterar a tela cheia. Você pode continuar jogando.');}
    syncFullscreenControls();
});
// Fullscreen promotes the app into the browser's top layer. Some desktop
// browsers leave a modal opened before that promotion underneath the app.
// Reinsert only the pause modal after the native transition; its close event
// has no navigation side effects. Never resume the simulation here.
function restoreFullscreenPause(){
    if(document.fullscreenElement!==app || game.state!=='paused')return;
    const pause=$('#pause-dialog');
    // Another modal (for example settings) may intentionally cover the pause.
    if(dialogs.some(dialog=>dialog!==pause&&dialog.open))return;
    if(pause.open)pause.close();
    openDialog('#pause-dialog');
    $('#resume-button').focus({preventScroll:true});
}
document.addEventListener('fullscreenchange',()=>{
    syncFullscreenControls();
    restoreFullscreenPause();
});
syncFullscreenControls();

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
    event.target.setCustomValidity('');updateChapterButtons();
});
$('#start-form').addEventListener('submit', event => {
    event.preventDefault();
    if(game.state!=='menu')return;
    player = $('#inputPlayer').value.trim();
    if (player.length < 3 || player.length > 24) { $('#inputPlayer').setCustomValidity('Use de 3 a 24 caracteres no seu nome.'); $('#inputPlayer').reportValidity(); return; }
    selectedMode = $('input[name=mode]:checked').value;
    sound('fruit'); void launchFlight();
});
function updateChapterButtons(){
    const name=$('#inputPlayer').value.trim(),friendly=$('input[name=mode]:checked').value==='tranquilo';
    const checkpoint=friendly&&name.length>=3&&name.length<=24?DB.chapterCheckpoint(name):null;
    $('#continue-chapter-menu').hidden=!checkpoint;$('#chapter-menu-note').hidden=!checkpoint;
    $('#continue-chapter-menu').disabled=!assetsReady;
    if(checkpoint)$('#continue-chapter-menu').textContent=`Retomar trecho ${checkpoint.stage+1} · ${STAGES[checkpoint.stage]}`;
}
for(const radio of document.querySelectorAll('input[name=mode]'))radio.addEventListener('change',updateChapterButtons);
$('#continue-chapter-menu').addEventListener('click',()=>{
    if(game.state!=='menu')return;
    const name=$('#inputPlayer').value.trim(),checkpoint=DB.chapterCheckpoint(name);
    if(!checkpoint||name.length<3||name.length>24||$('input[name=mode]:checked').value!=='tranquilo')return;
    player=name;selectedMode='tranquilo';void launchFlight(false,checkpoint);
});
$('#continue-chapter-result').addEventListener('click',()=>{
    const checkpoint=selectedMode==='tranquilo'?DB.chapterCheckpoint(player):null;
    if(checkpoint&&game.state==='ended')void launchFlight(false,checkpoint);
});
$('#restart-button').addEventListener('click', () => { void launchFlight(); });
$('.brand').addEventListener('click', event => { event.preventDefault(); home(); });
document.querySelectorAll('.back-home').forEach(button => button.addEventListener('click', home));
function pauseFlight(message='Seu voo e seus poderes estão pausados.') {
    clearInputs(); game.pause(); clock.reset(); lastTime=0;
    if(game.state==='paused')$('#pause-message').textContent=message;
    syncUI();
}
$('#pause-button').addEventListener('click', () => pauseFlight());
$('#resume-button').addEventListener('click', () => { $('#pause-dialog').close(); clearInputs(); game.resume(); clock.reset(); lastTime=0; syncUI(); $('#flap-button').focus({preventScroll:true}); });
$('#pause-dialog').addEventListener('cancel', event => { event.preventDefault(); $('#resume-button').click(); });
$('#quiz-dialog').addEventListener('cancel', event => event.preventDefault());
$('#result-dialog').addEventListener('cancel', event => { event.preventDefault(); home(); });

$('#flap-button').addEventListener('pointerdown', event => {
    if(event.button!==0)return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); hold(`pointer-${event.pointerId}`);
});
$('#forest').addEventListener('pointerdown', event => {
    if (!app.classList.contains('in-flight') || event.button!==0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); hold(`pointer-${event.pointerId}`);
});
window.addEventListener('pointerup', event => release(`pointer-${event.pointerId}`));
window.addEventListener('pointercancel', event => flightInput.cancel(`pointer-${event.pointerId}`));
$('#flap-button').addEventListener('lostpointercapture', event => flightInput.cancel(`pointer-${event.pointerId}`));
$('#forest').addEventListener('lostpointercapture', event => flightInput.cancel(`pointer-${event.pointerId}`));
$('#flap-button').addEventListener('click', event => { if (event.detail === 0) { hold('activation'); release('activation'); } });
window.addEventListener('keydown', event => {
    if(event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return;
    if (game.state === 'quiz') {
        if(game.observationOpen||event.target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
        if (['v', 'f'].includes(event.key.toLowerCase()) && !event.repeat) { event.preventDefault(); answer(event.key.toLowerCase() === 'v'); }
        return;
    }
    if (!['playing', 'countdown','arrival'].includes(game.state)) return;
    if (['Escape', 'p', 'P'].includes(event.key) && !event.repeat) { event.preventDefault(); pauseFlight(); return; }
    if(nativeKeyboardTarget(event.target)&&event.target!==$('#flap-button'))return;
    if (['ArrowUp', 'Space'].includes(event.code)) { event.preventDefault(); if (!event.repeat) hold(event.code); }
});
window.addEventListener('keyup', event => { if (['ArrowUp', 'Space'].includes(event.code)) release(event.code); });
function autoPause() { audioInterrupted=true; pauseFlight('Você saiu do jogo. O voo está seguro e pausado; continue quando estiver pronto.'); forestAudio.update('paused',false,game.elapsed,game.stage); }
window.addEventListener('pagehide',autoPause);
window.addEventListener('pageshow',event=>{if(event.persisted){autoPause();syncMobileViewport();resize();}});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&app.classList.contains('in-flight'))pauseFlight('A tela cheia foi encerrada. Seu voo continua pausado.');});
window.addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

function updateSoundButton() {
    const button = $('.sound-toggle');
    button.setAttribute('aria-pressed', String(soundOn));
    button.setAttribute('aria-label', soundOn ? 'Silenciar sons' : 'Ativar sons');
    $('.sound-slash').hidden = soundOn;
}
$('.sound-toggle').addEventListener('click', () => { soundOn = !soundOn; DB.writeObject('chaua-sound',soundOn); updateSoundButton();

sound('fruit'); });
updateSoundButton();

const unlockAudio = () => {
    if(document.hidden)return;
    audioInterrupted=false;
    forestAudio.visible=true;
    if (soundOn) {
        forestAudio.ensure();
        if (forestAudio.context && forestAudio.context.state === 'suspended') {
            forestAudio.context.resume().catch(() => {});
        }
    }
};
['pointerdown', 'keydown', 'touchstart'].forEach(evt => window.addEventListener(evt, unlockAudio, { passive: true }));


function answer(value) {
    if(game.state!=='quiz' || game.answerResult!==null || game.observationOpen)return;
    game.answer(value);
    const result = game.answerResult;
    if (result === null) return;
    $('#answer-true').disabled = true; $('#answer-false').disabled = true;
    const feedback = $('#answer-feedback');
    feedback.textContent = result ? `Boa descoberta! +${2 * game.quizMultiplier} pontos.` : `A afirmação é ${game.question.answer ? 'verdadeira' : 'falsa'}. ${game.mode === 'tranquilo' ? 'Você pode continuar o voo.' : 'No Desafio, esta resposta encerra o voo.'}`;
    feedback.textContent += ` ${game.question.explanation} Conteúdo revisado em ${game.question.reviewed.split('-').reverse().join('/')}.`;
    const source = SOURCES[game.question.source];
    const link = document.createElement('a'); link.href = source.url; link.textContent = ' Fonte: ' + source.label; link.target = '_blank'; link.rel = 'noopener noreferrer';
    if(game.question.source !== 'game') feedback.append(link);
    feedback.classList.toggle('incorrect', !result);
    $('#open-observation').hidden=true;
    $('#quiz-continue').hidden = false;
    $('#quiz-continue').textContent = result || game.mode === 'tranquilo' ? 'Continuar o voo →' : 'Ver meu voo →';
    $('#quiz-continue').focus();
}
function returnFromObservation(){
    if(!game.closeObservation())return;
    $('#observation-dialog').close();
    if(game.state==='quiz'){openDialog('#quiz-dialog');$('#open-observation').focus({preventScroll:true});}
}
$('#open-observation').addEventListener('click',()=>{
    if(!game.openObservation())return;
    clearInputs();$('#quiz-dialog').close();
    $('#observation-photo').hidden=false;$('#observation-photo-status').textContent='';
    $('#observation-detail-title').textContent='O que chamou sua atenção?';
    $('#observation-detail-text').textContent='Observe a fotografia e escolha um dos detalhes. Esta atividade não altera seus pontos.';
    $('#observation-detail-source').hidden=true;
    for(const button of document.querySelectorAll('.observation-choices button'))button.setAttribute('aria-pressed','false');
    $('#observation-credit').href=JOURNAL_PHOTOS.portrait.page;
    const image=$('#observation-image');
    image.onerror=()=>{$('#observation-photo').hidden=true;$('#observation-photo-status').textContent='A foto não carregou. As descrições continuam disponíveis; você também pode voltar à pergunta.';};
    image.src=JOURNAL_PHOTOS.portrait.src;
    for(const marker of document.querySelectorAll('.observation-hotspot')){const detail=OBSERVATION_DETAILS[marker.dataset.observationDetail];marker.style.left=detail.left+'%';marker.style.top=detail.top+'%';}
    openDialog('#observation-dialog');$('#observation-return').focus({preventScroll:true});resetPanelScroll($('#observation-dialog'));
    requestAnimationFrame(()=>{if($('#observation-dialog').open)resetPanelScroll($('#observation-dialog'));});
});
for(const button of document.querySelectorAll('[data-observation-detail]'))button.addEventListener('click',()=>{
    const id=button.dataset.observationDetail;if(!game.observeDetail(id))return;
    const detail=OBSERVATION_DETAILS[id];$('#observation-detail-title').textContent=detail.title;$('#observation-detail-text').textContent=detail.text;
    for(const choice of document.querySelectorAll('.observation-choices button'))choice.setAttribute('aria-pressed',String(choice.dataset.observationDetail===id));
    const link=$('#observation-detail-source');link.hidden=detail.source==='game';
    if(!link.hidden){const source=SOURCES[detail.source];link.href=source.url;link.textContent=`Fonte: ${source.label} ↗`;}
});
for(const id of ['observation-close','observation-return'])$('#'+id).addEventListener('click',returnFromObservation);
$('#observation-dialog').addEventListener('cancel',event=>{event.preventDefault();returnFromObservation();});

$('#answer-true').addEventListener('click', () => answer(true));
$('#answer-false').addEventListener('click', () => answer(false));
$('#quiz-continue').addEventListener('click', () => { $('#quiz-dialog').close(); clearInputs(); game.continueQuiz(); syncUI(); });

function result() {
    clearInputs();
    const record = !game.resumed&&DB.upsertPlayerScore(player, game.score, selectedMode);
    const panel = $('#result-dialog .result'); panel.classList.toggle('victory', game.won);
    $('#result-title').textContent = game.won ? 'A floresta celebra!' : 'Opa! Vamos de novo?';
    $('#result-eyebrow').textContent = game.won ? 'O BANDO ESTÁ REUNIDO' : 'CADA VOO É UM COMEÇO';
    $('#result-reason').textContent = game.reason;
    $('#result-advice').textContent = resultAdvice(game);
    $('#result-mode').textContent = selectedMode==='tranquilo'?(game.resumed?'Amigável · retomada de capítulo':'Modo Amigável'):`Desafio · ${challengeAt(game.elapsed).name}`;
    const progress=DB.missionProgress(player);
    const earned=completedMissions(progress).filter(m=>!flightMissionIds.includes(m.id));
    $('#mission-result').textContent=earned.length ? `Novos selos: ${earned.map(m=>m.title).join(' · ')}` : `${progressTitle(progress)} · ${completedMissions(progress).length}/${MISSIONS.length} selos conquistados`;
    renderFlightLearning();
    $('#journey-result').textContent=game.won?`Jornada concluída${game.medal?' · medalha de 1.000 pontos':''}`:`${Math.floor(journeyProgress(game)*100)}% do caminho · ${STAGES[game.stage]}`;
    $('#new-record').hidden = !record || game.score === 0;
    $('#score-breakdown').textContent=`Passagens ${game.scoreBreakdown.passage} · Alimentos ${game.scoreBreakdown.fruit} · Respostas ${game.scoreBreakdown.quiz} · Trilhas ${game.scoreBreakdown.route}. Valores já incluem os bônus da pena e da pimenta.`;
    $('#result-fruits').textContent = game.fruits; $('#result-correct').textContent = game.correct;
    const checkpoint=selectedMode==='tranquilo'&&!game.won?DB.chapterCheckpoint(player):null;
    $('#continue-chapter-result').hidden=!checkpoint;
    if(checkpoint)$('#continue-chapter-result').textContent=`Retomar trecho ${checkpoint.stage+1} · ${STAGES[checkpoint.stage]}`;
    $('#storage-note').textContent = game.resumed?'Pontos desta retomada. Os recordes de voos desde o início permanecem preservados.':DB.storageAvailable ? 'Seu recorde fica salvo neste navegador.' : 'Armazenamento indisponível: recorde mantido apenas nesta sessão.';
    // Reuse the same raster surface across flights; keep the authored result art.
    const birdProbe=activeProbe,birdAt=birdProbe?birdProbe.begin('ui.resultBird'):0;
    const birdCanvas = $('#result-bird canvas');
    const bc = birdCanvas.getContext('2d');
    bc.setTransform(1,0,0,1,0,0);
    bc.clearRect(0,0,birdCanvas.width,birdCanvas.height);
    bc.setTransform(2,0,0,2,0,0);
    drawBird(bc, { x: 68, y: 53, scale: 1.05, perched: true, surprise: !game.won, reduced: true });
    if(birdProbe)birdProbe.end('ui.resultBird',birdAt);
    openDialog('#result-dialog'); $('#restart-button').focus({preventScroll:true}); resetPanelScroll($('#result-dialog'));
    // Native dialog focus can settle after showModal, especially on WebKit.
    requestAnimationFrame(()=>{if($('#result-dialog').open&&game.state==='ended')resetPanelScroll($('#result-dialog'));});
    $('#screen-reader-status').textContent = `${game.won ? 'Vitória' : 'Fim de voo'}. ${game.score} pontos, ${game.fruits} alimentos, ${game.correct} respostas corretas. ${game.reason}`;
    const begin = performance.now(), target = game.score;
    function count(now) {
        const fraction = reducedMotion.matches ? 1 : Math.min(1, (now - begin) / 650);
        $('#result-score').textContent = Math.round(target * (1 - (1 - fraction) ** 3));
        if (fraction < 1) resultAnimation = requestAnimationFrame(count);
    }
    resultAnimation = requestAnimationFrame(count);
}

function renderFlightLearning(){
 const entries=flightLearningEntries(flightLearning),panel=$('#flight-learning');
 panel.hidden=!entries.length;panel.open=false;
 $('#flight-learning-summary').textContent=`${entries.length} tema${entries.length===1?'':'s'} · ${flightLearning.foods.length} alimento${flightLearning.foods.length===1?'':'s'} diferente${flightLearning.foods.length===1?'':'s'} · ${flightLearning.questions.length} pergunta${flightLearning.questions.length===1?'':'s'} respondida${flightLearning.questions.length===1?'':'s'} · ${flightLearning.chapters.length}/4 trechos. As fichas ficam na Chauapédia.`;
 $('#flight-learning-items').replaceChildren(...entries.map(entry=>{
  const button=document.createElement('button');button.type='button';button.className='learning-entry';button.textContent=entry.title+' →';
  button.addEventListener('click',()=>{learningReturnFocus=button;$('#result-dialog').close();showCollection(entry.id);});return button;
 }));
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
        if (game.state === 'paused') { openDialog('#pause-dialog'); $('#resume-button').focus({preventScroll:true}); }
        if (game.state === 'quiz' && !benchmarkFlight) {
            const discovery=game.chapterDiscovery;$('#chapter-discovery').hidden=!discovery;$('#chapter-discovery').open=false;
            if(discovery){
                $('#chapter-discovery-title').textContent=`Neste trecho: ${discovery.title}`;
                $('#chapter-discovery-text').textContent=discovery.text;
                const source=SOURCES[discovery.source];$('#chapter-discovery-source').href=source.url;$('#chapter-discovery-source').textContent=`Fonte: ${source.label} ↗`;
            }
            $('#open-observation').hidden=false;
            $('#question-text').textContent = game.question.text;
            $('#quiz-bonus').textContent = game.quizMultiplier > 1 ? `Bônus ×${game.quizMultiplier} garantido nesta resposta: +${2*game.quizMultiplier} pontos ao acertar.` : 'Uma resposta certa vale +2 pontos.';
            $('#quiz-bonus').textContent += game.mode === 'tranquilo' ? ' Amigável: errar permite continuar.' : ' Desafio: errar encerra o voo.';
            $('#answer-feedback').textContent = ''; $('#quiz-continue').hidden = true;
            $('#answer-true').disabled = false; $('#answer-false').disabled = false;
            openDialog('#quiz-dialog');
        }
        if (game.state === 'ended' || game.state === 'trained') finishMatchPerformance(game.state);
        if (game.state === 'ended' && !benchmarkFlight) result();
        if (game.state === 'trained') {openDialog('#training-dialog');$('#training-home').focus();}
        previousState = game.state;
    }
    const hideCountdown=game.state!=='countdown';
    if(hud('#countdown').hidden!==hideCountdown)hud('#countdown').hidden=hideCountdown;
    if (game.state === 'countdown') {
        const number=Math.max(1,Math.ceil(game.countdown));hudText('#count-number',number);
        if(flightCues.countdown(number)) { $('#screen-reader-status').textContent=`Prepare as asas: ${number}`; sound('countdown'); }
    } else flightCues.countdown(null);
    const cues=flightCues.warnings(game);
    if(cues.length) { hudText('#flight-alert',cues.map(cue=>cue.text).join(' ')); for(const cue of cues)if(warningSounds)sound(cue.sound); }
    else if(!flightCues.hasWarnings(game))hudText('#flight-alert','');
    hudText('#score',game.score);
    hudText('#stage-name',game.tutorial ? (LESSONS[game.tutorial.step]?.title || 'Treino concluído') : STAGES[game.stage]);
    const progress=game.tutorial ? game.tutorial.step/LESSONS.length*100 : Math.min(100,journeyProgress(game)*100);
    hudText('#journey-destination',game.tutorial ? tutorialInstruction(game.tutorial) : game.refuge?'Alinhe o voo com o bando':`Abrigo · ${Math.floor(progress)}%`);
    if(progress!==lastHudProgress){hud('#progress-fill').style.transform=`scaleX(${progress/100})`;lastHudProgress=progress;}
    hudAttribute('#progress-track','aria-valuenow',Math.floor(progress));
    hudAttribute('#progress-track','aria-label',game.tutorial?'Etapas do treino':'Caminho até o abrigo');
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
    const betaStateBefore=game.state;
    const frameWorkStart=performance.now();
    const probe=activeProbe;
    if(probe)probe.beginFrame(time,game.stage);
    const delta = lastTime ? Math.min(.25, Math.max(0, (time - lastTime) / 1000)) : 0;
    lastTime = time;
    game.reducedMotion=!benchmarkFlight&&reducedMotion.matches;
    const clockAt=probe?probe.begin('engine.advance'):0;
    if(benchmarkFlight&&game.state==='quiz'){
        benchmarkFlight.replay.answerQuiz(game);
        clock.reset();
    }
    clock.advance(delta,benchmarkFlight?beforeBenchmarkTick:null);
    if(benchmarkFlight&&game.state==='ended'&&!benchmarkFlight.replay.finished)benchmarkFlight.replay.finish(game);
    if(probe)probe.end('engine.advance',clockAt);
    if(game.state!==previousState || time-lastHudTime>=80){
        const hudAt=probe?probe.begin('ui.sync'):0;
        syncUI();lastHudTime=time;
        if(probe)probe.end('ui.sync',hudAt);
    }
    const sceneTime = game.state === 'menu' ? time / 1000 : (game.sceneTime ?? game.elapsed);
    forestAudio.update(game.state,!audioInterrupted&&!document.hidden&&document.hasFocus(),sceneTime,game.stage,
        journeyRain(game, game.tutorial), journeyStorm(game, game.mode, game.tutorial),
        journeyWind(game, game.mode, game.tutorial));
    if(document.hidden){
        matchPerformance.frame(time,game,quality,renderer,0,false);
        if(betaRuntime?.active)betaRuntime.frame(time,betaStateBefore);
        quality.sample(delta,false);
        if(probe)probe.endFrame();
        requestAnimationFrame(frame);return;
    }
    if (game.state === 'menu'){
        const homeAt=probe?probe.begin('render.home'):0;
        renderer.home(reducedMotion.matches ? 0 : time / 1000, reducedMotion.matches);
        if(probe)probe.end('render.home',homeAt);
    }else{
        if(!benchmarkFlight){
            const view = renderer.getViewport();
            game.viewWidth = Math.max(960, Math.ceil(view.worldLeft + view.worldWidth));
            game.viewLeft = Math.floor(view.worldLeft);
        }
        const visualAt=probe?probe.begin('engine.visual'):0;
        const frameView=game.visual(clock.accumulator / (1 / 120));
        if(probe)probe.end('engine.visual',visualAt,{particles:frameView.particles.length});
        const drawAt=probe?probe.begin('render.game'):0;
        renderer.game(frameView, game.reducedMotion, time / 1000);
        if(probe)probe.end('render.game',drawAt);
    }
    if(probe)probe.endFrame();
    if(betaRuntime?.active)betaRuntime.frame(time,betaStateBefore);
    const activeFlight=document.hasFocus()&&game.state==='playing';
    const frameWorkMs=performance.now()-frameWorkStart;
    matchPerformance.frame(time,game,quality,renderer,frameWorkMs,activeFlight);
    if(quality.sample(delta,activeFlight,frameWorkMs))applyVisualQuality();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function showCollection(entryId=null) {
    const unlocked = DB.unlocked();
    const discovered = DB.discoveredEntries();
    const journal=renderCollection($('#nature-items'),discovered,{foods:unlocked,foodContainer:$('#collection-items'),detailContainer:$('#journal-detail')});
    $('#collection-progress').textContent=`${discovered.length} de ${ENTRIES.length} temas descobertos · ${unlocked.length} de ${FOODS.length} alimentos registrados`;
    setJournalTab('nature');
    openDialog('#collection-dialog');
    if(typeof entryId==='string')journal.openEntry(entryId);
}
function setJournalTab(tab){
    const nature=tab==='nature';
    resetPanelScroll($('#collection-dialog'));
    $('#collection-dialog .journal-shell').classList.remove('is-reading');
    $('#nature-items').hidden=!nature;$('#collection-items').hidden=nature;$('#journal-detail').hidden=true;
    $('#journal-nature-tab').setAttribute('aria-selected',String(nature));$('#journal-food-tab').setAttribute('aria-selected',String(!nature));
}
$('#journal-nature-tab').addEventListener('click',()=>setJournalTab('nature'));
$('#journal-food-tab').addEventListener('click',()=>setJournalTab('foods'));
for(const id of ['journal-nature-tab','journal-food-tab'])$('#'+id).addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const nature=event.key==='Home'||(event.key!=='End'&&id==='journal-food-tab');setJournalTab(nature?'nature':'foods');$(nature?'#journal-nature-tab':'#journal-food-tab').focus();}
});
$('#open-collection').addEventListener('click',()=>showCollection());
$('#collection-dialog').addEventListener('close',()=>{
 const focus=learningReturnFocus;learningReturnFocus=null;
 if(focus&&game.state==='ended'){
  openDialog('#result-dialog');
  // WebKit can restore the closing modal's focus after its close event.
  requestAnimationFrame(()=>{if($('#result-dialog').open&&game.state==='ended'&&focus.isConnected)focus.focus({preventScroll:true});});
 }
});

let loadingGameAssets=false;
async function prepareGameAssets(retry=false) {
    if(loadingGameAssets)return;
    loadingGameAssets=true;assetsReady=false;
    $('#retry-assets').hidden=true;$('#retry-assets').disabled=true;
    $('#asset-status').hidden=false;$('#asset-status').textContent='Carregando as artes da floresta…';
    $('#btnStart').disabled=true;updateTrainingButton();updateChapterButtons();
    try {
        await (retry?renderer.initializeAssets():renderer.ready);
        assetsReady=true;$('#asset-status').hidden=true;
        $('#btnStart').disabled=$('#inputPlayer').value.trim().length<3;
    } catch(error) {
        $('#asset-status').textContent=`As artes não carregaram. Verifique a conexão e tente novamente. ${error.message}`;
        $('#retry-assets').hidden=false;$('#retry-assets').disabled=false;
    } finally {
        loadingGameAssets=false;updateTrainingButton();updateChapterButtons();
    }
}
$('#retry-assets').addEventListener('click',()=>void prepareGameAssets(true));
void prepareGameAssets();

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
    if($('#weather-mode')) $('#weather-mode').value=getWeatherMode();
    $('#controls-side').value=app.dataset.controlsSide;
    $('#warning-sounds').checked=warningSounds;
    $('#settings-sound').checked=soundOn;
    $('#audio-volume').value=Math.round(forestAudio.volume*100);
    $('#volume-value').textContent=`${Math.round(forestAudio.volume*100)}%`;
    openDialog('#settings-dialog');
}
function saveSetting(key,value){
    DB.writeObject(key,value);
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

function finishMatchPerformance(reason){
    const report=matchPerformance.finish(reason,game,quality,renderer);
    if(!report)return;
    for(const button of matchDownloadButtons)button.hidden=false;
    $('#download-match-history').disabled=false;
}
if(!diagnosticLink)for(const button of matchDownloadButtons){
    button.addEventListener('click',()=>{
        const report=matchPerformance.latest();
        if(report)exportMatchReports([report],`chaua-partida-${report.id}.json`);
    });
}
const recordingToggle=$('#auto-match-performance');
recordingToggle.checked=matchPerformance.enabled;
recordingToggle.disabled=diagnosticLink;
recordingToggle.addEventListener('change',()=>matchPerformance.setEnabled(recordingToggle.checked&&!diagnosticLink));
const historyDownload=$('#download-match-history');
historyDownload.disabled=!matchPerformance.latest();
historyDownload.addEventListener('click',()=>exportMatchReports(matchPerformance.all()));
window.addEventListener('pagehide',()=>finishMatchPerformance('pagehide'));

// Diagnostic tooling is opt-in and never loaded in normal gameplay.
// All measurements remain in the device until the player downloads the JSON.
if(diagnosticLink){
    const replayModule=diagnosticParams.get('perf-replay')==='1'?import('./perf-replay.mjs'):null;
    Promise.all([import('./perf-probe.mjs'),replayModule]).then(([{mountPerformanceProbe},reference])=>{
        const replayLaunch=reference?async startCapture=>{
            if(getWeatherMode()!=='winter')throw new Error('O voo de referência requer ?clima=winter.');
            await renderer.ready;
            await launchFlight(false,null,{
                fixture:reference.WINTER_REPLAY,replay:new reference.WinterReplay(),startCapture
            });
        }:null;
        mountPerformanceProbe({game,quality,renderer,replayLaunch,getReplay:()=>benchmarkFlight?.replay});
    }).catch(error=>console.error('Falha ao iniciar diagnóstico local:',error));
}

$('#controls-side').addEventListener('change',event=>{app.dataset.controlsSide=event.target.value;saveSetting('chaua-controls-side',event.target.value);});
$('#warning-sounds').addEventListener('change',event=>{warningSounds=event.target.checked;saveSetting('chaua-warning-sounds',warningSounds);});
$('#settings-sound').addEventListener('change',event=>{soundOn=event.target.checked;DB.writeObject('chaua-sound',soundOn); forestAudio.setEnabled(soundOn);updateSoundButton();if(soundOn)sound('correct');});

// Beta is opened deliberately; ordinary play never imports or starts a collector.
async function openBeta(){
    if(['playing','countdown','arrival'].includes(game.state))pauseFlight();
    try{
        if(!betaLoad)betaLoad=import('./beta-ui.mjs').then(({mountBeta})=>{
            betaRuntime=mountBeta({game,quality,renderer,openDialog,instrumented:()=>!!activeProbe,onStart:()=>{closeDialogs();if(game.state==='paused')openDialog('#pause-dialog');}});return betaRuntime;
        }).catch(error=>{betaLoad=null;throw error;});
        (await betaLoad).open();
    }catch{toast('Não foi possível abrir a beta agora. Tente novamente.');}
}
for(const button of document.querySelectorAll('.beta-entry'))button.addEventListener('click',openBeta);
if(new URLSearchParams(location.search).get('beta')==='1')openBeta();
