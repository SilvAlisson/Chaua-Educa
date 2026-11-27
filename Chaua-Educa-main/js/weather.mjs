import {createArtSurface} from './art-surface.mjs';
import { JOURNEY,journeyReferenceDistance } from './journey.mjs';
import {lightningStrikeAt} from './lightning.mjs';
import { smoothstep } from './motion.mjs';
import {seasonFromFlight,seasonWeights} from './climate-timeline.mjs';

// All VISUAL weather in the active game reads the same seasonal clock.
// Numeric-distance inputs remain for existing world-physics wind and tests.
const visualWeightCache = new WeakMap();
const visualWeights=source=>{
    if (source && typeof source === 'object' && Number.isFinite(source.elapsed)) {
        let entry = visualWeightCache.get(source);
        if (entry && entry.elapsed === source.elapsed && entry.mode === source.mode && entry.tutorial === source.tutorial) {
            return entry.weights;
        }
        if (!entry) {
            entry = {elapsed: NaN, mode: undefined, tutorial: undefined, state: {from: 0, to: 0, mix: 1}, weights: [0, 0, 0, 0]};
            visualWeightCache.set(source, entry);
        }
        seasonWeights(seasonFromFlight(source, entry.state), entry.weights);
        entry.elapsed = source.elapsed;
        entry.mode = source.mode;
        entry.tutorial = source.tutorial;
        return entry.weights;
    }
    return seasonWeights(seasonFromFlight(source));
};

const rainStart = JOURNEY[1].start + 1500;
const rainEnd = JOURNEY[2].start - 1000;
const fadeDistance = 1400;

let weatherOverride = 'auto';

// Restore the saved user choice even if the URL contains unrelated query
// parameters such as ?perf-test=1. A valid explicit ?clima= override wins.
const VALID_WEATHER_MODES=new Set(['auto','spring','summer','autumn','winter','rain','storm']);
if(typeof localStorage!=='undefined'){
    try{
        const saved=localStorage.getItem('chaua-weather-mode')?.toLowerCase();
        if(VALID_WEATHER_MODES.has(saved))weatherOverride=saved;
    }catch{/* Storage may be blocked; default to auto. */}
}
if(typeof location!=='undefined' && location.search){
    const params=new URLSearchParams(location.search);
    const requested=(params.get('clima')||params.get('weather')||'').toLowerCase();
    if(VALID_WEATHER_MODES.has(requested))weatherOverride=requested;
}

export function getWeatherMode() {
    return weatherOverride;
}

export function setWeatherMode(mode) {
    const selected=typeof mode==='string'?mode.toLowerCase():'auto';
    weatherOverride=VALID_WEATHER_MODES.has(selected)?selected:'auto';
    if (typeof localStorage !== 'undefined') {
        try { localStorage.setItem('chaua-weather-mode', weatherOverride); } catch {}
    }
}

export function journeyRain(distance, tutorial = false) {
    if (weatherOverride === 'storm') return 1.0;
    if (weatherOverride === 'rain') return 0.85;
    if (weatherOverride === 'summer' || weatherOverride === 'winter' || weatherOverride === 'autumn' || weatherOverride === 'spring') return 0;
    if (tutorial || distance?.tutorial) return 0;
    if (distance && typeof distance==='object') return visualWeights(distance)[2]*.85;
    if (distance <= rainStart || distance >= rainEnd) return 0;
    return smoothstep(Math.min(distance - rainStart, rainEnd - distance) / fadeDistance);
}

export function journeyStorm(distance, mode, tutorial = false) {
    if (weatherOverride === 'storm') return 1.0;
    if (weatherOverride !== 'auto') return 0;
    if (tutorial || distance?.tutorial || (mode ?? distance?.mode) !== 'aventura') return 0;
    if (distance && typeof distance==='object') {
        const autumn=visualWeights(distance)[2];
        return smoothstep(Math.max(0,(autumn-.30)/.7))*.58;
    }
    const start = rainStart + 1100;
    const end = rainEnd - 1100;
    return smoothstep(Math.min(distance - start, end - distance) / 700);
}

