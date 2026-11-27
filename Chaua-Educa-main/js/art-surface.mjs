// Drawing recipes can target a browser canvas or an offscreen GPU texture.
let factory;

export function setArtSurfaceFactory(next) {
    factory = next;
}

export function createArtSurface(width = 300, height = 150) {
    if (factory) return factory(width, height);
    if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') return null;
    const surface = typeof document === 'undefined'
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');
    surface.width = width;
    surface.height = height;
    return surface;
}
