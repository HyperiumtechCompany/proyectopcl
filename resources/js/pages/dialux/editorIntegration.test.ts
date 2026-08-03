/**
 * editorIntegration.test.ts — Escenario end-to-end de la Fase 4 del plan.
 *
 * Recorre el flujo completo: importar plano → calibrar → dibujar recinto de
 * referencia (40.096 m²) → ambiente → dispositivos superpuestos → seleccionar
 * y eliminar solo el interruptor → deshacer/rehacer → cambiar zoom → guardar
 * (serializar) → recargar (deserializar) → verificar que escala, IDs, capas,
 * jerarquía y áreas se mantienen (AC-013).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createCanvasTransforms } from './geometry/coordinateTransform';
import { polygonAreaM2 } from './geometry/polygonGeometry';
import { calibrateScaleConfig } from './geometry/calibration';
import { analyzeDeletion } from './selection/deletionPolicy';
import { hitTestAtPoint } from './selection/hitTest';
import { createScaleConfig, useEditorStore } from './hooks/useEditorStore';
import type { Project, Scene } from './hooks/types';

function makeScene(id: string): Scene {
    return {
        id,
        name: id,
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: createScaleConfig('mm', 0.001, 'Milímetros (1000 = 1m)'),
        rooms: [],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: [],
        lightSwitches: [],
        conductors: [],
        junctionBoxes: [],
        partitions: [],
        electricalDevices: [],
        visible: true,
    } as Scene;
}

describe('Fase 4 — escenario end-to-end de escalado, capas e historial', () => {
    beforeEach(() => {
        useEditorStore.setState({ project: null, activeSceneId: null, result: null, resultsByRoom: {} });
        useEditorStore.getState().resetHistory();
        const project: Project = {
            id: 'proj-e2e',
            name: 'Proyecto E2E',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
            scenes: [makeScene('scene-1')],
        };
        useEditorStore.getState().setProject(project);
        useEditorStore.getState().setActiveScene('scene-1');
        useEditorStore.getState().resetHistory();
    });

    it('1-4: importar plano en mm, calibrar, y el recinto de 8x5.012 da 40.096 m²', () => {
        // 1-2. El plano se detectó como mm (factor 0.001) — simula "importado".
        const scaleBefore = useEditorStore.getState().activeScene()!.scaleConfig;
        expect(scaleBefore.unit).toBe('mm');

        // 3. Calibración manual: el usuario mide 1000 unidades CAD y confirma 1 m.
        const calibrated = calibrateScaleConfig(scaleBefore, 1000, 1)!;
        expect(calibrated.isCalibrated).toBe(true);
        useEditorStore.getState().setScaleConfig(calibrated, true);

        // 4. Dibuja el recinto de referencia (vértices ya en metros calibrados).
        const roomId = useEditorStore.getState().addRoom({
            name: 'Recinto',
            roomType: 'room',
            vertices: [
                { x: 0, y: 0 },
                { x: 8.0, y: 0 },
                { x: 8.0, y: 5.012 },
                { x: 0, y: 5.012 },
            ],
            height: 2.7,
            color: '#fff',
        } as any);

        const room = useEditorStore.getState().activeScene()!.rooms.find((r) => r.id === roomId)!;
        expect(polygonAreaM2(room.vertices)).toBeCloseTo(40.096, 6);
    });

    it('5-11: ambiente + dispositivos superpuestos, seleccionar y eliminar solo el interruptor, undo/redo', () => {
        const store = useEditorStore.getState();

        const recintoId = store.addRoom({
            name: 'Recinto', roomType: 'room',
            vertices: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5.012 }, { x: 0, y: 5.012 }],
            height: 2.7, color: '#fff',
        } as any);
        const ambienteId = store.addRoom({
            name: 'Ambiente', roomType: 'ambient',
            vertices: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 4 }, { x: 1, y: 4 }],
            height: 2.7, color: '#fff',
        } as any);

        const fixtureId = store.addFixture({
            name: 'L1', x: 3, y: 2, z: 2.4, lumens: 4000, efficiency: 0.8,
            fixtureType: 'surface', fixtureShape: 'round', lightColor: '#fff', roomId: ambienteId,
        } as any);

        // Interruptor puesto EXACTAMENTE sobre el borde del ambiente (mismo
        // caso que el "interruptor superpuesto al borde" del plan).
        const switchId = store.addLightSwitch({
            x: 5, y: 2, type: 'single', mountingHeight: 1.4, label: 'S(a)',
        } as any);

        store.addElectricalDevice({
            type: 'outlet_floor', x: 2, y: 3, label: 'TC-01', mountingHeight: 0.4,
            connectedDeviceIds: [], properties: {},
        } as any);

        const scene = useEditorStore.getState().activeScene()!;
        const sceneToCanvas = (x: number, y: number) => ({ x: x * 60, y: y * 60 });
        const clickPt = { x: 5, y: 2 };
        const ranked = hitTestAtPoint(
            {
                fixtures: scene.fixtures,
                lightSwitches: scene.lightSwitches,
                electricalDevices: scene.electricalDevices,
                rooms: scene.rooms,
            },
            sceneToCanvas(clickPt.x, clickPt.y),
            clickPt,
            sceneToCanvas,
        );
        // El interruptor gana sobre ambos recintos superpuestos en ese punto.
        expect(ranked[0].id).toBe(switchId);

        // 10-11. Eliminar SOLO el interruptor — nunca protegido (no es contenedor).
        const analysis = analyzeDeletion(scene, switchId);
        expect(analysis.requiresConfirmation).toBe(false);
        useEditorStore.getState().requestDelete(switchId);

        const afterDelete = useEditorStore.getState().activeScene()!;
        expect(afterDelete.lightSwitches).toHaveLength(0);
        expect(afterDelete.rooms).toHaveLength(2); // recinto y ambiente intactos
        expect(afterDelete.fixtures.map((f) => f.id)).toEqual([fixtureId]);

        // 12. Deshacer la eliminación — el switch vuelve con el mismo id.
        useEditorStore.getState().undo();
        const afterUndo = useEditorStore.getState().activeScene()!;
        expect(afterUndo.lightSwitches.map((s) => s.id)).toEqual([switchId]);
        expect(afterUndo.rooms.map((r) => r.id).sort()).toEqual([ambienteId, recintoId].sort());

        // 13. Rehacer la eliminación.
        useEditorStore.getState().redo();
        expect(useEditorStore.getState().activeScene()!.lightSwitches).toHaveLength(0);
    });

    it('14-15: el área no cambia con el zoom (25%, 100%, 400%)', () => {
        const rectM = [
            { x: 0, y: 0 },
            { x: 8, y: 0 },
            { x: 8, y: 5.012 },
            { x: 0, y: 5.012 },
        ];
        const scaleConfig = useEditorStore.getState().activeScene()!.scaleConfig;

        for (const zoom of [0.25, 1, 4]) {
            const t = createCanvasTransforms(null, scaleConfig, {
                zoom,
                panX: 37,
                panY: -12,
                pxPerMeter: 60,
            });
            const worldPts = rectM.map((p) => t.screenToScene(t.sceneToScreen(p)));
            expect(polygonAreaM2(worldPts)).toBeCloseTo(40.096, 6);
        }
    });

    it('16-18: guardar (serializar) y recargar (deserializar) conserva escala, IDs y áreas (AC-013)', () => {
        const store = useEditorStore.getState();
        const roomId = store.addRoom({
            name: 'Recinto', roomType: 'room',
            vertices: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5.012 }, { x: 0, y: 5.012 }],
            height: 2.7, color: '#fff',
        } as any);
        const calibrated = calibrateScaleConfig(
            useEditorStore.getState().activeScene()!.scaleConfig,
            2000,
            2,
        )!;
        store.setScaleConfig(calibrated, true);

        const beforeSave = useEditorStore.getState().project!;
        // "Guardar": el backend persiste `project` tal cual vía JSON (ver
        // useDialuxProjectSync.ts → JSON.stringify(project)).
        const serialized = JSON.stringify(beforeSave);

        // "Recargar": Show.tsx siembra el store con `project.data` deserializado.
        useEditorStore.setState({ project: null, activeSceneId: null });
        useEditorStore.getState().resetHistory();
        const reloaded: Project = JSON.parse(serialized);
        useEditorStore.getState().setProject(reloaded);
        useEditorStore.getState().setActiveScene(reloaded.scenes[0].id);
        useEditorStore.getState().resetHistory();

        const sceneAfterReload = useEditorStore.getState().activeScene()!;
        const roomAfterReload = sceneAfterReload.rooms.find((r) => r.id === roomId)!;
        expect(roomAfterReload).toBeDefined();
        expect(roomAfterReload.vertices).toEqual(
            beforeSave.scenes[0].rooms.find((r) => r.id === roomId)!.vertices,
        );
        expect(polygonAreaM2(roomAfterReload.vertices)).toBeCloseTo(40.096, 6);
        expect(sceneAfterReload.scaleConfig.calibrationFactor).toBeCloseTo(
            calibrated.calibrationFactor,
            9,
        );
        // El historial NO debe sobrevivir a la recarga (ver criterio 7.8 del plan).
        expect(useEditorStore.getState().historyCanUndo).toBe(false);
    });
});
