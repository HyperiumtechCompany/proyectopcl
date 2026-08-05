import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { distanceToPolygonEdge } from '@/pages/dialux/geometry/polygonGeometry';
import { firstBounceIlluminance } from './firstBounceReflection';
import { buildGrid, GRID_SPACING } from './lightingEngineCore';
import { buildRoomEnclosurePatches, type EnclosureReflectances } from './roomPatches';
import { getRoomUsefulPlaneHeight } from './roomLighting';
import { computeUnobstructedOvercastSkyHorizontalIlluminance } from './skyReferenceIlluminance';
import { skyIlluminanceAtSurfacePoint } from './skyIlluminance';
import type { Room, Wall, Window } from './types';
import { buildWindowSkyPatches, resolveWindowMidpointWorld, type SkyAperturePatch } from './windowSkyAperture';

/**
 * Tolerancia (m) para considerar que el muro de una ventana está en el
 * límite de `room`: `walls`/`rooms` son entidades dibujadas por separado en
 * este editor (no una se deriva de la otra), así que su coincidencia
 * geométrica no es exacta. Sin este filtro, una ventana en el muro de OTRO
 * recinto de la misma escena podría aportarle luz natural por error — el
 * bug real que este chequeo evita. El valor es un margen pragmático
 * (grosor típico de muro + imprecisión de dibujo), documentado como tal.
 */
const WINDOW_ROOM_BOUNDARY_TOLERANCE_M = 1.0;

/**
 * Fase 17 del plan maestro ("Luz natural" — Daylight Factor, primer ciclo).
 * Motor PARALELO al de luz eléctrica (`lightingEngineCore.ts::calculateLightingResult`)
 * — deliberadamente separado, no una extensión de ese motor: la radiancia del
 * cielo cubierto es anisotrópica (varía fuertemente con el ángulo cenital),
 * una física distinta a la de un parche Lambertiano de reflexión (radiancia
 * constante en toda dirección) que ya asume `computeFormFactor`. Reutiliza
 * los mismos primitivos de bajo nivel (parches, factor de forma, oclusión)
 * sin tocarlos ni integrarse a `CalculationConfig` — mismo patrón que
 * `export/derived/data/computeEngineUgrTable.ts` (Fase 15).
 *
 * `DF(punto) = (SC + IRC) / E_ref × 100`:
 *   - SC (Sky Component): luz de cielo que llega DIRECTAMENTE al punto a
 *     través de las ventanas.
 *   - IRC (Internally Reflected Component): la MISMA luz de cielo, inyectada
 *     como "directa" sobre los parches de la envolvente del recinto
 *     (`buildRoomEnclosurePatches`, Fase 7/16) y propagada con
 *     `firstBounceIlluminance` — más riguroso que la fórmula promedio
 *     simplificada de BRE Digest 310 (motor propio, no una reproducción del
 *     nomograma BRE).
 *   - ERC (Externally Reflected Component) = 0, SIEMPRE, en este ciclo: sin
 *     geometría de obstrucción/terreno exterior modelada todavía ("sombras
 *     exteriores" es un ítem posterior de esta misma fase). Omitirlo produce
 *     una COTA INFERIOR conservadora del DF real, nunca un falso "cumple" —
 *     se declara en `notes`, nunca se oculta.
 *   - E_ref: iluminancia horizontal exterior sin obstrucción, calculada con
 *     el MISMO código que SC (`skyReferenceIlluminance.ts`) — un eventual
 *     error de escala en la fórmula se cancela en el cociente.
 */
export interface DaylightFactorWarning {
    code: string;
    message: string;
}

export interface DaylightFactorResult {
    avg_df: number;
    min_df: number;
    max_df: number;
    uniformity: number;
    grid_rows: number;
    grid_cols: number;
    grid_values: Array<number | null>;
    warnings: DaylightFactorWarning[];
    /** Notas metodológicas siempre presentes (ej. ERC no modelado) — no son advertencias de datos faltantes. */
    notes: string[];
}

interface ResolvedWindow {
    skyPatches: SkyAperturePatch[];
    transmittance: number;
}

