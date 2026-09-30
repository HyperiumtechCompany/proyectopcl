import { Layers, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type DxgPlan, dxgLayerColor, dxgStripIndices } from '../lib/dxgPlan';

/** Emplazamiento → pantalla: `screen = site · scale + t` (la del lienzo sin motor CAD). */
export interface SitePlanScreenTransform {
    scale: number;
    tx: number;
    ty: number;
}

/** Textos más chicos que esto (px en pantalla) no se dibujan: ilegibles y costosos. */
const MIN_TEXT_PX = 5;
/** Tope de textos por cuadro (plano muy alejado con miles de rótulos). */
const MAX_TEXTS_PER_FRAME = 4000;

const VERTEX_SHADER = `#version 300 es
in vec2 a_point;
uniform vec4 u_map;
void main() {
    gl_Position = vec4(a_point.x * u_map.x + u_map.y, a_point.y * u_map.z + u_map.w, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 color;
void main() {
    color = u_color;
}`;

interface GpuLayer {
    name: string;
    color: number;
    vao: WebGLVertexArrayObject;
    buffers: WebGLBuffer[];
    indexCount: number;
}

interface GpuPlan {
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    mapLocation: WebGLUniformLocation | null;
    colorLocation: WebGLUniformLocation | null;
    layers: GpuLayer[];
}

function compile(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL: no se pudo crear el shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(
            `WebGL: ${gl.getShaderInfoLog(shader) ?? 'shader inválido'}`,
        );
    }
    return shader;
}

function uploadPlan(gl: WebGL2RenderingContext, plan: DxgPlan): GpuPlan {
    const program = gl.createProgram();
    if (!program) throw new Error('WebGL: no se pudo crear el programa.');
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(
            `WebGL: ${gl.getProgramInfoLog(program) ?? 'programa inválido'}`,
        );
    }
    const pointLocation = gl.getAttribLocation(program, 'a_point');

    const layers: GpuLayer[] = [];
    for (const layer of plan.layers) {
        if (layer.counts.length === 0) continue;
        const vao = gl.createVertexArray();
        const vertexBuffer = gl.createBuffer();
        const indexBuffer = gl.createBuffer();
        if (!vao || !vertexBuffer || !indexBuffer) continue;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, layer.points, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(pointLocation);
        gl.vertexAttribPointer(pointLocation, 2, gl.FLOAT, false, 0, 0);
        const indices = dxgStripIndices(layer.counts);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        layers.push({
            name: layer.name,
            color: layer.color,
            vao,
            buffers: [vertexBuffer, indexBuffer],
            indexCount: indices.length,
        });
    }

    return {
        gl,
        program,
        mapLocation: gl.getUniformLocation(program, 'u_map'),
        colorLocation: gl.getUniformLocation(program, 'u_color'),
        layers,
    };
}

function releasePlan(gpu: GpuPlan): void {
    const { gl } = gpu;
    for (const layer of gpu.layers) {
        gl.deleteVertexArray(layer.vao);
        for (const buffer of layer.buffers) gl.deleteBuffer(buffer);
    }
    gl.deleteProgram(gpu.program);
}

/**
 * Plano CAD pesado dibujado con WebGL a partir de su geometría (`.dxg`): el
 * plano COMPLETO — todas las capas, bloques expandidos — cabe en la tarjeta
 * gráfica aunque el DWG pese 70+ MB. Va debajo del SVG del emplazamiento con
 * la MISMA transformación (`transform`), así que lo dibujado encima queda
 * alineado a sus coordenadas reales (DXF (x, y) = emplazamiento (x, −y)).
 */
