import { evaluateUGR } from '@/pages/dialux/hooks/glareCalculation';
import type { GlareObserver } from '@/pages/dialux/hooks/glareObserver';
import { calculateLightingResult } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Fixture, Room } from '@/pages/dialux/hooks/types';
import type { ProductUgrTable, ProductUgrTableEntry } from '../../domain/types';

/**
 * Genera una tabla de referencia UGR para UN producto — Fase 15, Parte B
 * del plan maestro ("Corrección de fichas fotométricas: CDL polar y UGR").
 *
 * IMPORTANTE — esto NO reproduce la tabla CIE 117 publicada por fabricantes:
 * ese texto está pagado y no pudo verificarse letra por letra en este ciclo
 * (búsqueda web cruzada: soporte DIALux evo + fuentes independientes). Lo
 * que sí se verificó y se usa aquí: sala de referencia con H=2m (altura de
 * montaje SOBRE el ojo del observador, con el observador a 1.2m — la misma
 * altura ya validada en `glareObserver.ts::DEFAULT_UGR_EYE_HEIGHT` desde la
 * Fase 9), separación SHR=0.25 → 0.5m, dos direcciones de observación
 * (transversal/longitudinal) y salas en múltiplos de H desde (2H,2H) hasta
 * (12H,8H). Reflectancias 70/50/20 (techo/pared/piso) — el valor por
 * defecto más común en diseño lumínico, no exclusivo del texto pagado.
 *
 * El motor usado (`calculateLightingResult`/`evaluateUGR`) es el mismo
 * validado desde la Fase 9 — esta función NO reimplementa la fórmula de
 * UGR, solo arma salas de referencia y llama al motor existente dos veces
 * por sala (una por dirección de observación).
 */

const MOUNTING_HEIGHT_M = 2.0; // "H" — altura de montaje sobre el ojo del observador.
const EYE_HEIGHT_M = 1.2; // Mismo valor validado en glareObserver.ts (Fase 9).
const ROOM_HEIGHT_M = MOUNTING_HEIGHT_M + EYE_HEIGHT_M; // 3.2 m — sala de referencia.
// SHR=0.25 (no 1.0) confirmado por el usuario contra el LDT Editor de DIALux
// real (2026-08-17) — NO cambiar sin volver a verificar contra la
// herramienta real, la literatura general (CIE 190) describe 1:1 como "la"
// configuración estándar, pero el editor real que se está replicando usa
// 0.25 para su tabla de cabecera.
const SHR = 0.25;
const SPACING_M = SHR * MOUNTING_HEIGHT_M; // 0.5 m
const REFLECTANCES = { ceiling: 0.7, wall: 0.5, floor: 0.2 };
/**
 * Combinaciones de reflectancia habituales en tablas UGR publicadas (techo
 * decreciente 70→50→30, pared igual o un escalón por debajo, piso fijo en
 * 20% — confirmado como convención general en fuentes cruzadas, AGI32:
 * "the floor cavity is always 20%"). NO son una transcripción letra por
 * letra del grid exacto del texto CIE 117 (pagado, no accesible) — mismo
 * criterio de honestidad que el resto de esta tabla: útiles para comparar
 * tendencia, no para citar como "la" tabla oficial de 9 combinaciones.
 */
const REFLECTANCE_COMBINATIONS: Array<{ ceiling: number; wall: number; floor: number }> = [
    { ceiling: 0.7, wall: 0.5, floor: 0.2 },
    { ceiling: 0.7, wall: 0.3, floor: 0.2 },
    { ceiling: 0.5, wall: 0.5, floor: 0.2 },
    { ceiling: 0.5, wall: 0.3, floor: 0.2 },
    { ceiling: 0.3, wall: 0.3, floor: 0.2 },
];
const REFERENCE_ROOMS_H_MULTIPLES: Array<[length: number, width: number]> = [
    [2, 2],
    [2, 4],
    [4, 4],
    [4, 8],
    [8, 8],
    [12, 8],
];
/** Malla deliberadamente gruesa: solo se necesita `avg_lux` para el fallback de luminancia de fondo (Lb = avg/π), no un mapa isolux preciso. */
const REFERENCE_GRID_SPACING_M = 1.0;

export type ComputeEngineUgrTableResult = { available: true; table: ProductUgrTable } | { available: false; reason: string };

function buildReferenceFixtures(photometricWeb: NonNullable<Fixture['photometricWeb']>, length: number, width: number): Fixture[] {
    const nx = Math.max(1, Math.round(length / SPACING_M));
    const ny = Math.max(1, Math.round(width / SPACING_M));
    const fixtures: Fixture[] = [];
    let id = 0;
    for (let ix = 0; ix < nx; ix++) {
        for (let iy = 0; iy < ny; iy++) {
            id += 1;
            fixtures.push({
                id: `ref-${id}`,
                name: 'ref',
                x: (ix + 0.5) * (length / nx),
                y: (iy + 0.5) * (width / ny),
                z: ROOM_HEIGHT_M,
                lumens: photometricWeb.reference_lumens ?? 1,
                efficiency: 1,
                fixtureType: 'recessed',
                lightColor: '#ffffff',
                photometricWeb,
            });
        }
    }
    return fixtures;
}

function buildReferenceRoom(length: number, width: number): Room {
    return {
        id: 'ref-room',
        name: 'Sala de referencia UGR',
        vertices: [
            { x: 0, y: 0 },
            { x: length, y: 0 },
            { x: length, y: width },
            { x: 0, y: width },
        ],
        height: ROOM_HEIGHT_M,
        color: '#000000',
    };
}