function resolveWindows(
    room: Room,
    windows: Window[],
    walls: Wall[],
    warnings: DaylightFactorWarning[],
    skySubdivisionCols: number,
    skySubdivisionRows: number,
): ResolvedWindow[] {
    const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
    const resolved: ResolvedWindow[] = [];

    for (const window of windows) {
        const wall = wallsById.get(window.wallId);
        if (!wall) {
            continue; // Ventana de un muro que no está en `walls` — no aplica a este cálculo.
        }

        const midpoint = resolveWindowMidpointWorld(window, wall);
        if (!midpoint || distanceToPolygonEdge(midpoint, room.vertices) > WINDOW_ROOM_BOUNDARY_TOLERANCE_M) {
            continue; // Ventana en un muro de OTRO recinto de la misma escena — no le pertenece a `room`.
        }

        if (window.glazingTransmittance == null) {
            warnings.push({
                code: 'window-without-glazing-transmittance',
                message: `La ventana "${window.id}" no tiene vidrio asignado — no aporta luz natural hasta que se le asigne uno.`,
            });
            continue;
        }
        const skyPatches = buildWindowSkyPatches(window, wall, room, skySubdivisionCols, skySubdivisionRows);
        if (skyPatches.length > 0) {
            resolved.push({ skyPatches, transmittance: window.glazingTransmittance });
        }
    }

    if (resolved.length === 0) {
        warnings.push({
            code: 'room-without-daylight-windows',
            message: `"${room.name}" no tiene ninguna ventana con vidrio asignado — el Daylight Factor es 0 en todo punto.`,
        });
    }

    return resolved;
}

function totalSkyIlluminance(
    point: { x: number; y: number; z: number; normal: { x: number; y: number; z: number } },
    resolvedWindows: ResolvedWindow[],
    obstacles: OcclusionBox[],
): number {
    let sum = 0;
    for (const rw of resolvedWindows) {
        sum += skyIlluminanceAtSurfacePoint(point, rw.skyPatches, rw.transmittance, obstacles);
    }
    return sum;
}

export function calculateDaylightFactor(
    room: Room,
    windows: Window[],
    walls: Wall[],
    surfaceReflectances: EnclosureReflectances | null = null,
    obstacles: OcclusionBox[] = [],
    spacingM: number = GRID_SPACING,
    skySubdivisionCols = 4,
    skySubdivisionRows = 3,
): DaylightFactorResult {
    const warnings: DaylightFactorWarning[] = [];
    const notes: string[] = [
        'Componente reflejada externa (ERC) no modelada en este ciclo — sin geometría de obstrucción/terreno ' +
            'exterior, se asume ERC = 0, una cota inferior conservadora del Daylight Factor real.',
    ];

    if (!surfaceReflectances) {
        warnings.push({
            code: 'room-without-material-reflectance',
            message: `"${room.name}" no tiene reflectancias de superficie asignadas — la componente reflejada interna (IRC) es 0.`,
        });
    }

    const resolvedWindows = resolveWindows(room, windows, walls, warnings, skySubdivisionCols, skySubdivisionRows);
    const roomPatches = buildRoomEnclosurePatches(room, surfaceReflectances ?? { ceiling: 0, wall: 0, floor: 0 });
    const patchDirectSky = roomPatches.map((patch) => totalSkyIlluminance(patch, resolvedWindows, obstacles));

    const usefulPlaneHeight = getRoomUsefulPlaneHeight(room);
    const grid = buildGrid(room, spacingM > 0 ? spacingM : GRID_SPACING, usefulPlaneHeight);
    const eRef = computeUnobstructedOvercastSkyHorizontalIlluminance();

    const values: Array<number | null> = grid.points.map((point) => {
        if (!point.active) {
            return null;
        }
        const sc = totalSkyIlluminance(point, resolvedWindows, obstacles);
        const irc = roomPatches.length > 0 ? firstBounceIlluminance(point, roomPatches, patchDirectSky, obstacles) : 0;
        return eRef > 0 ? ((sc + irc) / eRef) * 100 : 0;
    });

    const activeValues = values.filter((value): value is number => value !== null);
    const baseResult = {
        grid_rows: grid.rows,
        grid_cols: grid.cols,
        grid_values: values,
        warnings,
        notes,
    };

    if (activeValues.length === 0) {
        return { avg_df: 0, min_df: 0, max_df: 0, uniformity: 0, ...baseResult };
    }

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const value of activeValues) {
        sum += value;
        if (value < min) min = value;
        if (value > max) max = value;
    }
    const avg = sum / activeValues.length;

    return {
        avg_df: avg,
        min_df: min,
        max_df: max,
        uniformity: avg > 0 ? min / avg : 0,
        ...baseResult,
    };
}
