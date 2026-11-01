// Living wood is wider than the complete flight sprite. All coordinates are world units.
export const TREE_WIDTH=110;
export const TREE_CENTER=29;
export function livingWoodRects(e,height=640){
 if(e.broken&&!e.brokenSide)return [];
 const left=e.x+TREE_CENTER-TREE_WIDTH/2;
 const solids=[{x:left,y:0,w:TREE_WIDTH,h:e.top},{x:left,y:e.bottom,w:TREE_WIDTH,h:height-e.bottom}];
 if(e.variant==='branch')solids.push({x:e.x+TREE_CENTER-102,y:e.bottom+28,w:108,h:50,part:'living-branch'});
 if(e.variant==='broken'&&!e.dryBranchBroken)solids.unshift({x:e.x+80,y:e.top-35,w:28,h:18,part:'dry-branch'});
 return solids.filter(r=>!e.broken||(r.y>=e.bottom?'bottom':'top')!==e.brokenSide);
}