function buildWallMidpointObserver(length: number, width: number, axis: 'crosswise' | 'endwise'): GlareObserver {
    if (axis === 'crosswise') {
        return { x: 0, y: width / 2, eyeHeight: EYE_HEIGHT_M, viewDirectionDeg: 0 };
    }
    return { x: length / 2, y: 0, eyeHeight: EYE_HEIGHT_M, viewDirectionDeg: 90 };
}

function computeUgrForRoom(
    fixtures: Fixture[],
    room: Room,
    length: number,
    width: number,
    reflectances: { ceiling: number; wall: number; floor: number },
): { crosswise: number | null; endwise: number | null } {
    // Reflectancias aplicadas a la propia sala de referencia (no solo
    // declaradas en la salida) — sin esto, `avg_lux`/`Lb` se calculaban con
    // interreflexión 0%, inconsistente con lo que documenta la tabla.
    const avgResult = calculateLightingResult(room, fixtures, REFERENCE_GRID_SPACING_M, [], reflectances);
    if (avgResult.avg_lux <= 0) {
        return { crosswise: null, endwise: null };
    }
    const lb = avgResult.avg_lux / Math.PI;

    const crosswise = evaluateUGR([buildWallMidpointObserver(length, width, 'crosswise')], fixtures, [], () => lb);
    const endwise = evaluateUGR([buildWallMidpointObserver(length, width, 'endwise')], fixtures, [], () => lb);

    return { crosswise: crosswise.ugr, endwise: endwise.ugr };
}

function computeTableForReflectances(
    web: NonNullable<Fixture['photometricWeb']>,
    reflectances: { ceiling: number; wall: number; floor: number },
): ProductUgrTable {
    const entries: ProductUgrTableEntry[] = REFERENCE_ROOMS_H_MULTIPLES.map(([hL, hW]) => {
        const length = hL * MOUNTING_HEIGHT_M;
        const width = hW * MOUNTING_HEIGHT_M;
        const fixtures = buildReferenceFixtures(web, length, width);
        const room = buildReferenceRoom(length, width);
        const { crosswise, endwise } = computeUgrForRoom(fixtures, room, length, width, reflectances);
        return {
            roomLabel: `${length}×${width} m (${hL}H×${hW}H)`,
            ugrCrosswise: crosswise,
            ugrEndwise: endwise,
        };
    });

    return {
        provenance: 'engine-calculated',
        method: 'Motor propio (evaluateUGR, Fase 9) sobre salas de referencia normalizadas',
        disclaimer:
            `Cálculo propio con el motor de esta plataforma (SHR ${SHR}, reflectancias ${Math.round(reflectances.ceiling * 100)}/${Math.round(reflectances.wall * 100)}/${Math.round(reflectances.floor * 100)}, H=2 m) — NO es una reproducción certificada de la tabla CIE 117 publicada por el fabricante.`,
        shr: SHR,
        reflectances: { ceiling: Math.round(reflectances.ceiling * 100), wall: Math.round(reflectances.wall * 100), floor: Math.round(reflectances.floor * 100) },
        entries,
    };
}

/** Validaciones comunes — comparten el mismo criterio de "cuándo tiene sentido calcular esto" que ya usaba la versión de una sola tabla. */
function validatePhotometricWeb(fixture: Pick<Fixture, 'photometricWeb'>): { web: NonNullable<Fixture['photometricWeb']> } | { reason: string } {
    const web = fixture.photometricWeb;
    if (!web) {
        return { reason: 'Sin matriz fotométrica (photometricWeb) — no se puede calcular una tabla UGR de referencia.' };
    }
    if (web.provenance !== 'manufacturer') {
        return {
            reason: `Fotometría de origen "${web.provenance ?? 'desconocido'}" — la tabla UGR de referencia solo se calcula sobre fotometría real de fabricante, nunca sobre curvas sintéticas o manuales.`,
        };
    }
    if (!Array.isArray(web.gamma_angles) || !Array.isArray(web.candela) || web.candela.length === 0) {
        return { reason: 'La matriz fotométrica no tiene ángulos/candelas válidos.' };
    }
    return { web };
}

export function computeEngineUgrTable(fixture: Pick<Fixture, 'photometricWeb'>): ComputeEngineUgrTableResult {
    const validation = validatePhotometricWeb(fixture);
    if ('reason' in validation) {
        return { available: false, reason: validation.reason };
    }

    return { available: true, table: computeTableForReflectances(validation.web, REFLECTANCES) };
}

/**
 * Igual que `computeEngineUgrTable()`, pero recorre las 5 combinaciones de
 * reflectancia habituales (`REFLECTANCE_COMBINATIONS`) en vez de una sola —
 * el modal de previsualización (Ronda 21b) lo usa para mostrar la grilla
 * completa techo×pared×piso, más cerca de lo que muestra el LDT Editor de
 * DIALux. NO se usa en el PDF de producción (que sigue con la tabla única
 * 70/50/20 vía `computeEngineUgrTable()`, sin cambios de comportamiento).
 */
export function computeEngineUgrTables(fixture: Pick<Fixture, 'photometricWeb'>): { available: true; tables: ProductUgrTable[] } | { available: false; reason: string } {
    const validation = validatePhotometricWeb(fixture);
    if ('reason' in validation) {
        return { available: false, reason: validation.reason };
    }

    return {
        available: true,
        tables: REFLECTANCE_COMBINATIONS.map((reflectances) => computeTableForReflectances(validation.web, reflectances)),
    };
}
