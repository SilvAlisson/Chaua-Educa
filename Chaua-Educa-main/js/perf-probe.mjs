import {snowCapMetrics,winterStageCacheMetrics,resetWinterPrefetchFailures} from './tree-art.mjs';
// Opt-in physical-device diagnostics. Imported only with ?perf-test=1.
// Nothing is uploaded or persisted; reports are prepared and downloaded locally.
import {getWeatherMode} from './weather.mjs';
import {journeySeason} from './seasons.mjs';
import {winterAmount} from './living-motion.mjs';
import {surfaceSnow} from './surface-weather.mjs';
import {images} from './assets.mjs';
import {WINTER_CAP_ART} from './winter-cap-data.mjs';
import {PRECOMPOSED_SNOW_COMPACT_STAGES,PRECOMPOSED_SNOW_STAGE_CACHE,PRECOMPOSED_SNOW_STAGE_PREFETCH,precomposedSnowStage,winterCapFrame,winterCapKey,winterStageKey} from './precomposed-winter.mjs';
import {ForensicRecorder} from './perf-forensics.mjs';
import {setActiveProbe} from './perf-hooks.mjs';
import {PERF_AB_VARIANT,buildPerfTestUrl} from './perf-ab.mjs';
import {GAME_VERSION} from './version.mjs';
import {diagnosticStutterSlot} from './perf-sampling.mjs';

const MAX_FRAMES=45_000;
const MAX_DETAILS=150;
const SEASON_NAMES=['spring','summer','autumn','winter'];
const round=(x,n=2)=>Number(x.toFixed(n));

import {frameBudget,summarizeFrameBudget,summarizeFrames} from './frame-summary.mjs';
export {summarizeFrames} from './frame-summary.mjs';

function topSectionOf(frame){
 if(!frame?.sections)return null;
 let bestName=null,bestMs=0;
 for(const [name,ms] of Object.entries(frame.sections)){
  if(ms>bestMs){bestMs=ms;bestName=name;}
 }
 return bestName?`${bestName}:${bestMs}ms`:null;
}

