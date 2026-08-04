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
const SHR = 0.25;
const SPACING_M = SHR * MOUNTING_HEIGHT_M; // 0.5 m
const REFLECTANCES = { ceiling: 0.7, wall: 0.5, floor: 0.2 };
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

function computeUgrForRoom(fixtures: Fixture[], room: Room, length: number, width: number): { crosswise: number | null; endwise: number | null } {
    // Reflectancias 70/50/20 aplicadas a la propia sala de referencia (no
    // solo declaradas en la salida) — sin esto, `avg_lux`/`Lb` se calculaban
    // con interreflexión 0%, inconsistente con lo que documenta la tabla.
    const avgResult = calculateLightingResult(room, fixtures, REFERENCE_GRID_SPACING_M, [], REFLECTANCES);
    if (avgResult.avg_lux <= 0) {
        return { crosswise: null, endwise: null };
    }
    const lb = avgResult.avg_lux / Math.PI;

    const crosswise = evaluateUGR([buildWallMidpointObserver(length, width, 'crosswise')], fixtures, [], () => lb);
    const endwise = evaluateUGR([buildWallMidpointObserver(length, width, 'endwise')], fixtures, [], () => lb);

    return { crosswise: crosswise.ugr, endwise: endwise.ugr };
}

export function computeEngineUgrTable(fixture: Pick<Fixture, 'photometricWeb'>): ComputeEngineUgrTableResult {
    const web = fixture.photometricWeb;
    if (!web) {
        return { available: false, reason: 'Sin matriz fotométrica (photometricWeb) — no se puede calcular una tabla UGR de referencia.' };
    }
    if (web.provenance !== 'manufacturer') {
        return {
            available: false,
            reason: `Fotometría de origen "${web.provenance ?? 'desconocido'}" — la tabla UGR de referencia solo se calcula sobre fotometría real de fabricante, nunca sobre curvas sintéticas o manuales.`,
        };
    }
    if (!Array.isArray(web.gamma_angles) || !Array.isArray(web.candela) || web.candela.length === 0) {
        return { available: false, reason: 'La matriz fotométrica no tiene ángulos/candelas válidos.' };
    }

    const entries: ProductUgrTableEntry[] = REFERENCE_ROOMS_H_MULTIPLES.map(([hL, hW]) => {
        const length = hL * MOUNTING_HEIGHT_M;
        const width = hW * MOUNTING_HEIGHT_M;
        const fixtures = buildReferenceFixtures(web, length, width);
        const room = buildReferenceRoom(length, width);
        const { crosswise, endwise } = computeUgrForRoom(fixtures, room, length, width);
        return {
            roomLabel: `${length}×${width} m (${hL}H×${hW}H)`,
            ugrCrosswise: crosswise,
            ugrEndwise: endwise,
        };
    });

    return {
        available: true,
        table: {
            provenance: 'engine-calculated',
            method: 'Motor propio (evaluateUGR, Fase 9) sobre salas de referencia normalizadas',
            disclaimer:
                'Cálculo propio con el motor de esta plataforma (SHR 0.25, reflectancias 70/50/20, H=2 m) — NO es una reproducción certificada de la tabla CIE 117 publicada por el fabricante.',
            shr: SHR,
            reflectances: { ceiling: 70, wall: 50, floor: 20 },
            entries,
        },
    };
}
