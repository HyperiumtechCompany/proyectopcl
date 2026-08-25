import { Head, Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    Network,
    Save,
    TableProperties,
    Trash2,
} from 'lucide-react';
import { show as showProject } from '@/actions/App/Http/Controllers/Dialux/V2/ProjectController';
import { update as updateModule } from '@/actions/App/Http/Controllers/Dialux/V2/ModuleController';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { ElectricalCanvas } from './electrical-network/components/ElectricalCanvas';
import { ElectricalCtSummary } from './electrical-network/components/ElectricalCtSummary';
import { ElectricalCtTable } from './electrical-network/components/ElectricalCtTable';
import { ElectricalPalette } from './electrical-network/components/ElectricalPalette';
import { ElectricalPropertiesPanel } from './electrical-network/components/ElectricalPropertiesPanel';
import { ElectricalTreeView } from './electrical-network/components/ElectricalTreeView';
import type {
    ElectricalNetworkSnapshot,
    ModuleElectricalPort,
} from './electrical-network/domain/types';
import { useElectricalNetwork } from './electrical-network/hooks/useElectricalNetwork';
import { GeneralWorkspaceTabs } from './components/GeneralWorkspaceTabs';
import type { ConductorCatalog } from '@/pages/dialux/electrical/engine/types';
import { calculateProjectPanelCircuitSummaries } from '@/pages/dialux/hooks/wireLengthCalculations';
import { pointInPolygon } from '@/pages/dialux/hooks/ambientSpaces';
import type { Scene } from '@/pages/dialux/hooks/types';

const defined = <T extends Record<string, unknown>>(values: T): Partial<T> =>
    Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined),
    ) as Partial<T>;

