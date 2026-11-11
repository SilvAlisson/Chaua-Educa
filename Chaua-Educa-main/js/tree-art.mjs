import {TREE_WIDTH} from './forest-geometry.mjs';
import {FOREST_ART} from './forest-art-data.mjs';
import {images} from './assets.mjs';

// Tiny local highlights follow the existing bark, without painting a large
// rectangular light patch or modifying any authored tree atlas.
export function drawWetBarkSheen(c,x,y,width,wet,time=0,seed=0){
 if(wet<=0||width<=0)return;
 c.save();
 c.lineCap='round';
 c.lineWidth=Math.max(.75,Math.min(2.2,width*.019));
 c.strokeStyle='#a4cad3';
 c.globalAlpha=Math.min(.32,wet*.28);
 c.beginPath();
 const left=x+width*.20+(seed%3)*width*.025;
 c.moveTo(left,y+3);
 c.quadraticCurveTo(left+width*.045,y+21,left+width*.026,y+51);
 c.stroke();
 c.globalAlpha=wet*.13;
 c.lineWidth=Math.max(.6,width*.008);
 c.beginPath();
 c.moveTo(x+width*.66,y+14);
 c.quadraticCurveTo(x+width*.64,y+27,x+width*.65,y+35);
 c.stroke();
 // A falling bead releases periodically from the cap; zero allocations
 // and no new silhouette, facial feature, limb, or head is ever drawn.
 const cycle=((time*1.15+seed*.37)%1+1)%1;
 if(cycle>.67){
  const phase=(cycle-.67)/.33;
  c.globalAlpha=wet*(1-phase)*.22;
  c.fillStyle='#add4db';
  c.beginPath();
  c.ellipse(left+width*.026,y+51+phase*26,1.1,1.7,0,0,Math.PI*2);
  c.fill();
 }
 c.restore();
}


// Source sprites retain their authored proportions. Only an undecorated bark
// strip extends toward the viewport edge; caps, knots and leaves never stretch.
export function drawLivingTrunk(c, {x, y, upper = false, width = TREE_WIDTH, length = 900, variant = 0, time = 0, snow = 0, rain = 0}) {
 const kind = upper ? 'upper' : 'lower';
 const fullSnow = snow >= 0.98;
 const snowImg4 = fullSnow ? (images.get(`trees-${kind}-snow-04`) || images.get(`trees-${kind}-snow`)) : null;
 const image = snowImg4 || images.get(`trees-${kind}`);
 if (!image) return;

 const f = FOREST_ART[kind][((variant % 4) + 4) % 4], s = width / (f.core[1] - f.core[0]);
 const [sx, sy] = f.rect, [cx, cy, cw, ch] = f.content;
 const px = x + (cx - f.anchor[0]) * s, py = y + (cy - f.anchor[1]) * s;
 const coreLeft = x + (f.core[0] - f.anchor[0]) * s;
 const stripLeft = f.core[0], stripWidth = f.core[1] - f.core[0];
 const splice = upper ? f.spliceY : f.spliceY - 1;
 const join = y + (splice - f.anchor[1]) * s;
 if (upper) {
  const start = y - length;
  if (join > start) c.drawImage(image, sx + stripLeft, sy + splice, stripWidth, 1, coreLeft, start, width, join - start + .5);
  c.drawImage(image, sx + cx, sy + splice, cw, f.endY - splice, px, join, cw * s, (f.endY - splice) * s);
 } else {
  const end = y + length;
  if (end > join) c.drawImage(image, sx + stripLeft, sy + splice, stripWidth, 1, coreLeft, join - .5, width, end - join + .5);
  c.drawImage(image, sx + cx, sy + cy, cw, splice - cy, px, py, cw * s, (splice - cy) * s);
 }

 // Restrained wet detail on existing bark, near the visible trunk cap.
 if(rain>0)drawWetBarkSheen(c,coreLeft,upper?join-70:py+8,width,rain,time,variant);

 // Snow accumulation transition: overlay pure snow layer progressively
 if (snow > 0 && !fullSnow) {
  const stageNum = Math.min(4, Math.max(1, Math.ceil(snow * 4)));
  const overlay = images.get(`trees-${kind}-overlay-0${stageNum}`) || images.get(`trees-${kind}-snow-0${stageNum}`) || images.get(`trees-${kind}-snow`);
  if (overlay) {
   c.save?.();
   if (c.globalAlpha !== undefined) c.globalAlpha = Math.min(1, snow * 1.15);
   if (upper) {
    const start = y - length;
    if (join > start) c.drawImage(overlay, sx + stripLeft, sy + splice, stripWidth, 1, coreLeft, start, width, join - start + .5);
    c.drawImage(overlay, sx + cx, sy + splice, cw, f.endY - splice, px, join, cw * s, (f.endY - splice) * s);
   } else {
    const end = y + length;
    if (end > join) c.drawImage(overlay, sx + stripLeft, sy + splice, stripWidth, 1, coreLeft, join - .5, width, end - join + .5);
    c.drawImage(overlay, sx + cx, sy + cy, cw, splice - cy, px, py, cw * s, (splice - cy) * s);
   }
   c.restore?.();
  }
 }

 // Ambient snow flurries shedding gently from upper tree branches in winter
 if (upper && snow > 0.15) {
  const shedFrame = Math.floor((time * 3 + variant * 1.5) % 6);
  const shedImg = images.get(`trees-upper-shedding-0${shedFrame}`);
  if (shedImg) {
   c.save?.();
   if (c.globalAlpha !== undefined) c.globalAlpha = Math.min(1, (snow - 0.15) * 1.25);
   c.drawImage(shedImg, sx + cx, sy + splice, cw, f.endY - splice, px, join, cw * s, (f.endY - splice) * s);
   c.restore?.();
  }
 }
}

