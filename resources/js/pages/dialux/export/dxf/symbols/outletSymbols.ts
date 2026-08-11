import type { ElectricalDeviceType } from '@/pages/dialux/hooks/types';
import {
    drawLocalCircle, drawLocalLine, drawLocalRectOutline, drawLocalSolid, drawLocalText,
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

const DEFAULT_PANEL_WIDTH_M = 0.40;
const DEFAULT_PANEL_HEIGHT_M = 0.15;

// Proporciones relativas a `hw` (medio-ancho), no metros absolutos -- a
// tamaño de leyenda (Fase 7, `sizeM` calculado para caber en la celda de la
// tabla, ~0.09-0.25m) los offsets absolutos que este símbolo tenía antes
// (radio de círculo 0.025m, stubs 0.03m) dejaban de ser pequeños respecto al
// símbolo y los 8 círculos de conexión se solapaban en un cúmulo ilegible
// ("como un resorte", reportado por un usuario abriendo el DXF real en
// AutoCAD). Los ratios de abajo reproducen EXACTO el tamaño original a
// sizeM=0.4 (hw=0.2): 0.2×0.125=0.025, 0.2×0.15=0.03, 0.2×0.75=0.15.
const PANEL_CIRCLE_RADIUS_RATIO = 0.125;
const PANEL_STUB_LENGTH_RATIO = 0.15;
const PANEL_LABEL_EXTRA_OFFSET_RATIO = 0.75;

/** Tablero General o de Distribución: rectángulo dividido con salidas/círculos en 3 lados. */
export function renderPanelSymbol(out: DxfLines, layer: string, options: DxfOutletSymbolOptions): void {
    const origin: Pt = { x: options.x, y: options.y };
    const rotationDeg = options.rotationDeg ?? 0;
    const hw = (options.sizeM ?? DEFAULT_PANEL_WIDTH_M) / 2;
    const hh = (options.sizeM ? options.sizeM * 0.375 : DEFAULT_PANEL_HEIGHT_M) / 2;
    const r = hw * PANEL_CIRCLE_RADIUS_RATIO;
    const stub = hw * PANEL_STUB_LENGTH_RATIO;
    const labelExtraOffset = hw * PANEL_LABEL_EXTRA_OFFSET_RATIO;

    // 1. Rectángulo principal
    drawLocalRectOutline(out, layer, origin, rotationDeg, hw, hh);

    // 2. Línea Diagonal (Top-Left a Bottom-Right) y Relleno (Triángulo Inferior-Izquierdo, ACI 3 = Verde)
    drawLocalLine(out, layer, origin, rotationDeg, { x: -hw, y: hh }, { x: hw, y: -hh });
    drawLocalSolid(out, layer, origin, rotationDeg, { x: -hw, y: hh }, { x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: -hh }, 3);

    // 3. Círculos de conexión (Salidas)
    // Top (4 salidas equiespaciadas)
    for (let i = 1; i <= 4; i++) {
        const cx = -hw + ((hw * 2) * (i / 5));
        drawLocalLine(out, layer, origin, rotationDeg, { x: cx, y: hh }, { x: cx, y: hh + stub });
        drawLocalCircle(out, layer, origin, rotationDeg, { x: cx, y: hh + stub + r }, r);
    }

    // Izquierda (2 salidas)
    drawLocalLine(out, layer, origin, rotationDeg, { x: -hw, y: hh * 0.5 }, { x: -hw - stub, y: hh * 0.5 });
    drawLocalCircle(out, layer, origin, rotationDeg, { x: -hw - stub - r, y: hh * 0.5 }, r);
    drawLocalLine(out, layer, origin, rotationDeg, { x: -hw, y: -hh * 0.5 }, { x: -hw - stub, y: -hh * 0.5 });
    drawLocalCircle(out, layer, origin, rotationDeg, { x: -hw - stub - r, y: -hh * 0.5 }, r);

    // Derecha (2 salidas)
    drawLocalLine(out, layer, origin, rotationDeg, { x: hw, y: hh * 0.5 }, { x: hw + stub, y: hh * 0.5 });
    drawLocalCircle(out, layer, origin, rotationDeg, { x: hw + stub + r, y: hh * 0.5 }, r);
    drawLocalLine(out, layer, origin, rotationDeg, { x: hw, y: -hh * 0.5 }, { x: hw + stub, y: -hh * 0.5 });
    drawLocalCircle(out, layer, origin, rotationDeg, { x: hw + stub + r, y: -hh * 0.5 }, r);

    // 4. Etiqueta (TG o TD)
    drawLocalText(out, layer, origin, rotationDeg, { x: 0, y: hh + labelExtraOffset }, Math.max(hw * 0.35, 0.02), options.label ?? '');
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
        case 'main_panel':
        case 'sub_panel':
            renderPanelSymbol(out, layer, options);
            return;
        default:
            renderGenericDeviceBoxSymbol(out, layer, options);
    }
}
