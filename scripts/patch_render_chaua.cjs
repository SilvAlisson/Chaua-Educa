const fs = require('fs');

let render = fs.readFileSync('Chaua-Educa-main/js/render.mjs', 'utf8').replace(/\r\n/g, '\n');

// 1. Helper animation functions for Chaua
const helpers = `
function drawSpiralEye(c, ex, ey, r, t) {
    c.save();
    c.beginPath();
    c.arc(ex, ey, r, 0, TAU);
    c.fillStyle = '#ffffff';
    c.fill();
    c.lineWidth = 1.6;
    c.strokeStyle = '#18311a';
    c.stroke();

    c.beginPath();
    const spin = t * 11;
    const maxA = 3.2 * Math.PI;
    for (let a = 0; a <= maxA; a += 0.16) {
        const rad = (a / maxA) * (r * 0.82);
        const px = ex + Math.cos(a + spin) * rad;
        const py = ey + Math.sin(a + spin) * rad;
        if (a === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
    }
    c.lineWidth = 2.0;
    c.strokeStyle = '#152b17';
    c.stroke();
    c.restore();
}

function drawOrbitingStars(c, hx, hy, size, t) {
    c.save();
    const rx = size * 0.32;
    const ry = size * 0.12;
    c.translate(hx, hy - 6);
    c.rotate(-0.14);

    for (let i = 0; i < 3; i++) {
        const phase = t * 5.5 + (i * TAU) / 3;
        const sx = Math.cos(phase) * rx;
        const sy = Math.sin(phase) * ry;
        const depth = Math.sin(phase);
        const s = (0.85 + depth * 0.3) * (size / 100);

        c.save();
        c.translate(sx, sy);
        c.rotate(t * 3.5 + i);
        c.scale(s, s);

        c.beginPath();
        const spikes = 5, outerR = 10, innerR = 4.6;
        for (let j = 0; j < spikes * 2; j++) {
            const rad = j % 2 === 0 ? outerR : innerR;
            const a = (j * Math.PI) / spikes - Math.PI / 2;
            const px = Math.cos(a) * rad;
            const py = Math.sin(a) * rad;
            if (j === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
        }
        c.closePath();
        c.fillStyle = depth < -0.2 ? '#e5be00' : '#ffe44d';
        c.fill();
        c.lineWidth = 1.4;
        c.strokeStyle = '#7c5200';
        c.stroke();

        if (depth > -0.2) {
            c.beginPath();
            c.arc(-1.5, -2, 2.2, 0, TAU);
            c.fillStyle = '#ffffff';
            c.fill();
        }
        c.restore();
    }
    c.restore();
}

function drawHappyEye(c, ex, ey, r) {
    c.save();
    c.beginPath();
    c.arc(ex, ey, r, 0, TAU);
    c.fillStyle = '#ffffff';
    c.fill();
    c.lineWidth = 1.4;
    c.strokeStyle = '#18311a';
    c.stroke();

    c.beginPath();
    c.arc(ex, ey + 3, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
    c.lineWidth = 2.8;
    c.strokeStyle = '#152b17';
    c.lineCap = 'round';
    c.stroke();
    c.restore();
}

function drawMiniSparkle(c, x, y, r, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.beginPath();
    c.moveTo(0, -r); c.lineTo(r * 0.28, -r * 0.28);
    c.lineTo(r, 0); c.lineTo(r * 0.28, r * 0.28);
    c.lineTo(0, r); c.lineTo(-r * 0.28, r * 0.28);
    c.lineTo(-r, 0); c.lineTo(-r * 0.28, -r * 0.28);
    c.closePath();
    c.fillStyle = '#fff4a8';
    c.fill();
    c.lineWidth = 1.2;
    c.strokeStyle = '#8c6600';
    c.stroke();
    c.restore();
}

function drawFruitSparkles(c, bx, by, reaction, t) {
    c.save();
    const progress = Math.max(0, Math.min(1, 1 - (reaction / 0.26)));
    const floatY = -progress * 34;
    const wobble = Math.sin(progress * 15) * 6;

    c.font = '800 18px Nunito, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffe959';
    c.strokeStyle = '#223d16';
    c.lineWidth = 2.6;
    const noteX = bx + 10 + wobble;
    const noteY = by - 10 + floatY;
    c.strokeText('♪', noteX, noteY);
    c.fillText('♪', noteX, noteY);

    const sp1X = bx + 22 + wobble * 0.5;
    const sp1Y = by - 18 + floatY * 0.8;
    drawMiniSparkle(c, sp1X, sp1Y, 6, t * 6);

    const sp2X = bx - 4 - wobble * 0.4;
    const sp2Y = by - 26 + floatY * 1.1;
    drawMiniSparkle(c, sp2X, sp2Y, 4.5, t * 8 + 1);
    c.restore();
}

function drawTurboFlames(c, size, t) {
    c.save();
    const tailX = -size * 0.44;
    const tailY = size * 0.06;
    c.translate(tailX, tailY);

    for (let f = 0; f < 3; f++) {
        const angle = 0.08 * (f - 1) + Math.sin(t * 30 + f) * 0.06;
        const len = (size * 0.46 + Math.sin(t * 40 + f * 2) * (size * 0.15));
        const w = size * 0.10 - f * (size * 0.02);

        c.save();
        c.rotate(angle);
        c.beginPath();
        c.moveTo(2, -w * 0.6);
        c.quadraticCurveTo(-len * 0.5, -w, -len, 0);
        c.quadraticCurveTo(-len * 0.5, w, 2, w * 0.6);
        c.closePath();

        const grad = c.createLinearGradient(0, 0, -len, 0);
        if (f === 0) {
            grad.addColorStop(0, '#ff3700ee');
            grad.addColorStop(0.6, '#ff8000cc');
            grad.addColorStop(1, '#ff370000');
        } else if (f === 1) {
            grad.addColorStop(0, '#ffbb00ee');
            grad.addColorStop(0.5, '#ffe600cc');
            grad.addColorStop(1, '#ff800000');
        } else {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, '#ffffaacc');
            grad.addColorStop(1, '#ffea0000');
        }
        c.fillStyle = grad;
        c.fill();
        c.restore();
    }
    c.restore();
}

function drawTurboWindLines(c, size, t) {
    c.save();
    c.strokeStyle = '#ffffffaa';
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
        const offset = ((t * 800 + i * 45) % (size * 1.2)) - size * 0.6;
        const ly = (i - 1) * (size * 0.22);
        c.beginPath();
        c.moveTo(-offset - size * 0.2, ly);
        c.lineTo(-offset, ly);
        c.stroke();
    }
    c.restore();
}

function drawSweatDrops(c, hx, hy, size, t) {
    c.save();
    c.translate(hx, hy);
    for (let i = 0; i < 2; i++) {
        const dropPhase = ((t * 2.6 + i * 0.5) % 1);
        const dx = -dropPhase * 36;
        const dy = -4 + dropPhase * 20;
        const alpha = Math.sin(dropPhase * Math.PI);
        const r = (size * 0.052) * (1 - dropPhase * 0.25);

        c.save();
        c.globalAlpha = Math.max(0, alpha);
        c.translate(dx, dy);
        c.rotate(-0.35);

        c.beginPath();
        c.arc(0, 0, r, 0, Math.PI);
        c.lineTo(0, -r * 2.0);
        c.closePath();

        c.fillStyle = '#5ac9ff';
        c.fill();
        c.lineWidth = 1.3;
        c.strokeStyle = '#1e6ea8';
        c.stroke();

        c.beginPath();
        c.arc(-r * 0.3, -r * 0.2, r * 0.35, 0, TAU);
        c.fillStyle = '#ffffff';
        c.fill();
        c.restore();
    }
    c.restore();
}

function drawRefugeHearts(c, x, y, size, t) {
    c.save();
    c.translate(x, y);
    for (let i = 0; i < 2; i++) {
        const phase = ((t * 1.5 + i * 0.5) % 1);
        const hx = Math.sin(phase * 4 + i) * 12;
        const hy = -phase * 35;
        const scale = (0.7 + phase * 0.4) * Math.sin(phase * Math.PI);

        c.save();
        c.translate(hx, hy);
        c.scale(scale, scale);
        c.beginPath();
        c.moveTo(0, 3);
        c.bezierCurveTo(-6, -4, -10, -10, 0, -16);
        c.bezierCurveTo(10, -10, 6, -4, 0, 3);
        c.fillStyle = '#ff5b79';
        c.fill();
        c.lineWidth = 1;
        c.strokeStyle = '#a61c3a';
        c.stroke();
        c.restore();
    }
    c.restore();
}
`;

