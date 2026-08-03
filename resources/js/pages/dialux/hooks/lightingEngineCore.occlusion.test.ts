import { describe, expect, it } from 'vitest';
import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { calculateLightingResult, GRID_SPACING } from './lightingEngineCore';
import type { Fixture, Room } from './useEditorStore';

/**
 * Suite de la Fase 6 ("Visibilidad, oclusión y sombras", plan maestro §11).
 * Puerta de salida citada por el plan: "no aporte directo cuando el camino
 * está ocluido, sin fugas en los bordes relevantes" — se prueba end-to-end
 * a través de la API pública `calculateLightingResult` (no las funciones
 * internas), igual que la suite analítica de Fase 5.
 *
 * Truco de fixture (heredado de Fase 5): un recinto de exactamente
 * `GRID_SPACING x GRID_SPACING` produce una malla de 1x1 con un único punto
 * de cálculo en su centro — da control total sobre la posición exacta del
 * punto sin exportar nada interno del motor.
 */

function buildSinglePointRoom(): Room {
    return {
        id: 'occlusion-room',
        name: 'Punto de referencia — oclusión',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: GRID_SPACING, y: 0 },
            { x: GRID_SPACING, y: GRID_SPACING },
            { x: 0, y: GRID_SPACING },
        ],
        height: 3,
        color: '#000000',
        usefulPlaneHeight: 0,
    };
}

function buildFixtureAbove(z = 2): Fixture {
    return {
        id: 'occlusion-fixture',
        name: 'Fuente de referencia',
        x: GRID_SPACING / 2,
        y: GRID_SPACING / 2 + 3, // del otro lado de un muro colocado en y=1.5
        z,
        lumens: 4000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
    };
}

/** Muro sólido de piso a techo, perpendicular a la línea punto→luminaria (a lo largo de X, en y=1.5). */
function fullWallAt(y: number, zMax = 3): OcclusionBox {
    return { originX: -1, originY: y, angleRad: 0, length: GRID_SPACING + 2, thickness: 0.2, zMin: 0, zMax };
}

describe('Fase 6 — oclusión: bloqueo total por muro', () => {
    it('sin obstáculos, la luminaria del otro lado ilumina normalmente', () => {
        const room = buildSinglePointRoom();
        const fixture = buildFixtureAbove();
        const result = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        expect(result.avg_lux).toBeGreaterThan(0);
    });

    it('con un muro sólido interpuesto, la contribución directa es exactamente 0', () => {
        const room = buildSinglePointRoom();
        const fixture = buildFixtureAbove();
        const wall = fullWallAt(1.5);
        const result = calculateLightingResult(room, [fixture], GRID_SPACING, [wall]);
        expect(result.avg_lux).toBe(0);
    });

    it('un muro que NO está en el camino (a un lado, fuera de rango) no afecta el resultado', () => {
        const room = buildSinglePointRoom();
        const fixture = buildFixtureAbove();
        const withoutWall = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        const farWall = fullWallAt(10); // lejos de la línea punto→luminaria
        const withFarWall = calculateLightingResult(room, [fixture], GRID_SPACING, [farWall]);
        expect(withFarWall.avg_lux).toBeCloseTo(withoutWall.avg_lux, 9);
    });
});

