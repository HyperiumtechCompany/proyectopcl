import type { ElectricalDeviceType } from '@/pages/dialux/hooks/types';
import {
    drawLocalCircle, drawLocalLine, drawLocalRectOutline, drawLocalText,
    type DxfLines, type Pt,
} from '../emitters/primitives';

/**
 * Símbolos de tomacorrientes/tableros por `ElectricalDevice.type`. Mismas
 * formas que dibujaba `buildDialuxDxfExport.ts` antes de la Fase 5, ahora
 * parametrizadas por origen/tamaño/rotación para que el mismo renderer sirva
 * en planta y en la celda de símbolo de la leyenda (secciones 5.2/9.3/10).
 */
export interface DxfOutletSymbolOptions {
    x: number;
    y: number;
    rotationDeg?: number;
    /** Media dimensión del símbolo en metros. Cada renderer tiene su propio default (ver cada función). */
    sizeM?: number;
    label?: string;
}

const DEFAULT_WALL_OUTLET_SIZE_M = 0.075;
const DEFAULT_CEILING_OUTLET_SIZE_M = 0.075;
const DEFAULT_RACK_OUTLET_SIZE_M = 0.10;
const DEFAULT_WATER_HEATER_SIZE_M = 0.16;
const DEFAULT_GENERIC_DEVICE_SIZE_M = 0.075;

/** Toma bajo/alto/inicial/waterproof: círculo + línea central. Waterproof agrega "AP" y la altura de montaje. */
export function renderWallOutletSymbol(
    out: DxfLines, layer: string, options: DxfOutletSymbolOptions, waterproof = false,
): void {
    const origin: Pt = { x: options.x, y: options.y };
    const rotationDeg = options.rotationDeg ?? 0;
    const r = options.sizeM ?? DEFAULT_WALL_OUTLET_SIZE_M;

    drawLocalCircle(out, layer, origin, rotationDeg, { x: 0, y: 0 }, r);
    drawLocalLine(out, layer, origin, rotationDeg, { x: -r, y: 0 }, { x: r, y: 0 });
    drawLocalText(out, layer, origin, rotationDeg, { x: r + 0.025, y: -0.025 }, 0.06, options.label || 'T');

    if (waterproof) {
        drawLocalText(out, layer, origin, rotationDeg, { x: r + 0.025, y: 0.055 }, 0.04, 'AP');
        drawLocalText(out, layer, origin, rotationDeg, { x: r + 0.025, y: -0.085 }, 0.035, '1.20m');
    }
}

/** Toma de techo: cruz de 4 brazos + círculo pequeño en una esquina. */
export function renderCeilingOutletSymbol(out: DxfLines, layer: string, options: DxfOutletSymbolOptions): void {
    const origin: Pt = { x: options.x, y: options.y };
    const rotationDeg = options.rotationDeg ?? 0;
    const r = options.sizeM ?? DEFAULT_CEILING_OUTLET_SIZE_M;

    drawLocalLine(out, layer, origin, rotationDeg, { x: -r * 1.6, y: r * 0.7 }, { x: r * 1.25, y: r * 0.7 });
    drawLocalLine(out, layer, origin, rotationDeg, { x: -r * 0.95, y: r * 0.7 }, { x: -r * 0.95, y: -r * 1.8 });
    drawLocalLine(out, layer, origin, rotationDeg, { x: 0, y: r * 0.7 }, { x: 0, y: -r * 1.8 });
    drawLocalLine(out, layer, origin, rotationDeg, { x: r * 0.95, y: r * 0.7 }, { x: r * 0.95, y: -r * 1.8 });
    drawLocalCircle(out, layer, origin, rotationDeg, { x: r * 1.25, y: r * 0.7 }, r * 0.45);
}

/** Toma para rack/comunicaciones y toma de piso (`outlet_floor_box`, con label forzado a "TP"): rectángulo + texto. */
export function renderRackOutletSymbol(out: DxfLines, layer: string, options: DxfOutletSymbolOptions): void {
    const origin: Pt = { x: options.x, y: options.y };
    const rotationDeg = options.rotationDeg ?? 0;
    const hw = options.sizeM ?? DEFAULT_RACK_OUTLET_SIZE_M;
    const hh = hw * 0.6;

    drawLocalRectOutline(out, layer, origin, rotationDeg, hw, hh);
    drawLocalText(out, layer, origin, rotationDeg, { x: -hw * 0.45, y: -hh * 0.33 }, 0.055, options.label || 'TR');
}

