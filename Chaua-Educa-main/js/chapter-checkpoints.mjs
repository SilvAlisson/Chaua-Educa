import {journeyLength} from './journey.mjs';
export const CHECKPOINT_KEY='chaua-friendly-chapters-v1';
export function normalizeCheckpoint(value){
 if(!value||value.version!==1||value.mode!=='tranquilo'||!Number.isInteger(value.stage)||value.stage<1||value.stage>3)return null;
 if(!Number.isInteger(value.seed)||value.seed<0||value.seed>0xffffffff||!Number.isFinite(value.elapsed)||value.elapsed<0||value.elapsed>20000)return null;
 const result={version:1,mode:'tranquilo',stage:value.stage,seed:value.seed,elapsed:value.elapsed};
 for(const key of ['sequence','snakeSequence','hawkSequence','foodSequence']){
  if(!Number.isInteger(value[key])||value[key]<0||value[key]>10000)return null;
  result[key]=value[key];
 }
 result.distance=journeyLength('tranquilo')*result.stage/4;
 return result;
}
export function chapterCheckpoint(game){
 if(game.tutorial||game.mode!=='tranquilo')return null;
 return normalizeCheckpoint({version:1,mode:game.mode,stage:game.stage,seed:game.seed,elapsed:game.elapsed,
  sequence:game.sequence,snakeSequence:game.snakeSequence,hawkSequence:game.hawkSequence,foodSequence:game.foodSequence});
}
