import type {
    GateBooth,
    GateCanopy,
    GateConfig,
    GateLights,
    GateSideWalls,
    Point2D,
    SiteElement,
} from './types';

/** Un portón dibujado como TRAMO (2 puntos sobre el cerco) en vez de un símbolo puntual. */
export function isSpanGate(element: Pick<SiteElement, 'type' | 'vertices'>): boolean {
    return element.type === 'gate' && element.vertices.length === 2;
}

/** Ancho real del vano (m): la distancia entre sus dos puntos si es un tramo; si no, el `widthM` configurado. */
export function gateSpanM(
    element: Pick<SiteElement, 'type' | 'vertices' | 'config'>,
    scaleM: number,
): number {
    if (isSpanGate(element)) {
        const [a, b] = element.vertices;
        return Math.hypot(b.x - a.x, b.y - a.y) * scaleM;
    }
    const cfg = element.config?.kind === 'gate' ? element.config : undefined;
    return Math.max(0.5, cfg?.widthM || 4);
}

export const DEFAULT_BOOTH: GateBooth = {
    enabled: false,
    widthM: 2.5,
    depthM: 2.5,
    heightM: 2.6,
    end: 'b',
    gapM: 0.8,
    setbackM: 1,
};

export interface GateFrame {
    mid: Point2D;
    /** Tangente unitaria a→b en el plano (Y hacia abajo). */
    ux: number;
    uy: number;
    lengthM: number;
}

export function gateFrame(a: Point2D, b: Point2D, scaleM: number): GateFrame {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        ux: dx / len,
        uy: dy / len,
        lengthM: len * scaleM,
    };
}

/** Normal unitaria hacia el interior del predio: 'left' = a la izquierda al recorrer a→b en pantalla (Y hacia abajo). */
export function inwardNormal(
    frame: Pick<GateFrame, 'ux' | 'uy'>,
    side: 'left' | 'right',
): Point2D {
    return side === 'left'
        ? { x: frame.uy, y: -frame.ux }
        : { x: -frame.uy, y: frame.ux };
}

/** Rectángulo (plano) desde el vano hacia adentro: la zona de acceso / carril del portón. */
export function accessLaneRect(
    a: Point2D,
    b: Point2D,
    scaleM: number,
    side: 'left' | 'right',
    depthM: number,
): Point2D[] {
    const n = inwardNormal(gateFrame(a, b, scaleM), side);
    const d = depthM / scaleM;
    return [
        a,
        b,
        { x: b.x + n.x * d, y: b.y + n.y * d },
        { x: a.x + n.x * d, y: a.y + n.y * d },
    ];
}

/**
 * Rectángulo (plano) del puesto de ingreso: al costado del vano (por su extremo
 * `end`), separado `gapM` de él y `setbackM` hacia adentro de la línea del cerco.
 */
export function boothRect(
    a: Point2D,
    b: Point2D,
    scaleM: number,
    side: 'left' | 'right',
    booth: GateBooth,
): Point2D[] {
    const frame = gateFrame(a, b, scaleM);
    const n = inwardNormal(frame, side);
    const sign = booth.end === 'b' ? 1 : -1;
    const lat0 = sign * (frame.lengthM / 2 + booth.gapM);
    const lat1 = sign * (frame.lengthM / 2 + booth.gapM + booth.widthM);
    const in0 = booth.setbackM;
    const in1 = booth.setbackM + booth.depthM;
    const at = (lat: number, inward: number): Point2D => ({
        x: frame.mid.x + (frame.ux * lat + n.x * inward) / scaleM,
        y: frame.mid.y + (frame.uy * lat + n.y * inward) / scaleM,
    });
    return [at(lat0, in0), at(lat1, in0), at(lat1, in1), at(lat0, in1)];
}

export const DEFAULT_CANOPY: GateCanopy = {
    enabled: false,
    depthM: 4,
    heightM: 3,
    roof: 'mono',
    riseM: 0.6,
    material: 'tile',
    overhangM: 0.3,
};
export const DEFAULT_SIDE_WALLS: GateSideWalls = {
    enabled: false,
    thicknessM: 0.25,
    heightM: 3,
    depthM: 4,
};
export const DEFAULT_GATE_LIGHTS: GateLights = {
    enabled: false,
    count: 3,
    heightM: 2.8,
    lumens: 1500,
    wattage: 15,
};

