import type { CalculationConfig, CalculationRun, CalculationWarning } from '@/pages/dialux/domain/calculation/types';
import { deriveSceneAmbientSpaces } from '@/pages/dialux/hooks/ambientSpaces';
import { calculateLightingResult, LIGHTING_ENGINE_VERSION } from '@/pages/dialux/hooks/lightingEngineCore';
import { buildRoomLightingInputs } from '@/pages/dialux/hooks/roomLighting';
import {
    normalizeScaleConfig,
    type DxfEntity,
    type DxfExtents,
    type LightingResult,
    type Project,
} from '@/pages/dialux/hooks/useEditorStore';
import type {
    CalculationProvenance,
    DialuxAmbientExport,
    DialuxAmbientMetrics,
    DialuxExportSnapshot,
    DialuxExportVisualConfig,
    DialuxSceneComparisonSummary,
    RequirementEvaluation,
} from '../domain/types';

const LIGHTING_ENGINE_NAME = 'lightingEngineCore';

/**
 * Resumen legible de `CalculationConfig` (Fase 11, §11: "trazarse a...
 * una configuración") — solo los campos que hoy tienen efecto real sobre el
 * resultado (ver `domain/calculation/runDirectPreviewEngine.ts`).
 */
function buildConfigSummary(config: CalculationConfig): string {
    return [
        `oclusión: ${config.occlusion ? 'sí' : 'no'}`,
        `interreflexión: ${config.interreflection}`,
        `UGR: ${config.glare.observerModel}`,
    ].join(' · ');
}

export interface DialuxExportSnapshotInput {
    project: Project;
    activeSceneId: string;
    includeAllScenes?: boolean;
    resultsByRoom: Record<string, LightingResult>;
    dxfEntities: DxfEntity[] | null;
    dxfExtents: DxfExtents | null;
    visualConfig: DialuxExportVisualConfig;
    /** Ejecución (Fase 11) que produjo `resultsByRoom`. Opcional — sin ella, `provenance`/`warnings` quedan como antes de esa fase. */
    calculationRun?: CalculationRun;
    /** Fase 13 — ver `DialuxSceneComparisonSummary`. */ sceneComparisons?: DialuxSceneComparisonSummary[];
}

function sortScenesByFloor(project: Project): Project['scenes'] {
    return [...project.scenes].sort((left, right) => {
        const floorCompare = (left.floorIndex ?? 0) - (right.floorIndex ?? 0);

        if (floorCompare !== 0) {
            return floorCompare;
        }

        return left.name.localeCompare(right.name, 'es');
    });
}

/**
 * Trazabilidad de origen de los requisitos: la norma/categoría que el usuario
 * ya asignó al ambiente en el editor (ver [[dialux-normativa-fuente-unica]]),
 * no un valor inventado en el reporte.
 */
function buildRequirementSource(room: {
    normativeStandard?: string;
    normativeLabel?: string;
    normativeCategory?: string;
}): string | undefined {
    const label = room.normativeLabel ?? room.normativeCategory;

    if (!room.normativeStandard && !label) {
        return undefined;
    }

    return [room.normativeStandard, label].filter(Boolean).join(' · ');
}

/**
 * Decide `pass`/`fail` solo cuando existe una fuente normativa citada
 * (`source`). Sin fuente, el ambiente no tiene `normativeStandard` ni
 * `normativeLabel`/`normativeCategory` asignados (ver `buildRequirementSource`),
 * así que el valor comparado no está vinculado a ninguna norma real — afirmar
 * "cumple"/"no cumple" en ese caso presentaría un juicio normativo sin
 * respaldo (hallazgo de Fase 6, planes/plan_agentes_skills_revision_normativa_dialux.md).
 * `not-evaluated` en este caso significa "sin norma configurada", no "sin
 * cálculo" — el valor calculado se sigue mostrando para no ocultar el dato.
 */
