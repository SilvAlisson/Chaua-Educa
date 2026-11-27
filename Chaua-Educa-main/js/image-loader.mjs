import {PERF_AB_VARIANT} from './perf-ab.mjs';
const CAN_YIELD_TASK = typeof window !== 'undefined' && typeof document !== 'undefined'
 && typeof OffscreenCanvas !== 'undefined' && typeof requestAnimationFrame === 'function'
 && typeof performance !== 'undefined';
let sliceStartedAt = 0;
let rasterQueue = Promise.resolve();

function hasNativeRaf() {
 if (!CAN_YIELD_TASK || document.hidden) return false;
 try {
  return typeof window.requestAnimationFrame === 'function'
   && String(window.requestAnimationFrame).includes('[native code]');
 } catch { return false; }
}

function nextFrameOrTimer() {
 if (!hasNativeRaf()) return new Promise(resolve => setTimeout(resolve, 0));
 return new Promise(resolve => {
  let done = false;
  const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
  const timer = setTimeout(finish, 25);
  window.requestAnimationFrame(finish);
 });
}

export function resetTaskSlice() {
 sliceStartedAt = typeof performance !== 'undefined' ? performance.now() : 0;
}

export async function yieldTaskSlice(budgetMs = 5) {
 if (!CAN_YIELD_TASK) return;
 const now = performance.now();
 if (!sliceStartedAt) {
  sliceStartedAt = now;
  return;
 }
 if (now - sliceStartedAt < budgetMs) return;
 await nextFrameOrTimer();
 sliceStartedAt = performance.now();
}

function rasterizeLoadedImage(image) {
 // Keep decoded pixel data in a persistent canvas surface so Chromium does not
 // evict discardable LazyPixelRefs and synchronously re-decode WebPs mid-flight.
 // Prefer an HTMLCanvasElement in browsers so drawing onto the main 2D canvas
 // avoids OffscreenCanvas cross-surface sync stalls during warmup and gameplay.
 if (typeof document === 'undefined' && typeof OffscreenCanvasRenderingContext2D === 'undefined') return image;
 const w = image.naturalWidth, h = image.naturalHeight;
 if (!(w > 0 && h > 0)) return image;
 const surface = typeof document !== 'undefined' ? document.createElement('canvas') :
  typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null;
 if (!surface) return image;
 surface.width = w; surface.height = h;
 const ctx = surface.getContext('2d');
 if (!ctx || typeof ctx.drawImage !== 'function') return image;
 ctx.drawImage(image, 0, 0);
 return attachAssetMetadata(surface,image,'canvas')?surface:image;
}

function attachAssetMetadata(asset,image,representation) {
 try {
  Object.defineProperties(asset,{
   naturalWidth:{value:image.naturalWidth,configurable:true},
   naturalHeight:{value:image.naturalHeight,configurable:true},
   src:{value:image.src,configurable:true},
   complete:{value:true,configurable:true},
   _rasterized:{value:true,configurable:true},
   _representation:{value:representation,configurable:true},
  });
  return true;
 } catch { return false; }
}

async function tryImageBitmap(image) {
 try { return await createImageBitmap(image); }
 catch { return null; }
}

// Bound transfer, decoding and bitmap creation. A failed attempt never publishes a partial cache.
export function loadImage(url,{width,height,errorMessage=`Não foi possível carregar a imagem: ${url}`,timeoutMs=20000,rasterize=true,representation=rasterize?'canvas':'image'}={}) {
 return new Promise((resolve,reject)=>{
  const image=new Image();let settled=false;
  const finish=(error,asset)=>{
   if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;
   if(error){image.src='';reject(error);}else resolve(asset);
  };
  const timer=setTimeout(()=>finish(new Error(`${errorMessage} · tempo limite de carregamento/decodificação`)),timeoutMs);
  image.onerror=()=>finish(new Error(errorMessage));
  image.onload=async()=>{
   if(settled)return;
   if(!image.naturalWidth||!image.naturalHeight||(width&&image.naturalWidth!==width)||(height&&image.naturalHeight!==height)){
    finish(new Error(`${errorMessage} · dimensões inválidas`));return;
   }
   try {
    if(typeof image.decode==='function')await image.decode();
    if(settled)return;
    const nativeTexture=PERF_AB_VARIANT==='pixi-webgl-winter';
    if((representation==='bitmap'||nativeTexture)&&typeof createImageBitmap==='function'){
     const bitmap=await tryImageBitmap(image);
     if(settled){bitmap?.close();return;}
     if(bitmap){
      if(attachAssetMetadata(bitmap,image,'bitmap')){finish(null,bitmap);return;}
      bitmap.close();
     }
    }
    if(representation==='image'||nativeTexture){finish(null,image);return;}
    if(!CAN_YIELD_TASK){finish(null,rasterizeLoadedImage(image));return;}
    // Download & decode succeeded; cancel network timeout before waiting in rasterQueue.
    clearTimeout(timer);
    // Serialize and cooperatively slice canvas rasterization across macrotasks
    // so dozens of simultaneous WebP decodes never block main-thread input/paint.
    const step = async () => {
     if (settled) return image;
     await yieldTaskSlice(4);
     if (settled) return image;
     if (!sliceStartedAt) sliceStartedAt = performance.now();
     return rasterizeLoadedImage(image);
    };
    const next = rasterQueue.then(step, step);
    rasterQueue = next.catch(() => {});
    const asset = await next;
    if (!settled) finish(null, asset);
   }
   catch(error){finish(new Error(`${errorMessage} · falha de decodificação`,{cause:error}));}
  };
  image.src=url;
 });
}
