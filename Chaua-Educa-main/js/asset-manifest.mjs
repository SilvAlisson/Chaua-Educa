import {FOREST_ART} from './forest-art-data.mjs';
import {RUNTIME_ART} from './runtime-art-data.mjs';
import {SPRITES} from './sprite-data.mjs';
import {WINTER_CAP_ART} from './winter-cap-data.mjs';

const asset = (path,width,height,frames=[]) => ({path,width,height,frames});
const grid = (path,columns,rows,cell,anchor=[cell/2,cell/2]) => ({
 ...asset(path,columns*cell,rows*cell,Array.from({length:columns*rows},(_,index)=>({
  rect:[index%columns*cell,Math.floor(index/columns)*cell,cell,cell],anchor,
 }))),columns,rows,cell,
});
const winterPath='../assets/Seasons/Winter/';
const framesOf=(frames)=>frames.map(frame=>({rect:frame.rect,anchor:frame.anchor}));

export const ACTION_SHEET_DEFS=Object.freeze({
 'parrot-flight':grid('../public/parrot/fly/flight.webp',4,2,256),
 'parrot-impact':grid('../public/parrot/animations/impact.webp',3,2,256),
 'hawk-flight':grid('../public/hawk/fly/flight.webp',4,2,320),
 'hawk-stunned':grid('../public/hawk/animations/stunned.webp',3,2,320),
});
export const SNAKE_A2_GRID=Object.freeze({columns:4,rows:2,cell:384,anchorX:192,anchorY:352});
export const SNAKE_SHEET_DEFS=Object.freeze(Object.fromEntries(Object.entries({
 idle:'base/idle',attack:'attack/attack',stunned:'reactions/stunned',high:'attack/high',sweep:'attack/sweep',
}).map(([key,path])=>[key,grid('../public/snake/'+path+'.webp',SNAKE_A2_GRID.columns,SNAKE_A2_GRID.rows,SNAKE_A2_GRID.cell,[SNAKE_A2_GRID.anchorX,SNAKE_A2_GRID.anchorY])])));

export const BASE_ASSETS=Object.freeze({
 'chaua-atlas':asset('../assets/v6/chaua-atlas.webp',1536,1536,framesOf(SPRITES.chaua.frames)),
 'hawk-atlas':asset('../assets/v6/hawk-atlas.webp',1536,1536,framesOf(SPRITES.hawk.frames)),
 ...Object.fromEntries(['lower','upper'].flatMap(kind=>[
  ['trees-'+kind,asset('../assets/v7/trees-'+kind+'.webp',1024,1024,framesOf(FOREST_ART[kind]))],
  ['trees-'+kind+'-snow-04',asset(winterPath+'trees-'+kind+'-snow-04.webp',1024,1024,framesOf(FOREST_ART[kind]))],
 ])),
 forest:asset('../assets/v3/forest.webp',1920,1080),
 feather:asset('../assets/v4/feather.webp',384,384),
 shield:asset('../assets/v4/shield.webp',384,384),
 'tree-variants':grid('../assets/v9/tree-variants.webp',2,2,256,[128,8]),
 'season-backgrounds':asset('../assets/v10/season-backgrounds.webp',1672,941,[
  {rect:[0,0,836,470]},{rect:[836,0,836,470]},{rect:[0,471,836,470]},{rect:[836,471,836,470]},
 ]),
 'season-particles':grid('../assets/v10/season-particles.webp',2,2,128),
 'clay-breath':grid('../assets/v10/clay-breath.webp',4,1,128),
 ...Object.fromEntries(Object.entries(RUNTIME_ART).flatMap(([family,def])=>def.pages.map((page,index)=>{
  const frames=family==='foods' ? def.frames.flat().map(rect=>({rect,anchor:[rect[2]/2,rect[3]/2]}))
   : Object.values(def.frames).filter(frame=>frame.page===index).map(({rect,offset})=>({rect,offset}));
  return [`runtime-${family}-${index}`,{...asset(page.path,page.width,page.height,frames),sha256:page.sha256}];
 }))),
});

export const LEGACY_SNOW_ASSETS=Object.freeze({
 'trees-lower-overlay-04':asset(winterPath+'trees-lower-overlay-04.webp',1024,1024,framesOf(FOREST_ART.lower)),
 'trees-upper-overlay-04':asset(winterPath+'trees-upper-overlay-04.webp',1024,1024,framesOf(FOREST_ART.upper)),
 'tree-variants-snow':grid('../assets/v10/tree-variants-snow.webp',2,2,256,[128,8]),
});

const capAsset=(page,frames)=>({...asset(winterPath+'Precomposed/'+page.file,page.width,page.height,frames),sha256:page.sha256});
const caps=(records)=>Object.values(records).flatMap(stages=>stages.flatMap(frames=>frames??[])).filter(Boolean);
const packedFrames=caps(WINTER_CAP_ART.frames);
export const WINTER_PAGE_ASSETS=Object.freeze(Object.fromEntries(WINTER_CAP_ART.pages.map((page,index)=>[
 'winter-caps-'+index,capAsset(page,packedFrames.filter(frame=>frame[0]===index).map(([, ...rect])=>({rect}))),
])));
export const WINTER_STAGE_ASSETS=Object.freeze(Object.fromEntries(WINTER_CAP_ART.stagePages.filter(Boolean).map(page=>[
 'winter-caps-stage-'+page.stage,capAsset(page,Object.values(WINTER_CAP_ART.stageFrames).flatMap(stages=>
  (stages[page.stage]??[]).filter(Boolean).map(rect=>({rect})))),
])));

export const ASSET_CATALOG=Object.freeze({
 ...BASE_ASSETS,...LEGACY_SNOW_ASSETS,...WINTER_PAGE_ASSETS,...WINTER_STAGE_ASSETS,...ACTION_SHEET_DEFS,
 ...Object.fromEntries(Object.entries(SNAKE_SHEET_DEFS).map(([key,entry])=>['snake:'+key,entry])),
});
