// Optional action atlases; all authored sources retain their existing fallback.
// Enabled only for ?actionSprites=1, so the optimized production branch cannot
// regress until the six prepared WebP files have been installed and reviewed.
export const ACTION_SPRITES_ENABLED =
 typeof location!=='undefined' && new URLSearchParams(location.search).get('actionSprites')==='1';
export const ACTION_SHEET_DEFS=Object.freeze({
 'parrot-flight': {path:'../public/parrot/fly/flight.webp',columns:4,rows:2,cell:256},
 'parrot-impact': {path:'../public/parrot/animations/impact.webp',columns:3,rows:2,cell:256},
 'hawk-flight': {path:'../public/hawk/fly/flight.webp',columns:4,rows:2,cell:320},
 'hawk-stunned': {path:'../public/hawk/animations/stunned.webp',columns:3,rows:2,cell:320},
 'snake-strike': {path:'../public/snake/animations/strike.webp',columns:3,rows:2,cell:320},
 'snake-stunned': {path:'../public/snake/animations/stunned.webp',columns:3,rows:2,cell:320},
});
const sheets=new Map();
let pending=null;
export function preloadActionSheets(){
 if(!ACTION_SPRITES_ENABLED||typeof Image==='undefined')return Promise.resolve([]);
 if(pending)return pending;
 pending=Promise.all(Object.entries(ACTION_SHEET_DEFS).map(async ([key,info])=>{
  const image=new Image();
  const src=new URL(info.path,import.meta.url).href;
  try{
   // Missing optional files must not break the game or its existing atlas.
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=src;});
   if(image.naturalWidth!==info.columns*info.cell||image.naturalHeight!==info.rows*info.cell)
    throw Error('Invalid atlas dimensions: '+key);
   if(image.decode)await image.decode().catch(()=>{});
   sheets.set(key,image);
   return key;
  }catch{return null;}
 })).then(keys=>keys.filter(Boolean));
 return pending;
}
export function hasActionSheet(key){return ACTION_SPRITES_ENABLED&&sheets.has(key);}
export function drawActionSheet(c,key,index,x,y,width,height=width){
 if(!ACTION_SPRITES_ENABLED)return false;
 const img=sheets.get(key),def=ACTION_SHEET_DEFS[key];
 if(!img||!def)return false;
 const count=def.rows*def.columns;
 const i=Math.min(count-1,Math.max(0,Number.isFinite(index)?Math.floor(index):0));
 const sx=(i%def.columns)*def.cell,sy=Math.floor(i/def.columns)*def.cell;
 c.drawImage(img,sx,sy,def.cell,def.cell,x,y,width,height);
 return true;
}
