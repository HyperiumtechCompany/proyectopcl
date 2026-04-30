import {
    getRoomMarginalZone,
    getRoomUsefulPlaneHeight,
} from './roomLighting';
import type { Fixture, LightingResult, Room } from './useEditorStore';

const GRID_SPACING = 0.5;
const MATH_PI = Math.PI;

interface GridPoint {
    x: number;
    y: number;
    z: number;
    active: boolean;
}

function roomBBox(room: Room) {
    if (room.vertices.length === 0) {
        return {
            minX: 0,
            minY: 0,
            width: 0,
            length: 0,
            cx: 0,
            cy: 0,
        };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const vertex of room.vertices) {
        minX = Math.min(minX, vertex.x);
        minY = Math.min(minY, vertex.y);
        maxX = Math.max(maxX, vertex.x);
        maxY = Math.max(maxY, vertex.y);
    }

    return {
        minX,
        minY,
        width: maxX - minX,
        length: maxY - minY,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
    };
}

function pointInPolygon(
    px: number,
    py: number,
    vertices: Array<{ x: number; y: number }>,
): boolean {
    let inside = false;
    let j = vertices.length - 1;

    for (let i = 0; i < vertices.length; i++) {
        const vi = vertices[i];
        const vj = vertices[j];

        if (
            (vi.y > py) !== (vj.y > py) &&
            px < ((vj.x - vi.x) * (py - vi.y)) / (vj.y - vi.y) + vi.x
        ) {
            inside = !inside;
        }

        j = i;
    }

    return inside;
}

function buildGrid(room: Room, spacing: number, wpHeight: number) {
    const { minX, minY, width, length } = roomBBox(room);

    if (width < 0.01 || length < 0.01) {
        return {
            points: [] as GridPoint[],
            rows: 0,
            cols: 0,
            minX,
            minY,
            cellW: 0,
            cellH: 0,
        };
    }

    const points: GridPoint[] = [];
    const cols = Math.max(1, Math.floor(width / spacing));
    const rows = Math.max(1, Math.floor(length / spacing));
    const cellW = width / cols;
    const cellH = length / rows;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const px = minX + (col + 0.5) * cellW;
            const py = minY + (row + 0.5) * cellH;
            const active =
                room.vertices.length < 3 || pointInPolygon(px, py, room.vertices);

            points.push({ x: px, y: py, z: wpHeight, active });
        }
    }

    return { points, rows, cols, minX, minY, cellW, cellH };
}

function candela(fixture: Fixture, thetaDeg: number): number {
    const intensity = (fixture.lumens * fixture.efficiency) / MATH_PI;
    const thetaRad = (thetaDeg * MATH_PI) / 180;

    return intensity * Math.cos(thetaRad);
}

function illuminanceFromFixture(point: GridPoint, fixture: Fixture): number {
    const dx = point.x - fixture.x;
    const dy = point.y - fixture.y;
    const dz = point.z - fixture.z;
    const dist2 = dx * dx + dy * dy + dz * dz;

    if (dist2 < 1e-6) {
        return 0;
    }

    const dist = Math.sqrt(dist2);
    const cosIncident = Math.max(0, -dz / dist);

    if (cosIncident <= 0) {
        return 0;
    }

    const thetaDeg = (Math.acos(-dz / dist) * 180) / MATH_PI;

    return (candela(fixture, thetaDeg) * cosIncident) / dist2;
}

function calculatePointByPoint(
    points: GridPoint[],
    fixtures: Fixture[],
): Array<number | null> {
    return points.map((point) =>
        point.active
            ? fixtures.reduce(
                  (sum, fixture) => sum + illuminanceFromFixture(point, fixture),
                  0,
              )
            : null,
    );
}

function calculateUGR(
    cx: number,
    cy: number,
    fixtures: Fixture[],
    lb: number,
    wpHeight: number,
): number {
    let sum = 0;

    for (const fixture of fixtures) {
        const dx = fixture.x - cx;
        const dy = fixture.y - cy;
        const dz = fixture.z - wpHeight;
        const dist2 = dx * dx + dy * dy + dz * dz;

        if (dist2 < 0.01) {
            continue;
        }

        const area = 0.1;
        const luminance = candela(fixture, 0) / area;
        sum += luminance * luminance * (area / dist2);
    }

    if (sum <= 0 || lb <= 0) {
        return 0;
    }

    return 8 * Math.log10((0.25 / lb) * sum);
}

export function calculateLightingResult(
    room: Room,
    fixtures: Fixture[],
): LightingResult {
    const bbox = roomBBox(room);
    const usefulPlaneHeight = getRoomUsefulPlaneHeight(room);
    const marginalZone = getRoomMarginalZone(room);
    const enriched = fixtures.map((fixture) => ({
        ...fixture,
        z: fixture.z > 0 ? fixture.z : room.height - 0.1,
    }));
    const grid = buildGrid(room, GRID_SPACING, usefulPlaneHeight);
    const values = calculatePointByPoint(grid.points, enriched);
    const activeValues = values.filter((value): value is number => value !== null);
    const baseResult = {
        grid_rows: grid.rows,
        grid_cols: grid.cols,
        grid_values: values,
        grid_active: grid.points.map((point) => point.active),
        grid_origin_x: grid.minX,
        grid_origin_y: grid.minY,
        grid_cell_width: grid.cellW,
        grid_cell_height: grid.cellH,
        room_vertices: room.vertices,
        useful_plane_height: usefulPlaneHeight,
        marginal_zone: marginalZone,
    };

    if (activeValues.length === 0) {
        return {
            avg_lux: 0,
            min_lux: 0,
            max_lux: 0,
            uniformity: 0,
            ugr: 0,
            ...baseResult,
        };
    }

    const sum = activeValues.reduce((left, right) => left + right, 0);
    const avg = sum / activeValues.length;
    const min = Math.min(...activeValues);
    const max = Math.max(...activeValues);
    const uniformity = avg > 0 ? min / avg : 0;
    const lb = avg / MATH_PI;
    const ugr = calculateUGR(bbox.cx, bbox.cy, enriched, lb, usefulPlaneHeight);

    return {
        avg_lux: avg,
        min_lux: min,
        max_lux: max,
        uniformity,
        ugr: Math.max(0, ugr),
        ...baseResult,
    };
}