// WORLD PHYSICS ONLY. Visual menu overrides (sun, storm, autumn, etc.)
// must never modify moving hazards, encounters or deterministic replays.
// The deterministic route-relative curve includes the challenge storm term;
// it never depends on the player's visual weather selection.
export function physicsWind(distance,mode,tutorial=false){
    if(tutorial || !Number.isFinite(distance))return 0;
    distance=journeyReferenceDistance(distance,mode);
    const gustStart=JOURNEY[2].start+600;
    const gustEnd=JOURNEY[2].start+3700;
    const gust=smoothstep(Math.min(distance-gustStart,gustEnd-distance)/900);
    if(mode!=='aventura')return gust;
    const stormStart=rainStart+1100,stormEnd=rainEnd-1100;
    const storm=smoothstep(Math.min(distance-stormStart,stormEnd-distance)/700);
    return Math.max(gust,storm);
}

export function journeyWind(distance, mode, tutorial = false) {
    if (weatherOverride === 'autumn') return 0.75;
    if (weatherOverride === 'storm') return 0.85;
    if (weatherOverride === 'winter') return 0.45;
    if (weatherOverride === 'summer') return 0.20;
    if (weatherOverride === 'spring') return 0.25;
    if (weatherOverride === 'rain') return 0.35;
    if (tutorial || distance?.tutorial) return 0;
    if (distance && typeof distance==='object') {
        const w=visualWeights(distance);
        return w[0]*.20+w[1]*.20+w[2]*.75+w[3]*.45;
    }
    return physicsWind(distance,mode,tutorial);
}

export function journeyFog(distance, tutorial = false) {
    if (weatherOverride === 'rain') return 0.6;
    if (weatherOverride === 'storm') return 0.4;
    if (weatherOverride === 'winter') return 0.5;
    if (weatherOverride !== 'auto' || tutorial || distance?.tutorial) return 0;
    if (distance && typeof distance==='object') {
        const w=visualWeights(distance);
        return w[0]*.52+w[1]*.10+w[2]*.32+w[3]*.55;
    }
    return 1 - smoothstep(distance / 2900);
}

// Context-bound reusable gradients: changing canvas size invalidates the
// cache. Reusing a CanvasGradient across different contexts is unsafe.
const weatherGradientCache=new WeakMap();
let weatherStripCache=null;
function getWeatherGradientStrips(){
    if(weatherStripCache)return weatherStripCache;
    if(typeof document==='undefined')return null;
    const make=(stops)=>{
        const canvas=createArtSurface();
        canvas.width=1;canvas.height=256;
        const sc=canvas.getContext('2d');
        if(!sc)return null;
        const g=sc.createLinearGradient(0,0,0,256);
        for(const [pos,color] of stops)g.addColorStop(pos,color);
        sc.fillStyle=g;sc.fillRect(0,0,1,256);
        return canvas;
    };
    const fog=make([[0,'#d8eee700'],[.55,'#d8eee738'],[1,'#d8eee789']]);
    const rain=make([[0,'#324f61'],[.62,'#6d8790'],[1,'#92aaa8']]);
    if(!fog||!rain)return null;
    weatherStripCache={fog,rain};
    return weatherStripCache;
}
function weatherGradients(c,w,h){
    const previous=weatherGradientCache.get(c);
    if(previous&&previous.w===w&&previous.h===h)return previous;
    const fog=c.createLinearGradient(0,h*.25,0,h);
    fog.addColorStop(0,'#d8eee700');
    fog.addColorStop(.55,'#d8eee738');
    fog.addColorStop(1,'#d8eee789');
    const rain=c.createLinearGradient(0,0,0,h);
    rain.addColorStop(0,'#324f61');
    rain.addColorStop(.62,'#6d8790');
    rain.addColorStop(1,'#92aaa8');
    const record={w,h,fog,rain};
    weatherGradientCache.set(c,record);
    return record;
}

export function drawJourneyFog(context, width, height, fog) {
    if (!fog || fog <= .002) return;
    const strips=typeof context.drawImage==='function'?getWeatherGradientStrips():null;
    context.save();
    context.globalAlpha = fog;
    if(strips){
        context.drawImage(strips.fog, 0, height * .25, width, height * .75);
    }else{
        context.fillStyle = weatherGradients(context,width,height).fog;
        context.fillRect(0, height * .25, width, height * .75);
    }
    context.restore();
}

