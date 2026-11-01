import { QUESTIONS, SOURCES, CONTENT_REVIEWED } from './questions.mjs';
import {FRUITS} from './fruits.mjs';
import {images} from './assets.mjs';
import {SPRITES} from './sprite-data.mjs';

export const JOURNAL_ART = {
 chaua:'assets/v6/chaua-atlas.webp',habitat:'assets/v3/forest.webp',alimentos:'assets/v3/fruit-Goiaba.webp',
 arvores:'assets/v3/forest.webp',fauna:'assets/v6/hawk-atlas.webp',conservacao:'assets/v3/forest.webp',fantasia:'assets/v4/feather.webp'
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
function illustration(id){
 const canvas=document.createElement('canvas');canvas.width=480;canvas.height=280;canvas.className='journal-illustration';canvas.setAttribute('aria-hidden','true');
 const c=canvas.getContext('2d'),bg=c.createLinearGradient(0,0,480,280);bg.addColorStop(0,'#e9efd9');bg.addColorStop(1,'#d4e3bd');c.fillStyle=bg;c.fillRect(0,0,480,280);
 const sprite=(name,frame,x,y,factor)=>{const image=images.get(`${name}-atlas`),data=SPRITES[name];if(image)c.drawImage(image,...data.frames[frame].rect,x-data.anchor[0]*factor,y-data.anchor[1]*factor,data.cell*factor,data.cell*factor);};
 if(['habitat','arvores','conservacao'].includes(id)){
  const forest=images.get('forest');if(forest){const w=forest.naturalWidth,h=forest.naturalHeight,sourceW=h*480/280;c.drawImage(forest,Math.max(0,(w-sourceW)*(id==='arvores'?.7:.25)),0,Math.min(sourceW,w),h,0,0,480,280);}
 }else if(id==='fauna')sprite('hawk',8,235,150,1.4);
 else if(id==='alimentos')FRUITS.slice(0,3).forEach((f,i)=>{const im=images.get(`fruit-${f.id}`);if(im)c.drawImage(im,45+i*140,75,110,110);});
 else if(id==='fantasia')for(const [i,key]of ['shield','feather'].entries()){const im=images.get(key);if(im)c.drawImage(im,95+i*160,65,130,130);}
 else sprite('chaua',12,240,138,1.1);
 return canvas;
}
export function renderCollection(container,unlocked,{foods=[],foodContainer,detailContainer}={}){
 let previousFocus=null;
 const openDetail=(entry,button)=>{
  if(!detailContainer)return;
  previousFocus=button;detailContainer.closest('.journal-shell').classList.add('is-reading');
  const back=document.createElement('button');back.type='button';back.className='journal-back';back.textContent='← Voltar às descobertas';
  const title=document.createElement('h3');title.id='journal-detail-title';title.textContent=entry.title;
  const category=document.createElement('span');category.className='journal-category';category.textContent=entry.category;
  const text=document.createElement('p');text.className='journal-reading';text.textContent=entry.text;
  const content=document.createElement('div');content.className='journal-detail-copy';content.append(category,title,text);
  if(entry.source&&entry.source!=='game'){
   const link=document.createElement('a');link.href=SOURCES[entry.source].url;link.textContent='Ler a fonte desta descoberta ↗';link.target='_blank';link.rel='noopener noreferrer';content.append(link);
  }
  const note=document.createElement('p');note.className='journal-footnote';note.textContent=entry.source==='game'?'Esta ficha descreve elementos da aventura.':`Conteúdo revisado em ${CONTENT_REVIEWED.split('-').reverse().join('/')}.`;
  content.append(note);detailContainer.replaceChildren(back,illustration(entry.id),content);detailContainer.hidden=false;container.hidden=true;if(foodContainer)foodContainer.hidden=true;
  detailContainer.closest('dialog').scrollTop=0;back.focus({preventScroll:true});
  back.addEventListener('click',()=>{detailContainer.closest('.journal-shell').classList.remove('is-reading');detailContainer.hidden=true;container.hidden=false;previousFocus?.focus({preventScroll:true});});
 };
 container.replaceChildren(...ENTRIES.map(entry=>{
  const discovered=unlocked.includes(entry.id),card=document.createElement('article');card.className='journal-card';card.classList.toggle('is-locked',!discovered);
  const art=document.createElement('div');art.className='journal-art';art.append(illustration(entry.id));
  const state=document.createElement('span');state.className='journal-state';state.textContent=discovered?'Descoberto':'Por descobrir';art.append(state);
  const copy=document.createElement('div');copy.className='journal-card-copy';
  const category=document.createElement('span');category.className='journal-category';category.textContent=entry.category;
  const title=document.createElement('h3');title.textContent=entry.title;
  const text=document.createElement('p');text.textContent=discovered?entry.text.slice(0,135)+(entry.text.length>135?'…':''):entry.hint;
  const button=document.createElement('button');button.type='button';button.className='journal-open';button.textContent=discovered?'Ler descoberta →':'Continue explorando';button.disabled=!discovered;
  if(discovered)button.addEventListener('click',()=>openDetail(entry,button));
  copy.append(category,title,text,button);card.append(art,copy);return card;
 }));
 if(foodContainer)foodContainer.replaceChildren(...FRUITS.map(f=>{
  const card=document.createElement('article');card.className='journal-food';const found=foods.includes(f.id);card.classList.toggle('is-locked',!found);
  const img=document.createElement('img');img.src=`assets/v3/fruit-${f.id}.webp`;img.alt='';img.width=100;img.height=100;
  const title=document.createElement('h3');title.textContent=f.name;const text=document.createElement('p');text.textContent=found?f.description:'Recolha este item durante o voo para registrar sua descoberta.';
  const state=document.createElement('span');state.className='journal-category';state.textContent=found?'Registrado':'Ainda não coletado';const copy=document.createElement('div');copy.append(state,title,text);card.append(img,copy);return card;
 }));
}
