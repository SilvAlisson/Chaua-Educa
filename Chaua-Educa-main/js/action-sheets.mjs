// Required production action atlases. Unsupported states deliberately use their
// separately authored v6 poses; missing action assets must never silently swap art.
export const ACTION_SHEET_DEFS=Object.freeze({
 'parrot-flight': {path:'../public/parrot/fly/flight.webp',columns:4,rows:2,cell:256},
 'parrot-impact': {path:'../public/parrot/animations/impact.webp',columns:3,rows:2,cell:256},
 'hawk-flight': {path:'../public/hawk/fly/flight.webp',columns:4,rows:2,cell:320},
 'hawk-stunned': {path:'../public/hawk/animations/stunned.webp',columns:3,rows:2,cell:320},
});
const sheets=new Map();
let pending=null;
export function preloadActionSheets(){
 if(typeof Image==='undefined')return Promise.resolve([]);
 if(pending)return pending;
 pending=Promise.all(Object.entries(ACTION_SHEET_DEFS).map(async ([key,info])=>{
  const image=new Image();
  const src=new URL(info.path,import.meta.url).href;
  await new Promise((resolve,reject)=>{
   image.onload=resolve;
   image.onerror=()=>reject(new Error(`Required action atlas unavailable: ${key} (${src})`));
   image.src=src;
  });
  if(image.naturalWidth!==info.columns*info.cell||image.naturalHeight!==info.rows*info.cell)
   throw new Error(`Required action atlas has incorrect dimensions: ${key}`);
  if(image.decode)await image.decode();
  sheets.set(key,image);
  return key;
 }));
 return pending;
}
export function hasActionSheet(key){return sheets.has(key);}
export function drawActionSheet(c,key,index,x,y,width,height=width){
 const img=sheets.get(key),def=ACTION_SHEET_DEFS[key];
 if(!img||!def)throw new Error(`Required action atlas is not ready: ${key}`);
 const count=def.rows*def.columns;
 const i=Math.min(count-1,Math.max(0,Number.isFinite(index)?Math.floor(index):0));
 const sx=(i%def.columns)*def.cell,sy=Math.floor(i/def.columns)*def.cell;
 c.drawImage(img,sx,sy,def.cell,def.cell,x,y,width,height);
 return true;
}
