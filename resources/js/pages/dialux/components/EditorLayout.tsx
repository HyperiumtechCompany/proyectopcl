/**
 * EditorLayout.tsx - Layout principal del editor DIAlux
 */

import { Link } from '@inertiajs/react';
import { ArrowLeft, Calculator, Check, ChevronDown, Download, Eye, EyeOff, FileCode, FileText, Lightbulb, Pencil, X } from 'lucide-react';
import React, { memo, startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildCalculationSnapshot } from '@/pages/dialux/domain/calculation/buildCalculationSnapshot';
import { hashCalculationSnapshot } from '@/pages/dialux/domain/calculation/hashSnapshot';
import { isCalculationRunStale } from '@/pages/dialux/domain/calculation/staleness';
import { DEFAULT_DIRECT_PREVIEW_CONFIG, type CalculationRun } from '@/pages/dialux/domain/calculation/types';
import { useDialuxPdfExport } from '@/pages/dialux/export';
import { deriveSceneAmbientSpaces } from '@/pages/dialux/hooks/ambientSpaces';
import { linkDialuxPlanFile, unlinkDialuxPlanFile } from '@/pages/dialux/hooks/dialuxPlanStorage';
import { LIGHTING_ENGINE_VERSION } from '@/pages/dialux/hooks/lightingEngineCore';
import { useDialuxCalculationWorker } from '@/pages/dialux/hooks/useDialuxCalculationWorker';
import { markDialuxPlanSyncFailed } from '@/pages/dialux/hooks/useDialuxPlanSyncStatus';
import { createScaleConfig, useEditorStore, useShow3DView } from '@/pages/dialux/hooks/useEditorStore';
import { useLightingEngine } from '@/pages/dialux/hooks/useLightingEngine';
import type { Conductor } from '@/pages/dialux/hooks/types';
import { getFixturesForRoom } from '@/pages/dialux/hooks/roomLighting';
import { calculatePanelCircuitSummaries, calculateRoomWireSummary, resolveTreeConformingSections } from '@/pages/dialux/hooks/wireLengthCalculations';
import { Editor3DCanvas } from './canvas/Editor3DCanvas';
import { CtPanelOutputsDialog } from './CtPanelOutputsDialog';
import { MlightcadCanvas2D } from './canvas/MlightcadCanvas2D';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { DxfExportDialog } from './DxfExportDialog';
import { MlightcadLayerPanel } from './MlightcadLayerPanel';
import { ResultsPanel, type RoomResultSummary } from './ResultsPanel';
import { SidebarPanel } from './SidebarPanel';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';
import { WasmBadge } from './WasmBadge';

const DEMO_SCENE_ID = 'scene-default';

const DEMO_PROJECT = {
    id: 'dialux-demo',
    name: 'Proyecto DIAlux',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    scenes: [
        {
            id: DEMO_SCENE_ID,
            name: 'Planta Baja',
            floorIndex: 0,
            floorElevation: 0,
            floorHeight: 3.0,
            scaleConfig: createScaleConfig('m', 1, 'Metros (1 = 1m)'),
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
            visible: true,
        },
    ],
};

