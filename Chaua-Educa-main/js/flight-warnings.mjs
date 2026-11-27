import {placeWarnings} from './animation.mjs';
import {warningPosition,snakeWarningPosition} from './viewport.mjs';
import {snakeA2SpriteRect} from './snake-a2.mjs';
import {predictedHawkY} from './animals.mjs';

const ACTIVE_SNAKE_PHASES = new Set(['warning','windup','striking']);

function hasActiveThreat(entities, playerX) {
 for (let i = 0; i < entities.length; i++) {
  const e = entities[i];
  if (e.kind === 'hawk' && !e.harmless && e.x > playerX + 100) return true;
  if (e.kind === 'wood' && e.snake && ACTIVE_SNAKE_PHASES.has(e.snake.phase)) return true;
 }
 return false;
}

const EMPTY_WARNINGS = Object.freeze({boxes:Object.freeze([]),protectedRegions:Object.freeze([])});

// Presentation only: protected regions do not alter collision or encounters.
export function flightWarnings(game,view,reduced=false,shakeX=0,shakeY=0){
 if(!hasActiveThreat(game.entities, game.x))return EMPTY_WARNINGS;
 const notices=[],protectedRegions=[];
 const project=rect=>({x:view.x+(rect.x-view.worldLeft)*view.scale+shakeX,
  y:view.y+(rect.y-(view.worldTop||0))*view.scale+shakeY,w:rect.w*view.scale,h:rect.h*view.scale});
 const protect=rect=>{
  if(!rect)return;
  const p=project(rect);
  if(p.x+p.w>view.x&&p.x<view.x+view.w&&p.y+p.h>view.y&&p.y<view.y+view.h)protectedRegions.push(p);
 };
 // Bounds enclose the rotated 154px flight cell, including wing extremes.
 protect({x:game.x-116,y:game.y-116,w:232,h:232});
 for(let i=0;i<game.entities.length;i++){
  const e=game.entities[i];
  if(e.kind==='wood'&&e.snake){
   protect(snakeA2SpriteRect(e,reduced));
   if(ACTIVE_SNAKE_PHASES.has(e.snake.phase))
    notices.push({...snakeWarningPosition(view,e),w:160,h:26,type:'snake',entity:e});
  }else if(e.kind==='hawk'&&!e.harmless&&e.x>game.x+100){
   // Protect the visible bird, including authored wing/dive poses.
   if(!(e.warning>0))protect({x:e.x-170,y:e.y-170,w:340,h:340});
   const predictedY=Number.isFinite(e.startX)&&Number.isFinite(e.targetX)?predictedHawkY(e,game.x):e.y;
   notices.push({...warningPosition(view,predictedY),w:116,h:38,type:'hawk',entity:e});
  }
 }
 return {boxes:placeWarnings(notices,view,protectedRegions),protectedRegions};
}
