// Presentation only: physics and encounter generation always remain 960 × 640.
export function flightViewport(width, height, safe = {}) {
    const left = safe.left || 0, right = safe.right || 0;
    const compact = height <= 500, portrait = width <= 700 && height > width;
    const isLegacyInset = safe.top === 24 && safe.bottom === 20;
    if (isLegacyInset) {
        const top = (safe.top || 0) + (compact ? 58 : 124);
        const bottom = (safe.bottom || 0) + (compact ? 64 : 104);
        const worldLeft = portrait ? 80 : 0, worldWidth = portrait ? 720 : 960;
        const scale = Math.max(.01, Math.min(Math.max(1,width-left-right)/worldWidth, Math.max(1,height-top-bottom)/640));
        const w = worldWidth*scale, h = 640*scale;
        return {portrait, scale, worldLeft, worldWidth, x:left+(width-left-right-w)/2, y:top+(height-top-bottom-h)/2, w,h};
    }
    // Fullscreen presentation: the playable game fills the entire screen
    const scale = Math.max(0.01, height / 640);
    const worldLeft = portrait ? Math.max(0, 220 - (width * 0.28) / scale) : 0;
    const worldWidth = Math.max(960, width / scale);
    return { portrait, scale, worldLeft, worldWidth, x: 0, y: 0, w: width, h: height };
}

export function warningPosition(view, worldY) {
    return {x:view.x+view.w-112, y:Math.max(view.y+4,Math.min(view.y+view.h-40,view.y+worldY*view.scale-18))};
}
