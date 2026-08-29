/**
 * fixtureGridObstacles.ts — Grilla de luminarias consciente de obstaculos
 * estructurales (columnas/vigas/zonas restringidas).
 *
 * Separado de fixtureGrid.ts (que conserva el algoritmo clasico intacto,
 * sin obstaculos) para mantener cada archivo bajo el presupuesto de tamaño
 * del proyecto (`__architecture__/fileSizeBudget.test.ts`) y porque esta es
 * una responsabilidad propia: orquesta geometry/ceilingProjection.ts (resta
 * booleana + pole of inaccessibility) con el algoritmo de grilla centrada de
 * fixtureGrid.ts.
 */

import {
    computeValidInstallationZones,
    distributeCountAcrossZones,
    snapPointIntoZone,
    type ValidInstallationZone,
} from '../geometry/ceilingProjection';
import {
    calculateGuidedFixtureGridPositions,
    polygonBBox,
    suggestFixtureGridSize,
} from './fixtureGrid';
import type { Fixture, FixtureGridConfig, StructuralObstacle, Vertex } from './types';

/**
 * Misma formula de grilla centrada 1:2 que `calculateFixtureGridPositions`,
 * pero relativa al bbox de `zone.outer` y recentrada sobre el pole of
 * inaccessibility de la zona en vez del centroide/bbox del room completo --
 * necesario porque una zona con huecos (obstaculo rodeado de area valida)
 * puede tener su centroide geometrico cayendo justo sobre el hueco. Cada
 * punto se corrige con `snapPointIntoZone` (huecos y bordes del CSG).
 */
export function calculateFixtureGridPositionsInZone(
    zone: ValidInstallationZone,
    rows: number,
    columns: number,
): Vertex[] {
    const safeRows = Math.max(1, Math.round(rows));
    const safeCols = Math.max(1, Math.round(columns));
    const bbox = polygonBBox(zone.outer);
    const { width: L, height: W } = bbox;
    if (L <= 0 || W <= 0) return [];

    const marginX = L / (2 * safeCols);
    const spacingX = L / safeCols;
    const marginY = W / (2 * safeRows);
    const spacingY = W / safeRows;

    const bboxCenter = { x: bbox.minX + L / 2, y: bbox.minY + W / 2 };
    const shift = { x: zone.pole.x - bboxCenter.x, y: zone.pole.y - bboxCenter.y };

    const positions: Vertex[] = [];
    for (let i = 0; i < safeRows; i++) {
        for (let j = 0; j < safeCols; j++) {
            const raw = {
                x: bbox.minX + marginX + j * spacingX + shift.x,
                y: bbox.minY + marginY + i * spacingY + shift.y,
            };
            positions.push(snapPointIntoZone(raw, zone));
        }
    }
    return positions;
}

/**
 * Version de `calculateFixtureGridPositions` consciente de obstaculos: resta
 * los `obstacles` relevantes a `mountingHeight` del poligono del room y
 * reparte la grilla evitando las zonas bloqueadas.
 *
 * Camino rapido (equivalente al algoritmo clasico): si ningun obstaculo
 * bloquea el plano de montaje, o el resultado del CSG es una unica zona sin
 * huecos (el obstaculo no llego a afectar la geometria del room), se delega
 * a `calculateGuidedFixtureGridPositions` -- ningun proyecto sin obstaculos
 * cambia de comportamiento por esta feature. `rowGuides`/`columnGuides`
 * (lineas guia editables, ver `fixtureGrid.ts`) solo se aplican en este
 * camino rapido -- son una alternativa al obstaculo, no se componen con la
 * particion por zonas de mas abajo (limitacion conocida v1).
 *
 * Si el room queda partido en varias zonas o con huecos, la cantidad total
 * (`rows*columns`) se reparte proporcionalmente al area de cada zona
 * (`distributeCountAcrossZones`) y cada zona arma su propia sub-grilla con
 * la proporcion filas/columnas que mejor calza con su propio aspect ratio.
 */
