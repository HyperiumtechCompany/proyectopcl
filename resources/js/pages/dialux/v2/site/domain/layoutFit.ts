import { boundingBox } from './geometry';
import { buildStraightRampLayout, type FlightSegment3D } from './rampLayout';
import { RAMP_NORM, STAIR_NORM } from './siteNorms';
import type { Point2D, RampConfig, SiteElement } from './types';

/** Caja (m) que ocupa el layout de tramos y descansos, con el ancho de cada uno. */
export function layoutExtent(segments: FlightSegment3D[]): {
    width: number;
    depth: number;
} {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const seg of segments) {
        const dx = seg.endLocal.x - seg.startLocal.x;
        const dz = seg.endLocal.z - seg.startLocal.z;
        const len = Math.hypot(dx, dz) || 1;
        const px = (-dz / len) * (seg.widthM / 2);
        const pz = (dx / len) * (seg.widthM / 2);
        for (const p of [seg.startLocal, seg.endLocal]) {
            for (const s of [-1, 1]) {
                const x = p.x + px * s;
                const z = p.z + pz * s;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minZ = Math.min(minZ, z);
                maxZ = Math.max(maxZ, z);
            }
        }
    }
    if (!Number.isFinite(minX)) return { width: 0, depth: 0 };
    return { width: maxX - minX, depth: maxZ - minZ };
}

export interface LayoutFit {
    /** Configuración ya ajustada al espacio (igual a la original si ya cabía). */
    config: RampConfig;
    changed: boolean;
    /** Lo que sobresale del espacio dibujado tras ajustar (m); 0 = cabe. */
    overflowXM: number;
    overflowZM: number;
    /** Espacio disponible (caja del polígono, m). */
    boxWidthM: number;
    boxDepthM: number;
}

const EPS = 0.02;

/**
 * Ajusta el layout de una rampa/escalera de tramos al espacio dibujado (la
 * caja del polígono): primero estrecha el ancho (hasta el mínimo de
 * referencia) y, si aún no cabe, acorta los tramos (`lengthM`; la cota de cada
 * tramo NO cambia, así que la pendiente sube y la norma lo marcará). Con
 * `lockLengths` (escaleras: el largo sale de la huella y la contrahuella) solo
 * se ajusta el ancho. Si ni así cabe, devuelve lo que sobresale.
 */
export function fitRampToBox(
    config: RampConfig,
    boxWidthM: number,
    boxDepthM: number,
    options: { lockLengths?: boolean; minWidthM?: number } = {},
): LayoutFit {
    const base: LayoutFit = {
        config,
        changed: false,
        overflowXM: 0,
        overflowZM: 0,
        boxWidthM,
        boxDepthM,
    };
    if (
        !config.flights ||
        config.flights.length === 0 ||
        !(boxWidthM > 0) ||
        !(boxDepthM > 0)
    ) {
        return base;
    }
    const measure = (cfg: RampConfig) => layoutExtent(buildStraightRampLayout(cfg));
    const fits = (cfg: RampConfig) => {
        const e = measure(cfg);
        return e.width <= boxWidthM + EPS && e.depth <= boxDepthM + EPS;
    };
    if (fits(config)) return base;

    const minWidth = options.minWidthM ?? RAMP_NORM.minWidthM;
    const withScale = (cfg: RampConfig, widthM: number, s: number): RampConfig => ({
        ...cfg,
        widthM,
        flights: cfg.flights!.map((f) => ({
            ...f,
            lengthM: Math.max(0.5, f.lengthM * s),
        })),
    });

    const startWidth = Math.max(minWidth, config.widthM || 3);
    // Prioridad: conservar el ancho; solo estrechar lo necesario y acortar lo mínimo.
    for (let w = startWidth; w >= minWidth - 1e-9; w -= 0.1) {
        const width = Math.max(minWidth, w);
        if (options.lockLengths) {
            const cand = withScale(config, width, 1);
            if (fits(cand)) return { ...base, config: cand, changed: true };
            continue;
        }
        if (!fits(withScale(config, width, 0.25))) continue;
        let lo = 0.25;
        let hi = 1;
        for (let i = 0; i < 24; i++) {
            const mid = (lo + hi) / 2;
            if (fits(withScale(config, width, mid))) lo = mid;
            else hi = mid;
        }
        return { ...base, config: withScale(config, width, lo), changed: true };
    }

    // No cabe ni con el mínimo: se deja lo más chico posible y se informa el exceso.
    const smallest = options.lockLengths
        ? withScale(config, minWidth, 1)
        : withScale(config, minWidth, 0.25);
    const e = measure(smallest);
    return {
        ...base,
        config: smallest,
        changed: true,
        overflowXM: Math.max(0, e.width - boxWidthM),
        overflowZM: Math.max(0, e.depth - boxDepthM),
    };
}

