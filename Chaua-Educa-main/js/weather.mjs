import { JOURNEY } from './journey.mjs';
import { smoothstep } from './motion.mjs';

const rainStart = JOURNEY[1].start + 1500;
const rainEnd = JOURNEY[2].start - 1000;
const fadeDistance = 1400;

export function journeyRain(distance, tutorial = false) {
    if (tutorial || distance <= rainStart || distance >= rainEnd) return 0;
    return smoothstep(Math.min(distance - rainStart, rainEnd - distance) / fadeDistance);
}

// Draw behind the actors in screen coordinates. One path batches the drops,
// and their positions depend on simulation time so the rain pauses with play.
export function drawJourneyRain(context, width, height, time, rain, reduced, lowDetail) {
    if (rain === 0) return;

    context.save();
    context.globalAlpha = rain * .25;
    context.fillStyle = '#263e55';
    context.fillRect(0, 0, width, height);
    if (!reduced) {
        const count = lowDetail ? 28 : 64;
        const drift = time * 74;
        const slant = 5 + Math.sin(time * .65) * 2;
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