export function calculateObstacleAwareFixtureGridPositions(
    roomVertices: Vertex[],
    obstacles: StructuralObstacle[],
    mountingHeight: number,
    rows: number,
    columns: number,
    rowGuides?: number[],
    columnGuides?: number[],
): Vertex[] {
    if (roomVertices.length < 3) return [];

    // Todo el cálculo se hace en un espacio local (restando el mínimo del
    // polígono) y las posiciones se trasladan de vuelta. Con planos
    // georreferenciados en UTM (coordenadas ~1e7) la resta booleana / pole of
    // inaccessibility de `computeValidInstallationZones` y la fórmula shoelace
    // de los centroides pierden precisión y esparcen las luminarias fuera del
    // área dibujada. En espacio local (dimensiones del ambiente, ~metros) el
    // cálculo es exacto. La distribución de luminarias es invariante a la
    // traslación.
    const ox = Math.min(...roomVertices.map((v) => v.x));
    const oy = Math.min(...roomVertices.map((v) => v.y));
    const localRoom = roomVertices.map((v) => ({ x: v.x - ox, y: v.y - oy }));
    const localObstacles = obstacles.map((o) => ({
        ...o,
        vertices: o.vertices.map((v) => ({ x: v.x - ox, y: v.y - oy })),
    }));

    return calculateObstacleAwareFixtureGridPositionsLocal(
        localRoom,
        localObstacles,
        mountingHeight,
        rows,
        columns,
        rowGuides,
        columnGuides,
    ).map((p) => ({ x: p.x + ox, y: p.y + oy }));
}

function calculateObstacleAwareFixtureGridPositionsLocal(
    roomVertices: Vertex[],
    obstacles: StructuralObstacle[],
    mountingHeight: number,
    rows: number,
    columns: number,
    rowGuides?: number[],
    columnGuides?: number[],
): Vertex[] {
    const safeRows = Math.max(1, Math.round(rows));
    const safeCols = Math.max(1, Math.round(columns));
    // Cubiertas, cielorrasos y rampas son superficies constructivas/rutas;
    // no son huecos prohibidos para la distribución de luminarias.
    obstacles = obstacles.filter((obstacle) =>
        obstacle.obstacleType === 'column'
        || obstacle.obstacleType === 'beam'
        || obstacle.obstacleType === 'restricted_area',
    );

    if (obstacles.length === 0) {
        return calculateGuidedFixtureGridPositions(roomVertices, safeRows, safeCols, rowGuides, columnGuides);
    }

    const zones = computeValidInstallationZones(roomVertices, obstacles, mountingHeight);
    if (zones.length === 0) return [];
    if (zones.length === 1 && zones[0].holes.length === 0) {
        return calculateGuidedFixtureGridPositions(roomVertices, safeRows, safeCols, rowGuides, columnGuides);
    }

    const totalCount = safeRows * safeCols;
    const counts = distributeCountAcrossZones(zones, totalCount);

    const positions: Vertex[] = [];
    zones.forEach((zone, index) => {
        const count = counts[index];
        if (count <= 0) return;
        const bbox = polygonBBox(zone.outer);
        const aspectRatio = bbox.height > 0 ? bbox.width / bbox.height : 1;
        const { rows: zoneRows, columns: zoneColumns } = suggestFixtureGridSize(1, 1, count, aspectRatio);
        positions.push(...calculateFixtureGridPositionsInZone(zone, zoneRows, zoneColumns));
    });
    return positions;
}

// ─── Generación de fixtures de grilla ────────────────────────────────────────

/**
 * Genera un array de objetos Fixture a partir de una configuración de grilla.
 * Los fixtures ya tienen posiciones calculadas; se les debe asignar IDs externos.
 */