export function SiteVectorPlanLayer({
    plan,
    transform: { scale, tx, ty },
    width,
    height,
    hiddenLayers,
    opacity,
}: {
    plan: DxgPlan;
    transform: SitePlanScreenTransform;
    width: number;
    height: number;
    hiddenLayers: ReadonlySet<string>;
    opacity: number;
}) {
    const glCanvasRef = useRef<HTMLCanvasElement>(null);
    const textCanvasRef = useRef<HTMLCanvasElement>(null);
    const gpuRef = useRef<GpuPlan | null>(null);
    const errorRef = useRef<HTMLDivElement>(null);

    // Subir la geometría a la GPU una vez por plano (antes que el efecto que dibuja).
    useEffect(() => {
        const canvas = glCanvasRef.current;
        const showError = (message: string | null) => {
            if (!errorRef.current) return;
            errorRef.current.textContent = message ?? '';
            errorRef.current.hidden = message === null;
        };
        if (!canvas) return;
        const gl = canvas.getContext('webgl2', {
            antialias: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
        });
        if (!gl) {
            showError(
                'Este navegador no tiene WebGL2: no se puede dibujar el plano pesado.',
            );
            return;
        }
        const onLost = (event: Event) => {
            event.preventDefault();
            gpuRef.current = null;
            showError(
                'La tarjeta gráfica se quedó sin memoria para el plano: apaga capas pesadas y recarga la página.',
            );
        };
        canvas.addEventListener('webglcontextlost', onLost);
        try {
            gpuRef.current = uploadPlan(gl, plan);
            const outOfMemory = gl.getError() === gl.OUT_OF_MEMORY;
            showError(
                outOfMemory
                    ? 'La tarjeta gráfica no tiene memoria suficiente para todo el plano.'
                    : null,
            );
        } catch (error) {
            showError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo preparar el plano en la GPU.',
            );
        }
        return () => {
            canvas.removeEventListener('webglcontextlost', onLost);
            if (gpuRef.current) releasePlan(gpuRef.current);
            gpuRef.current = null;
        };
    }, [plan]);

    // Dibujar en cada cambio de vista, capas u opacidad.
    useEffect(() => {
        const dpr = window.devicePixelRatio || 1;
        const dark = document.documentElement.classList.contains('dark');
        const [ox, oy] = plan.origin;
        const w = Math.max(1, width);
        const h = Math.max(1, height);

        const gpu = gpuRef.current;
        const glCanvas = glCanvasRef.current;
        if (gpu && glCanvas) {
            const { gl } = gpu;
            const pixelW = Math.round(w * dpr);
            const pixelH = Math.round(h * dpr);
            if (glCanvas.width !== pixelW || glCanvas.height !== pixelH) {
                glCanvas.width = pixelW;
                glCanvas.height = pixelH;
            }
            gl.viewport(0, 0, pixelW, pixelH);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(gpu.program);
            // pantalla = (origen + p)·(1, −1)·scale + t → clip [-1, 1], en dobles.
            gl.uniform4f(
                gpu.mapLocation,
                (2 * scale) / w,
                ((ox * scale + tx) * 2) / w - 1,
                (2 * scale) / h,
                1 - ((ty - oy * scale) * 2) / h,
            );
            for (const layer of gpu.layers) {
                if (hiddenLayers.has(layer.name)) continue;
                const [r, g, b] = dxgLayerColor(layer.color, dark);
                gl.uniform4f(gpu.colorLocation, r / 255, g / 255, b / 255, 1);
                gl.bindVertexArray(layer.vao);
                gl.drawElements(
                    gl.LINE_STRIP,
                    layer.indexCount,
                    gl.UNSIGNED_INT,
                    0,
                );
            }
            gl.bindVertexArray(null);
        }

        // Textos: en 2D, solo los legibles y dentro de la vista.
        const textCanvas = textCanvasRef.current;
        const ctx = textCanvas?.getContext('2d');
        if (!textCanvas || !ctx) return;
        const pixelW = Math.round(w * dpr);
        const pixelH = Math.round(h * dpr);
        if (textCanvas.width !== pixelW || textCanvas.height !== pixelH) {
            textCanvas.width = pixelW;
            textCanvas.height = pixelH;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const layerColor = new Map(
            plan.layers.map((layer) => [layer.name, layer.color]),
        );
        let drawn = 0;
        for (const [x, y, textHeight, rotation, content, layer] of plan.texts) {
            const px = textHeight * scale;
            if (px < MIN_TEXT_PX || hiddenLayers.has(layer)) continue;
            const sx = (ox + x) * scale + tx;
            const sy = -(oy + y) * scale + ty;
            const reach = px * Math.max(content.length, 1);
            if (sx < -reach || sx > w + reach || sy < -reach || sy > h + reach)
                continue;
            const [r, g, b] = dxgLayerColor(layerColor.get(layer) ?? 7, dark);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.font = `${px}px sans-serif`;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(-rotation);
            content
                .split('\n')
                .forEach((line, i) => ctx.fillText(line, 0, i * px * 1.4));
            ctx.restore();
            if (++drawn >= MAX_TEXTS_PER_FRAME) break;
        }
    }, [plan, scale, tx, ty, width, height, hiddenLayers]);

    return (
        <>
            <canvas
                ref={glCanvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{ opacity }}
            />
            <canvas
                ref={textCanvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{ opacity }}
            />
            <div
                ref={errorRef}
                hidden
                className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded bg-red-950/80 px-2 py-1 text-[10px] text-red-200"
            />
        </>
    );
}

