const fs = require('fs');

// 1. Patch script.js
let scriptJs = fs.readFileSync('Chaua-Educa-main/js/script.js', 'utf8').replace(/\r\n/g, '\n');

// In resize(): sync game.viewWidth and game.viewLeft
const oldResizeEnd = `    lastOrientation=orientation;\n}`;
const newResizeEnd = `    lastOrientation=orientation;
    const view = flightViewport(renderer.w, renderer.h, renderer.safeInsets);
    game.viewWidth = Math.max(960, Math.ceil(view.worldLeft + view.worldWidth));
    game.viewLeft = Math.floor(view.worldLeft);
}`;
if (scriptJs.includes(oldResizeEnd)) {
    scriptJs = scriptJs.replace(oldResizeEnd, newResizeEnd);
    console.log('script.js resize() patched');
} else {
    console.error('script.js oldResizeEnd not found');
}

// In frame(): keep viewWidth and viewLeft synced before rendering
const oldFrameGame = `    if (game.state === 'menu') renderer.home(reducedMotion.matches ? 0 : time / 1000, reducedMotion.matches);
    else renderer.game(game.visual(clock.accumulator / (1 / 120)), reducedMotion.matches, time / 1000);`;
const newFrameGame = `    if (game.state === 'menu') renderer.home(reducedMotion.matches ? 0 : time / 1000, reducedMotion.matches);
    else {
        const view = flightViewport(renderer.w, renderer.h, renderer.safeInsets);
        game.viewWidth = Math.max(960, Math.ceil(view.worldLeft + view.worldWidth));
        game.viewLeft = Math.floor(view.worldLeft);
        renderer.game(game.visual(clock.accumulator / (1 / 120)), reducedMotion.matches, time / 1000);
    }`;
if (scriptJs.includes(oldFrameGame)) {
    scriptJs = scriptJs.replace(oldFrameGame, newFrameGame);
    console.log('script.js frame() patched');
} else {
    console.error('script.js oldFrameGame not found');
}
fs.writeFileSync('Chaua-Educa-main/js/script.js', scriptJs, 'utf8');

// 2. Patch engine.mjs
let engineJs = fs.readFileSync('Chaua-Educa-main/js/engine.mjs', 'utf8').replace(/\r\n/g, '\n');

// Add leafBurst to Game
const oldBurst = `    burst(x, y, color, count) {
        for(let i=0;i<count;i++) {
            const a=i*Math.PI*2/count, speed=55+(i*29)%85;
            this.particle({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-25,life:.6,maxLife:.6,color,spark:true});
        }
    }`;
const newBurstWithLeaf = `    burst(x, y, color, count) {
        for(let i=0;i<count;i++) {
            const a=i*Math.PI*2/count, speed=55+(i*29)%85;
            this.particle({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-25,life:.6,maxLife:.6,color,spark:true});
        }
    }

    leafBurst(x, y, count = 10) {
        const colors = ['#6da855', '#4c8a45', '#9abf68', '#386334'];
        for (let i = 0; i < count; i++) {
            const a = (i * 1.8) + (i % 2 ? 0.3 : -0.3);
            const speed = 40 + (i * 23) % 70;
            this.particle({
                x: x + (i % 3 - 1) * 20,
                y: y + (i % 2) * 15,
                vx: Math.cos(a) * speed - 60,
                vy: Math.abs(Math.sin(a)) * speed + 30,
                life: 0.9,
                maxLife: 0.9,
                color: colors[i % colors.length]
            });
        }
    }`;
if (engineJs.includes(oldBurst)) {
    engineJs = engineJs.replace(oldBurst, newBurstWithLeaf);
    console.log('engine.mjs leafBurst added');
} else {
    console.error('engine.mjs oldBurst not found');
}

// In collide(): add leafBurst and snake dazed
const oldCollideAnimal = `                if (entity.kind === 'hawk') {
                    entity.dazed = true;
                    entity.tumbleAngle = 0;
                    entity.spin = 13.5;
                    entity.fallVy = -170;
                    this.featherBurst(['#4a2c17', '#6b4122', '#9c663b', '#fffaf0'], 20);
                }
            } else if (!boundary) {
                // Only the dry protruding branch breaks; living trunks remain intact.
                if (entity.hitPart === 'dry-branch') {
                    entity.dryBranchBroken = true;
                    this.woodBurst(this.x, this.y);
                } else this.burst(this.x, this.y, '#9aba67', 8);
            }`;