describe('Fase 6 — oclusión: media apertura (puerta) y ventana transparente', () => {
    const wallY = 1.5;
    const sill: OcclusionBox = { originX: -1, originY: wallY, angleRad: 0, length: GRID_SPACING + 2, thickness: 0.2, zMin: 0, zMax: 0.9 };
    const lintel: OcclusionBox = { originX: -1, originY: wallY, angleRad: 0, length: GRID_SPACING + 2, thickness: 0.2, zMin: 2.1, zMax: 3 };

    /**
     * Punto y luminaria a la MISMA altura `z` (rayo horizontal): así el
     * cruce con el plano del muro ocurre exactamente a esa altura, sin
     * efecto de paralaje. (Con alturas distintas, como en `buildFixtureAbove`,
     * el rayo cruza el muro a una altura intermedia proporcional a qué tan
     * cerca está el muro de cada extremo — no a la altura de la luminaria;
     * ese es justamente el comportamiento correcto para un rayo diagonal,
     * pero no sirve para aislar "¿a qué altura cruza el vano?" en este test).
     */
    function buildRoomAndFixtureAtHeight(z: number): { room: Room; fixture: Fixture } {
        const room: Room = { ...buildSinglePointRoom(), usefulPlaneHeight: z };
        const fixture: Fixture = { ...buildFixtureAbove(z), z };
        return { room, fixture };
    }

    it('una luminaria a la altura del vano de la ventana (entre antepecho y dintel) SÍ ilumina', () => {
        const { room, fixture } = buildRoomAndFixtureAtHeight(1.5); // dentro de [0.9, 2.1]
        const withoutObstacles = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        const withWindow = calculateLightingResult(room, [fixture], GRID_SPACING, [sill, lintel]);
        expect(withWindow.avg_lux).toBeCloseTo(withoutObstacles.avg_lux, 9);
    });

    it('la misma luminaria por encima del dintel SÍ se bloquea (media apertura: solo el vano deja pasar luz)', () => {
        const { room, fixture } = buildRoomAndFixtureAtHeight(2.5); // por encima de 2.1
        const result = calculateLightingResult(room, [fixture], GRID_SPACING, [sill, lintel]);
        expect(result.avg_lux).toBe(0);
    });
});

describe('Fase 6 — oclusión: punto cercano a superficie (sin autoocluirse)', () => {
    it('un punto de cálculo apoyado exactamente sobre la cara superior de un obstáculo (ej. una losa justo debajo del plano útil) no se autoocluye', () => {
        const room = buildSinglePointRoom(); // punto de cálculo en (0.25, 0.25, 0)
        const fixture = buildFixtureAbove(); // luminaria en z=2, línea de vista sube en +z desde el punto
        // Caja que ocupa el mismo footprint (x,y) del punto de cálculo, extendida
        // HACIA ABAJO (zMax=0, tangente exacta al punto) — representa, p.ej., el
        // borde de una losa cuya cara superior coincide exactamente con el plano
        // de cálculo. La línea de vista sale del punto hacia +z (hacia la
        // luminaria), nunca entra al volumen sólido (que está en z<0): sin el
        // sesgo paramétrico de `segmentOcclusion.ts`, el toque tangente en t=0
        // se contaría como intersección espuria.
        const slabBelow: OcclusionBox = { originX: 0.25, originY: 0.25, angleRad: 0, length: 0.01, thickness: 0.01, zMin: -1, zMax: 0 };
        const result = calculateLightingResult(room, [fixture], GRID_SPACING, [slabBelow]);
        const withoutObstacles = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        expect(result.avg_lux).toBeCloseTo(withoutObstacles.avg_lux, 9);
    });
});

describe('Fase 6 — oclusión: objeto delgado (partición)', () => {
    it('una partición fina (0.03m) en el camino sigue bloqueando la contribución directa', () => {
        const room = buildSinglePointRoom();
        const fixture = buildFixtureAbove();
        const thinPartition: OcclusionBox = { originX: -1, originY: 1.5, angleRad: 0, length: GRID_SPACING + 2, thickness: 0.03, zMin: 0.15, zMax: 2.1 };
        const result = calculateLightingResult(room, [fixture], GRID_SPACING, [thinPartition]);
        expect(result.avg_lux).toBe(0);
    });
});

describe('Fase 6 — compatibilidad hacia atrás', () => {
    it('llamar sin el parámetro obstacles produce el mismo resultado que pasar un array vacío', () => {
        const room = buildSinglePointRoom();
        const fixture = buildFixtureAbove();
        const withDefault = calculateLightingResult(room, [fixture], GRID_SPACING);
        const withEmpty = calculateLightingResult(room, [fixture], GRID_SPACING, []);
        expect(withDefault.avg_lux).toBeCloseTo(withEmpty.avg_lux, 9);
        expect(withDefault.ugr).toBeCloseTo(withEmpty.ugr, 9);
    });
});
