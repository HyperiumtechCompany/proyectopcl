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
import { useDialuxPdfExport } from '@/dialux-export';
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
            name: 'Planta 1',
            scaleConfig: createScaleConfig('m', 1, 'Metros (1 = 1m)'),
            rooms: [],
            walls: [],
            windows: [],
            doors: [],
            canopies: [],
            fixtures: [],
        },
    ],
};

export const EditorLayout = memo(function EditorLayout() {
    const project = useEditorStore((s) => s.project);
    const projectName = useEditorStore((s) => s.project?.name ?? '-');
    const activeScene = useEditorStore((s) => s.activeScene());
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
    const [roomResults, setRoomResults] = useState<RoomResultSummary[]>([]);
    const [resultsModalOpen, setResultsModalOpen] = useState(false);
    const engine = useLightingEngine();
    const { exportPdf, isExporting, exportStep } = useDialuxPdfExport();

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