/** Terma/calentador de agua: trapecio + diagonal. */
export function renderWaterHeaterSymbol(out: DxfLines, layer: string, options: DxfOutletSymbolOptions): void {
    const origin: Pt = { x: options.x, y: options.y };
    const rotationDeg = options.rotationDeg ?? 0;
    const hw = options.sizeM ?? DEFAULT_WATER_HEATER_SIZE_M;
    const hh = hw * 0.5625; // mantiene la proporción original (0.16 / 0.09)

    drawLocalRectOutline(out, layer, origin, rotationDeg, hw, hh); // aproximación rectangular del trapecio original
    drawLocalLine(out, layer, origin, rotationDeg, { x: -hw * 0.9, y: -hh * 0.72 }, { x: hw * 0.3, y: hh * 0.72 });
    drawLocalLine(out, layer, origin, rotationDeg, { x: hw * 0.3, y: -hh * 0.72 }, { x: -hw * 0.9, y: hh * 0.72 });
    drawLocalText(out, layer, origin, rotationDeg, { x: hw * 0.6, y: -0.025 }, 0.07, 'TE');
}

/** Tablero/medidor/dispositivo genérico: cuadrado + etiqueta encima. Fallback para cualquier tipo sin forma dedicada. */
export function renderGenericDeviceBoxSymbol(out: DxfLines, layer: string, options: DxfOutletSymbolOptions): void {
    const origin: Pt = { x: options.x, y: options.y };
    const rotationDeg = options.rotationDeg ?? 0;
    const hs = options.sizeM ?? DEFAULT_GENERIC_DEVICE_SIZE_M;

    drawLocalRectOutline(out, layer, origin, rotationDeg, hs, hs);
    drawLocalText(out, layer, origin, rotationDeg, { x: -hs, y: hs + 0.05 }, 0.07, options.label ?? '');
}

const DEFAULT_JUNCTION_BOX_SIZE_M = 0.05;

/**
 * Caja de pase legacy (`JunctionBox`, distinta de `ElectricalDevice` tipo
 * `junction_box`): círculo pequeño + "C". Se agrega en la Fase 7 porque la
 * leyenda de tomacorrientes (sección 10.1) exige una fila de "Caja de pase"
 * con el mismo símbolo que en planta — el mismo criterio de cierre de la
 * Fase 5, solo que esta forma no se había extraído todavía.
 */
export function renderJunctionBoxSymbol(out: DxfLines, layer: string, options: DxfOutletSymbolOptions): void {
    const origin: Pt = { x: options.x, y: options.y };
    const rotationDeg = options.rotationDeg ?? 0;
    const r = options.sizeM ?? DEFAULT_JUNCTION_BOX_SIZE_M;

    drawLocalCircle(out, layer, origin, rotationDeg, { x: 0, y: 0 }, r);
    drawLocalText(out, layer, origin, rotationDeg, { x: r + 0.01, y: 0 }, 0.06, 'C');
}

export interface DxfElectricalDeviceSymbolOptions extends DxfOutletSymbolOptions {
    type: ElectricalDeviceType | string;
}

/**
 * Despacha al renderer correcto según `type` — la MISMA función que debe
 * invocar tanto la entidad en planta como la fila de leyenda (criterio de
 * cierre de la Fase 5). Cualquier tipo sin forma dedicada (tableros,
 * medidores, cajas de pase, o un tipo desconocido) cae al cuadrado genérico,
 * nunca se omite en silencio.
 */
export function renderElectricalDeviceSymbol(out: DxfLines, layer: string, options: DxfElectricalDeviceSymbolOptions): void {
    switch (options.type) {
        case 'outlet_floor':
        case 'outlet_initial':
        case 'outlet_high_180':
            renderWallOutletSymbol(out, layer, options);
            return;
        case 'outlet_waterproof':
            renderWallOutletSymbol(out, layer, options, true);
            return;
        case 'outlet_ceiling':
            renderCeilingOutletSymbol(out, layer, options);
            return;
        case 'outlet_rack':
            renderRackOutletSymbol(out, layer, options);
            return;
        case 'outlet_floor_box':
            renderRackOutletSymbol(out, layer, { ...options, label: 'TP' });
            return;
        case 'water_heater_30l':
            renderWaterHeaterSymbol(out, layer, options);
            return;
        default:
            renderGenericDeviceBoxSymbol(out, layer, options);
    }
}