const newCollideAnimal = `                if (entity.kind === 'hawk') {
                    entity.dazed = true;
                    entity.tumbleAngle = 0;
                    entity.spin = 13.5;
                    entity.fallVy = -170;
                    this.featherBurst(['#4a2c17', '#6b4122', '#9c663b', '#fffaf0'], 20);
                } else {
                    entity.dazed = true;
                    this.leafBurst(this.x, host.bottom || this.y, 10);
                }
            } else if (!boundary) {
                // Only the dry protruding branch breaks; living trunks remain intact.
                if (entity.hitPart === 'dry-branch') {
                    entity.dryBranchBroken = true;
                    this.woodBurst(this.x, this.y);
                    this.leafBurst(this.x, host.bottom || this.y, 8);
                } else {
                    this.burst(this.x, this.y, '#9aba67', 8);
                    this.leafBurst(this.x, entity.hitSide === 'top' ? host.top : host.bottom, 10);
                }
            }`;
if (engineJs.includes(oldCollideAnimal)) {
    engineJs = engineJs.replace(oldCollideAnimal, newCollideAnimal);
    console.log('engine.mjs collide() updated with leafBurst and dazed snake');
} else {
    console.error('engine.mjs oldCollideAnimal not found');
}

// In spawn(): smooth spawn margin
const oldSpawnX = `        const spawnWidth = Math.max(this.width, this.viewWidth || this.width);
        const x = spawnWidth + 80;`;
const newSpawnX = `        const spawnWidth = Math.max(this.width, this.viewWidth || this.width);
        const margin = this.viewWidth ? 180 : 80;
        const x = spawnWidth + margin;`;
if (engineJs.includes(oldSpawnX)) {
    engineJs = engineJs.replace(oldSpawnX, newSpawnX);
    console.log('engine.mjs spawn() updated');
} else {
    console.error('engine.mjs oldSpawnX not found');
}

// In tick(): clean despawn filter
const oldFilter = `        const maxBound = Math.max(this.width, this.viewWidth || this.width) + 800;
        this.entities = this.entities.filter(e => e.x > -250 && e.x < maxBound && !e.collected && !e.finished);`;
const newFilter = `        const minBound = (this.viewLeft !== undefined ? this.viewLeft : 0) - 260;
        const maxBound = Math.max(this.width, this.viewWidth || this.width) + 800;
        this.entities = this.entities.filter(e => e.x > minBound && e.x < maxBound && !e.collected && !e.finished);`;
if (engineJs.includes(oldFilter)) {
    engineJs = engineJs.replace(oldFilter, newFilter);
    console.log('engine.mjs filter updated');
} else {
    console.error('engine.mjs oldFilter not found');
}

fs.writeFileSync('Chaua-Educa-main/js/engine.mjs', engineJs, 'utf8');

// 3. Patch render.mjs
let renderJs = fs.readFileSync('Chaua-Educa-main/js/render.mjs', 'utf8').replace(/\r\n/g, '\n');

// Update obstacle() in render.mjs: trunk shake & snake retreat
const oldObsStart = `        if(!reduced && game.hit && game.hit.id===e.id) {
            const t=game.hit.age;c.translate(Math.sin(t*95)*6*Math.max(0,1-t/.3),0);
        }`;
const newObsStart = `        if(!reduced && game.hit && game.hit.id===e.id) {
            const t = game.hit.age;
            const decay = Math.max(0, 1 - t / 0.3);
            c.translate(Math.sin(t * 95) * 8 * decay, Math.cos(t * 110) * 3 * decay);
        }`;
if (renderJs.includes(oldObsStart)) {
    renderJs = renderJs.replace(oldObsStart, newObsStart);
    console.log('render.mjs obstacle hit shake updated');
} else {
    console.error('render.mjs oldObsStart not found');
}

const oldObsBottom = `        if (!e.broken || e.brokenSide !== 'bottom') {
            c.save(); c.beginPath();
            const clipTop = e.snake && !e.snake.retreat ? e.bottom - 45 : e.bottom;
            c.rect(e.x - 180, clipTop, 360, HEIGHT + 1000);
            c.clip();
            const kind = e.snake && !e.snake.branch && !e.snake.retreat ? 'snake' : e.variant === 'hollow' ? 'hollow' : \`trunk-\${variant}\`;
            this.trunk(kind, SPECIAL[kind] ?? preset, e.x + 29, e.bottom, false, reduced ? 0 : game.elapsed, variant);
            c.restore();
            if (e.variant === 'branch') {
                const image = images.get('branch');
                if (image && !e.snake?.retreat) this.snakeArt(image, e.x - 70, e.bottom + 8, 160, 160 * image.naturalHeight / image.naturalWidth, 'branch', reduced ? 0 : game.elapsed);
                else this.wood({ x: e.x - 70, y: e.bottom + 30, w: 78, h: 18 }, variant);
            }
        }`;