function evaluateRequirementStatus(passes: boolean, source: string | undefined): RequirementEvaluation['status'] {
    if (!source) {
        return 'not-evaluated';
    }
    return passes ? 'pass' : 'fail';
}

/**
 * `uniformityTarget`/`ugrLimit` en `null` significa que la actividad
 * normativa seleccionada NO regula ese parámetro (ej. UGR en
 * estacionamientos, Uo en baños — ver `normativaData.ts`) — en ese caso NO
 * se agrega ninguna fila para esa métrica (nunca se compara contra un
 * límite genérico inventado, y el PDF ni siquiera la menciona en vez de
 * mostrarla como "conforme" sin haber evaluado nada real).
 */
function buildRequirementEvaluations(
    inputs: { illuminanceLux: number },
    uniformityTarget: number | null,
    ugrLimit: number | null,
    result: LightingResult | null,
    source: string | undefined,
): RequirementEvaluation[] {
    const evaluations: RequirementEvaluation[] = [
        {
            metric: 'illuminance',
            calculatedValue: result?.avg_lux ?? null,
            operator: '>=',
            requiredValue: inputs.illuminanceLux,
            unit: 'lx',
            status: result === null
                ? 'not-evaluated'
                : evaluateRequirementStatus(result.avg_lux >= inputs.illuminanceLux, source),
            source,
        },
    ];

    if (uniformityTarget !== null) {
        evaluations.push({
            metric: 'uniformity',
            calculatedValue: result?.uniformity ?? null,
            operator: '>=',
            requiredValue: uniformityTarget,
            unit: 'ratio',
            status: result === null
                ? 'not-evaluated'
                : evaluateRequirementStatus(result.uniformity >= uniformityTarget, source),
            source,
        });
    }

    if (ugrLimit !== null) {
        evaluations.push({
            metric: 'ugr',
            calculatedValue: result?.ugr ?? null,
            operator: '<=',
            requiredValue: ugrLimit,
            unit: 'UGR',
            // `ugr_not_evaluated`: todas las luminarias quedaron excluidas de
            // la suma de deslumbramiento (campo visual inferior o H/R>2 —
            // ver `glareCalculation.ts`), así que el `ugr: 0` resultante no
            // es un valor físico real. Sin este chequeo, `0 <= ugrLimit` es
            // siempre verdadero y el ambiente se reportaría "Conforme" sin
            // haberse evaluado el deslumbramiento en absoluto.
            status: result === null || result.ugr_not_evaluated
                ? 'not-evaluated'
                : evaluateRequirementStatus(result.ugr <= ugrLimit, source),
            source,
        });
    }

    return evaluations;
}