export function mountPerformanceProbe({game,quality,renderer,replayLaunch=null,getReplay=null}){
 if(document.querySelector('#chaua-qa-panel'))return;
 const params=new URLSearchParams(location.search);
 const budget=frameBudget(params.get('perf-hz')==='120'?120:60);
 const declaredCommit=params.get('perf-commit');
 const validCommit=value=>typeof value==='string'&&/^[0-9a-f]{40}$/i.test(value);
 let build={gitCommit:validCommit(declaredCommit)?declaredCommit.toLowerCase():null,gitCommitSource:validCommit(declaredCommit)?'url':null};
 const embeddedCommit=document.querySelector('meta[name="chaua-git-commit"]')?.content;
 if(validCommit(embeddedCommit))build={gitCommit:embeddedCommit.toLowerCase(),gitCommitSource:'build'};
 else if(!build.gitCommit){
  // Probe the page that already exists. Static hosts may omit the dev-server header.
  const page=new URL(location.href);
  page.search='?chaua-build-info=1';
  page.hash='';
  void fetch(page,{method:'HEAD',cache:'no-store',redirect:'error'}).then(response=>{
   if(!response.ok)return;
   const commit=response.headers.get('X-Chaua-Git-Commit');
   if(validCommit(commit))build={gitCommit:commit.toLowerCase(),gitCommitSource:'build',
    dirty:response.headers.get('X-Chaua-Git-Dirty')==='true'};
  }).catch(()=>{});
 }
 const resultDownloads=document.querySelectorAll('[data-match-download]');
 const panel=document.createElement('div');
 panel.id='chaua-qa-panel';
 panel.style.cssText='position:fixed;z-index:99999;bottom:8px;left:8px;max-width:calc(100vw - 16px);padding:8px;border-radius:9px;background:#122d24e8;color:#fff;font:12px/1.4 system-ui;box-shadow:0 4px 14px #0006;display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
 const label=document.createElement('span');label.textContent='DEV Test · '+PERF_AB_VARIANT+' · '+budget.targetHz+' Hz';
 const start=document.createElement('button');start.type='button';start.textContent='Iniciar';
 const stop=document.createElement('button');stop.type='button';stop.textContent='Baixar relatório';stop.disabled=true;
 for(const button of [start,stop])button.style.cssText='font:inherit;border:1px solid #b6dec7;border-radius:5px;background:#ecfff2;color:#173a2b;padding:5px 8px;cursor:pointer;';
 const makeNavLink=(id,text,href,activeLink=false,title='')=>{
  const a=document.createElement('a');
  a.id=id;a.href=href;a.textContent=text;
  if(title)a.title=title;
  a.style.cssText=`font:inherit;border:1px solid ${activeLink?'#b7f0ca':'#89b99e'};border-radius:5px;padding:4px 8px;text-decoration:none;color:${activeLink?'#122d24':'#ecfff2'};background:${activeLink?'#b7f0ca':'transparent'};font-weight:${activeLink?'700':'400'};`;
  return a;
 };
 const switchA=makeNavLink('chaua-perf-switch-a','Teste A',
  buildPerfTestUrl(location.href,{ab:'precomposed-snow',level:'deep',hz:budget.targetHz,replay:true,weather:'winter'}),
  PERF_AB_VARIANT==='precomposed-snow','Rodar Teste A (Padrão · Inverno + Replay)');
 const switchB=makeNavLink('chaua-perf-switch-b','Teste B',
  buildPerfTestUrl(location.href,{ab:'winter-caps-compact-stages',level:'deep',hz:budget.targetHz,replay:true,weather:'winter'}),
  PERF_AB_VARIANT==='winter-caps-compact-stages','Rodar Teste B (Faixas compactas · Inverno + Replay)');
 const exitLink=makeNavLink('chaua-perf-exit','Sair',
  buildPerfTestUrl(location.href,{enabled:false}),false,'Desativar DEV Test e voltar ao jogo normal');
 const level=document.createElement('select');
 level.id='chaua-perf-level';
 level.setAttribute('aria-label','Detalhamento da telemetria');
 for(const [value,title] of [['normal','Leve'],['deep','Profundo']]){
  const option=document.createElement('option');option.value=value;option.textContent=title;level.append(option);
 }
 level.value=params.get('perf-level')==='deep'?'deep':'normal';
 level.style.cssText='font:inherit;border-radius:5px;padding:5px;';
 const replay=start.cloneNode(false);replay.textContent='Executar voo de referência';
 panel.append(label,level,start,stop);
 if(replayLaunch)panel.append(replay);
 panel.append(switchA,switchB,exitLink);
 document.body.append(panel);

 let active=false,startTime=0,previous=0,lastUI=0,hasPlayed=false,nextClimate=0,nextSeasonCheck=0;
 let snowStart={...snowCapMetrics};
 let stageCacheStart={copies:0,fallbacks:0};
 let stageCacheSwitches=[],stagePrefetchEvents=[];
 let samples=[],changes=[],stutters=[],transitions=[],climateTimeline=[];
 let slowCount=0,severeCount=0,budgetStutters=0,lastReport=null;
 // Scalar state mirrors prevent string/object allocations on every 60-120 Hz tick.
 let lastQMode='',lastQLevel='',lastRes='',lastDeco='',currentProfile='';
 let lastCanvasW=0,lastCanvasH=0;
 let lastSeasonFrom=-1,lastSeasonTo=-1,lastSeasonSettled=null;
 let lastWeather='',lastStage=null,lastGameState='';
 let lastSnowActive=false,lastExpectedSnowPage=null;
 let framesSinceResume=0,lastHeapBytes=null;

 const forensics=new ForensicRecorder();
 const assetVersion=(()=>{try{return JSON.parse(document.querySelector('#chaua-modules')?.textContent||'{}').imports?.['./js/script.js']||null;}catch{return null;}})();
 const addTransition=e=>{if(transitions.length<MAX_DETAILS)transitions.push(e);};
 const snapshot=(reason)=>{
  if(climateTimeline.length>=MAX_DETAILS)return;
  const season=journeySeason(game);
  const snow=surfaceSnow(game),snowStage=precomposedSnowStage(snow);
  climateTimeline.push({reason,seconds:round(game.elapsed||0),distance:Math.round(game.distance||0),
   weather:getWeatherMode(),from:SEASON_NAMES[season.from],to:SEASON_NAMES[season.to],
   mix:round(season.mix,3),cold:round(winterAmount(game),3),
   snow:round(snow,3),snowStage,expectedSnowPage:PRECOMPOSED_SNOW_COMPACT_STAGES?(snowStage||null):(winterCapFrame('lower',snowStage,0)?.[0]??null)});
 };
 const logBackdrop=(event,details={})=>{
  addTransition({type:'seasonal-backdrop-'+event,
    atSeconds:round((performance.now()-startTime)/1000,3),...details});
  forensics.event('seasonal-backdrop-'+event,details);
 };
 const download=payload=>{
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='chaua-perf-dispositivo-'+Date.now()+'.json';
  document.body.append(a);a.click();a.remove();
  window.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});
 };
 const logStageCacheCopy=info=>{
  if(stageCacheSwitches.length>=MAX_DETAILS)return;
  stageCacheSwitches.push({
   ...info,
   atSeconds:round((performance.now()-startTime)/1000,3),
   gameSeconds:round(game.elapsed||0,3),
   replayStep:getReplay?.()?.step??null,
   state:game.state
  });
 };
 function finish(reason,downloadNow=false){
  if(!active){if(downloadNow&&lastReport)download(lastReport);return;}
  active=false;previous=0;
  winterStageCacheMetrics.onCopy=null;
  winterStageCacheMetrics.onPrefetch=null;
  setActiveProbe(null);
  forensics.stopBrowserObservers();
  if(renderer.seasonalBackdrop)renderer.seasonalBackdrop.onTelemetry=null;
  snapshot('flight-end:'+reason);
  const stages={},byProfile={},windows={},hotspots={};
  for(const sample of samples){
   (stages[sample.stage]??=[]).push(sample);
   (byProfile[sample.profile]??=[]).push(sample);
   const key=Math.floor(sample.flightSeconds/10)*10;(windows[key]??=[]).push(sample);
   if(sample.flightSeconds>=30&&sample.flightSeconds<40){
    const start=Math.floor(sample.flightSeconds/2)*2;
    (hotspots[start]??=[]).push(sample);
   }
  }
  const sortedStutters=stutters.sort((a,b)=>a.frame-b.frame);
  const framesByRaf=new Map(forensics.frames.map(frame=>[frame.rafTimestamp,frame]));
  const breakdown={
   totalRecorded:sortedStutters.length,
   withPreviousFrameCpuAtLeast8Ms:0,withPreviousFrameCpuBelow8Ms:0,
   withoutPreviousFrameCpu:0,withHeapDropOver1Mb:0,
   within5FramesOfResume:0,bySnowStage:{},byExpectedSnowPage:{}
  };
  for(const st of sortedStutters){
   const nearby=forensics.stutterFrames.get(st.frame);
   const prevFrame=framesByRaf.get(st.previousRafTimestamp)??nearby?.find(frame=>frame.rafTimestamp===st.previousRafTimestamp);
   const currFrame=framesByRaf.get(st.rafTimestamp)??nearby?.find(frame=>frame.rafTimestamp===st.rafTimestamp);
   st.prevFrameCpuMs=prevFrame?.cpuMs??null;
   st.prevTopSection=topSectionOf(prevFrame);
   st.currFrameCpuMs=currFrame?.cpuMs??null;
   st.currTopSection=topSectionOf(currFrame);
   if(!Number.isFinite(st.prevFrameCpuMs))breakdown.withoutPreviousFrameCpu++;
   else if(st.prevFrameCpuMs>=8)breakdown.withPreviousFrameCpuAtLeast8Ms++;
   else breakdown.withPreviousFrameCpuBelow8Ms++;
   if(Number.isFinite(st.heapDeltaMb)&&st.heapDeltaMb<=-1)breakdown.withHeapDropOver1Mb++;
   if(Number.isFinite(st.framesSinceResume)&&st.framesSinceResume<=5)breakdown.within5FramesOfResume++;
   const ssKey=String(st.snowStage);
   breakdown.bySnowStage[ssKey]=(breakdown.bySnowStage[ssKey]||0)+1;
   const spKey=st.expectedSnowPage===null?'none':String(st.expectedSnowPage);
   breakdown.byExpectedSnowPage[spKey]=(breakdown.byExpectedSnowPage[spKey]||0)+1;
  }
  const summarize=values=>({...summarizeFrames(values),...summarizeFrameBudget(values,budget)});
  const replayResult=getReplay?.()?.result()??null;
  lastReport={
   schemaVersion:1,source:'Chaua Educa / opt-in local performance probe',
   provenance:{gameVersion:GAME_VERSION,assetVersion,diagnosticRevision:'flight-benchmark-2',
    host:location.host,path:location.pathname,...build},
   collectedAt:new Date().toISOString(),
   device:{userAgent:navigator.userAgent,deviceMemoryGiB:navigator.deviceMemory??null,
    logicalCores:navigator.hardwareConcurrency??null,screen:[screen.width,screen.height],
    viewport:[innerWidth,innerHeight],devicePixelRatio,canvas:[renderer.canvas.width,renderer.canvas.height]},
   frameBudget:budget,windowTimebase:'flight-seconds',replay:replayResult,
   mode:quality.mode,wallSeconds:round((performance.now()-startTime)/1000,1),
   endReason:reason,match:{seed:game.seed,mode:game.mode,score:game.score,
    won:!!game.won,flightSeconds:round(game.elapsed||0)},
   capped:samples.length===MAX_FRAMES,samplesIncludeOnlyVisibleFocusedPlayingFrames:true,
   summary:{...summarize(samples),stutterCount:slowCount,severeStutterCount:severeCount},
   byStage:Object.fromEntries(Object.entries(stages).map(([key,v])=>[key,summarize(v)])),
   byProfile:Object.fromEntries(Object.entries(byProfile).map(([key,v])=>[key,summarize(v)])),
   byTenSecondWindow:Object.fromEntries(Object.entries(windows).map(([key,v])=>[key,summarize(v)])),
   hotspotTwoSecondWindows:Object.fromEntries([30,32,34,36,38].map(start=>[
    `${start}-${start+2}s`,summarize(hotspots[start]??[])
   ])),
   stutterBreakdown:breakdown,
   profileChanges:changes,stutters:sortedStutters,transitions,climateTimeline,
   stutterSelection:'bounded-reservoir-with-severe-frame-priority',
   diagnosticLevel:forensics.deep?'deep':'normal',
   snowCaps:{rebuilds:snowCapMetrics.rebuilds-snowStart.rebuilds,hits:snowCapMetrics.hits-snowStart.hits,directDraws:snowCapMetrics.directDraws-snowStart.directDraws},
   winterStageCache:{
    active:PRECOMPOSED_SNOW_STAGE_CACHE||PRECOMPOSED_SNOW_COMPACT_STAGES,
    compactStages:PRECOMPOSED_SNOW_COMPACT_STAGES,
    copies:winterStageCacheMetrics.copies-stageCacheStart.copies,
    fallbacks:winterStageCacheMetrics.fallbacks-stageCacheStart.fallbacks,
    activeStage:winterStageCacheMetrics.activeStage,
    activePage:winterStageCacheMetrics.activePage,
    predecodedHits:winterStageCacheMetrics.predecodedHits-stageCacheStart.predecodedHits,
    syncCopies:winterStageCacheMetrics.syncCopies-stageCacheStart.syncCopies,
    switches:stageCacheSwitches,
    prefetchEvents:stagePrefetchEvents
   },
   experiments:{perfAB:PERF_AB_VARIANT,flightBackend:renderer.flightBackend??'canvas2d',
    backendError:renderer.flightBackendError??null,
    winterCapRepresentations:PRECOMPOSED_SNOW_COMPACT_STAGES
     ?(WINTER_CAP_ART.stagePages||[]).filter(Boolean).map(page=>{
      const asset=images.get(winterStageKey(page.stage));
      return asset?(asset._representation??'image'):null;
     })
     :WINTER_CAP_ART.pages.map((_,page)=>{
      const asset=images.get(winterCapKey(page));
      return asset?(asset._representation??'image'):null;
     }),
    snakeWarmupEnabled:!!renderer.snakeWarmupEnabled,
    snakeSheetsWarmed:renderer.snakeWarmupIndex||0,
    seasonalBackdrop:renderer.seasonalBackdropMode,
    wetFruit:renderer.wetFruitMode,
    winterLoadingMode:renderer.winterStageStream?'streamed':'eager',
    winterLoading:renderer.winterStageStream?.report()??null,
    assetStartupMs:renderer.assetStartupMs??null,
    sceneGraph:renderer.c.sceneGraphReport?.()??null,
    seasonalSliceRows:renderer.seasonalBackdropMode==='cached-strips'?renderer.seasonalBackdrop?.sliceRows??null:null,
    seasonalBudgetMs:renderer.seasonalBackdropMode==='cached-strips'?renderer.seasonalBackdrop?.budgetMs??null:null,
    ignoredLongLightWorkGaps:quality.ignoredSchedulingGaps??0},
   // Causality is NEVER inferred merely from proximity. Long Animation Frames
   // and measured operation timings are provided as separate evidence.
   forensics:forensics.report(sortedStutters)
  };
  // Diagnostic data stays local; browsers may require a user gesture
  // to actually download after death, victory or interruption.
  window.__CHAUA_LAST_LOG__=lastReport;
  for(const button of resultDownloads)button.hidden=false;
  start.disabled=false;stop.disabled=false;level.disabled=false;replay.disabled=false;
  const outcome=replayResult?(replayResult.completed?'Voo de referência concluído':'Voo de referência incompleto'):'Concluído ('+reason+')';
  label.textContent=outcome+' · '+(lastReport.summary.fps??'—')+' FPS · baixar JSON';
  if(downloadNow)download(lastReport);
 }
 function tick(now){
  if(!active)return;
  const wallNow=performance.now();
  const cw=renderer.canvas.width,ch=renderer.canvas.height;
  const profileChanged=quality.mode!==lastQMode||quality.level!==lastQLevel||
   renderer.resolution!==lastRes||renderer.decoration!==lastDeco;
  if(profileChanged||cw!==lastCanvasW||ch!==lastCanvasH){
   const prevProfile=currentProfile;
   if(profileChanged){
    lastQMode=quality.mode;lastQLevel=quality.level;lastRes=renderer.resolution;lastDeco=renderer.decoration;
    currentProfile=lastQMode+'/'+lastQLevel+'/'+lastRes+'/'+lastDeco;
   }
   lastCanvasW=cw;lastCanvasH=ch;
   const atSeconds=round((wallNow-startTime)/1000,3);
   changes.push({atSeconds,gameSeconds:round(game.elapsed||0),
    stage:game.stage,profile:currentProfile,canvas:[cw,ch]});
   addTransition({type:'quality-change',atSeconds,from:prevProfile,to:currentProfile});
  }
  const weather=getWeatherMode();
  const weatherChanged=weather!==lastWeather;
  const stageChanged=game.stage!==lastStage;
  if(weatherChanged){
   addTransition({type:'weather-change',seconds:round(game.elapsed||0),from:lastWeather,to:weather});
   lastWeather=weather;snapshot('weather-change');
  }
  if(stageChanged){
   addTransition({type:'stage-change',seconds:round(game.elapsed||0),stage:game.stage});
   lastStage=game.stage;
  }
  if(game.state!==lastGameState){
   const details={atSeconds:round((wallNow-startTime)/1000,3),seconds:round(game.elapsed||0),
    from:lastGameState,to:game.state,replayStep:getReplay?.()?.step??null};
   addTransition({type:'state-change',...details});
   forensics.event('state-change',details);
   lastGameState=game.state;
   framesSinceResume=0;
  }
  if(weatherChanged||stageChanged||now>=nextSeasonCheck){
   nextSeasonCheck=now+250;
   const s=journeySeason(game),settled=s.mix>=1;
   if(s.from!==lastSeasonFrom||s.to!==lastSeasonTo||settled!==lastSeasonSettled){
    addTransition({type:'season-change',seconds:round(game.elapsed||0),
     from:SEASON_NAMES[s.from],to:SEASON_NAMES[s.to],mix:round(s.mix,3)});
    lastSeasonFrom=s.from;lastSeasonTo=s.to;lastSeasonSettled=settled;
   }
  }
  const snow=surfaceSnow(game),snowStage=precomposedSnowStage(snow);
  const snowActive=snow>0.15;
  if(snowActive!==lastSnowActive){
   const details={atSeconds:round((wallNow-startTime)/1000,3),seconds:round(game.elapsed||0),
    active:snowActive,snow:round(snow,3),snowStage,replayStep:getReplay?.()?.step??null};
   addTransition({type:'snow-threshold-crossing',...details});
   forensics.event('snow-threshold-crossing',details);
   lastSnowActive=snowActive;
  }
  const expectedSnowPage=PRECOMPOSED_SNOW_COMPACT_STAGES?(snowStage||null):(winterCapFrame('lower',snowStage,0)?.[0]??null);
  if(expectedSnowPage!==lastExpectedSnowPage){
   const details={atSeconds:round((wallNow-startTime)/1000,3),seconds:round(game.elapsed||0),
    from:lastExpectedSnowPage,to:expectedSnowPage,snowStage,replayStep:getReplay?.()?.step??null};
   addTransition({type:'expected-winter-cap-page',...details});

   lastExpectedSnowPage=expectedSnowPage;
  }
  if(now>=nextClimate){snapshot('periodic');nextClimate=now+5000;}
  const eligible=document.visibilityState==='visible'&&document.hasFocus()&&game.state==='playing';
  if(eligible){
   hasPlayed=true;
   framesSinceResume++;
  }
  const heapBytes=forensics.deep&&eligible?performance.memory?.usedJSHeapSize:undefined;
  const hasHeap=Number.isFinite(heapBytes);
  if(eligible&&previous>0&&samples.length<MAX_FRAMES){
   const dt=now-previous;
   if(dt>0&&Number.isFinite(dt)){
    samples.push({dt,flightSeconds:game.elapsed,stage:game.stage,profile:currentProfile});
    if(dt>22)slowCount++;
    if(dt>33.33)severeCount++;
    if(dt>budget.slowFrameThresholdMs){
     const slot=diagnosticStutterSlot(++budgetStutters,MAX_DETAILS,samples.length,dt,stutters);
     if(slot>=0){
      let wood=0,hawk=0,hawkWarning=0,hawkActive=0,snake=0,snakeActive=0,fruit=0;
      const entities=game.entities;
      if(entities)for(let i=0;i<entities.length;i++){
       const e=entities[i];
       if(e.kind==='wood'){
        wood++;
        if(e.snake){
         snake++;
         if(!e.snake.retreat&&e.snake.phase!=='watching'&&e.snake.phase!=='spent'&&e.snake.phase!=='leaving')snakeActive++;
        }
       }else if(e.kind==='hawk'){
        hawk++;
        if(e.warning>0)hawkWarning++;else if(!e.harmless)hawkActive++;
       }else if(e.kind==='fruit'&&!e.collected)fruit++;
      }
      if(stutters[slot]&&forensics.deep)forensics.discardStutter(stutters[slot].frame);
      stutters[slot]={
       frame:samples.length,
       atSeconds:(now-startTime)/1000,
       collectedAtSeconds:round((wallNow-startTime)/1000,3),
       previousRafTimestamp:previous,
       rafTimestamp:now,
       gameSeconds:round(game.elapsed||0,3),
       replayStep:getReplay?.()?.step??null,
       frameMs:dt,
       framesSinceResume,
       stage:game.stage,
       snow:round(snow,3),snowStage,expectedSnowPage,
       pendingBackdrop:renderer.seasonalBackdrop?.pending?.id??null,
       heapUsedMb:hasHeap?round(heapBytes/1048576,2):null,
       heapDeltaMb:hasHeap&&Number.isFinite(lastHeapBytes)?round((heapBytes-lastHeapBytes)/1048576,2):null,
       entities:{wood,hawk,hawkWarning,hawkActive,snake,snakeActive,fruit,particles:game.particles?.length||0}
      };
      if(forensics.deep)forensics.rememberStutter(samples.length);
     }
    }
   }
  }
  previous=eligible?now:0;
  if(!eligible){framesSinceResume=0;lastHeapBytes=null;}
  else lastHeapBytes=hasHeap?heapBytes:null;
  // Never mutate the fixed overlay DOM while actively flying: repainting the
  // probe panel every second can introduce compositor jitter into the sample.
  if(game.state!=='playing'&&now-lastUI>1000){
   label.textContent='Gravando · '+Math.floor((wallNow-startTime)/1000)+'s · '+samples.length+' quadros';
   lastUI=now;
  }
  if(hasPlayed&&['ended','trained','menu'].includes(game.state)){finish('flight-'+game.state);return;}
  requestAnimationFrame(tick);
 }
 function startCapture(){
  if(active)return;
  for(const button of resultDownloads)button.hidden=true;
  snowStart={...snowCapMetrics};
  stageCacheStart={copies:winterStageCacheMetrics.copies,fallbacks:winterStageCacheMetrics.fallbacks,predecodedHits:winterStageCacheMetrics.predecodedHits,syncCopies:winterStageCacheMetrics.syncCopies};
  stageCacheSwitches=[];
  stagePrefetchEvents=[];
  if(PRECOMPOSED_SNOW_STAGE_PREFETCH){
   resetWinterPrefetchFailures();
   winterStageCacheMetrics.onPrefetch=info=>{
    if(stagePrefetchEvents.length<MAX_DETAILS)stagePrefetchEvents.push({
     ...info,atSeconds:round((performance.now()-startTime)/1000,3),gameSeconds:round(game.elapsed||0,3)
    });
   };
  }
  winterStageCacheMetrics.onCopy=(PRECOMPOSED_SNOW_STAGE_CACHE||PRECOMPOSED_SNOW_COMPACT_STAGES)?logStageCacheCopy:null;
  active=true;hasPlayed=false;startTime=performance.now();previous=0;lastUI=0;nextClimate=0;nextSeasonCheck=0;
  forensics.clear();forensics.startedAt=startTime;
  forensics.deep=level.value==='deep';level.disabled=true;
  forensics.game=game;
  // Leve: preserve RAF measurements without the overhead of deep JS hooks.
  if(forensics.deep){forensics.startBrowserObservers();setActiveProbe(forensics);}
  else setActiveProbe(null);
  samples=[];changes=[];stutters=[];transitions=[];climateTimeline=[];
  slowCount=0;severeCount=0;budgetStutters=0;lastReport=null;
  lastQMode='';lastQLevel='';lastRes='';lastDeco='';currentProfile='';
  lastCanvasW=0;lastCanvasH=0;
  lastSeasonFrom=-1;lastSeasonTo=-1;lastSeasonSettled=null;
  lastWeather='';lastStage=null;lastGameState='';
  lastSnowActive=false;lastExpectedSnowPage=null;
  framesSinceResume=0;lastHeapBytes=null;
  start.disabled=true;stop.disabled=false;replay.disabled=true;
  label.textContent='Gravando · painel congelado durante o voo';
  if(renderer.seasonalBackdrop)renderer.seasonalBackdrop.onTelemetry=forensics.deep?logBackdrop:null;
  requestAnimationFrame(tick);
 }
 start.addEventListener('click',startCapture);
 if(replayLaunch)replay.addEventListener('click',async()=>{
  if(active)return;
  replay.disabled=true;
  try{
   await replayLaunch(startCapture);
  }catch(error){
   label.textContent='Falha ao iniciar o voo de referência: '+error.message;
   console.error(error);
  }finally{
   replay.disabled=active;
  }
 });
 const downloadLatest=()=>{if(active)finish('manual-stop',true);else if(lastReport)download(lastReport);};
 stop.addEventListener('click',downloadLatest);
 for(const button of resultDownloads)button.addEventListener('click',downloadLatest);
}
