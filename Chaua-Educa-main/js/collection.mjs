import {CHAPTER_DISCOVERIES,OBSERVATION_DETAILS} from './chapter-learning.mjs';
import { QUESTIONS, SOURCES, CONTENT_REVIEWED } from './questions.mjs';
import {FOODS} from './foods.mjs';
import {JOURNAL_PHOTOS,PHOTO_CREDIT,JOURNAL_FACTS,CONSERVATION_SOURCES} from './journal-content.mjs';

export const ENTRIES = [
 {id:'chaua',title:'Conheça o chauá',category:'Ave',text:'Amazona rhodocorytha é o nome científico do papagaio-chauá. Ele vive na Mata Atlântica, no leste do Brasil.',source:'salve',hint:'Disponível desde o início.'},
 {id:'habitat',title:'Uma floresta para viver',category:'Habitat',text:'A perda e a fragmentação da floresta ameaçam o chauá. Conservar os ambientes naturais é parte de sua proteção.',source:'panReport',hint:'Chegue às Árvores antigas ou descubra uma pergunta sobre habitat.'},
 {id:'alimentos',title:'Além dos coletáveis',category:'Alimentação',text:'Há registros de chauás comendo pétalas de ipê. Os alimentos do jogo representam recursos citados para a espécie, incluindo frutos, sementes, brotos e pétalas. Não são uma dieta completa para aves reais. Comer uma semente não garante que ela seja dispersa ou germine.',source:'inma',hint:'Recolha um alimento.'},
 {id:'arvores',title:'Chauás revelam ipês',category:'Árvores e pesquisa',text:'Em Linhares (ES), acompanhar chauás ajudou a localizar Handroanthus riodocensis, um ipê raro. Aves e árvores podem ser estudadas em conjunto. O pouso no refúgio do jogo é uma representação, não uma descrição de ninho.',source:'inma',hint:'Chegue às Árvores antigas ou descubra uma pergunta sobre a pesquisa.'},
 {id:'fauna',title:'Animais, não vilões',category:'Fauna do jogo',text:'Cobras e gaviões são desafios nesta aventura. Os desenhos não identificam espécies, e suas investidas não comprovam predação do chauá na natureza. Você não precisa atingir animais para desbloquear descobertas.',source:'game',hint:'Disponível desde o início.'},
 {id:'conservacao',title:'Proteger aves e ambientes',category:'Conservação',text:'O chauá é Vulnerável (VU) na lista nacional brasileira de 2026. A avaliação do ICMBio publicada em 2023 indica declínio populacional e ameaças como perda de habitat, incêndios e captura ilegal. A estimativa de 4.607 indivíduos maduros pertence àquela avaliação: não é uma contagem feita hoje. Conservar florestas e impedir a captura ilegal são ações importantes para a espécie.',source:'list2026',hint:'Chegue à Mata fragmentada ou descubra uma pergunta sobre conservação.'},
 {id:'fantasia',title:'A magia pertence ao jogo',category:'Jogo e natureza',text:'Escudo de penas, aura dourada e pontos em dobro são poderes fictícios. Na natureza, chauás não têm essas proteções mágicas.',source:'game',hint:'Disponível desde o início.'},
];
export const INITIAL_ENTRIES = ['chaua','fauna','fantasia'];
export function discoveriesFor(event) {
 if(event.type==='chapter-discovery')return Number.isInteger(event.stage)&&CHAPTER_DISCOVERIES[event.stage]?[CHAPTER_DISCOVERIES[event.stage].entry]:[];
 if(event.type==='observation')return Object.hasOwn(OBSERVATION_DETAILS,event.detail)?[OBSERVATION_DETAILS[event.detail].entry]:[];
 if(event.type==='fruit')return ['alimentos'];
 if(event.type==='stage')return event.stage===1?['habitat','arvores']:event.stage>=2?['conservacao']:[];
 if(['correct','incorrect'].includes(event.type)) {
  const entry=QUESTIONS.find(q=>q.id===event.questionId)?.entry;
  return entry?[entry]:[];
 }
 return [];
}
export function journalIllustration(id){
 const fact=JOURNAL_FACTS[id],art=document.createElement('figure');art.className=`journal-visual visual-${id}`;
 if(fact.photo){
  const photo=JOURNAL_PHOTOS[fact.photo],image=document.createElement('img');image.src=photo.src;image.alt=photo.alt;
  image.loading='lazy';image.decoding='async';image.width=800;image.height=600;art.append(image);
  const credit=document.createElement('figcaption'),link=document.createElement('a');link.href=photo.page;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Duncan Rawlinson · CC BY 2.0 · Ave em cativeiro ↗';link.title=PHOTO_CREDIT;credit.append(link);art.append(credit);
 }else{
  const kicker=document.createElement('span');kicker.textContent=fact.kicker;
  const value=document.createElement('strong');value.textContent=fact.value;
  const detail=document.createElement('p');detail.textContent=fact.detail;art.append(kicker,value,detail);
 }
 return art;
}
export function renderCollection(container,unlocked,{foods=[],foodContainer,detailContainer}={}){
 let previousFocus=null,previousScroll=0;const buttons=new Map();
 const openDetail=(entry,button)=>{
  if(!detailContainer)return;
  previousFocus=button;const scrollBody=detailContainer.closest('.panel-body')||detailContainer.closest('dialog');previousScroll=scrollBody.scrollTop;detailContainer.closest('.journal-shell').classList.add('is-reading');
  const back=document.createElement('button');back.type='button';back.className='journal-back';back.textContent='← Voltar às descobertas';
  const title=document.createElement('h3');title.id='journal-detail-title';title.textContent=entry.title;
  const category=document.createElement('span');category.className='journal-category';category.textContent=entry.category;
  const text=document.createElement('p');text.className='journal-reading';text.textContent=entry.text;
  const content=document.createElement('div');content.className='journal-detail-copy';content.append(category,title,text);
  if(entry.source&&entry.source!=='game'){
   const link=document.createElement('a');link.href=(CONSERVATION_SOURCES[entry.source]??SOURCES[entry.source]).url;link.textContent='Ler a fonte desta descoberta ↗';link.target='_blank';link.rel='noopener noreferrer';content.append(link);
  }
  const note=document.createElement('p');note.className='journal-footnote';note.textContent=entry.source==='game'?'Esta ficha descreve elementos da aventura.':`Conteúdo revisado em ${CONTENT_REVIEWED.split('-').reverse().join('/')}.`;
  content.append(note);detailContainer.replaceChildren(back,journalIllustration(entry.id),content);detailContainer.hidden=false;container.hidden=true;if(foodContainer)foodContainer.hidden=true;
  scrollBody.scrollTop=0;back.focus({preventScroll:true});
  back.addEventListener('click',()=>{detailContainer.closest('.journal-shell').classList.remove('is-reading');detailContainer.hidden=true;container.hidden=false;scrollBody.scrollTop=previousScroll;previousFocus?.focus({preventScroll:true});});
 };
 container.replaceChildren(...ENTRIES.map(entry=>{
  const discovered=unlocked.includes(entry.id),card=document.createElement('article');card.className='journal-card';card.classList.toggle('is-locked',!discovered);
  const art=document.createElement('div');art.className='journal-art';art.append(journalIllustration(entry.id));
  const state=document.createElement('span');state.className='journal-state';state.textContent=discovered?'Descoberto':'Por descobrir';art.append(state);
  const copy=document.createElement('div');copy.className='journal-card-copy';
  const category=document.createElement('span');category.className='journal-category';category.textContent=entry.category;
  const title=document.createElement('h3');title.textContent=entry.title;
  const text=document.createElement('p');text.textContent=discovered?entry.text.slice(0,135)+(entry.text.length>135?'…':''):entry.hint;
  const button=document.createElement('button');button.type='button';button.className='journal-open';button.textContent=discovered?'Ler descoberta →':'Continue explorando';button.disabled=!discovered;
  buttons.set(entry.id,button);
  if(discovered)button.addEventListener('click',()=>openDetail(entry,button));
  copy.append(category,title,text,button);card.append(art,copy);return card;
 }));
 if(foodContainer)foodContainer.replaceChildren(...FOODS.map(f=>{
  const card=document.createElement('article');card.className='journal-food';const found=foods.includes(f.id);card.classList.toggle('is-locked',!found);
  const number=document.createElement('span');number.className='journal-food-number';number.textContent=String(f.slot+1).padStart(2,'0');
  const title=document.createElement('h3');title.textContent=f.name;const text=document.createElement('p');text.textContent=found?f.description:'Recolha este item durante o voo para registrar sua descoberta.';
  const state=document.createElement('span');state.className='journal-category';state.textContent=found?'Registrado':'Ainda não coletado';const copy=document.createElement('div');const source=document.createElement('a');source.href=f.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Fonte sobre este alimento ↗';copy.append(state,title,text,source);card.append(number,copy);return card;
 }));
 return {openEntry(id){const entry=ENTRIES.find(e=>e.id===id);if(!entry||!unlocked.includes(id)||!detailContainer)return false;openDetail(entry,buttons.get(id));return true;}};
}