function buildAmbientMetrics(
    ambient: DialuxAmbientExport,
    result: LightingResult | null,
    /**
     * Ejecución completa (Fase 11) que produjo `result`, cuando el llamador
     * la tiene — `undefined` para callers que todavía no pasan por
     * `runProjectLightingCalculation` (tests, u otros usos legacy de este
     * builder). Con ella, `provenance` y `warnings` reflejan la ejecución
     * real; sin ella, se mantiene el comportamiento exacto de antes de esta
     * fase (versión hardcodeada, sin hash/config/warnings).
     */
    calculationRun: CalculationRun | undefined,
): DialuxAmbientMetrics {
    const inputs = buildRoomLightingInputs(ambient.room, ambient.fixtures);
    const uniformityTarget = ambient.room.uniformityTarget ?? null;
    const ugrLimit = ambient.room.ugrLimit ?? null;
    const g2 =
        result && result.max_lux > 0 ? result.min_lux / result.max_lux : null;
    const requirementEvaluations = buildRequirementEvaluations(
        inputs,
        uniformityTarget,
        ugrLimit,
        result,
        buildRequirementSource(ambient.room),
    );
    const complies =
        requirementEvaluations.length > 0 &&
        requirementEvaluations.every(
            (evaluation) => evaluation.status === 'pass',
        );
    const provenance: CalculationProvenance = {
        engine: LIGHTING_ENGINE_NAME,
        engineVersion: calculationRun?.engineVersion ?? LIGHTING_ENGINE_VERSION,
        // Con `calculationRun`, usar SU `completedAt` (el momento real en que
        // terminó ese cálculo) en vez de "ahora" — pueden pasar varios
        // segundos entre calcular y construir este snapshot de export
        // (capturas de bitmap de por medio, ver `useDialuxPdfExport.ts`);
        // usar "ahora" desalinearía la trazabilidad del propio dato que dice
        // representar (auditoría `dialux-calc-reviewer`).
        calculatedAt: calculationRun?.completedAt ?? (result !== null ? new Date().toISOString() : null),
        status: calculationRun ? (calculationRun.status === 'completed' ? 'calculated' : 'not-calculated') : result !== null ? 'calculated' : 'not-calculated',
        snapshotHash: calculationRun?.snapshotHash,
        configSummary: calculationRun ? buildConfigSummary(calculationRun.config) : undefined,
    };
    const warnings: CalculationWarning[] = calculationRun?.warnings.filter((warning) => warning.objectId === ambient.id) ?? [];

    return {
        area: inputs.area,
        illuminanceLux: inputs.illuminanceLux,
        fixtureCount: inputs.fixtureCount,
        fixtureLumens: inputs.fixtureLumens,
        fixtureLumensSource: inputs.detectedFixtureLumens
            ? 'detected'
            : 'fallback',
        lumensRequired: inputs.lumensRequired,
        exactQuantity: inputs.exactQuantity,
        roundedQuantity: inputs.roundedQuantity,
        estimatedUniformity: inputs.estimatedUniformity,
        coverage: inputs.coverage,
        avgLux: result?.avg_lux ?? null,
        minLux: result?.min_lux ?? null,
        maxLux: result?.max_lux ?? null,
        uniformity: result?.uniformity ?? null,
        g2,
        ugr: result?.ugr ?? null,
        usefulPlaneHeight:
            result?.useful_plane_height ?? inputs.usefulPlaneHeight,
        marginalZone: result?.marginal_zone ?? inputs.marginalZone,
        uniformityTarget,
        ugrLimit,
        complies,
        requirementEvaluations,
        provenance,
        warnings,
    };
}

