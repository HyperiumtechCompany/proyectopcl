import {
    drawLocalCircle, drawLocalLine, drawLocalRectOutline, drawLocalText,
    type DxfLines, type Pt,
} from '../emitters/primitives';

/**
 * Símbolos de luminaria por `Fixture.catalogSymbol` (mismo catálogo que
 * `resources/js/pages/dialux/components/catalogData.tsx` y el renderer 2D en
 * `OverlayFixtures.tsx`). Un solo renderer para planta Y leyenda — Fase 5,
 * criterio de cierre: la leyenda nunca puede dibujar un símbolo distinto al
 * que aparece en el plano (Riesgo 4 del plan maestro).
 */
export type FixtureCatalogSymbol =
    | 'rect_red' | 'rect_green' | 'rect_white'
    | 'circle_black' | 'circle_magenta'
    | 'spot_yellow' | 'spot_orange'
    | 'emergency' | 'emergency_perm';

export interface DxfFixtureSymbolOptions {
    x: number;
    y: number;
    /** Grados sentido horario. Default 0. */
    rotationDeg?: number;
    /** Media dimensión del símbolo en metros (radio para círculos, semiancho para rectángulos). Default 0.15m. */
    sizeM?: number;
    catalogSymbol?: string | null;
}

const DEFAULT_FIXTURE_SIZE_M = 0.15;

/**
 * Color ACI del símbolo según `catalogSymbol` — misma lógica y mismo orden
 * de precedencia que `getStrokeColor` en `OverlayFixtures.tsx` (el color que
 * el usuario realmente ve en el editor), traducido a índices ACI de AutoCAD.
 * `undefined` deja el color por capa (BYLAYER) sin sobreescribir.
 */
function resolveFixtureColorAci(catalogSymbol?: string | null): number | undefined {
    if (!catalogSymbol) return undefined;
    if (catalogSymbol.includes('red')) return 1;
    if (catalogSymbol.includes('green')) return 3;
    if (catalogSymbol.includes('magenta')) return 6;
    if (catalogSymbol.includes('yellow') || catalogSymbol.includes('spot')) return 2;
    if (catalogSymbol.includes('orange')) return 30;
    if (catalogSymbol.includes('black')) return 8;
    if (catalogSymbol.includes('emergency')) return 3;
    if (catalogSymbol.includes('white')) return 7;
    return undefined;
}

/** Círculo + cruz central — símbolo genérico usado cuando no hay `catalogSymbol` o es desconocido (sección 9.3). */
function renderGenericFixtureSymbol(out: DxfLines, layer: string, origin: Pt, rotationDeg: number, r: number): void {
    drawLocalCircle(out, layer, origin, rotationDeg, { x: 0, y: 0 }, r);
    const c = r * 0.65;
    drawLocalLine(out, layer, origin, rotationDeg, { x: -c, y: 0 }, { x: c, y: 0 });
    drawLocalLine(out, layer, origin, rotationDeg, { x: 0, y: -c }, { x: 0, y: c });
}

/**
 * Dibuja el símbolo de una luminaria, con el color ACI real de su
 * `catalogSymbol` (mismo color que se ve en el editor). Símbolo desconocido
 * o ausente cae al contorno genérico (círculo + cruz) sin color propio —
 * nunca se omite en silencio.
 */
export function renderFixtureSymbol(out: DxfLines, layer: string, options: DxfFixtureSymbolOptions): void {
    const origin: Pt = { x: options.x, y: options.y };
    const rotationDeg = options.rotationDeg ?? 0;
    const r = options.sizeM ?? DEFAULT_FIXTURE_SIZE_M;
    const sym = options.catalogSymbol ?? '';
    const color = resolveFixtureColorAci(sym);

    switch (sym) {
        case 'circle_black':
            drawLocalCircle(out, layer, origin, rotationDeg, { x: 0, y: 0 }, r, color);
            drawLocalCircle(out, layer, origin, rotationDeg, { x: 0, y: 0 }, r * 0.3, color);
            return;

        case 'circle_magenta':
            drawLocalCircle(out, layer, origin, rotationDeg, { x: 0, y: 0 }, r, color);
            return;

        case 'spot_yellow':
        case 'spot_orange':
            drawLocalCircle(out, layer, origin, rotationDeg, { x: 0, y: 0 }, r, color);
            drawLocalLine(out, layer, origin, rotationDeg, { x: -r, y: 0 }, { x: r, y: 0 }, color);
            drawLocalLine(out, layer, origin, rotationDeg, { x: 0, y: -r }, { x: 0, y: r }, color);
            return;

        case 'emergency':
        case 'emergency_perm': {
            const halfW = r;
            const halfH = r * 0.6;
            drawLocalRectOutline(out, layer, origin, rotationDeg, halfW, halfH, color);
            drawLocalLine(out, layer, origin, rotationDeg, { x: -halfW, y: -halfH }, { x: halfW, y: halfH }, color);
            drawLocalLine(out, layer, origin, rotationDeg, { x: halfW, y: -halfH }, { x: -halfW, y: halfH }, color);
            if (sym === 'emergency_perm') {
                drawLocalText(out, layer, origin, rotationDeg, { x: halfW + 0.05, y: 0 }, r * 0.6, 'S', color);
            }
            return;
        }

        case 'rect_red':
        case 'rect_green':
        case 'rect_white':
            drawLocalRectOutline(out, layer, origin, rotationDeg, r, r * 0.6, color);
            return;

        default:
            renderGenericFixtureSymbol(out, layer, origin, rotationDeg, r);
    }
}

export interface DxfLightSwitchSymbolOptions {
    x: number;
    y: number;
    rotationDeg?: number;
    /** Radio del símbolo en metros. Default 0.06m (igual al renderer actual del plano único). */
    sizeM?: number;
}

const DEFAULT_SWITCH_SIZE_M = 0.06;

/**
 * Círculo simple — mismo símbolo para los 4 tipos de interruptor (`single`,
 * `double`, `triple`, `two-way`); lo que distingue el tipo en el plano y en
 * la leyenda es la etiqueta de texto (S, 2S, 3S, Sc), no la geometría.
 */
export function renderLightSwitchSymbol(out: DxfLines, layer: string, options: DxfLightSwitchSymbolOptions): void {
    const origin: Pt = { x: options.x, y: options.y };
    const rotationDeg = options.rotationDeg ?? 0;
    const r = options.sizeM ?? DEFAULT_SWITCH_SIZE_M;
    drawLocalCircle(out, layer, origin, rotationDeg, { x: 0, y: 0 }, r);
}
