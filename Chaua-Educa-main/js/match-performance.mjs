// Built-in, low-overhead per-match diagnosis for the ordinary game URL.
// No second RAF, deep hooks, pixel readbacks, network calls or player names.
// All records stay in localStorage (or memory if unavailable) until exported.
import {summarizeFrames} from './frame-summary.mjs';
import {journeySeason} from './seasons.mjs';
import {getWeatherMode} from './weather.mjs';
import {GAME_VERSION} from './version.mjs';

export const MATCH_PERF_KEY='chaua-performance-matches-v1';
export const MATCH_PERF_SETTING='chaua-performance-auto-enabled';
const MAX_REPORTS=10,MAX_FRAMES=45000,MAX_STUTTERS=100,MAX_EVENTS=80,MAX_SNAPSHOTS=160;
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
  if(!this.enabled)this.current=null; // Opting out discards unfinished data.
  try{this.storage?.setItem(MATCH_PERF_SETTING,JSON.stringify(this.enabled));}catch{}
 }
 start(game,quality,renderer,training=false){
  if(!this.enabled)return;
  if(this.current)this.finish('restarted',game,quality,renderer);
  this.current={
   id:Date.now()+'-'+Math.floor(Math.random()*100000),
   start:new Date().toISOString(),startNow:typeof performance!=='undefined'?performance.now():0,
   seed:game.seed,mode:game.mode,training:!!training,
   samples:[],byStage:empty(),byWindow:empty(),byProfile:empty(),
   stutters:[],events:[],snapshots:[],profileChanges:[],previous:0,
   previousCpuMs:null,stutterTotal:0,over50:0,over100:0,
   lastSnapshot:0,lastProfile:''
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
   resolution:renderer.resolution,
   decoration:renderer.decoration,
   canvas:[renderer.canvas.width,renderer.canvas.height]
  });
 }
 frame(timestamp,game,quality,renderer,callbackMs,eligible){
  const c=this.current;
  if(!c)return;
  if(game.state==='ended'||game.state==='trained'){
   this.finish(game.state,game,quality,renderer);return;
  }
  if(game.state==='menu'){
   this.finish('returned-to-menu',game,quality,renderer);return;
  }
  if(!eligible){c.previous=0;c.previousCpuMs=null;return;}
  const profile=quality.mode+'/'+quality.level+'/'+renderer.resolution+'/'+renderer.decoration;
  if(profile!==c.lastProfile){
   if(c.profileChanges.length<MAX_SNAPSHOTS)c.profileChanges.push({
    gameSeconds:round(game.elapsed||0),profile,canvas:[renderer.canvas.width,renderer.canvas.height]
   });
   c.lastProfile=profile;
  }
  if(c.previous>0&&timestamp>c.previous&&c.samples.length<MAX_FRAMES){
   const dt=timestamp-c.previous,stage=String(game.stage),windowKey=String(Math.floor((game.elapsed||0)/10)*10);
   c.samples.push(dt);
   (c.byStage[stage]??(c.byStage[stage]=[])).push(dt);
   (c.byWindow[windowKey]??(c.byWindow[windowKey]=[])).push(dt);
   (c.byProfile[profile]??(c.byProfile[profile]=[])).push(dt);
   if(dt>33.33){
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
     let wood=0,hawk=0,snake=0,fruit=0;
     for(const entity of game.entities||[]){
      if(entity.kind==='wood'){wood++;if(entity.snake)snake++;}
      else if(entity.kind==='hawk')hawk++;
      else if(entity.kind==='fruit')fruit++;
     }
     c.stutters[position]={
      frame:c.samples.length,frameMs:round(dt),gameSeconds:round(game.elapsed||0),
      stage:game.stage,weather:getWeatherMode(),profile,canvas:[renderer.canvas.width,renderer.canvas.height],
      previousCallbackCpuMs:c.previousCpuMs===null?null:round(c.previousCpuMs),
      currentCallbackCpuMs:round(callbackMs),
      pendingSeasonSurface:renderer.seasonalBackdrop?.pending?.id??null,
      entities:{wood,hawk,snake,fruit,particles:game.particles?.length??0}
     };
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
  this.current=null;
  const report={
   schemaVersion:1,source:'Chaua Educa / desempenho automatico por partida',
   provenance:{gameVersion:GAME_VERSION,build:typeof document==='undefined'?null:document.querySelector('meta[name="chaua-build"]')?.content||null,host:typeof location!=='undefined'?location.host:null,
    path:typeof location!=='undefined'?location.pathname:null},
   id:c.id,startedAt:c.start,collectedAt:new Date().toISOString(),
   device:viewportInfo(renderer),
   match:{seed:c.seed,mode:c.mode,training:c.training,score:game.score,
    won:!!game.won,flightSeconds:round(game.elapsed||0),stage:game.stage},
   endReason:reason,settings:{qualityMode:quality.mode,qualityLevel:quality.level,
    resolution:renderer.resolution,decoration:renderer.decoration},
   measurement:{eligibleOnly:'visible-focused-playing',deepInstrumentation:false,
    sampleLimit:MAX_FRAMES,capped:c.samples.length===MAX_FRAMES,
    limitations:['RAF intervals include browser scheduling and are not exclusively CPU or GPU work.',
     'CPU callback timings are not GPU raster measurements.',
     'Frame timestamps after tab switches, pauses and quiz screens are excluded.']},
   summary:{...summarizeFrames(c.samples),stutterCount:c.stutterTotal},
   byStage:byBucket(c.byStage),byTenSecondWindow:byBucket(c.byWindow),
   byProfile:byBucket(c.byProfile),
   profileChanges:c.profileChanges,climateTimeline:c.snapshots,
   stutters:c.stutters.sort((a,b)=>a.frame-b.frame),events:c.events
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
