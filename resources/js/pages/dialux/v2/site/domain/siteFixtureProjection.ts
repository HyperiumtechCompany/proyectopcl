import {
    calculateFixtureGridPositions,
    estimatePhotometricFixtureQuantity,
    suggestFixtureGridSize,
} from '@/pages/dialux/hooks/fixtureGrid';
import {
    calculateExactQuantity,
    calculateLumensRequired,
} from '@/pages/dialux/hooks/lightingCalculations';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';
import { calculateSiteLighting } from './siteLightingCalculation';
import { applyRoofRule } from './siteLightPlacement';
import type {
    CanopyLights,
    Point2D,
    PoleConfig,
    SiteData,
    SiteElement,
} from './types';

/**
 * "Proyectar luminarias" en una superficie exterior — el MISMO flujo que la
 * proyección de la V1 en recintos (`FixtureGridProjectionDialog`), con sus
 * funciones sin modificar:
 *  1. cantidad por método de lúmenes (`calculateLumensRequired` — fórmula
 *     literal ((A·E)/Fm)·Fu de la V1 — y `calculateExactQuantity`);
 *  2. grilla filas × columnas con la proporción del espacio
 *     (`suggestFixtureGridSize`) y posiciones centradas dentro del polígono
 *     (`calculateFixtureGridPositions`);
 *  3. ajuste fotométrico: se calcula punto a punto con el motor luminotécnico
 *     V1 (`calculateSiteLighting`, fotometría IES/LDT, sombras, luminarias ya
 *     existentes incluidas) y se corrige la cantidad con
 *     `estimatePhotometricFixtureQuantity`, iterando hasta alcanzar el Ēm
 *     objetivo (como el refinamiento de la V1, que recalcula tras cada grilla).
 *
 * Las luminarias proyectadas son postes (en un techado, las luminarias bajo la
 * cubierta las cuenta aparte el llamador).
 */

export interface ProjectionInput {
    site: SiteData;
    areaId: string;
    targetLux: number;
    /** Poste a repetir (altura, brazo, flujo, producto, mantenimiento…). */
    pole: PoleConfig;
    photometry: ReadonlyMap<number, LuminairePhotometry>;
    /** Factor de utilización del método de lúmenes (V1: 0.8). */
    utilizationFactor?: number;
    maxIterations?: number;
    /** Tope de luminarias (protege de áreas enormes / objetivos imposibles). */
    maxCount?: number;
}

export interface ProjectionStep {
    count: number;
    rows: number;
    columns: number;
    avgLux: number;
    minLux: number;
    uniformity: number;
}

export interface ProjectionResult {
    areaM2: number;
    lumenMethodCount: number;
    rows: number;
    columns: number;
    /** Posiciones en coordenadas de PLANO (mismas unidades que los vértices). */
    positions: Point2D[];
    predicted: ProjectionStep;
    steps: ProjectionStep[];
    reachedTarget: boolean;
}

/** Marca de los postes creados por la proyección de un área (para reemplazarlos al reproyectar). */
export const PROJECTED_FOR_KEY = 'projectedFor';

function polygonAreaM2(vertices: Point2D[], scaleM: number): number {
    let twice = 0;
    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        twice += a.x * b.y - b.x * a.y;
    }
    return (Math.abs(twice) / 2) * scaleM * scaleM;
}

function flux(pole: PoleConfig, photometry: ReadonlyMap<number, LuminairePhotometry>) {
    const product =
        pole.productId !== undefined ? photometry.get(pole.productId) : undefined;
    return (
        (pole.lumens ?? product?.totalLumens ?? product?.web?.reference_lumens ?? 3000) *
        Math.max(1, pole.fixtures)
    );
}

/** Poste temporal con la misma forma que coloca el editor (cuadrado alrededor del punto). */
export function projectedPoleElement(
    id: string,
    point: Point2D,
    pole: PoleConfig,
    areaId: string,
    label = 'Poste',
    halfSize = 2,
): SiteElement {
    return {
        id,
        type: 'pole',
        label,
        vertices: [
            { x: point.x - halfSize, y: point.y - halfSize },
            { x: point.x + halfSize, y: point.y - halfSize },
            { x: point.x + halfSize, y: point.y + halfSize },
            { x: point.x - halfSize, y: point.y + halfSize },
        ],
        config: pole,
        visible: true,
        style: { fillColor: '#facc15', strokeColor: '#a16207' },
        metadata: { [PROJECTED_FOR_KEY]: areaId },
    };
}

