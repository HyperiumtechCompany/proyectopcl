/**
 * Geometría de un plano CAD pesado (`.dxg`), generada en el servidor por
 * `CadPlanGeometryBuilder` a partir del DWG/DXF completo:
 *
 *   "DXG1" · uint32 largo del encabezado · encabezado JSON (relleno a 4 bytes)
 *   · por capa: uint32[tiras] (puntos de cada tira) + float32[2·puntos]
 *
 * Los puntos van RELATIVOS a `origin` (coordenadas UTM de 7 cifras no caben
 * en float32 con precisión de milímetro). Coordenadas del DXF: Y hacia
 * arriba — el emplazamiento usa (x, −y).
 */

export interface DxgLayer {
    name: string;
    /** Color ACI de la capa (1–255; 7 = blanco/negro según el fondo). */
    color: number;
    /** Encendida en el DXF (apagadas/congeladas vienen ocultas). */
    visible: boolean;
    /** Puntos de cada tira (polilínea abierta). */
    counts: Uint32Array;
    /** x, y relativos a `origin`. */
    points: Float32Array;
}

/** [x, y, altura, rotación (rad), texto, capa] — x/y relativos a `origin`. */
export type DxgText = [number, number, number, number, string, string];

export interface DxgPlan {
    origin: [number, number];
    /** Extensión en coordenadas relativas: [minX, minY, maxX, maxY]. */
    bbox: [number, number, number, number];
    /**
     * Extensión del DIBUJO (sin objetos sueltos lejanos), relativa: los DWG
     * reales suelen tener basura a kilómetros que, con la extensión total,
     * dejaba el plano del tamaño de un punto al encuadrar.
     */
    fitBox: [number, number, number, number];
    layers: DxgLayer[];
    texts: DxgText[];
}

interface DxgHeader {
    version: number;
    origin: [number, number];
    bbox: [number, number, number, number];
    layers: Array<{ name: string; color: number; visible: boolean; strips: number; points: number; offset: number }>;
    texts: DxgText[];
}

export function parseDxgPlan(buffer: ArrayBuffer): DxgPlan {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 8 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'DXG1') {
        throw new Error('El archivo no es una geometría de plano válida.');
    }
    const headerLength = new DataView(buffer).getUint32(4, true);
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLength))) as DxgHeader;
    const base = 8 + headerLength;

    const layers = header.layers.map((layer): DxgLayer => {
            const at = base + layer.offset;
            return {
                name: layer.name,
                color: layer.color,
                visible: layer.visible,
                counts: new Uint32Array(buffer, at, layer.strips),
                points: new Float32Array(buffer, at + layer.strips * 4, layer.points * 2),
            };
        });

    return {
        origin: header.origin,
        bbox: header.bbox,
        fitBox: robustBox(layers, header.bbox),
        texts: header.texts ?? [],
        layers,
    };
}

/** Puntos que se muestrean para la extensión del dibujo. */
const FIT_SAMPLES = 200_000;
/** Fracción que se descarta en cada extremo (objetos sueltos lejanos). */
const FIT_TRIM = 0.002;

function robustBox(layers: DxgLayer[], bbox: [number, number, number, number]): [number, number, number, number] {
    const total = layers.reduce((sum, layer) => sum + layer.points.length / 2, 0);
    if (total < 50) return bbox;
    const stride = Math.max(1, Math.floor(total / FIT_SAMPLES));
    const xs: number[] = [];
    const ys: number[] = [];
    let skip = 0;
    for (const layer of layers) {
        const points = layer.points;
        for (let i = 0; i < points.length; i += 2) {
            if (skip++ % stride !== 0) continue;
            if (Number.isFinite(points[i]) && Number.isFinite(points[i + 1])) {
                xs.push(points[i]);
                ys.push(points[i + 1]);
            }
        }
    }
    if (xs.length < 50) return bbox;
    const ascending = (a: number, b: number) => a - b;
    xs.sort(ascending);
    ys.sort(ascending);
    const lo = Math.floor(xs.length * FIT_TRIM);
    const hi = Math.min(xs.length - 1, Math.ceil(xs.length * (1 - FIT_TRIM)));
    const [minX, maxX, minY, maxY] = [xs[lo], xs[hi], ys[lo], ys[hi]];
    const padX = (maxX - minX) * 0.03;
    const padY = (maxY - minY) * 0.03;
    return [minX - padX, minY - padY, maxX + padX, maxY + padY];
}

/**
 * Índices para dibujar todas las tiras de una capa en UNA llamada
 * (`LINE_STRIP` con reinicio de primitiva: 0xFFFFFFFF corta la tira).
 */
export function dxgStripIndices(counts: Uint32Array): Uint32Array {
    let total = 0;
    for (const count of counts) total += count + 1;
    const indices = new Uint32Array(total);
    let at = 0;
    let vertex = 0;
    for (const count of counts) {
        for (let k = 0; k < count; k++) indices[at++] = vertex++;
        indices[at++] = 0xffffffff;
    }
    return indices;
}

const BASE_ACI: Record<number, [number, number, number]> = {
    1: [255, 0, 0],
    2: [255, 255, 0],
    3: [0, 255, 0],
    4: [0, 255, 255],
    5: [0, 0, 255],
    6: [255, 0, 255],
    7: [255, 255, 255],
    8: [128, 128, 128],
    9: [192, 192, 192],
};

/**
 * Color RGB (0–255) de un índice ACI de AutoCAD. 10–249: 24 tonos cada 15° ×
 * 10 variantes (brillo decreciente; las impares, a media saturación);
 * 250–255: grises.
 */
export function aciToRgb(index: number): [number, number, number] {
    const aci = Math.round(Math.abs(index));
    if (BASE_ACI[aci]) return BASE_ACI[aci];
    if (aci >= 250 && aci <= 255) {
        const gray = [51, 91, 132, 173, 214, 255][aci - 250];
        return [gray, gray, gray];
    }
    if (aci < 10 || aci > 249) return BASE_ACI[7];
    const hue = Math.floor((aci - 10) / 10) * 15;
    const variant = (aci - 10) % 10;
    const value = [1, 1, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.3, 0.3][variant];
    const saturation = variant % 2 === 0 ? 1 : 0.5;
    const c = value * saturation;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = value - c;
    const [r, g, b] =
        hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * Color para dibujar sobre el fondo del editor. Los colores de AutoCAD están
 * pensados para fondo negro: en tema claro el 7 (blanco) pasa a negro y los
 * muy claros se oscurecen para que se lean.
 */
export function dxgLayerColor(index: number, dark: boolean): [number, number, number] {
    const aci = Math.round(Math.abs(index));
    if (aci === 7) return dark ? [226, 232, 240] : [15, 23, 42];
    const [r, g, b] = aciToRgb(aci);
    if (dark) return [r, g, b];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const factor = luminance > 150 ? 150 / luminance : 1;
    return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];
}

/** Extensión del plano en coordenadas del EMPLAZAMIENTO (Y abajo): para el encuadre inicial. */
export function dxgSiteBounds(plan: DxgPlan): { x: number; y: number; width: number; height: number } {
    const [minX, minY, maxX, maxY] = plan.fitBox;
    return {
        x: plan.origin[0] + minX,
        y: -(plan.origin[1] + maxY),
        width: Math.max(maxX - minX, 1e-6),
        height: Math.max(maxY - minY, 1e-6),
    };
}
