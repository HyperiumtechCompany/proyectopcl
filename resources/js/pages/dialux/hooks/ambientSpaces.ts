import { polygonAreaM2 } from '@/pages/dialux/geometry/polygonGeometry';
import { getActivityOptions } from './roomLighting';
import type { Scene } from './types';
import type { Fixture, Room, Vertex, Wall } from './types';

// Logger condicional — silenciado en producción
const isDev =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { DEV?: boolean } }).env?.DEV;
const ambientLog = isDev
    ? console.log.bind(console, '[ambientSpaces]')
    : () => {};

export interface DerivedAmbientSpace {
    id: string;
    roomId: string;
    roomName: string;
    index: number;
    configKey: string;
    wallId?: string;
    name: string;
    activity: string | null;
    area: number;
    centroid: Vertex;
    room: Room;
    fixtures: Fixture[];
    sourceRoom: Room;
}

interface RasterCell {
    col: number;
    row: number;
}

interface RasterRegion {
    cells: RasterCell[];
    area: number;
    centroid: Vertex;
    vertices: Vertex[];
    touchesRoomBoundary: boolean;
}

const MIN_CELL_SIZE_METERS = 0.1;
const MAX_GRID_AXIS = 120;
const MIN_REGION_CELLS = 4;
const EPSILON = 1e-6;

function pointsAlmostEqual(a: Vertex, b: Vertex, tolerance = 0.05) {
    return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
}

function polygonCentroid(vertices: Vertex[]): Vertex {
    if (vertices.length === 0) return { x: 0, y: 0 };

    const uniqueVertices =
        vertices.length > 2 &&
        pointsAlmostEqual(vertices[0], vertices[vertices.length - 1])
            ? vertices.slice(0, -1)
            : vertices;

    if (uniqueVertices.length === 0) return { x: 0, y: 0 };

    const sum = uniqueVertices.reduce(
        (acc, vertex) => ({
            x: acc.x + vertex.x,
            y: acc.y + vertex.y,
        }),
        { x: 0, y: 0 },
    );

    return {
        x: sum.x / uniqueVertices.length,
        y: sum.y / uniqueVertices.length,
    };
}

function polygonBounds(vertices: Vertex[]) {
    return vertices.reduce(
        (acc, vertex) => ({
            minX: Math.min(acc.minX, vertex.x),
            minY: Math.min(acc.minY, vertex.y),
            maxX: Math.max(acc.maxX, vertex.x),
            maxY: Math.max(acc.maxY, vertex.y),
        }),
        {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
        },
    );
}

function polygonAreaCentroid(vertices: Vertex[]): Vertex | null {
    if (vertices.length < 3) return null;

    let signedArea = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < vertices.length; i++) {
        const current = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        const cross = current.x * next.y - next.x * current.y;
        signedArea += cross;
        cx += (current.x + next.x) * cross;
        cy += (current.y + next.y) * cross;
    }

    if (Math.abs(signedArea) < EPSILON) return null;

    return {
        x: cx / (3 * signedArea),
        y: cy / (3 * signedArea),
    };
}

/**
 * Encuentra el punto interior más alejado de todos los bordes del polígono
 * (polo de inaccessibilidad aproximado). Usa grilla 24×24 para polígonos
 * complejos o estrechos donde el centroide puede caer fuera del área.
 */
