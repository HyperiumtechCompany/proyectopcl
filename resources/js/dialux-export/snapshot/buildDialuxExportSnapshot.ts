import { deriveSceneAmbientSpaces } from '@/hooks/dialux/ambientSpaces';
import { calculateLightingResult } from '@/hooks/dialux/lightingEngineCore';
import { buildRoomLightingInputs } from '@/hooks/dialux/roomLighting';
import {
    normalizeScaleConfig,
    type DxfEntity,
    type DxfExtents,
    type LightingResult,
    type Project,
} from '@/hooks/dialux/useEditorStore';
import type {
    DialuxAmbientExport,
    DialuxAmbientMetrics,
    DialuxExportSnapshot,
    DialuxExportVisualConfig,
} from '../domain/types';

export interface DialuxExportSnapshotInput {
    project: Project;
    activeSceneId: string;
    resultsByRoom: Record<string, LightingResult>;
    dxfEntities: DxfEntity[] | null;
    dxfExtents: DxfExtents | null;
    visualConfig: DialuxExportVisualConfig;
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
    const complies =
        result !== null &&
        result.avg_lux >= inputs.illuminanceLux &&
        result.uniformity >= uniformityTarget &&
        result.ugr <= ugrLimit;

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
    const ambients = deriveSceneAmbientSpaces(scene).map((ambient) => {
        const result =
            resultsByRoom[ambient.room.id] ??
            calculateLightingResult(ambient.room, ambient.fixtures);
        resultsByRoom[ambient.room.id] = result;
        const exportAmbient: DialuxAmbientExport = {
            id: ambient.id,
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
    });
    const reportRooms = scene.rooms.filter(
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
        walls: scene.walls,
        windows: scene.windows,
        doors: scene.doors,
        canopies: scene.canopies,
        fixtures: scene.fixtures,
        ambients,
        resultsByRoom,
        visualConfig: input.visualConfig,
        summary: {
            roomCount: reportRooms.length,
            ambientCount: ambients.length,
            fixtureCount: scene.fixtures.length,
            wallCount: scene.walls.length,
            windowCount: scene.windows.length,
            doorCount: scene.doors.length,
            canopyCount: scene.canopies.length,
            calculatedAmbientCount: calculatedAmbients.length,
            compliantAmbientCount: ambients.filter(
                (ambient) => ambient.metrics.complies,
            ).length,
            averageLux,
            averageUniformity,
        },
    };
}