// Two natural pulses from one deterministic discharge. The same envelope
// lights the background and, after actors are drawn, the entire flight scene.
export function lightningFlashStrength(time, storm=1, reduced=false) {
    if (storm<=.05||reduced)return 0;
    const strike=lightningStrikeAt(time);
    if(!strike.active)return 0;
    const phase=strike.phase;
    let flash=0;
    if(phase<.35)flash=Math.sin(phase/.35*Math.PI);
    else if(phase>=.42&&phase<.75)flash=Math.sin((phase-.42)/.33*Math.PI)*.72;
    return flash>.01?Math.min(1,flash*storm):0;
}

let lightningBoltCache=null;
function getLightningBoltSprite(strikeIndex,width,height,consumer){
 if(typeof document==='undefined')return null;
 if(lightningBoltCache&&lightningBoltCache.index===strikeIndex&&lightningBoltCache.w===width&&lightningBoltCache.h===height){
  return lightningBoltCache.canvas;
 }
 const minX=Math.floor(Math.min(width*0.46,width*0.62)-38);
 const maxX=Math.ceil(Math.max(width*0.46,width*0.62)+78);
 const maxY=Math.ceil(height*0.78+16);
 const bw=Math.max(32,maxX-minX),bh=Math.max(32,maxY);
 const canvas=lightningBoltCache?.canvas??createArtSurface();
 canvas.width=bw;canvas.height=bh;
 const lc=canvas.getContext('2d');
 if(!lc)return null;
 lc.clearRect(0,0,bw,bh);
 lc.save();lc.translate(-minX,0);
 const startX=width*.62,targetX=width*.46,targetY=height*.48,steps=10;
 lc.beginPath();
 let currX=startX,currY=0;
 lc.moveTo(currX,currY);
 for(let s=1;s<=steps;s++){
  const progress=s/steps,seed=strikeIndex*17+s*11,jitter=Math.sin(seed*.8)*26;
  currX=startX+(targetX-startX)*progress+jitter;currY=targetY*progress;
  lc.lineTo(currX,currY);
 }
 lc.globalAlpha=.28;lc.strokeStyle='#93c5fd';lc.lineWidth=9;lc.stroke();
 lc.globalAlpha=1;lc.strokeStyle='#ffffff';lc.lineWidth=2.8;lc.stroke();
 lc.lineWidth=1.6;lc.beginPath();
 lc.moveTo(startX+(targetX-startX)*.5,targetY*.5);
 lc.lineTo(startX+(targetX-startX)*.5+40,targetY*.65);
 lc.lineTo(startX+(targetX-startX)*.5+65,targetY*.78);
 lc.stroke();
 lc.restore();
 consumer?.refreshImage?.(canvas);
 lightningBoltCache={index:strikeIndex,w:width,h:height,x:minX,bw,bh,canvas};
 return canvas;
}

// Atmospheric brightness plus a visible electric bolt in the clouds.
export function drawLightning(context, width, height, time, storm, reduced) {
    const flash=lightningFlashStrength(time,storm,reduced);
    if(!flash)return;
    const strike=lightningStrikeAt(time);

    context.save();

    // 1. Sky and atmospheric illumination
    context.globalAlpha = Math.min(0.85, flash * 0.78);
    context.fillStyle = '#e2efff';
    context.fillRect(0, 0, width, height);

    // 2. Visible jagged electric lightning bolt tearing through the sky
    if (!reduced && flash > 0.25) {
        const boltSprite = typeof context.drawImage === 'function'
            ? getLightningBoltSprite(strike.index, width, height, context) : null;
        if (boltSprite) {
            context.globalAlpha = Math.min(1, flash * 1.1);
            context.drawImage(boltSprite, lightningBoltCache.x, 0, lightningBoltCache.bw, lightningBoltCache.bh);
            context.restore();
            return;
        }
        context.globalAlpha = Math.min(1, flash * 1.1);
        // Two opaque/transparent strokes preserve the bolt's authored
        // silhouette without an expensive Canvas shadowBlur gaussian pass.
        context.shadowBlur=0;

        const startX = width * 0.62;
        const targetX = width * 0.46;
        const targetY = height * 0.48;
        const steps = 10;

        context.beginPath();
        let currX = startX, currY = 0;
        context.moveTo(currX, currY);

        for (let s = 1; s <= steps; s++) {
            const progress = s / steps;
            const seed = (strike.index * 17 + s * 11);
            const jitter = (Math.sin(seed * 0.8) * 26);
            currX = startX + (targetX - startX) * progress + jitter;
            currY = targetY * progress;
            context.lineTo(currX, currY);
        }
        context.globalAlpha=Math.min(.30,flash*.28);
        context.strokeStyle='#93c5fd';
        context.lineWidth=9;
        context.stroke();
        context.globalAlpha=Math.min(1,flash*1.1);
        context.strokeStyle='#ffffff';
        context.lineWidth=2.8;
        context.stroke();

        // Fork branch
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(startX + (targetX - startX) * 0.5, targetY * 0.5);
        context.lineTo(startX + (targetX - startX) * 0.5 + 40, targetY * 0.65);
        context.lineTo(startX + (targetX - startX) * 0.5 + 65, targetY * 0.78);
        context.stroke();
    }

    context.restore();
}

