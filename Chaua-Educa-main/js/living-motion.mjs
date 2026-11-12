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

// Calibrated flight-time winter transition and explicit weather override
export function winterAmount(game) {
    const wm = getWeatherMode();
    if (wm === 'winter') return 1.0;
    if (wm !== 'auto') return 0;
    return seasonWeights(seasonFromFlight(game))[3];
}

// Bright summer tropical sun presence
export function summerSunAmount(game, rain = 0, storm = 0) {
    const wm = getWeatherMode();
    if (wm === 'summer') return 1.0;
    if (wm === 'storm' || wm === 'rain' || wm === 'winter') return 0;
    if (wm === 'autumn') return 0.25;
    if (wm === 'spring') return 0.55;
    const w=seasonWeights(seasonFromFlight(game));
    return clamp((w[0]*.50+w[1]*1.0+w[2]*.15)*(1-rain*.8-storm*.7));
}
