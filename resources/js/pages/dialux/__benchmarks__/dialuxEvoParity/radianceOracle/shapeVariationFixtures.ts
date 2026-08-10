import type { Fixture, Room } from '@/pages/dialux/hooks/types';
import { TEG18046_PHOTOMETRIC_WEB } from '../realPhotometry';

/**
 * Ambientes sintéticos para la investigación de la Causa B
 * (`planes/plan_cierre_brecha_paridad_dialux_evo.md` §-6, "siguiente paso
 * concreto": correr el oráculo de Radiance sobre 3-5 formas de ambiente más,
 * variando relación de aspecto, tamaño y reflectancia).
 *
 * A diferencia de `fixtures.ts` (que reconstruye ambientes de un PDF real de
 * DIALux evo), estos NO tienen una referencia de DIALux evo — no existe un
 * informe real para estas formas hipotéticas. Su propósito es aislar UNA
 * variable a la vez (forma/tamaño/reflectancia) manteniendo la MISMA
 * fotometría real ya validada (TEG18046) en los tres casos, para que
 * cualquier diferencia entre `first-bounce`/`iterative`/Radiance se pueda
 * atribuir a la geometría, no a la fotometría — exactamente el mismo
 * criterio que ya distingue `hasRealPhotometry` en `fixtures.ts`.
 *
 * Una sola luminaria centrada en cada ambiente (igual que los dos fixtures
 * de `fixtures.ts`): en "large-square" en particular esto da una
 * iluminancia deliberadamente no-uniforme para un diseño real (un solo
 * downlight en 4x4 m no es una propuesta de diseño) — no importa para este
 * experimento, que compara los TRES métodos de cálculo entre sí sobre la
 * MISMA fuente y geometría, no evalúa si el resultado es "un buen diseño".
 */

export interface ShapeVariationFixture {
    id: string;
    label: string;
    width: number;
    depth: number;
    height: number;
    workingPlaneHeight: number;
    marginalZone: number;
    reflectance: { ceiling: number; wall: number; floor: number };
    room: Room;
    fixtures: Fixture[];
    /** Grilla de sensores para el oráculo Radiance — densidad similar a `radianceOracle.test.ts` (~1 sensor cada 0.3-0.4 m). */
    grid: { columns: number; rows: number };
    /** Qué variable(s) de las tres (forma/tamaño/reflectancia) cambia respecto a los fixtures base de `fixtures.ts`. */
    variesFrom_sshhVsBano: string;
}

function buildSingleFixtureRoom(config: {
    id: string;
    width: number;
    depth: number;
    height: number;
    workingPlaneHeight: number;
    marginalZone: number;
    illuminanceLux: number;
}): { room: Room; fixtures: Fixture[] } {
    const { id, width, depth, height, workingPlaneHeight, marginalZone, illuminanceLux } = config;
    const room: Room = {
        id,
        name: id,
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: depth },
            { x: 0, y: depth },
        ],
        height,
        color: '#000000',
        illuminanceLux,
        usefulPlaneHeight: workingPlaneHeight,
        marginalZone,
    };

    const fixtures: Fixture[] = [
        {
            id: `${id}-teg18046`,
            name: 'TEGO IP65 FROSTED GLASS',
            x: width / 2,
            y: depth / 2,
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
        },
    ];

    return { room, fixtures };
}

/** (a) Relación de aspecto: pasillo largo 1.0x5.0 m (5:1) — más elongado que "sshh-vs-bano" (2.3:1). Reflectancia igual a la referencia (70/50/20) para aislar SOLO la forma. */
function buildLongCorridorFixture(): ShapeVariationFixture {
    const width = 1.0;
    const depth = 5.0;
    const { room, fixtures } = buildSingleFixtureRoom({
        id: 'shape-long-corridor',
        width,
        depth,
        height: 3.0,
        workingPlaneHeight: 0,
        marginalZone: 0.15,
        illuminanceLux: 100,
    });

    return {
        id: 'long-corridor',
        label: 'Pasillo largo 1.0x5.0 m (aspecto 5:1)',
        width,
        depth,
        height: 3.0,
        workingPlaneHeight: 0,
        marginalZone: 0.15,
        reflectance: { ceiling: 0.7, wall: 0.5, floor: 0.2 },
        room,
        fixtures,
        grid: { columns: 3, rows: 9 },
        variesFrom_sshhVsBano: 'forma (aspecto 5:1 vs. 2.3:1), mismo tamaño de orden de magnitud',
    };
}

/** (b) Tamaño: ambiente cuadrado grande 4.0x4.0 m — mucho más grande que los ~2 m² de los fixtures existentes. Reflectancia igual a la referencia para aislar SOLO el tamaño. */
function buildLargeSquareFixture(): ShapeVariationFixture {
    const width = 4.0;
    const depth = 4.0;
    const { room, fixtures } = buildSingleFixtureRoom({
        id: 'shape-large-square',
        width,
        depth,
        height: 3.0,
        workingPlaneHeight: 0.85,
        marginalZone: 0.3,
        illuminanceLux: 200,
    });

    return {
        id: 'large-square',
        label: 'Cuadrado grande 4.0x4.0 m (16 m²)',
        width,
        depth,
        height: 3.0,
        workingPlaneHeight: 0.85,
        marginalZone: 0.3,
        reflectance: { ceiling: 0.7, wall: 0.5, floor: 0.2 },
        room,
        fixtures,
        grid: { columns: 6, rows: 6 },
        variesFrom_sshhVsBano: 'tamaño (16 m² vs. ~2 m²), misma relación de aspecto 1:1 que "caseta-vs-guarderias"',
    };
}

/** (c) Reflectancia: cuadrado pequeño 1.3x1.3 m con reflectancia BAJA (50/30/10, no 70/50/20) — aísla el efecto de la magnitud de reflectancia, no solo su presencia/ausencia (que ya cubre `dialuxEvoParity.test.ts`). */
function buildSmallDarkSquareFixture(): ShapeVariationFixture {
    const width = 1.3;
    const depth = 1.3;
    const { room, fixtures } = buildSingleFixtureRoom({
        id: 'shape-small-dark-square',
        width,
        depth,
        height: 2.6,
        workingPlaneHeight: 0,
        marginalZone: 0.15,
        illuminanceLux: 100,
    });

    return {
        id: 'small-dark-square',
        label: 'Cuadrado pequeño 1.3x1.3 m, reflectancia baja (50/30/10)',
        width,
        depth,
        height: 2.6,
        workingPlaneHeight: 0,
        marginalZone: 0.15,
        reflectance: { ceiling: 0.5, wall: 0.3, floor: 0.1 },
        room,
        fixtures,
        grid: { columns: 4, rows: 4 },
        variesFrom_sshhVsBano: 'reflectancia (50/30/10 vs. 70/50/20) y techo bajo (2.6 m), tamaño similar a "sshh-vs-bano"',
    };
}

export function buildAllShapeVariationFixtures(): ShapeVariationFixture[] {
    return [buildLongCorridorFixture(), buildLargeSquareFixture(), buildSmallDarkSquareFixture()];
}
