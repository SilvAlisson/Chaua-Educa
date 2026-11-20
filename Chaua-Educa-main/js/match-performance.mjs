// Built-in, low-overhead per-match diagnosis for the ordinary game URL.
// No second RAF, deep hooks, pixel readbacks, network calls or player names.
// All records stay in localStorage (or memory if unavailable) until exported.
import {summarizeFrames} from './frame-summary.mjs';
import {journeySeason} from './seasons.mjs';
import {getWeatherMode} from './weather.mjs';
import {GAME_VERSION} from './version.mjs';
import {snowMaskMetrics,SNOW_RENDER_MODE} from './tree-art.mjs';
import {ForensicRecorder} from './perf-forensics.mjs';
import {setActiveProbe} from './perf-hooks.mjs';

export const MATCH_PERF_KEY='chaua-performance-matches-v1';
export const MATCH_PERF_SETTING='chaua-performance-auto-enabled';
const MAX_REPORTS=10,MAX_FRAMES=45000,MAX_STUTTERS=100,MAX_EVENTS=80,MAX_SNAPSHOTS=160;
const MAX_LONG_CALLBACKS=50,LONG_CALLBACK_MS=18;
const STUTTER_THRESHOLD_MS=28;
const forensicParams=typeof location==='undefined'?null:new URLSearchParams(location.search);
const MATCH_FORENSICS=forensicParams?.get('match-forensics')==='1';
const SEASON_PREWARM_DISABLED=MATCH_FORENSICS&&forensicParams?.get('season-prewarm')==='off';
const round=(n,d=2)=>Number(Number(n).toFixed(d));
const empty=()=>Object.create(null);
function storageOrNull(){
 try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}
}
function viewportInfo(renderer){
 const nav=typeof navigator==='undefined'?null:navigator;
 const scr=typeof screen==='undefined'?null:screen;
 return {
  userAgent:nav?.userAgent||null,deviceMemoryGiB:nav?.deviceMemory??null,
  logicalCores:nav?.hardwareConcurrency??null,
  screen:scr?[scr.width,scr.height]:null,
  viewport:typeof innerWidth==='number'?[innerWidth,innerHeight]:null,
  devicePixelRatio:typeof devicePixelRatio==='number'?devicePixelRatio:null,
  canvas:renderer?.canvas?[renderer.canvas.width,renderer.canvas.height]:null
 };
}
function byBucket(buckets){
 const result={};
 for(const [name,samples] of Object.entries(buckets))result[name]=summarizeFrames(samples);
 return result;
}
export function exportMatchReports(reports,filename='chaua-desempenho-partidas.json'){
 if(!Array.isArray(reports)||!reports.length)return false;
 const data=reports.length===1?reports[0]:{
  schemaVersion:1,source:'Chaua Educa / exportacao local de partidas',
  exportedAt:new Date().toISOString(),matches:reports
 };
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');
 anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
 return true;
}
export class MatchPerformance {
 constructor({storage=storageOrNull(),enabled=true,maxReports=MAX_REPORTS}={}){
  this.storage=storage;this.enabled=enabled!==false;
  this.forensicEnabled=MATCH_FORENSICS;this.forensic=null;this.forensicBackdrop=null;
  this.maxReports=Math.min(MAX_REPORTS,Math.max(1,Math.floor(maxReports)));
  this.current=null;this.records=[];this.lastReport=null;this.savedToDevice=false;
  try{
   const parsed=JSON.parse(this.storage?.getItem(MATCH_PERF_KEY)||'[]');
   if(Array.isArray(parsed)){
    this.records=parsed.filter(x=>x&&x.schemaVersion===1&&x.summary).slice(-this.maxReports);
    this.lastReport=this.records.at(-1)||null;
   }
  }catch{/* Private mode/storage disabled: keep results in this tab. */}
 }
 setEnabled(enabled){
  this.enabled=enabled!==false;
  if(!this.enabled){
   this.current=null; // Opting out discards unfinished data.
   this.forensic?.stopBrowserObservers();
   if(this.forensic)setActiveProbe(null);
   if(this.forensicBackdrop){
    this.forensicBackdrop.onTelemetry=null;
    this.forensicBackdrop.prewarmEnabled=true;
   }
   this.forensic=null;this.forensicBackdrop=null;
  }
  try{this.storage?.setItem(MATCH_PERF_SETTING,JSON.stringify(this.enabled));}catch{}
 }
 start(game,quality,renderer,training=false){
  if(!this.enabled)return;
  if(this.current)this.finish('restarted',game,quality,renderer);
  // One diagnostic recorder piggybacks on the existing gameplay RAF.
  // No extra RAF, forced Canvas readback or upload timing claims.
  const forensic=this.forensicEnabled?new ForensicRecorder():null;
  this.forensic=forensic;
  this.forensicBackdrop=forensic?renderer.seasonalBackdrop||null:null;
  if(forensic){
   forensic.deep=true;
   forensic.startBrowserObservers();
   setActiveProbe(forensic);
   if(renderer.seasonalBackdrop){
    renderer.seasonalBackdrop.prewarmEnabled=!SEASON_PREWARM_DISABLED;
    renderer.seasonalBackdrop.onTelemetry=(name,details)=>
     forensic.event('seasonal:'+name,{gameSeconds:round(game.elapsed||0),...details});
   }
   forensic.event('trial-start',{seed:game.seed,seasonPrewarm:!SEASON_PREWARM_DISABLED,
    hawkWarmup:renderer.hawkWarmupMode||'legacy',snowRenderer:SNOW_RENDER_MODE});
  }
  this.current={
   id:Date.now()+'-'+Math.floor(Math.random()*100000),
   start:new Date().toISOString(),startNow:typeof performance!=='undefined'?performance.now():0,
   seed:game.seed,mode:game.mode,training:!!training,
   samples:[],byStage:empty(),byWindow:empty(),byProfile:empty(),
   stutters:[],events:[],snapshots:[],profileChanges:[],previous:0,
   longCallbacks:[],longCallbackTotal:0,
   snowMaskPrevious:snowMaskMetrics.rebuilds,snowMaskRebuilds:0,
   snowClipsPrevious:snowMaskMetrics.directClips,snowDirectClips:0,
   snowSpritePrevious:snowMaskMetrics.snowSpriteMetrics.draws,snowSpriteDraws:0,
   previousCpuMs:null,stutterTotal:0,over50:0,over100:0,
   lastSnapshot:0,lastProfile:'',hawkStates:forensic?new Map():null
  };
  this.snapshot(game,quality,renderer,'start');
 }
 event(type,game){
  const c=this.current;
  if(!c||c.events.length>=MAX_EVENTS)return;
  c.events.push({type,gameSeconds:round(game.elapsed||0),stage:game.stage});
 }
 snapshot(game,quality,renderer,reason='periodic'){
  const c=this.current;
  if(!c||c.snapshots.length>=MAX_SNAPSHOTS)return;
  let season=null;
  try{
   const s=journeySeason(game);
   season={from:s.from,to:s.to,mix:round(s.mix,3)};
  }catch{/* Static fixtures and unusual game states may lack a season. */}
  c.snapshots.push({
   reason,gameSeconds:round(game.elapsed||0),distance:round(game.distance||0),
   stage:game.stage,weather:getWeatherMode(),season,
   cold:round(game.surfaceWeather?.cold??0,3),
   snow:round(game.surfaceWeather?.snow??0,3),
   quality:quality.mode+'/'+quality.level,
   textWarningsShown:renderer.showTextWarnings!==false,
   resolution:renderer.resolution,
   decoration:renderer.decoration,
   canvas:[renderer.canvas.width,renderer.canvas.height]
  });
 }
 frame(timestamp,game,quality,renderer,callbackMs,eligible,cpuSections=null){
  const c=this.current;
  if(!c)return;
  if(game.state==='ended'||game.state==='trained'){
   this.finish(game.state,game,quality,renderer);return;
  }
  if(game.state==='menu'){
   this.finish('returned-to-menu',game,quality,renderer);return;
  }
  if(!eligible){
   c.previous=0;c.previousCpuMs=null;
   c.snowMaskPrevious=snowMaskMetrics.rebuilds;
   c.snowClipsPrevious=snowMaskMetrics.directClips;
   c.snowSpritePrevious=snowMaskMetrics.snowSpriteMetrics.draws;
   return;
  }
  // Quality is stable for nearly every frame. Avoid constructing a new
  // four-part profile string at 60+ Hz; still record every real profile change.
  const mode=quality.mode,level=quality.level,resolution=renderer.resolution,
   decoration=renderer.decoration;
  if(mode!==c.lastMode||level!==c.lastLevel||
      resolution!==c.lastResolution||decoration!==c.lastDecoration){
   const profile=mode+'/'+level+'/'+resolution+'/'+decoration;
   if(c.profileChanges.length<MAX_SNAPSHOTS)c.profileChanges.push({
    gameSeconds:round(game.elapsed||0),profile,canvas:[renderer.canvas.width,renderer.canvas.height]
   });
   c.lastProfile=profile;
   c.lastMode=mode;c.lastLevel=level;
   c.lastResolution=resolution;c.lastDecoration=decoration;
  }
  const profile=c.lastProfile;
  if(this.forensic){
   // Log transitions once per hawk/phase, NOT a large event on every frame.
   for(const e of game.entities||[]){
    if(e.kind!=='hawk')continue;
    const state=`${e.phase}:${e.warning>0?'warning':'visible'}:${e.dive?'dive':'flight'}:${e.retreat?'retreat':'active'}`;
    if(c.hawkStates.get(e.id)===state)continue;
    c.hawkStates.set(e.id,state);
    this.forensic.event('hawk-state',{id:e.id,gameSeconds:round(game.elapsed||0),
     phase:e.phase||null,warning:round(e.warning||0),dive:!!e.dive,
     attackKind:e.attackKind||null,retreat:!!e.retreat});
   }
  }
  const snowMaskRebuilds=Math.max(0,snowMaskMetrics.rebuilds-c.snowMaskPrevious);
  const snowDirectClips=Math.max(0,snowMaskMetrics.directClips-c.snowClipsPrevious);
  c.snowMaskPrevious=snowMaskMetrics.rebuilds;
  c.snowClipsPrevious=snowMaskMetrics.directClips;
  c.snowMaskRebuilds+=snowMaskRebuilds;
  c.snowDirectClips+=snowDirectClips;
  const snowSpriteDraws=Math.max(0,snowMaskMetrics.snowSpriteMetrics.draws-c.snowSpritePrevious);
  c.snowSpritePrevious=snowMaskMetrics.snowSpriteMetrics.draws;
  c.snowSpriteDraws+=snowSpriteDraws;
  // Record the largest CPU stalls even when their RAF gap occurs *after*
  // this callback. The normal path performs no allocation or entity scan.
  if(callbackMs>=LONG_CALLBACK_MS){
   c.longCallbackTotal++;
   let position=c.longCallbacks.length;
   if(position>=MAX_LONG_CALLBACKS){
    let smallest=0;
    for(let i=1;i<position;i++)if(c.longCallbacks[i].cpuMs<c.longCallbacks[smallest].cpuMs)smallest=i;
    if(callbackMs<=c.longCallbacks[smallest].cpuMs)position=-1;
    else position=smallest;
   }
   if(position>=0){
    let wood=0,snakes=0,fruit=0,hawks=0,activeSnakeWarnings=0;
    for(const e of game.entities||[]){
     if(e.kind==='wood'){wood++;if(e.snake){snakes++;if(['warning','windup','striking'].includes(e.snake.phase))activeSnakeWarnings++;}}
     else if(e.kind==='hawk')hawks++;
     else if(e.kind==='fruit')fruit++;
    }
    const breakdownMs=cpuSections?{
     physicsMs:round(cpuSections.physicsMs),uiMs:round(cpuSections.uiMs),
     audioMs:round(cpuSections.audioMs),visualMs:round(cpuSections.visualMs),
     drawMs:round(cpuSections.drawMs),otherMs:round(cpuSections.otherMs)
    }:null;
    c.longCallbacks[position]={
     gameSeconds:round(game.elapsed||0),stage:game.stage,cpuMs:round(callbackMs),
     breakdownMs,renderPartsMs:renderer._renderCpuParts&&cpuSections?{
      backgroundMs:round(renderer._renderCpuParts.backgroundMs),
      treesMs:round(renderer._renderCpuParts.treesMs),
      entitiesMs:round(renderer._renderCpuParts.entitiesMs),
      birdMs:round(renderer._renderCpuParts.birdMs),
      particlesMs:round(renderer._renderCpuParts.particlesMs),
      foregroundMs:round(renderer._renderCpuParts.foregroundMs)
     }:null,weather:getWeatherMode(),profile,snowMaskRebuilds,snowDirectClips,snowSpriteDraws,
     textWarningsShown:renderer.showTextWarnings!==false,
     entities:{wood,snakes,fruit,hawks,activeSnakeWarnings,particles:game.particles?.length??0}
    };
   }
  }
  if(c.previous>0&&timestamp>c.previous&&c.samples.length<MAX_FRAMES){
   const dt=timestamp-c.previous,stage=game.stage,windowKey=Math.floor((game.elapsed||0)/10)*10;
   c.samples.push(dt);
   (c.byStage[stage]??(c.byStage[stage]=[])).push(dt);
   (c.byWindow[windowKey]??(c.byWindow[windowKey]=[])).push(dt);
   (c.byProfile[profile]??(c.byProfile[profile]=[])).push(dt);
   if(dt>STUTTER_THRESHOLD_MS){
    c.stutterTotal++;
    if(dt>50)c.over50++;
    if(dt>100)c.over100++;
    let position=c.stutters.length;
    if(position>=MAX_STUTTERS){
     let smallest=0;
     for(let i=1;i<position;i++)if(c.stutters[i].frameMs<c.stutters[smallest].frameMs)smallest=i;
     if(dt<=c.stutters[smallest].frameMs)position=-1;
     else position=smallest;
    }
    if(position>=0){
     let wood=0,hawk=0,snake=0,fruit=0,snakeWarnings=0,hawkWarnings=0;
     for(const entity of game.entities||[]){
      if(entity.kind==='wood'){
       wood++;
       if(entity.snake){
        snake++;
        if(entity.snake.phase==='warning'||entity.snake.phase==='windup'||entity.snake.phase==='striking')snakeWarnings++;
       }
      }else if(entity.kind==='hawk'){
       hawk++;
       if(!entity.harmless&&entity.x>game.x+100)hawkWarnings++;
      }else if(entity.kind==='fruit')fruit++;
     }
     c.stutters[position]={
      frame:c.samples.length,frameMs:round(dt),atSeconds:round((timestamp-c.startNow)/1000),
      gameSeconds:round(game.elapsed||0),
      stage:game.stage,weather:getWeatherMode(),profile,canvas:[renderer.canvas.width,renderer.canvas.height],
      previousCallbackCpuMs:c.previousCpuMs===null?null:round(c.previousCpuMs),
      currentCallbackCpuMs:round(callbackMs),
      pendingSeasonSurface:renderer.seasonalBackdrop?.pending?.id??null,
      cachedSeasonSurfaces:renderer.seasonalBackdrop?.frames?.size??null,
      snowAmount:round(game.surfaceWeather?.snow||0,3),
      heapUsedMb:Number.isFinite(globalThis.performance?.memory?.usedJSHeapSize)?
       round(globalThis.performance.memory.usedJSHeapSize/1048576,2):null,
      snowMaskRebuilds,snowDirectClips,snowSpriteDraws,
      entities:{wood,hawk,snake,fruit,particles:game.particles?.length??0},
      visibleWarnings:{snakes:snakeWarnings,hawks:hawkWarnings},
      textWarningsShown:renderer.showTextWarnings!==false
     };
     if(this.forensic)this.forensic.rememberStutter(c.samples.length);
    }
   }
  }
  c.previous=timestamp;c.previousCpuMs=callbackMs;
  if(timestamp-c.lastSnapshot>=5000){
   c.lastSnapshot=timestamp;this.snapshot(game,quality,renderer);
  }
 }
 finish(reason,game,quality,renderer){
  const c=this.current;
  if(!c)return null;
  this.snapshot(game,quality,renderer,'end:'+reason);
  const forensic=this.forensic;
  if(forensic){
   forensic.event('trial-end',{reason,gameSeconds:round(game.elapsed||0)});
   forensic.stopBrowserObservers();setActiveProbe(null);
   if(renderer.seasonalBackdrop){
    renderer.seasonalBackdrop.onTelemetry=null;
    renderer.seasonalBackdrop.prewarmEnabled=true;
   }
  }
  this.forensic=null;this.forensicBackdrop=null;
  this.current=null;
  const report={
   schemaVersion:1,source:'Chaua Educa / desempenho automatico por partida',
   provenance:{gameVersion:GAME_VERSION,testBranch:'test/forense-causal-raf-v114-20261120',build:typeof document==='undefined'?null:document.querySelector('meta[name="chaua-build"]')?.content||null,host:typeof location!=='undefined'?location.host:null,
    path:typeof location!=='undefined'?location.pathname:null},
   id:c.id,startedAt:c.start,collectedAt:new Date().toISOString(),
   device:viewportInfo(renderer),
   match:{seed:c.seed,mode:c.mode,training:c.training,score:game.score,
    won:!!game.won,flightSeconds:round(game.elapsed||0),stage:game.stage},
   endReason:reason,settings:{qualityMode:quality.mode,qualityLevel:quality.level,
    resolution:renderer.resolution,decoration:renderer.decoration,
    textWarningsShownAtEnd:renderer.showTextWarnings!==false},
   measurement:{eligibleOnly:'visible-focused-playing',deepInstrumentation:!!forensic,
    sampleLimit:MAX_FRAMES,capped:c.samples.length===MAX_FRAMES,
    limitations:['RAF intervals include browser scheduling and are not exclusively CPU or GPU work.',
     'CPU callback timings are not GPU raster measurements.',
     'Frame timestamps after tab switches, pauses and quiz screens are excluded.',
     'Long Animation Frames are browser-reported and may be unavailable on this Android device.',
     'The JSON can correlate JS, scheduling and visible art, but cannot directly prove GPU texture eviction or Skia raster work.']},
   summary:{...summarizeFrames(c.samples),stutterCount:c.stutterTotal,stutterThresholdMs:STUTTER_THRESHOLD_MS},
   byStage:byBucket(c.byStage),byTenSecondWindow:byBucket(c.byWindow),
   byProfile:byBucket(c.byProfile),
   profileChanges:c.profileChanges,climateTimeline:c.snapshots,
   stutters:c.stutters.sort((a,b)=>a.frame-b.frame),
   longCallbacks:{thresholdMs:LONG_CALLBACK_MS,total:c.longCallbackTotal,
    slowest:c.longCallbacks.sort((a,b)=>a.gameSeconds-b.gameSeconds)},
   experiment:{forensicEnabled:!!forensic,seasonPrewarmEnabled:!SEASON_PREWARM_DISABLED,
    hawkWarmup:renderer.hawkWarmupMode||'legacy',snowRenderer:SNOW_RENDER_MODE,
    fixedSeed:c.seed,diagnosticRevision:'causal-raf-v1'},
   forensics:forensic?forensic.report(c.stutters):undefined,
   snowMask:{renderer:SNOW_RENDER_MODE,
    rebuildsDuringFlight:c.snowMaskRebuilds,
    directClipsDuringFlight:c.snowDirectClips,
    spriteDrawsDuringFlight:c.snowSpriteDraws,
    spriteBuildMs:snowMaskMetrics.snowSpriteMetrics.buildMs,
    spriteEstimatedBytes:snowMaskMetrics.snowSpriteMetrics.estimatedBytes},
   events:c.events
  };
  this.lastReport=report;
  this.records.push(report);
  if(this.records.length>this.maxReports)this.records.splice(0,this.records.length-this.maxReports);
  try{this.storage?.setItem(MATCH_PERF_KEY,JSON.stringify(this.records));this.savedToDevice=!!this.storage;}
  catch{this.savedToDevice=false;}
  return report;
 }
 latest(){return this.lastReport;}
 all(){return [...this.records];}
}
