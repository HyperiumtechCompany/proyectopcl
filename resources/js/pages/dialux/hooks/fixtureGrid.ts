/**
 * fixtureGrid.ts — Utilidades puras para posicionamiento de luminarias
 *
 * Algoritmo de distribución centrada (ratio 1:2):
 *   Para C columnas en un largo L:
 *     margen = L / (2*C)
 *     separación = L / C
 *     foco(j) = minX + margen + j * separación   (j = 0..C-1)
 *
 *   Verificación:
 *     L=8m, C=2: margen=2m, sep=4m → posiciones: 2m, 6m
 *     Espacios: |--2--|--4--|--2--| ✓ (ratio 1:2:1)
 *
 *     L=4m, C=1: margen=2m → posición: 2m (centro) ✓
 *     L=8m, C=4: margen=1m, sep=2m → 1m, 3m, 5m, 7m ✓
 */

import type { Fixture, FixtureGridConfig, Vertex, Wall } from './types';

// ─── Cálculo de bounding box de un polígono ───────────────────────────────────

interface BBox {
    minX: number; minY: number;
    maxX: number; maxY: number;
    width: number; height: number;
}

export function polygonBBox(vertices: Vertex[]): BBox {
    if (vertices.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    const xs = vertices.map(v => v.x);
    const ys = vertices.map(v => v.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// ─── Posiciones de grilla centrada ────────────────────────────────────────────

/**
 * Calcula las posiciones de una grilla de luminarias centrada dentro de un room.
 *
 * El resultado es un array ordenado por fila (i) y columna (j):
 *   índice = i * columns + j
 *
 * @param roomVertices - Vértices del polígono del recinto (en metros)
 * @param rows         - Cantidad de filas ≥ 1
 * @param columns      - Cantidad de columnas ≥ 1
 * @returns            - Array de {x, y} en metros (coordenadas de escena)
 */
export function calculateFixtureGridPositions(
    roomVertices: Vertex[],
    rows: number,
    columns: number,
): Vertex[] {
    const safeRows    = Math.max(1, Math.round(rows));
    const safeCols    = Math.max(1, Math.round(columns));
    const bbox        = polygonBBox(roomVertices);

    const { width: L, height: W } = bbox;
    if (L <= 0 || W <= 0) return [];

    // ratio 1:2 → margen = dim / (2 * count), separación = dim / count
    const marginX = L / (2 * safeCols);
    const spacingX = L / safeCols;
    const marginY = W / (2 * safeRows);
    const spacingY = W / safeRows;

    const positions: Vertex[] = [];

    for (let i = 0; i < safeRows; i++) {
        for (let j = 0; j < safeCols; j++) {
            positions.push({
                x: bbox.minX + marginX + j * spacingX,
                y: bbox.minY + marginY + i * spacingY,
            });
        }
    }

    return positions;
}

// ─── Centrado de objetos sobre paredes ───────────────────────────────────────

/**
 * Longitud total de una pared (suma de segmentos).
 */
export function wallLength(wall: Wall): number {
    const verts = wall.vertices;
    if (verts.length < 2) return 0;
    let len = 0;
    for (let i = 1; i < verts.length; i++) {
        len += Math.hypot(
            verts[i].x - verts[i - 1].x,
            verts[i].y - verts[i - 1].y,
        );
    }
    return len;
}

/**
 * Calcula el offsetAlongWall que centra un objeto de ancho `objectWidth`
 * en el segmento de una pared de longitud `wallLen`.
 *
 * offset = (wallLen - objectWidth) / 2
 * Si el objeto es más ancho que la pared, retorna 0.
 */
export function calculateCenteredOffset(
    wallLen: number,
    objectWidth: number,
): number {
    if (wallLen <= 0 || objectWidth <= 0) return 0;
    return Math.max(0, (wallLen - objectWidth) / 2);
}

/**
 * Calcula el offsetAlongWall que centra un objeto en una pared del store.
 */
export function calculateCenteredOffsetOnWall(
    wall: Wall,
    objectWidth: number,
): number {
    return calculateCenteredOffset(wallLength(wall), objectWidth);
}

// ─── Sugerencia de tamaño de grilla según normativa ───────────────────────────

/**
 * Sugiere una grilla cuyo producto sea exactamente `requiredCount`. Entre las
 * parejas de factores posibles elige la que mejor reproduce la proporción
 * ancho/alto del ambiente. Esto también corrige grillas sobredimensionadas.
 */
export function suggestFixtureGridSize(
    currentRows: number,
    currentColumns: number,
    requiredCount: number,
    aspectRatio = 1,
): { rows: number; columns: number } {
    const current = {
        rows: Math.max(1, Math.round(currentRows)),
        columns: Math.max(1, Math.round(currentColumns)),
    };
    const count = Math.max(1, Math.ceil(requiredCount));
    const ratio = aspectRatio > 0 ? aspectRatio : 1;
    const candidates: Array<{ rows: number; columns: number }> = [];

    for (let rows = 1; rows <= Math.sqrt(count); rows += 1) {
        if (count % rows !== 0) continue;
        const columns = count / rows;
        candidates.push({ rows, columns });
        if (rows !== columns) candidates.push({ rows: columns, columns: rows });
    }

    return candidates.reduce((best, candidate) => {
        // La distancia logarítmica trata de forma simétrica, por ejemplo,
        // 1×2 y 2×1 cuando el recinto es cuadrado.
        const shapeError = Math.abs(Math.log((candidate.columns / candidate.rows) / ratio));
        const bestShapeError = Math.abs(Math.log((best.columns / best.rows) / ratio));
        if (shapeError !== bestShapeError) return shapeError < bestShapeError ? candidate : best;

        const movement = Math.abs(candidate.rows - current.rows) + Math.abs(candidate.columns - current.columns);
        const bestMovement = Math.abs(best.rows - current.rows) + Math.abs(best.columns - current.columns);
        return movement < bestMovement ? candidate : best;
    });
}

/**
 * Estima la cantidad necesaria a partir del resultado punto-a-punto vigente.
 * La iluminancia es lineal respecto de luminarias idénticas; la nueva grilla
 * debe recalcularse después porque sus posiciones también afectan Em y Uo.
 */
export function estimatePhotometricFixtureQuantity(
    currentCount: number,
    currentAverageLux: number,
    targetLux: number,
    lumenMethodQuantity: number,
): { exact: number; rounded: number } {
    const lumenFallback = Math.max(1, lumenMethodQuantity);
    if (currentCount <= 0 || currentAverageLux <= 0 || targetLux <= 0) {
        return { exact: lumenFallback, rounded: Math.ceil(lumenFallback) };
    }

    const exact = Math.max(lumenFallback, currentCount * targetLux / currentAverageLux);
    return { exact, rounded: Math.ceil(exact) };
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
): Omit<Fixture, 'id'>[] {
    const positions = calculateFixtureGridPositions(
        roomVertices,
        config.rows,
        config.columns,
    );

    const groupId = generateId(); // ID compartido del grupo de grilla
    const tmpl    = config.fixtureTemplate;
    const z       = config.mountingHeight ?? 2.7;

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
        fixtureShape: tmpl.fixtureShape ?? 'round',
        lightColor:   tmpl.lightColor  ?? '#fff5e1',
        brand:         tmpl.brand,
        articleNumber: tmpl.articleNumber,
        productId:     tmpl.productId,
        catalogSymbol: tmpl.catalogSymbol,
        emergencyType: tmpl.emergencyType,
        roomId:       config.roomId ?? undefined,
        gridGroupId:  groupId,
    }));
}
