const fs = require('fs');

// 1. assets.mjs
let assets = fs.readFileSync('Chaua-Educa-main/js/assets.mjs', 'utf8').replace(/\r\n/g, '\n');
if (!assets.includes("'hawk-2'")) {
  assets = assets.replace(
    "...['branch','feather','hawk-0','hawk-1','hollow','perch','shield','snake'].map",
    "...['branch','feather','hawk-0','hawk-1','hawk-2','hawk-3','hollow','perch','shield','snake'].map"
  );
  fs.writeFileSync('Chaua-Educa-main/js/assets.mjs', assets, 'utf8');
  console.log('1. assets.mjs updated');
}

// 2. animals.mjs
let animals = fs.readFileSync('Chaua-Educa-main/js/animals.mjs', 'utf8').replace(/\r\n/g, '\n');
const oldRetreat = `    if (e.retreat) {
        e.phase='retreat';e.harmless=true;e.retreatTime=(e.retreatTime||0)+dt;
        e.x+=150*dt;e.y+=(e.retreatY||-180)*dt;
        if(e.retreatTime>=2)e.finished=true;
        return;
    }`;
const newRetreat = `    if (e.retreat) {
        e.phase = 'retreat';
        e.harmless = true;
        e.retreatTime = (e.retreatTime || 0) + dt;
        e.x += 150 * dt;
        if (e.dazed) {
            e.tumbleAngle = (e.tumbleAngle || 0) + (e.spin || 12.0) * dt;
            e.fallVy = (e.fallVy || -170) + 750 * dt;
            e.y += e.fallVy * dt;
        } else {
            e.y += (e.retreatY || -180) * dt;
        }
        if (e.retreatTime >= 2) e.finished = true;
        return;
    }`;
if (animals.includes(oldRetreat)) {
  animals = animals.replace(oldRetreat, newRetreat);
  fs.writeFileSync('Chaua-Educa-main/js/animals.mjs', animals, 'utf8');
  console.log('2. animals.mjs updated');
}

// 3. engine.mjs
let engine = fs.readFileSync('Chaua-Educa-main/js/engine.mjs', 'utf8').replace(/\r\n/g, '\n');
const oldShieldAnimal = `            if (animal) {
                entity.phase = 'retreat';
                entity.retreat = true;
                entity.retreatTime = 0;
                entity.harmless = true;
                entity.retreatY = entity.y < this.y ? -180 : 180;
            }`;
const newShieldAnimal = `            if (animal) {
                entity.phase = 'retreat';
                entity.retreat = true;
                entity.retreatTime = 0;
                entity.harmless = true;
                entity.retreatY = entity.y < this.y ? -180 : 180;
                if (entity.kind === 'hawk') {
                    entity.dazed = true;
                    entity.tumbleAngle = 0;
                    entity.spin = 13.5;
                    entity.fallVy = -170;
                    this.featherBurst(['#4a2c17', '#6b4122', '#9c663b', '#fffaf0'], 20);
                }
            }`;
if (engine.includes(oldShieldAnimal)) {
  engine = engine.replace(oldShieldAnimal, newShieldAnimal);
  fs.writeFileSync('Chaua-Educa-main/js/engine.mjs', engine, 'utf8');
  console.log('3. engine.mjs updated');
}

// 4. render.mjs
let render = fs.readFileSync('Chaua-Educa-main/js/render.mjs', 'utf8').replace(/\r\n/g, '\n');

// Update hawk call in game() loop
const oldHawkCall = `else this.hawk(e.x, e.y, reduced ? 0 : game.elapsed, false, e.retreat ? Math.atan2(e.retreatY || -180,150) : e.dive ? -Math.atan2(e.targetY - e.startY, e.startX - e.targetX) : 0, !!e.retreat);`;
const newHawkCall = `else this.hawk(e, reduced ? 0 : game.elapsed, reduced);`;
if (render.includes(oldHawkCall)) {
  render = render.replace(oldHawkCall, newHawkCall);
  console.log('4a. render.mjs call updated');
}

// Update hawk() render implementation
const oldHawkDef = `    hawk(x, y, time, warning, angle = 0, retreat = false) {
        const image=images.get(\`hawk-\${warning||time%5>2.4?1:Math.floor(time*6)%2}\`);
        if (!image) return;
        const factor=(warning?49:110)/image.naturalWidth;
        c.save(); c.translate(x,y); c.rotate(angle); if(retreat)c.scale(-1,1);
        c.drawImage(image,-image.naturalWidth*factor*.43,-image.naturalHeight*factor*.66,image.naturalWidth*factor,image.naturalHeight*factor);
        c.restore();
    }`;

