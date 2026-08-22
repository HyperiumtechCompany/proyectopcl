import { Boxes, Cable, CheckCircle2, LayoutGrid, PlugZap } from 'lucide-react';
import type {
    ElectricalNetworkData,
    ModuleElectricalPort,
} from '../domain/types';

export function ElectricalPalette({
    ports,
    data,
    onConnectModule,
}: {
    ports: ModuleElectricalPort[];
    data: ElectricalNetworkData;
    onConnectModule: (moduleId: number) => void;
}) {
    const modules = [...new Set(ports.map((port) => port.moduleId))].map(
        (moduleId) => ({
            moduleId,
            ports: ports.filter((port) => port.moduleId === moduleId),
        }),
    );

    return (
        <aside className="w-full border-b border-slate-200 bg-white lg:w-72 lg:border-r lg:border-b-0 dark:border-white/10 dark:bg-[#101218]">
            <div className="border-b border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Boxes className="h-4 w-4 text-amber-500" /> Módulos
                    eléctricos
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Importa la jerarquía de tableros y alimenta únicamente su
                    raíz desde el TG.
                </p>
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto p-3 lg:max-h-none">
                {modules.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
                        <LayoutGrid className="mx-auto mb-2 h-5 w-5" />
                        Ningún módulo ha publicado cableado o tableros.
                    </div>
                )}
                {modules.map(({ moduleId, ports: modulePorts }) => {
                    const connectedCount = modulePorts.filter((port) =>
                        data.nodes.some(
                            (node) =>
                                node.moduleId === moduleId &&
                                node.deviceId === port.panelId,
                        ),
                    ).length;
                    const imported = connectedCount === modulePorts.length;
                    const moduleName = modulePorts[0].moduleName;
                    return (
                        <article
                            key={moduleId}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black/20"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <strong className="block truncate text-xs text-slate-900 dark:text-white">
                                        {moduleName}
                                    </strong>
                                    <span className="text-[10px] text-slate-500">
                                        {modulePorts.length} tablero(s) ·{' '}
                                        {connectedCount} importado(s)
                                    </span>
                                </div>
                                {imported && (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                )}
                            </div>
                            <div className="mt-2 space-y-1 border-l border-slate-300 pl-2 dark:border-slate-700">
                                {modulePorts.map((port) => {
                                    const parent = modulePorts.find(
                                        (candidate) =>
                                            candidate.panelId ===
                                            port.parentPanelId,
                                    );
                                    return (
                                        <div
                                            key={port.key}
                                            className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5 text-[10px] text-slate-600 dark:text-slate-300"
                                        >
                                            <Cable className="mt-0.5 h-3 w-3 text-cyan-500" />
                                            <span className="truncate font-medium">
                                                {port.panelLabel}
                                            </span>
                                            <span className="col-start-2 truncate text-slate-400">
                                                {parent
                                                    ? `Alimentado por ${parent.panelLabel}`
                                                    : 'Raíz del módulo · alimentado por TG'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={() => onConnectModule(moduleId)}
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-cyan-500"
                            >
                                {imported ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                    <PlugZap className="h-3.5 w-3.5" />
                                )}
                                {imported
                                    ? 'Actualizar jerarquía del módulo'
                                    : 'Agregar estructura al lienzo'}
                            </button>
                        </article>
                    );
                })}
            </div>
        </aside>
    );
}