// Draw after forest, trunks, birds and weather so the flash actually lights
// all visible artwork. One lightweight screen-blended fill, no blur/shaders.
export function drawLightningIllumination(context,width,height,time,storm,reduced=false) {
    const flash=lightningFlashStrength(time,storm,reduced);
    if(!flash)return;
    context.save();
    context.globalCompositeOperation='screen';
    context.globalAlpha=Math.min(.66,flash*.56);
    context.fillStyle='#d9eaff';
    context.fillRect(0,0,width,height);
    context.restore();
}

// Rain is a light procedural atmosphere, never a spritesheet or a bank of
// opaque white lines. Coordinates are deterministic in active flight time.
const rainWrap=(value,span)=>((value%span)+span)%span;
const rainClamp=x=>Math.min(1,Math.max(0,Number.isFinite(x)?x:0));
const rainScratch=[];
const RAIN_BANDS_FG_LOW = Object.freeze([{depth:1,count:10}]);
const RAIN_BANDS_FG_NORM = Object.freeze([{depth:1,count:38}]);
const RAIN_BANDS_BG_LOW = Object.freeze([{depth:.40,count:18},{depth:.73,count:28}]);
const RAIN_BANDS_BG_NORM = Object.freeze([{depth:.40,count:68},{depth:.73,count:104}]);
const rainDropSheets = new Map();
const RAIN_DROP_SCALE = 2;
const RAIN_BAND_SPECS = Object.freeze([
 {foreground:false,depth:.40},
 {foreground:false,depth:.73},
 {foreground:true,depth:1}
]);
function getRainDropSheet(tiltStep) {
 let entry = rainDropSheets.get(tiltStep);
 if (entry) return entry;
 const tilt = tiltStep / 8;
 const maxLength = 21;
 const sidewaysMax = tilt * maxLength;
 const pad = 5;
 const minX = Math.floor(Math.min(0, sidewaysMax * .22, sidewaysMax * .42) - pad);
 const maxX = Math.ceil(Math.max(0, sidewaysMax * .22, sidewaysMax * .42) + pad);
 const cellW = Math.max(16, maxX - minX);
 const cellH = 30;
 const ox = -minX, oy = 4;
 const surface = createArtSurface();
 surface.width = cellW * 3 * RAIN_DROP_SCALE;
 surface.height = cellH * 3 * RAIN_DROP_SCALE;
 const oc = surface.getContext('2d');
 if (!oc) return null;
 oc.lineCap = 'round';
 for (let row = 0; row < RAIN_BAND_SPECS.length; row++) {
  const {foreground, depth} = RAIN_BAND_SPECS[row];
  const strokeMain = foreground ? '#e5f8ff' : '#c4e4f0';
  const baseLen = (foreground ? 10 : 6) + depth * 8;
  const baseRad = (foreground ? .95 : .48) + depth * .52;
  const lwOuter = foreground ? 2.1 : 1.1 + depth * .75;
  const lwInner = foreground ? 1.15 : .65 + depth * .4;
  for (let variant = 0; variant < 3; variant++) {
   const length = baseLen + variant * 1.5;
   const radius = baseRad + variant * .08;
   const sideways = tilt * length;
   const tipX = sideways * .42;
   oc.save();
   oc.scale(RAIN_DROP_SCALE, RAIN_DROP_SCALE);
   oc.translate(variant * cellW + ox, row * cellH + oy);
   oc.beginPath();
   oc.moveTo(0, 0);
   oc.quadraticCurveTo(sideways * .22, length * .5, tipX, length);
   oc.strokeStyle = '#305768';
   oc.lineWidth = lwOuter;
   oc.stroke();
   oc.strokeStyle = strokeMain;
   oc.lineWidth = lwInner;
   oc.stroke();
   oc.fillStyle = strokeMain;
   oc.beginPath();
   oc.ellipse(tipX, length, radius, radius * 1.28, -.1, 0, Math.PI * 2);
   oc.fill();
   oc.restore();
  }
 }
 if (rainDropSheets.size >= 32) {
  const oldest = rainDropSheets.keys().next().value;
  const oldEntry = rainDropSheets.get(oldest);
  if (oldEntry?.surface) { oldEntry.surface.width = 0; oldEntry.surface.height = 0; }
  rainDropSheets.delete(oldest);
 }
 entry = { surface, cellW, cellH, ox, oy };
 rainDropSheets.set(tiltStep, entry);
 return entry;
}