// 2. New drawBird definition
const newDrawBird = `export function drawBird(c, {
    x, y, scale = 1, angle = 0, wing = 0, perched = false, time = 0, surprise = false,
    reduced = false, reaction = 0, flapImpulse = 0, vy = 0,
    defeated = false, impactProgress = 0, turbo = false, stamina = 1, won = false
}) {
    const pose = flightPose(wing, reduced);
    const image = images.get(perched ? (surprise ? 'chaua-hero' : 'perch') : \`chaua-\${pose}\`);
    if (!image) return;

    c.save();
    c.translate(x, y);

    let renderAngle = angle;
    if (defeated && !reduced) {
        const prog = impactProgress > 0 ? impactProgress : 1;
        const tumble = prog * Math.PI * 2.8;
        renderAngle = angle - tumble;
        c.translate(-prog * 8, prog * 22);
    }
    c.rotate(renderAngle);

    const breath = reduced ? 1 : 1 + Math.sin(time * 1.8) * .008;
    const size = (perched ? 115 : 125) * scale;
    const factor = size / image.naturalWidth;
    const [ax, ay] = perched ? [.5, .52] : BIRD_ANCHORS[pose];
    const pop = reduced ? 1 : 1 + Math.sin(Math.max(0, reaction) / .26 * Math.PI) * .08;
    const spring = !perched && !reduced ? Math.sin(Math.max(0, Math.min(1, flapImpulse)) * Math.PI) * 0.16 : 0;
    const velSquash = !perched && !reduced ? Math.max(-0.08, Math.min(0.12, (vy || 0) / 3000)) : 0;

    const turboStretchX = turbo && !reduced ? 1.10 : 1;
    const turboStretchY = turbo && !reduced ? 0.92 : 1;
    const fatiguePant = !perched && !reduced && stamina < 0.28 ? Math.sin(time * 12) * 0.04 : 0;

    const stretchY = (1 + spring - velSquash + fatiguePant) * turboStretchY;
    const stretchX = (1 - spring * 0.5 + velSquash * 0.5) * turboStretchX;
    c.scale(breath * pop * stretchX, breath * pop * stretchY);

    if (turbo && !perched && !reduced) {
        drawTurboFlames(c, size, time);
    }

    const q = Math.max(0, (1 - wing) * 4);
    const blend = !perched && !reduced && wing > 0 ? Math.max(0, (q % 1 - .72) / .28) : 0;
    const next = images.get(\`chaua-\${[0, 2, 3, 1][Math.min(3, Math.floor(q) + 1)]}\`);
    c.globalAlpha = 1 - blend;
    flightLayer(c, image, factor, ax, ay, perched || reduced ? 0 : Math.sin(time * 3) * .018 - angle * .12);
    if (blend > 0 && next) {
        const [nx, ny] = BIRD_ANCHORS[[0, 2, 3, 1][Math.min(3, Math.floor(q) + 1)]];
        c.globalAlpha = blend;
        flightLayer(c, next, factor, nx, ny, Math.sin(time * 3) * .018 - angle * .12);
    }
    c.globalAlpha = 1;

    const eyeX = size * 0.198;
    const eyeY = -size * 0.088;
    const eyeRadius = size * 0.075;
    const headX = size * 0.16;
    const headY = -size * 0.17;
    const beakX = size * 0.40;
    const beakY = -size * 0.03;

    if (defeated && !perched) {
        drawSpiralEye(c, eyeX, eyeY, eyeRadius, time);
        if (!reduced) {
            drawOrbitingStars(c, headX, headY, size, time);
        }
    } else if (reaction > 0 && !perched) {
        drawHappyEye(c, eyeX, eyeY, eyeRadius);
        if (!reduced) {
            drawFruitSparkles(c, beakX, beakY, reaction, time);
        }
    } else if (!perched && !reduced && stamina < 0.28) {
        drawSweatDrops(c, headX, headY, size, time);
    }

    if (turbo && !perched && !reduced) {
        drawTurboWindLines(c, size, time);
    }

    if (won && perched && !reduced) {
        drawRefugeHearts(c, 0, -size * 0.2, size, time);
    }

    c.restore();
}`;

// Replace drawBird and helpers in render.mjs
const oldHelpersStart = 'function drawSpiralEye(';
const oldDrawBirdEnd = '    c.restore();\n}';
const hStart = render.indexOf(oldHelpersStart);
const dEnd = render.indexOf(oldDrawBirdEnd, hStart);

if (hStart !== -1 && dEnd !== -1) {
    const fullOld = render.substring(hStart, dEnd + oldDrawBirdEnd.length);
    render = render.replace(fullOld, helpers.trim() + '\n\n' + newDrawBird);
    console.log('Helpers and drawBird replaced successfully');
} else {
    console.error('Could not find existing helpers and drawBird');
    process.exit(1);
}

fs.writeFileSync('Chaua-Educa-main/js/render.mjs', render, 'utf8');
console.log('Chaua-Educa-main/js/render.mjs updated successfully!');