function findInteriorPoint(vertices: Vertex[]): Vertex {
    if (vertices.length === 0) return { x: 0, y: 0 };

    // Intentar candidatos rápidos primero
    const candidates: Vertex[] = [];
    const areaCentroid = polygonAreaCentroid(vertices);
    if (areaCentroid) candidates.push(areaCentroid);
    candidates.push(polygonCentroid(vertices));

    const bounds = polygonBounds(vertices);
    candidates.push({
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
    });

    for (const candidate of candidates) {
        if (pointInPolygon(candidate, vertices)) {
            return candidate;
        }
    }

    // Grilla de búsqueda más densa (24×24) para formas irregulares o estrechas
    // como corredores en L, habitaciones en U o polígonos cóncavos.
    const cols = 24;
    const rows = 24;
    const boundsW = bounds.maxX - bounds.minX;
    const boundsH = bounds.maxY - bounds.minY;
    let bestPoint: Vertex | null = null;
    let bestClearance = -Infinity;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const point: Vertex = {
                x: bounds.minX + ((col + 0.5) / cols) * boundsW,
                y: bounds.minY + ((row + 0.5) / rows) * boundsH,
            };

            if (!pointInPolygon(point, vertices)) continue;

            let minDistance = Infinity;
            for (let i = 0; i < vertices.length; i++) {
                const start = vertices[i];
                const end = vertices[(i + 1) % vertices.length];
                minDistance = Math.min(
                    minDistance,
                    distancePointToSegment(point, start, end),
                );
            }

            if (minDistance > bestClearance) {
                bestClearance = minDistance;
                bestPoint = point;
            }
        }
    }

    // Si encontramos un punto interior válido, devolverlo
    if (bestPoint !== null) return bestPoint;

    // Último recurso: primer vértice del polígono (garantizado en el borde)
    return vertices[0];
}

function closedWallPolygon(wall: Wall): Vertex[] | null {
    if (wall.vertices.length < 4) return null;

    const first = wall.vertices[0];
    const last = wall.vertices[wall.vertices.length - 1];
    if (!pointsAlmostEqual(first, last)) return null;

    const vertices = wall.vertices.slice(0, -1);
    if (vertices.length < 3) return null;

    return vertices;
}

function polygonArea(vertices: Vertex[]) {
    return polygonAreaM2(vertices);
}

export function pointInPolygon(point: Vertex, vertices: Vertex[]): boolean {
    let inside = false;
    let j = vertices.length - 1;

    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[j];

        if (
            a.y > point.y !== b.y > point.y &&
            point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
        ) {
            inside = !inside;
        }

        j = i;
    }

    return inside;
}

function distancePointToSegment(point: Vertex, start: Vertex, end: Vertex) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len2 = dx * dx + dy * dy;

    if (len2 < EPSILON) {
        return Math.hypot(point.x - start.x, point.y - start.y);
    }

    const t = Math.max(
        0,
        Math.min(
            1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2,
        ),
    );

    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
}

function simplifyVertices(vertices: Vertex[]): Vertex[] {
    if (vertices.length < 3) return vertices;

    const simplified: Vertex[] = [];

    for (let i = 0; i < vertices.length; i++) {
        const prev = vertices[(i - 1 + vertices.length) % vertices.length];
        const curr = vertices[i];
        const next = vertices[(i + 1) % vertices.length];

        const cross =
            (curr.x - prev.x) * (next.y - curr.y) -
            (curr.y - prev.y) * (next.x - curr.x);

        if (Math.abs(cross) > EPSILON) {
            simplified.push(curr);
        }
    }

    return simplified.length >= 3 ? simplified : vertices;
}

/**
 * Construye el polígono contorno a partir de las celdas de la región raster.
 *
 * Problema conocido: cuando las celdas forman una figura con "estrechamientos"
 * (p. ej. dos rectángulos unidos por un solo vértice diagonal), el algoritmo
 * de media-bordes puede generar una cadena no cerrada. En ese caso se detecta
 * el problema y se retorna [] para que el caller use el fallback de bounds.
 */