const newObsBottom = `        if (!e.broken || e.brokenSide !== 'bottom') {
            c.save(); c.beginPath();
            const snakeRetreating = e.snake && e.snake.retreat && (e.snake.retreatTime || 0) < 1.0;
            const snakeActive = e.snake && (!e.snake.retreat || snakeRetreating);
            const clipTop = snakeActive ? e.bottom - 45 : e.bottom;
            c.rect(e.x - 180, clipTop, 360, HEIGHT + 1000);
            c.clip();
            const kind = snakeActive && !e.snake.branch ? 'snake' : e.variant === 'hollow' ? 'hollow' : \`trunk-\${variant}\`;
            const retreatTime = e.snake?.retreat ? (e.snake.retreatTime || 0) : 0;
            this.trunk(kind, SPECIAL[kind] ?? preset, e.x + 29, e.bottom, false, reduced ? 0 : game.elapsed, variant, retreatTime);
            c.restore();
            if (e.variant === 'branch') {
                const image = images.get('branch');
                const branchSnakeActive = e.snake && (!e.snake.retreat || (e.snake.retreatTime || 0) < 1.0);
                if (image && branchSnakeActive) {
                    this.snakeArt(image, e.x - 70, e.bottom + 8, 160, 160 * image.naturalHeight / image.naturalWidth, 'branch', reduced ? 0 : game.elapsed, retreatTime);
                } else this.wood({ x: e.x - 70, y: e.bottom + 30, w: 78, h: 18 }, variant);
            }
        }`;
if (renderJs.includes(oldObsBottom)) {
    renderJs = renderJs.replace(oldObsBottom, newObsBottom);
    console.log('render.mjs obstacle bottom trunk and snake retreat updated');
} else {
    console.error('render.mjs oldObsBottom not found');
}

// Update trunk() definition to accept retreatTime
const oldTrunkDef = `    trunk(key, preset, x, y, flip, time = 0, variant = 0) {
        const image = images.get(key), c = this.c;
        if (!image) return;
        const factor = 58 / preset.coreWidth;
        const h = image.naturalHeight * factor;
        const w = image.naturalWidth * factor;
        const originX = preset.originX ?? 0.5;
        const left = -w * originX;
        c.save();
        c.translate(x, y);
        if (flip) c.scale(1, -1);

        // 1. Solid bark column extends continuously 1400 units away from opening (into canopy or roots)
        const trunkW = key === 'hollow' ? w : w * 0.58;
        const trunkLeft = left + (w - trunkW) * 0.5;
        this.wood({ x: trunkLeft, y: h - 4, w: trunkW, h: 1400 }, variant);

        // 2. Draw authored details & cut opening
        if (key === 'snake') {
            this.snakeArt(image, left, 0, w, h, 'snake', time);`;

const newTrunkDef = `    trunk(key, preset, x, y, flip, time = 0, variant = 0, retreatTime = 0) {
        const image = images.get(key), c = this.c;
        if (!image) return;
        const factor = 58 / preset.coreWidth;
        const h = image.naturalHeight * factor;
        const w = image.naturalWidth * factor;
        const originX = preset.originX ?? 0.5;
        const left = -w * originX;
        c.save();
        c.translate(x, y);
        if (flip) c.scale(1, -1);

        // 1. Solid bark column extends continuously 1400 units away from opening (into canopy or roots)
        const trunkW = key === 'hollow' ? w : w * 0.58;
        const trunkLeft = left + (w - trunkW) * 0.5;
        this.wood({ x: trunkLeft, y: h - 4, w: trunkW, h: 1400 }, variant);

        // 2. Draw authored details & cut opening
        if (key === 'snake') {
            this.snakeArt(image, left, 0, w, h, 'snake', time, retreatTime);`;
if (renderJs.includes(oldTrunkDef)) {
    renderJs = renderJs.replace(oldTrunkDef, newTrunkDef);
    console.log('render.mjs trunk() updated with retreatTime');
} else {
    console.error('render.mjs oldTrunkDef not found');
}

