const clamp = value => Math.max(0, Math.min(1, value));
export const smoothstep = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

// The last pose is also the glide pose: releasing a wingbeat cannot snap back.
export function birdBlend(wing, reduced = false) {
    if (reduced || wing <= 0) return { pose: 1, next: 1, blend: 0 };
    const poses = [0, 2, 3, 1], position = (1 - clamp(wing)) * 4;
    const index = Math.min(3, Math.floor(position));
    return { pose: poses[index], next: poses[Math.min(3, index + 1)], blend: smoothstep((position % 1 - .55) / .45) };
}

export function hawkBlend(time, { dive = false, dazed = false, reduced = false, id = 0 } = {}) {
    if (dazed) return { pose: 3, next: 3, blend: 0 };
    if (reduced || time === 0) return { pose: 0, next: 0, blend: 0 };
    const poses = [0, 1, 2, 1], position = ((time * (dive ? 5 : 3.2) + id * .173) % 1 + 1) % 1 * 4;
    const index = Math.floor(position);
    return { pose: poses[index], next: poses[(index + 1) % 4], blend: smoothstep((position % 1 - .5) * 2) };
}

export function impactPose(progress, reduced = false) {
    const t = reduced ? 0 : smoothstep(progress);
    return { angle: -t * .65, x: -t * 6, y: t * 18 };
}

// World indices follow each leaf through a wrap, preserving its shape and wind phase.
export function borderCells(distance, spacing, left, width) {
    const first = Math.floor((left + distance) / spacing) - 1;
    const last = Math.ceil((left + width + distance) / spacing) + 1;
    return Array.from({ length: last - first + 1 }, (_, offset) => {
        const index = first + offset;
        return { index, x: index * spacing - distance };
    });
}