let weatherVfxSprites=null;
function getWeatherVfxSprites(){
 if(weatherVfxSprites)return weatherVfxSprites;
 if(typeof document==='undefined')return null;
 // Ripples (4 quantized radii inside 24x16 cells -> 96x16) and surface impacts (4 inside 16x12 -> 64x12).
 const ripples=createArtSurface();
 ripples.width=96;ripples.height=16;
 const rc=ripples.getContext('2d');
 if(!rc)return null;
 rc.strokeStyle='#a4d6df';rc.lineWidth=1.8;
 for(let q=0;q<4;q++){
  const phase=(q+.5)/4;
  rc.beginPath();
  rc.ellipse(q*24+12,8,(1.7+phase*6)*1.2,(.6+phase*2.3)*1.2,0,0,Math.PI*2);
  rc.stroke();
 }
 const impacts=createArtSurface();
 impacts.width=64;impacts.height=12;
 const ic=impacts.getContext('2d');
 if(!ic)return null;
 ic.fillStyle='#b8dce5';
 for(let q=0;q<4;q++){
  const phase=(q+.5)/4;
  ic.beginPath();
  ic.ellipse(q*16+8,6,(1.15+phase*2)*1.5,(.55+phase*1.1)*1.5,0,0,Math.PI*2);
  ic.fill();
 }
 // Wind gust Bezier curve pre-baked at 2x (row 0: dark outline, row 1: crisp highlight).
 const gusts=createArtSurface();
 gusts.width=320;gusts.height=160;
 const gc=gusts.getContext('2d');
 if(!gc)return null;
 gc.lineCap='round';
 gc.beginPath();gc.moveTo(300,40);gc.bezierCurveTo(210,14,90,70,20,46);
 gc.strokeStyle='#315965';gc.lineWidth=6.6;gc.stroke();
 gc.beginPath();gc.moveTo(300,120);gc.bezierCurveTo(210,94,90,150,20,126);
 gc.strokeStyle='#eaf5e4';gc.lineWidth=2.9;gc.stroke();
 weatherVfxSprites={ripples,impacts,gusts};
 return weatherVfxSprites;
}
function isFullSurfaceViewport(c,w,h){
 if(typeof document==='undefined'||!c?.canvas||typeof c.getTransform!=='function')return false;
 const m=c.getTransform();
 return m.b===0&&m.c===0&&Math.abs(m.e)<=1&&Math.abs(m.f)<=1&&
  Math.abs(w*m.a-c.canvas.width)<=2&&Math.abs(h*m.d-c.canvas.height)<=2;
}

