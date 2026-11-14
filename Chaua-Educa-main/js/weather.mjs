import { JOURNEY } from './journey.mjs';
import { smoothstep } from './motion.mjs';
import {seasonFromFlight,seasonWeights} from './climate-timeline.mjs';

// All VISUAL weather in the active game reads the same seasonal clock.
// Numeric-distance inputs remain for existing world-physics wind and tests.
const visualWeights=source=>seasonWeights(seasonFromFlight(source));

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
// This is exactly the old AUTO numeric-distance wind curve, including
// its adventure-only storm term, independent of weatherOverride.
export function physicsWind(distance,mode,tutorial=false){
    if(tutorial || !Number.isFinite(distance))return 0;
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
    if (!fog) return;
    const mist=weatherGradients(context,width,height).fog;
    context.save();
    context.globalAlpha = fog;
    context.fillStyle = mist;
    context.fillRect(0, 0, width, height);
    context.restore();
}

// Visual lightning flash and electric bolt in the clouds during storms
export function drawLightning(context, width, height, time, storm, reduced) {
    if (storm <= 0.05) return;

    // Strike occurs deterministically every ~3.2 seconds
    const cycle = (time * 0.31 + 0.15) % 1;
    if (cycle >= 0.09) return;

    const phase = cycle / 0.09;
    let flash = 0;
    if (phase < 0.35) {
        flash = Math.sin(phase / 0.35 * Math.PI);
    } else if (phase >= 0.42 && phase < 0.75) {
        flash = Math.sin((phase - 0.42) / 0.33 * Math.PI) * 0.72;
    }
    if (flash <= 0.01) return;

    context.save();

    // 1. Sky and atmospheric illumination
    context.globalAlpha = Math.min(0.85, flash * 0.78 * storm);
    context.fillStyle = '#e2efff';
    context.fillRect(0, 0, width, height);

    // 2. Visible jagged electric lightning bolt tearing through the sky
    if (!reduced && flash > 0.25) {
        context.globalAlpha = Math.min(1, flash * 1.1 * storm);
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
            const seed = (Math.floor(time * 3) * 17 + s * 11);
            const jitter = (Math.sin(seed * 0.8) * 26);
            currX = startX + (targetX - startX) * progress + jitter;
            currY = targetY * progress;
            context.lineTo(currX, currY);
        }
        context.globalAlpha=Math.min(.30,flash*.28*storm);
        context.strokeStyle='#93c5fd';
        context.lineWidth=9;
        context.stroke();
        context.globalAlpha=Math.min(1,flash*1.1*storm);
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

// Rain is a light procedural atmosphere, never a spritesheet or a bank of
// opaque white lines. Coordinates are deterministic in active flight time.
const rainWrap=(value,span)=>((value%span)+span)%span;
const rainClamp=x=>Math.min(1,Math.max(0,Number.isFinite(x)?x:0));
function renderRainBands(c,w,h,time,rain,storm,wind,low,foreground=false,speed=250){
 if(w<=0||h<=0)return;
 const bands=foreground?[{depth:1,count:low?10:38}]:
  [{depth:.40,count:low?18:68},{depth:.73,count:low?28:104}];
 // Similar density on laptop and portrait viewports, without letting a huge
 // canvas spawn an unbounded number of raindrops.
 const areaScale=Math.max(.65,Math.min(1.45,Math.sqrt(w*h/(960*640))));
 c.save();
 c.beginPath();c.rect(0,0,w,h);c.clip();
 c.lineCap='round';
 for(const {depth,count} of bands){
  const visibleCount=Math.max(1,Math.round(count*areaScale*(1+storm*.55)));
  const opacity=rainClamp(rain*(foreground?.68:.37+depth*.32)+storm*.10);
  c.globalAlpha=opacity;
  c.strokeStyle='#305768';
  c.fillStyle=foreground?'#e5f8ff':'#c4e4f0';
  c.lineWidth=foreground?2.1:1.1+depth*.75;
  // Soft, short curves: visibility comes from layering, not brightness.
  c.beginPath();
  for(let i=0;i<visibleCount;i++){
   const seed=(i+1)*67.17+depth*119.7;
   const fallSpeed=230+depth*270+storm*120+(i%4)*27+speed*.1;
   const y=rainWrap(seed*11.17+time*fallSpeed,h+64)-32;
   const x=rainWrap(seed*23.79-time*(14+wind*48+storm*14)*depth,w+64)-32;
   const length=(foreground?10:6)+depth*8+(i%3)*1.5;
   const sideways=-(wind*.55+storm*.26+speed*.0016)*length;
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
   const seed=(i+1)*67.17+depth*119.7;
   const fallSpeed=230+depth*270+storm*120+(i%4)*27+speed*.1;
   const y=rainWrap(seed*11.17+time*fallSpeed,h+64)-32;
   const x=rainWrap(seed*23.79-time*(14+wind*48+storm*14)*depth,w+64)-32;
   const radius=(foreground?.95:.48)+depth*.52+(i%3)*.08;
   const length=(foreground?10:6)+depth*8+(i%3)*1.5;
   c.moveTo(x+radius,y+length);
   c.ellipse(x,y+length,radius,radius*1.28,-.1,0,Math.PI*2);
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
 c.save();
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
 c.save();c.fillStyle='#b8dce5';
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
export function drawJourneyRain(context,width,height,time,rain,reduced,lowDetail,storm=0,wind=0,speed=250){
 if(rain<=0||width<=0||height<=0)return;
 const c=context;
 c.save();
 const wash=weatherGradients(c,width,height).rain;
 c.globalAlpha=rainClamp(rain*(.18+storm*.16));
 c.fillStyle=wash;c.fillRect(0,0,width,height);
 c.restore();
 if(reduced)return;
 renderRainBands(c,width,height,time,rain,storm,wind,lowDetail,false,speed);
 drawRainRipples(c,width,height,time,rain,storm,lowDetail,reduced);
}

// Foreground is deliberately sparse: actors, pickups and hazards must remain
// legible. In low/reduced modes unnecessary close droplets are suppressed.
export function drawForegroundRain(context,width,height,time,rain,reduced,lowDetail,storm=0,wind=0,speed=250){
 if(reduced||rain<=0)return;
 renderRainBands(context,width,height,time,rain,storm,wind,lowDetail,true,speed);
}

// A few long gusts remain legible against both green foliage and white winter
// mountains. Two batched strokes, bounded particle count, active scene clock.
export function drawWindGusts(c,w,h,time,wind,low=false,reduced=false){
 if(wind<=.01||reduced||w<=0||h<=0)return;
 c.save();c.lineCap='round';c.beginPath();
 const count=low?3:7;
 for(let i=0;i<count;i++){
  const x=w+180-rainWrap(i*173.7+time*(180+wind*90),w+360);
  const y=45+rainWrap(i*97.1+Math.sin(time*.6+i)*12,Math.max(1,h-90));
  const length=80+wind*65+(i%3)*16;
  c.moveTo(x,y);c.bezierCurveTo(x-length*.3,y-13,x-length*.7,y+15,x-length,y+3);
 }
 c.globalAlpha=wind*(.25+.09*Math.sin(time*1.7)**2);
 c.strokeStyle='#315965';c.lineWidth=3.3;c.stroke();
 c.globalAlpha=wind*(.49+.12*Math.sin(time*1.7)**2);
 c.strokeStyle='#eaf5e4';c.lineWidth=1.45;c.stroke();c.restore();
}
