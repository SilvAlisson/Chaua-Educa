import {smoothstep} from './motion.mjs';
import {getWeatherMode} from './weather.mjs';
import {seasonFromFlight,seasonWeights} from './climate-timeline.mjs';

const clamp = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

// Continuous simulation-time breeze: pausing never advances weather or secondary animation.
export function breeze(time = 0, strength = 0, reduced = false, x = 0) {
    if (reduced) return 0;
    const intensity = 0.16 + 0.64 * clamp(strength);
    return intensity * (0.65 * Math.sin(time * 1.7 - x * 0.002) + 0.35 * Math.sin(time * 3.1 - x * 0.003));
}

// Organic trunk and branch sway with hit recoil impulse
export function treeBend(time, wind, id, hitAge, reduced = false) {
    if (reduced) return 0;
    const recoil = hitAge === null ? 0 : Math.sin(hitAge * 24) * Math.exp(-hitAge * 7) * 0.009;
    return breeze(time, wind, false, id * 41) * 0.003 + recoil;
}

// Distance-based or weather-override winter mountain transition
export function winterAmount(distance) {
    const wm = getWeatherMode();
    if (wm === 'winter') return 1.0;
    if (wm !== 'auto') return 0;
    if (distance && typeof distance==='object') return seasonWeights(seasonFromFlight(distance))[3];
    // Historical distance-only API for visual benchmarks and legacy tests.
    return smoothstep(clamp((distance - 17500) / 700)) * smoothstep(clamp((20200 - distance) / 700));
}

// Bright summer tropical sun presence
export function summerSunAmount(distance = 0, rain = 0, storm = 0) {
    const wm = getWeatherMode();
    if (wm === 'summer') return 1.0;
    if (wm === 'storm' || wm === 'rain' || wm === 'winter') return 0;
    if (wm === 'autumn') return 0.25;
    if (wm === 'spring') return 0.55;
    if (distance && typeof distance==='object') {
        const w=seasonWeights(seasonFromFlight(distance));
        return clamp((w[0]*.50+w[1]*1.0+w[2]*.15)*(1-rain*.8-storm*.7));
    }
    if (rain > 0.1 || storm > 0.1) return Math.max(0, 1 - (rain * 0.8 + storm * 0.9));
    // Legacy distance-only fallback.
    return 0.75;
}