function buildRegionPolygon(
    cells: RasterCell[],
    originX: number,
    originY: number,
    cellSize: number,
): Vertex[] {
    const occupied = new Set(cells.map((cell) => `${cell.col},${cell.row}`));
    const nextByStart = new Map<string, Vertex>();

    // Registrar cada arista exterior exactamente una vez.
    // Si una arista aparece desde ambos lados (colindante con otra celda en
    // la misma dirección) se cancela → la arista de frontera real sobrevive.
    const edgeCount = new Map<string, number>();
    const edgeTarget = new Map<string, Vertex>();

    const hasCell = (col: number, row: number) => occupied.has(`${col},${row}`);

    cells.forEach(({ col, row }) => {
        const x0 = originX + col * cellSize;
        const y0 = originY + row * cellSize;
        const x1 = x0 + cellSize;
        const y1 = y0 + cellSize;

        const addEdge = (sx: number, sy: number, ex: number, ey: number) => {
            const key = `${sx},${sy}`;
            edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
            edgeTarget.set(key, { x: ex, y: ey });
        };

        if (!hasCell(col, row + 1)) addEdge(x0, y0, x1, y0);
        if (!hasCell(col + 1, row)) addEdge(x1, y0, x1, y1);
        if (!hasCell(col, row - 1)) addEdge(x1, y1, x0, y1);
        if (!hasCell(col - 1, row)) addEdge(x0, y1, x0, y0);
    });

    // Construir el mapa de adyacencia solo con las aristas exteriores (count===1)
    edgeCount.forEach((count, key) => {
        if (count === 1) {
            const target = edgeTarget.get(key);
            if (target) nextByStart.set(key, target);
        }
    });

    const firstKey = nextByStart.keys().next().value as string | undefined;
    if (!firstKey) return [];

    const vertices: Vertex[] = [];
    let cursorKey = firstKey;
    const visited = new Set<string>();
    const maxSteps = nextByStart.size + 1; // salvaguarda anti-loop infinito

    while (!visited.has(cursorKey) && vertices.length <= maxSteps) {
        visited.add(cursorKey);
        const [x, y] = cursorKey.split(',').map(Number);
        vertices.push({ x, y });

        const next = nextByStart.get(cursorKey);
        if (!next) {
            // Cadena no cerrada → la geometría de la región es degenerada.
            // Retornar [] para que buildRasterRegions use el fallback de bounds.
            ambientLog(
                `buildRegionPolygon: open chain detected after ${vertices.length} verts (cells=${cells.length})`,
            );
            return [];
        }
        cursorKey = `${next.x},${next.y}`;
    }

    // Verificar que el polígono tiene al menos 3 vértices no colineales
    const simplified = simplifyVertices(vertices);
    if (simplified.length < 3) {
        ambientLog(
            `buildRegionPolygon: degenerate polygon (${simplified.length} verts after simplify)`,
        );
        return [];
    }

    return simplified;
}

function collectWallSegments(room: Room, walls: Wall[]) {
    const bbox = room.vertices.reduce(
        (acc, vertex) => ({
            minX: Math.min(acc.minX, vertex.x),
            minY: Math.min(acc.minY, vertex.y),
            maxX: Math.max(acc.maxX, vertex.x),
            maxY: Math.max(acc.maxY, vertex.y),
        }),
        {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
        },
    );

    return walls.flatMap((wall) => {
        const segments: Array<{
            start: Vertex;
            end: Vertex;
            thickness: number;
        }> = [];

        for (let i = 1; i < wall.vertices.length; i++) {
            const start = wall.vertices[i - 1];
            const end = wall.vertices[i];

            const segMinX = Math.min(start.x, end.x);
            const segMinY = Math.min(start.y, end.y);
            const segMaxX = Math.max(start.x, end.x);
            const segMaxY = Math.max(start.y, end.y);

            if (
                segMaxX < bbox.minX - wall.thickness ||
                segMinX > bbox.maxX + wall.thickness ||
                segMaxY < bbox.minY - wall.thickness ||
                segMinY > bbox.maxY + wall.thickness
            ) {
                continue;
            }

            const startInside = pointInPolygon(start, room.vertices);
            const endInside = pointInPolygon(end, room.vertices);
            const midpoint = {
                x: (start.x + end.x) / 2,
                y: (start.y + end.y) / 2,
            };

            if (
                startInside ||
                endInside ||
                pointInPolygon(midpoint, room.vertices)
            ) {
                segments.push({
                    start,
                    end,
                    thickness: wall.thickness,
                });
            }
        }

        return segments;
    });
}