export function prewarmRainWeather(c, w = 960, h = 640) {
 if (!c) return;
 if (w > 0 && h > 0) weatherGradients(c, w, h);
 const strips = getWeatherGradientStrips();
 const vfx = getWeatherVfxSprites();
 const bolt = getLightningBoltSprite(0, w, h);
 c.save();
 c.setTransform(1, 0, 0, 1, 0, 0);
 c.globalAlpha = 0.004;
 if (strips) {
  c.drawImage(strips.fog, 0, 0, 1, 4, 0, 0, 1, 2);
  c.drawImage(strips.rain, 0, 0, 1, 4, 0, 0, 1, 2);
 }
 if (vfx) {
  c.drawImage(vfx.ripples, 0, 0, 4, 4, 0, 0, 2, 2);
  c.drawImage(vfx.impacts, 0, 0, 4, 4, 0, 0, 2, 2);
  c.drawImage(vfx.gusts, 0, 0, 4, 4, 0, 0, 2, 2);
 }
 if (bolt) {
  c.drawImage(bolt, 0, 0, 4, 4, 0, 0, 2, 2);
 }
 if (typeof OffscreenCanvas !== 'undefined' && typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
  for (let tiltStep = 2; tiltStep >= -14; tiltStep--) {
   const sheet = getRainDropSheet(tiltStep);
   if (sheet) c.drawImage(sheet.surface, 0, 0, 4, 4, 0, 0, 2, 2);
  }
 }
 c.restore();
}

function renderRainBands(c,w,h,time,rain,storm,wind,low,foreground=false,speed=250,motion=null){
 if(w<=0||h<=0)return;
 const bands=foreground?(low?RAIN_BANDS_FG_LOW:RAIN_BANDS_FG_NORM):
  (low?RAIN_BANDS_BG_LOW:RAIN_BANDS_BG_NORM);
 // Similar density on laptop and portrait viewports, without letting a huge
 // canvas spawn an unbounded number of raindrops.
 const areaScale=Math.max(.65,Math.min(1.45,Math.sqrt(w*h/(960*640))));
 // Motion values are constant for the entire paint call; do not repeat
 // optional property reads and multiplications for every rain drop.
 const stormTravel=motion?.storm??time*storm;
 const windTravel=motion?.wind??time*wind;
 const speedTravel=motion?.speed??time*speed;
 const useStamps=typeof OffscreenCanvas!=='undefined'&&typeof OffscreenCanvasRenderingContext2D!=='undefined';
 const tiltSlope=-(wind*.55+storm*.26+speed*.0016);
 const tiltStep=Math.round(tiltSlope*8);
 const sheet=useStamps?getRainDropSheet(tiltStep):null;
 const squall=1+storm*.12*Math.sin(time*.76+stormTravel*.22);
 c.save();
 if(!sheet||!isFullSurfaceViewport(c,w,h)){c.beginPath();c.rect(0,0,w,h);c.clip();}
 if(!sheet)c.lineCap='round';
 for(const {depth,count} of bands){
  const visibleCount=Math.max(1,Math.round(count*areaScale*(1+storm*.55)));
  const driftX=(time*14+windTravel*48+stormTravel*14)*depth;
  const opacity=rainClamp((rain*(foreground?.68:.37+depth*.32)+storm*.10)*squall);
  c.globalAlpha=opacity;
  if(sheet){
   const bandRow=foreground?2:(depth<.6?0:1);
   const sy=bandRow*sheet.cellH*RAIN_DROP_SCALE;
   const sw=sheet.cellW*RAIN_DROP_SCALE,sh=sheet.cellH*RAIN_DROP_SCALE;
   const cw=sheet.cellW,ch=sheet.cellH,ox=sheet.ox,oy=sheet.oy;
   const baseA=230+depth*270,baseB=stormTravel*120+speedTravel*.1;
   for(let i=0;i<visibleCount;i++){
    const seed=(i+1)*67.17+depth*119.7;
    const y=rainWrap(seed*11.17+time*(baseA+(i%4)*27)+baseB,h+64)-32;
    const x=rainWrap(seed*23.79-driftX,w+64)-32;
    const sx=(i%3)*sw;
    c.drawImage(sheet.surface,sx,sy,sw,sh,x-ox,y-oy,cw,ch);
   }
   continue;
  }
  c.strokeStyle='#305768';
  c.fillStyle=foreground?'#e5f8ff':'#c4e4f0';
  c.lineWidth=foreground?2.1:1.1+depth*.75;
  // Soft, short curves: visibility comes from layering, not brightness.
  c.beginPath();
  for(let i=0;i<visibleCount;i++){
   const seed=(i+1)*67.17+depth*119.7;
   const y=rainWrap(seed*11.17+time*(230+depth*270+(i%4)*27)+stormTravel*120+speedTravel*.1,h+64)-32;
   const x=rainWrap(seed*23.79-driftX,w+64)-32;
   const length=(foreground?10:6)+depth*8+(i%3)*1.5;
   const sideways=tiltSlope*length;
   const item=rainScratch[i]||(rainScratch[i]={x:0,y:0,length:0,tipX:0,radius:0});
   item.x=x;item.y=y;item.length=length;
   item.radius=(foreground?.95:.48)+depth*.52+(i%3)*.08;
   item.tipX=x+tiltSlope*length*.42;
   c.moveTo(x,y);
   c.quadraticCurveTo(x+sideways*.22,y+length*.5,x+sideways*.42,y+length);
  }
  c.stroke();
  c.strokeStyle=foreground?'#e5f8ff':'#c4e4f0';
  c.lineWidth=foreground?1.15:.65+depth*.4;
  c.stroke();
  // Heads of droplets have volume and different focus instead of straight
  // horizontal screen-space streaks. One batch fill per depth band.
  c.beginPath();
  for(let i=0;i<visibleCount;i++){
   const item=rainScratch[i];
   c.moveTo(item.tipX+item.radius,item.y+item.length);
   c.ellipse(item.tipX,item.y+item.length,item.radius,item.radius*1.28,-.1,0,Math.PI*2);
  }
  c.fill();
 }
 c.restore();
}

