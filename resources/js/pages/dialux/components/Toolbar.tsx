import {
    AlertTriangle,
    BookOpen,
    Building2,
    Eye,
    FileInput,
    FilePlus,
    Hand,
    Lightbulb,
    Minus,
    MousePointer2,
    Plug,
    RotateCcw,
    Ruler,
    Scale,
    Square,
    Sun,
    Trash2,
    Upload,
    Wrench,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    createScaleConfig,
    useEditorStore,
    useScaleConfig,
} from '@/pages/dialux/hooks/useEditorStore';
import type { ScaleConfig } from '@/pages/dialux/hooks/useEditorStore';
import {
    saveDialuxPlanFile,
    uploadDialuxPlanFile,
} from '@/pages/dialux/hooks/dialuxPlanStorage';
import {
    markDialuxPlanSyncFailed,
    markDialuxPlanSyncOk,
} from '@/pages/dialux/hooks/useDialuxPlanSyncStatus';
import { detectDxfUnitFromHeader } from '@/pages/dialux/hooks/dxfFallbackParser';
import { useMlightcadEngine } from '@/pages/dialux/hooks/useMlightcadEngine';
import { useWasmEngine } from '@/pages/dialux/hooks/useWasmEngine';
import { parseIfcFileForImport, type IfcImportPreview } from '@/pages/dialux/hooks/ifcImport/ifcImportPipeline';
import { getEffectiveScale } from './canvas/canvasUtils';
import { IfcImportDialog, type IfcImportSelection } from './IfcImportDialog';
import { ImportLuminairesModal } from './ImportLuminairesModal';
import { FloatingPanelPortal } from './toolbar/FloatingPanelPortal';
import {
    ConstruccionPanel,
    EditarPanel,
    EmergenciaPanel,
    ExportacionPanel,
    HerramientasPanel,
    LuzNaturalPanel,
    LuzPanel,
    MedirPanel,
    NormativaPanel,
    ProyectoPanel,
    TomasPanel,
    VistaPanel,
} from './toolbar/panels';
import { GroupBtn, Sep, ToolBtn } from './toolbar/primitives';
import type { PanelId } from './toolbar/types';