/**
 * Ajuste fotométrico común (postes o luminarias de techado): parte de la
 * cantidad del método de lúmenes y la corrige con el Ēm calculado por el motor
 * V1 (`estimatePhotometricFixtureQuantity`), hasta alcanzar el objetivo con la
 * menor cantidad posible.
 */
function refineCount<T extends { step: ProjectionStep }>(
    lumenMethodCount: number,
    evaluate: (count: number) => T,
    targetLux: number,
    maxIterations: number,
    maxCount: number,
): { best: T; steps: ProjectionStep[] } {
    const steps: ProjectionStep[] = [];
    let count = Math.min(lumenMethodCount, maxCount);
    let current = evaluate(count);
    steps.push(current.step);
    let best = current;
    for (let i = 1; i < maxIterations; i++) {
        if (current.step.avgLux >= targetLux) {
            // Ya alcanza: se prueba con UNA menos por si sobra (sin bajar del objetivo).
            if (count <= 1) break;
            const fewer = evaluate(count - 1);
            steps.push(fewer.step);
            if (fewer.step.avgLux >= targetLux) {
                count -= 1;
                current = fewer;
                best = fewer;
                continue;
            }
            break;
        }
        const next = Math.min(
            maxCount,
            Math.max(
                count + 1,
                estimatePhotometricFixtureQuantity(
                    count,
                    current.step.avgLux,
                    targetLux,
                    lumenMethodCount,
                ).rounded,
            ),
        );
        if (next === count) break;
        count = next;
        current = evaluate(count);
        steps.push(current.step);
        best = current;
    }
    return { best, steps };
}

/** Techado con filas × columnas (regla de cumbrera incluida). */
function canopyTrial(
    site: SiteData,
    areaId: string,
    lights: CanopyLights,
    rows: number,
    columns: number,
): SiteData {
    return {
        ...site,
        elements: (site.elements ?? []).map((element) =>
            element.id === areaId && element.config?.kind === 'canopy'
                ? {
                      ...element,
                      config: {
                          ...element.config,
                          lights: {
                              ...lights,
                              enabled: true,
                              rows,
                              columns,
                              count: rows * columns,
                          },
                      },
                  }
                : element,
        ),
    };
}

/**
 * Techado: "Ajustar al objetivo" con filas × columnas — misma iteración de la
 * V1 (método de lúmenes → `estimatePhotometricFixtureQuantity` con el motor
 * V1); cada cantidad se reparte con `suggestFixtureGridSize` y la regla de
 * cumbrera (`applyRoofRule`).
 */
export function projectCanopyLights(input: {
    site: SiteData;
    areaId: string;
    targetLux: number;
    lights: CanopyLights;
    photometry: ReadonlyMap<number, LuminairePhotometry>;
    maintenanceFactor?: number;
    utilizationFactor?: number;
    maxCount?: number;
}): (Omit<ProjectionResult, 'positions'> & { count: number }) | null {
    const { site, areaId, targetLux, lights, photometry } = input;
    const area = areaById(site, areaId);
    if (
        !area ||
        area.type !== 'canopy' ||
        area.config?.kind !== 'canopy' ||
        area.vertices.length < 3 ||
        targetLux <= 0
    ) {
        return null;
    }
    const { scaleM, widthM, lengthM, areaM2 } = areaMetres(site, area);
    const product =
        lights.productId !== undefined ? photometry.get(lights.productId) : undefined;
    const lumensEach = lights.lumens || product?.totalLumens || 2000;
    const lumenMethodCount = Math.max(
        1,
        Math.ceil(
            calculateExactQuantity(
                calculateLumensRequired(areaM2, targetLux, {
                    maintenanceFactor: input.maintenanceFactor ?? 0.8,
                    utilizationFactor: input.utilizationFactor ?? 0.8,
                }),
                lumensEach,
            ),
        ),
    );
    const evaluate = (count: number) => {
        const base = suggestFixtureGridSize(1, 1, count, widthM / Math.max(1e-6, lengthM));
        const grid = applyRoofRule(area, scaleM, base.rows, base.columns);
        const step = evaluateCanopyGrid({
            site,
            areaId,
            rows: grid.rows,
            columns: grid.columns,
            lights,
            photometry,
        });
        return {
            step: step ?? {
                count: grid.rows * grid.columns,
                rows: grid.rows,
                columns: grid.columns,
                avgLux: 0,
                minLux: 0,
                uniformity: 0,
            },
        };
    };
    const { best, steps } = refineCount(
        lumenMethodCount,
        evaluate,
        targetLux,
        5,
        input.maxCount ?? 60,
    );
    return {
        areaM2,
        lumenMethodCount,
        rows: best.step.rows,
        columns: best.step.columns,
        count: best.step.count,
        predicted: best.step,
        steps,
        reachedTarget: best.step.avgLux >= targetLux,
    };
}