function buildRasterRegions(room: Room, walls: Wall[]): RasterRegion[] {
    if (room.vertices.length < 3) return [];

    const bounds = room.vertices.reduce(
        (acc, vertex) => ({
            minX: Math.min(acc.minX, vertex.x),
            minY: Math.min(acc.minY, vertex.y),
            maxX: Math.max(acc.maxX, vertex.x),
            maxY: Math.max(acc.maxY, vertex.y),
        }),
        {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
        },
    );

    const width = Math.max(bounds.maxX - bounds.minX, MIN_CELL_SIZE_METERS);
    const height = Math.max(bounds.maxY - bounds.minY, MIN_CELL_SIZE_METERS);
    const maxDim = Math.max(width, height);
    const cellSize = Math.max(MIN_CELL_SIZE_METERS, maxDim / MAX_GRID_AXIS);
    const cols = Math.max(1, Math.ceil(width / cellSize));
    const rows = Math.max(1, Math.ceil(height / cellSize));
    const wallSegments = collectWallSegments(room, walls);
    const free = Array.from({ length: rows }, () => Array(cols).fill(false));
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const center = {
                x: bounds.minX + (col + 0.5) * cellSize,
                y: bounds.minY + (row + 0.5) * cellSize,
            };

            if (!pointInPolygon(center, room.vertices)) continue;

            const blocked = wallSegments.some((segment) => {
                const clearance =
                    Math.max(segment.thickness / 2, cellSize * 0.5) + EPSILON;
                return (
                    distancePointToSegment(
                        center,
                        segment.start,
                        segment.end,
                    ) <= clearance
                );
            });

            free[row][col] = !blocked;
        }
    }

    const regions: RasterRegion[] = [];
    const directions = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ];

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (!free[row][col] || visited[row][col]) continue;

            const queue: RasterCell[] = [{ col, row }];
            const cells: RasterCell[] = [];
            let touchesRoomBoundary = false;
            visited[row][col] = true;

            while (queue.length > 0) {
                const current = queue.shift() as RasterCell;
                cells.push(current);

                const center = {
                    x: bounds.minX + (current.col + 0.5) * cellSize,
                    y: bounds.minY + (current.row + 0.5) * cellSize,
                };
                const nearRoomBoundary = room.vertices.some((vertex, index) => {
                    const next =
                        room.vertices[(index + 1) % room.vertices.length];
                    return (
                        distancePointToSegment(center, vertex, next) <=
                        cellSize * 1.15 + EPSILON
                    );
                });

                if (
                    current.col === 0 ||
                    current.row === 0 ||
                    current.col === cols - 1 ||
                    current.row === rows - 1 ||
                    nearRoomBoundary
                ) {
                    touchesRoomBoundary = true;
                }

                directions.forEach(([dc, dr]) => {
                    const nextCol = current.col + dc;
                    const nextRow = current.row + dr;

                    if (
                        nextCol < 0 ||
                        nextRow < 0 ||
                        nextCol >= cols ||
                        nextRow >= rows ||
                        visited[nextRow][nextCol] ||
                        !free[nextRow][nextCol]
                    ) {
                        return;
                    }

                    visited[nextRow][nextCol] = true;
                    queue.push({ col: nextCol, row: nextRow });
                });
            }

            if (cells.length < MIN_REGION_CELLS) continue;

            const area = cells.length * cellSize * cellSize;
            const centroid = cells.reduce(
                (acc, cell) => ({
                    x: acc.x + bounds.minX + (cell.col + 0.5) * cellSize,
                    y: acc.y + bounds.minY + (cell.row + 0.5) * cellSize,
                }),
                { x: 0, y: 0 },
            );

            const vertices = buildRegionPolygon(
                cells,
                bounds.minX,
                bounds.minY,
                cellSize,
            );

            if (vertices.length < 3) continue;

            regions.push({
                cells,
                area,
                centroid: {
                    x: centroid.x / cells.length,
                    y: centroid.y / cells.length,
                },
                vertices,
                touchesRoomBoundary,
            });
        }
    }

    return regions.sort((a, b) => b.area - a.area);
}

function fixturesForAmbient(
    ambientRoom: Room,
    centroid: Vertex,
    fixtures: Fixture[],
): Fixture[] {
    const inside = fixtures.filter((fixture) =>
        pointInPolygon({ x: fixture.x, y: fixture.y }, ambientRoom.vertices),
    );

    if (inside.length === 1) {
        return [
            {
                ...inside[0],
                x: centroid.x,
                y: centroid.y,
                roomId: ambientRoom.id,
            },
        ];
    }

    if (inside.length > 1) {
        return inside.map((fixture) => ({
            ...fixture,
            roomId: ambientRoom.id,
        }));
    }

    return [];
}

