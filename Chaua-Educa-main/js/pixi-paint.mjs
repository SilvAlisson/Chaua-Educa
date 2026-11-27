import {BufferImageSource, GlProgram, Mesh, Shader, UniformGroup, Color, GraphicsPath, Matrix, Texture} from './vendor/pixi/pixi-8.6.6.mjs';

const GRADIENT_STYLES = new WeakMap();
const GRADIENT_SIZE = 128;

export class SceneGradient {
    constructor(points) {
        this.points = points;
        this.stops = [];
    }

    addColorStop(offset, color) {
        this.stops.push([offset, new Color(color).toArray()]);
        this.stops.sort((a, b) => a[0] - b[0]);
        GRADIENT_STYLES.delete(this);
    }

    style() {
        const cached = GRADIENT_STYLES.get(this);
        if (cached) return cached;
        const style = this.points.length === 4 ? this.linear() : this.radial();
        GRADIENT_STYLES.set(this, style);
        return style;
    }

    sample(t, output, index) {
        if (!this.stops.length) return;
        const upper = this.stops.findIndex(([offset]) => offset >= t);
        const [lowOffset, low] = this.stops[Math.max(0, upper === -1 ? this.stops.length - 1 : upper - 1)];
        const [highOffset, high] = this.stops[upper === -1 ? this.stops.length - 1 : upper];
        const mix = highOffset === lowOffset ? 0 : (t - lowOffset) / (highOffset - lowOffset);
        const alpha = low[3] + (high[3] - low[3]) * mix;
        for (let i = 0; i < 3; i++) output[index + i] = Math.round(255 * alpha * (low[i] + (high[i] - low[i]) * mix));
        output[index + 3] = Math.round(255 * alpha);
    }

    linear() {
        const [x0, y0, x1, y1] = this.points;
        const dx = x1 - x0, dy = y1 - y0, size = GRADIENT_SIZE;
        const resource = new Uint8Array(size * 4);
        for (let x = 0; x < size; x++) this.sample(x / (size - 1), resource, x * 4);
        return this.textureStyle(resource, size, 1,
            new Matrix(dx / size, dy / size, -dy, dx, x0, y0));
    }

    radial() {
        const [x0, y0, r0, x1, y1, r1] = this.points;
        const left = Math.min(x0 - r0, x1 - r1), top = Math.min(y0 - r0, y1 - r1);
        const width = Math.max(x0 + r0, x1 + r1) - left;
        const height = Math.max(y0 + r0, y1 + r1) - top;
        const dx = x1 - x0, dy = y1 - y0, dr = r1 - r0;
        const a = dx * dx + dy * dy - dr * dr;
        const size = GRADIENT_SIZE, resource = new Uint8Array(size * size * 4);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const px = left + (x + .5) * width / size - x0;
            const py = top + (y + .5) * height / size - y0;
            const b = -2 * (px * dx + py * dy + r0 * dr);
            const c = px * px + py * py - r0 * r0;
            const discriminant = Math.max(0, b * b - 4 * a * c);
            const t = Math.abs(a) < 1e-9 ? -c / b : (-b - Math.sqrt(discriminant)) / (2 * a);
            this.sample(Math.max(0, Math.min(1, t)), resource, (y * size + x) * 4);
        }
        return this.textureStyle(resource, size, size, new Matrix(width / size, 0, 0, height / size, left, top));
    }

    textureStyle(resource, width, height, matrix) {
        const source = new BufferImageSource({ resource, width, height, format: 'rgba8unorm',
            alphaMode: 'premultiplied-alpha', addressModeV: 'clamp-to-edge', addressModeU: 'clamp-to-edge' });
        return { texture: new Texture({ source }), matrix };
    }
}

