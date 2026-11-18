// Opt-in physical-device diagnostics. Imported only with ?perf-test=1.
// Nothing is uploaded or persisted; reports are prepared and downloaded locally.
import {getWeatherMode} from './weather.mjs';
import {journeySeason} from './seasons.mjs';
import {winterAmount} from './living-motion.mjs';
import {ForensicRecorder} from './perf-forensics.mjs';
import {setActiveProbe} from './perf-hooks.mjs';

const MAX_FRAMES=45_000;
const MAX_DETAILS=150;
const SEASON_NAMES=['spring','summer','autumn','winter'];
const round=(x,n=2)=>Number(x.toFixed(n));

// Pure stats shared with the lightweight per-match recorder.
export {summarizeFrames} from './frame-summary.mjs';
import {summarizeFrames} from './frame-summary.mjs';

export function mountPerformanceProbe({game,quality,renderer}){
 if(document.querySelector('#chaua-qa-panel'))return;
 const panel=document.createElement('div');
 panel.id='chaua-qa-panel';
 panel.style.cssText='position:fixed;z-index:99999;bottom:8px;left:8px;max-width:calc(100vw - 16px);padding:8px;border-radius:9px;background:#122d24e8;color:#fff;font:12px/1.4 system-ui;box-shadow:0 4px 14px #0006;display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
 const label=document.createElement('span');label.textContent='Diagnóstico local · inativo';
 const start=document.createElement('button');start.type='button';start.textContent='Iniciar';
 const stop=document.createElement('button');stop.type='button';stop.textContent='Baixar relatório';stop.disabled=true;
 for(const button of [start,stop])button.style.cssText='font:inherit;border:1px solid #b6dec7;border-radius:5px;background:#ecfff2;color:#173a2b;padding:5px 8px;cursor:pointer;';
 const level=document.createElement('select');
 level.id='chaua-perf-level';
 level.setAttribute('aria-label','Detalhamento da telemetria');
 for(const [value,title] of [['normal','Leve'],['deep','Profundo']]){
  const option=document.createElement('option');option.value=value;option.textContent=title;level.append(option);
 }
 level.value=new URLSearchParams(location.search).get('perf-level')==='deep'?'deep':'normal';
 level.style.cssText='font:inherit;border-radius:5px;padding:5px;';
 panel.append(label,level,start,stop);document.body.append(panel);
 let active=false,startTime=0,previous=0,lastUI=0,hasPlayed=false,nextClimate=0;
 let samples=[],changes=[],stutters=[],transitions=[],climateTimeline=[];
 let slowCount=0,severeCount=0,lastProfile='',lastSeason='',lastWeather='',lastStage=null,lastReport=null;
 const forensics=new ForensicRecorder();
 const profile=()=>quality.mode+'/'+quality.level+'/'+renderer.resolution+'/'+renderer.decoration;
 const addTransition=e=>{if(transitions.length<MAX_DETAILS)transitions.push(e);};
 const snapshot=(reason)=>{
  if(climateTimeline.length>=MAX_DETAILS)return;
  const season=journeySeason(game);
  climateTimeline.push({reason,seconds:round(game.elapsed||0),distance:Math.round(game.distance||0),
   weather:getWeatherMode(),from:SEASON_NAMES[season.from],to:SEASON_NAMES[season.to],
   mix:round(season.mix,3),snow:round(winterAmount(game),3)});
 };
 const logBackdrop=(event,details={})=>{
  addTransition({type:'seasonal-backdrop-'+event,
    atSeconds:round((performance.now()-startTime)/1000),...details});
  forensics.event('seasonal-backdrop-'+event,details);
 };
 const download=payload=>{
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='chaua-perf-dispositivo-'+Date.now()+'.json';
  document.body.append(a);a.click();a.remove();
  window.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});
 };
 function finish(reason,downloadNow=false){
  if(!active){if(downloadNow&&lastReport)download(lastReport);return;}
  active=false;previous=0;
  setActiveProbe(null);
  forensics.stopBrowserObservers();
  if(renderer.seasonalBackdrop)renderer.seasonalBackdrop.onTelemetry=null;
  snapshot('flight-end:'+reason);
  const stages={},byProfile={},windows={};
  for(const sample of samples){
   (stages[sample.stage]??=[]).push(sample);
   (byProfile[sample.profile]??=[]).push(sample);
   const key=Math.floor(sample.at/10000)*10;(windows[key]??=[]).push(sample);
  }
  lastReport={
   schemaVersion:1,source:'Chaua Educa / opt-in local performance probe',
   collectedAt:new Date().toISOString(),
   device:{userAgent:navigator.userAgent,deviceMemoryGiB:navigator.deviceMemory??null,
    logicalCores:navigator.hardwareConcurrency??null,screen:[screen.width,screen.height],
    viewport:[innerWidth,innerHeight],devicePixelRatio},
   mode:quality.mode,wallSeconds:round((performance.now()-startTime)/1000,1),
   endReason:reason,match:{seed:game.seed,mode:game.mode,score:game.score,
    won:!!game.won,flightSeconds:round(game.elapsed||0)},
   capped:samples.length===MAX_FRAMES,samplesIncludeOnlyVisibleFocusedPlayingFrames:true,
   summary:{...summarizeFrames(samples),stutterCount:slowCount,severeStutterCount:severeCount},
   byStage:Object.fromEntries(Object.entries(stages).map(([key,v])=>[key,summarizeFrames(v)])),
   byProfile:Object.fromEntries(Object.entries(byProfile).map(([key,v])=>[key,summarizeFrames(v)])),
   byTenSecondWindow:Object.fromEntries(Object.entries(windows).map(([key,v])=>[key,summarizeFrames(v)])),
   profileChanges:changes,stutters,transitions,climateTimeline,
   diagnosticLevel:forensics.deep?'deep':'normal',
   experiments:{snakeWarmupEnabled:!!renderer.snakeWarmupEnabled,
    snakeSheetsWarmed:renderer.snakeWarmupIndex||0,
    seasonalSliceRows:renderer.seasonalBackdrop?.sliceRows??null,
    seasonalBudgetMs:renderer.seasonalBackdrop?.budgetMs??null,
    ignoredLongLightWorkGaps:quality.ignoredSchedulingGaps??0},
   // Causality is NEVER inferred merely from proximity. Long Animation Frames
   // and measured operation timings are provided as separate evidence.
   forensics:forensics.report(stutters)
  };
  // Diagnostic data stays local; browsers may require a user gesture
  // to actually download after death, victory or interruption.
  window.__CHAUA_LAST_LOG__=lastReport;
  start.disabled=false;stop.disabled=false;level.disabled=false;
  label.textContent='Concluído ('+reason+') · '+(lastReport.summary.fps??'—')+' FPS · baixar JSON';
  if(downloadNow)download(lastReport);
 }
 function tick(now){
  if(!active)return;
  const current=profile();
  if(current!==lastProfile){
   changes.push({atSeconds:round((now-startTime)/1000),gameSeconds:round(game.elapsed||0),
    stage:game.stage,profile:current,canvas:[renderer.canvas.width,renderer.canvas.height]});
   addTransition({type:'quality-change',atSeconds:round((now-startTime)/1000),from:lastProfile,to:current});
   lastProfile=current;
  }
  const weather=getWeatherMode(),s=journeySeason(game),season=
   s.from+'>'+s.to+':'+(s.mix>=1?'settled':'blending');
  if(season!==lastSeason){addTransition({type:'season-change',seconds:round(game.elapsed||0),
   from:SEASON_NAMES[s.from],to:SEASON_NAMES[s.to],mix:round(s.mix,3)});lastSeason=season;}
  if(weather!==lastWeather){addTransition({type:'weather-change',seconds:round(game.elapsed||0),from:lastWeather,to:weather});lastWeather=weather;snapshot('weather-change');}
  if(game.stage!==lastStage){addTransition({type:'stage-change',seconds:round(game.elapsed||0),stage:game.stage});lastStage=game.stage;}
  if(now>=nextClimate){snapshot('periodic');nextClimate=now+5000;}
  const eligible=document.visibilityState==='visible'&&document.hasFocus()&&game.state==='playing';
  if(eligible)hasPlayed=true;
  if(eligible&&previous>0&&samples.length<MAX_FRAMES){
   const dt=now-previous;
   if(dt>0&&Number.isFinite(dt)){
    samples.push({dt,at:now-startTime,stage:game.stage,profile:current});
    if(dt>22){
     slowCount++;if(dt>33.33)severeCount++;
     if(stutters.length<MAX_DETAILS){
      let wood=0,hawk=0,snake=0;
      for(const e of game.entities||[]){if(e.kind==='wood'){wood++;if(e.snake)snake++;}else if(e.kind==='hawk')hawk++;}
      stutters.push({frame:samples.length,atSeconds:round((now-startTime)/1000),
       gameSeconds:round(game.elapsed||0),frameMs:round(dt),stage:game.stage,
       pendingBackdrop:renderer.seasonalBackdrop?.pending?.id??null,
       heapUsedMb:Number.isFinite(performance.memory?.usedJSHeapSize)?
         round(performance.memory.usedJSHeapSize/1048576,1):null,
       entities:{wood,hawk,snake,particles:game.particles?.length||0}});
      forensics.rememberStutter(samples.length);
     }
    }
   }
  }
  previous=eligible?now:0;
  if(now-lastUI>1000){label.textContent='Gravando · '+Math.floor((now-startTime)/1000)+'s · '+samples.length+' quadros';lastUI=now;}
  if(hasPlayed&&['ended','trained','menu'].includes(game.state)){finish('flight-'+game.state);return;}
  requestAnimationFrame(tick);
 }
 start.addEventListener('click',()=>{
  if(active)return;
  active=true;hasPlayed=false;startTime=performance.now();previous=0;lastUI=0;nextClimate=0;
  forensics.clear();forensics.startedAt=startTime;
  forensics.deep=level.value==='deep';level.disabled=true;
  forensics.game=game;forensics.startBrowserObservers();
  setActiveProbe(forensics);
  samples=[];changes=[];stutters=[];transitions=[];climateTimeline=[];
  slowCount=0;severeCount=0;lastProfile='';lastSeason='';lastWeather='';lastStage=null;lastReport=null;
  start.disabled=true;stop.disabled=false;
  if(renderer.seasonalBackdrop)renderer.seasonalBackdrop.onTelemetry=logBackdrop;
  requestAnimationFrame(tick);
 });
 stop.addEventListener('click',()=>{if(active)finish('manual-stop',true);else if(lastReport)download(lastReport);});
}