// Update snakeArt()
const oldSnakeArt = `    snakeArt(image,x,y,w,h,kind,time) {
        const c=this.c, [sx,sy,sw,sh]=kind==='snake'?[130,10,185,140]:[77,0,86,56];
        const k=w/image.naturalWidth,dx=x+sx*k,dy=y+sy*k;
        // Move only the head region; the trunk, coils and collision remain stationary.
        c.save();c.beginPath();c.rect(x,y,w,h);c.rect(dx,dy,sw*k,sh*k);c.clip('evenodd');c.drawImage(image,x,y,w,h);c.restore();
        c.save();c.translate(dx+(kind==='snake'?2:sw-2)*k,dy+sh*k*.7);
        c.rotate(time===0?0:Math.sin(time*1.6)*.035);
        c.drawImage(image,sx,sy,sw,sh,-(kind==='snake'?2:sw-2)*k,-sh*k*.7,sw*k,sh*k);
        c.restore();
        if(time>0&&time%4.8>4.6) {
            const direction=kind==='snake'?1:-1,mx=kind==='snake'?dx+sw*k:dx,my=dy+sh*k*.67;
            c.save();c.strokeStyle='#bf6b62';c.lineWidth=1;c.beginPath();c.moveTo(mx,my);c.lineTo(mx+direction*4,my+1);c.lineTo(mx+direction*6,my-1);c.moveTo(mx+direction*4,my+1);c.lineTo(mx+direction*6,my+3);c.stroke();c.restore();
        }
    }`;

const newSnakeArt = `    snakeArt(image, x, y, w, h, kind, time, retreatTime = 0) {
        const c = this.c, [sx, sy, sw, sh] = kind === 'snake' ? [130, 10, 185, 140] : [77, 0, 86, 56];
        const k = w / image.naturalWidth;
        let dx = x + sx * k, dy = y + sy * k;
        c.save();
        if (retreatTime > 0) {
            const progress = Math.min(1, retreatTime / 1.0);
            c.globalAlpha = Math.max(0, 1 - progress);
            dx += (kind === 'snake' ? 1 : -1) * progress * 35 * k;
        }
        c.beginPath(); c.rect(x, y, w, h); c.rect(dx, dy, sw * k, sh * k); c.clip('evenodd'); c.drawImage(image, x, y, w, h); c.restore();
        c.save();
        if (retreatTime > 0) {
            const progress = Math.min(1, retreatTime / 1.0);
            c.globalAlpha = Math.max(0, 1 - progress);
            dx += (kind === 'snake' ? 1 : -1) * progress * 35 * k;
        }
        c.translate(dx + (kind === 'snake' ? 2 : sw - 2) * k, dy + sh * k * .7);
        c.rotate(time === 0 ? 0 : Math.sin(time * 1.6) * .035);
        c.drawImage(image, sx, sy, sw, sh, -(kind === 'snake' ? 2 : sw - 2) * k, -sh * k * .7, sw * k, sh * k);

        // Dizzy stars over snake head when atordoada
        if (retreatTime > 0 && retreatTime < 1.0) {
            const hx = -(kind === 'snake' ? 2 : sw - 2) * k + (kind === 'snake' ? sw * 0.7 : sw * 0.3) * k;
            const hy = -sh * k * 0.75;
            for (let i = 0; i < 2; i++) {
                const a = retreatTime * 8 + i * Math.PI;
                const starX = hx + Math.cos(a) * 16 * k;
                const starY = hy + Math.sin(a) * 7 * k;
                drawMiniSparkle(c, starX, starY, 4.5 * k, retreatTime * 5 + i);
            }
        }
        c.restore();
        if (retreatTime === 0 && time > 0 && time % 4.8 > 4.6) {
            const direction = kind === 'snake' ? 1 : -1, mx = kind === 'snake' ? dx + sw * k : dx, my = dy + sh * k * .67;
            c.save(); c.strokeStyle = '#bf6b62'; c.lineWidth = 1; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + direction * 4, my + 1); c.lineTo(mx + direction * 6, my - 1); c.moveTo(mx + direction * 4, my + 1); c.lineTo(mx + direction * 6, my + 3); c.stroke(); c.restore();
        }
    }`;
if (renderJs.includes(oldSnakeArt)) {
    renderJs = renderJs.replace(oldSnakeArt, newSnakeArt);
    console.log('render.mjs snakeArt() updated with recoil and dazed stars');
} else {
    console.error('render.mjs oldSnakeArt not found');
}

fs.writeFileSync('Chaua-Educa-main/js/render.mjs', renderJs, 'utf8');
console.log('All patches applied!');
