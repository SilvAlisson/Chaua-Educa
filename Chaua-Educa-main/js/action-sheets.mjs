import {loadCatalogAsset} from './assets.mjs';
import {ACTION_SHEET_DEFS} from './asset-manifest.mjs';
import {activeProbe} from './perf-hooks.mjs';

// Required production action atlases. Unsupported states deliberately use their
// separately authored v6 poses; missing action assets must never silently swap art.
export {ACTION_SHEET_DEFS};

const FIRST_DRAW_KEYS=Object.freeze(Object.fromEntries(
 Object.keys(ACTION_SHEET_DEFS).map(key=>[key,`action:${key}`])
));
const sheets=new Map();
let pending=null;

export function preloadActionSheets(){
 if(typeof Image==='undefined')return Promise.resolve([]);
 if(pending)return pending;
 pending=Promise.all(Object.keys(ACTION_SHEET_DEFS).map(async key=>[key,await loadCatalogAsset(key,'canvas','Required action atlas unavailable: '+key)]))
 .then(entries=>{for(const [key,image] of entries)sheets.set(key,image);return entries.map(([key])=>key);})
 .catch(error=>{pending=null;throw error;});
 return pending;
}

export function hasActionSheet(key){return sheets.has(key);}

export function drawActionSheet(c,key,index,x,y,width,height=width){
 const img=sheets.get(key),def=ACTION_SHEET_DEFS[key];
 if(!img||!def)throw new Error(`Required action atlas is not ready: ${key}`);
 const count=def.frames.length;
 const i=Math.min(count-1,Math.max(0,Number.isFinite(index)?Math.floor(index):0));
 const [sx,sy]=def.frames[i].rect;

 const probe=activeProbe;
 const frame=probe?.currentFrame;
 // Asset warmup runs outside the measured gameplay frame.
 if(!probe?.deep||!frame||probe.game?.state!=='playing'){
  c.drawImage(img,sx,sy,def.cell,def.cell,x,y,width,height);
  return true;
 }

 const asset=FIRST_DRAW_KEYS[key];
 if(probe.firstDraws.has(asset)){
  c.drawImage(img,sx,sy,def.cell,def.cell,x,y,width,height);
  return true;
 }

 const operation='action.firstDrawCpu';
 const drawAt=probe.begin(operation);
 c.drawImage(img,sx,sy,def.cell,def.cell,x,y,width,height);
 const drawCpuMs=probe.end(operation,drawAt,{sheet:key});
 probe.firstDraw(asset,drawCpuMs,{sheet:key});
 return true;
}
