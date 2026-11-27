import {winterAmount, summerSunAmount} from './living-motion.mjs';

// Renders living forest atmosphere:
// 1. Radiant tropical summer sun and volumetric crepuscular God rays
// 2. Winter snowfall flurries and frosty mountain haze
// 3. Atlantic Forest rising ground mist responding to rain and wind
// 4. Ambient airborne drift
// All particle motion is deterministic based on simulation time so pausing is 100% frozen.
// CanvasGradients belong to the canvas context. Cache them per context
// and viewport size, never globally by height alone (retina/resize safe).
const atmosphereCache=new WeakMap();
let forestSprites=null;
function getForestSprites(){
 if(forestSprites)return forestSprites;
 if(typeof document==='undefined')return null;
 const sun=document.createElement('canvas');
 sun.width=128;sun.height=128;
 const sc=sun.getContext('2d');
 if(!sc)return null;
 const sg=sc.createRadialGradient(64,64,0,64,64,64);
 sg.addColorStop(0,'#ffffff');
 sg.addColorStop(.25,'#fffbeb');
 sg.addColorStop(.55,'#fde68a66');
 sg.addColorStop(1,'#f59e0b00');
 sc.fillStyle=sg;sc.fillRect(0,0,128,128);
 const mist=document.createElement('canvas');
 mist.width=1;mist.height=128;
 const mc=mist.getContext('2d');
 if(!mc)return null;
 const mg=mc.createLinearGradient(0,0,0,128);
 mg.addColorStop(0,'#d8e9df00');
 mg.addColorStop(.45,'#d8e9df18');
 mg.addColorStop(1,'#d8e9df35');
 mc.fillStyle=mg;mc.fillRect(0,0,1,128);
 forestSprites={sun,mist};
 return forestSprites;
}
export function prewarmForestLife(c){
 const sprites=getForestSprites();
 if(!c||!sprites||typeof c.drawImage!=='function')return;
 c.save();
 c.setTransform(1,0,0,1,0,0);
 c.globalAlpha=0.004;
 c.drawImage(sprites.sun,0,0,4,4,0,0,2,2);
 c.drawImage(sprites.mist,0,0,1,4,0,0,1,2);
 c.restore();
}
function atmosphereGradients(c,w,h){
    const old=atmosphereCache.get(c);
    if(old&&old.w===w&&old.h===h)return old;
    const sunX=w*.78,sunY=h*.14,sunR=Math.min(w,h)*.18;
    const sun=c.createRadialGradient(sunX,sunY,0,sunX,sunY,sunR);
    sun.addColorStop(0,'#ffffff');
    sun.addColorStop(.25,'#fffbeb');
    sun.addColorStop(.55,'#fde68a66');
    sun.addColorStop(1,'#f59e0b00');
    const beam=c.createLinearGradient(sunX,sunY,sunX-w*.7,h);
    beam.addColorStop(0,'#fffbeb88');
    beam.addColorStop(.4,'#fef08a33');
    beam.addColorStop(1,'#fef08a00');
    const mist=c.createLinearGradient(0,h*.7,0,h);
    mist.addColorStop(0,'#d8e9df00');
    mist.addColorStop(.45,'#d8e9df18');
    mist.addColorStop(1,'#d8e9df35');
    const result={w,h,sun,beam,mist};
    atmosphereCache.set(c,result);
    return result;
}

export function drawForestLife(c, w, h, time, distance, rain, wind, reduced = false, low = false, storm = 0) {
    const t = reduced ? 0 : time;
    const snow = winterAmount(distance);
    const sun = summerSunAmount(distance, rain, storm);
    const sprites = typeof c.drawImage === 'function' ? getForestSprites() : null;

    c.save();

    // 1. O SOL FORTE DO VERÃO (Radiant Sun & Volumetric God Rays)
    if (sun > 0.05 && rain < 0.7 && storm < 0.5) {
        const sunX = w * 0.78, sunY = h * 0.14;
        const sunR = Math.min(w, h) * 0.18;

        c.save();
        c.globalAlpha = Math.min(0.9, sun * 0.85);
        if (sprites) {
            c.drawImage(sprites.sun, sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
        } else {
            const gradients = atmosphereGradients(c, w, h);
            c.fillStyle = gradients.sun;
            c.beginPath();
            c.arc(sunX, sunY, sunR, 0, Math.PI * 2);
            c.fill();
        }

        // Volumetric Crepuscular Sunbeams (God Rays) piercing the canopy
        if (!reduced && !low) {
            const gradients = atmosphereGradients(c, w, h);
            const beamAlpha = sun * (0.13 + 0.025 * Math.sin(t * 0.48));
            c.globalAlpha = beamAlpha;
            c.fillStyle = gradients.beam;
            // The five authored rays share a paint/alpha. One compound
            // path avoids five separate rasterization passes per frame.
            c.beginPath();
            for(let b=0;b<5;b++){
                const angle=.68+b*.15+Math.sin(t*.2+b)*.018;
                const beamWidth=32+b*18;
                c.moveTo(sunX,sunY);
                c.lineTo(sunX-Math.cos(angle)*w*1.5-beamWidth,
                         sunY+Math.sin(angle)*h*1.5);
                c.lineTo(sunX-Math.cos(angle)*w*1.5+beamWidth,
                         sunY+Math.sin(angle)*h*1.5);
                c.closePath();
            }
            c.fill();
        }
        c.restore();
    }

    // 2. INVERNO E NEVASCAS (Winter snowfall & mountain cold)
    if (snow > 0.005) {
        c.globalAlpha = snow * 0.10;
        c.fillStyle = '#deefff';
        c.fillRect(0, 0, w, h);

        // Falling flakes now belong to the shared seasonal particle layer.
        // Do not draw a second snowfall pass over the same background.
    }

    // 3. NÉVOA DA MATA (Humid ground mist rising from Atlantic Forest)
    if (!low) {
        const mistTop = h * 0.70;
        const mistAlpha = 0.35 + rain * 0.45 + (snow > 0 ? snow * 0.25 : 0);
        c.globalAlpha = Math.min(0.85, mistAlpha);
        const shiftY = Math.sin(t * 0.22) * 3;
        if (sprites) {
            c.drawImage(sprites.mist, 0, mistTop + shiftY, w, h - mistTop + 10);
        } else {
            const mist = atmosphereGradients(c, w, h).mist;
            c.fillStyle = mist;
            c.save();
            c.translate(0, shiftY);
            c.fillRect(0, mistTop, w, h - mistTop + 10);
            c.restore();
        }
    }

    c.restore();
}