const newHawkDef = `    hawk(entityOrX, yOrTime = 0, timeOrReduced = 0, warning = false, angle = 0, retreat = false) {
        const c = this.c;
        let x, y, time, e = null;
        if (typeof entityOrX === 'object') {
            e = entityOrX;
            x = e.x;
            y = e.y;
            time = typeof yOrTime === 'number' ? yOrTime : 0;
            warning = e.warning > 0;
            retreat = !!e.retreat;
            angle = e.dive ? -Math.atan2(e.targetY - e.startY, e.startX - e.targetX) : 0;
        } else {
            x = entityOrX;
            y = yOrTime;
            time = timeOrReduced;
        }

        // Determine wing flap animation pose (0, 1, 2) or defeat pose (3)
        let pose = 0;
        if (retreat || e?.dazed) {
            pose = 3; // Knockout / Defeat dazed pose with spiral eye
        } else if (warning || time === 0) {
            pose = 0; // High wing soaring pose
        } else {
            // Natural flapping cycle: 0 -> 1 -> 2 -> 1 -> 0 (~4.2 flaps/sec, faster during dive)
            const flapSpeed = e?.dive ? 6.5 : 4.2;
            const cycle = ((time * flapSpeed) % 1 + 1) % 1;
            if (cycle < 0.28) pose = 0;      // wings up
            else if (cycle < 0.52) pose = 1; // mid-downstroke
            else if (cycle < 0.80) pose = 2; // full downstroke
            else pose = 1;                   // returning up
        }

        const image = images.get(\`hawk-\${pose}\`) || images.get('hawk-0');
        if (!image) return;

        const factor = (warning ? 49 : 115) / image.naturalWidth;
        const w = image.naturalWidth * factor;
        const h = image.naturalHeight * factor;

        // Visual aerodynamic bobbing & hunting undulation (does not affect hitbox)
        const bob = (!warning && !retreat && time > 0) ? Math.sin(time * 12) * 5 : 0;
        const huntWave = (!warning && !retreat && !e?.dive && time > 0) ? Math.sin(time * 3.5 + (e?.id || 0)) * 7 : 0;

        // Tumble rotation during defeat vs aerodynamic banking
        let renderAngle = angle;
        if (retreat || e?.dazed) {
            renderAngle = e?.tumbleAngle !== undefined ? e.tumbleAngle : (time * 14);
        } else if (!warning && time > 0) {
            renderAngle += Math.sin(time * 4.2) * 0.05;
        }

        c.save();
        c.translate(x, y + bob + huntWave);
        c.rotate(renderAngle);

        if (retreat && !e?.dazed) {
            c.scale(-1, 1);
        }

        // Wingtip air trails during high-speed swoop or dive
        if (!warning && !retreat && (e?.dive || (e?.boost && e.boost > 60))) {
            c.save();
            c.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            c.lineWidth = 2.5;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(w * 0.42, -h * 0.55);
            c.lineTo(w * 0.42 + 45, -h * 0.55 - 12);
            c.stroke();
            c.beginPath();
            c.moveTo(-w * 0.35, -h * 0.15);
            c.lineTo(-w * 0.35 + 40, -h * 0.15 - 8);
            c.stroke();
            c.restore();
        }

        // Draw raptor sprite centered on anchor
        c.drawImage(image, -w * 0.43, -h * 0.66, w, h);

        // Dizzy spinning stars above head when dazed/defeated
        if ((retreat || e?.dazed) && time > 0) {
            const headX = -w * 0.28, headY = -h * 0.42;
            for (let i = 0; i < 3; i++) {
                const a = time * 7.5 + i * (Math.PI * 2 / 3);
                const sx = headX + Math.cos(a) * 22;
                const sy = headY + Math.sin(a) * 9;
                c.save();
                c.translate(sx, sy);
                c.rotate(a + time * 3);
                c.fillStyle = i % 2 ? '#ffe042' : '#fff385';
                c.strokeStyle = '#c99a18';
                c.lineWidth = 1;
                c.beginPath();
                for (let k = 0; k < 5; k++) {
                    const rot = k * Math.PI / 2.5 - Math.PI / 2;
                    c.lineTo(Math.cos(rot) * 6, Math.sin(rot) * 6);
                    const innerRot = rot + Math.PI / 5;
                    c.lineTo(Math.cos(innerRot) * 2.8, Math.sin(innerRot) * 2.8);
                }
                c.closePath();
                c.fill();
                c.stroke();
                c.restore();
            }
        }

        c.restore();
    }`;

if (render.includes(oldHawkDef)) {
  render = render.replace(oldHawkDef, newHawkDef);
  console.log('4b. render.mjs def updated');
} else {
  console.log('Could not find oldHawkDef in render.mjs');
}

fs.writeFileSync('Chaua-Educa-main/js/render.mjs', render, 'utf8');
console.log('Done!');
