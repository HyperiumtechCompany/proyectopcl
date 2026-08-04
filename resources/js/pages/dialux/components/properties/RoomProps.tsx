import React from 'react';
import {
    deriveAmbientSpaces,
    deriveSceneAmbientSpaces,
} from '@/pages/dialux/hooks/ambientSpaces';
import { calculatePolygonArea, calculatePolygonPerimeter } from '@/pages/dialux/hooks/lightingCalculations';
import { ensureStandardDataLoaded } from '@/pages/dialux/hooks/normativeRemoteData';
import {
    buildRoomLightingInputs,
    getActivityOptions,
    getCategoryOptions,
    getFixturesForRoom,
    getSectionOptions,
} from '@/pages/dialux/hooks/roomLighting';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { Room, Scene } from '@/pages/dialux/hooks/useEditorStore';
import { RoomConstructionSection } from './room/RoomConstructionSection';
import { RoomFixtureGridSection } from './room/RoomFixtureGridSection';
import { RoomGeometrySection } from './room/RoomGeometrySection';
import { RoomLightingSection } from './room/RoomLightingSection';
import { RoomOutletsSection } from './room/RoomOutletsSection';

/**
 * Panel de propiedades de un recinto/ambiente/pasadizo (Fase 2 del plan
 * maestro, extracción sin cambiar comportamiento): orquesta las secciones
 * de Geometría, Construcción, Iluminación, Grilla de luminarias y
 * Tomacorrientes, cada una extraída a `./room/` — mismo comportamiento y
 * mismo resultado visual que la versión monolítica anterior.
 */
export const RoomProps: React.FC<{
    room: Room;
    scene: Scene | null;
    parentRoom?: Room | null;
    selectedAmbient?:
        | ReturnType<typeof deriveSceneAmbientSpaces>[number]
        | null;
    onUpdate: (patch: Partial<Omit<Room, 'id'>>) => void;
}> = ({ room, scene, parentRoom = null, selectedAmbient = null, onUpdate }) => {
    const store = useEditorStore();
    const isCorridorAmbient = room.roomType === 'corridor';
    const isRecinto = !room.roomType || room.roomType === 'room';
    const isAmbiente = room.roomType === 'ambient' || room.roomType === 'corridor';
    const calculationRoom = selectedAmbient?.room ?? room;
    const area = calculatePolygonArea(calculationRoom.vertices);
    const perimeter = calculatePolygonPerimeter(calculationRoom.vertices);
    const generatedOutletsCount = (scene?.electricalDevices ?? []).filter(
        (device) => device.generatedBy === 'outlet-rule' && device.roomId === room.id,
    ).length;
    const fixturesInRoom = selectedAmbient
        ? selectedAmbient.fixtures
        : scene
          ? getFixturesForRoom(room, scene.fixtures)
          : [];
    const ambientSpaces = scene
        ? isCorridorAmbient
            ? selectedAmbient
                ? [selectedAmbient]
                : deriveAmbientSpaces(room, scene.walls, scene.fixtures)
            : deriveSceneAmbientSpaces(scene).filter(
                  (ambient) => ambient.roomId === room.id,
              )
        : [];
    const standard =
        room.normativeStandard ?? store.defaultRoomNormativeStandard;
    const inputs = buildRoomLightingInputs(calculationRoom, fixturesInRoom);

    // Sin esto, este panel podía quedarse mostrando la transcripción estática
    // de normativeData.ts en vez del catálogo sembrado en BD (mismo motivo
    // que WallProps: fuente única de verdad para los dropdowns Sección/
    // Subsección/Aplicación de abajo).
    const [, setNormDataVersion] = React.useState(0);
    React.useEffect(() => {
        void ensureStandardDataLoaded(standard).then(() =>
            setNormDataVersion((v) => v + 1),
        );
    }, [standard]);

    const normCategories = getCategoryOptions(standard);
    const normSections = getSectionOptions(standard, room.normativeCategory);
    const normActivities = getActivityOptions(
        standard,
        room.normativeCategory,
        room.normativeSection,
    );

    // Un pasadizo y el recinto que lo contiene son la misma altura física —
    // dejarla editable por separado permitía que se desincronizaran, lo que
    // afecta el cálculo de lúmenes (usa la altura para el índice del local).
    const hasParentRecinto =
        isCorridorAmbient && !!parentRoom && parentRoom.id !== room.id;
    const inheritedHeight = hasParentRecinto ? parentRoom!.height : null;
    React.useEffect(() => {
        if (inheritedHeight !== null && room.height !== inheritedHeight) {
            onUpdate({ height: inheritedHeight });
        }
    }, [inheritedHeight, room.height, onUpdate]);

    return (
        <div className="max-h-[600px] space-y-3 overflow-y-auto">
            <RoomGeometrySection
                room={room}
                onUpdate={onUpdate}
                isCorridorAmbient={isCorridorAmbient}
                isRecinto={isRecinto}
                parentRoom={parentRoom}
                inheritedHeight={inheritedHeight}
                area={area}
                perimeter={perimeter}
                ambientCount={ambientSpaces.length}
            />

            {isRecinto && <RoomConstructionSection room={room} onUpdate={onUpdate} />}

            {isAmbiente && (
                <RoomLightingSection
                    room={room}
                    onUpdate={onUpdate}
                    standard={standard}
                    normCategories={normCategories}
                    normSections={normSections}
                    normActivities={normActivities}
                    inputs={inputs}
                    fixturesInRoom={fixturesInRoom}
                />
            )}

            {isAmbiente && (
                <RoomFixtureGridSection
                    room={room}
                    calculationVertices={calculationRoom.vertices}
                    lumensRequired={inputs.lumensRequired}
                    fixtureLumensFallback={inputs.fixtureLumens}
                    fixturesInRoom={fixturesInRoom}
                    calculationRoomId={calculationRoom.id}
                    targetLux={inputs.illuminanceLux}
                />
            )}

            {isAmbiente && (
                <RoomOutletsSection
                    room={room}
                    onUpdate={onUpdate}
                    calculationVertices={calculationRoom.vertices}
                    calculationHeight={calculationRoom.height}
                    area={area}
                    perimeter={perimeter}
                    generatedOutletsCount={generatedOutletsCount}
                />
            )}
        </div>
    );
};