export function projectAreaLuminaires(input: ProjectionInput): ProjectionResult | null {
    const { site, areaId, targetLux, pole, photometry } = input;
    const area = (site.elements ?? []).find((element) => element.id === areaId);
    if (!area || area.vertices.length < 3 || targetLux <= 0) return null;
    const scaleM = site.terrainScaleM || 1;
    const maxCount = input.maxCount ?? 200;
    const maxIterations = input.maxIterations ?? 5;

    const verticesM = area.vertices.map((v) => ({ x: v.x * scaleM, y: v.y * scaleM }));
    const xs = verticesM.map((v) => v.x);
    const ys = verticesM.map((v) => v.y);
    const aspect =
        (Math.max(...xs) - Math.min(...xs)) / Math.max(1e-6, Math.max(...ys) - Math.min(...ys));
    const areaM2 = polygonAreaM2(area.vertices, scaleM);

    // 1. Método de lúmenes de la V1.
    const lumensRequired = calculateLumensRequired(areaM2, targetLux, {
        maintenanceFactor: pole.maintenanceFactor ?? 0.8,
        utilizationFactor: input.utilizationFactor ?? 0.8,
    });
    const lumenMethodCount = Math.max(
        1,
        Math.ceil(calculateExactQuantity(lumensRequired, flux(pole, photometry))),
    );

    // Postes ya proyectados antes para ESTA área: se reemplazan.
    const baseElements = (site.elements ?? []).filter(
        (element) => element.metadata?.[PROJECTED_FOR_KEY] !== areaId,
    );

    const evaluate = (count: number) => {
        const { rows, columns } = suggestFixtureGridSize(1, 1, count, aspect);
        const positionsM = calculateFixtureGridPositions(verticesM, rows, columns);
        const positions = positionsM.map((p) => ({ x: p.x / scaleM, y: p.y / scaleM }));
        const trial: SiteData = {
            ...site,
            elements: [
                ...baseElements,
                ...positions.map((point, index) =>
                    projectedPoleElement(`__projection_${index}`, point, pole, areaId),
                ),
            ],
        };
        const result = calculateSiteLighting(trial, photometry).areas.find(
            (item) => item.elementId === areaId,
        );
        const step: ProjectionStep = {
            count: positions.length,
            rows,
            columns,
            avgLux: result?.result.avg_lux ?? 0,
            minLux: result?.result.min_lux ?? 0,
            uniformity: result?.result.uniformity ?? 0,
        };
        return { step, positions };
    };

    const { best, steps } = refineCount(
        lumenMethodCount,
        evaluate,
        targetLux,
        maxIterations,
        maxCount,
    );

    return {
        areaM2,
        lumenMethodCount,
        rows: best.step.rows,
        columns: best.step.columns,
        positions: best.positions,
        predicted: best.step,
        steps,
        reachedTarget: best.step.avgLux >= targetLux,
    };
}


// ─── Proyección interactiva (filas × columnas con vista previa) ──────────────

/**
 * Relación separación / altura de montaje usada como regla de colocación:
 * separación máxima entre luminarias = k · h. Valor de REFERENCIA (no
 * normativo; alumbrado de áreas con distribución simétrica suele trabajarse
 * entre 3 y 4) — ajustable por el usuario. El margen al borde es media
 * separación, igual que la grilla de la V1 (`calculateFixtureGridPositions`).
 */
