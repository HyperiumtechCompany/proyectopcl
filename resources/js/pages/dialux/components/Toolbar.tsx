import { BookOpen, Building2, Eye, FileInput, FilePlus, Hand, Lightbulb, Minus, MousePointer2, RotateCcw, Ruler, Scale, Square, Trash2, Upload, Wrench} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import { createScaleConfig, useEditorStore, useScaleConfig} from '@/pages/dialux/hooks/useEditorStore';
import type { ScaleConfig } from '@/pages/dialux/hooks/useEditorStore';
import { useMlightcadEngine } from '@/pages/dialux/hooks/useMlightcadEngine';
import { useWasmEngine } from '@/pages/dialux/hooks/useWasmEngine';
import { getEffectiveScale } from './canvas/canvasUtils';
import { ImportLuminairesModal } from './ImportLuminairesModal';
import { FloatingPanelPortal } from './toolbar/FloatingPanelPortal';
import {ConstruccionPanel,EditarPanel,ExportacionPanel,HerramientasPanel,LuzPanel,MedirPanel,NormativaPanel,ProyectoPanel,VistaPanel} from './toolbar/panels';
import { GroupBtn, Sep, ToolBtn } from './toolbar/primitives';
import type { PanelId } from './toolbar/types';

export const Toolbar: React.FC = () => {
    const store = useEditorStore();
    const wasmEngine = useWasmEngine();
    const engine = useMlightcadEngine();
    const scaleConfig = useScaleConfig();

    const { activeTool, angleSnapMode, showGrid, showIsolux, isoluxMode } = store.ui;
    const { isParsing, parseDxf } = wasmEngine;

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [openPanel, setOpenPanel] = useState<PanelId>(null);
    const [lastCmd, setLastCmd] = useState<string | null>(null);
    const [detectedScale, setDetectedScale] = useState<ScaleConfig | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [scaleConfirmed, setScaleConfirmed] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImportLuminairesModalOpen, setIsImportLuminairesModalOpen] = useState(false);
    const projectName = store.project?.name ?? '';
    const setProjectName = useCallback(
        (name: string) => {
            if (!store.project) return;
            store.setProject({ ...store.project, name });
        },
        [store],
    );

    const setDefaultNormativeStandard = useEditorStore((s) => s.setDefaultRoomNormativeStandard);

    /* Anchor refs */
    const herramientasRef = useRef<HTMLDivElement>(null);
    const construccionRef = useRef<HTMLDivElement>(null);
    const luzRef = useRef<HTMLDivElement>(null);
    const medirRef = useRef<HTMLDivElement>(null);
    const vistaRef = useRef<HTMLDivElement>(null);
    const exportacionRef = useRef<HTMLDivElement>(null);
    const editarRef = useRef<HTMLDivElement>(null);
    const normativaRef = useRef<HTMLDivElement>(null);
    const proyectoRef = useRef<HTMLDivElement>(null);

    const refs = useMemo(() => ({ herramientas: herramientasRef, construccion: construccionRef, luz: luzRef, medir: medirRef, vista: vistaRef, exportacion: exportacionRef, editar: editarRef, normativa: normativaRef, proyecto: proyectoRef}) as const,[],);

    const closePanel = useCallback(() => setOpenPanel(null), []);
    const togglePanel = useCallback((id: PanelId) => setOpenPanel((prev) => (prev === id ? null : id)),[],);

    const hasCadDoc = !!engine.activeDoc;
    const isLoading = engine.isLoading || isParsing;
    const isReady = engine.isReady;

    const handleFileUpload = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ok = await engine.openFile(file);
            if (ok) {
                setPendingFile(file);
                setScaleConfirmed(false);
                setTimeout(async () => {
                    const ext = engine.getDocumentExtents?.();
                    if (ext) {
                        if (store.activeScene()?.scaleConfig.isCalibrated) {
                            // If the scene is already calibrated (e.g., reloading DXF for a floor), preserve its scale!
                            setDetectedScale(store.activeScene()!.scaleConfig);
                            await applyScaleConfig(
                                store.activeScene()!.scaleConfig,
                                false,
                            );
                        } else {
                            const suggested = store.detectScaleFromExtents({
                                min_x: ext.minX,
                                min_y: ext.minY,
                                max_x: ext.maxX,
                                max_y: ext.maxY,
                            });
                            setDetectedScale(suggested);
                            await applyScaleConfig(suggested, true);
                        }
                    } else setDetectedScale(null);
                    setIsImportModalOpen(true);
                }, 500);
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [engine, store],
    );

    const applyScaleConfig = useCallback(
        async (config: ScaleConfig, rescaleObjects = true) => {
            const prevEffective = getEffectiveScale(scaleConfig);
            store.setScaleConfig(config, rescaleObjects);
            setDetectedScale(config);
            setScaleConfirmed(true);
            if (pendingFile?.name.toLowerCase().endsWith('.dxf')) {
                await parseDxf?.(pendingFile, getEffectiveScale(config));
            }
        },
        [parseDxf, pendingFile, scaleConfig, store],
    );

    const handleCommand = useCallback(
        (cmd: string) => {
            setLastCmd(cmd);
            engine.sendCommand(cmd);
            if (store.ui.activeTool !== 'select') store.setTool('select');
        },
        [engine, store],
    );

    const handleDeleteSelected = useCallback(() => {
        const { selectedId } = store.ui;
        if (selectedId) store.removeObject(selectedId);
    }, [store]);

    const handleResetCalibration = useCallback(() => {
        store.resetCalibration();
    }, [store]);

    const handleResetView = useCallback(() => {
        store.setZoom(1);
        store.setPan(0, 0);
        engine.fitToView?.();
    }, [engine, store]);

    /* ── CONFIG group: project setup, normativa, document ── */
    const CONFIG_GROUPS = useMemo(
        () => [
            {
                id: 'proyecto' as PanelId,
                ref: refs.proyecto,
                icon: <BookOpen size={15} />,
                label: 'Proy.',
                hasActive: projectName.length > 0,
                accentColor: 'text-violet-400',
            },
            {
                id: 'normativa' as PanelId,
                ref: refs.normativa,
                icon: <Scale size={15} />,
                label: 'Norm.',
                hasActive: false,
                accentColor: 'text-emerald-400',
            },
            {
                id: 'construccion' as PanelId,
                ref: refs.construccion,
                icon: <Building2 size={15} />,
                label: 'Arq.',
                hasActive: [
                    'room',
                    'wall',
                    'education-wall',
                    'window',
                    'door',
                    'canopy',
                    'corridor',
                    'stair',
                ].includes(activeTool),
            },
            {
                id: 'luz' as PanelId,
                ref: refs.luz,
                icon: <Lightbulb size={15} />,
                label: 'Luz',
                hasActive: [
                    'fixture',
                    'fixture-grid',
                    'switch',
                    'wire',
                ].includes(activeTool) || activeTool.startsWith('elec-'),
            },
            {
                id: 'medir' as PanelId,
                ref: refs.medir,
                icon: <Ruler size={15} />,
                label: 'Medir',
                hasActive: activeTool === 'measure',
            },
            {
                id: 'exportacion' as PanelId,
                ref: refs.exportacion,
                icon: <FileInput size={15} />,
                label: 'Doc.',
                hasActive: hasCadDoc || activeTool === 'calibrate',
            },
            {
                id: 'vista' as PanelId,
                ref: refs.vista,
                icon: <Eye size={15} />,
                label: 'Vista',
                hasActive: showGrid || showIsolux,
                accentColor: showIsolux ? 'text-yellow-400' : undefined,
            },
        ],
        [activeTool, hasCadDoc, projectName.length, refs, showGrid, showIsolux],
    );
    /* ── CAD VIEWER group (hidden until needed) ── */
    const CAD_GROUPS = useMemo(
        () => [
            {
                id: 'herramientas' as PanelId,
                ref: refs.herramientas,
                icon: <Wrench size={15} />,
                label: 'CAD',
                hasActive: false,
            },
        ],
        [refs],
    );

    return (
        <>
            <input type="file" className="hidden" accept=".dxf,.dwg" ref={fileInputRef} onChange={handleFileUpload}/>

            {/* ── Sidebar rail ── */}
            <aside id="dialux-toolbar" className="relative flex w-12 shrink-0 flex-col items-center gap-0.5 overflow-x-visible overflow-y-auto border-r border-gray-800/70 bg-[#12141e] py-2 md:w-14">
                {/* ── Quick-access native tools ── */}
                <span className="mt-1 mb-0.5 px-1 text-[8px] font-bold tracking-[0.2em] text-gray-700 uppercase">
                    Rápido
                </span>
                <div className="flex w-full flex-col items-center gap-0.5 px-1.5">
                    <ToolBtn tool="select" icon={<MousePointer2 size={14} />} active={activeTool} onSet={store.setTool} tip="Seleccionar (V)"/>
                    <ToolBtn tool="room" icon={<Square size={14} />} active={activeTool} onSet={store.setTool} tip="Recinto poligonal (R)"/>
                    <ToolBtn tool="wall" icon={<Minus size={14} />} active={activeTool} onSet={store.setTool} tip="Pared (W)"/>
                    <ToolBtn tool="pan" icon={<Hand size={14} />} active={activeTool} onSet={store.setTool} tip="Pan (Espacio)"/>
                </div>

                <Sep />

                {/* ── Configuración ── */}
                <span className="mb-0.5 px-1 text-[8px] font-bold tracking-[0.2em] text-gray-700 uppercase">
                    Config
                </span>
                <div className="flex w-full flex-col items-center gap-1.5 px-1.5">
                    {CONFIG_GROUPS.map((g) => {
                        const { id, ref, icon, label, hasActive } = g as any;
                        const accentColor = (g as any).accentColor;
                        return (
                            <div key={id as string} ref={ref as React.RefObject<HTMLDivElement>} className="flex w-full justify-center">
                                <GroupBtn id={`group-${id}`} icon={icon} label={label} isOpen={openPanel === id} hasActive={hasActive} onClick={() => togglePanel(id)} accentColor={accentColor}/>
                            </div>
                        );
                    })}
                </div>

                <Sep />
                
                {/* ── CAD Viewer (oculto — activar cuando sea necesario) ── */}
                <div className="hidden">
                    {CAD_GROUPS.map(({ id, ref, icon, label, hasActive }) => (
                        <div key={id as string} ref={ref as React.RefObject<HTMLDivElement>} className="flex w-full justify-center">
                            <GroupBtn id={`group-${id}`} icon={icon} label={label} isOpen={openPanel === id} hasActive={hasActive} onClick={() => togglePanel(id)}/>
                        </div>
                    ))}
                </div>

                <Sep />

                {/* ── Editar ── */}
                <div ref={refs.editar} className="flex w-full justify-center px-1.5">
                    <GroupBtn id="group-editar" icon={<Trash2 size={15} />} label="Editar" isOpen={openPanel === 'editar'} onClick={() => togglePanel('editar')} accentColor="text-red-400"/>
                </div>

                <div className="flex-1" />

                {/* Last command pill */}
                {lastCmd && (
                    <div className="mb-1 px-1 text-center" title={lastCmd}>
                        <span className="rounded bg-cyan-950/50 px-1.5 py-0.5 font-mono text-[8px] text-cyan-700 ring-1 ring-cyan-900/40">
                            {lastCmd.length > 7
                                ? `${lastCmd.slice(0, 7)}…`
                                : lastCmd}
                        </span>
                    </div>
                )}
            </aside>

            {/* ── Floating Panels ── */}
            {openPanel === 'herramientas' && (
                <FloatingPanelPortal title="Herramientas CAD" icon={<Wrench size={12} />} anchorRef={refs.herramientas} onClose={closePanel}>
                    <HerramientasPanel onExecute={handleCommand} isReady={isReady}/>
                </FloatingPanelPortal>
            )}

            {openPanel === 'construccion' && (
                <FloatingPanelPortal title="Construcción" icon={<Building2 size={12} />} anchorRef={refs.construccion} onClose={closePanel} width="md">
                    <ConstruccionPanel
                        activeTool={activeTool}
                        onSetTool={store.setTool}
                        angleSnapMode={angleSnapMode}
                        onSetAngleSnap={store.setAngleSnapMode}
                        wallTypeTemplate={store.ui.wallTypeTemplate}
                        onSetWallType={store.setWallTypeTemplate}
                        roomTypeTemplate={store.ui.roomTypeTemplate}
                        onSetRoomType={store.setRoomTypeTemplate}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'luz' && (
                <FloatingPanelPortal title="Iluminación" icon={<Lightbulb size={13} />} anchorRef={refs.luz} onClose={closePanel} width="md">
                    <LuzPanel
                        activeTool={activeTool}
                        onSetTool={store.setTool}
                        switchTemplate={store.ui.switchTemplate}
                        onSetSwitchTemplate={store.setSwitchTemplate}
                        gridRows={store.ui.fixtureGridRows}
                        gridCols={store.ui.fixtureGridCols}
                        onSetRows={store.setFixtureGridRows}
                        onSetCols={store.setFixtureGridCols}
                        onOpenImportModal={() => setIsImportLuminairesModalOpen(true)}
                        onSetElecDevice={(type, label) => {store.setElectricalDeviceTemplate(type, label);}}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'proyecto' && (
                <FloatingPanelPortal title="Proyecto" icon={<BookOpen size={12} />} anchorRef={refs.proyecto} onClose={closePanel} width="md">
                    <ProyectoPanel projectName={projectName} onProjectNameChange={setProjectName}/>
                </FloatingPanelPortal>
            )}

            {openPanel === 'normativa' && (
                <FloatingPanelPortal title="Normativa de iluminación" icon={<Scale size={12} />} anchorRef={refs.normativa} onClose={closePanel} width="lg">
                    <NormativaPanel
                        onDefaultNormativeStandardChange={setDefaultNormativeStandard}
                        onApplyProfile={(opts) =>store.applyNormativeProfileToRooms(opts)}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'medir' && (
                <FloatingPanelPortal title="Medición" icon={<Ruler size={13} />} anchorRef={refs.medir} onClose={closePanel}>
                    <MedirPanel
                        activeTool={activeTool}
                        onSetTool={store.setTool}
                        onExecute={handleCommand}
                        isReady={isReady}
                        scaleConfig={
                            store.activeScene()?.scaleConfig ??
                            createScaleConfig('m', 1, 'Metros (1 = 1m)')
                        }
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'vista' && (
                <FloatingPanelPortal title="Vista y visualización" icon={<Eye size={13} />} anchorRef={refs.vista} onClose={closePanel}>
                    <VistaPanel
                        showIsolux={showIsolux}
                        isoluxMode={isoluxMode}
                        isReady={isReady}
                        onExecute={handleCommand}
                        onToggleIsolux={store.toggleIsolux}
                        onSetIsoluxMode={store.setIsoluxMode}
                        onResetView={handleResetView}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'exportacion' && (
                <FloatingPanelPortal title="Documento y exportación" icon={<FileInput size={13} />} anchorRef={refs.exportacion} onClose={closePanel} width="md">
                    <ExportacionPanel
                        hasCadDoc={hasCadDoc}
                        isLoading={isLoading}
                        fileName={engine.fileName ?? undefined}
                        activeTool={activeTool}
                        scaleConfig={scaleConfig}
                        detectedScale={detectedScale}
                        scaleConfirmed={scaleConfirmed}
                        onNewDoc={() => engine.newDocument?.()}
                        onImportClick={() => fileInputRef.current?.click()}
                        onApplyScale={applyScaleConfig}
                        onCalibrate={() => {
                            store.setTool('calibrate');
                            closePanel();
                        }}
                        onResetCalibration={handleResetCalibration}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'editar' && (
                <FloatingPanelPortal title="Editar" icon={<Trash2 size={13} />} anchorRef={refs.editar} onClose={closePanel}>
                    <EditarPanel
                        onExecute={handleCommand}
                        isReady={isReady}
                        onDeleteSelected={handleDeleteSelected}
                    />
                </FloatingPanelPortal>
            )}

            {/* ── Import & Scale Modal ── */}
            <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                <DialogContent className="border-gray-800 bg-[#161820] text-gray-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-cyan-400">
                            <Upload size={20} /> Importar Plano CAD
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Configura la escala y unidades para{' '}
                            <span className="font-mono text-cyan-200">
                                {pendingFile?.name}
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-cyan-900/30 bg-cyan-950/20 p-4">
                            <h4 className="mb-2 text-xs font-bold tracking-wider text-cyan-300 uppercase">
                                Unidades del archivo
                            </h4>
                            <select
                                value={scaleConfig?.unit || 'm'}
                                onChange={async (e) => {
                                    const unit = e.target.value as | 'mm' | 'cm' | 'm';
                                    const map = {
                                        mm: { factor: 0.001, display: 'Milímetros (1000 = 1m)'},
                                        cm: { factor: 0.01, display: 'Centímetros (100 = 1m)'},
                                        m: { factor: 1, display: 'Metros (1 = 1m)'},
                                    };
                                    const { factor, display } = map[unit];
                                    await applyScaleConfig(
                                        createScaleConfig( unit, factor, display),
                                    );
                                }}
                                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-cyan-500/50">
                                <option value="mm">Milímetros (mm)</option>
                                <option value="cm">Centímetros (cm)</option>
                                <option value="m">Metros (m)</option>
                            </select>
                        </div>

                        {detectedScale && !scaleConfirmed && (
                            <div className="flex items-center justify-between rounded-lg border border-amber-600/30 bg-amber-950/30 p-3 text-amber-200">
                                <div>
                                    <p className="text-xs font-bold text-amber-400">
                                        Auto-detección
                                    </p>
                                    <p className="text-[10px]">
                                        {detectedScale.displayUnit}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-amber-600 text-white hover:bg-amber-500"
                                    onClick={() =>
                                        applyScaleConfig(detectedScale)
                                    }>
                                    Confirmar
                                </Button>
                            </div>
                        )}

                        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
                            <h4 className="mb-1 text-xs font-bold tracking-wider text-gray-400 uppercase">
                                Calibración manual
                            </h4>
                            <p className="mb-3 text-[11px] text-gray-500">
                                Mide una distancia conocida en el plano para
                                calibrar la escala.
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="gap-2 bg-gray-700 hover:bg-gray-600"
                                onClick={() => {
                                    store.setTool('calibrate');
                                    setIsImportModalOpen(false);
                                }}>
                                <Ruler size={13} /> Iniciar calibración
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="bg-cyan-600 font-bold text-white hover:bg-cyan-500" onClick={() => setIsImportModalOpen(false)}>
                            Listo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Import Luminaires Modal ── */}
            <ImportLuminairesModal open={isImportLuminairesModalOpen} onOpenChange={setIsImportLuminairesModalOpen}/>
        </>
    );
};