export default function ElectricalNetworkPage({
    project,
    network,
    ports,
    conductors,
    moduleScenes,
    generalModuleId,
}: {
    project: { id: number; name: string };
    network: ElectricalNetworkSnapshot;
    ports: ModuleElectricalPort[];
    conductors: ConductorCatalog[];
    moduleScenes: Array<{
        moduleId: number;
        moduleName: string;
        data: Record<string, unknown> & { scenes: Scene[] };
        scenes: Scene[];
    }>;
    generalModuleId: number | null;
}) {
    const [modulesData, setModulesData] = useState(moduleScenes);
    const [workspaceView, setWorkspaceView] = useState<'diagram' | 'ct'>(
        'diagram',
    );
    const moduleCtCircuits = useMemo(
        () =>
            modulesData.flatMap((module) =>
                calculateProjectPanelCircuitSummaries(module.scenes).map(
                    (circuit) => ({
                        ...circuit,
                        moduleId: module.moduleId,
                        moduleName: module.moduleName,
                    }),
                ),
            ),
        [modulesData],
    );
    const panelFeederGeometry = useMemo(
        () =>
            Object.fromEntries(
                modulesData.flatMap((module) => {
                    const summaries = calculateProjectPanelCircuitSummaries(
                        module.scenes,
                    );
                    const devices = module.scenes.flatMap(
                        (scene) => scene.electricalDevices ?? [],
                    );

                    return summaries
                        .filter((summary) => summary.isPanelSummary)
                        .map((summary) => {
                            const device = devices.find(
                                (candidate) => candidate.id === summary.panelId,
                            );
                            const scene = module.scenes.find(
                                (candidate) => candidate.id === summary.levelId,
                            );
                            const roomHeight = scene?.rooms.find(
                                (room) =>
                                    room.id === device?.roomId ||
                                    (device !== undefined &&
                                        pointInPolygon(device, room.vertices)),
                            )?.height;
                            const mountingHeightM =
                                device?.mountingHeight ?? 1.9;

                            return [
                                summary.panelId,
                                {
                                    horizontalLengthM:
                                        summary.horizontalLengthM,
                                    verticalLengthM: summary.verticalLengthM,
                                    mountingHeightM,
                                    ceilingRiseM: Math.max(
                                        0,
                                        (roomHeight ??
                                            scene?.floorHeight ??
                                            3.5) - mountingHeightM,
                                    ),
                                    x: device?.x ?? 0,
                                    y: device?.y ?? 0,
                                    sceneId: summary.levelId,
                                    floorElevationM: scene?.floorElevation ?? 0,
                                },
                            ];
                        });
                }),
            ),
        [modulesData],
    );
    const updateModuleCircuit = (
        circuit: (typeof moduleCtCircuits)[number],
        patch: Partial<(typeof moduleCtCircuits)[number]>,
    ) => {
        setModulesData((current) =>
            current.map((module) => {
                if (module.moduleId !== circuit.moduleId) return module;
                const scenes = module.scenes.map((scene) => {
                    if (scene.id !== circuit.levelId) return scene;
                    if (circuit.isPanelSummary) {
                        return {
                            ...scene,
                            electricalDevices: scene.electricalDevices?.map(
                                (device) =>
                                    device.id === circuit.panelId
                                        ? {
                                              ...device,
                                              properties: {
                                                  ...device.properties,
                                                  ...defined({
                                                      defaultPowerFactor:
                                                          patch.powerFactor,
                                                      defaultDemandFactor:
                                                          patch.demandFactor,
                                                      ambientTemperatureC:
                                                          patch.ambientTemperatureC,
                                                      groupedCircuitCount:
                                                          patch.groupedCircuitCount,
                                                      groupingFactor:
                                                          patch.groupingFactor,
                                                      temperatureFactor:
                                                          patch.temperatureFactor,
                                                      sectionMm2:
                                                          patch.sectionMm2,
                                                      wireType:
                                                          patch.conductorType,
                                                      earthSectionMm2:
                                                          patch.earthSectionMm2,
                                                      itm: patch.itm,
                                                      dif: patch.dif,
                                                  }),
                                              },
                                          }
                                        : device,
                            ),
                        };
                    }
                    return {
                        ...scene,
                        conductors: scene.conductors?.map((conductor) =>
                            conductor.id === circuit.rootConductorId
                                ? {
                                      ...conductor,
                                      sectionMm2:
                                          patch.sectionMm2 ??
                                          conductor.sectionMm2,
                                      conductorType:
                                          patch.conductorType ??
                                          conductor.conductorType,
                                      ct: {
                                          ...conductor.ct,
                                          ...defined({
                                              powerFactor: patch.powerFactor,
                                              demandFactor: patch.demandFactor,
                                              phaseBalance: patch.phaseBalance,
                                              ambientTemperatureC:
                                                  patch.ambientTemperatureC,
                                              groupedCircuitCount:
                                                  patch.groupedCircuitCount,
                                              groupingFactor:
                                                  patch.groupingFactor,
                                              temperatureFactor:
                                                  patch.temperatureFactor,
                                              itm: patch.itm,
                                              dif: patch.dif,
                                              earthSectionMm2:
                                                  patch.earthSectionMm2,
                                          }),
                                      },
                                  }
                                : conductor,
                        ),
                    };
                });
                const next = {
                    ...module,
                    scenes,
                    data: { ...module.data, scenes },
                };
                const token = document.cookie.match(
                    /(?:^|;\s*)XSRF-TOKEN=([^;]*)/,
                )?.[1];
                void fetch(updateModule.url([project.id, module.moduleId]), {
                    method: 'PATCH',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-XSRF-TOKEN': token ? decodeURIComponent(token) : '',
                    },
                    body: JSON.stringify({ data: next.data }),
                });
                return next;
            }),
        );
    };
    const editor = useElectricalNetwork(
        project.id,
        network,
        ports,
        conductors,
        panelFeederGeometry,
    );
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'DIALux v2', href: '/dialux-v2' },
        { title: project.name, href: showProject.url(project.id) },
        { title: 'Módulo General', href: '#' },
    ];
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Red eléctrica — ${project.name}`} />
            <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col bg-slate-100 dark:bg-slate-950">
                <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-white/10 dark:bg-[#0d0f14]">
                    <Link
                        href={showProject(project.id)}
                        className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                        ← Proyecto
                    </Link>
                    <div className="flex items-center gap-2">
                        <Network className="h-4 w-4 text-amber-500" />
                        <strong className="text-sm text-slate-900 dark:text-white">
                            Módulo General
                        </strong>
                    </div>
                    <span className="text-[10px] text-slate-500">
                        TG → TD → Sub-TD
                    </span>
                    {generalModuleId && (
                        <GeneralWorkspaceTabs
                            projectId={project.id}
                            moduleId={generalModuleId}
                            active="network"
                        />
                    )}
                    <div className="ml-auto flex items-center gap-2">
                        {editor.connectingFrom && (
                            <button
                                type="button"
                                onClick={editor.cancelConnection}
                                className="rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300"
                            >
                                Selecciona el tablero destino · Cancelar
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={editor.removeSelected}
                            disabled={!editor.selectedId}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-30 dark:border-white/10"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={editor.save}
                            disabled={editor.saving || !editor.dirty}
                            className="flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                        >
                            <Save className="h-4 w-4" />
                            {editor.saving ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                </header>
                {(editor.message ||
                    editor.issues.some(
                        (issue) => issue.code !== 'disconnected',
                    )) && (
                    <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4" />
                        {editor.message ?? editor.issues[0]?.message}
                    </div>
                )}
                <ElectricalCtSummary
                    calculations={editor.calculations}
                    data={editor.snapshot.data}
                />
                <nav className="flex items-center gap-1 border-b border-slate-200 bg-white px-4 py-2 dark:border-white/10 dark:bg-[#101218]">
                    <button
                        type="button"
                        onClick={() => setWorkspaceView('diagram')}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${workspaceView === 'diagram' ? 'bg-cyan-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'}`}
                    >
                        <Network className="h-4 w-4" />
                        Diagrama de red
                    </button>
                    <button
                        type="button"
                        onClick={() => setWorkspaceView('ct')}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${workspaceView === 'ct' ? 'bg-cyan-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'}`}
                    >
                        <TableProperties className="h-4 w-4" />
                        Tabla CT global
                    </button>
                </nav>
                {workspaceView === 'ct' ? (
                    <ElectricalCtTable
                        data={editor.snapshot.data}
                        calculations={editor.calculations}
                        moduleCtCircuits={moduleCtCircuits}
                        onUpdateCircuit={updateModuleCircuit}
                        issues={editor.issues}
                        onUpdateEdge={editor.updateEdge}
                        onUpdateSettings={editor.updateSettings}
                        onRemove={editor.removeById}
                        onSelect={editor.setSelectedId}
                    />
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                        <ElectricalPalette
                            ports={ports}
                            data={editor.snapshot.data}
                            onConnectModule={editor.connectModuleToTg}
                        />
                        <main className="min-h-[420px] min-w-0 flex-1 overflow-auto">
                            <ElectricalCanvas
                                data={editor.snapshot.data}
                                selectedId={editor.selectedId}
                                connectingFrom={editor.connectingFrom}
                                onSelect={editor.setSelectedId}
                                onStartConnection={editor.startConnection}
                                onFinishConnection={editor.finishConnection}
                                onMove={editor.moveNode}
                                onRemove={editor.removeById}
                                ports={ports}
                                calculations={editor.calculations}
                            />
                        </main>
                        <div className="flex w-full flex-col xl:w-72">
                            <ElectricalPropertiesPanel
                                data={editor.snapshot.data}
                                selectedId={editor.selectedId}
                                calculations={editor.calculations}
                                onUpdateEdge={editor.updateEdge}
                                onUpdateNode={editor.updateNode}
                                onChangeNodeParent={editor.changeNodeParent}
                                onRemove={editor.removeById}
                            />
                            <details className="border-t border-slate-200 bg-white dark:border-white/10 dark:bg-[#101218]">
                                <summary className="cursor-pointer p-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Vista de árbol accesible
                                </summary>
                                <ElectricalTreeView
                                    data={editor.snapshot.data}
                                    onSelect={editor.setSelectedId}
                                />
                            </details>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
