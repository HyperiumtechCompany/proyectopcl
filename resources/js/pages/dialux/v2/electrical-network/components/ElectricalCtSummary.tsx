import { AlertTriangle, CheckCircle2, Factory, Gauge, Zap } from 'lucide-react';
import type { EdgeCalculation } from '../domain/calculations';
import { networkRootIds } from '../domain/graph';
import type { ShortCircuitResult } from '../domain/shortCircuit';
import { sizeSupplies } from '../domain/supplySizing';
import type { ElectricalNetworkData } from '../domain/types';

export function ElectricalCtSummary({
    calculations,
    data,
    shortCircuits,
}: {
    calculations: EdgeCalculation[];
    data: ElectricalNetworkData;
    shortCircuits?: ShortCircuitResult;
}) {
    // Alimentadores de distribución: hacia tableros de módulo, sub tableros
    // de la planta y TG alimentados desde otro TG (cable TG → TG en planta).
    const nodeTypeById = new Map(data.nodes.map((node) => [node.id, node.type]));
    const distributionEdgeIds = new Set(
        data.edges
            .filter((edge) => {
                const target = nodeTypeById.get(edge.targetNodeId);
                return (
                    target === 'module_panel_port' ||
                    target === 'site_panel' ||
                    (target === 'main_panel' &&
                        nodeTypeById.get(edge.sourceNodeId) === 'main_panel')
                );
            })
            .map((edge) => edge.id),
    );
    const feeders = calculations.filter((item) =>
        distributionEdgeIds.has(item.edgeId),
    );
    // Demanda global = lo que entra por CADA suministro (varios TG con su
    // propio suministro suman; un TG colgado de otro no se cuenta dos veces).
    const roots = new Set(networkRootIds(data));
    const rootEdgeIds = new Set(
        data.edges
            .filter((edge) => roots.has(edge.sourceNodeId))
            .map((edge) => edge.id),
    );
    const rootFeeders = calculations.filter((item) =>
        rootEdgeIds.has(item.edgeId),
    );
    const demandPowerW = rootFeeders.reduce(
        (total, item) => total + item.demandPowerW,
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
    // R2: potencia del suministro (una tarjeta resume todas las raíces).
    const supplies = sizeSupplies(data, calculations).filter(
        (item) => item.status !== 'no_load',
    );
    // R3: un interruptor con Icu < I″k o un cable que no soporta la falla.
    const shortCircuitProblems =
        [...(shortCircuits?.nodes.values() ?? [])].filter(
            (item) => item.breakingCapacityOk === false,
        ).length +
        [...(shortCircuits?.edges.values() ?? [])].filter((item) => !item.ok)
            .length;
    const maxIkKa = Math.max(
        0,
        ...[...(shortCircuits?.nodes.values() ?? [])]
            .map((item) => item.ikKa)
            .filter(Number.isFinite),
    );
    const supplyWarning =
        shortCircuitProblems > 0 ||
        supplies.some(
            (item) =>
                item.status === 'overloaded' || item.status === 'out_of_range',
        );
    const supplyValue =
        supplies.length === 0
            ? '—'
            : supplies
                  .map((item) =>
                      item.ratedKva
                          ? `${item.ratedKva} kVA · ${Math.round(item.loadingPercent ?? 0)} %`
                          : item.suggestedKva
                            ? `${item.suggestedKva} kVA sug.`
                            : '> 2500 kVA',
                  )
                  .join(' | ');

    return (
        <section className="grid gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:grid-cols-2 xl:grid-cols-5 dark:border-white/10 dark:bg-[#101218]">
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
                icon={supplyWarning ? AlertTriangle : Factory}
                label={
                    shortCircuitProblems > 0
                        ? `Suministro · ${shortCircuitProblems} falla(s) de cortocircuito`
                        : maxIkKa > 0
                          ? `Suministro · I″k máx. ${maxIkKa.toFixed(1)} kA`
                          : 'Suministro / transformador'
                }
                value={supplyValue}
                warning={supplyWarning}
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
                // "Dentro del límite configurado", no "conformes": el límite por
                // defecto (CNE-Utilización, Regla 050-102) tiene edición/numeral
                // sin confirmar (auditoría normativa R6).
                label="Alimentadores dentro del límite configurado"
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