function buildSingleAmbientSpace(
    room: Room,
    fixtures: Fixture[],
    options?: {
        id?: string;
        roomId?: string;
        roomName?: string;
        sourceRoom?: Room;
    },
): DerivedAmbientSpace {
    const ambientConfig = room.ambientConfigs?.['ambient-1'];
    const activity =
        ambientConfig?.activity ?? room.normativeActivity ?? undefined;
    const activityOption = activity
        ? (getActivityOptions(
              room.normativeStandard ?? 'en_12464',
              room.normativeCategory,
              room.normativeSection,
          ).find((option) => option.activity === activity) ?? null)
        : null;
    const singleAmbientRoom: Room = {
        ...room,
        id: options?.id ?? `${room.id}::ambient-1`,
        name: ambientConfig?.name?.trim() || room.name,
        normativeActivity: activity,
        normativeLabel: activityOption?.label ?? room.normativeLabel,
        illuminanceLux: activityOption?.illuminanceLux ?? room.illuminanceLux,
        norma: activityOption?.illuminanceLux ?? room.norma,
        ugrLimit: activityOption?.ugr ?? room.ugrLimit,
        uniformityTarget: activityOption?.uniformity ?? room.uniformityTarget,
        colorRenderingRa: activityOption?.ra ?? room.colorRenderingRa,
        specificRequirements:
            activityOption?.specificRequirements ?? room.specificRequirements,
    };
    const centroid = findInteriorPoint(room.vertices);
    const baseFixtures = fixtures.filter((fixture) =>
        pointInPolygon({ x: fixture.x, y: fixture.y }, room.vertices),
    );

    return {
        id: singleAmbientRoom.id,
        roomId: options?.roomId ?? room.id,
        roomName: options?.roomName ?? room.name,
        index: 1,
        configKey: 'ambient-1',
        wallId: undefined,
        name: singleAmbientRoom.name,
        activity: activity ?? null,
        area: polygonArea(room.vertices),
        centroid,
        room: singleAmbientRoom,
        fixtures: fixturesForAmbient(singleAmbientRoom, centroid, baseFixtures),
        sourceRoom: options?.sourceRoom ?? room,
    };
}

function buildWallDefinedAmbientSpaces(
    room: Room,
    walls: Wall[],
    fixtures: Fixture[],
): DerivedAmbientSpace[] {
    if (room.roomType === 'corridor') {
        return [];
    }

    const closedWallAmbients = walls
        .map((wall) => {
            const vertices = closedWallPolygon(wall);
            if (!vertices) return null;

            const centroid = findInteriorPoint(vertices);
            if (!pointInPolygon(centroid, room.vertices)) return null;

            return {
                wall,
                vertices,
                centroid,
                area: polygonArea(vertices),
            };
        })
        .filter(
            (
                ambient,
            ): ambient is {
                wall: Wall;
                vertices: Vertex[];
                centroid: Vertex;
                area: number;
            } => !!ambient && ambient.area > EPSILON,
        )
        .sort((a, b) => b.area - a.area);

    if (closedWallAmbients.length === 0) return [];

    return closedWallAmbients.map((ambient, index) => {
        const configKey = `ambient-${index + 1}`;
        const ambientConfig = room.ambientConfigs?.[configKey];
        const activity =
            ambientConfig?.activity ?? room.normativeActivity ?? undefined;
        const activityOption = activity
            ? (getActivityOptions(
                  room.normativeStandard ?? 'en_12464',
                  room.normativeCategory,
                  room.normativeSection,
              ).find((option) => option.activity === activity) ?? null)
            : null;
        const ambientRoom: Room = {
            ...room,
            id: `${room.id}::ambient-${index + 1}`,
            name:
                ambientConfig?.name?.trim() ||
                activity ||
                `${room.name} - Ambiente ${index + 1}`,
            vertices: ambient.vertices,
            normativeActivity: activity,
            normativeLabel: activityOption?.label ?? room.normativeLabel,
            illuminanceLux:
                activityOption?.illuminanceLux ?? room.illuminanceLux,
            norma: activityOption?.illuminanceLux ?? room.norma,
            ugrLimit: activityOption?.ugr ?? room.ugrLimit,
            uniformityTarget:
                activityOption?.uniformity ?? room.uniformityTarget,
            colorRenderingRa: activityOption?.ra ?? room.colorRenderingRa,
            specificRequirements:
                activityOption?.specificRequirements ??
                room.specificRequirements,
        };

        const fixturesInsideRoom = fixtures.filter((fixture) =>
            pointInPolygon({ x: fixture.x, y: fixture.y }, ambient.vertices),
        );

        return {
            id: ambientRoom.id,
            roomId: room.id,
            roomName: room.name,
            index: index + 1,
            configKey,
            wallId: ambient.wall.id,
            name: ambientRoom.name,
            activity: activity ?? null,
            area: ambient.area,
            centroid: ambient.centroid,
            room: ambientRoom,
            fixtures: fixturesForAmbient(
                ambientRoom,
                ambient.centroid,
                fixturesInsideRoom,
            ),
            sourceRoom: room,
        };
    });
}