// Four transparent 256 px cells. The cap and bark core use the same
// center and scale across variants, regardless of moss or leaf overhang.
const TREE_CELL = 256;
const TREE_CAP_Y = 8;
const TREE_CORE_WIDTH = 128;
const TREE_VARIANTS = ['rot', 'hollow', 'moss', 'vine'];
const TREE_SPLICES = [181, 180, 180, 182];

export function drawTreeVariant(c, x, y, upper, kind, breakAge, snow = 0, rain = 0, time = 0) {
 const image = images.get('tree-variants');
 const index = TREE_VARIANTS.indexOf(kind);
 if (!image || index < 0) return;
 const sx = (index % 2) * TREE_CELL;
 const sy = Math.floor(index / 2) * TREE_CELL;
 const scale = TREE_WIDTH / TREE_CORE_WIDTH;
 const splice = TREE_SPLICES[index];
 const join = (splice - TREE_CAP_Y) * scale;
 const left = -TREE_CELL * scale / 2;

 c.save();
 c.translate(x, y);
 if (upper) c.scale(1, -1);
 if (breakAge === undefined || breakAge < .055) {
  // Repeat a reflected bark band at native scale. Stretching a scanline
  // turned grooves and moss into long vertical stripes on portrait screens.
  const bandHeight = 96, tileHeight = bandHeight * scale;
  for (let pos = join - .5, tile = 0; pos < 1000; pos += tileHeight, tile++) {
   c.save();
   c.translate(0, pos + (tile % 2 === 0 ? tileHeight : 0));
   if (tile % 2 === 0) c.scale(1, -1);
   c.drawImage(image, sx + (TREE_CELL - TREE_CORE_WIDTH) / 2, sy + splice - bandHeight,
    TREE_CORE_WIDTH, bandHeight, -TREE_WIDTH / 2, 0, TREE_WIDTH, tileHeight + .5);
   c.restore();
  }
  c.drawImage(image, sx, sy + TREE_CAP_Y, TREE_CELL, splice - TREE_CAP_Y,
   left, 0, TREE_CELL * scale, join);

  // Material highlight remains local to the cap; the WebP silhouette stays intact.
  if(rain>0&&breakAge===undefined)
   drawWetBarkSheen(c,-TREE_WIDTH/2,16,TREE_WIDTH,rain,time,index);

  // Snow variant transition
  if (snow > 0 && breakAge === undefined) {
   const snowImage = images.get('tree-variants-snow');
   if (snowImage) {
    c.save();
    c.globalAlpha = Math.min(1, snow * 1.15);
    const bandHeight = 96, tileHeight = bandHeight * scale;
    for (let pos = join - .5, tile = 0; pos < 1000; pos += tileHeight, tile++) {
     c.save();
     c.translate(0, pos + (tile % 2 === 0 ? tileHeight : 0));
     if (tile % 2 === 0) c.scale(1, -1);
     c.drawImage(snowImage, sx + (TREE_CELL - TREE_CORE_WIDTH) / 2, sy + splice - bandHeight,
      TREE_CORE_WIDTH, bandHeight, -TREE_WIDTH / 2, 0, TREE_WIDTH, tileHeight + .5);
     c.restore();
    }
    if (!upper) {
     c.drawImage(snowImage, sx, sy + TREE_CAP_Y, TREE_CELL, splice - TREE_CAP_Y,
      left, 0, TREE_CELL * scale, join);
    }
    c.restore();
   }
  }

  if (breakAge !== undefined) {
   // Primary fracture fissure
   c.beginPath();
   c.moveTo(-9, 6);
   c.lineTo(2, 23);
   c.lineTo(-5, 39);
   c.lineTo(11, 57);
   c.lineTo(2, 83);
   c.strokeStyle = '#2b180e';
   c.lineWidth = 3.5;
   c.stroke();

   // Branching structural cracks radiating along wood grain
   c.beginPath();
   c.moveTo(2, 23);
   c.lineTo(-14, 30);
   c.lineTo(-22, 38);
   c.moveTo(-5, 39);
   c.lineTo(12, 44);
   c.lineTo(21, 56);
   c.moveTo(11, 57);
   c.lineTo(-3, 69);
   c.strokeStyle = '#3e2723';
   c.lineWidth = 1.8;
   c.stroke();

   // Inner highlighted split lip for 3D wood relief
   c.beginPath();
   c.moveTo(-8, 8);
   c.lineTo(3, 24);
   c.lineTo(-4, 40);
   c.lineTo(12, 58);
   c.strokeStyle = '#8d6e63';
   c.lineWidth = 1;
   c.stroke();
  }
 } else {
  const elapsed = breakAge - .055;
  c.globalAlpha *= Math.max(0, 1 - elapsed / .26);
  // Shared jagged edges preserve the whole painted cap at the start of
  // the break. Each piece rotates about its own center, with world gravity.
  const edges = [-TREE_CELL * scale / 2, -19, 19, TREE_CELL * scale / 2];
  for (let i = 0; i < 3; i++) {
   const direction = i - 1;
   const l = edges[i], r = edges[i + 1], center = (l + r) / 2;
   const fall = elapsed * 100 + 700 * elapsed * elapsed;
   c.save();
   c.translate(center + direction * elapsed * 115, join / 2 + (upper ? -fall : fall));
   c.rotate(direction * elapsed * 2);
   c.translate(-center, -join / 2);
   c.beginPath();
   c.moveTo(l, 0); c.lineTo(r, 0);
   c.lineTo(r + (i < 2 ? 6 : 0), join * .3);
   c.lineTo(r - (i < 2 ? 4 : 0), join * .65); c.lineTo(r, join);
   c.lineTo(l, join); c.lineTo(l - (i > 0 ? 4 : 0), join * .65);
   c.lineTo(l + (i > 0 ? 6 : 0), join * .3); c.closePath(); c.clip();
   c.drawImage(image, sx, sy + TREE_CAP_Y, TREE_CELL, splice - TREE_CAP_Y,
    left, 0, TREE_CELL * scale, join);
   c.restore();
  }

  // Estilhacos de madeira e farpas voadoras (wood splinters & flying debris)
  const isRot = kind === 'rot';
  const colors = isRot
   ? ['#2a180e', '#452b1a', '#6d4c33', '#3d522f', '#1f130b']
   : ['#3e2723', '#5d4037', '#8d6e63', '#a1887f', '#d7ccc8'];

  // Soft wood dust / decay smoke puff at impact epicenter
  if (elapsed < 0.16) {
   const dustAlpha = (1 - elapsed / 0.16) * 0.30;
   c.save();
   c.globalAlpha *= dustAlpha;
   c.fillStyle = isRot ? '#4a3b30' : '#8d7b68';
   for (let d = 0; d < 3; d++) {
    const dr = 6 + d * 5 + elapsed * 50;
    const dx = (-8 + d * 8) * (1 + elapsed * 1.5);
    const dy = (upper ? -1 : 1) * (28 + d * 9 + elapsed * 18);
    c.beginPath();
    c.arc(dx, dy, dr, 0, Math.PI * 2);
    c.fill();
   }
   c.restore();
  }

  // Shower of dynamic sharp wooden splinters, slivers and chips
  for (let i = 0; i < 15; i++) {
   const dir = (i % 2 === 0 ? 1 : -1);
   const speedX = 42 + (i * 23) % 78;
   const speedY = -28 + (i * 31) % 82;
   const gravity = 720;
   const sx = dir * speedX * elapsed;
   const sy = (upper ? -1 : 1) * (speedY * elapsed + gravity * elapsed * elapsed);
   const spin = dir * (4.5 + (i % 4) * 2.8) * elapsed;
   const len = 7 + (i % 5) * 3.2;
   const thick = 2.2 + (i % 3) * 1.2;
   const ox = -14 + (i * 13) % 28;
   const oy = 18 + (i * 17) % 52;

   c.save();
   c.translate(ox + sx, oy + sy);
   c.rotate(spin);
   c.fillStyle = colors[i % colors.length];
   c.beginPath();
   c.moveTo(-thick / 2, 0);
   c.lineTo(0, -len / 2);
   c.lineTo(thick / 2, 0);
   c.lineTo(0, len / 2);
   c.closePath();
   c.fill();
   c.restore();
  }
 }
 c.restore();
}

export function drawRefugeTree(c, r, support, time = 0, width = 215, footX = 7, snow = 0, rain = 0) {
 const f = FOREST_ART.lower[3], s = width / (f.core[1] - f.core[0]);
 const perch = f.perch;
 const rootX = r.x + footX - (perch[0] - f.anchor[0]) * s;
 const top = support - 4 - (perch[1] - f.anchor[1]) * s;
 drawLivingTrunk(c, {x: rootX, y: top, width, length: 900, variant: 3, time, snow, rain});
}