/** Encender/apagar capas del plano (como el administrador de capas de AutoCAD). */
export function SiteVectorPlanLayersPanel({
    plan,
    hiddenLayers,
    onChange,
    onFit,
}: {
    plan: DxgPlan;
    hiddenLayers: ReadonlySet<string>;
    onChange: (hidden: Set<string>) => void;
    /** Reencuadra la vista al dibujo. */
    onFit: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const names = plan.layers
        .map((layer) => layer.name)
        .sort((a, b) => a.localeCompare(b, 'es'));
    const filtered = names.filter((name) =>
        name.toLowerCase().includes(query.trim().toLowerCase()),
    );
    const setMany = (visible: boolean) => {
        const next = new Set(hiddenLayers);
        for (const name of filtered) {
            if (visible) next.delete(name);
            else next.add(name);
        }
        onChange(next);
    };

    const [minX, minY, maxX, maxY] = plan.fitBox;
    const points = plan.layers.reduce(
        (sum, layer) => sum + layer.points.length / 2,
        0,
    );

    if (!open) {
        return (
            <div className="absolute top-2 right-2 z-10 flex gap-1">
                <button
                    type="button"
                    onClick={onFit}
                    title="Encuadrar el plano completo"
                    className="rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    Encuadrar
                </button>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    title="Capas del plano"
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    <Layers className="h-3.5 w-3.5 text-amber-500" />
                    {`Capas (${names.length - hiddenLayers.size}/${names.length})`}
                </button>
            </div>
        );
    }

    return (
        <div className="absolute top-2 right-2 z-10 flex max-h-[70%] w-64 flex-col rounded-lg border border-slate-200 bg-white/97 text-[10px] shadow-lg dark:border-white/10 dark:bg-slate-900/97">
            <div className="flex items-center justify-between border-b border-slate-200 px-2 py-1.5 dark:border-white/10">
                <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
                    <Layers className="h-3.5 w-3.5 text-amber-500" />
                    Capas del plano
                </span>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    title="Cerrar"
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1.5 dark:border-white/10">
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar capa…"
                    className="min-w-0 flex-1 rounded border border-slate-200 bg-transparent px-1.5 py-0.5 outline-none dark:border-white/10"
                />
                <button
                    type="button"
                    onClick={() => setMany(true)}
                    className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/5"
                >
                    Todas
                </button>
                <button
                    type="button"
                    onClick={() => setMany(false)}
                    className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/5"
                >
                    Ninguna
                </button>
            </div>
            <p className="border-b border-slate-200 px-2 py-1 text-slate-500 dark:border-white/10 dark:text-slate-400">
                {`${points.toLocaleString('es-PE')} puntos · dibujo ${(maxX - minX).toFixed(0)} × ${(maxY - minY).toFixed(0)} u · total ${(plan.bbox[2] - plan.bbox[0]).toFixed(0)} × ${(plan.bbox[3] - plan.bbox[1]).toFixed(0)} u`}
            </p>
            <ul className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
                {filtered.map((name) => (
                    <li key={name}>
                        <label className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-slate-50 dark:hover:bg-white/5">
                            <input
                                type="checkbox"
                                className="h-3 w-3 accent-amber-600"
                                checked={!hiddenLayers.has(name)}
                                onChange={() => {
                                    const next = new Set(hiddenLayers);
                                    if (next.has(name)) next.delete(name);
                                    else next.add(name);
                                    onChange(next);
                                }}
                            />
                            <span
                                className="truncate text-slate-700 dark:text-slate-200"
                                title={name}
                            >
                                {name || '(sin nombre)'}
                            </span>
                        </label>
                    </li>
                ))}
                {filtered.length === 0 && (
                    <li className="px-1.5 py-1 text-slate-400">
                        Ninguna capa coincide.
                    </li>
                )}
            </ul>
        </div>
    );
}
