import {advanceHawk,advanceSnake} from './animals.mjs';
import {playerShapes,hawkShapes,shapesIntersect,shapesHitRect} from './collision.mjs';
import {snakeA2HitsPlayer} from './snake-a2.mjs';
import {HAWK_ATTACK_ORDER,HAWK_ATTACKS,SNAKE_ATTACK_ORDER,SNAKE_ATTACKS} from './attack-patterns.mjs';
export const LESSONS = Object.freeze([
 {title:'1 · Toque para subir',instruction:'Toque em Voar, ↑ ou espaço para ganhar altura.'},
 {title:'2 · Segure para subir',instruction:'Solte e segure Voar, ↑ ou espaço por um instante.'},
 {title:'3 · Solte para descer',instruction:'Solte o controle e observe a descida.'},
 {title:'4 · Encontre a abertura',instruction:'Atravesse o espaço livre entre os troncos com batidas curtas.'},
 {title:'5 · Leia a rota do gavião',instruction:'Espere a rota ser marcada e saia da faixa da investida.'},
 {title:'6 · Observe o bote',instruction:'Use o espaço livre acima da cobra e atravesse a abertura.'},
]);
export function createTutorial(y=320){return {step:0,originY:y,holdTime:0,done:false,trial:0,retries:0,wait:0,feedback:''};}
export function tutorialInstruction(t){
 if(t.done)return 'Pronto para a aventura!';
 if(t.wait>0)return t.feedback;
 const pattern=t.step===4?HAWK_ATTACKS[HAWK_ATTACK_ORDER[t.trial||0]]:t.step===5?SNAKE_ATTACKS[SNAKE_ATTACK_ORDER[t.trial||0]]:null;
 return `${LESSONS[t.step]?.instruction||''}${pattern?` ${pattern.label} · ${(t.trial||0)+1}/3.`:''}`;
}
function resetPractice(t,g,feedback=''){
 g.entities=[];g.y=320;g.vy=0;g.angle=0;g.cancelInput();
 t.wait=feedback?.8:.35;t.feedback=feedback;g.snapshot();
 g.onEvent({type:feedback?'tutorial-retry':'tutorial-trial'});
}
function advancePractice(t,g,dt){
 if(t.wait>0){t.wait=Math.max(0,t.wait-dt);g.y=320;g.vy=0;return false;}
 if(!g.entities.length){
  const x=Math.max(g.x+540,Math.max(960,g.viewWidth||960)+100),id=g.nextId++;
  if(t.step===4){
   const attackKind=HAWK_ATTACK_ORDER[t.trial||0],startY=HAWK_ATTACKS[attackKind].startY;
   g.entities=[{id,kind:'hawk',x,y:startY,startX:x,targetX:g.x-60,startY,targetY:320,warning:2.5,lockWarning:1.5,attackX:g.x,attackKind,targetLocked:false,gentle:true,boost:40,dive:attackKind==='mergulho',ascent:attackKind==='rasante'}];
  }else g.entities=[{id,kind:'wood',x,top:t.step===5?140:200,bottom:t.step===5?500:440,variant:'plain',
   ...(t.step===5?{snake:{kind:'snake',attackType:SNAKE_ATTACK_ORDER[t.trial||0],gentle:true,phase:'watching',age:0}}:{})}];
 }
 const e=g.entities[0],body=playerShapes(g.x,g.y,g.angle,{time:g.sceneTime,wing:g.wing,flapImpulse:g.flapImpulse,reduced:g.reducedMotion});
 let hit=false,passed=false;
 if(e.kind==='hawk'){
  advanceHawk(e,dt,g.speed,g.x,g.y);
  hit=e.warning<=0&&!e.harmless&&shapesIntersect(body,hawkShapes(e,g.sceneTime,g.reducedMotion));passed=!!e.harmless;
 }else{
  e.x-=g.speed*dt;advanceSnake(e,dt,g.x,g.speed);
  hit=g.woodRects(e).some(r=>shapesHitRect(body,r))||!!e.snake&&snakeA2HitsPlayer(e,body,g.reducedMotion);
  passed=e.x+130<g.x;
 }
 if(hit){t.retries++;resetPractice(t,g,t.step===4?'Vamos observar de novo: espere a marcação e saia da rota.':t.step===5?'Mais uma tentativa: mantenha o voo no espaço acima da cobra.':'Tente de novo com batidas curtas no centro da abertura.');return false;}
 if(!passed)return false;
 t.trial=(t.trial||0)+1;
 if(t.step===3||t.trial===3){t.trial=0;g.entities=[];return true;}
 resetPractice(t,g);return false;
}
export function advanceTutorial(t,flight,dt){
 if(t.done)return false;
 if(t.step===1)t.holdTime=flight.held?t.holdTime+dt:0;
 const complete=t.step>=3?advancePractice(t,flight,dt):t.step===0?flight.y<t.originY-20&&flight.vy<0
  :t.step===1?t.holdTime>=.6:!flight.held&&flight.vy>0&&flight.y>t.originY+30;
 if(!complete)return false;
 t.step++;t.holdTime=0;t.originY=320;t.done=t.step===LESSONS.length;
 return true;
}
export function resultAdvice(game){
 if(game.won)return 'Você completou o caminho! Consulte suas missões para escolher a próxima descoberta.';
 const tips={
  top:'Antecipe a soltura do controle. Batidas curtas ajudam a manter distância da copa.',
  bottom:'Dê uma batida antes de chegar perto do chão. Segurar ajuda a recuperar altura.',
  hawk:'Observe o aviso do gavião e a faixa de passagem antes de mudar de altura.',
  snake:game.hit?.attackType==='alto'?'Antecipe a subida no bote alto; ele alcança uma faixa mais elevada.':game.hit?.attackType==='varredura'?'A varredura ocupa a faixa baixa. Mantenha o voo acima do corpo da cobra.':'No bote frontal, ganhe altura antes da investida e deixe espaço para a cobra recolher.',
  wood:'Alinhe-se com a abertura antes de alcançar o tronco. Alimentos nas bordas são opcionais.',
  quiz:'Releia a explicação na Chauapédia. No Amigável, você pode errar e continuar aprendendo.',
 };
 return tips[game.endCause] || 'Experimente batidas curtas e solte para ajustar a altura. O treino de voo está disponível no início.';
}
