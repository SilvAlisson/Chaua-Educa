export const LESSONS = Object.freeze([
 {title:'1 · Toque para subir',instruction:'Toque em Voar, ↑ ou espaço para ganhar altura.'},
 {title:'2 · Segure para subir',instruction:'Solte e segure Voar, ↑ ou espaço por um instante.'},
 {title:'3 · Solte para descer',instruction:'Solte o controle e observe a descida.'},
]);
export function createTutorial(y=320){return {step:0,originY:y,holdTime:0,done:false};}
export function advanceTutorial(t,flight,dt){
 if(t.done)return false;
 if(t.step===1)t.holdTime=flight.held?t.holdTime+dt:0;
 const complete=t.step===0 ? flight.y<t.originY-20 && flight.vy<0
  :t.step===1 ? t.holdTime>=.6
  :!flight.held && flight.vy>0 && flight.y>t.originY+30;
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
  snake:'A cobra ocupa o galho sinalizado. Procure o espaço livre, sem tentar atravessá-la.',
  wood:'Alinhe-se com a abertura antes de alcançar o tronco. Frutas nas bordas são opcionais.',
  quiz:'Releia a explicação na Chauapédia. No Amigável, você pode errar e continuar aprendendo.',
 };
 return tips[game.endCause] || 'Experimente batidas curtas e solte para ajustar a altura. O treino de voo está disponível no início.';
}
