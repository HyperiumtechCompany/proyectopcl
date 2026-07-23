import { deriveSceneAmbientSpaces } from '@/pages/dialux/hooks/ambientSpaces';
import { calculateLightingResult } from '@/pages/dialux/hooks/lightingEngineCore';
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
    RequirementEvaluation,
} from '../domain/types';

const LIGHTING_ENGINE_NAME = 'lightingEngineCore';
const LIGHTING_ENGINE_VERSION = '1.0.0';

export interface DialuxExportSnapshotInput {
    project: Project;
    activeSceneId: string;
    includeAllScenes?: boolean;
    resultsByRoom: Record<string, LightingResult>;
    dxfEntities: DxfEntity[] | null;
    dxfExtents: DxfExtents | null;
    visualConfig: DialuxExportVisualConfig;
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

function buildRequirementEvaluations(
    inputs: { illuminanceLux: number },
    uniformityTarget: number,
    ugrLimit: number,
    result: LightingResult | null,
    source: string | undefined,
): RequirementEvaluation[] {
    if (result === null) {
        return [
            {
                metric: 'illuminance',
                calculatedValue: null,
                operator: '>=',
                requiredValue: inputs.illuminanceLux,
                unit: 'lx',
                status: 'not-evaluated',
                source,
            },
            {
                metric: 'uniformity',
                calculatedValue: null,
                operator: '>=',
                requiredValue: uniformityTarget,
                unit: 'ratio',
                status: 'not-evaluated',
                source,
            },
            {
                metric: 'ugr',
                calculatedValue: null,
                operator: '<=',
                requiredValue: ugrLimit,
                unit: 'UGR',
                status: 'not-evaluated',
                source,
            },
        ];
    }

    return [
        {
            metric: 'illuminance',
            calculatedValue: result.avg_lux,
            operator: '>=',
            requiredValue: inputs.illuminanceLux,
            unit: 'lx',
            status: result.avg_lux >= inputs.illuminanceLux ? 'pass' : 'fail',
            source,
        },
        {
            metric: 'uniformity',
            calculatedValue: result.uniformity,
            operator: '>=',
            requiredValue: uniformityTarget,
            unit: 'ratio',
            status: result.uniformity >= uniformityTarget ? 'pass' : 'fail',
            source,
        },
        {
            metric: 'ugr',
            calculatedValue: result.ugr,
            operator: '<=',
            requiredValue: ugrLimit,
            unit: 'UGR',
            status: result.ugr <= ugrLimit ? 'pass' : 'fail',
            source,
        },
    ];
}

function buildAmbientMetrics(
    ambient: DialuxAmbientExport,
    result: LightingResult | null,
): DialuxAmbientMetrics {
    const inputs = buildRoomLightingInputs(ambient.room, ambient.fixtures);
    const uniformityTarget = ambient.room.uniformityTarget ?? 0.4;
    const ugrLimit = ambient.room.ugrLimit ?? 22;
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
        engineVersion: LIGHTING_ENGINE_VERSION,
        calculatedAt: result !== null ? new Date().toISOString() : null,
        status: result !== null ? 'calculated' : 'not-calculated',
    };

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
    const ambients = scenes.flatMap((currentScene) =>
        deriveSceneAmbientSpaces(currentScene).map((ambient) => {
            const result =
                resultsByRoom[ambient.room.id] ??
                calculateLightingResult(ambient.room, ambient.fixtures);
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

            exportAmbient.metrics = buildAmbientMetrics(exportAmbient, result);

            return exportAmbient;
        }),
    );
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