/** Cubierta, muros y luminarias con valores por defecto para portones previos. */
export function gateEntrance(cfg: GateConfig | undefined): {
    canopy: GateCanopy;
    sideWalls: GateSideWalls;
    lights: GateLights;
} {
    return {
        canopy: { ...DEFAULT_CANOPY, ...(cfg?.canopy ?? {}) },
        sideWalls: { ...DEFAULT_SIDE_WALLS, ...(cfg?.sideWalls ?? {}) },
        lights: { ...DEFAULT_GATE_LIGHTS, ...(cfg?.lights ?? {}) },
    };
}

/** Potencia instalada (W) de las luminarias del ingreso de un portón. */
export function gateLightsPowerW(element: Pick<SiteElement, 'type' | 'config'>): number {
    if (element.type !== 'gate' || element.config?.kind !== 'gate') return 0;
    const { lights } = gateEntrance(element.config);
    return lights.enabled ? Math.max(0, lights.count) * lights.wattage : 0;
}

export type EntrancePresetId = 'vehicular' | 'service' | 'pedestrian' | 'vehicular_booth';

export const ENTRANCE_PRESETS: Array<{ id: EntrancePresetId; label: string }> = [
    { id: 'vehicular', label: 'Ingreso vehicular (portón + zona de acceso)' },
    { id: 'vehicular_booth', label: 'Ingreso vehicular con puesto de control' },
    { id: 'service', label: 'Ingreso de servicio techado (muros + techo + luminarias)' },
    { id: 'pedestrian', label: 'Ingreso peatonal' },
];

/**
 * Punto de partida para un tipo de ingreso: solo cambia lo que define ese tipo
 * (el usuario después ajusta cada parte a su proyecto). No toca el cerco
 * asociado ni el lado interior.
 */
export function entrancePreset(id: EntrancePresetId): Partial<GateConfig> {
    switch (id) {
        case 'vehicular':
            return {
                variant: 'sliding',
                accessDepthM: 6,
                booth: { ...DEFAULT_BOOTH, enabled: false },
                canopy: { ...DEFAULT_CANOPY, enabled: false },
                sideWalls: { ...DEFAULT_SIDE_WALLS, enabled: false },
                lights: { ...DEFAULT_GATE_LIGHTS, enabled: false },
            };
        case 'vehicular_booth':
            return {
                variant: 'sliding',
                accessDepthM: 8,
                booth: { ...DEFAULT_BOOTH, enabled: true },
                canopy: { ...DEFAULT_CANOPY, enabled: false },
                sideWalls: { ...DEFAULT_SIDE_WALLS, enabled: false },
                lights: { ...DEFAULT_GATE_LIGHTS, enabled: true, count: 2, heightM: 4 },
            };
        case 'service':
            return {
                variant: 'open',
                accessDepthM: 4,
                booth: { ...DEFAULT_BOOTH, enabled: false },
                canopy: { ...DEFAULT_CANOPY, enabled: true },
                sideWalls: { ...DEFAULT_SIDE_WALLS, enabled: true },
                lights: { ...DEFAULT_GATE_LIGHTS, enabled: true },
            };
        case 'pedestrian':
            return {
                variant: 'pedestrian',
                accessDepthM: 0,
                booth: { ...DEFAULT_BOOTH, enabled: false },
                canopy: { ...DEFAULT_CANOPY, enabled: false },
                sideWalls: { ...DEFAULT_SIDE_WALLS, enabled: false },
                lights: { ...DEFAULT_GATE_LIGHTS, enabled: false },
            };
    }
}

/** Configuración de la zona de acceso de un portón, con valores por defecto para portones previos. */
export function gateAccess(cfg: GateConfig | undefined): {
    depthM: number;
    side: 'left' | 'right';
    booth: GateBooth;
} {
    return {
        depthM: cfg?.accessDepthM ?? 0,
        side: cfg?.inwardSide ?? 'left',
        booth: { ...DEFAULT_BOOTH, ...(cfg?.booth ?? {}) },
    };
}
