import { JOURNEY } from './journey.mjs';
import { smoothstep } from './motion.mjs';

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
    if (tutorial || distance <= rainStart || distance >= rainEnd) return 0;
    return smoothstep(Math.min(distance - rainStart, rainEnd - distance) / fadeDistance);
}

export function journeyStorm(distance, mode, tutorial = false) {
    if (weatherOverride === 'storm') return 1.0;
    if (weatherOverride !== 'auto') return 0;
    if (tutorial || mode !== 'aventura') return 0;
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
    if (tutorial) return 0;
    const start = JOURNEY[2].start + 600;
    const end = JOURNEY[2].start + 3700;
    const gust = smoothstep(Math.min(distance - start, end - distance) / 900);
    return Math.max(gust, journeyStorm(distance, mode));
}

export function journeyFog(distance, tutorial = false) {
    if (weatherOverride === 'rain') return 0.6;
    if (weatherOverride === 'storm') return 0.4;
    if (weatherOverride === 'winter') return 0.5;
    if (weatherOverride !== 'auto') return 0;
    return tutorial ? 0 : 1 - smoothstep(distance / 2900);
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

// Deterministic precipitation: depth-separated translucent drops with rounded
// heads and small curved trails. Avoid long opaque white streaks and allocations.
function drawRainDrops(c,w,h,time,rain,low,storm,wind,foreground=false,speed=250) {
 const bands=foreground?[{depth:1,amount:low?9:18}]:
  [{depth:.4,amount:low?10:22},{depth:.75,amount:low?10:27}];
 c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
 for(const {depth,amount} of bands){
  const slant=-(4+wind*13+storm*6+speed*.008)*depth;
  const alpha=Math.min(.75,rain*(foreground?.48:.22+depth*.24)+storm*.05);
  c.globalAlpha=alpha;
  c.lineCap='round';
  c.lineWidth=foreground?1.15:depth*.9;
  c.strokeStyle=foreground?'#a9d0df':'#6c9dad';
  c.fillStyle=foreground?'#d5edf5':'#9dc3d2';
  c.beginPath();
  for(let i=0;i<amount;i++){
   const seed=(i+1)*59.37+depth*171.9;
   const fall=(210+depth*310+storm*120+speed*.1+(i%5)*24)*time;
   const y=((seed*11.71+fall)%(h+58)+h+58)%(h+58)-29;
   const x=((seed*17.27+time*(slant*15))%(w+54)+w+54)%(w+54)-27;
   const len=(foreground?7:4)+depth*7+(i%3)*1.4;
   c.moveTo(x,y-len*.25);
   c.quadraticCurveTo(x-slant*.15,y+len*.2,x+slant*.25,y+len);
  }
  c.stroke();
  c.beginPath();
  for(let i=0;i<amount;i++){
   const seed=(i+1)*59.37+depth*171.9;
   const fall=(210+depth*310+storm*120+speed*.1+(i%5)*24)*time;
   const y=((seed*11.71+fall)%(h+58)+h+58)%(h+58)-29;
   const x=((seed*17.27+time*(slant*15))%(w+54)+w+54)%(w+54)-27;
   const size=(foreground?.95:.5)+depth*.7+(i%3)*.1;
   c.moveTo(x+size,y+lenForTip(depth,foreground));
   c.ellipse(x,y+lenForTip(depth,foreground),size,size*1.35,slant*.015,0,Math.PI*2);
  }
  c.fill();
 }
 c.restore();
}
function lenForTip(depth,foreground){return ((foreground?7:4)+depth*7)*.8;}

function drawRainRipples(c,w,h,time,rain,storm,low){
 const count=low?5:11;
 c.save();c.strokeStyle='#c5e5ef';c.lineWidth=1.1;
 for(let i=0;i<count;i++){
  const phase=(time*(1.25+storm*.45)+i*.37)%1;
  const x=(i*149.73+23)%w, y=h-18-(i*13.7)%35;
  c.globalAlpha=rain*.22*(1-phase);
  c.beginPath();c.ellipse(x,y,2+phase*8,.8+phase*3,0,0,Math.PI*2);c.stroke();
 }
 c.restore();
}

// Dim atmospheric wash and distant blue droplets behind the actors.
export function drawJourneyRain(context,width,height,time,rain,reduced,lowDetail,storm=0,wind=0,speed=250){
 if(rain<=0)return;
 const c=context,w=width,h=height;
 c.save();
 const haze=c.createLinearGradient(0,0,0,h);
 haze.addColorStop(0,'#27495b');haze.addColorStop(.6,'#597c86');haze.addColorStop(1,'#aac3bb');
 c.globalAlpha=rain*(.13+storm*.10);c.fillStyle=haze;c.fillRect(0,0,w,h);
 c.restore();
 if(reduced)return;
 drawRainDrops(c,w,h,time,rain,lowDetail,storm,wind,false,speed);
 drawRainRipples(c,w,h,time,rain,storm,lowDetail);
}

// Sparse, larger near-camera droplets and water beads provide depth, never
// a full screen of bright, opaque white lines.
export function drawForegroundRain(context,width,height,time,rain,reduced,lowDetail,storm=0,wind=0,speed=250){
 if(reduced || rain<=0)return;
 drawRainDrops(context,width,height,time,rain,lowDetail,storm,wind,true,speed);
 const c=context;
 c.save();c.globalAlpha=rain*.28;c.fillStyle='#c8e4eb';
 const count=lowDetail?3:7;
 for(let i=0;i<count;i++){
  const phase=(time*(.48+(i%3)*.1)+i*.37)%1;
  const x=(i*179.4+width*.13)%(width+16);
  const y=(i*109.3+time*(110+(i%3)*25))%(height+40)-20;
  c.globalAlpha=rain*(.15+.22*(1-phase));
  c.beginPath();c.ellipse(x,y,1.2+phase*1.8,2.3+phase*2.4,-.13,0,Math.PI*2);c.fill();
 }
 c.restore();
}
