import { FRUITS } from './fruits.mjs';
import { QUESTIONS } from './questions.mjs';

export const MISSIONS = Object.freeze([
 {id:'collector',title:'Sabores da aventura',description:'Recolha 12 alimentos ao longo dos seus voos.',target:12,metric:'fruits'},
 {id:'variety',title:'Olhar curioso',description:'Encontre 3 tipos diferentes de coletáveis.',target:3,metric:'varieties'},
 {id:'learner',title:'Aprender é descobrir',description:'Responda a 4 perguntas diferentes. Errar também conta.',target:4,metric:'questions'},
 {id:'explorer',title:'Além das copas',description:'Alcance o trecho Mata fragmentada em um voo.',target:2,metric:'stage'},
 {id:'trail',title:'Caminhos da mata',description:'Complete 3 trilhas de frutas sem contato, em qualquer número de voos.',target:3,metric:'routes'},
 {id:'flock',title:'De volta ao bando',description:'Conclua a jornada até o refúgio uma vez.',target:1,metric:'arrivals'},
]);
const count=(value,max)=>Number.isFinite(value)?Math.max(0,Math.min(max,Math.floor(value))):0;
const unique=(value,valid)=>[...new Set((Array.isArray(value)?value:[]).filter(id=>valid.includes(id)))];
export function normalizeProgress(value) {
 const p=value && typeof value==='object'?value:{};
 return {version:1,fruits:count(p.fruits,12),varieties:unique(p.varieties,FRUITS.map(f=>f.id)),
  questions:unique(p.questions,QUESTIONS.map(q=>q.id)),stage:count(p.stage,3),routes:count(p.routes,3),arrivals:count(p.arrivals,1)};
}
export function missionValue(mission,progress){
 const value=progress[mission.metric];
 return Math.min(mission.target,Array.isArray(value)?value.length:value);
}
export function completedMissions(progress){return MISSIONS.filter(m=>missionValue(m,progress)>=m.target);}
export function progressTitle(progress){
 const n=completedMissions(progress).length;
 return n>=6?'Companheiro da floresta':n>=4?'Explorador da mata':n>=2?'Asas curiosas':'Primeiras descobertas';
}
export function advanceProgress(previous,event) {
 const p=normalizeProgress(previous);
 if(event.type==='fruit' && FRUITS.some(f=>f.id===event.fruit)) {
  p.fruits=Math.min(12,p.fruits+1);p.varieties=unique([...p.varieties,event.fruit],FRUITS.map(f=>f.id));
 }
 if(['correct','incorrect'].includes(event.type) && QUESTIONS.some(q=>q.id===event.questionId))
  p.questions=unique([...p.questions,event.questionId],QUESTIONS.map(q=>q.id));
 if(event.type==='stage')p.stage=Math.max(p.stage,count(event.stage,3));
 if(event.type==='route-complete')p.routes=Math.min(3,p.routes+1);
 if(event.type==='win')p.arrivals=1;
 return p;
}
export function renderMissions(container,progress){
 container.replaceChildren(...MISSIONS.map(m=>{
  const card=document.createElement('article');
  const value=missionValue(m,progress),done=value===m.target;
  card.classList.toggle('mission-complete',done);
  const title=document.createElement('h3');title.textContent=m.title;
  const description=document.createElement('p');description.textContent=m.description;
  const meter=document.createElement('progress');meter.max=m.target;meter.value=value;meter.setAttribute('aria-label',m.title);
  const status=document.createElement('small');
  status.textContent=done?'Selo conquistado':m.id==='explorer'?`Trecho alcançado: ${['Área de alimentação','Árvores antigas','Mata fragmentada','Refúgio do bando'][progress.stage]}`:`${value} de ${m.target}`;
  card.append(title,description,meter,status);return card;
 }));
}