export function buildFixtureGridObjects(
    config: FixtureGridConfig,
    roomVertices: Vertex[],
    generateId: () => string,
    /** Obstaculos del piso activo -- sin obstaculos, resultado identico al algoritmo clasico */
    obstacles: StructuralObstacle[] = [],
): Omit<Fixture, 'id'>[] {
    const z = config.mountingHeight ?? 2.7;
    const positions = calculateObstacleAwareFixtureGridPositions(
        roomVertices,
        obstacles,
        z,
        config.rows,
        config.columns,
        config.rowGuides,
        config.columnGuides,
    );

    const groupId = generateId(); // ID compartido del grupo de grilla
    const tmpl    = config.fixtureTemplate;

    return positions.map((pos, index) => ({
        ...tmpl,
        name: `${tmpl.name ?? `Luminaria G${config.rows}×${config.columns}`} [${index + 1}]`,
        x: pos.x,
        y: pos.y,
        z,
        lumens:       tmpl.lumens      ?? 4000,
        power:        tmpl.power,
        efficiency:   tmpl.efficiency  ?? 0.8,
        fixtureType:  tmpl.fixtureType ?? 'recessed',
        fixtureShape: tmpl.fixtureShape ?? 'rectangular',
        lightColor:   tmpl.lightColor  ?? '#fff5e1',
        brand:         tmpl.brand,
        articleNumber: tmpl.articleNumber,
        productId:     tmpl.productId,
        catalogSymbol: tmpl.catalogSymbol,
        emergencyType: tmpl.emergencyType,
        roomId:       config.roomId ?? undefined,
        gridGroupId:  groupId,
        gridRows:     config.rows,
        gridColumns:  config.columns,
    }));
}

// ─── Reorganizar un grupo de grilla ya existente ─────────────────────────────

/** Bbox (con margen minimo si es degenerado) de un grupo de luminarias ya colocadas. */
export function computeFixtureGroupAreaVertices(fixtures: Fixture[]): Vertex[] {
    const xs = fixtures.map((f) => f.x);
    const ys = fixtures.map((f) => f.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // Si todas comparten X o Y (una sola fila/columna hoy), el bbox tiene
    // ancho o alto 0 -- se le da un margen minimo para no dividir por cero.
    const padX = maxX > minX ? 0 : 0.5;
    const padY = maxY > minY ? 0 : 0.5;
    return [
        { x: minX - padX, y: minY - padY },
        { x: maxX + padX, y: minY - padY },
        { x: maxX + padX, y: maxY + padY },
        { x: minX - padX, y: maxY + padY },
    ];
}

/**
 * Recalcula (x,y) para un grupo de luminarias YA EXISTENTE, dentro del area
 * que hoy ocupa (su propio bbox), en una grilla `rows x columns` -- no crea
 * ni borra nada. Devuelve las posiciones en orden fila-por-fila (mismo orden
 * que `fixtures` debe tener, ver `sortFixturesRowMajor`) para que el
 * llamador las aplique preservando el id de cada fixture (conserva
 * cableado/circuitos ya asignados). `null` si `rows*columns` no calza con
 * `fixtures.length` (el llamador decide como avisar al usuario).
 */
export function reorganizeFixtureGroupPositions(
    fixtures: Fixture[],
    obstacles: StructuralObstacle[],
    rows: number,
    columns: number,
): Vertex[] | null {
    if (fixtures.length === 0) return null;
    const areaVertices = computeFixtureGroupAreaVertices(fixtures);
    const mountingHeight = fixtures[0].z ?? fixtures[0].mountingHeight ?? 2.7;
    const positions = calculateObstacleAwareFixtureGridPositions(
        areaVertices,
        obstacles,
        mountingHeight,
        rows,
        columns,
    );
    return positions.length === fixtures.length ? positions : null;
}

/** Orden fila-por-fila (y luego x) -- mismo criterio con el que se generan/reorganizan posiciones de grilla. */
export function sortFixturesRowMajor(fixtures: Fixture[]): Fixture[] {
    return [...fixtures].sort((a, b) => a.y - b.y || a.x - b.x);
}