export function deriveAmbientSpaces(
    room: Room,
    walls: Wall[],
    fixtures: Fixture[],
): DerivedAmbientSpace[] {
    if (room.roomType === 'corridor') {
        return [buildSingleAmbientSpace(room, fixtures)];
    }

    const wallDefinedAmbients = buildWallDefinedAmbientSpaces(
        room,
        walls,
        fixtures,
    );
    if (wallDefinedAmbients.length > 0) {
        return wallDefinedAmbients;
    }

    const rawRegions = buildRasterRegions(room, walls);
    const regions = rawRegions.filter((region) => !region.touchesRoomBoundary);

    if (regions.length <= 1) {
        const ambientConfig = room.ambientConfigs?.['ambient-1'];
        const activity =
            ambientConfig?.activity ?? room.normativeActivity ?? undefined;
        const activityOption = activity
            ? (getActivityOptions(
                  room.normativeStandard ?? 'en_12464',
                  room.normativeCategory,
                  room.normativeSection,
              ).find((option) => option.activity === activity) ?? null)
            : null;
        const singleAmbientRoom: Room = {
            ...room,
            id: `${room.id}::ambient-1`,
            name: ambientConfig?.name?.trim() || room.name,
            normativeActivity: activity,
            normativeLabel: activityOption?.label ?? room.normativeLabel,
            illuminanceLux:
                activityOption?.illuminanceLux ?? room.illuminanceLux,
            norma: activityOption?.illuminanceLux ?? room.norma,
            ugrLimit: activityOption?.ugr ?? room.ugrLimit,
            uniformityTarget:
                activityOption?.uniformity ?? room.uniformityTarget,
            colorRenderingRa: activityOption?.ra ?? room.colorRenderingRa,
            specificRequirements:
                activityOption?.specificRequirements ??
                room.specificRequirements,
        };
        const centroid =
            regions[0]?.centroid ?? findInteriorPoint(room.vertices);

        const baseFixtures = fixtures.filter((fixture) =>
            pointInPolygon({ x: fixture.x, y: fixture.y }, room.vertices),
        );

        return [
            {
                id: singleAmbientRoom.id,
                roomId: room.id,
                roomName: room.name,
                index: 1,
                configKey: 'ambient-1',
                wallId: undefined,
                name: singleAmbientRoom.name,
                activity: activity ?? null,
                area: regions[0]?.area ?? polygonArea(room.vertices),
                centroid,
                room: singleAmbientRoom,
                fixtures: fixturesForAmbient(
                    singleAmbientRoom,
                    centroid,
                    baseFixtures,
                ),
                sourceRoom: room,
            },
        ];
    }

    return regions.map((region, index) => {
        const configKey = `ambient-${index + 1}`;
        const ambientConfig = room.ambientConfigs?.[configKey];
        const activity =
            ambientConfig?.activity ?? room.normativeActivity ?? undefined;
        const activityOption = activity
            ? (getActivityOptions(
                  room.normativeStandard ?? 'en_12464',
                  room.normativeCategory,
                  room.normativeSection,
              ).find((option) => option.activity === activity) ?? null)
            : null;
        const ambientRoom: Room = {
            ...room,
            id: `${room.id}::ambient-${index + 1}`,
            name:
                ambientConfig?.name?.trim() ||
                activity ||
                `${room.name} - Ambiente ${index + 1}`,
            vertices: region.vertices,
            normativeActivity: activity,
            normativeLabel: activityOption?.label ?? room.normativeLabel,
            illuminanceLux:
                activityOption?.illuminanceLux ?? room.illuminanceLux,
            norma: activityOption?.illuminanceLux ?? room.norma,
            ugrLimit: activityOption?.ugr ?? room.ugrLimit,
            uniformityTarget:
                activityOption?.uniformity ?? room.uniformityTarget,
            colorRenderingRa: activityOption?.ra ?? room.colorRenderingRa,
            specificRequirements:
                activityOption?.specificRequirements ??
                room.specificRequirements,
        };

        return {
            id: ambientRoom.id,
            roomId: room.id,
            roomName: room.name,
            index: index + 1,
            configKey,
            wallId: undefined,
            name: ambientRoom.name,
            activity: activity ?? null,
            area: region.area,
            centroid: region.centroid,
            room: ambientRoom,
            fixtures: fixturesForAmbient(
                ambientRoom,
                region.centroid,
                fixtures,
            ),
            sourceRoom: room,
        };
    });
}

