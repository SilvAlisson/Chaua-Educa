// Presentation only: physics and encounter generation always remain 960 × 640.
export function flightViewport(width, height, safe = {}) {
    const left = safe.left || 0, right = safe.right || 0;
    const compact = height <= 500, portrait = width <= 700 && height > width;
    const top = (safe.top || 0) + (compact ? 58 : 124);
    const bottom = (safe.bottom || 0) + (compact ? 64 : 104);
    const worldLeft = portrait ? 80 : 0, worldWidth = portrait ? 720 : 960;
    const scale = Math.max(.01, Math.min(Math.max(1,width-left-right)/worldWidth, Math.max(1,height-top-bottom)/640));
    const w = worldWidth*scale, h = 640*scale;
    return {portrait, scale, worldLeft, worldWidth, x:left+(width-left-right-w)/2, y:top+(height-top-bottom-h)/2, w,h};
}

export function warningPosition(view, worldY) {
    return {x:view.x+view.w-112, y:Math.max(view.y+4,Math.min(view.y+view.h-40,view.y+worldY*view.scale-18))};
}
