import {ENTRIES,discoveriesFor} from './collection.mjs';
import {FOODS} from './foods.mjs';
import {QUESTIONS} from './questions.mjs';
export const createFlightLearning=(stage=0)=>({entries:[],foods:[],questions:[],chapters:[stage]});
const add=(list,id)=>list.includes(id)?list:[...list,id];
// Session-only recap, recorded on learning events; never persisted per frame.
export function advanceFlightLearning(previous,event){
 if(event.type==='fruit'&&!FOODS.some(f=>f.id===event.fruit)||event.type==='stage'&&(!Number.isInteger(event.stage)||event.stage<0||event.stage>=4))return previous;
 const next={...previous};
 for(const id of discoveriesFor(event))next.entries=add(next.entries,id);
 if(event.type==='fruit'&&FOODS.some(f=>f.id===event.fruit))next.foods=add(next.foods,event.fruit);
 if(['correct','incorrect'].includes(event.type)&&QUESTIONS.some(q=>q.id===event.questionId))next.questions=add(next.questions,event.questionId);
 if(event.type==='stage'&&Number.isInteger(event.stage)&&event.stage>=0&&event.stage<4)next.chapters=add(next.chapters,event.stage);
 return next;
}
export function flightLearningEntries(progress){return progress.entries.map(id=>ENTRIES.find(e=>e.id===id)).filter(Boolean);}