export function deriveSceneAmbientSpaces(scene: Scene): DerivedAmbientSpace[] {
    const regularRooms = scene.rooms.filter(
        (room) => room.roomType !== 'corridor',
    );
    const corridorRooms = scene.rooms.filter(
        (room) => room.roomType === 'corridor',
    );
    const containedCorridorIds = new Set<string>();
    const ambients: DerivedAmbientSpace[] = [];

    regularRooms.forEach((room) => {
        const roomAmbients = deriveAmbientSpaces(
            room,
            scene.walls,
            scene.fixtures,
        );
        const corridorAmbients = corridorRooms
            .filter((corridor) => {
                const centroid = findInteriorPoint(corridor.vertices);
                const isContained = pointInPolygon(centroid, room.vertices);

                if (isContained) {
                    containedCorridorIds.add(corridor.id);
                }

                return isContained;
            })
            .map((corridor, index) => {
                const ambient = buildSingleAmbientSpace(
                    corridor,
                    scene.fixtures,
                    {
                        id: `${room.id}::${corridor.id}::ambient-1`,
                        roomId: room.id,
                        roomName: room.name,
                        sourceRoom: corridor,
                    },
                );

                return {
                    ...ambient,
                    index: roomAmbients.length + index + 1,
                };
            });

        ambients.push(...roomAmbients, ...corridorAmbients);
    });

    corridorRooms
        .filter((corridor) => !containedCorridorIds.has(corridor.id))
        .forEach((corridor) => {
            ambients.push(
                ...deriveAmbientSpaces(corridor, scene.walls, scene.fixtures),
            );
        });

    return ambients;
}

export function findAmbientSpaceAtPoint(
    scene: Scene,
    point: Vertex,
): DerivedAmbientSpace | null {
    const ambients = deriveSceneAmbientSpaces(scene);
    const containingAmbients = ambients.filter((ambient) => {
        if (pointInPolygon(point, ambient.room.vertices)) return true;
        // Permitir que luminarias/interruptores colocados sobre la pared interna 
        // pertenezcan al ambiente adyacente (tolerancia de 10cm)
        for (let i = 0; i < ambient.room.vertices.length; i++) {
            const a = ambient.room.vertices[i];
            const b = ambient.room.vertices[(i + 1) % ambient.room.vertices.length];
            if (distancePointToSegment(point, a, b) <= 0.1) {
                return true;
            }
        }
        return false;
    });

    if (containingAmbients.length === 0) {
        return null;
    }

    return (
        containingAmbients.find(
            (ambient) => ambient.sourceRoom.roomType === 'corridor',
        ) ?? containingAmbients[0]
    );
}
