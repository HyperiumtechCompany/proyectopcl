import { pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import { candela } from './photometricInterpolation';
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

interface Vector3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Normal de la superficie receptora en este punto (Fase 4: "el mismo solver
 * calcula cualquier superficie mediante punto, normal y contexto").
 * `buildGrid` hoy siempre usa `HORIZONTAL_UP_NORMAL` — con (0,0,1) el
 * cálculo es idéntico a la fórmula anterior (`-dz/dist`), verificado contra
 * los goldens de Fase 0. Superficies verticales/inclinadas quedan fuera de
 * este ciclo (requieren poblar una normal distinta aguas arriba).
 */
interface GridPoint {
    x: number;
    y: number;
    z: number;
    normal: Vector3;
    active: boolean;
}

const HORIZONTAL_UP_NORMAL: Vector3 = { x: 0, y: 0, z: 1 };

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
                pointInPolygon({ x: px, y: py }, room.vertices);

            points.push({ x: px, y: py, z: wpHeight, normal: HORIZONTAL_UP_NORMAL, active });
        }
    }

    return { points, rows, cols, minX, minY, cellW, cellH };
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
    // Coseno de incidencia (Lambert): producto punto entre la dirección
    // unitaria punto→luminaria y la normal de la superficie receptora. Con
    // `point.normal = (0,0,1)` (único caso que produce `buildGrid` hoy) esto
    // es exactamente `-dz/dist`, igual que la fórmula anterior — ver
    // comentario de `GridPoint.normal`.
    const cosIncident = Math.max(
        0,
        (-dx / dist) * point.normal.x + (-dy / dist) * point.normal.y + (-dz / dist) * point.normal.z,
    );

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
    /**
     * Espaciado de malla en metros (Fase 5: "parametrizar malla"). Default
     * `GRID_SPACING` — mantiene el resultado idéntico al de siempre para
     * todo llamador que no pase este argumento explícitamente (verificado
     * contra los goldens de Fase 0). `runDirectPreviewEngine` lo puebla
     * desde `CalculationConfig.meshPolicy.gridSpacingM`, que hasta ahora
     * era metadata sin efecto real sobre el cálculo.
     */
    spacingM: number = GRID_SPACING,
): LightingResult {
    const bbox = roomBBox(room);
    const usefulPlaneHeight = getRoomUsefulPlaneHeight(room);
    const marginalZone = getRoomMarginalZone(room);
    const enriched = fixtures.map((fixture) => ({
        ...fixture,
        z: fixture.z > 0 ? fixture.z : room.height - 0.1,
    }));
    const grid = buildGrid(room, spacingM > 0 ? spacingM : GRID_SPACING, usefulPlaneHeight);
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