// Ground contact: a few shallow expanding ellipses instead of circles that
// look like airborne bubbles. They are drawn below characters and HUD.
export function drawRainRipples(c,w,h,time,rain,storm,low,reduced=false){
 if(reduced||rain<=0||w<=0||h<=0)return;
 const count=low?4:9;
 const vfx=typeof c.drawImage==='function'?getWeatherVfxSprites():null;
 c.save();
 if(vfx){
  for(let i=0;i<count;i++){
   const phase=rainWrap(time*(1.2+storm*.37)+i*.417,1);
   const x=rainWrap(i*173.6+24,w);
   const y=h-20-(i*17.1)%33;
   const q=Math.min(3,Math.floor(phase*4));
   c.globalAlpha=rain*(1-phase)*.30;
   c.drawImage(vfx.ripples,q*24,0,24,16,x-10,y-6.5,20,13);
  }
  c.restore();
  return;
 }
 c.strokeStyle='#a4d6df';c.lineWidth=.9;
 for(let i=0;i<count;i++){
  const phase=rainWrap(time*(1.2+storm*.37)+i*.417,1);
  const x=rainWrap(i*173.6+24,w);
  const y=h-20-(i*17.1)%33;
  c.globalAlpha=rain*(1-phase)*.30;
  c.beginPath();c.ellipse(x,y,1.7+phase*6,.6+phase*2.3,0,0,Math.PI*2);
  c.stroke();
 }
 c.restore();
}

// A handful of tiny impacts on a known material face; kept separate from
// the atmospheric particles so that trees can emit water without extra art.
export function drawSurfaceRainImpacts(c,x,y,wet,time,seed=0,low=false,reduced=false){
 if(wet<=.03||reduced)return;
 const count=low?2:4;
 const vfx=typeof c.drawImage==='function'?getWeatherVfxSprites():null;
 c.save();
 if(vfx){
  for(let i=0;i<count;i++){
   const phase=rainWrap(time*(1.5+(i%3)*.19)+seed*.37+i*.28,1);
   const sx=x+(i-(count-1)*.5)*12;
   const sy=y-(1-phase)*6;
   const q=Math.min(3,Math.floor(phase*4));
   c.globalAlpha=wet*(1-phase)*.58;
   c.drawImage(vfx.impacts,q*16,0,16,12,sx-5.5,sy-4,11,8);
  }
  c.restore();
  return;
 }
 c.fillStyle='#b8dce5';
 for(let i=0;i<count;i++){
  const phase=rainWrap(time*(1.5+(i%3)*.19)+seed*.37+i*.28,1);
  const sx=x+(i-(count-1)*.5)*12;
  const sy=y-(1-phase)*6;
  c.globalAlpha=wet*(1-phase)*.58;
  c.beginPath();
  c.ellipse(sx,sy,1.15+phase*2,.55+phase*1.1,0,0,Math.PI*2);
  c.fill();
 }
 c.restore();
}

