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

// Initialize from URL search parameters if provided (e.g. ?clima=storm, ?weather=snow, etc.)
if (typeof location !== 'undefined' && location.search) {
    const params = new URLSearchParams(location.search);
    const param = params.get('clima') || params.get('weather');
    if (param) weatherOverride = param.toLowerCase();
} else if (typeof localStorage !== 'undefined') {
    try {
        const saved = localStorage.getItem('chaua-weather-mode');
        if (saved) weatherOverride = saved;
    } catch {}
}

export function getWeatherMode() {
    return weatherOverride;
}

export function setWeatherMode(mode) {
    weatherOverride = mode || 'auto';
    if (typeof localStorage !== 'undefined') {
        try { localStorage.setItem('chaua-weather-mode', weatherOverride); } catch {}
    }
}

export function journeyRain(distance, tutorial = false) {
    if (weatherOverride === 'storm') return 1.0;
    if (weatherOverride === 'rain') return 0.85;
    if (weatherOverride === 'summer' || weatherOverride === 'winter' || weatherOverride === 'autumn' || weatherOverride === 'spring') return 0;
    if (tutorial || distance?.tutorial) return 0;
    if (distance && typeof distance==='object') return visualWeights(distance)[1]*.85;
    if (distance <= rainStart || distance >= rainEnd) return 0;
    return smoothstep(Math.min(distance - rainStart, rainEnd - distance) / fadeDistance);
}

export function journeyStorm(distance, mode, tutorial = false) {
    if (weatherOverride === 'storm') return 1.0;
    if (weatherOverride !== 'auto') return 0;
    if (tutorial || distance?.tutorial || (mode ?? distance?.mode) !== 'aventura') return 0;
    if (distance && typeof distance==='object') {
        const autumn=visualWeights(distance)[1];
        return smoothstep(Math.max(0,(autumn-.30)/.7))*.58;
    }
    const start = rainStart + 1100;
    const end = rainEnd - 1100;
    return smoothstep(Math.min(distance - start, end - distance) / 700);
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
        return w[0]*.20+w[1]*.75+w[2]*.20+w[3]*.45;
    }
    const start = JOURNEY[2].start + 600;
    const end = JOURNEY[2].start + 3700;
    const gust = smoothstep(Math.min(distance - start, end - distance) / 900);
    return Math.max(gust, journeyStorm(distance, mode));
}

export function journeyFog(distance, tutorial = false) {
    if (weatherOverride === 'rain') return 0.6;
    if (weatherOverride === 'storm') return 0.4;
    if (weatherOverride === 'winter') return 0.5;
    if (weatherOverride !== 'auto' || tutorial || distance?.tutorial) return 0;
    if (distance && typeof distance==='object') {
        const w=visualWeights(distance);
        return w[0]*.52+w[1]*.32+w[2]*.10+w[3]*.55;
    }
    return 1 - smoothstep(distance / 2900);
}

export function drawJourneyFog(context, width, height, fog) {
    if (!fog) return;
    const mist = context.createLinearGradient(0, height * .25, 0, height);
    mist.addColorStop(0, '#d8eee700');
    mist.addColorStop(.55, '#d8eee738');
    mist.addColorStop(1, '#d8eee789');
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
        context.strokeStyle = '#ffffff';
        context.lineWidth = 3.2;
        context.shadowColor = '#93c5fd';
        context.shadowBlur = 18;

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
 const bands=foreground?[{depth:1,count:low?7:14}]:
  [{depth:.40,count:low?10:20},{depth:.73,count:low?13:26}];
 c.save();
 c.beginPath();c.rect(0,0,w,h);c.clip();
 c.lineCap='round';
 for(const {depth,count} of bands){
  const opacity=rainClamp(rain*(foreground?.36:.17+depth*.20)+storm*.055);
  c.globalAlpha=opacity;
  c.strokeStyle=foreground?'#a3ccda':'#6f9daa';
  c.fillStyle=foreground?'#bde0e8':'#97b9c7';
  c.lineWidth=foreground?1.1:.55+depth*.48;
  // Soft, short curves: visibility comes from layering, not brightness.
  c.beginPath();
  for(let i=0;i<count;i++){
   const seed=(i+1)*67.17+depth*119.7;
   const fallSpeed=230+depth*270+storm*120+(i%4)*27+speed*.1;
   const y=rainWrap(seed*11.17+time*fallSpeed,h+64)-32;
   const x=rainWrap(seed*23.79-time*(14+wind*48+storm*14)*depth,w+64)-32;
   const length=(foreground?7:4)+depth*6+(i%3)*1.5;
   const sideways=-(wind*.55+storm*.26+speed*.0016)*length;
   c.moveTo(x,y);
   c.quadraticCurveTo(x+sideways*.22,y+length*.5,x+sideways*.42,y+length);
  }
  c.stroke();
  // Heads of droplets have volume and different focus instead of straight
  // horizontal screen-space streaks. One batch fill per depth band.
  c.beginPath();
  for(let i=0;i<count;i++){
   const seed=(i+1)*67.17+depth*119.7;
   const fallSpeed=230+depth*270+storm*120+(i%4)*27+speed*.1;
   const y=rainWrap(seed*11.17+time*fallSpeed,h+64)-32;
   const x=rainWrap(seed*23.79-time*(14+wind*48+storm*14)*depth,w+64)-32;
   const radius=(foreground?.72:.32)+depth*.52+(i%3)*.08;
   const length=(foreground?7:4)+depth*6+(i%3)*1.5;
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
  c.globalAlpha=rain*(1-phase)*.18;
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
  c.globalAlpha=wet*(1-phase)*.42;
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
 const wash=c.createLinearGradient(0,0,0,height);
 wash.addColorStop(0,'#324f61');wash.addColorStop(.62,'#6d8790');
 wash.addColorStop(1,'#92aaa8');
 c.globalAlpha=rainClamp(rain*(.12+storm*.075));
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
