// Loaded on request. No automatic upload, persistent storage or detailed profiler.
import {BetaSession} from './beta-session.mjs';
export function mountBeta({game,quality,renderer,onStart,openDialog,instrumented=()=>false}){
 const $=s=>document.querySelector(s),dialog=$('#beta-dialog');let session=null;
 const field=id=>$('#beta-'+id).value;
 const entries=[...document.querySelectorAll('.beta-entry')];
 function update(){
  $('#beta-start').disabled=!!session?.active;
  $('#beta-device-fields').disabled=!!session?.active;
  $('#beta-download').disabled=!session;
  const state=session?.active?'Coleta em andamento. Jogue e volte aqui para encerrar e baixar.':session?'Coleta encerrada. Você pode ajustar as respostas e baixar outra cópia.':'Coleta inativa. Preencha o aparelho e inicie quando estiver pronto.';
  $('#beta-status').textContent=state;
  for(const e of entries)e.textContent=session?.active?'Beta em andamento · relatório':'Participar da beta';
 }
 function feedback(){return {fun:field('fun'),clarity:field('clarity'),comfort:field('comfort'),learned:field('learned'),category:field('category'),severity:field('severity'),problem:field('problem'),tasks:Object.fromEntries([...dialog.querySelectorAll('[data-beta-task]')].map(e=>[e.dataset.betaTask,e.checked]))};}
 $('#beta-start').addEventListener('click',()=>{
  session=new BetaSession({id:globalThis.crypto?.randomUUID?.()||'sessao-'+Date.now(),build:$('meta[name=chaua-build]').content,instrumented:instrumented(),device:{group:field('group'),family:field('family'),environment:field('environment'),model:field('model'),browser:field('browser'),viewport:[innerWidth,innerHeight],dpr:devicePixelRatio}});
  if(game.state==='paused')session.attempt({seed:game.seed,mode:game.mode,tutorial:game.tutorial,resumed:game.resumed,partial:true});
  // A new session has its own feedback, never inherits a previous participant's answers.
  for(const id of ['fun','clarity','comfort','category','severity'])$('#beta-'+id).value='';
  for(const id of ['learned','problem'])$('#beta-'+id).value='';
  dialog.querySelectorAll('[data-beta-task]').forEach(e=>e.checked=false);
  update();onStart();
 });
 $('#beta-download').addEventListener('click',()=>{
  if(!session)return;
  session.stop();const report=session.report(feedback());
  const nav=performance.getEntriesByType('navigation')[0];
  report.navigation=nav?{domReadyMs:nav.domContentLoadedEventEnd>0?Math.round(nav.domContentLoadedEventEnd):null,loadMs:nav.loadEventEnd>0?Math.round(nav.loadEventEnd):null,scope:'Navigation timing, independent of when the session was started; not asset-ready time'}:null;
  try{
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='chaua-beta-'+report.version+'-'+report.sessionId+'.json';document.body.append(a);try{a.click();}finally{a.remove();}setTimeout(()=>URL.revokeObjectURL(url),30000);
  update();$('#beta-status').textContent+=' Confira o download antes de recarregar; o relatório não é enviado automaticamente.';
  }catch{update();$('#beta-status').textContent='Não foi possível baixar agora. A coleta foi mantida nesta aba; tente baixar novamente antes de recarregar.';}
 });
 window.addEventListener('error',()=>session?.event('browser-error'));window.addEventListener('unhandledrejection',()=>session?.event('unhandled-rejection'));
 window.addEventListener('blur',()=>session?.interrupt());document.addEventListener('visibilitychange',()=>session?.interrupt());
 update();
 return {
  get active(){return !!session?.active;},
  open(){openDialog('#beta-dialog');update();},
  event(type){session?.event(type,{score:game.score,elapsed:game.elapsed,stage:game.stage});},
  attempt(){session?.attempt({seed:game.seed,mode:game.mode,tutorial:game.tutorial,resumed:game.resumed});},
  frame(now,stateBefore){
   session?.frame(now,{stateBefore,stateAfter:game.state,visible:!document.hidden,focused:document.hasFocus(),training:!!game.tutorial,mode:game.mode,stage:game.stage,profile:quality.mode+'/'+quality.level+'/'+renderer.resolution+'/'+renderer.decoration,viewport:[innerWidth,innerHeight],instrumented:instrumented()});
  }
 };
}