export const DEFAULT_SPACING_TO_HEIGHT = 3;

export interface GridSuggestion {
    rows: number;
    columns: number;
    widthM: number;
    lengthM: number;
    byLumens: { count: number; rows: number; columns: number };
    bySpacing: { rows: number; columns: number; maxSpacingM: number };
}

function areaById(site: SiteData, areaId: string): SiteElement | undefined {
    return (site.elements ?? []).find((element) => element.id === areaId);
}

function areaMetres(site: SiteData, area: SiteElement) {
    const scaleM = site.terrainScaleM || 1;
    const verticesM = area.vertices.map((v) => ({ x: v.x * scaleM, y: v.y * scaleM }));
    const xs = verticesM.map((v) => v.x);
    const ys = verticesM.map((v) => v.y);
    return {
        scaleM,
        verticesM,
        widthM: Math.max(...xs) - Math.min(...xs),
        lengthM: Math.max(...ys) - Math.min(...ys),
        areaM2: polygonAreaM2(area.vertices, scaleM),
    };
}

/**
 * Propuesta inicial de filas × columnas: la MAYOR entre la del método de
 * lúmenes de la V1 (con la proporción del espacio, `suggestFixtureGridSize`)
 * y la que exige la regla de separación máxima k·h en cada dirección.
 */
export function suggestProjectionGrid(input: {
    site: SiteData;
    areaId: string;
    targetLux: number;
    lumensEach: number;
    maintenanceFactor: number;
    mountingHeightM: number;
    spacingToHeight?: number;
    utilizationFactor?: number;
}): GridSuggestion | null {
    const area = areaById(input.site, input.areaId);
    if (!area || area.vertices.length < 3) return null;
    const { widthM, lengthM, areaM2 } = areaMetres(input.site, area);
    if (widthM <= 0 || lengthM <= 0) return null;
    const count = Math.max(
        1,
        Math.ceil(
            calculateExactQuantity(
                calculateLumensRequired(areaM2, Math.max(0, input.targetLux), {
                    maintenanceFactor: input.maintenanceFactor,
                    utilizationFactor: input.utilizationFactor ?? 0.8,
                }),
                Math.max(1, input.lumensEach),
            ),
        ),
    );
    const byLumens = suggestFixtureGridSize(1, 1, count, widthM / lengthM);
    const maxSpacingM =
        Math.max(0.5, input.mountingHeightM) *
        (input.spacingToHeight ?? DEFAULT_SPACING_TO_HEIGHT);
    const bySpacing = {
        rows: Math.max(1, Math.ceil(lengthM / maxSpacingM)),
        columns: Math.max(1, Math.ceil(widthM / maxSpacingM)),
        maxSpacingM,
    };
    return {
        rows: Math.max(byLumens.rows, bySpacing.rows),
        columns: Math.max(byLumens.columns, bySpacing.columns),
        widthM,
        lengthM,
        byLumens: { count, ...byLumens },
        bySpacing,
    };
}

/** Posiciones (coordenadas de PLANO) de una grilla filas × columnas dentro del área — grilla de la V1. */
export function projectionGridPositions(
    site: SiteData,
    areaId: string,
    rows: number,
    columns: number,
): Point2D[] {
    const area = areaById(site, areaId);
    if (!area || area.vertices.length < 3) return [];
    const { scaleM, verticesM } = areaMetres(site, area);
    return calculateFixtureGridPositions(verticesM, rows, columns).map((p) => ({
        x: p.x / scaleM,
        y: p.y / scaleM,
    }));
}

export interface ProjectionPreviewMetrics extends ProjectionStep {
    /** Separación real entre luminarias (m) en X (columnas) e Y (filas). */
    spacingXM: number;
    spacingYM: number;
}

/**
 * Evalúa UNA grilla con el motor luminotécnico V1 calculando solo esa
 * superficie (rápido, para la vista previa en vivo). Reemplaza los postes que
 * se proyectaron antes para el área; incluye el resto de luminarias y sombras.
 */
