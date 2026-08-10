import { polygonAreaM2, pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import type { Fixture, Vertex } from '@/pages/dialux/hooks/types';
import { TEG18046_PHOTOMETRIC_WEB } from '../realPhotometry';

/**
 * Ambientes de forma NO rectangular para el oráculo Radiance —
 * `planes/plan_cierre_brecha_paridad_dialux_evo.md` §-14: "no siempre son
 * rectangulares/cuadrados, sino diferentes formas". Mismo criterio
 * metodológico que `shapeVariationFixtures.ts` (fotometría REAL de
 * TEG18046 en los tres casos, reflectancia 70/50/20 fija, UNA sola
 * luminaria) — la única variable que cambia entre estos tres fixtures y los
 * ya probados (rectángulo/cuadrado) es la forma del piso en sí.
 */

export interface PolygonShapeFixture {
    id: string;
    label: string;
    vertices: Vertex[];
    height: number;
    workingPlaneHeight: number;
    marginalZone: number;
    reflectance: { ceiling: number; wall: number; floor: number };
    fixtures: Fixture[];
    /** Espaciado de la grilla de sensores para el oráculo (metros). */
    spacing: number;
    variesFrom_rectangular: string;
}

function buildSingleFixture(id: string, x: number, y: number, height: number): Fixture {
    return {
        id: `${id}-teg18046`,
        name: 'TEGO IP65 FROSTED GLASS',
        x,
        y,
        z: height,
        lumens: 1508,
        power: 14,
        efficiency: 1,
        fixtureType: 'surface',
        brand: 'Thorlux Lighting',
        articleNumber: 'TEG18046',
        lightColor: '#ffffff',
        roomId: `${id}::ambient-1`,
        photometricWeb: TEG18046_PHOTOMETRIC_WEB,
    };
}

/** Verifica en tiempo de import que el punto de la luminaria caiga DENTRO del polígono — un fixture mal armado fallaría recién al correr Radiance (varios minutos) si no se valida acá. */
function assertFixturePlacementInsidePolygon(id: string, vertices: Vertex[], x: number, y: number): void {
    if (!pointInPolygon({ x, y }, vertices)) {
        throw new Error(`polygonShapeFixtures: la luminaria de "${id}" en (${x}, ${y}) cae FUERA del polígono declarado.`);
    }
}

/**
 * (a) Forma en L — combinación sala/comedor típica, con un "mordisco" de
 * 1.5x1.2 m en la esquina superior derecha. Área 7.2 m² (bbox 3x3 menos el
 * mordisco).
 */
function buildLShapeFixture(): PolygonShapeFixture {
    const id = 'shape-l';
    const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1.8 },
        { x: 1.5, y: 1.8 },
        { x: 1.5, y: 3 },
        { x: 0, y: 3 },
    ];
    const height = 3.0;
    const [fx, fy] = [1.0, 1.0];
    assertFixturePlacementInsidePolygon(id, vertices, fx, fy);

    return {
        id: 'l-shape',
        label: `Forma en L, sala/comedor (${polygonAreaM2(vertices).toFixed(1)} m²)`,
        vertices,
        height,
        workingPlaneHeight: 0.85,
        marginalZone: 0.15,
        reflectance: { ceiling: 0.7, wall: 0.5, floor: 0.2 },
        fixtures: [buildSingleFixture(id, fx, fy, height)],
        // 0.5 m = GRID_SPACING, el espaciado por defecto del motor de
        // producción (`lightingEngineCore.ts`) — usar otro valor aquí
        // compara el oráculo contra un conjunto de puntos de muestreo
        // DISTINTO al que el motor realmente usa, lo cual con una sola
        // luminaria concentrada (caída de luz pronunciada cerca de la
        // fuente) puede producir diferencias de 10-15% que no son un error
        // de geometría/física sino de dónde se mide. Ver Ronda 14 en el plan.
        spacing: 0.5,
        variesFrom_rectangular: 'forma no convexa (L), 6 lados en vez de 4',
    };
}

/**
 * (b) Pentágono con una esquina achaflanada — típico cuando la edificación
 * sigue una línea de propiedad angulada. Rectángulo 3x3 con la esquina
 * superior derecha cortada 0.8x0.8 m.
 */
function buildChamferedPentagonFixture(): PolygonShapeFixture {
    const id = 'shape-pentagon';
    const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2.2 },
        { x: 2.2, y: 3 },
        { x: 0, y: 3 },
    ];
    const height = 3.0;
    const [fx, fy] = [1.3, 1.3];
    assertFixturePlacementInsidePolygon(id, vertices, fx, fy);

    return {
        id: 'chamfered-pentagon',
        label: `Pentágono, esquina achaflanada (${polygonAreaM2(vertices).toFixed(1)} m²)`,
        vertices,
        height,
        workingPlaneHeight: 0.85,
        marginalZone: 0.15,
        reflectance: { ceiling: 0.7, wall: 0.5, floor: 0.2 },
        fixtures: [buildSingleFixture(id, fx, fy, height)],
        // 0.5 m = GRID_SPACING, el espaciado por defecto del motor de
        // producción (`lightingEngineCore.ts`) — usar otro valor aquí
        // compara el oráculo contra un conjunto de puntos de muestreo
        // DISTINTO al que el motor realmente usa, lo cual con una sola
        // luminaria concentrada (caída de luz pronunciada cerca de la
        // fuente) puede producir diferencias de 10-15% que no son un error
        // de geometría/física sino de dónde se mide. Ver Ronda 14 en el plan.
        spacing: 0.5,
        variesFrom_rectangular: 'forma convexa de 5 lados (una esquina achaflanada), no 4',
    };
}

/**
 * (c) Trapezoide — ambiente cuyas paredes convergen, típico al seguir un
 * lindero de lote irregular. Base 3.5 m, techo 2.5 m, profundidad 2.8 m.
 */
function buildTrapezoidFixture(): PolygonShapeFixture {
    const id = 'shape-trapezoid';
    const vertices: Vertex[] = [
        { x: 0, y: 0 },
        { x: 3.5, y: 0 },
        { x: 3, y: 2.8 },
        { x: 0.5, y: 2.8 },
    ];
    const height = 3.0;
    const [fx, fy] = [1.75, 1.3];
    assertFixturePlacementInsidePolygon(id, vertices, fx, fy);

    return {
        id: 'trapezoid',
        label: `Trapezoide, paredes convergentes (${polygonAreaM2(vertices).toFixed(1)} m²)`,
        vertices,
        height,
        workingPlaneHeight: 0.85,
        marginalZone: 0.15,
        reflectance: { ceiling: 0.7, wall: 0.5, floor: 0.2 },
        fixtures: [buildSingleFixture(id, fx, fy, height)],
        // 0.5 m = GRID_SPACING, el espaciado por defecto del motor de
        // producción (`lightingEngineCore.ts`) — usar otro valor aquí
        // compara el oráculo contra un conjunto de puntos de muestreo
        // DISTINTO al que el motor realmente usa, lo cual con una sola
        // luminaria concentrada (caída de luz pronunciada cerca de la
        // fuente) puede producir diferencias de 10-15% que no son un error
        // de geometría/física sino de dónde se mide. Ver Ronda 14 en el plan.
        spacing: 0.5,
        variesFrom_rectangular: 'cuadrilátero no rectangular (paredes no paralelas/perpendiculares)',
    };
}

export function buildAllPolygonShapeFixtures(): PolygonShapeFixture[] {
    return [buildLShapeFixture(), buildChamferedPentagonFixture(), buildTrapezoidFixture()];
}
