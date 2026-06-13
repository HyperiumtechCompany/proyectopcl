/**
 * EditorLayout.tsx - Layout principal del editor DIAlux
 */

import { Calculator, Download, Eye, EyeOff, Lightbulb } from 'lucide-react';
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useDialuxDxfExport, useDialuxPdfExport } from '@/dialux-export';
import { deriveAmbientSpaces } from '@/hooks/dialux/ambientSpaces';
import {
    createScaleConfig,
    useEditorStore,
    useShow3DView,
} from '@/hooks/dialux/useEditorStore';
import { useLightingEngine } from '@/hooks/dialux/useLightingEngine';
import { Editor3DCanvas } from './canvas/Editor3DCanvas';
import { MlightcadCanvas2D } from './canvas/MlightcadCanvas2D';
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
    const setProject = useEditorStore((s) => s.setProject);
    const setActiveScene = useEditorStore((s) => s.setActiveScene);
    const setCalculating = useEditorStore((s) => s.setCalculating);
    const setResultsByRoom = useEditorStore((s) => s.setResultsByRoom);
    const setResult = useEditorStore((s) => s.setResult);
    const setTool = useEditorStore((s) => s.setTool);
    const setSelectedId = useEditorStore((s) => s.setSelectedId);
    const removeObject = useEditorStore((s) => s.removeObject);
    const toggle3DView = useEditorStore((s) => s.toggle3DView);
    const toggleRoof = useEditorStore((s) => s.toggleRoof);
    const addFloor = useEditorStore((s) => s.addFloor);
    const removeFloor = useEditorStore((s) => s.removeFloor);
    const duplicateFloor = useEditorStore((s) => s.duplicateFloor);
    const getFloorsSorted = useEditorStore((s) => s.getFloorsSorted);
    const toggleFloorVisibility = useEditorStore((s) => s.toggleFloorVisibility);
    const toggleAllFloors = useEditorStore((s) => s.toggleAllFloors);
    const showAllFloors = useEditorStore((s) => s.ui.showAllFloors);

    const [roomResults, setRoomResults] = useState<RoomResultSummary[]>([]);
    const [resultsModalOpen, setResultsModalOpen] = useState(false);
    const [showFloorPanel, setShowFloorPanel] = useState(false);
    const engine = useLightingEngine();
    const { exportPdf, isExporting, exportStep } = useDialuxPdfExport();
    const { exportDxf, isExporting: isExportingDxf } = useDialuxDxfExport();

    const floorsSorted = getFloorsSorted();

    const handleAddFloorAbove = useCallback(() => {
        const maxIndex = Math.max(...floorsSorted.map((f) => f.floorIndex ?? 0), 0);
        const newId = addFloor(`Piso ${maxIndex + 1}`, maxIndex + 1, 3.0);
        setActiveScene(newId);
    }, [addFloor, floorsSorted, setActiveScene]);

    const handleAddBasement = useCallback(() => {
        const minIndex = Math.min(...floorsSorted.map((f) => f.floorIndex ?? 0), 0);
        const newId = addFloor(`Sótano ${Math.abs(minIndex - 1)}`, minIndex - 1, 3.0);
        setActiveScene(newId);
    }, [addFloor, floorsSorted, setActiveScene]);

    const handleDuplicateFloor = useCallback(() => {
        if (!activeSceneId || !activeScene) return;
        const maxIndex = Math.max(...floorsSorted.map((f) => f.floorIndex ?? 0), 0);
        const newId = duplicateFloor(
            activeSceneId,
            maxIndex + 1,
            `${activeScene.name} (copia)`,
        );
        setActiveScene(newId);
    }, [activeSceneId, activeScene, duplicateFloor, floorsSorted, setActiveScene]);

    const handleRemoveFloor = useCallback(() => {
        if (!activeSceneId || floorsSorted.length <= 1) return;
        removeFloor(activeSceneId);
    }, [activeSceneId, floorsSorted.length, removeFloor]);

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
    }, [project, setActiveScene, setProject]);

    const runCalc = useCallback(async () => {
        const scene = activeScene;
        if (!scene || !engine.ready || scene.rooms.length === 0) return;

        setCalculating(true);
        try {
            const ambients = scene.rooms.flatMap((room) =>
                deriveAmbientSpaces(room, scene.walls, scene.fixtures),
            );
            const calculations = await Promise.all(
                ambients.map(async (ambient) => {
                    const roomResult = await engine.calculate(
                        ambient.room,
                        ambient.fixtures,
                    );
                    return {
                        room: ambient.room,
                        fixtures: ambient.fixtures,
                        result: roomResult,
                        sourceRoomName: ambient.roomName,
                    };
                }),
            );

            setRoomResults(calculations);
            setResultsByRoom(
                Object.fromEntries(
                    calculations.map(({ room, result }) => [room.id, result]),
                ),
            );
            setResultsModalOpen(calculations.length > 0);

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
        activeScene,
        engine,
        selectedId,
        setCalculating,
        setResult,
        setResultsByRoom,
    ]);

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
                    if (selectedId) removeObject(selectedId);
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
    }, [removeObject, runCalc, selectedId, setSelectedId, setTool]);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-[#0d0f14] text-gray-200 select-none">
            <header id="dialux-header" className="flex h-11 shrink-0 items-center gap-3 border-b border-gray-800/60 bg-[#161820] px-4">
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
                            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold transition-all ${
                                showFloorPanel
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
                                onMouseLeave={() => setShowFloorPanel(false)}
                            >
                                <div className="border-b border-slate-700/40 px-3 py-1.5 text-[9px] font-bold tracking-widest text-slate-500 uppercase">
                                    Pisos del Proyecto
                                </div>
                                <div className="max-h-52 overflow-y-auto py-1">
                                    {[...floorsSorted].reverse().map((floor) => (
                                        <div
                                            key={floor.id}
                                            className={`flex w-full items-center gap-1 px-2 py-1 text-[11px] transition-colors ${
                                                floor.id === activeSceneId
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
                                                className={`flex flex-1 items-center gap-2 text-left ${
                                                    floor.id === activeSceneId ? 'text-amber-300' : 'text-slate-400 hover:text-slate-100'
                                                } ${ (floor.visible ?? true) ? '' : 'opacity-40' }`}
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
                                        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-[10px] transition-colors ${
                                            showAllFloors
                                                ? 'bg-cyan-900/40 text-cyan-300'
                                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                                        }`}
                                        title={showAllFloors ? 'Mostrar solo piso activo' : 'Ver todos los pisos superpuestos'}
                                    >
                                        <Eye size={11} />
                                        {showAllFloors ? 'Modo: Todos los pisos' : 'Ver todos los pisos'}
                                    </button>
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

                <div className="flex-1" />


                <button
                    onClick={toggle3DView}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-all ${
                        show3DView
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
                        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-all ${
                            showRoof
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
                        {isCalculating ? 'Calculando...' : 'Calcular (Enter)'}
                    </button>

                    <button
                        id="dialux-btn-export-pdf"
                        onClick={handleExportPdf}
                        disabled={!project || isExporting}
                        className="flex items-center gap-1.5 rounded border border-cyan-700/40 bg-cyan-950/60 px-3 py-1.5 text-xs text-cyan-100 transition-all hover:bg-cyan-900/70 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Exportar reporte PDF"
                    >
                        <Download size={13} />
                        {isExporting ? (exportStep || 'Exportando PDF...') : 'Exportar PDF'}
                    </button>

                    <button
                        id="dialux-btn-export-dxf"
                        onClick={exportDxf}
                        disabled={!project || isExportingDxf}
                        className="flex items-center gap-1.5 rounded border border-emerald-700/40 bg-emerald-950/60 px-3 py-1.5 text-xs text-emerald-100 transition-all hover:bg-emerald-900/70 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Exportar plano 2D en formato DXF (CAD)"
                    >
                        <Download size={13} />
                        {isExportingDxf ? 'Exportando DXF...' : 'Exportar DXF'}
                    </button>
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

            <Dialog open={resultsModalOpen} onOpenChange={setResultsModalOpen}>
                <DialogContent className="max-h-[92vh] overflow-hidden border-slate-800 bg-[#090b10] text-slate-100 sm:max-w-7xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-white">
                            Resultados de iluminacion por recinto
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Se captura la luminaria insertada en cada espacio y
                            se resume el calculo en una tabla.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-hidden">
                        <ResultsPanel rooms={roomResults} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
});
