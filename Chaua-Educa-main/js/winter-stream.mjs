import {images,loadCatalogAsset} from './assets.mjs';
import {precomposedSnowStage,PRECOMPOSED_SNOW_STAGES,winterStageKey} from './precomposed-winter.mjs';

const lastStage=PRECOMPOSED_SNOW_STAGES-1;
const retryDelayMs=3000;
const validStage=stage=>stage>0&&stage<=lastStage;

// Keep the displayed page, a page behind, and up to two pages ahead.
// Decode one request at a time. Upload completed work before publishing it to the renderer.
export class WinterStageStream {
 constructor({load=loadCatalogAsset,cache=images,now=()=>performance.now()}={}){
  this.load=load;
  this.cache=cache;
  this.now=now;
  this.resident=new Set();
  this.failures=new Map();
  this.target=0;
  this.displayed=0;
  this.direction=1;
  this.pending=null;
  this.decoded=null;
  this.uploaded=0;
  this.maxUploadMs=0;
  this.loadErrors=0;
  this.evicted=0;
  this.misses=0;
  this.peakResident=0;
 }

 prepareInitial(context){
  for(const stage of [1,2]){
   const image=this.cache.get(winterStageKey(stage));
   if(image&&!this.resident.has(stage))this.publish(stage,image,context);
  }
 }

 publish(stage,image,context){
  const started=this.now();
  context.prepareImage?.(image);
  this.maxUploadMs=Math.max(this.maxUploadMs,this.now()-started);
  this.cache.set(winterStageKey(stage),image);
  this.resident.add(stage);
  this.uploaded++;
  this.peakResident=Math.max(this.peakResident,this.resident.size);
 }

 update(context,snow){
  const stage=precomposedSnowStage(snow);
  const changed=stage!==this.target;
  if(changed){
   this.direction=stage===0?1:Math.sign(stage-this.target);
   this.target=stage;
   this.failures.clear();
  }
  const candidates=[stage,stage+this.direction,stage+2*this.direction].filter(validStage);
  const keep=new Set(candidates);
  if(this.resident.has(stage))this.displayed=stage;
  if(stage===0)this.displayed=0;
  if(this.displayed)keep.add(this.displayed);
  if(keep.size<4&&validStage(stage-this.direction))keep.add(stage-this.direction);
  for(const existing of this.resident){
   if(keep.has(existing))continue;
   const key=winterStageKey(existing),image=this.cache.get(key);
   context.releaseImage?.(image);
   image?.close?.();
   this.cache.delete(key);
   this.resident.delete(existing);
   this.evicted++;
  }

  if(this.decoded){
   const {stage:ready,image}=this.decoded;
   this.decoded=null;
   if(keep.has(ready)){
    this.publish(ready,image,context);
    if(ready===stage)this.displayed=stage;
   }else image.close?.();
  }
  if(changed&&stage&&stage!==this.displayed)this.misses++;
  if(!this.pending){
   const next=candidates.find(candidate=>!this.resident.has(candidate)
    &&(this.failures.get(candidate)??0)<=this.now());
   if(next!==undefined){
    this.pending=next;
    this.load(winterStageKey(next)).then(image=>{
     this.decoded={stage:next,image};
    },()=>{
     this.loadErrors++;
     this.failures.set(next,this.now()+retryDelayMs);
    }).finally(()=>{this.pending=null;});
   }
  }
  return this.displayed;
 }

 report(){
  return {resident:[...this.resident].sort((a,b)=>a-b),peakResident:this.peakResident,
   target:this.target,displayed:this.displayed,pending:this.pending,
   uploaded:this.uploaded,evicted:this.evicted,stageMisses:this.misses,
   maxUploadMs:Math.round(this.maxUploadMs*100)/100,loadErrors:this.loadErrors};
 }
}