/** Caja del polígono del elemento en metros, y su centro en el plano. */
export function elementBox(
    element: Pick<SiteElement, 'vertices'>,
    scaleM: number,
): { widthM: number; depthM: number; center: Point2D } {
    const b = boundingBox(element.vertices);
    return {
        widthM: (b.maxX - b.minX) * scaleM,
        depthM: (b.maxY - b.minY) * scaleM,
        center: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 },
    };
}

/**
 * Sentido del recorrido de una escalera: el elegido (`direction`) o, en proyectos
 * previos, el del lado mayor del polígono. Fijarlo evita que la escalera "gire"
 * al cambiar sus medidas: con `'south'` el ancho crece en HORIZONTAL.
 */
export function stairRunDirection(
    cfg: { direction?: 'east' | 'south' } | undefined,
    element: Pick<SiteElement, 'vertices'>,
    scaleM: number,
): 'east' | 'south' {
    if (cfg?.direction) return cfg.direction;
    const box = elementBox(element, scaleM);
    return box.widthM >= box.depthM ? 'east' : 'south';
}

/**
 * Polígono rectangular del tamaño que pide el layout, centrado en el actual.
 * `crossAxis` ('x' | 'y') es el eje del ANCHO: en ese eje el polígono toma
 * exactamente la medida del layout (crece y se encoge con el ancho); en el otro
 * nunca se achica (solo crece si el recorrido lo necesita). Sin `crossAxis`,
 * ambos ejes solo crecen.
 */
export function polygonForLayout(
    element: Pick<SiteElement, 'vertices'>,
    scaleM: number,
    config: RampConfig,
    crossAxis?: 'x' | 'y',
): Point2D[] | null {
    if (!config.flights || config.flights.length === 0) return null;
    const ext = layoutExtent(buildStraightRampLayout({ ...config, fitToPolygon: false }));
    if (ext.width <= 0 || ext.depth <= 0) return null;
    const box = elementBox(element, scaleM);
    const w = crossAxis === 'x' ? ext.width : Math.max(box.widthM, ext.width);
    const h = crossAxis === 'y' ? ext.depth : Math.max(box.depthM, ext.depth);
    return [
        { x: box.center.x - w / 2 / scaleM, y: box.center.y - h / 2 / scaleM },
        { x: box.center.x + w / 2 / scaleM, y: box.center.y - h / 2 / scaleM },
        { x: box.center.x + w / 2 / scaleM, y: box.center.y + h / 2 / scaleM },
        { x: box.center.x - w / 2 / scaleM, y: box.center.y + h / 2 / scaleM },
    ];
}

/** `fitToPolygon: false` en la config desactiva el ajuste (proyectos que ya lo tenían a mano). */
export function fitRampToElement(
    config: RampConfig,
    element: Pick<SiteElement, 'vertices'>,
    scaleM: number,
    options: { lockLengths?: boolean } = {},
): LayoutFit {
    const box = elementBox(element, scaleM);
    if (config.fitToPolygon === false) {
        return {
            config,
            changed: false,
            overflowXM: 0,
            overflowZM: 0,
            boxWidthM: box.widthM,
            boxDepthM: box.depthM,
        };
    }
    return fitRampToBox(config, box.widthM, box.depthM, {
        ...options,
        minWidthM: options.lockLengths ? STAIR_NORM.minWidthM : RAMP_NORM.minWidthM,
    });
}
