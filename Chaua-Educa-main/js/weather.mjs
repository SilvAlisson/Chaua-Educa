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

// Draw behind actors in screen coordinates with realistic slanted velocity, wind drift and droplet ripples
export function drawJourneyRain(context, width, height, time, rain, reduced, lowDetail, storm = 0, wind = 0, speed = 250) {
    if (rain === 0) return;

    context.save();
    context.globalAlpha = rain * .25 + storm * .15;
    context.fillStyle = '#263e55';
    context.fillRect(0, 0, width, height);

    if (!reduced) {
        const count = (lowDetail ? 28 : 72) + Math.round(storm * (lowDetail ? 16 : 48));
        const drift = -time * (70 + wind * 60);
        const slant = -((speed * 0.025) + wind * 10 + 8 + storm * 7 + Math.sin(time * .65) * 2);
        context.globalAlpha = Math.min(0.85, rain * .48 + storm * .25);
        context.strokeStyle = storm > 0.4 ? '#f0f8ff' : '#e6f6ff';
        context.lineWidth = storm > 0.4 ? 1.4 : 1.2;
        context.beginPath();

        for (let i = 0; i < count; i++) {
            const x = ((i * 137.7 + drift) % (width + 48) + (width + 48)) % (width + 48) - 24;
            const y = ((i * 93.4 + time * (360 + (i % 4) * 45)) % (height + 36)) - 18;
            context.moveTo(x, y);
            context.lineTo(x + slant, y + 14 + (i % 4) * 3);
        }
        context.stroke();

        // Rain splash ripples on the forest floor / bottom vegetation
        if (!lowDetail) {
            context.globalAlpha = rain * 0.28;
            context.fillStyle = '#e6f6ff';
            context.beginPath();
            const splashCount = 14 + Math.round(storm * 12);
            for (let i = 0; i < splashCount; i++) {
                const sx = ((i * 197.3 + time * 120) % width);
                const sy = height - 25 + (i * 7.1) % 20;
                const sr = 2.5 + ((i + Math.floor(time * 12)) % 3) * 1.5;
                context.moveTo(sx + sr, sy);
                context.arc(sx, sy, sr, 0, Math.PI * 2);
            }
            context.fill();
        }
    }
    context.restore();
}

// Draw in front of actors and obstacles in screen coordinates for cinematic depth
export function drawForegroundRain(context, width, height, time, rain, reduced, lowDetail, storm = 0, wind = 0, speed = 250) {
    if (rain === 0 || reduced) return;

    context.save();
    const count = (lowDetail ? 16 : 36) + Math.round(storm * (lowDetail ? 10 : 22));
    const drift = -time * (90 + wind * 80);
    const slant = -((speed * 0.035) + wind * 14 + 10 + storm * 8 + Math.sin(time * 0.75) * 2);
    const fallSpeed = 580 + storm * 160;

    context.globalAlpha = Math.min(0.72, rain * 0.38 + storm * 0.26);
    context.strokeStyle = storm > 0.4 ? '#f5faff' : '#d8f0ff';
    context.lineWidth = storm > 0.4 ? 1.8 : 1.4;
    context.beginPath();

    for (let i = 0; i < count; i++) {
        const x = ((i * 187.3 + drift) % (width + 60) + (width + 60)) % (width + 60) - 30;
        const y = ((i * 113.7 + time * (fallSpeed + (i % 4) * 55)) % (height + 50)) - 25;
        const len = 22 + (i % 4) * 6;
        context.moveTo(x, y);
        context.lineTo(x + slant * (len / 18), y + len);
    }
    context.stroke();
    context.restore();
}
