import { AlertTriangle, CheckCircle2, Gauge, Zap } from 'lucide-react';
import type { EdgeCalculation } from '../domain/calculations';
import type { ElectricalNetworkData } from '../domain/types';

export function ElectricalCtSummary({
    calculations,
    data,
}: {
    calculations: EdgeCalculation[];
    data: ElectricalNetworkData;
}) {
    const moduleNodeIds = new Set(
        data.nodes
            .filter((node) => node.type === 'module_panel_port')
            .map((node) => node.id),
    );
    const moduleEdgeIds = new Set(
        data.edges
            .filter((edge) => moduleNodeIds.has(edge.targetNodeId))
            .map((edge) => edge.id),
    );
    const feeders = calculations.filter((item) =>
        moduleEdgeIds.has(item.edgeId),
    );
    const demandPowerW = feeders.reduce(
        (maximum, item) => Math.max(maximum, item.demandPowerW),
        0,
    );
    const maxCurrentA = feeders.reduce(
        (maximum, item) => Math.max(maximum, item.designCurrentA),
        0,
    );
    const maxDropPercent = feeders.reduce(
        (maximum, item) =>
            Math.max(maximum, item.accumulatedVoltageDropPercent),
        0,
    );
    const compliant = feeders.filter(
        (item) => item.status === 'complete' || item.status === 'warning',
    ).length;
    const pending = feeders.filter(
        (item) => item.status === 'incomplete',
    ).length;
    const noPublishedLoad = feeders.length > 0 && demandPowerW <= 0;

    return (
        <section className="grid gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:grid-cols-2 xl:grid-cols-4 dark:border-white/10 dark:bg-[#101218]">
            <Metric
                icon={noPublishedLoad ? AlertTriangle : Zap}
                label="Máxima demanda global"
                value={
                    noPublishedLoad
                        ? 'Sin carga publicada'
                        : `${(demandPowerW / 1000).toFixed(2)} kW`
                }
                warning={noPublishedLoad}
            />
            <Metric
                icon={Gauge}
                label="Corriente de diseño máx."
                value={`${maxCurrentA.toFixed(2)} A`}
                warning={noPublishedLoad}
            />
            <Metric
                icon={
                    pending > 0 || maxDropPercent > 5
                        ? AlertTriangle
                        : CheckCircle2
                }
                label="Caída acumulada máx."
                value={
                    pending > 0 ? 'Pendiente' : `${maxDropPercent.toFixed(2)} %`
                }
                warning={pending > 0 || maxDropPercent > 5}
            />
            <Metric
                icon={
                    compliant === feeders.length && pending === 0
                        ? CheckCircle2
                        : AlertTriangle
                }
                label="Alimentadores conformes"
                value={`${compliant}/${feeders.length}`}
                warning={compliant !== feeders.length || pending > 0}
            />
        </section>
    );
}

function Metric({
    icon: Icon,
    label,
    value,
    warning = false,
}: {
    icon: typeof Zap;
    label: string;
    value: string;
    warning?: boolean;
}) {
    return (
        <article className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-black/20">
            <Icon
                className={`h-4 w-4 shrink-0 ${warning ? 'text-amber-500' : 'text-emerald-500'}`}
            />
            <div className="min-w-0">
                <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {label}
                </p>
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {value}
                </p>
            </div>
        </article>
    );
}