export function buildDialuxExportSnapshot(
    input: DialuxExportSnapshotInput,
): DialuxExportSnapshot {
    const scene = input.project.scenes.find(
        (candidate) => candidate.id === input.activeSceneId,
    );

    if (!scene) {
        throw new Error('No se encontro la escena activa para exportar.');
    }

    const resultsByRoom = { ...input.resultsByRoom };
    const scenes = input.includeAllScenes
        ? sortScenesByFloor(input.project)
        : [scene];
    // Fase 11 (auditoría `dialux-calc-reviewer`): `calculationRun` solo
    // describe la EJECUCIÓN de la que salieron `resultsByRoom` — un ambiente
    // que cae al fallback `calculateLightingResult` de abajo (porque
    // `resultsByRoom` no traía su resultado, ej. un caller que no pasa por
    // `runProjectLightingCalculation`) NUNCA pasó por esa ejecución, así que
    // no debe heredar su `engineVersion`/`snapshotHash`/`configSummary`/
    // `warnings` — eso presentaría un cálculo directo sin trazar como si
    // tuviera la trazabilidad completa de `calculationRun`.
    const objectIdsInRun = new Set(input.calculationRun?.surfaces.map((surface) => surface.objectId) ?? []);
    const ambients = scenes.flatMap((currentScene) =>
        deriveSceneAmbientSpaces(currentScene).map((ambient) => {
            const result =
                resultsByRoom[ambient.room.id] ??
                calculateLightingResult(
                    ambient.room,
                    ambient.fixtures,
                    undefined,
                    [],
                    null,
                    null,
                    null,
                    undefined,
                    0.8,
                );
            resultsByRoom[ambient.room.id] = result;
            const exportAmbient: DialuxAmbientExport = {
                id: ambient.id,
                sceneId: currentScene.id,
                sceneName: currentScene.name,
                floorIndex: currentScene.floorIndex ?? 0,
                roomId: ambient.roomId,
                roomName: ambient.roomName,
                index: ambient.index,
                configKey: ambient.configKey,
                name: ambient.name,
                activity: ambient.activity,
                sourceRoom: ambient.sourceRoom,
                room: ambient.room,
                fixtures: ambient.fixtures,
                result,
                metrics: {} as DialuxAmbientMetrics,
            };

            const runForThisAmbient = objectIdsInRun.has(ambient.id) ? input.calculationRun : undefined;
            exportAmbient.metrics = buildAmbientMetrics(exportAmbient, result, runForThisAmbient);

            return exportAmbient;
        }),
    );
    // Advertencias SIN objeto asociado (`objectId: null`, ej.
    // `interreflection-maxBounces-too-low`, `scene-not-found`) — un warning
    // de este tipo no pertenece a ningún ambiente, así que
    // `DialuxAmbientMetrics.warnings` nunca podría mostrarlo; se exponen a
    // nivel de snapshot para no perderlas en silencio (auditoría
    // `dialux-calc-reviewer`).
    const globalWarnings = input.calculationRun?.warnings.filter((warning) => warning.objectId === null) ?? [];
    const reportRooms = scenes
        .flatMap((currentScene) => currentScene.rooms)
        .filter(
            (room) =>
                // Always include corridors (pasadizos) — they provide architectural context
                // even when no ambient is assigned to them.
                room.roomType === 'corridor' ||
                ambients.some((ambient) => ambient.roomId === room.id),
        );

    const calculatedAmbients = ambients.filter(
        (ambient) => ambient.result !== null,
    );
    const averageLux =
        calculatedAmbients.length > 0
            ? calculatedAmbients.reduce(
                  (sum, ambient) => sum + (ambient.metrics.avgLux ?? 0),
                  0,
              ) / calculatedAmbients.length
            : 0;
    const averageUniformity =
        calculatedAmbients.length > 0
            ? calculatedAmbients.reduce(
                  (sum, ambient) => sum + (ambient.metrics.uniformity ?? 0),
                  0,
              ) / calculatedAmbients.length
            : 0;

    return {
        formatVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        project: input.project,
        scene,
        scaleConfig: normalizeScaleConfig(scene.scaleConfig),
        dxfEntities: input.dxfEntities ?? [],
        dxfExtents: input.dxfExtents,
        rooms: reportRooms,
        walls: scenes.flatMap((currentScene) => currentScene.walls),
        windows: scenes.flatMap((currentScene) => currentScene.windows),
        doors: scenes.flatMap((currentScene) => currentScene.doors),
        canopies: scenes.flatMap((currentScene) => currentScene.canopies),
        fixtures: scenes.flatMap((currentScene) => currentScene.fixtures),
        ambients,
        resultsByRoom,
        globalWarnings,
        sceneComparisons: input.sceneComparisons ?? [],
        visualConfig: input.visualConfig,
        summary: {
            roomCount: reportRooms.length,
            ambientCount: ambients.length,
            fixtureCount: scenes.reduce(
                (sum, currentScene) => sum + currentScene.fixtures.length,
                0,
            ),
            wallCount: scenes.reduce(
                (sum, currentScene) => sum + currentScene.walls.length,
                0,
            ),
            windowCount: scenes.reduce(
                (sum, currentScene) => sum + currentScene.windows.length,
                0,
            ),
            doorCount: scenes.reduce(
                (sum, currentScene) => sum + currentScene.doors.length,
                0,
            ),
            canopyCount: scenes.reduce(
                (sum, currentScene) => sum + currentScene.canopies.length,
                0,
            ),
            calculatedAmbientCount: calculatedAmbients.length,
            compliantAmbientCount: ambients.filter(
                (ambient) => ambient.metrics.complies,
            ).length,
            averageLux,
            averageUniformity,
        },
    };
}