export const EditorLayout = memo(function EditorLayout() {
    const project = useEditorStore((s) => s.project);
    const projectName = useEditorStore((s) => s.project?.name ?? '-');
    const activeScene = useEditorStore((s) => s.activeScene());
    const activeSceneId = useEditorStore((s) => s.activeSceneId);
    const isCalculating = useEditorStore((s) => s.isCalculating);
    const show3DView = useShow3DView();
    const showRoof = useEditorStore((s) => s.ui.showRoof);
    const hasRooms = useEditorStore(
        (s) => (s.activeScene()?.rooms.length ?? 0) > 0,
    );
    const selectedId = useEditorStore((s) => s.ui.selectedId);
    const currentResult = useEditorStore((s) => s.result);
    const resultsByRoom = useEditorStore((s) => s.resultsByRoom);
    const lastCalculationRun = useEditorStore((s) => s.lastCalculationRun);
    const setProject = useEditorStore((s) => s.setProject);
    const setActiveScene = useEditorStore((s) => s.setActiveScene);
    const setCalculating = useEditorStore((s) => s.setCalculating);
    const setResultsByRoom = useEditorStore((s) => s.setResultsByRoom);
    const setResult = useEditorStore((s) => s.setResult);
    const setLastCalculationRun = useEditorStore((s) => s.setLastCalculationRun);
    const setTool = useEditorStore((s) => s.setTool);
    const setSelectedId = useEditorStore((s) => s.setSelectedId);
    const selectedFixtureIds = useEditorStore((s) => s.ui.selectedFixtureIds);
    const requestDelete = useEditorStore((s) => s.requestDelete);
    const pendingDeletion = useEditorStore((s) => s.pendingDeletion);
    const confirmPendingDeletion = useEditorStore((s) => s.confirmPendingDeletion);
    const cancelPendingDeletion = useEditorStore((s) => s.cancelPendingDeletion);
    const undo = useEditorStore((s) => s.undo);
    const redo = useEditorStore((s) => s.redo);
    const historyCanUndo = useEditorStore((s) => s.historyCanUndo);
    const historyCanRedo = useEditorStore((s) => s.historyCanRedo);
    const resetHistory = useEditorStore((s) => s.resetHistory);
    const beginHistoryGesture = useEditorStore((s) => s.beginHistoryGesture);
    const endHistoryGesture = useEditorStore((s) => s.endHistoryGesture);
    const toggle3DView = useEditorStore((s) => s.toggle3DView);
    const toggleRoof = useEditorStore((s) => s.toggleRoof);
    const addFloor = useEditorStore((s) => s.addFloor);
    const removeFloor = useEditorStore((s) => s.removeFloor);
    const duplicateFloor = useEditorStore((s) => s.duplicateFloor);
    const updateFloor = useEditorStore((s) => s.updateFloor);
    const getFloorsSorted = useEditorStore((s) => s.getFloorsSorted);
    const toggleFloorVisibility = useEditorStore((s) => s.toggleFloorVisibility);
    const toggleAllFloors = useEditorStore((s) => s.toggleAllFloors);
    const showAllFloors = useEditorStore((s) => s.ui.showAllFloors);
    const bumpPlanReloadTick = useEditorStore((s) => s.bumpPlanReloadTick);

    const [roomResults, setRoomResults] = useState<RoomResultSummary[]>([]);
    const [resultsModalOpen, setResultsModalOpen] = useState(false);
    const [showFloorPanel, setShowFloorPanel] = useState(false);
    const [editingFloorName, setEditingFloorName] = useState(false);
    const [floorNameDraft, setFloorNameDraft] = useState('');
    const [showWireCalc, setShowWireCalc] = useState(false);
    const [isReusingFloorPlan, setIsReusingFloorPlan] = useState(false);
    const [panelCircuitSummaries, setPanelCircuitSummaries] = useState<
        ReturnType<typeof calculatePanelCircuitSummaries>
    >([]);
    const [isCtCalculating, setIsCtCalculating] = useState(false);
    useEffect(() => {
        if (!showWireCalc) {
            setIsCtCalculating(false);
            return;
        }

        let cancelled = false;
        let sceneIndex = 0;
        const scenes = project?.scenes ?? [];
        const calculated: ReturnType<typeof calculatePanelCircuitSummaries> = [];
        setPanelCircuitSummaries([]);
        setIsCtCalculating(true);

        const calculateNextScene = () => {
            if (cancelled) return;
            const scene = scenes[sceneIndex];
            if (!scene) {
                calculated.sort((a, b) => a.levelIndex - b.levelIndex);
                setPanelCircuitSummaries(calculated);
                setIsCtCalculating(false);
                return;
            }

            calculated.push(...calculatePanelCircuitSummaries(scene));
            sceneIndex += 1;
            window.requestAnimationFrame(calculateNextScene);
        };

        const initialFrame = window.requestAnimationFrame(calculateNextScene);
        return () => {
            cancelled = true;
            window.cancelAnimationFrame(initialFrame);
        };
    }, [showWireCalc, project]);
    // Resuelve el ambiente relevante para "Cálculo CT" a partir de lo que el
    // usuario tenga seleccionado: el propio ambiente, una luminaria dentro de
    // él, o un cable conectado a una de sus luminarias — no solo un clic
    // directo sobre el polígono del ambiente.
    const selectedRoom = (() => {
        if (!activeScene) return null;
        const direct = activeScene.rooms.find((r) => r.id === selectedId);
        if (direct) return direct;

        const fixture = activeScene.fixtures.find((f) => f.id === selectedId);
        if (fixture?.roomId) {
            const room = activeScene.rooms.find((r) => r.id === fixture.roomId);
            if (room) return room;
        }

        const conductor = activeScene.conductors?.find((c) => c.id === selectedId);
        if (conductor) {
            const endpointFixture = activeScene.fixtures.find(
                (f) => f.id === conductor.sourceId || f.id === conductor.targetId,
            );
            if (endpointFixture?.roomId) {
                const room = activeScene.rooms.find((r) => r.id === endpointFixture.roomId);
                if (room) return room;
            }
        }

        return null;
    })();
    const selectedCtRoomSummary = useMemo(() => {
        if (!showWireCalc || !activeScene || !selectedRoom) return null;
        return {
            name: selectedRoom.name,
            wire: calculateRoomWireSummary(
                activeScene,
                getFixturesForRoom(selectedRoom, activeScene.fixtures),
            ),
        };
    }, [showWireCalc, activeScene, selectedRoom]);
    const updateCtCircuit = useCallback(
        (
            levelId: string,
            conductorId: string,
            patch: Partial<NonNullable<Conductor['ct']>>,
        ) => {
            if (!project) return;
            setProject({
                ...project,
                scenes: project.scenes.map((scene) =>
                    scene.id !== levelId
                        ? scene
                        : {
                            ...scene,
                            conductors: (scene.conductors ?? []).map(
                                (conductor) =>
                                    conductor.id === conductorId
                                        ? {
                                            ...conductor,
                                            ct: {
                                                ...(conductor.ct ?? {}),
                                                ...patch,
                                            },
                                        }
                                        : conductor,
                            ),
                        },
                ),
            });
        },
        [project, setProject],
    );

    const updateCtSection = useCallback(
        (levelId: string, conductorId: string, sectionMm2: number) => {
            if (!project) return;
            setProject({
                ...project,
                scenes: project.scenes.map((scene) =>
                    scene.id !== levelId
                        ? scene
                        : {
                            ...scene,
                            conductors: (scene.conductors ?? []).map(
                                (conductor) =>
                                    conductor.id === conductorId
                                        ? {
                                            ...conductor,
                                            sectionMm2,
                                            // Limpia el amperaje nominal manual para que se
                                            // recalcule de la tabla de ampacidad con la nueva
                                            // sección (si el usuario no lo había forzado, ya
                                            // era undefined y esto es un no-op).
                                            ct: {
                                                ...(conductor.ct ?? {}),
                                                nominalCableCurrentA: undefined,
                                            },
                                        }
                                        : conductor,
                            ),
                        },
                ),
            });
        },
        [project, setProject],
    );

    // "Verificar y corregir todo el árbol": recorre cada piso (cada uno es
    // un árbol TG→TD→circuitos independiente) y sube en cascada las
    // secciones no conformes — a diferencia de `updateCtSection` (una sola
    // salida), esto puede tocar varios tableros a la vez porque arreglar un
    // alimentador cambia el ΔV heredado de sus hijos.
    const applyTreeCompliance = useCallback(() => {
        if (!project) return;
        setProject({
            ...project,
            scenes: project.scenes.map((scene) => {
                const fixes = resolveTreeConformingSections(scene);
                if (fixes.length === 0) return scene;
                const fixById = new Map(fixes.map((fix) => [fix.conductorId, fix.sectionMm2]));
                return {
                    ...scene,
                    conductors: (scene.conductors ?? []).map((conductor) =>
                        fixById.has(conductor.id)
                            ? {
                                  ...conductor,
                                  sectionMm2: fixById.get(conductor.id)!,
                                  ct: {
                                      ...(conductor.ct ?? {}),
                                      nominalCableCurrentA: undefined,
                                  },
                              }
                            : conductor,
                    ),
                };
            }),
        });
    }, [project, setProject]);

    const engine = useLightingEngine();
    const calcWorker = useDialuxCalculationWorker();
    const { exportPdf, isExporting, exportStep } = useDialuxPdfExport();

    const floorsSorted = getFloorsSorted();

    // Los pisos nuevos heredan el plano del piso activo al momento de
    // crearlos (lo más común: 1er, 2do y 3er piso comparten el mismo
    // plano). El usuario puede reemplazarlo para un piso puntual (ej. el
    // 4to piso) subiendo un archivo distinto desde la barra de
    // herramientas; eso desvincula solo ese piso sin afectar a los demás.
    const linkInheritedPlan = useCallback(
        async (newSceneId: string, sourceSceneId: string | null): Promise<void> => {
            if (!project?.id || !sourceSceneId) return;
            try {
                await linkDialuxPlanFile(project.id, newSceneId, sourceSceneId);
            } catch (error) {
                console.warn('No se pudo heredar el plano del piso de origen.', error);
                markDialuxPlanSyncFailed(newSceneId);
            }
        },
        [project?.id],
    );

    // Se espera a que el vínculo del plano termine antes de cambiar de piso
    // activo: así el canvas nunca llega a preguntar por el servidor antes
    // de que exista el vínculo (evitaría un "piso en blanco" momentáneo).
    const handleAddFloorAbove = useCallback(() => {
        const maxIndex = Math.max(...floorsSorted.map((f) => f.floorIndex ?? 0), 0);
        const sourceSceneId = activeSceneId;
        const newId = addFloor(`Piso ${maxIndex + 1}`, maxIndex + 1, 3.0);
        void linkInheritedPlan(newId, sourceSceneId).finally(() => setActiveScene(newId));
    }, [activeSceneId, addFloor, floorsSorted, linkInheritedPlan, setActiveScene]);

    const handleAddBasement = useCallback(() => {
        const minIndex = Math.min(...floorsSorted.map((f) => f.floorIndex ?? 0), 0);
        const sourceSceneId = activeSceneId;
        const newId = addFloor(`Sótano ${Math.abs(minIndex - 1)}`, minIndex - 1, 3.0);
        void linkInheritedPlan(newId, sourceSceneId).finally(() => setActiveScene(newId));
    }, [activeSceneId, addFloor, floorsSorted, linkInheritedPlan, setActiveScene]);

    const handleDuplicateFloor = useCallback(() => {
        if (!activeSceneId || !activeScene) return;
        const maxIndex = Math.max(...floorsSorted.map((f) => f.floorIndex ?? 0), 0);
        const newId = duplicateFloor(
            activeSceneId,
            maxIndex + 1,
            `${activeScene.name} (copia)`,
        );
        void linkInheritedPlan(newId, activeSceneId).finally(() => setActiveScene(newId));
    }, [activeSceneId, activeScene, duplicateFloor, floorsSorted, linkInheritedPlan, setActiveScene]);

    const handleRemoveFloor = useCallback(() => {
        if (!activeSceneId || floorsSorted.length <= 1) return;
        const removedSceneId = activeSceneId;
        removeFloor(removedSceneId);
        if (project?.id) {
            void unlinkDialuxPlanFile(project.id, removedSceneId);
        }
    }, [activeSceneId, floorsSorted.length, project?.id, removeFloor]);

    // Para pisos que ya existían antes de que se agregara la herencia
    // automática de plano (o si el usuario simplemente cambió de opinión),
    // esto permite reutilizar el plano de cualquier otro piso del proyecto
    // en el piso activo, sin volver a subir el archivo.
    const handleReuseFloorPlan = useCallback(
        async (sourceSceneId: string) => {
            if (!activeSceneId || !project?.id || !sourceSceneId) return;
            setIsReusingFloorPlan(true);
            try {
                await linkDialuxPlanFile(project.id, activeSceneId, sourceSceneId);
                bumpPlanReloadTick();
            } catch (error) {
                console.warn('No se pudo reutilizar el plano del piso seleccionado.', error);
                markDialuxPlanSyncFailed(activeSceneId);
            } finally {
                setIsReusingFloorPlan(false);
            }
        },
        [activeSceneId, project?.id, bumpPlanReloadTick],
    );

    const handleStartFloorNameEdit = useCallback(() => {
        if (!activeScene) return;
        setFloorNameDraft(activeScene.name);
        setEditingFloorName(true);
    }, [activeScene]);

    const handleSaveFloorName = useCallback(() => {
        const nextName = floorNameDraft.trim();
        if (!activeSceneId || nextName === '') return;
        updateFloor(activeSceneId, { name: nextName });
        setEditingFloorName(false);
    }, [activeSceneId, floorNameDraft, updateFloor]);

    const floorLabel = (f: { floorIndex: number; name: string }) => {
        if (f.floorIndex === 0) return `PB · ${f.name}`;
        if (f.floorIndex > 0) return `P${f.floorIndex} · ${f.name}`;
        return `S${Math.abs(f.floorIndex)} · ${f.name}`;
    };


    const handleExportPdf = useCallback(() => {
        void exportPdf().catch((error: unknown) => {
            console.error('Error al exportar el PDF de DIAlux:', error);
        });
    }, [exportPdf]);

    useEffect(() => {
        if (project) return;
        setProject(DEMO_PROJECT);
        setActiveScene(DEMO_SCENE_ID);
        // La carga inicial del proyecto no es una acción del usuario: no debe
        // quedar en el historial como "un paso deshacible" (Ctrl+Z no debe
        // poder vaciar el proyecto de vuelta a null).
        resetHistory();
    }, [project, setActiveScene, setProject, resetHistory]);

    const runCalc = useCallback(async () => {
        const scenes = project?.scenes ?? [];
        if (!project || !engine.ready || !scenes.some((scene) => scene.rooms.length > 0)) return;

        setCalculating(true);
        try {
            // Ambientes locales (room/fixtures) para `ResultsPanel`/`RoomLightingSection`
            // — misma derivación que usa `buildCalculationSnapshot` internamente
            // (`deriveSceneAmbientSpaces`, no la primitiva por-room), así
            // `ambient.room.id` coincide exactamente con `objectId` en
            // `CalculationRun.surfaces` (Fase 12: "Rendimiento: Worker y WASM").
            const ambientsByScene = scenes.map((scene) => ({
                scene,
                ambients: deriveSceneAmbientSpaces(scene),
            }));

            const snapshot = buildCalculationSnapshot(project);

            let run: CalculationRun;
            try {
                // Cálculo real en un Web Worker (no bloquea la UI mientras corre) —
                // el worker intenta acelerar el término directo con el kernel
                // WASM de `dialux-core`; si no está disponible, usa el motor TS
                // puro, con el mismo resultado.
                run = await calcWorker.calculate(snapshot);
            } catch (workerError) {
                console.warn(
                    '[Dialux] El worker de cálculo falló, se usa el motor síncrono de respaldo en el hilo principal.',
                    workerError,
                );
                const fallbackStartedAt = new Date().toISOString();
                const fallbackSurfaces: CalculationRun['surfaces'] = [];
                for (const { scene, ambients } of ambientsByScene) {
                    for (const ambient of ambients) {
                        fallbackSurfaces.push({
                            objectId: ambient.room.id,
                            objectName: ambient.name,
                            levelId: scene.id,
                            result: await engine.calculate(ambient.room, ambient.fixtures),
                        });
                    }
                }
                // Fase 13 (§11: "invalidar si stale"): incluso el camino de
                // respaldo produce un `CalculationRun` real (con hash), para
                // que `lastCalculationRun`/`isCalculationRunStale` funcionen
                // igual sin importar qué camino haya calculado el resultado.
                run = {
                    id: `run-fallback-${Date.now()}`,
                    engineVersion: LIGHTING_ENGINE_VERSION,
                    snapshotHash: await hashCalculationSnapshot(snapshot),
                    status: 'completed',
                    config: DEFAULT_DIRECT_PREVIEW_CONFIG,
                    startedAt: fallbackStartedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: 0,
                    warnings: [],
                    surfaces: fallbackSurfaces,
                };
            }

            setLastCalculationRun(run);
            const resultByObjectId = new Map(run.surfaces.map((surface) => [surface.objectId, surface.result]));

            const calculations: RoomResultSummary[] = ambientsByScene.flatMap(({ scene, ambients }) =>
                ambients
                    .filter((ambient) => resultByObjectId.has(ambient.room.id))
                    .map((ambient) => ({
                        room: ambient.room,
                        fixtures: ambient.fixtures,
                        result: resultByObjectId.get(ambient.room.id)!,
                        sourceRoomName: ambient.roomName,
                        levelId: scene.id,
                        levelName: scene.name,
                        levelIndex: scene.floorIndex ?? 0,
                    })),
            );

            // Una tabla con muchos ambientes es trabajo visual no urgente;
            // el canvas y los controles mantienen prioridad interactiva.
            startTransition(() => {
                setRoomResults(calculations);
                if (run.status !== 'cancelled') {
                    setResultsModalOpen(calculations.length > 0);
                }
            });
            setResultsByRoom(
                Object.fromEntries(
                    calculations.map(({ room, result }) => [room.id, result]),
                ),
            );
            // Un cálculo cancelado actualiza los resultados parciales sin
            // abrir el modal — el usuario pidió detenerlo, no verlo de golpe.
            const selectedRoomResult =
                calculations.find(({ room }) => room.id === selectedId) ??
                calculations.find(({ room }) =>
                    room.id.startsWith(`${selectedId}::ambient-`),
                ) ??
                calculations[0] ??
                null;

            setResult(selectedRoomResult?.result ?? null);
        } finally {
            setCalculating(false);
        }
    }, [
        calcWorker,
        engine,
        project,
        selectedId,
        setCalculating,
        setLastCalculationRun,
        setResult,
        setResultsByRoom,
    ]);
    // Fase 13 (§11: "invalidar... si el resultado está stale"): compara el
    // hash del proyecto actual contra `lastCalculationRun.snapshotHash` —
    // por comparación, no por evento empujado en cada mutación
    // (`domain/calculation/staleness.ts`, ADR 0002 punto 6). Sin un run
    // guardado (nunca se calculó) no hay nada que comparar: no se marca
    // como desactualizado, se marca como "sin calcular" (ya lo indica
    // `hasRooms`/`resultsByRoom` vacío en la UI existente).
    const [isResultsStale, setIsResultsStale] = useState(false);
    useEffect(() => {
        if (!project || !lastCalculationRun) {
            setIsResultsStale(false);
            return;
        }
        let cancelled = false;
        isCalculationRunStale(lastCalculationRun, project).then((stale) => {
            if (!cancelled) {
                setIsResultsStale(stale);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [project, lastCalculationRun]);

    /**buttons esportados */
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showDxfExportDialog, setShowDxfExportDialog] = useState(false);

    const isExportDisabled = !project || isExporting;

    useEffect(() => {
        if (!activeScene || activeScene.rooms.length === 0) {
            if (currentResult !== null) {
                setResult(null);
            }
            return;
        }

        const selectedRoomId = activeScene.rooms.some(
            (room) => room.id === selectedId,
        )
            ? selectedId
            : activeScene.rooms[0]?.id;

        if (!selectedRoomId) {
            if (currentResult !== null) {
                setResult(null);
            }
            return;
        }

        const nextResult =
            resultsByRoom[selectedRoomId] ??
            Object.entries(resultsByRoom).find(([id]) =>
                id.startsWith(`${selectedRoomId}::ambient-`),
            )?.[1] ??
            null;
        if (currentResult !== nextResult) {
            setResult(nextResult);
        }
    }, [activeScene, currentResult, resultsByRoom, selectedId, setResult]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) {
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                const key = e.key.toLowerCase();
                if (key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) redo();
                    else undo();
                    return;
                }
                if (key === 'y') {
                    e.preventDefault();
                    redo();
                    return;
                }
                // No interceptar otras combinaciones Ctrl/Cmd (copiar, pegar,
                // guardar del navegador, etc.) con los atajos de una sola tecla.
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'v':
                    setTool('select');
                    break;
                case 'r':
                    setTool('room');
                    break;
                case 'w':
                    setTool('wall');
                    break;
                case 'i':
                    setTool('switch');
                    break;
                case 'u':
                    setTool('wire');
                    break;
                case 'n':
                    setTool('window');
                    break;
                case 'c':
                    setTool('canopy');
                    break;
                case 'f':
                    setTool('fixture');
                    break;
                case 'm':
                    setTool('measure');
                    break;
                case 'k':
                    setTool('calibrate');
                    break;
                case ' ':
                    e.preventDefault();
                    setTool('pan');
                    break;
                case 'delete':
                case 'backspace':
                    if (selectedFixtureIds.length > 1) {
                        beginHistoryGesture();
                        selectedFixtureIds.forEach((id) => requestDelete(id));
                        endHistoryGesture();
                    } else if (selectedId) {
                        requestDelete(selectedId);
                    }
                    break;
                case 'enter':
                    runCalc();
                    break;
                case 'escape':
                    setTool('select');
                    setSelectedId(null);
                    break;
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [
        beginHistoryGesture,
        endHistoryGesture,
        redo,
        requestDelete,
        runCalc,
        selectedFixtureIds,
        selectedId,
        setSelectedId,
        setTool,
        undo,
    ]);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-[#0d0f14] text-gray-200 select-none">
            <header id="dialux-header" className="flex h-11 shrink-0 items-center gap-3 border-b border-gray-800/60 bg-[#161820] px-4">
                <Link
                    id="dialux-btn-back-to-list"
                    href="/dialux"
                    title="Volver a mis proyectos"
                    className="flex items-center gap-1.5 rounded border border-gray-700/60 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
                >
                    <ArrowLeft size={13} />
                    Proyectos
                </Link>

                <div className="flex min-w-0 items-center gap-2">
                    <Lightbulb size={16} className="text-amber-400" />
                    <span className="bg-gradient-to-r from-amber-400 to-cyan-400 bg-clip-text text-sm font-bold tracking-wide text-transparent">
                        DIAlux Web
                    </span>
                </div>

                <span className="max-w-40 truncate text-xs text-gray-500">
                    {projectName}
                </span>

                <div className="flex items-center gap-1.5 rounded border border-cyan-900/40 bg-cyan-950/50 px-2 py-1 font-mono text-[9px] tracking-wider text-cyan-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    mlightcad
                </div>

                {/* ── Floor Navigator ── */}
                {project && (
                    <div className="relative flex items-center gap-1">
                        {/* Active floor badge + dropdown toggle */}
                        <button
                            id="dialux-floor-selector"
                            onClick={() => setShowFloorPanel((v) => !v)}
                            title="Gestionar pisos"
                            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold transition-all ${showFloorPanel
                                ? 'border-amber-600/60 bg-amber-950/60 text-amber-300'
                                : 'border-slate-700/60 bg-slate-900/60 text-slate-300 hover:border-amber-700/40 hover:text-amber-300'
                                }`}
                        >
                            <span className="text-amber-400">⬛</span>
                            <span>
                                {activeScene
                                    ? floorLabel({
                                        floorIndex: activeScene.floorIndex ?? 0,
                                        name: activeScene.name,
                                    })
                                    : '—'}
                            </span>
                            {floorsSorted.length > 1 && (
                                <span className="ml-0.5 rounded bg-slate-700/60 px-1 text-[9px] text-slate-400">
                                    {floorsSorted.length}
                                </span>
                            )}
                        </button>

                        {/* Floor panel dropdown */}
                        {showFloorPanel && (
                            <div
                                className="absolute top-full left-0 z-50 mt-1 min-w-52 rounded-lg border border-slate-700/60 bg-[#191c2c] shadow-2xl"
                            >
                                <div className="border-b border-slate-700/40 px-3 py-1.5 text-[9px] font-bold tracking-widest text-slate-500 uppercase">
                                    Pisos del Proyecto
                                </div>
                                <div className="max-h-52 overflow-y-auto py-1">
                                    {[...floorsSorted].reverse().map((floor) => (
                                        <div
                                            key={floor.id}
                                            className={`flex w-full items-center gap-1 px-2 py-1 text-[11px] transition-colors ${floor.id === activeSceneId
                                                ? 'bg-amber-900/30'
                                                : 'hover:bg-slate-800/60'
                                                }`}
                                        >
                                            {/* Eye toggle */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleFloorVisibility(floor.id); }}
                                                title={(floor.visible ?? true) ? 'Ocultar piso' : 'Mostrar piso'}
                                                className="shrink-0 rounded p-0.5 text-slate-500 hover:text-amber-300"
                                            >
                                                {(floor.visible ?? true)
                                                    ? <Eye size={11} />
                                                    : <EyeOff size={11} className="text-slate-700" />
                                                }
                                            </button>
                                            {/* Floor selector */}
                                            <button
                                                onClick={() => { setActiveScene(floor.id); setShowFloorPanel(false); }}
                                                className={`flex flex-1 items-center gap-2 text-left ${floor.id === activeSceneId ? 'text-amber-300' : 'text-slate-400 hover:text-slate-100'
                                                    } ${(floor.visible ?? true) ? '' : 'opacity-40'}`}
                                            >
                                                <span className="font-mono text-[9px] w-6 text-center text-slate-500">
                                                    {floor.floorIndex === 0 ? 'PB' : floor.floorIndex > 0 ? `P${floor.floorIndex}` : `S${Math.abs(floor.floorIndex)}`}
                                                </span>
                                                <span className="flex-1 truncate">{floor.name}</span>
                                                <span className="text-[9px] text-slate-600 font-mono">
                                                    {(floor.floorElevation ?? 0).toFixed(1)}m
                                                </span>
                                                {floor.id === activeSceneId && (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-slate-700/40 p-1.5 space-y-1">
                                    {/* Ver todos los pisos toggle */}
                                    <button
                                        onClick={toggleAllFloors}
                                        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-[10px] transition-colors ${showAllFloors
                                            ? 'bg-cyan-900/40 text-cyan-300'
                                            : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                                            }`}
                                        title={showAllFloors ? 'Mostrar solo piso activo' : 'Ver todos los pisos superpuestos'}
                                    >
                                        <Eye size={11} />
                                        {showAllFloors ? 'Modo: Todos los pisos' : 'Ver todos los pisos'}
                                    </button>
                                    {editingFloorName ? (
                                        <form
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                handleSaveFloorName();
                                            }}
                                            className="flex items-center gap-1 px-1">
                                            <input
                                                autoFocus
                                                value={floorNameDraft}
                                                onChange={(event) => setFloorNameDraft(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Escape') {
                                                        setEditingFloorName(false);
                                                    }
                                                }}
                                                aria-label="Nombre del piso"
                                                className="min-w-0 flex-1 rounded border border-amber-700/60 bg-slate-950 px-2 py-1 text-[10px] text-slate-100 outline-none focus:border-amber-400"
                                            />
                                            <button
                                                type="submit"
                                                disabled={floorNameDraft.trim() === ''}
                                                title="Guardar nombre"
                                                className="rounded p-1 text-emerald-400 hover:bg-emerald-950/50 disabled:opacity-30">
                                                <Check size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingFloorName(false)}
                                                title="Cancelar edición"
                                                className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200">
                                                <X size={12} />
                                            </button>
                                        </form>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleStartFloorNameEdit}
                                            disabled={!activeScene}
                                            className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-slate-100 disabled:opacity-30"
                                            title="Editar nombre del piso activo">
                                            <Pencil size={11} />
                                            Editar nombre
                                        </button>
                                    )}
                                    {activeScene && (
                                        <label className="flex items-center justify-between gap-2 rounded px-2 py-1 text-[10px] text-slate-400">
                                            <span>Altura piso–techo</span>
                                            <span className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={20}
                                                    step={0.05}
                                                    value={activeScene.floorHeight ?? 3}
                                                    onChange={(event) => {
                                                        const floorHeight = Number(event.target.value);
                                                        if (
                                                            Number.isFinite(floorHeight) &&
                                                            floorHeight >= 1 &&
                                                            floorHeight <= 20
                                                        ) {
                                                            updateFloor(activeScene.id, {
                                                                floorHeight,
                                                            });
                                                        }
                                                    }}
                                                    aria-label="Altura piso a techo"
                                                    className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-right font-mono text-[10px] text-cyan-300 outline-none focus:border-cyan-500"
                                                />
                                                <span>m</span>
                                            </span>
                                        </label>
                                    )}
                                    {activeScene && floorsSorted.length > 1 && (
                                        <label className="flex items-center justify-between gap-2 rounded px-2 py-1 text-[10px] text-slate-400">
                                            <span>Copiar plano de</span>
                                            <select
                                                value=""
                                                disabled={isReusingFloorPlan}
                                                onChange={(event) => {
                                                    const sourceId = event.target.value;
                                                    if (sourceId) void handleReuseFloorPlan(sourceId);
                                                    event.target.value = '';
                                                }}
                                                aria-label="Copiar plano de otro piso"
                                                className="min-w-0 max-w-28 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[10px] text-cyan-300 outline-none focus:border-cyan-500 disabled:opacity-50"
                                            >
                                                <option value="">
                                                    {isReusingFloorPlan ? 'Copiando…' : 'Elegir piso…'}
                                                </option>
                                                {floorsSorted
                                                    .filter((f) => f.id !== activeScene.id)
                                                    .map((f) => (
                                                        <option key={f.id} value={f.id}>
                                                            {floorLabel({ floorIndex: f.floorIndex ?? 0, name: f.name })}
                                                        </option>
                                                    ))}
                                            </select>
                                        </label>
                                    )}
                                    <div className="grid grid-cols-2 gap-1">
                                        <button
                                            onClick={() => { handleAddFloorAbove(); setShowFloorPanel(false); }}
                                            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-700/50 hover:text-slate-100"
                                            title="Agregar piso arriba"
                                        >
                                            <span>↑</span> Piso arriba
                                        </button>
                                        <button
                                            onClick={() => { handleAddBasement(); setShowFloorPanel(false); }}
                                            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-700/50 hover:text-slate-100"
                                            title="Agregar sótano"
                                        >
                                            <span>↓</span> Sótano
                                        </button>
                                        <button
                                            onClick={() => { handleDuplicateFloor(); setShowFloorPanel(false); }}
                                            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-700/50 hover:text-slate-100"
                                            title="Duplicar piso activo"
                                        >
                                            <span>⧉</span> Duplicar
                                        </button>
                                        <button
                                            onClick={() => { handleRemoveFloor(); setShowFloorPanel(false); }}
                                            disabled={floorsSorted.length <= 1}
                                            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-red-500 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-30"
                                            title="Eliminar piso activo"
                                        >
                                            <span>✕</span> Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => undo()}
                        disabled={!historyCanUndo}
                        title="Deshacer (Ctrl+Z)"
                        className="rounded border border-gray-700/60 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        ↶
                    </button>
                    <button
                        onClick={() => redo()}
                        disabled={!historyCanRedo}
                        title="Rehacer (Ctrl+Y / Ctrl+Shift+Z)"
                        className="rounded border border-gray-700/60 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        ↷
                    </button>
                </div>

                <div className="flex-1" />

                <button
                    onClick={toggle3DView}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-all ${show3DView
                        ? 'bg-purple-700/80 text-purple-200'
                        : 'bg-cyan-700/80 text-cyan-200 hover:bg-cyan-600/80'
                        }`}
                    title={
                        show3DView ? 'Cambiar a vista 2D' : 'Cambiar a vista 3D'
                    }>
                    {show3DView ? '3D' : '2D'}
                </button>

                {show3DView && (
                    <button
                        onClick={toggleRoof}
                        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-all ${showRoof
                            ? 'bg-slate-700 text-slate-100'
                            : 'bg-slate-900/70 text-slate-400 hover:bg-slate-800'
                            }`}
                        title={showRoof ? 'Ocultar techo 3D' : 'Mostrar techo 3D'}
                    >
                        {showRoof ? <Eye size={13} /> : <EyeOff size={13} />}
                        Techo
                    </button>
                )}

                <WasmBadge ready={engine.ready} label="Motor JS" />

                <div className="flex items-center gap-2">
                    <button
                        id="dialux-btn-calcular"
                        onClick={runCalc}
                        disabled={!engine.ready || isCalculating || !hasRooms}
                        className="flex items-center gap-1.5 rounded bg-gradient-to-r from-green-700/80 to-emerald-700/80 px-3 py-1.5 text-xs text-green-200 shadow-sm transition-all hover:from-green-600/80 hover:to-emerald-600/80 disabled:cursor-not-allowed disabled:opacity-40">
                        <Calculator size={13} />
                        {isCalculating ? 'Calculando...' : 'Calcular'}
                    </button>

                    {isCalculating && (
                        <button
                            id="dialux-btn-cancelar-calculo"
                            onClick={calcWorker.cancel}
                            title="Cancelar el cálculo en curso"
                            className="flex items-center gap-1.5 rounded bg-red-900/60 px-2.5 py-1.5 text-xs text-red-200 shadow-sm transition-all hover:bg-red-800/70"
                        >
                            <X size={13} />
                            Cancelar
                        </button>
                    )}

                    {!isCalculating && isResultsStale && (
                        <span
                            id="dialux-badge-resultados-desactualizados"
                            title="El proyecto cambió desde el último cálculo — vuelve a calcular para ver resultados al día."
                            className="flex items-center gap-1 rounded bg-amber-900/40 px-2 py-1 text-[11px] text-amber-300"
                        >
                            Resultados desactualizados
                        </span>
                    )}

                    <button
                        id="dialux-btn-calculo-ct"
                        onClick={() => setShowWireCalc(true)}
                        disabled={!activeScene}
                        className="flex items-center gap-1.5 rounded border border-cyan-700/40 bg-cyan-950/60 px-3 py-1.5 text-xs text-cyan-100 transition-all hover:bg-cyan-900/70 disabled:cursor-not-allowed disabled:opacity-40"
                        title={selectedRoom ? `Cálculo CT — ${selectedRoom.name}` : 'Selecciona un ambiente, una luminaria o un cable (en el panel Objetos) para ver su Cálculo CT'}
                    >
                        <Calculator size={13} />
                        Cálculo CT
                    </button>

                    <div className="relative">
                        <button
                            id="dialux-btn-export"
                            onClick={() => setShowExportMenu((prev) => !prev)}
                            disabled={!project}
                            className="flex items-center gap-1.5 rounded border border-cyan-700/40 bg-cyan-950/60 px-3 py-1.5 text-xs text-cyan-100 transition-all hover:bg-cyan-900/70 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Exportar proyecto">
                            <Download size={13} />

                            {isExporting
                                ? exportStep || "Exportando PDF..."
                                : "Exportar"}

                            <ChevronDown size={13} />
                        </button>

                        {showExportMenu && (
                            <div className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded border border-slate-700 bg-slate-950 shadow-lg">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowExportMenu(false);
                                        handleExportPdf();
                                    }}
                                    disabled={!project || isExporting}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-100 transition hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-40">
                                    <FileText size={13} />
                                    Exportar PDF
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowExportMenu(false);
                                        setShowDxfExportDialog(true);
                                    }}
                                    disabled={!project}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-100 transition hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:opacity-40">
                                    <FileCode size={13} />
                                    Exportar DXF
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <Toolbar />

                <main className="relative flex flex-1 flex-col overflow-hidden">
                    <div
                        className="relative flex h-full w-full flex-1 flex-col overflow-hidden"
                        style={{ display: show3DView ? 'none' : 'flex' }}>
                        <MlightcadCanvas2D isVisible={!show3DView} />
                        <div className="pointer-events-none absolute top-1 left-1 rounded border border-cyan-900/30 bg-slate-900/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-cyan-800">
                            2D - mlightcad
                        </div>
                        <MlightcadLayerPanel />
                    </div>

                    <div
                        className="relative h-full w-full flex-1"
                        style={{ display: show3DView ? 'flex' : 'none' }}>
                        <Editor3DCanvas isVisible={show3DView} />
                    </div>
                </main>

                <SidebarPanel />
            </div>

            <StatusBar />

            <DeleteConfirmDialog
                analysis={pendingDeletion}
                onCancel={cancelPendingDeletion}
                onConfirm={confirmPendingDeletion}
            />

            <DxfExportDialog open={showDxfExportDialog} onOpenChange={setShowDxfExportDialog} />

            <Dialog open={resultsModalOpen} onOpenChange={setResultsModalOpen}>
                <DialogContent className="flex h-[96dvh] w-[calc(100vw-1rem)] max-w-[1600px] flex-col gap-0 overflow-hidden border-slate-800 bg-[#090b10] p-0 text-slate-100 sm:h-[94dvh] sm:w-[96vw] sm:max-w-[1600px]">
                    <DialogHeader className="shrink-0 border-b border-slate-800/80 px-4 py-4 pr-12 text-left sm:px-6 sm:py-5">
                        <DialogTitle className="text-base font-semibold tracking-tight text-white sm:text-lg">
                            Resultados de iluminacion por recinto
                        </DialogTitle>
                        <DialogDescription className="max-w-3xl text-xs leading-relaxed text-slate-400 sm:text-sm">
                            Se captura la luminaria insertada en cada espacio y
                            se resume el calculo en una tabla.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                        <ResultsPanel rooms={roomResults} calculationRun={lastCalculationRun} />
                    </div>
                </DialogContent>
            </Dialog>

            {activeScene && (
                <CtPanelOutputsDialog
                    open={showWireCalc}
                    onOpenChange={setShowWireCalc}
                    circuits={panelCircuitSummaries}
                    loading={isCtCalculating}
                    onUpdateCircuit={updateCtCircuit}
                    onFixSection={updateCtSection}
                    onFixTree={applyTreeCompliance}
                    selectedRoom={selectedCtRoomSummary}
                />
            )}

        </div>
    );
});