export function evaluatePoleGrid(input: {
    site: SiteData;
    areaId: string;
    rows: number;
    columns: number;
    pole: PoleConfig;
    photometry: ReadonlyMap<number, LuminairePhotometry>;
    /** Posiciones ya ajustadas a mano (ausente = la grilla filas × columnas). */
    positions?: Point2D[];
}): { metrics: ProjectionPreviewMetrics; positions: Point2D[] } | null {
    const area = areaById(input.site, input.areaId);
    if (!area || area.vertices.length < 3) return null;
    const { widthM, lengthM } = areaMetres(input.site, area);
    const positions =
        input.positions ??
        projectionGridPositions(input.site, input.areaId, input.rows, input.columns);
    const trial: SiteData = {
        ...input.site,
        elements: [
            ...(input.site.elements ?? []).filter(
                (element) => element.metadata?.[PROJECTED_FOR_KEY] !== input.areaId,
            ),
            ...positions.map((point, index) =>
                projectedPoleElement(`__preview_${index}`, point, input.pole, input.areaId),
            ),
        ],
    };
    const result = calculateSiteLighting(
        trial,
        input.photometry,
        new Set([input.areaId]),
    ).areas[0];
    return {
        positions,
        metrics: {
            count: positions.length,
            rows: input.rows,
            columns: input.columns,
            avgLux: result?.result.avg_lux ?? 0,
            minLux: result?.result.min_lux ?? 0,
            uniformity: result?.result.uniformity ?? 0,
            spacingXM: widthM / Math.max(1, input.columns),
            spacingYM: lengthM / Math.max(1, input.rows),
        },
    };
}

/** Evalúa filas × columnas bajo la cubierta de un techado (solo esa superficie). */
export function evaluateCanopyGrid(input: {
    site: SiteData;
    areaId: string;
    rows: number;
    columns: number;
    lights: CanopyLights;
    photometry: ReadonlyMap<number, LuminairePhotometry>;
}): ProjectionPreviewMetrics | null {
    const area = areaById(input.site, input.areaId);
    if (!area || area.config?.kind !== 'canopy') return null;
    const { scaleM, widthM, lengthM } = areaMetres(input.site, area);
    const grid = applyRoofRule(area, scaleM, input.rows, input.columns);
    const result = calculateSiteLighting(
        canopyTrial(input.site, input.areaId, input.lights, grid.rows, grid.columns),
        input.photometry,
        new Set([input.areaId]),
    ).areas[0];
    return {
        count: grid.rows * grid.columns,
        rows: grid.rows,
        columns: grid.columns,
        avgLux: result?.result.avg_lux ?? 0,
        minLux: result?.result.min_lux ?? 0,
        uniformity: result?.result.uniformity ?? 0,
        spacingXM: widthM / Math.max(1, grid.columns),
        spacingYM: lengthM / Math.max(1, grid.rows),
    };
}

/**
 * Propuesta de un techado: la del área (método de lúmenes V1 + separación
 * máx. k·h con h = altura del alero) y luego la regla de cumbrera.
 */
export function suggestCanopyGrid(input: {
    site: SiteData;
    areaId: string;
    targetLux: number;
    lights: CanopyLights;
    spacingToHeight?: number;
}): (GridSuggestion & { roofAdjusted: boolean }) | null {
    const area = areaById(input.site, input.areaId);
    if (!area || area.config?.kind !== 'canopy') return null;
    const base = suggestProjectionGrid({
        site: input.site,
        areaId: input.areaId,
        targetLux: input.targetLux,
        lumensEach: input.lights.lumens,
        maintenanceFactor: 0.8,
        mountingHeightM: Math.max(1, area.config.heightM - 0.15),
        spacingToHeight: input.spacingToHeight,
    });
    if (!base) return null;
    const grid = applyRoofRule(
        area,
        input.site.terrainScaleM || 1,
        base.rows,
        base.columns,
    );
    return { ...base, rows: grid.rows, columns: grid.columns, roofAdjusted: grid.adjusted };
}

/** Largo en horizontal (X) y en vertical (Y) del área, en metros. */
export function projectionAreaSize(
    site: SiteData,
    areaId: string,
): { widthM: number; lengthM: number } | null {
    const area = areaById(site, areaId);
    if (!area || area.vertices.length < 3) return null;
    const { widthM, lengthM } = areaMetres(site, area);
    return { widthM, lengthM };
}