export const Toolbar: React.FC = () => {
    const store = useEditorStore();
    const wasmEngine = useWasmEngine();
    const engine = useMlightcadEngine();
    const scaleConfig = useScaleConfig();

    const { activeTool, angleSnapMode, showGrid, showIsolux, isoluxMode } =
        store.ui;
    const { isParsing, parseDxf } = wasmEngine;

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [openPanel, setOpenPanel] = useState<PanelId>(null);
    const [lastCmd, setLastCmd] = useState<string | null>(null);
    const [detectedScale, setDetectedScale] = useState<ScaleConfig | null>(
        null,
    );
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [scaleConfirmed, setScaleConfirmed] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImportLuminairesModalOpen, setIsImportLuminairesModalOpen] =
        useState(false);
    const ifcFileInputRef = useRef<HTMLInputElement>(null);
    const [ifcPreview, setIfcPreview] = useState<IfcImportPreview | null>(null);
    const [isIfcDialogOpen, setIsIfcDialogOpen] = useState(false);
    const [isIfcParsing, setIsIfcParsing] = useState(false);
    const [ifcImportError, setIfcImportError] = useState<string | null>(null);
    const projectName = store.project?.name ?? '';
    const projectId = store.project?.id ?? null;
    const activeScene = store.activeScene();
    const setProjectName = useCallback(
        (name: string) => {
            if (!store.project) return;
            store.setProject({ ...store.project, name });
        },
        [store],
    );

    /* Anchor refs */
    const herramientasRef = useRef<HTMLDivElement>(null);
    const construccionRef = useRef<HTMLDivElement>(null);
    const luzRef = useRef<HTMLDivElement>(null);
    const tomasRef = useRef<HTMLDivElement>(null);
    const medirRef = useRef<HTMLDivElement>(null);
    const vistaRef = useRef<HTMLDivElement>(null);
    const exportacionRef = useRef<HTMLDivElement>(null);
    const editarRef = useRef<HTMLDivElement>(null);
    const normativaRef = useRef<HTMLDivElement>(null);
    const proyectoRef = useRef<HTMLDivElement>(null);
    const emergenciaRef = useRef<HTMLDivElement>(null);
    const luznaturalRef = useRef<HTMLDivElement>(null);

    const refs = useMemo(
        () =>
            ({
                herramientas: herramientasRef,
                construccion: construccionRef,
                luz: luzRef,
                tomas: tomasRef,
                medir: medirRef,
                vista: vistaRef,
                exportacion: exportacionRef,
                editar: editarRef,
                normativa: normativaRef,
                proyecto: proyectoRef,
                emergencia: emergenciaRef,
                luznatural: luznaturalRef,
            }) as const,
        [],
    );

    const closePanel = useCallback(() => setOpenPanel(null), []);
    const togglePanel = useCallback(
        (id: PanelId) => setOpenPanel((prev) => (prev === id ? null : id)),
        [],
    );

    const hasCadDoc = !!engine.activeDoc;
    const isLoading = engine.isLoading || isParsing;
    const isReady = engine.isReady;

    const handleFileUpload = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ok = await engine.openFile(file);
            if (ok) {
                if (projectId && store.activeSceneId) {
                    try {
                        await saveDialuxPlanFile(
                            projectId,
                            store.activeSceneId,
                            file,
                        );
                        await uploadDialuxPlanFile(
                            projectId,
                            store.activeSceneId,
                            file,
                        );
                        markDialuxPlanSyncOk(store.activeSceneId);
                    } catch (error) {
                        console.warn(
                            'No se pudo sincronizar el plano DIAlux.',
                            error,
                        );
                        markDialuxPlanSyncFailed(store.activeSceneId);
                    }
                }
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
                                true,
                            );
                        } else {
                            const headerUnit = file.name
                                .toLowerCase()
                                .endsWith('.dxf')
                                ? detectDxfUnitFromHeader(await file.text())
                                : null;
                            const suggested = headerUnit
                                ? createScaleConfig(
                                      headerUnit.unit,
                                      headerUnit.factor,
                                      headerUnit.displayUnit,
                                  )
                                : store.detectScaleFromExtents({
                                      min_x: ext.minX,
                                      min_y: ext.minY,
                                      max_x: ext.maxX,
                                      max_y: ext.maxY,
                                  });
                            setDetectedScale(suggested);
                            // La unidad declarada en el DXF ($INSUNITS) es confiable y se
                            // confirma sola. La heurística por tamaño de extents NO lo es
                            // (puede confundir cm con mm) — se aplica para que el plano se
                            // vea de inmediato, pero queda "sin confirmar" hasta que el
                            // usuario la revise, la cambie o calibre manualmente.
                            await applyScaleConfig(
                                suggested,
                                true,
                                headerUnit !== null,
                            );
                        }
                    } else setDetectedScale(null);
                    setIsImportModalOpen(true);
                }, 500);
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [engine, projectId, store],
    );

    /**
     * Fase 19 del plan maestro ("BIM/IFC" — importar y mapear estructura
     * espacial, primer ciclo). A diferencia de DXF/DWG (que solo se usa como
     * capa de calco visual), un IFC trae semántica espacial explícita: se
     * parsea completo (`parseIfcFileForImport`) y se muestra en
     * `IfcImportDialog` ANTES de crear nada — nunca se importa a ciegas.
     */
    const handleIfcFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (ifcFileInputRef.current) ifcFileInputRef.current.value = '';
        if (!file) return;

        setIfcImportError(null);
        setIsIfcParsing(true);
        try {
            const buffer = new Uint8Array(await file.arrayBuffer());
            const preview = await parseIfcFileForImport(buffer);
            setIfcPreview(preview);
            setIsIfcDialogOpen(true);
        } catch (error) {
            console.error('No se pudo parsear el archivo IFC.', error);
            setIfcImportError(error instanceof Error ? error.message : 'No se pudo leer el archivo IFC.');
        } finally {
            setIsIfcParsing(false);
        }
    }, []);

    const handleIfcImportApply = useCallback(
        (selection: IfcImportSelection) => {
            if (!ifcPreview) return;

            const existingIndices = store.project?.scenes.map((s) => s.floorIndex) ?? [0];
            let nextFloorIndex = Math.max(0, ...existingIndices) + 1;

            for (const storey of ifcPreview.storeys) {
                const selectedSpaceIds = selection.storeys.get(storey.expressId);
                if (!selectedSpaceIds || selectedSpaceIds.size === 0) continue;

                const spacesToImport = storey.spaces.filter(
                    (space) => selectedSpaceIds.has(space.expressId) && space.footprint,
                );
                if (spacesToImport.length === 0) continue;

                const floorHeight = Math.max(...spacesToImport.map((s) => s.footprint!.height));
                const floorId = store.addFloor(storey.name ?? `Nivel IFC ${storey.expressId}`, nextFloorIndex, floorHeight);
                nextFloorIndex += 1;
                if (storey.globalId) store.updateFloor(floorId, { ifcGlobalId: storey.globalId });
                store.setActiveScene(floorId);

                for (const space of spacesToImport) {
                    store.addRoom({
                        name: space.name ?? `Espacio IFC ${space.expressId}`,
                        vertices: space.footprint!.vertices,
                        height: space.footprint!.height,
                        color: 'rgba(56,189,248,0.25)',
                        roomType: 'room',
                        ifcGlobalId: space.globalId ?? undefined,
                    });
                }
            }

            setIsIfcDialogOpen(false);
            setIfcPreview(null);
        },
        [ifcPreview, store],
    );

    const applyScaleConfig = useCallback(
        async (
            config: ScaleConfig,
            rescaleObjects = true,
            markConfirmed = true,
        ) => {
            const prevEffective = getEffectiveScale(scaleConfig);
            store.setScaleConfig(config, rescaleObjects);
            setDetectedScale(config);
            setScaleConfirmed(markConfirmed);
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
        const { selectedId, selectedFixtureIds } = store.ui;
        if (selectedFixtureIds.length > 1) {
            store.beginHistoryGesture();
            selectedFixtureIds.forEach((id) => store.requestDelete(id));
            store.endHistoryGesture();
        } else if (selectedId) {
            store.requestDelete(selectedId);
        }
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
                accentColor: 'text-violet-600 dark:text-violet-400',
            },
            {
                id: 'normativa' as PanelId,
                ref: refs.normativa,
                icon: <Scale size={15} />,
                label: 'Norm.',
                hasActive: false,
                accentColor: 'text-emerald-600 dark:text-emerald-400',
            },
            {
                id: 'emergencia' as PanelId,
                ref: refs.emergencia,
                icon: <AlertTriangle size={15} />,
                label: 'Emerg.',
                hasActive: ['evacuation-route', 'antipanic-area'].includes(store.ui.activeTool),
                accentColor: 'text-amber-600 dark:text-amber-400',
            },
            {
                id: 'luznatural' as PanelId,
                ref: refs.luznatural,
                icon: <Sun size={15} />,
                label: 'Sol',
                hasActive: false,
                accentColor: 'text-amber-500 dark:text-yellow-300',
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
                hasActive:
                    ['fixture', 'fixture-grid', 'switch', 'wire'].includes(
                        activeTool,
                    ) ||
                    (activeTool.startsWith('elec-') &&
                        !activeTool.startsWith('elec-outlet-') &&
                        activeTool !== 'elec-water-heater'),
            },
            {
                // Separado de "Luz" a propósito: por norma (CNE-Utilización /
                // RNE EM.010) alumbrado y tomacorriente van en circuitos y
                // tuberías distintas, así que también viven en secciones
                // distintas de la barra de herramientas.
                id: 'tomas' as PanelId,
                ref: refs.tomas,
                icon: <Plug size={15} />,
                label: 'Tomas',
                hasActive:
                    activeTool.startsWith('elec-outlet-') ||
                    activeTool === 'elec-water-heater',
                accentColor: 'text-emerald-600 dark:text-green-400',
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
                accentColor: showIsolux ? 'text-amber-500 dark:text-yellow-400' : undefined,
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
            <input
                type="file"
                className="hidden"
                accept=".dxf,.dwg"
                ref={fileInputRef}
                onChange={handleFileUpload}
            />

            <input
                type="file"
                className="hidden"
                accept=".ifc"
                ref={ifcFileInputRef}
                onChange={handleIfcFileUpload}
            />

            <IfcImportDialog
                open={isIfcDialogOpen}
                preview={ifcPreview}
                onCancel={() => {
                    setIsIfcDialogOpen(false);
                    setIfcPreview(null);
                }}
                onApply={handleIfcImportApply}
            />

            {/* ── Sidebar rail ── */}
            <aside
                id="dialux-toolbar"
                className="relative z-40 flex w-12 shrink-0 flex-col items-center gap-0.5 overflow-x-visible overflow-y-auto border-r border-slate-200 dark:border-gray-800/70 bg-slate-50 dark:bg-[#12141e] py-2 md:w-14"
            >
                {/* ── Quick-access native tools ── */}
                <span className="mt-1 mb-0.5 px-1 text-[8px] font-bold tracking-[0.2em] text-slate-400 dark:text-gray-500 uppercase">
                    Rápido
                </span>
                <div className="flex w-full flex-col items-center gap-0.5 px-1.5">
                    <ToolBtn
                        tool="select"
                        icon={<MousePointer2 size={14} />}
                        active={activeTool}
                        onSet={store.setTool}
                        tip="Seleccionar (V)"
                    />
                    <ToolBtn
                        tool="room"
                        icon={<Square size={14} />}
                        active={activeTool}
                        onSet={store.setTool}
                        tip="Recinto poligonal (R)"
                    />
                    <ToolBtn
                        tool="wall"
                        icon={<Minus size={14} />}
                        active={activeTool}
                        onSet={store.setTool}
                        tip="Pared (W)"
                    />
                    <ToolBtn
                        tool="pan"
                        icon={<Hand size={14} />}
                        active={activeTool}
                        onSet={store.setTool}
                        tip="Pan (Espacio)"
                    />
                </div>

                <Sep />

                {/* ── Configuración ── */}
                <span className="mb-0.5 px-1 text-[8px] font-bold tracking-[0.2em] text-slate-400 dark:text-gray-500 uppercase">
                    Config
                </span>
                <div className="flex w-full flex-col items-center gap-1.5 px-1.5">
                    {CONFIG_GROUPS.map((g) => {
                        const { id, ref, icon, label, hasActive } = g as any;
                        const accentColor = (g as any).accentColor;
                        return (
                            <div
                                key={id as string}
                                ref={ref as React.RefObject<HTMLDivElement>}
                                className="flex w-full justify-center"
                            >
                                <GroupBtn
                                    id={`group-${id}`}
                                    icon={icon}
                                    label={label}
                                    isOpen={openPanel === id}
                                    hasActive={hasActive}
                                    onClick={() => togglePanel(id)}
                                    accentColor={accentColor}
                                />
                            </div>
                        );
                    })}
                </div>

                <Sep />

                {/* ── CAD Viewer (oculto — activar cuando sea necesario) ── */}
                <div className="hidden">
                    {CAD_GROUPS.map(({ id, ref, icon, label, hasActive }) => (
                        <div
                            key={id as string}
                            ref={ref as React.RefObject<HTMLDivElement>}
                            className="flex w-full justify-center"
                        >
                            <GroupBtn
                                id={`group-${id}`}
                                icon={icon}
                                label={label}
                                isOpen={openPanel === id}
                                hasActive={hasActive}
                                onClick={() => togglePanel(id)}
                            />
                        </div>
                    ))}
                </div>

                <Sep />

                {/* ── Editar ── */}
                <div
                    ref={refs.editar}
                    className="flex w-full justify-center px-1.5"
                >
                    <GroupBtn
                        id="group-editar"
                        icon={<Trash2 size={15} />}
                        label="Editar"
                        isOpen={openPanel === 'editar'}
                        onClick={() => togglePanel('editar')}
                        accentColor="text-red-500 dark:text-red-400"
                    />
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
                <FloatingPanelPortal
                    title="Herramientas CAD"
                    icon={<Wrench size={12} />}
                    anchorRef={refs.herramientas}
                    onClose={closePanel}
                >
                    <HerramientasPanel
                        onExecute={handleCommand}
                        isReady={isReady}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'construccion' && (
                <FloatingPanelPortal
                    title="Construcción"
                    icon={<Building2 size={12} />}
                    anchorRef={refs.construccion}
                    onClose={closePanel}
                    width="md"
                >
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
                <FloatingPanelPortal
                    title="Iluminación"
                    icon={<Lightbulb size={13} />}
                    anchorRef={refs.luz}
                    onClose={closePanel}
                    width="md"
                >
                    <LuzPanel
                        activeTool={activeTool}
                        onSetTool={store.setTool}
                        switchTemplate={store.ui.switchTemplate}
                        onSetSwitchTemplate={store.setSwitchTemplate}
                        wireTemplate={store.ui.wireTemplate}
                        onSetWireTemplate={store.setWireTemplate}
                        gridRows={store.ui.fixtureGridRows}
                        gridCols={store.ui.fixtureGridCols}
                        onSetRows={store.setFixtureGridRows}
                        onSetCols={store.setFixtureGridCols}
                        onOpenImportModal={() =>
                            setIsImportLuminairesModalOpen(true)
                        }
                        onSetElecDevice={(type, label, properties) => {
                            store.setElectricalDeviceTemplate(
                                type,
                                label,
                                properties,
                            );
                        }}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'tomas' && (
                <FloatingPanelPortal
                    title="Tomacorrientes"
                    icon={<Plug size={13} />}
                    anchorRef={refs.tomas}
                    onClose={closePanel}
                    width="md"
                >
                    <TomasPanel
                        activeTool={activeTool}
                        onSetTool={store.setTool}
                        onSetElecDevice={(type, label, properties) => {
                            store.setElectricalDeviceTemplate(
                                type,
                                label,
                                properties,
                            );
                        }}
                        wireTemplate={store.ui.wireTemplate}
                        onSetWireTemplate={store.setWireTemplate}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'proyecto' && (
                <FloatingPanelPortal
                    title="Proyecto"
                    icon={<BookOpen size={12} />}
                    anchorRef={refs.proyecto}
                    onClose={closePanel}
                    width="md"
                >
                    <ProyectoPanel
                        projectName={projectName}
                        onProjectNameChange={setProjectName}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'normativa' && (
                <FloatingPanelPortal
                    title="Normativa de iluminación"
                    icon={<Scale size={12} />}
                    anchorRef={refs.normativa}
                    onClose={closePanel}
                    width="lg"
                >
                    <NormativaPanel
                        onApplyStandardGlobally={(standard) => {
                            store.setDefaultRoomNormativeStandard(standard);
                            store.applyDefaultNormativeStandardToRooms();
                        }}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'emergencia' && (
                <FloatingPanelPortal
                    title="Alumbrado de emergencia"
                    icon={<AlertTriangle size={12} />}
                    anchorRef={refs.emergencia}
                    onClose={closePanel}
                    width="md"
                    dropdown
                >
                    <EmergenciaPanel />
                </FloatingPanelPortal>
            )}

            {openPanel === 'luznatural' && (
                <FloatingPanelPortal
                    title="Luz natural — Daylight Factor"
                    icon={<Sun size={12} />}
                    anchorRef={refs.luznatural}
                    onClose={closePanel}
                    width="md"
                >
                    <LuzNaturalPanel />
                </FloatingPanelPortal>
            )}

            {openPanel === 'medir' && (
                <FloatingPanelPortal
                    title="Medición"
                    icon={<Ruler size={13} />}
                    anchorRef={refs.medir}
                    onClose={closePanel}
                >
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
                <FloatingPanelPortal
                    title="Vista y visualización"
                    icon={<Eye size={13} />}
                    anchorRef={refs.vista}
                    onClose={closePanel}
                >
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
                <FloatingPanelPortal
                    title="Documento y exportación"
                    icon={<FileInput size={13} />}
                    anchorRef={refs.exportacion}
                    onClose={closePanel}
                    width="md"
                    dropdown
                >
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
                        onImportIfcClick={() => ifcFileInputRef.current?.click()}
                        isIfcParsing={isIfcParsing}
                        ifcImportError={ifcImportError}
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
                <FloatingPanelPortal
                    title="Editar"
                    icon={<Trash2 size={13} />}
                    anchorRef={refs.editar}
                    onClose={closePanel}
                >
                    <EditarPanel
                        onExecute={handleCommand}
                        isReady={isReady}
                        onDeleteSelected={handleDeleteSelected}
                    />
                </FloatingPanelPortal>
            )}

            {/* ── Import & Scale Modal ── */}
            <Dialog
                open={isImportModalOpen}
                onOpenChange={(open) => {
                    // Si la escala no fue confirmada (solo heurística por tamaño,
                    // no el $INSUNITS del archivo), no dejamos cerrar el modal sin
                    // que el usuario decida algo — evita planos con dimensiones
                    // reales incorrectas pasando desapercibidos.
                    if (!open && detectedScale && !scaleConfirmed) return;
                    setIsImportModalOpen(open);
                }}
            >
                <DialogContent
                    className="border-gray-300 dark:border-gray-800 bg-white dark:bg-[#161820] text-gray-100 sm:max-w-md"
                    onPointerDownOutside={(e) => {
                        if (detectedScale && !scaleConfirmed)
                            e.preventDefault();
                    }}
                    onEscapeKeyDown={(e) => {
                        if (detectedScale && !scaleConfirmed)
                            e.preventDefault();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-cyan-400">
                            <Upload size={20} /> Importar Plano CAD
                        </DialogTitle>
                        <DialogDescription className="text-gray-600 dark:text-gray-600 dark:text-gray-400">
                            Configura la escala y unidades para{' '}
                            <span className="font-mono text-cyan-200">
                                {pendingFile?.name}
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {detectedScale && !scaleConfirmed && (
                            <div className="rounded-lg border border-amber-600/50 bg-amber-950/30 p-3 text-amber-200">
                                <p className="text-xs font-bold text-amber-400">
                                    ⚠ Escala sin confirmar
                                </p>
                                <p className="mt-1 text-[10px] leading-snug">
                                    El archivo no declara sus unidades reales
                                    ($INSUNITS). Estimamos{' '}
                                    <span className="font-mono">
                                        {detectedScale.displayUnit}
                                    </span>{' '}
                                    por el tamaño del plano, pero podría estar
                                    equivocado (ej. confundir cm con mm).
                                    Confirma la unidad correcta o calibra
                                    manualmente antes de continuar — de lo
                                    contrario el plano puede no medir lo mismo
                                    que en el CAD original.
                                </p>
                                <Button
                                    size="sm"
                                    className="mt-2 bg-amber-600 text-white hover:bg-amber-500"
                                    onClick={() =>
                                        applyScaleConfig(detectedScale)
                                    }
                                >
                                    Confirmar {detectedScale.displayUnit}
                                </Button>
                            </div>
                        )}

                        <div className="rounded-lg border border-cyan-900/30 bg-cyan-950/20 p-4">
                            <h4 className="mb-2 text-xs font-bold tracking-wider text-cyan-300 uppercase">
                                Unidades del archivo
                            </h4>
                            <select
                                value={scaleConfig?.unit || 'm'}
                                onChange={async (e) => {
                                    const unit = e.target.value as
                                        | 'mm'
                                        | 'cm'
                                        | 'm';
                                    const map = {
                                        mm: {
                                            factor: 0.001,
                                            display: 'Milímetros (1000 = 1m)',
                                        },
                                        cm: {
                                            factor: 0.01,
                                            display: 'Centímetros (100 = 1m)',
                                        },
                                        m: {
                                            factor: 1,
                                            display: 'Metros (1 = 1m)',
                                        },
                                    };
                                    const { factor, display } = map[unit];
                                    await applyScaleConfig(
                                        createScaleConfig(
                                            unit,
                                            factor,
                                            display,
                                        ),
                                    );
                                }}
                                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-cyan-500/50"
                            >
                                <option value="mm">Milímetros (mm)</option>
                                <option value="cm">Centímetros (cm)</option>
                                <option value="m">Metros (m)</option>
                            </select>
                        </div>

                        <div className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800/30 p-4">
                            <h4 className="mb-1 text-xs font-bold tracking-wider text-gray-600 dark:text-gray-600 dark:text-gray-400 uppercase">
                                Calibración manual
                            </h4>
                            <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-500">
                                Mide una distancia conocida en el plano para
                                calibrar la escala.
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="gap-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-600"
                                onClick={() => {
                                    setScaleConfirmed(true);
                                    store.setTool('calibrate');
                                    setIsImportModalOpen(false);
                                }}
                            >
                                <Ruler size={13} /> Iniciar calibración
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            className="bg-cyan-600 font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!!detectedScale && !scaleConfirmed}
                            title={
                                detectedScale && !scaleConfirmed
                                    ? 'Confirma la unidad o inicia una calibración manual primero'
                                    : undefined
                            }
                            onClick={() => setIsImportModalOpen(false)}
                        >
                            Listo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Import Luminaires Modal ── */}
            <ImportLuminairesModal
                open={isImportLuminairesModalOpen}
                onOpenChange={setIsImportLuminairesModalOpen}
            />
        </>
    );
};
