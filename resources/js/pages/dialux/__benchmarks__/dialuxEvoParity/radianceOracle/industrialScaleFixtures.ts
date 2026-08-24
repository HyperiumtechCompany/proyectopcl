import type { Fixture, Room } from '@/pages/dialux/hooks/types';
import { GF19140_SUBSTITUTE_PHOTOMETRIC_WEB, TEG18046_PHOTOMETRIC_WEB } from '../realPhotometry';

/**
 * Ambientes sintéticos de ESCALA — a pedido explícito del usuario
 * ("vamos a implementar este proyecto en distintos casos... desde una caseta
 * de baño hasta una sala industrial"), extiende `shapeVariationFixtures.ts`
 * (que topa en 4x4 m / 16 m², una sola luminaria) a tamaños de oficina,
 * bodega y nave industrial, con una GRILLA de luminarias (no una sola,
 * ninguno de los fixtures anteriores valida cómo se comporta la
 * interreflexión/uniformidad cuando varios conos de luz se superponen, que
 * es el caso real en cualquier ambiente de este tamaño).
 *
 * Limitación declarada, no oculta: el catálogo de fotometría REAL disponible
 * en este repositorio (`realPhotometry.ts`) son dos ópticas de baja potencia
 * (TEG18046 14W/1508lm, GF19140 sustituto 26W/2580lm) — no hay un archivo
 * .ldt/.ies real de una luminaria industrial tipo "high-bay" (150-400W,
 * 15000-50000 lm, haz más concentrado). Estos fixtures ESCALAN el flujo de
 * esas mismas ópticas via `fixture.lumens` (que `candela()` ya reescala
 * proporcionalmente sobre la matriz real, ver `photometricInterpolation.ts`)
 * para alcanzar niveles de montaje/lux realistas — esto conserva la FORMA
 * real de la distribución fotométrica, pero un high-bay real casi siempre
 * tiene un haz bastante más concentrado a igual flujo. No se debe presentar
 * ningún resultado de `warehouse-medium`/`industrial-hall-large` como
 * equivalente a una luminaria industrial real sin volver a escalar con un
 * .ies/.ldt de high-bay real cuando se consiga uno.
 *
 * Reflectancias por tipo de ambiente (EN 12464-1 típico de referencia de
 * literatura de diseño, no una cita normativa verificada — igual criterio
 * `pending-confirmation` que el resto de esta carpeta):
 *   - oficina: techo 0.7, pared 0.5, piso 0.3 (superficies claras, acabado fino)
 *   - bodega/nave industrial: techo 0.5, pared 0.3, piso 0.2 (concreto/metal
 *     expuesto, más oscuro que una oficina)
 */

export interface IndustrialScaleFixture {
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
    /**
     * Espaciado de sensores para el ORÁCULO (no para el motor bajo prueba,
     * que sigue usando su malla adaptativa real vía `resolveMeshSpacing` en
     * el test). `resolveMeshSpacing` nunca engrosa por encima de
     * `GRID_SPACING` (0.5 m, ver doc-comment de esa función) — para un
     * ambiente de cientos de m² eso da cientos/miles de sensores, y cada uno
     * cuesta una traza de radiosidad completa (`rtrace -ab 8`) en el
     * oráculo: minutos se vuelven horas. Este campo desacopla la densidad de
     * MUESTREO DEL ORÁCULO (una validación estadística de la interreflexión
     * promedio, no un mapa isolux) de la malla real de producción — declarado
     * explícitamente aquí, nunca en silencio, y solo para los dos fixtures
     * grandes (bodega/nave). Los pequeños siguen a `GRID_SPACING`.
     */
    oracleSpacing: number;
    variesFrom_previous: string;
}

function buildGridFixtures(config: {
    id: string;
    photometricWeb: NonNullable<Fixture['photometricWeb']>;
    brand: string;
    articleNumber: string;
    lumensPerFixture: number;
    powerPerFixture: number;
    columns: number;
    rows: number;
    marginX: number;
    marginY: number;
    width: number;
    depth: number;
    mountingHeight: number;
}): Fixture[] {
    const { id, photometricWeb, brand, articleNumber, lumensPerFixture, powerPerFixture, columns, rows, marginX, marginY, width, depth, mountingHeight } = config;
    const usableWidth = width - 2 * marginX;
    const usableDepth = depth - 2 * marginY;
    const fixtures: Fixture[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            const x = marginX + (columns === 1 ? usableWidth / 2 : (col / (columns - 1)) * usableWidth);
            const y = marginY + (rows === 1 ? usableDepth / 2 : (row / (rows - 1)) * usableDepth);
            fixtures.push({
                id: `${id}-fixture-${row}-${col}`,
                name: `${brand} ${articleNumber} (escalada a ${lumensPerFixture} lm)`,
                x,
                y,
                z: mountingHeight,
                lumens: lumensPerFixture,
                power: powerPerFixture,
                efficiency: 1,
                fixtureType: 'surface',
                brand,
                articleNumber,
                lightColor: '#ffffff',
                roomId: `${id}::ambient-1`,
                photometricWeb,
            });
        }
    }
    return fixtures;
}

