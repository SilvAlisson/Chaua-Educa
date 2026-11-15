// Cobra Articulada usando 100% os píxeis reais do modelo oficial (idle, attack, high, sweep, stunned).
// Aplica Deformação Esquelética Contínua por Faixas Afins (b = 0, sem frestas) no Canvas 2D.
import { snakeAttack } from './attack-patterns.mjs';
import { SNAKE_TIMING } from './animals.mjs';
import {
  SNAKE_A2_GRID,
  snakePlacement,
  snakeA2Pose,
  snakeA2ArtScale,
  snakeA2NeedsMirror
} from './snake-a2.mjs';

const CELL = SNAKE_A2_GRID.cell; // 384
const ANCHOR_X = SNAKE_A2_GRID.anchorX; // 192
const ANCHOR_Y = SNAKE_A2_GRID.anchorY; // 352
const COIL_SPLIT_Y = 250; // Linha onde o pescoço/corpo sai das voltas apoiadas no tronco

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const smooth = t => { const x = clamp(t); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

const SHEET_PATHS = Object.freeze({
  idle: '../public/snake/base/idle.webp',
  attack: '../public/snake/attack/attack.webp',
  stunned: '../public/snake/reactions/stunned.webp',
  high: '../public/snake/attack/high.webp',
  sweep: '../public/snake/attack/sweep.webp'
});

const rawSheets = new Map();
const bakedFrames = new Map();
let baseCoilSurface = null;
let readyPromise = null;

function makeSurface(w = CELL, h = CELL) {
  const c = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Normaliza qualquer quadro (key, frame) para uma célula 384x384 com a mesma escala e direção
// e extrai o perfil horizontal exato (centroide e largura) de cada linha y pelo canal alfa.
function getNormalizedFrameData(key, frameIndex) {
  const cacheKey = `${key}:${frameIndex}`;
  if (bakedFrames.has(cacheKey)) return bakedFrames.get(cacheKey);

  const img = rawSheets.get(key);
  if (!img) throw new Error(`Folha da cobra não carregada: ${key}`);

  const pose = { key, frame: frameIndex };
  const scale = snakeA2ArtScale(pose);
  const flip = snakeA2NeedsMirror(pose);
  const sx = (frameIndex % SNAKE_A2_GRID.columns) * CELL;
  const sy = Math.floor(frameIndex / SNAKE_A2_GRID.columns) * CELL;

  const full = makeSurface(CELL, CELL);
  const fctx = full.getContext('2d', { willReadFrequently: true });
  fctx.save();
  fctx.translate(ANCHOR_X, ANCHOR_Y);
  if (flip) fctx.scale(-1, 1);
  fctx.drawImage(
    img,
    sx, sy, CELL, CELL,
    -ANCHOR_X * scale, -ANCHOR_Y * scale, CELL * scale, CELL * scale
  );
  fctx.restore();

  const rgba = fctx.getImageData(0, 0, CELL, CELL).data;
  const centerX = new Float32Array(CELL);
  const spanW = new Float32Array(CELL);
  const rowValid = new Uint8Array(CELL);

  let topY = CELL - 1;
  let bottomY = 0;

  for (let y = 0; y < CELL; y++) {
    let minX = CELL, maxX = -1, sumX = 0, sumA = 0;
    const rowOffset = y * CELL * 4;
    for (let x = 0; x < CELL; x++) {
      const a = rgba[rowOffset + x * 4 + 3];
      if (a > 32) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        sumX += x * a;
        sumA += a;
      }
    }
    if (sumA > 0) {
      rowValid[y] = 1;
      centerX[y] = sumX / sumA;
      spanW[y] = Math.max(16, maxX - minX);
      if (y < topY) topY = y;
      if (y > bottomY) bottomY = y;
    } else {
      centerX[y] = ANCHOR_X;
      spanW[y] = 64;
    }
  }

  let lastX = ANCHOR_X, lastW = 64;
  for (let y = CELL - 1; y >= 0; y--) {
    if (rowValid[y]) {
      lastX = centerX[y];
      lastW = spanW[y];
    } else {
      centerX[y] = lastX;
      spanW[y] = lastW;
    }
  }

  // Suaviza o perfil de centroide e largura com janela móvel para evitar serrilhado entre fatias
  const smoothX = new Float32Array(CELL);
  const smoothW = new Float32Array(CELL);
  for (let y = 0; y < CELL; y++) {
    let sxAcc = 0, swAcc = 0, count = 0;
    for (let dy = -4; dy <= 4; dy++) {
      const yy = Math.max(0, Math.min(CELL - 1, y + dy));
      sxAcc += centerX[yy];
      swAcc += spanW[yy];
      count++;
    }
    smoothX[y] = sxAcc / count;
    smoothW[y] = swAcc / count;
  }

  // Camada superior articulável com feather suave na junção com a base enrolada (COIL_SPLIT_Y)
  const FEATHER = 16;
  const upper = makeSurface(CELL, CELL);
  const uctx = upper.getContext('2d');
  uctx.drawImage(full, 0, 0);
  uctx.globalCompositeOperation = 'destination-in';
  const maskGrad = uctx.createLinearGradient(0, COIL_SPLIT_Y - FEATHER, 0, COIL_SPLIT_Y + FEATHER);
  maskGrad.addColorStop(0, 'rgba(0,0,0,1)');
  maskGrad.addColorStop(1, 'rgba(0,0,0,0)');
  uctx.fillStyle = maskGrad;
  uctx.fillRect(0, 0, CELL, COIL_SPLIT_Y + FEATHER);
  uctx.globalCompositeOperation = 'source-over';

  const record = {
    key,
    frame: frameIndex,
    full,
    upper,
    centerX: smoothX,
    spanW: smoothW,
    topY: Math.max(4, topY - 4),
    bottomY,
    coilSplitY: COIL_SPLIT_Y
  };
  bakedFrames.set(cacheKey, record);
  return record;
}

export function preloadArticulatedSnakeProto() {
  if (readyPromise) return readyPromise;
  readyPromise = Promise.all(
    Object.entries(SHEET_PATHS).map(async ([key, path]) => {
      const img = new Image();
      img.src = new URL(path, import.meta.url).href;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      if (img.decode) await img.decode();
      rawSheets.set(key, img);
    })
  ).then(() => {
    const idle0 = getNormalizedFrameData('idle', 0);
    const FEATHER = 16;
    baseCoilSurface = makeSurface(CELL, CELL);
    const bctx = baseCoilSurface.getContext('2d');
    bctx.drawImage(idle0.full, 0, 0);
    bctx.globalCompositeOperation = 'destination-in';
    const g = bctx.createLinearGradient(0, COIL_SPLIT_Y - FEATHER, 0, COIL_SPLIT_Y + FEATHER);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    bctx.fillStyle = g;
    bctx.fillRect(0, COIL_SPLIT_Y - FEATHER, CELL, CELL - (COIL_SPLIT_Y - FEATHER));
    bctx.globalCompositeOperation = 'source-over';

    getNormalizedFrameData('idle', 2);
    getNormalizedFrameData('attack', 4);
    getNormalizedFrameData('high', 5);
    getNormalizedFrameData('sweep', 5);
    getNormalizedFrameData('stunned', 3);
  });
  return readyPromise;
}

const RIG_TARGETS = Object.freeze({
  idle: { dx: 0, dy: 0, midDx: 0, midDy: 0, scaleX: 1.0, coilSquash: 0 },
  warning: { dx: 10, dy: -14, midDx: 18, midDy: -8, scaleX: 1.02, coilSquash: 0.018 },
  windup: {
    frontal: { dx: 34, dy: -16, midDx: 48, midDy: -10, scaleX: 0.96, coilSquash: 0.04 },
    alto: { dx: 22, dy: -42, midDx: 38, midDy: -24, scaleX: 0.95, coilSquash: 0.045 },
    varredura: { dx: 38, dy: 18, midDx: 52, midDy: 12, scaleX: 0.97, coilSquash: 0.04 }
  },
  strike: {
    frontal: { dx: -82, dy: -12, midDx: -44, midDy: -14, scaleX: 1.08, coilSquash: -0.025 },
    alto: { dx: -64, dy: -66, midDx: -32, midDy: -42, scaleX: 1.05, coilSquash: -0.035 },
    varredura: { dx: -92, dy: 34, midDx: -48, midDy: 22, scaleX: 1.10, coilSquash: -0.025 }
  }
});

function lerpRig(a, b, t) {
  const s = smooth(t);
  return {
    dx: lerp(a.dx, b.dx, s),
    dy: lerp(a.dy, b.dy, s),
    midDx: lerp(a.midDx, b.midDx, s),
    midDy: lerp(a.midDy, b.midDy, s),
    scaleX: lerp(a.scaleX, b.scaleX, s),
    coilSquash: lerp(a.coilSquash, b.coilSquash, s)
  };
}

export function resolveRealSnakeRig(s = {}, reduced = false) {
  if (reduced) {
    return { ...RIG_TARGETS.idle, sourcePose: ['idle', 0], blendPose: null, blend: 0 };
  }
  const age = Number.isFinite(s.age) ? Math.max(0, s.age) : 0;
  const type = s.attackType && RIG_TARGETS.windup[s.attackType] ? s.attackType : 'frontal';
  const timing = snakeAttack(s);

  if (s.retreat && s.dazed) {
    const t = Math.max(0, s.retreatTime || 0);
    const wobble = Math.sin(t * 9.5) * 22;
    const nod = Math.cos(t * 7) * 9;
    return {
      dx: wobble,
      dy: -6 + nod,
      midDx: wobble * 0.55,
      midDy: nod * 0.5,
      scaleX: 1 + Math.sin(t * 9.5) * 0.03,
      coilSquash: Math.sin(t * 7) * 0.018,
      sourcePose: ['stunned', 3],
      blendPose: ['stunned', 2],
      blend: 0.5 + 0.5 * Math.sin(t * 8)
    };
  }

  const breath = Math.sin(age * 2.6);
  const liveIdle = {
    dx: breath * 5,
    dy: Math.cos(age * 2.6) * 3.5,
    midDx: -breath * 3.5,
    midDy: Math.cos(age * 2.6) * 2,
    scaleX: 1 + breath * 0.012,
    coilSquash: Math.cos(age * 2.6) * 0.012
  };

  const phaseAge = Math.max(0, s.phaseAge || 0);

  if (s.phase === 'warning') {
    const u = clamp((s.warningAge || 0) / SNAKE_TIMING.warning);
    return {
      ...lerpRig(liveIdle, RIG_TARGETS.warning, u),
      sourcePose: ['idle', 0],
      blendPose: ['idle', 2],
      blend: smooth(u)
    };
  }

  if (s.phase === 'windup') {
    const u = clamp(phaseAge / timing.windup);
    return {
      ...lerpRig(RIG_TARGETS.warning, RIG_TARGETS.windup[type], u),
      sourcePose: ['idle', 2],
      blendPose: [timing.key, 2],
      blend: smooth(u)
    };
  }

  if (s.phase === 'striking') {
    const u = clamp(phaseAge / timing.strike);
    const impulse = u < 0.5 ? smooth(u / 0.5) : 1 - (u - 0.5) * 0.15;
    const peakFrame = type === 'frontal' ? 4 : 5;
    return {
      ...lerpRig({ ...RIG_TARGETS.idle, dx: 24, dy: 0, midDx: 14, midDy: 0 }, { ...RIG_TARGETS.idle, dx: -18, dy: 0, midDx: -10, midDy: 0 }, impulse),
      sourcePose: [timing.key, peakFrame],
      blendPose: [timing.key, Math.max(0, peakFrame - 1)],
      blend: Math.max(0, 1 - smooth(u * 2.2))
    };
  }

  if (s.phase === 'recovering') {
    const u = clamp(phaseAge / timing.recovery);
    const peakFrame = type === 'frontal' ? 4 : 5;
    return {
      ...lerpRig({ ...RIG_TARGETS.idle, dx: -14, dy: 0, midDx: -8, midDy: 0 }, liveIdle, u),
      sourcePose: ['idle', 0],
      blendPose: [timing.key, peakFrame],
      blend: Math.max(0, 1 - smooth(u * 1.35))
    };
  }

  return { ...liveIdle, sourcePose: ['idle', 0], blendPose: null, blend: 0 };
}

// Curva da coluna com derivada zero na base (u = 0) para encaixe perfeito com baseCoilSurface
function evalSpineOffset(rig, u) {
  const s = clamp(u);
  const w = s * s * (3 - 2 * s); // Smoothstep garante tangente 0 em u = 0
  const arch = 4 * s * (1 - s);
  return [
    w * rig.dx + arch * (rig.midDx - rig.dx * 0.5),
    w * rig.dy + arch * (rig.midDy - rig.dy * 0.5)
  ];
}

// Modo 1 (rigged-3pose): Deforma uma pose real por faixas afins contínuas (b = 0 -> zero frestas)
function drawDeformedRealPose(c, frameData, rig, alpha = 1, debugWireframe = false, stripsOut = null) {
  if (alpha <= 0.001) return;
  const { upper, centerX, topY } = frameData;
  const STRIPS = 22;
  const startY = topY;
  const endY = COIL_SPLIT_Y + 14;
  const spanY = endY - startY;
  const a = rig.scaleX || 1;

  c.save();
  c.globalAlpha *= alpha;

  for (let i = 0; i < STRIPS; i++) {
    const y0 = Math.round(startY + (spanY * i) / STRIPS);
    const y1 = Math.round(startY + (spanY * (i + 1)) / STRIPS);
    const dy = Math.max(1, y1 - y0);

    // u = 0 na base (COIL_SPLIT_Y) e u = 1 no topo da cabeça
    const u0 = clamp((COIL_SPLIT_Y - y0) / (COIL_SPLIT_Y - startY));
    const u1 = clamp((COIL_SPLIT_Y - y1) / (COIL_SPLIT_Y - startY));

    const [ox0, oy0] = evalSpineOffset(rig, u0);
    const [ox1, oy1] = evalSpineOffset(rig, u1);

    const cx0 = centerX[y0];
    const cx1 = centerX[y1];

    const TX0 = cx0 + ox0 - ANCHOR_X;
    const TY0 = y0 + oy0 - ANCHOR_Y;
    const TX1 = cx1 + ox1 - ANCHOR_X;
    const TY1 = y1 + oy1 - ANCHOR_Y;

    // Como b = 0, a linha y1 de uma fatia coincide 100% com a linha y1 da fatia vizinha
    const mc = ((TX1 - TX0) - a * (cx1 - cx0)) / dy;
    const md = (TY1 - TY0) / dy;
    const me = TX0 - a * cx0 - mc * y0;
    const mf = TY0 - md * y0;

    c.save();
    c.transform(a, 0, mc, md, me, mf);
    c.drawImage(upper, 0, y0, CELL, dy, 0, y0, CELL, dy);
    if (debugWireframe) {
      c.strokeStyle = 'rgba(0, 255, 200, 0.45)';
      c.lineWidth = 1;
      c.strokeRect(cx0 - 48, y0, 96, dy);
    }
    c.restore();

    if (stripsOut && i % 2 === 0) {
      stripsOut.push({ x: (TX0 + TX1) * 0.5, y: (TY0 + TY1) * 0.5, r: i < 5 ? 26 : 21 });
    }
  }

  c.restore();
}

// Resolve os dois quadros adjacentes e o fator de interpolação contínuo (0..1) em 60/120 FPS
function resolveContinuousPosePair(s = {}, reduced = false) {
  let poseNow = snakeA2Pose(s, reduced);
  let poseNext = poseNow;
  let blend = 0;

  if (reduced) return { poseNow, poseNext, blend };

  if (s.retreat && s.dazed) {
    const t = Math.max(0, s.retreatTime || 0);
    if (t < 0.85) {
      const pos = clamp(t / 0.85) * 7;
      const f = Math.min(7, Math.floor(pos));
      poseNow = { key: 'stunned', frame: f };
      poseNext = { key: 'stunned', frame: Math.min(7, f + 1) };
      blend = pos - f;
    } else {
      const wave = (Math.sin((t - 0.85) * 7) + 1) * 0.5;
      poseNow = { key: 'stunned', frame: 2 };
      poseNext = { key: 'stunned', frame: 3 };
      blend = wave;
    }
    return { poseNow, poseNext, blend };
  }

  const timing = snakeAttack(s);
  const age = Math.max(0, s.phaseAge || 0);

  if (s.phase === 'warning') {
    const seq = timing.key === 'attack' ? [0, 2, 3, 4] : [0, 1, 0];
    const pos = clamp((s.warningAge || 0) / SNAKE_TIMING.warning) * (seq.length - 1);
    const idx = Math.min(seq.length - 1, Math.floor(pos));
    const nxt = Math.min(seq.length - 1, idx + 1);
    poseNow = { key: 'idle', frame: seq[idx] };
    poseNext = { key: 'idle', frame: seq[nxt] };
    blend = pos - idx;
  } else if (s.phase === 'windup') {
    const seq = [['idle', timing.key === 'attack' ? 4 : 0], [timing.key, 0], [timing.key, 1], [timing.key, 2], [timing.key, 3]];
    const pos = clamp(age / timing.windup) * (seq.length - 1);
    const idx = Math.min(seq.length - 1, Math.floor(pos));
    const nxt = Math.min(seq.length - 1, idx + 1);
    poseNow = { key: seq[idx][0], frame: seq[idx][1] };
    poseNext = { key: seq[nxt][0], frame: seq[nxt][1] };
    blend = pos - idx;
  } else if (s.phase === 'striking') {
    const seq = [[timing.key, 3], [timing.key, 4], [timing.key, 5]];
    const pos = clamp(age / timing.strike) * (seq.length - 1);
    const idx = Math.min(seq.length - 1, Math.floor(pos));
    const nxt = Math.min(seq.length - 1, idx + 1);
    poseNow = { key: seq[idx][0], frame: seq[idx][1] };
    poseNext = { key: seq[nxt][0], frame: seq[nxt][1] };
    blend = pos - idx;
  } else if (s.phase === 'recovering') {
    const seq = timing.key !== 'attack'
      ? [[timing.key, 5], [timing.key, 4], [timing.key, 3], [timing.key, 2], [timing.key, 1], [timing.key, 0], ['idle', 0]]
      : [[timing.key, 5], [timing.key, 4], [timing.key, 3], [timing.key, 2], [timing.key, 1], [timing.key, 0], ['idle', 4], ['idle', 3], ['idle', 2], ['idle', 1], ['idle', 0]];
    const pos = clamp(age / timing.recovery) * (seq.length - 1);
    const idx = Math.min(seq.length - 1, Math.floor(pos));
    const nxt = Math.min(seq.length - 1, idx + 1);
    poseNow = { key: seq[idx][0], frame: seq[idx][1] };
    poseNext = { key: seq[nxt][0], frame: seq[nxt][1] };
    blend = pos - idx;
  } else {
    const validAge = Number.isFinite(s.age) ? Math.max(0, s.age) : 0;
    const seq = [0, 1, 2, 1];
    const pos = (validAge * 2.3) % seq.length;
    const idx = Math.floor(pos);
    poseNow = { key: 'idle', frame: seq[idx] };
    poseNext = { key: 'idle', frame: seq[(idx + 1) % seq.length] };
    blend = pos - idx;
  }

  return { poseNow, poseNext, blend };
}

// Modo 2 (keyframe-warp): Deforma e alinha as silhuetas reais entre poseNow e poseNext a 60 FPS
function drawContinuousKeyframeWarp(c, s, reduced = false, debugWireframe = false, stripsOut = null) {
  const { poseNow, poseNext, blend } = resolveContinuousPosePair(s, reduced);
  const dataA = getNormalizedFrameData(poseNow.key, poseNow.frame);
  const dataB = getNormalizedFrameData(poseNext.key, poseNext.frame);
  const t = smooth(blend);

  // Micro-respiração contínua adicional quando em vigília
  const breath = !reduced && (s.phase === 'watching' || !s.phase)
    ? Math.sin((s.age || 0) * 2.6) * 3.2
    : 0;

  const STRIPS = 24;
  const endY = COIL_SPLIT_Y + 14;
  const spanA = endY - dataA.topY;
  const spanB = endY - dataB.topY;

  for (let i = 0; i < STRIPS; i++) {
    const s0 = i / STRIPS;
    const s1 = (i + 1) / STRIPS;

    const yA0 = Math.round(dataA.topY + s0 * spanA);
    const yA1 = Math.round(dataA.topY + s1 * spanA);
    const yB0 = Math.round(dataB.topY + s0 * spanB);
    const yB1 = Math.round(dataB.topY + s1 * spanB);

    const cxA0 = dataA.centerX[yA0], cxA1 = dataA.centerX[yA1];
    const cxB0 = dataB.centerX[yB0], cxB1 = dataB.centerX[yB1];

    // Peso zero na base (s = 1) para encaixar sem costura com baseCoilSurface
    const topWeight0 = smooth(1 - s0);
    const topWeight1 = smooth(1 - s1);

    const targetX0 = lerp(cxA0, cxB0, t) + breath * topWeight0 - ANCHOR_X;
    const targetY0 = lerp(yA0, yB0, t) - ANCHOR_Y;
    const targetX1 = lerp(cxA1, cxB1, t) + breath * topWeight1 - ANCHOR_X;
    const targetY1 = lerp(yA1, yB1, t) - ANCHOR_Y;

    for (const [data, y0, y1, cx0, cx1, alpha] of [
      [dataA, yA0, yA1, cxA0, cxA1, 1 - t],
      [dataB, yB0, yB1, cxB0, cxB1, t]
    ]) {
      if (alpha <= 0.01) continue;
      const dy = Math.max(1, y1 - y0);
      const mc = ((targetX1 - targetX0) - (cx1 - cx0)) / dy;
      const md = (targetY1 - targetY0) / dy;
      const me = targetX0 - cx0 - mc * y0;
      const mf = targetY0 - md * y0;

      c.save();
      c.globalAlpha *= alpha;
      c.transform(1, 0, mc, md, me, mf);
      c.drawImage(data.upper, 0, y0, CELL, dy, 0, y0, CELL, dy);
      if (debugWireframe && alpha >= 0.5) {
        c.strokeStyle = 'rgba(0, 255, 200, 0.45)';
        c.lineWidth = 1;
        c.strokeRect(cx0 - 48, y0, 96, dy);
      }
      c.restore();
    }

    if (stripsOut && i % 2 === 0) {
      stripsOut.push({ x: (targetX0 + targetX1) * 0.5, y: (targetY0 + targetY1) * 0.5, r: i < 5 ? 26 : 21 });
    }
  }
}

export function drawArticulatedSnakeProto(
  c,
  s,
  factor = 0.52,
  reduced = false,
  mode = 'keyframe-warp',
  debugWireframe = false,
  stripsOut = null
) {
  if (!baseCoilSurface) return false;
  const rig = resolveRealSnakeRig(s, reduced);

  c.save();
  c.scale(factor, factor);

  // 1. Base Enrolada Oficial (idle[0]) 100% ancorada na madeira
  c.save();
  const squash = rig.coilSquash || 0;
  c.scale(1 + squash, 1 - squash * 0.65);
  c.drawImage(baseCoilSurface, -ANCHOR_X, -ANCHOR_Y);
  c.restore();

  // 2. Corpo Superior e Cabeça Reais com Deformação Contínua por Faixas Afins
  if (mode === 'keyframe-warp') {
    drawContinuousKeyframeWarp(c, s, reduced, debugWireframe, stripsOut);
  } else {
    const primary = getNormalizedFrameData(rig.sourcePose[0], rig.sourcePose[1]);
    drawDeformedRealPose(c, primary, rig, 1 - (rig.blend || 0), debugWireframe, stripsOut);
    if (rig.blendPose && rig.blend > 0.01) {
      const secondary = getNormalizedFrameData(rig.blendPose[0], rig.blendPose[1]);
      drawDeformedRealPose(c, secondary, rig, rig.blend, false, null);
    }
  }

  c.restore();
  return true;
}

export function articulatedSnakeCircles(wood, reduced = false, mode = 'keyframe-warp') {
  if (!wood?.snake || wood.snake.retreat || !baseCoilSurface) return [];
  const place = snakePlacement(wood);
  const f = place.factor;
  const localNodes = [];

  const dummy = makeSurface(1, 1).getContext('2d');
  drawArticulatedSnakeProto(dummy, wood.snake, 1, reduced, mode, false, localNodes);

  return [
    { x: place.x - 18 * f, y: place.y - 42 * f, r: 34 * f },
    { x: place.x + 22 * f, y: place.y - 38 * f, r: 32 * f },
    ...localNodes.map(n => ({ x: place.x + n.x * f, y: place.y + n.y * f, r: n.r * f }))
  ];
}