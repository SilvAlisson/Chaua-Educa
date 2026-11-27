// Opt-in, bounded local beta records. Never reads player names, storage or network.
import {summarizeFrames} from './frame-summary.mjs';
import {GAME_VERSION} from './version.mjs';
export const BETA_MAX_FRAMES=120000;
const states=new Set(['menu','countdown','playing','paused','quiz','impact','ended','arrival','trained']);
const groups=new Set(['iniciante','habitual','educador']),devices=new Set(['android','iphone','notebook']),environments=new Set(['fisico','emulado']);
const categories=new Set(['diversao','compreensao','educacao','controles','desempenho','visual','audio','progresso','outro']);
const severities=new Set(['nao-classificado','leve','moderado','grave','bloqueante']);
const eventTypes=new Set(['fruit','correct','incorrect','win','lose','shield-break','tutorial-step','tutorial-complete','stage','browser-error','unhandled-rejection']);
const text=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
const choice=(s,set,fallback='nao-informado')=>set.has(s)?s:fallback;
const rating=v=>Number.isInteger(Number(v))&&Number(v)>=1&&Number(v)<=5?Number(v):null;
const round=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
export class BetaSession {
 constructor({id='sessao-local',build=GAME_VERSION,device={},instrumented=false}={}){
  this.id=text(id,80);this.build=text(build,80);this.device={group:choice(device.group,groups),family:choice(device.family,devices),environment:choice(device.environment,environments),model:text(device.model,80),browser:text(device.browser,80),viewport:Array.isArray(device.viewport)?device.viewport.slice(0,2).map(v=>Number.isFinite(v)?v:null):[],dpr:Number.isFinite(device.dpr)?device.dpr:null};
  this.active=true;this.previous=null;this.startedAt=null;this.lastAt=null;this.frames=new Float32Array(BETA_MAX_FRAMES);this.stages=new Uint8Array(BETA_MAX_FRAMES);this.profileIds=new Uint8Array(BETA_MAX_FRAMES);this.modes=new Uint8Array(BETA_MAX_FRAMES);this.length=0;this.dropped=0;this.transitions=[];this.profiles=[];this.attempts=[];this.currentAttempt=null;this.events={};this.lastContext='';this.instrumented=!!instrumented;this.truncated=false;
 }
 interrupt(){this.previous=null;}
 event(type,game={}){
  if(!this.active||!eventTypes.has(type))return;
  this.events[type]=(this.events[type]||0)+1;
  if(['lose','win','tutorial-complete'].includes(type)&&this.currentAttempt){const a=this.currentAttempt;a.outcome=type;a.score=round(game.score);a.flightSeconds=round(game.elapsed);a.stage=game.stage;}
 }
 attempt(game={}){
  if(!this.active)return;
  this.interrupt();
  if(this.attempts.length>=30){this.truncated=true;this.currentAttempt=null;return;}
  this.attempts.push({seed:game.seed>>>0,mode:game.mode==='tranquilo'?'tranquilo':'aventura',training:!!game.tutorial,resumed:!!game.resumed,partial:!!game.partial,outcome:'nao-concluido'});this.currentAttempt=this.attempts.at(-1);
 }
 frame(now,{stateBefore,stateAfter,visible=true,focused=true,training=false,mode='aventura',stage=0,profile='nao-informado',viewport=[],instrumented=false}={}){
  if(!this.active||!Number.isFinite(now))return;
  if(this.startedAt===null)this.startedAt=now;this.lastAt=now;this.instrumented||=!!instrumented;
  const state=states.has(stateAfter)?stateAfter:'outro',context=state+'|'+mode+'|'+stage+'|'+profile+'|'+viewport.join('x');
  if(context!==this.lastContext){
   if(this.transitions.length<120)this.transitions.push({atSeconds:round((now-this.startedAt)/1000),state,mode:mode==='tranquilo'?'tranquilo':'aventura',stage,profile:text(profile,80),viewport:viewport.slice(0,2)});else this.truncated=true;
   this.lastContext=context;
  }
  if(training||!visible||!focused||stateBefore!=='playing'||stateAfter!=='playing'){this.interrupt();return;}
  if(this.previous!==null&&now>this.previous){
   if(this.length<BETA_MAX_FRAMES){
    let code=this.profiles.indexOf(profile);if(code<0){if(this.profiles.length<30){code=this.profiles.length;this.profiles.push(text(profile,80));}else{code=255;this.truncated=true;}}
    this.frames[this.length]=now-this.previous;this.stages[this.length]=Number.isInteger(stage)&&stage>=0&&stage<=3?stage:255;this.profileIds[this.length]=code;this.modes[this.length]=mode==='tranquilo'?1:0;this.length++;
   }else this.dropped++;
  }
  this.previous=now;
 }
 stop(){this.active=false;this.interrupt();}
 report(feedback={}){
  const values=this.frames.slice(0,this.length),byStage={},byProfile={},byMode={};
  for(let i=0;i<this.length;i++){(byStage[this.stages[i]]??=[]).push(values[i]);(byProfile[this.profiles[this.profileIds[i]]??'outro']??=[]).push(values[i]);(byMode[this.modes[i]?'tranquilo':'aventura']??=[]).push(values[i]);}
  const summary=summarizeFrames(values),tasks={};
  for(const task of ['treino','voo','pergunta','observacao','pausa-retorno','tela-cheia','progresso'])tasks[task]=feedback.tasks?.[task]===true?'concluido':'nao-avaliado';
  return {schemaVersion:1,source:'Chaua Educa / beta local',version:GAME_VERSION,build:this.build,sessionId:this.id,device:{...this.device,viewport:[...this.device.viewport]},active:this.active,
   measurement:{summary,byMode:Object.fromEntries(Object.entries(byMode).map(([k,v])=>[k,summarizeFrames(v)])),byStage:Object.fromEntries(Object.entries(byStage).map(([k,v])=>[k,summarizeFrames(v)])),byProfile:Object.fromEntries(Object.entries(byProfile).map(([k,v])=>[k,summarizeFrames(v)])),sampledPlayingSeconds:round(values.reduce((a,b)=>a+b,0)/1000),wallSeconds:round(this.startedAt!==null&&this.lastAt!==null?(this.lastAt-this.startedAt)/1000:0),droppedFrames:this.dropped,capped:this.dropped>0,boundedDetailsTruncated:this.truncated,additionalInstrumentationObserved:this.instrumented,scope:'RAF intervals between consecutive visible, focused playing frames; pauses, menus, countdown and training excluded',limitations:['Não mede tempo da GPU, RAM residente nem taxa de atualização física.','A classificação de aparelho físico é informada pelo participante, não detectada.','Amostras são limitadas aos primeiros 120.000 intervalos elegíveis; não certificam 60 FPS.']},
   attempts:this.attempts.map(a=>({...a})),events:{...this.events},transitions:this.transitions.map(t=>({...t,viewport:[...t.viewport]})),
   feedback:{fun:rating(feedback.fun),clarity:rating(feedback.clarity),comfort:rating(feedback.comfort),learned:text(feedback.learned,500),category:choice(feedback.category,categories),severity:choice(feedback.severity,severities,'nao-classificado'),problem:text(feedback.problem,800),tasks},
   validationStatus:'aguarda-revisao-humana-e-matriz-real'};
 }
}