function buildRoom(id: string, width: number, depth: number, height: number, workingPlaneHeight: number, marginalZone: number, illuminanceLux: number): Room {
    return {
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
}

/**
 * (a) Oficina pequeña — 6.0x5.0 m (30 m²), techo 2.8 m, 4 luminarias
 * (grilla 2x2) — el primer escalón por encima de los fixtures existentes
 * (máximo previo: 4x4 m, una sola luminaria).
 */
function buildSmallOfficeFixture(): IndustrialScaleFixture {
    const width = 6.0;
    const depth = 5.0;
    const height = 2.8;
    const workingPlaneHeight = 0.75;
    const marginalZone = 0.3;
    const room = buildRoom('scale-small-office', width, depth, height, workingPlaneHeight, marginalZone, 500);

    const fixtures = buildGridFixtures({
        id: 'scale-small-office',
        photometricWeb: TEG18046_PHOTOMETRIC_WEB,
        brand: 'Thorlux Lighting',
        articleNumber: 'TEG18046',
        lumensPerFixture: 3000,
        powerPerFixture: 28,
        columns: 2,
        rows: 2,
        marginX: 1.5,
        marginY: 1.25,
        width,
        depth,
        mountingHeight: height,
    });

    return {
        id: 'small-office',
        label: 'Oficina pequeña 6.0x5.0 m (30 m²), 4 luminarias en grilla 2x2',
        width,
        depth,
        height,
        workingPlaneHeight,
        marginalZone,
        reflectance: { ceiling: 0.7, wall: 0.5, floor: 0.3 },
        room,
        fixtures,
        oracleSpacing: 0.5,
        variesFrom_previous: 'primer caso con GRILLA de luminarias (4) en vez de una sola; tamaño de oficina real',
    };
}

/**
 * (b) Bodega/almacén mediano — 12.0x10.0 m (120 m²), techo 6.0 m, 6
 * luminarias (grilla 2x3) escaladas a 12000 lm (aprox. equivalente a un
 * high-bay LED de gama media, ver limitación de fotometría en el doc-comment
 * del módulo). Plano útil a nivel de piso (0 m) — típico de área de
 * almacenamiento/circulación de montacargas, no de trabajo de precisión.
 */
function buildMediumWarehouseFixture(): IndustrialScaleFixture {
    const width = 12.0;
    const depth = 10.0;
    const height = 6.0;
    const workingPlaneHeight = 0;
    const marginalZone = 0.5;
    const room = buildRoom('scale-warehouse-medium', width, depth, height, workingPlaneHeight, marginalZone, 200);

    const fixtures = buildGridFixtures({
        id: 'scale-warehouse-medium',
        photometricWeb: GF19140_SUBSTITUTE_PHOTOMETRIC_WEB,
        brand: 'LTS (sustituto real)',
        articleNumber: 'GF19140-sustituto',
        lumensPerFixture: 12000,
        powerPerFixture: 120,
        columns: 3,
        rows: 2,
        marginX: 2.0,
        marginY: 2.5,
        width,
        depth,
        mountingHeight: height,
    });

    return {
        id: 'warehouse-medium',
        label: 'Bodega mediana 12.0x10.0 m (120 m²), techo 6.0 m, 6 luminarias en grilla 3x2',
        width,
        depth,
        height,
        workingPlaneHeight,
        marginalZone,
        reflectance: { ceiling: 0.5, wall: 0.3, floor: 0.2 },
        room,
        fixtures,
        // Oráculo con espaciado más grueso que GRID_SPACING (0.5 m) — a esa
        // densidad, 120 m² da ~480 sensores × radiosidad completa (`rtrace
        // -ab 8`) = horas, no minutos. 1.5 m mantiene ~53 sensores, suficiente
        // para validar el PROMEDIO físico de interreflexión sin pretender
        // reproducir un mapa isolux fino. Ver doc-comment de `oracleSpacing`.
        oracleSpacing: 1.5,
        variesFrom_previous: 'escala de bodega (120 m² vs. 30 m²), techo alto (6 m), plano útil a nivel de piso',
    };
}

/**
 * (c) Nave industrial grande — 24.0x15.0 m (360 m²), techo 9.0 m, 12
 * luminarias (grilla 4x3) escaladas a 20000 lm (aprox. high-bay de gama
 * alta). El caso más exigente de la matriz — sin esto, ninguna validación de
 * este repositorio cubre la escala que el usuario pidió explícitamente
 * ("sala industrial").
 */
function buildLargeIndustrialHallFixture(): IndustrialScaleFixture {
    const width = 24.0;
    const depth = 15.0;
    const height = 9.0;
    const workingPlaneHeight = 0;
    const marginalZone = 0.5;
    const room = buildRoom('scale-industrial-hall-large', width, depth, height, workingPlaneHeight, marginalZone, 150);

    const fixtures = buildGridFixtures({
        id: 'scale-industrial-hall-large',
        photometricWeb: GF19140_SUBSTITUTE_PHOTOMETRIC_WEB,
        brand: 'LTS (sustituto real)',
        articleNumber: 'GF19140-sustituto',
        lumensPerFixture: 20000,
        powerPerFixture: 180,
        columns: 4,
        rows: 3,
        marginX: 3.0,
        marginY: 2.5,
        width,
        depth,
        mountingHeight: height,
    });

    return {
        id: 'industrial-hall-large',
        label: 'Nave industrial grande 24.0x15.0 m (360 m²), techo 9.0 m, 12 luminarias en grilla 4x3',
        width,
        depth,
        height,
        workingPlaneHeight,
        marginalZone,
        reflectance: { ceiling: 0.5, wall: 0.3, floor: 0.2 },
        room,
        fixtures,
        // Mismo criterio que `warehouse-medium` pero más agresivo (360 m²):
        // 2.5 m de espaciado de oráculo ≈ 58 sensores.
        oracleSpacing: 2.5,
        variesFrom_previous: 'escala industrial máxima de esta matriz (360 m², techo 9 m, 12 luminarias)',
    };
}

/**
 * (d) Nave "abierta"/ambiente libre — misma bodega mediana en tamaño, pero
 * representando un ambiente SIN envolvente completa (ej. cobertizo, andén de
 * carga, estructura con uno o más lados abiertos al exterior). Limitación
 * IMPORTANTE, declarada: `buildRoomEnclosurePatches` (`roomPatches.ts`) hoy
 * solo acepta UNA reflectancia de pared para las 4 aristas del polígono —
 * no existe todavía una forma de declarar "esta arista específica está
 * abierta, no refleja". Este fixture aproxima un ambiente abierto bajando la
 * reflectancia de PARED a un valor casi nulo (0.05, equivalente a "el
 * exterior no devuelve luz reflejada de forma apreciable") en vez de omitir
 * esas aristas — una aproximación, no la solución correcta. Ver hallazgo
 * completo en `planes/plan_precision_fisica_motor_dialux_vs_evo.md` (gap de
 * reflectancia por-arista para ambientes libres).
 */
function buildOpenBayFixture(): IndustrialScaleFixture {
    const width = 12.0;
    const depth = 10.0;
    const height = 6.0;
    const workingPlaneHeight = 0;
    const marginalZone = 0.5;
    const room = buildRoom('scale-open-bay', width, depth, height, workingPlaneHeight, marginalZone, 150);

    const fixtures = buildGridFixtures({
        id: 'scale-open-bay',
        photometricWeb: GF19140_SUBSTITUTE_PHOTOMETRIC_WEB,
        brand: 'LTS (sustituto real)',
        articleNumber: 'GF19140-sustituto',
        lumensPerFixture: 12000,
        powerPerFixture: 120,
        columns: 3,
        rows: 2,
        marginX: 2.0,
        marginY: 2.5,
        width,
        depth,
        mountingHeight: height,
    });

    return {
        id: 'open-bay',
        label: 'Ambiente libre/abierto 12.0x10.0 m (120 m²), techo 6.0 m — aproximación de pared casi sin reflexión (0.05)',
        width,
        depth,
        height,
        workingPlaneHeight,
        marginalZone,
        reflectance: { ceiling: 0.5, wall: 0.05, floor: 0.2 },
        room,
        fixtures,
        oracleSpacing: 1.5,
        variesFrom_previous: 'misma escala que warehouse-medium, pero reflectancia de pared ~0 (aproximación de "sin envolvente")',
    };
}

export function buildAllIndustrialScaleFixtures(): IndustrialScaleFixture[] {
    return [buildSmallOfficeFixture(), buildMediumWarehouseFixture(), buildLargeIndustrialHallFixture(), buildOpenBayFixture()];
}
