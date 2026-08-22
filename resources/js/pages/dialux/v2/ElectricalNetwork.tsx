import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, Network, Save, Trash2 } from 'lucide-react';
import { show as showProject } from '@/actions/App/Http/Controllers/Dialux/V2/ProjectController';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { ElectricalCanvas } from './electrical-network/components/ElectricalCanvas';
import { ElectricalCtSummary } from './electrical-network/components/ElectricalCtSummary';
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

export default function ElectricalNetworkPage({
    project,
    network,
    ports,
    conductors,
    generalModuleId,
}: {
    project: { id: number; name: string };
    network: ElectricalNetworkSnapshot;
    ports: ModuleElectricalPort[];
    conductors: ConductorCatalog[];
    generalModuleId: number | null;
}) {
    const editor = useElectricalNetwork(project.id, network, ports, conductors);
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
                            <span className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                                Selecciona destino
                            </span>
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
            </div>
        </AppLayout>
    );
}
