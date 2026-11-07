import { JOURNEY } from './journey.mjs';
import { smoothstep } from './motion.mjs';

const rainStart = JOURNEY[1].start + 1500;
const rainEnd = JOURNEY[2].start - 1000;
const fadeDistance = 1400;

export function journeyRain(distance, tutorial = false) {
    if (tutorial || distance <= rainStart || distance >= rainEnd) return 0;
    return smoothstep(Math.min(distance - rainStart, rainEnd - distance) / fadeDistance);
}

export function journeyStorm(distance, mode, tutorial = false) {
    if (tutorial || mode !== 'aventura') return 0;
    const start = rainStart + 1100;
    const end = rainEnd - 1100;
    return smoothstep(Math.min(distance - start, end - distance) / 700);
}

export function journeyWind(distance, mode, tutorial = false) {
    if (tutorial) return 0;
    const start = JOURNEY[2].start + 600;
    const end = JOURNEY[2].start + 3700;
    const gust = smoothstep(Math.min(distance - start, end - distance) / 900);
    return Math.max(gust, journeyStorm(distance, mode));
}

export function journeyFog(distance, tutorial = false) {
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

// Draw behind the actors in screen coordinates. One path batches the drops,
// and their positions depend on simulation time so the rain pauses with play.
export function drawJourneyRain(context, width, height, time, rain, reduced, lowDetail, storm = 0) {
    if (rain === 0) return;

    context.save();
    context.globalAlpha = rain * .25 + storm * .15;
    context.fillStyle = '#263e55';
    context.fillRect(0, 0, width, height);
    if (!reduced) {
        const count = (lowDetail ? 28 : 64) + Math.round(storm * (lowDetail ? 12 : 32));
        const drift = time * 74;
        const slant = 5 + storm * 6 + Math.sin(time * .65) * 2;
        context.globalAlpha = rain * .46;
        context.strokeStyle = '#e6f6ff';
        context.lineWidth = 1.2;
        context.beginPath();
        for (let i = 0; i < count; i++) {
            const x = ((i * 137.7 + drift) % (width + 16)) - 8;
            const y = ((i * 93.4 + time * (340 + (i % 4) * 40)) % (height + 36)) - 18;
            context.moveTo(x, y);
            context.lineTo(x + slant, y + 12 + (i % 4) * 2);
        }
        context.stroke();
    }
    context.restore();
}