// Distant rain with a narrow atmospheric wash, near-bluish shadows, droplets
// and ground contact. Keeps tint restrained so the authored forest survives.
export function drawJourneyRain(context,width,height,time,rain,reduced,lowDetail,storm=0,wind=0,speed=250,motion=null){
 if(rain<=0||width<=0||height<=0)return;
 const c=context;
 const strips=typeof c.drawImage==='function'?getWeatherGradientStrips():null;
 c.save();
 c.globalAlpha=rainClamp(rain*(.18+storm*.16));
 if(strips){
  c.drawImage(strips.rain,0,0,width,height);
 }else{
  const wash=weatherGradients(c,width,height).rain;
  c.fillStyle=wash;c.fillRect(0,0,width,height);
 }
 c.restore();
 if(reduced)return;
 renderRainBands(c,width,height,time,rain,storm,wind,lowDetail,false,speed,motion);
 drawRainRipples(c,width,height,time,rain,storm,lowDetail,reduced);
}

// Foreground is deliberately sparse: actors, pickups and hazards must remain
// legible. In low/reduced modes unnecessary close droplets are suppressed.
export function drawForegroundRain(context,width,height,time,rain,reduced,lowDetail,storm=0,wind=0,speed=250,motion=null){
 if(reduced||rain<=0)return;
 renderRainBands(context,width,height,time,rain,storm,wind,lowDetail,true,speed,motion);
}

// A few long gusts remain legible against both green foliage and white winter
// mountains. Two batched strokes, bounded particle count, active scene clock.
export function drawWindGusts(c,w,h,time,wind,low=false,reduced=false,motion=null){
 if(wind<=.01||reduced||w<=0||h<=0)return;
 const count=low?3:7;
 const vfx=typeof c.drawImage==='function'?getWeatherVfxSprites():null;
 c.save();
 if(vfx){
  const sway=Math.sin(time*1.7)**2;
  const aOuter=wind*(.25+.09*sway),aInner=wind*(.49+.12*sway);
  const posY=rainScratch;
  for(let i=0;i<count;i++){
   const x=w+180-rainWrap(i*173.7+time*180+(motion?.wind??time*wind)*90,w+360);
   const y=45+rainWrap(i*97.1+Math.sin(time*.6+i)*12,Math.max(1,h-90));
   const length=80+wind*65+(i%3)*16;
   const slot=posY[i]||(posY[i]={});
   slot.x=x-length*1.071;slot.y=y-20;slot.w=length*1.143;slot.h=40;
  }
  c.globalAlpha=aOuter;
  for(let i=0;i<count;i++){const s=posY[i];c.drawImage(vfx.gusts,0,0,320,80,s.x,s.y,s.w,s.h);}
  c.globalAlpha=aInner;
  for(let i=0;i<count;i++){const s=posY[i];c.drawImage(vfx.gusts,0,80,320,80,s.x,s.y,s.w,s.h);}
  c.restore();
  return;
 }
 c.lineCap='round';c.beginPath();
 for(let i=0;i<count;i++){
  const x=w+180-rainWrap(i*173.7+time*180+(motion?.wind??time*wind)*90,w+360);
  const y=45+rainWrap(i*97.1+Math.sin(time*.6+i)*12,Math.max(1,h-90));
  const length=80+wind*65+(i%3)*16;
  c.moveTo(x,y);c.bezierCurveTo(x-length*.3,y-13,x-length*.7,y+15,x-length,y+3);
 }
 c.globalAlpha=wind*(.25+.09*Math.sin(time*1.7)**2);
 c.strokeStyle='#315965';c.lineWidth=3.3;c.stroke();
 c.globalAlpha=wind*(.49+.12*Math.sin(time*1.7)**2);
 c.strokeStyle='#eaf5e4';c.lineWidth=1.45;c.stroke();c.restore();
}