// Traces the tessellated contour, preserving dash phase through every segment.
export function dashPath(source, pattern) {
    const target = new GraphicsPath();
    for (const {shape} of source.shapePath.shapePrimitives) {
        const points = shape.points;
        if (!points?.length) continue;
        const count = points.length + (shape.closePath ? 2 : 0);
        let index = 0, remaining = pattern[0], x = points[0], y = points[1];
        target.moveTo(x, y);
        for (let i = 2; i < count; i += 2) {
            const endX = points[i % points.length], endY = points[(i + 1) % points.length];
            const length = Math.hypot(endX - x, endY - y);
            let walked = 0;
            while (walked < length) {
                const amount = Math.min(remaining, length - walked);
                walked += amount;
                const fraction = walked / length;
                const nx = x + (endX - x) * fraction, ny = y + (endY - y) * fraction;
                if (index % 2 === 0) target.lineTo(nx, ny);
                else target.moveTo(nx, ny);
                remaining -= amount;
                if (remaining < 1e-8) {
                    index = (index + 1) % pattern.length;
                    remaining = pattern[index];
                }
            }
            x = endX; y = endY;
        }
    }
    return target;
}

// Fruit frames share one atlas. The ellipse is evaluated in frame-local
// coordinates so it keeps its size and angle as the animation changes.
export class WetFruitMesh extends Mesh {
    constructor(geometry, texture) {
        const uniforms = new UniformGroup({
            uFruitRect: {value:new Float32Array(4),type:'vec4<f32>'},
            uWetness: {value:0,type:'f32'},
        });
        const shader = new Shader({
            glProgram:GlProgram.from({
                name:'wet-fruit',
                vertex:`attribute vec2 aPosition;
                    attribute vec2 aUV;
                    uniform mat3 uProjectionMatrix;
                    uniform mat3 uWorldTransformMatrix;
                    uniform mat3 uTransformMatrix;
                    varying vec2 vFruitUV;
                    varying float vEdgeWidth;
                    void main() {
                        vFruitUV = aUV;
                        float pixelSize = min(length(uTransformMatrix[0].xy), length(uTransformMatrix[1].xy));
                        vEdgeWidth = 128.0 / (10.0 * max(pixelSize, 1.0));
                        vec3 position = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0);
                        gl_Position = vec4(position.xy, 0.0, 1.0);
                    }`,
                fragment:`precision mediump float;
                    varying vec2 vFruitUV;
                    varying float vEdgeWidth;
                    uniform sampler2D uAtlas;
                    uniform vec4 uFruitRect;
                    uniform float uWetness;
                    uniform vec4 uWorldColorAlpha;
                    uniform vec4 uColor;
                    void main() {
                        vec4 fruit = texture2D(uAtlas, uFruitRect.xy + vFruitUV * uFruitRect.zw);
                        vec2 delta = vFruitUV * 128.0 - vec2(82.0, 48.0);
                        vec2 rotated = mat2(0.9393727, -0.3428978, 0.3428978, 0.9393727) * delta;
                        float edge = length(rotated / vec2(5.0, 12.0)) - 1.0;
                        float highlight = (1.0 - smoothstep(-vEdgeWidth, vEdgeWidth, edge)) * uWetness * 0.32;
                        // The atlas is premultiplied. Tint only its existing coverage.
                        vec3 shine = vec3(210.0, 236.0, 245.0) / 255.0 * fruit.a;
                        gl_FragColor = vec4(mix(fruit.rgb, shine, highlight), fruit.a) * uWorldColorAlpha * uColor;
                    }`,
            }),
            resources:{uAtlas:texture.source,wetFruitUniforms:uniforms},
        });
        shader.addResource('globalUniforms',100,0);
        shader.addResource('localUniforms',101,0);
        super({geometry,shader,texture});
        this.paintUniforms = uniforms;
    }

    setFrame(texture, [x,y,width,height], wetness) {
        this.texture = texture;
        this.shader.resources.uAtlas = texture.source;
        const uniforms = this.paintUniforms.uniforms;
        uniforms.uFruitRect[0]=x/texture.source.width;
        uniforms.uFruitRect[1]=y/texture.source.height;
        uniforms.uFruitRect[2]=width/texture.source.width;
        uniforms.uFruitRect[3]=height/texture.source.height;
        uniforms.uWetness=wetness;
        this.paintUniforms.update();
    }
}
