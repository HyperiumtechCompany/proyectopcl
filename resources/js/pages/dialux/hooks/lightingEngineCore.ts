import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { isSegmentOccluded } from '@/pages/dialux/domain/geometry/segmentOcclusion';
import { pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import { illuminanceFromFixture, luminousArea, type DirectIlluminanceBatchKernel, type SurfacePoint, type Vector3 } from './directIlluminance';
import { computePatchDirectIlluminance, firstBounceIlluminance } from './firstBounceReflection';
import { evaluateUGR } from './glareCalculation';
import { buildDefaultObservers, DEFAULT_UGR_EYE_HEIGHT, type GlareObserver } from './glareObserver';
import { gatherRadiosityIlluminance, solveRadiosity } from './iterativeRadiosity';
import { filterPointsOutsideMarginalZone } from './marginalZoneFilter';
import { candela } from './photometricInterpolation';
import { getRoomMarginalZone, getRoomUsefulPlaneHeight } from './roomLighting';
import { buildPartitionEnclosurePatches, buildRoomEnclosurePatches, type EnclosureReflectances, type PartitionPatchInput } from './roomPatches';
import type { Fixture, LightingResult, Room } from './useEditorStore';

/**
 * Identificador del ÚNICO motor que calcula avg/min/max/uniformity/UGR punto a
 * punto para un ambiente (Fase 0, planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md).
 * Alcance base: luz directa con malla parametrizable (Fase 5). Oclusión
 * (Fase 6), primera reflexión difusa (Fase 7) e interreflexión iterativa
 * (Fase 8, radiosidad Gauss-Seidel) son OPCIONALES vía los parámetros
 * `obstacles`/`surfaceReflectances`/`iterativeConfig` de
 * `calculateLightingResult` — con sus defaults (`[]`/`null`/`null`) el
 * resultado es idéntico al motor original.
 * `domain/calculation/runDirectPreviewEngine.ts` es quien los cablea, vía
 * `CalculationConfig` — y desde `buildProductionCalculationConfig()`
 * (cierre de brechas `dialux-calc-reviewer`), que es el que usan el botón
 * "Calcular" y el export, los tres SÍ están activos por defecto en
 * producción (`occlusion: true`, `interreflection: 'auto-by-shape'`).
 * No incrementar sin actualizar los goldens en `hooks/__fixtures__/`.
 */
export const LIGHTING_ENGINE_VERSION = 'direct-preview-v1';

/** Espaciado de malla en metros — exportado para no duplicarlo en `domain/calculation/types.ts`. */
export const GRID_SPACING = 0.5;
const MATH_PI = Math.PI;

/**
 * Normal de la superficie receptora en este punto (Fase 4: "el mismo solver
 * calcula cualquier superficie mediante punto, normal y contexto").
 * `buildGrid` hoy siempre usa `HORIZONTAL_UP_NORMAL` — con (0,0,1) el
 * cálculo es idéntico a la fórmula anterior (`-dz/dist`), verificado contra
 * los goldens de Fase 0. Superficies verticales/inclinadas quedan fuera de
 * este ciclo (requieren poblar una normal distinta aguas arriba).
 */
/** Exportado desde la Fase 17 para reutilizarse en `daylightFactorEngine.ts` — sin cambios de comportamiento. */
export interface GridPoint {
    x: number;
    y: number;
    z: number;
    normal: Vector3;
    active: boolean;
}

const HORIZONTAL_UP_NORMAL: Vector3 = { x: 0, y: 0, z: 1 };

/** Exportado desde la Fase 17 para reutilizarse en `daylightFactorEngine.ts` — sin cambios de comportamiento. */
export function roomBBox(room: Room) {
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

/** Exportado desde la Fase 17 para reutilizarse en `daylightFactorEngine.ts` — sin cambios de comportamiento. */
export function buildGrid(room: Room, spacing: number, wpHeight: number) {
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

function calculatePointByPoint(
    points: GridPoint[],
    fixtures: Fixture[],
    obstacles: OcclusionBox[],
    /**
     * Contribución reflejada (primera reflexión de Fase 7 o radiosidad
     * iterativa de Fase 8) para un punto dado — inyectada por
     * `calculateLightingResult` en vez de recibir `patches`/`patchIlluminance`
     * directamente, así esta función no necesita saber si el rebote es único
     * o iterativo.
     */
    reflectedIlluminance: (point: GridPoint) => number,
    /** Kernel por lotes inyectable (Fase 12). Default `undefined` — bucle de siempre; solo `workers/dialuxCalculationWorker.ts` lo provee (WASM), este archivo sigue sin saber nada de eso. */
    directIlluminanceBatch?: DirectIlluminanceBatchKernel,
): Array<number | null> {
    const activePoints = directIlluminanceBatch ? points.filter((point) => point.active) : [];
    if (directIlluminanceBatch && activePoints.length > 0) {
        const direct = directIlluminanceBatch(activePoints, fixtures, obstacles);
        let i = 0;
        return points.map((point) => {
            if (!point.active) {
                return null;
            }
            const value = (direct[i] ?? 0) + reflectedIlluminance(point);
            i += 1;
            return value;
        });
    }

    return points.map((point) => {
        if (!point.active) {
            return null;
        }

        const direct = fixtures.reduce((sum, fixture) => sum + illuminanceFromFixture(point, fixture, obstacles), 0);
        return direct + reflectedIlluminance(point);
    });
}

function calculateUGR(
    cx: number,
    cy: number,
    fixtures: Fixture[],
    lb: number,
    wpHeight: number,
    obstacles: OcclusionBox[],
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

        // Una luminaria oculta al observador tampoco puede deslumbrarlo.
        if (
            obstacles.length > 0 &&
            isSegmentOccluded({ x: cx, y: cy, z: wpHeight }, { x: fixture.x, y: fixture.y, z: fixture.z }, obstacles)
        ) {
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
    /**
     * Cajas opacas para el test de visibilidad punto↔luminaria (Fase 6:
     * "Visibilidad, oclusión y sombras"). Default `[]` — sin obstáculos,
     * ningún punto se ocluye nunca y el resultado es idéntico al de antes de
     * esta fase para todo llamador que no los pase explícitamente (mismo
     * patrón no disruptivo que `spacingM` en Fase 5). Se generan con
     * `buildWallOcclusionBoxes`/`buildPartitionOcclusionBoxes`
     * (`domain/geometry/occlusionBoxes.ts`) a partir de `Wall`/`Window`/
     * `Door`/`Partition` — `runDirectPreviewEngine` las puebla solo cuando
     * `CalculationConfig.occlusion === true`.
     */
    obstacles: OcclusionBox[] = [],
    /**
     * Reflectancias de piso/pared/techo para la primera reflexión difusa
     * (Fase 7: "Materiales e interreflexión inicial"). Default `null` — sin
     * reflectancias no se construye ningún parche y el resultado es idéntico
     * al de antes de esta fase para todo llamador que no las pase
     * explícitamente (mismo patrón no disruptivo que `obstacles` en Fase 6).
     * Pasar `{ ceiling: 0, wall: 0, floor: 0 }` en vez de `null` también
     * reproduce el cálculo directo exacto — es el caso de prueba de la
     * puerta de salida ("reflectancia 0 reproduce cálculo directo"), no un
     * atajo interno.
     */
    surfaceReflectances: EnclosureReflectances | null = null,
    /**
     * Configuración de radiosidad iterativa (Fase 8: "Interreflexión
     * iterativa"). Default `null` — sin ella, con `surfaceReflectances` dado
     * se obtiene el resultado de un único rebote de la Fase 7 (idéntico,
     * mismo patrón no disruptivo). Solo tiene efecto cuando
     * `surfaceReflectances` también está presente: sin parches no hay nada
     * que iterar.
     */
    iterativeConfig: { maxBounces: number; convergenceTolerance: number } | null = null,
    /**
     * Configuración de UGR con observadores de Guth (Fase 9: "UGR y
     * luminancia profesional"). Default `null` — sin ella, `ugr` se calcula
     * con el `calculateUGR` heredado (observador único e implícito en el
     * centro del recinto, sin índice de posición), IDÉNTICO al de antes de
     * esta fase para todo llamador que no la pase explícitamente (mismo
     * patrón no disruptivo que `iterativeConfig` en Fase 8 — no altera los
     * goldens de Fase 0). Pasar `{}` activa el camino nuevo con los
     * observadores por defecto (`buildDefaultObservers`); `observers`/
     * `eyeHeight` permiten personalizarlos.
     */
    glareConfig: { observers?: GlareObserver[]; eyeHeight?: number } | null = null,
    /** Kernel WASM por lotes (Fase 12). Default `undefined` — idéntico al motor TS de siempre. Ver `calculatePointByPoint`. */
    directIlluminanceBatch?: DirectIlluminanceBatchKernel,
    /** Factor de mantenimiento aplicado al resultado completo. Default 1 conserva los callers analíticos/legacy. */
    maintenanceFactor = 1,
    /**
     * Zona marginal ya calculada por el llamador (malla adaptativa,
     * `hooks/adaptiveGridSpacing.ts` — mitad del espaciado real usado en
     * ESTE cálculo). Default `undefined` conserva el comportamiento de
     * siempre: `getRoomMarginalZone(room)`, una heurística desconectada del
     * espaciado real de la malla (mismo patrón no disruptivo que el resto
     * de parámetros de esta función).
     */
    marginalZoneOverride?: number,
    /**
     * Excluye del promedio/min/max/uniformidad reales los puntos que caen
     * dentro de la zona marginal (`marginalZone`, arriba) — hasta esta
     * bandera, la zona marginal solo se REPORTABA, nunca afectaba el
     * cálculo. Default `undefined` conserva el comportamiento de siempre
     * (incluido el golden de Fase 0). `grid_values`/`grid_active` (la malla
     * completa, para isolux/contornos) nunca se filtran — igual que DIALux
     * evo sigue coloreando la franja de borde en su isolux aunque la
     * excluya de la estadística "Ē". Efecto colateral esperado: el UGR
     * heredado (`fallbackLb = avg/π`, más abajo) también cambia un poco
     * porque depende de `avg` — mismo criterio que la advertencia ya
     * existente sobre `interreflection` cambiando el método de `Lb`.
     */
    excludeMarginalZoneFromStats?: boolean,
    /**
     * Particiones (Tabiques/separadores) del mismo nivel — sus DOS caras se
     * suman como parches reflectantes de la interreflexión, no solo como
     * obstáculo opaco en `obstacles`. Default `[]` conserva el comportamiento
     * de siempre para todo llamador que no las pase explícitamente (mismo
     * patrón no disruptivo del resto de parámetros de esta función). Ver el
     * porqué en el doc de `buildPartitionEnclosurePatches` (`roomPatches.ts`).
     */
    partitions: PartitionPatchInput[] = [],
): LightingResult {
    const bbox = roomBBox(room);
    const usefulPlaneHeight = getRoomUsefulPlaneHeight(room);
    const marginalZone = marginalZoneOverride ?? getRoomMarginalZone(room);
    const enriched = fixtures.map((fixture) => ({
        ...fixture,
        z: fixture.z > 0 ? fixture.z : room.height - 0.1,
    }));
    const grid = buildGrid(room, spacingM > 0 ? spacingM : GRID_SPACING, usefulPlaneHeight);

    let reflectedIlluminance: (point: SurfacePoint) => number = () => 0;
    let radiosityMeta: { iterations: number; converged: boolean; residual: number } | null = null;

    // Ronda 25: con oclusión activa, los parches de pared deben muestrearse
    // en la cara interior del muro (no en su línea central, que cae dentro
    // de la caja opaca y anula toda la interreflexión) — ver doc de
    // `surfaceInsetM` en `roomPatches.ts`. Sin obstáculos, inset 0 = sin
    // cambio de comportamiento.
    const patchInsetM = obstacles.length > 0 ? Math.max(...obstacles.map((o) => o.thickness)) / 2 + 0.01 : 0;
    const patches = surfaceReflectances
        ? [
              ...buildRoomEnclosurePatches(room, surfaceReflectances, patchInsetM),
              ...buildPartitionEnclosurePatches(partitions, surfaceReflectances.wall, patchInsetM),
          ]
        : [];
    if (patches.length > 0) {
        const patchIlluminance = computePatchDirectIlluminance(patches, enriched, obstacles);
        if (iterativeConfig) {
            const radiosity = solveRadiosity(patches, patchIlluminance, obstacles, iterativeConfig.maxBounces, iterativeConfig.convergenceTolerance);
            reflectedIlluminance = (point) => gatherRadiosityIlluminance(point, patches, radiosity.exitance, obstacles);
            radiosityMeta = { iterations: radiosity.iterations, converged: radiosity.converged, residual: radiosity.residual };
        } else {
            reflectedIlluminance = (point) => firstBounceIlluminance(point, patches, patchIlluminance, obstacles);
        }
    }

    const safeMaintenanceFactor = Math.min(1, Math.max(0, maintenanceFactor));
    const rawValues = calculatePointByPoint(
        grid.points,
        enriched,
        obstacles,
        reflectedIlluminance,
        directIlluminanceBatch,
    );
    const values = rawValues.map((value) =>
        value === null ? null : value * safeMaintenanceFactor,
    );
    // UGR se evalúa con la instalación inicial; el mantenimiento deprecia los
    // lux mantenidos reportados, no la fuente usada para el deslumbramiento.
    const activeValues = rawValues.filter(
        (value): value is number => value !== null,
    );
    // Fase: "zona marginal real" — excluye del promedio/min/max/uniformidad
    // los puntos de la franja de borde, sin tocar `activeValues` (que sigue
    // usándose para el caso "sin ningún punto calculado" de abajo) ni la
    // malla completa reportada en `baseResult`.
    const statsValues =
        excludeMarginalZoneFromStats && marginalZone > 0
            ? (() => {
                  const filtered = filterPointsOutsideMarginalZone(
                      grid.points,
                      rawValues,
                      room.vertices,
                      marginalZone,
                  );
                  return filtered.length > 0 ? filtered : activeValues;
              })()
            : activeValues;
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
        ...(radiosityMeta
            ? {
                  interreflection_iterations: radiosityMeta.iterations,
                  interreflection_converged: radiosityMeta.converged,
                  interreflection_residual: radiosityMeta.residual,
              }
            : {}),
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

    for (const value of statsValues) {
        sum += value;
        if (value < min) {
            min = value;
        }
        if (value > max) {
            max = value;
        }
    }

    const avg = sum / statsValues.length;
    const uniformity = avg > 0 ? min / avg : 0;
    const fallbackLb = avg / MATH_PI;

    let ugr: number;
    let glareMeta: { observer: GlareObserver; excludedFixtureCount: number; fullyExcluded: boolean } | null = null;

    if (glareConfig) {
        const observers = glareConfig.observers ?? buildDefaultObservers(room, glareConfig.eyeHeight ?? DEFAULT_UGR_EYE_HEIGHT);
        // Luminancia de fondo por observador (plan §11 Fase 9: "calcular
        // luminancia de fondo desde la escena"): `Eind/π`, con `Eind` la
        // iluminancia INDIRECTA en el ojo del observador (fórmula verificada
        // en la documentación de soporte de DIALux evo) — usa el mismo
        // `reflectedIlluminance` de Fases 7/8 sobre un plano vertical hacia
        // donde mira el observador. Sin datos de interreflexión activos
        // (`surfaceReflectances` no dado, o `Eind` resulta 0) cae al mismo
        // respaldo `avg/π` que el motor ya usaba desde la Fase 0 — nunca
        // deja `Lb` en 0 (eso volvería UGR indefinido/infinito).
        const computeBackgroundLuminance = (observer: GlareObserver) => {
            const observerViewRad = (observer.viewDirectionDeg * MATH_PI) / 180;
            const eind = reflectedIlluminance({
                x: observer.x,
                y: observer.y,
                z: observer.eyeHeight,
                normal: { x: Math.cos(observerViewRad), y: Math.sin(observerViewRad), z: 0 },
            });
            return eind > 0 ? eind / MATH_PI : fallbackLb;
        };

        const result = evaluateUGR(observers, enriched, obstacles, computeBackgroundLuminance);
        ugr = result.ugr;
        if (result.observer) {
            glareMeta = {
                observer: result.observer,
                excludedFixtureCount: result.excludedFixtureCount,
                fullyExcluded: result.fullyExcluded,
            };
        }
    } else {
        ugr = calculateUGR(bbox.cx, bbox.cy, enriched, fallbackLb, usefulPlaneHeight, obstacles);
    }

    return {
        avg_lux: avg * safeMaintenanceFactor,
        min_lux: min * safeMaintenanceFactor,
        max_lux: max * safeMaintenanceFactor,
        uniformity,
        ugr: Math.max(0, ugr),
        ...baseResult,
        ...(glareMeta
            ? {
                  ugr_observer_x: glareMeta.observer.x,
                  ugr_observer_y: glareMeta.observer.y,
                  ugr_observer_eye_height: glareMeta.observer.eyeHeight,
                  ugr_observer_view_direction_deg: glareMeta.observer.viewDirectionDeg,
                  ugr_excluded_fixture_count: glareMeta.excludedFixtureCount,
                  ugr_not_evaluated: glareMeta.fullyExcluded,
              }
            : {}),
    };
}
