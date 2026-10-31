import { QUESTIONS, SOURCES, CONTENT_REVIEWED } from './questions.mjs';

export const JOURNAL_ART = {
  chaua: 'images/journal/field_journal_parrot.png',
  habitat: 'images/journal/field_journal_habitat.png',
  alimentos: 'images/journal/field_journal_seeds.png',
  arvores: 'images/journal/field_journal_flock.png',
  fauna: 'images/journal/field_journal_curiosities.png',
  conservacao: 'images/journal/field_journal_threats.png',
  fantasia: 'images/journal/field_journal_curiosities.png'
};

export const ENTRIES = [
 {id:'chaua',title:'Conheça o chauá',category:'Ave',text:'Amazona rhodocorytha é o nome científico do papagaio-chauá. Ele vive na Mata Atlântica, no leste do Brasil.',source:'zoo',hint:'Disponível desde o início.'},
 {id:'habitat',title:'Uma floresta para viver',category:'Habitat',text:'A perda e a fragmentação da floresta ameaçam o chauá. Conservar os ambientes naturais é parte de sua proteção.',source:'icmbio',hint:'Chegue às Árvores antigas ou descubra uma pergunta sobre habitat.'},
 {id:'alimentos',title:'Além dos coletáveis',category:'Alimentação',text:'Há registros de chauás comendo pétalas de ipê. Os sete itens do jogo são símbolos: não representam uma dieta completa nem comprovam o consumo natural de cada alimento. Comer uma semente não garante que ela seja dispersa ou germine.',source:'inma',hint:'Recolha um alimento.'},
 {id:'arvores',title:'Chauás revelam ipês',category:'Árvores e pesquisa',text:'Em Linhares (ES), acompanhar chauás ajudou a localizar Handroanthus riodocensis, um ipê raro. Aves e árvores podem ser estudadas em conjunto. O pouso no refúgio do jogo é uma representação, não uma descrição de ninho.',source:'inma',hint:'Chegue às Árvores antigas ou descubra uma pergunta sobre a pesquisa.'},
 {id:'fauna',title:'Animais, não vilões',category:'Fauna do jogo',text:'Cobras e gaviões são desafios nesta aventura. Os desenhos não identificam espécies, e suas investidas não comprovam predação do chauá na natureza. Você não precisa atingir animais para desbloquear descobertas.',source:'game',hint:'Disponível desde o início.'},
 {id:'conservacao',title:'Proteger aves e ambientes',category:'Conservação',text:'Combater o tráfico, preservar o habitat e promover educação ambiental são frentes de conservação. O PAN Papagaios encerrou seu ciclo; suas espécies ameaçadas passaram ao PAN Aves da Mata Atlântica.',source:'icmbio',hint:'Chegue à Mata fragmentada ou descubra uma pergunta sobre conservação.'},
 {id:'fantasia',title:'A magia pertence ao jogo',category:'Jogo e natureza',text:'Escudo de penas, aura dourada e pontos em dobro são poderes fictícios. Na natureza, chauás não têm essas proteções mágicas.',source:'game',hint:'Disponível desde o início.'},
];
export const INITIAL_ENTRIES = ['chaua','fauna','fantasia'];
export function discoveriesFor(event) {
 if(event.type==='fruit')return ['alimentos'];
 if(event.type==='stage')return event.stage===1?['habitat','arvores']:event.stage>=2?['conservacao']:[];
 if(['correct','incorrect'].includes(event.type)) {
  const entry=QUESTIONS.find(q=>q.id===event.questionId)?.entry;
  return entry?[entry]:[];
 }
 return [];
}
export function renderCollection(container, unlocked) {
 container.replaceChildren(...ENTRIES.map(entry=>{
  const card=document.createElement('article');
  const title=document.createElement('h3');title.textContent=entry.title;
  const category=document.createElement('small');category.textContent=entry.category;
  const text=document.createElement('p');
  const discovered=unlocked.includes(entry.id);
  text.textContent=discovered?entry.text:entry.hint;
  card.classList.toggle('undiscovered',!discovered);
  if(discovered && JOURNAL_ART[entry.id]){
    const img=document.createElement('img');
    img.src=JOURNAL_ART[entry.id];
    img.alt=entry.title;
    img.className='journal-thumb';
    img.loading='lazy';
    card.append(img);
  }
  card.append(category,title,text);
  if(discovered){
   const source=SOURCES[entry.source];
   if(entry.source!=='game'){
    const link=document.createElement('a');link.href=source.url;link.textContent='Consultar fonte';link.target='_blank';link.rel='noopener noreferrer';card.append(link);
   }
   const date=document.createElement('small');date.textContent=`Revisado em ${CONTENT_REVIEWED.split('-').reverse().join('/')}`;card.append(date);
  }
  return card;
 }));
}
