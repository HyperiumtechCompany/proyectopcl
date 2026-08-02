import { getRoomMarginalZone, getRoomUsefulPlaneHeight } from './roomLighting';
import type { Fixture, LightingResult, Room } from './useEditorStore';

/**
 * Identificador del ÚNICO motor que calcula avg/min/max/uniformity/UGR punto a
 * punto para un ambiente (Fase 0, planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md).
 * Alcance: solo luz directa, sin oclusión ni interreflexión, malla fija (`GRID_SPACING`).
 * No incrementar sin actualizar los goldens en `hooks/__fixtures__/`.
 */
export const LIGHTING_ENGINE_VERSION = 'direct-preview-v1';

/** Espaciado de malla en metros — exportado para no duplicarlo en `domain/calculation/types.ts`. */
export const GRID_SPACING = 0.5;
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
            vi.y > py !== vj.y > py &&
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
                room.vertices.length < 3 ||
                pointInPolygon(px, py, room.vertices);

            points.push({ x: px, y: py, z: wpHeight, active });
        }
    }

    return { points, rows, cols, minX, minY, cellW, cellH };
}

/** Interpola linealmente `values` (definidos en `points`, ascendentes) en `target`, con clamp en los extremos. */
function interpolate1D(values: number[], points: number[], target: number): number {
    if (points.length === 0) {
        return 0;
    }
    if (points.length === 1) {
        return values[0] ?? 0;
    }
    if (target <= points[0]) {
        return values[0];
    }
    if (target >= points[points.length - 1]) {
        return values[values.length - 1];
    }

    for (let i = 0; i < points.length - 1; i++) {
        if (target >= points[i] && target <= points[i + 1]) {
            const span = points[i + 1] - points[i];
            const t = span > 0 ? (target - points[i]) / span : 0;
            return values[i] + (values[i + 1] - values[i]) * t;
        }
    }

    return values[values.length - 1];
}

/**
 * Repliega un azimut arbitrario [0,360) al rango de C-planos disponible en el archivo IES/LDT
 * (los fabricantes suelen publicar solo un cuarto o una mitad de la solución fotométrica
 * cuando la luminaria es simétrica).
 */
function foldAzimuthToCRange(azimuthDeg: number, maxC: number): number {
    let a = azimuthDeg % 360;
    if (a < 0) {
        a += 360;
    }

    if (maxC <= 90.01) {
        a %= 180;
        if (a > 90) {
            a = 180 - a;
        }
        return Math.min(a, maxC);
    }

    if (maxC <= 180.01) {
        if (a > 180) {
            a = 360 - a;
        }
        return Math.min(a, maxC);
    }

    return a;
}

/** Candela real interpolada bilinealmente desde la matriz fotométrica (C-plano x gamma). */
function candelaFromPhotometricWeb(
    web: NonNullable<Fixture['photometricWeb']>,
    azimuthDeg: number,
    gammaDeg: number,
): number {
    const { c_angles: cAngles, gamma_angles: gammaAngles, candela: matrix } = web;

    if (
        !cAngles?.length ||
        !gammaAngles?.length ||
        !matrix?.length ||
        !matrix[0]?.length
    ) {
        return 0;
    }

    const maxC = cAngles[cAngles.length - 1];
    const foldedC = foldAzimuthToCRange(azimuthDeg, maxC);
    const clampedGamma = Math.min(
        Math.max(gammaDeg, gammaAngles[0]),
        gammaAngles[gammaAngles.length - 1],
    );

    let loIdx = 0;
    let hiIdx = cAngles.length - 1;
    for (let i = 0; i < cAngles.length; i++) {
        if (cAngles[i] <= foldedC) {
            loIdx = i;
        }
        if (cAngles[i] >= foldedC) {
            hiIdx = i;
            break;
        }
    }
    if (hiIdx < loIdx) {
        hiIdx = loIdx;
    }

    const loVal = interpolate1D(matrix[loIdx] ?? matrix[0], gammaAngles, clampedGamma);
    const hiVal = interpolate1D(matrix[hiIdx] ?? matrix[loIdx], gammaAngles, clampedGamma);

    if (hiIdx === loIdx) {
        return loVal;
    }

    const span = cAngles[hiIdx] - cAngles[loIdx];
    const t = span > 0 ? (foldedC - cAngles[loIdx]) / span : 0;

    return loVal + (hiVal - loVal) * t;
}

/**
 * Candela en dirección (azimut, gamma) desde el eje del proyector.
 * Usa la matriz fotométrica real (IES/LDT) cuando está disponible; si no,
 * cae a un modelo Lambertiano aproximado a partir del flujo total.
 */
function candela(fixture: Fixture, gammaDeg: number, azimuthDeg = 0): number {
    if (fixture.photometricWeb) {
        return candelaFromPhotometricWeb(fixture.photometricWeb, azimuthDeg, gammaDeg);
    }

    const intensity = (fixture.lumens * fixture.efficiency) / MATH_PI;
    const gammaRad = (gammaDeg * MATH_PI) / 180;

    return intensity * Math.cos(gammaRad);
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

    const gammaDeg = (Math.acos(-dz / dist) * 180) / MATH_PI;
    const rawAzimuthDeg = (Math.atan2(dy, dx) * 180) / MATH_PI;
    const azimuthDeg = rawAzimuthDeg - (fixture.rotation ?? 0);

    return (candela(fixture, gammaDeg, azimuthDeg) * cosIncident) / dist2;
}

/** Área luminosa real (m²) de la luminaria, para el cálculo de luminancia en UGR. Fallback conservador si no hay dimensiones. */
function luminousArea(fixture: Fixture): number {
    const dims = fixture.dimensions;
    if (dims && dims.length > 0 && dims.width > 0) {
        return dims.length * dims.width;
    }
    return 0.1;
}

function calculatePointByPoint(
    points: GridPoint[],
    fixtures: Fixture[],
): Array<number | null> {
    return points.map((point) =>
        point.active
            ? fixtures.reduce(
                  (sum, fixture) =>
                      sum + illuminanceFromFixture(point, fixture),
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

        const dist = Math.sqrt(dist2);
        // Ángulo real fixture→observador (mismo convenio que illuminanceFromFixture),
        // en vez de asumir nadir fijo: la candela hacia el ojo del observador puede
        // diferir mucho de la candela nadir en luminarias no lambertianas (asimétricas).
        const gammaDeg =
            (Math.acos(Math.min(1, Math.max(-1, dz / dist))) * 180) / MATH_PI;
        const rawAzimuthDeg = (Math.atan2(-dy, -dx) * 180) / MATH_PI;
        const azimuthDeg = rawAzimuthDeg - (fixture.rotation ?? 0);

        const area = luminousArea(fixture);
        const luminance = candela(fixture, gammaDeg, azimuthDeg) / area;
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
    const activeValues = values.filter(
        (value): value is number => value !== null,
    );
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

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    for (const value of activeValues) {
        sum += value;
        if (value < min) {
            min = value;
        }
        if (value > max) {
            max = value;
        }
    }

    const avg = sum / activeValues.length;
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
