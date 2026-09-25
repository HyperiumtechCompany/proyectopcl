import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { ConductorCatalog } from '@/pages/dialux/electrical/engine/types';
import type { EdgeCalculation } from '../domain/calculations';
import type { SectionOptimization } from '../domain/sectionOptimizer';
import { optimizeFeederSections } from '../domain/sectionOptimizer';
import type { ShortCircuitResult } from '../domain/shortCircuit';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    ModuleElectricalPort,
} from '../domain/types';
import { fmtNumber } from './ElectricalSizingFields';

/**
 * Reparto óptimo de la caída de tensión (R5 de
 * `plan_red_ct_dimensionamiento_multimodulo.md`): calcula a pedido (no en cada
 * render: es la parte pesada), compara la masa de conductor actual / tramo a
 * tramo / óptima y aplica las secciones con un clic.
 */
export function SectionOptimizerPanel({
    data,
    ports,
    calculations,
    conductors,
    shortCircuits,
    fixedEdgeIds,
    onUpdateEdge,
    onSelect,
}: {
    data: ElectricalNetworkData;
    ports: ModuleElectricalPort[];
    calculations: EdgeCalculation[];
    conductors: ConductorCatalog[];
    shortCircuits?: ShortCircuitResult;
    fixedEdgeIds?: Set<string>;
    onUpdateEdge: (id: string, patch: Partial<ElectricalEdge>) => void;
    onSelect: (id: string) => void;
}) {
    const [result, setResult] = useState<SectionOptimization | null>(null);
    const [reserveModules, setReserveModules] = useState(true);
    const run = () =>
        setResult(
            optimizeFeederSections(data, ports, calculations, conductors, shortCircuits, {
                reserveModuleCircuits: reserveModules,
                fixedEdgeIds,
            }),
        );
    const changed = result?.changes.filter(
        (change) => change.optimalMm2 !== change.currentMm2,
    ) ?? [];
    const saving =
        result && result.massKg.perFeeder > 0
            ? (1 - result.massKg.optimal / result.massKg.perFeeder) * 100
            : 0;

    return (
        <section className="border-t border-slate-200 bg-white p-4 text-xs dark:border-white/10 dark:bg-[#101218]">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white">
                    Reparto óptimo de ΔU
                </h3>
                <button
                    type="button"
                    onClick={run}
                    className="ml-auto inline-flex items-center gap-1 rounded-md bg-cyan-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-cyan-700"
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    {result ? 'Recalcular' : 'Optimizar secciones'}
                </button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                <input
                    type="checkbox"
                    checked={reserveModules}
                    onChange={(event) => setReserveModules(event.target.checked)}
                />
                Reservar la ΔU interna de cada módulo (su circuito más largo)
            </label>
            {result && (
                <div className="mt-2 grid gap-2">
                    {result.fixedOverLimitEdgeIds.length > 0 && (
                        <p className="rounded bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
                            {result.fixedOverLimitEdgeIds.length} alimentador(es) con
                            sección fijada en su cable de la planta (o sin datos)
                            ya superan el {data.settings.feederDropLimitPercent} %
                            propio: el optimizador no puede cambiarlos. Sube su
                            sección en el cable de la planta.
                            {result.fixedOverLimitEdgeIds.map((edgeId) => (
                                <button
                                    key={edgeId}
                                    type="button"
                                    onClick={() => onSelect(edgeId)}
                                    className="ml-1 underline"
                                >
                                    ver
                                </button>
                            ))}
                        </p>
                    )}
                    {result.thermalRecheckFailures.length > 0 && (
                        <p className="rounded bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
                            {result.thermalRecheckFailures.length} alimentador(es) no
                            pasan la verificación térmica al recalcular el
                            cortocircuito con las secciones óptimas: revisa el
                            tiempo de despeje o el transformador.
                        </p>
                    )}
                    {result.infeasibleRoots.length > 0 && (
                        <p className="rounded bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
                            No hay combinación de secciones que cumpla los
                            límites ({data.settings.feederDropLimitPercent} % por
                            alimentador, {data.settings.totalDropLimitPercent} %
                            total) en {result.infeasibleRoots.length} suministro(s):
                            acorta recorridos, reubica el TG o revisa la reserva
                            interna de los módulos.
                        </p>
                    )}
                    <div className="grid grid-cols-3 gap-1 text-center">
                        {[
                            ['Actual', result.massKg.current],
                            ['Tramo a tramo', result.massKg.perFeeder],
                            ['Óptimo', result.massKg.optimal],
                        ].map(([label, value]) => (
                            <div
                                key={label as string}
                                className="rounded border border-slate-200 px-1 py-1 dark:border-white/10"
                            >
                                <p className="text-[9px] text-slate-500">{label}</p>
                                <p className="font-bold tabular-nums">
                                    {fmtNumber(value as number, 1)} kg
                                </p>
                            </div>
                        ))}
                    </div>
                    {result.feasible && saving > 0.05 && (
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                            {fmtNumber(saving, 1)} % menos conductor que el
                            corrector tramo a tramo, con ΔU máx.{' '}
                            {fmtNumber(result.maxAccumulatedPercent, 2)} %
                            (incluida la reserva).
                        </p>
                    )}
                    {changed.length > 0 ? (
                        <>
                            <table className="w-full text-left text-[10px]">
                                <thead className="text-slate-500">
                                    <tr>
                                        <th className="py-0.5">Alimentador</th>
                                        <th className="py-0.5 text-right">Actual</th>
                                        <th className="py-0.5 text-right">Óptima</th>
                                        <th className="py-0.5 text-right">ΔU acum.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {changed.map((change) => (
                                        <tr
                                            key={change.edgeId}
                                            onClick={() => onSelect(change.edgeId)}
                                            className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
                                        >
                                            <td className="max-w-32 truncate py-0.5" title={change.label}>
                                                {change.label}
                                            </td>
                                            <td className="py-0.5 text-right tabular-nums">
                                                {change.currentMm2}
                                            </td>
                                            <td className="py-0.5 text-right font-semibold tabular-nums">
                                                {change.optimalMm2}
                                            </td>
                                            <td className="py-0.5 text-right tabular-nums">
                                                {fmtNumber(change.accumulatedPercent, 2)} %
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button
                                type="button"
                                onClick={() => {
                                    changed.forEach((change) =>
                                        onUpdateEdge(change.edgeId, {
                                            sectionMm2: change.optimalMm2,
                                        }),
                                    );
                                    setResult(null);
                                }}
                                className="rounded-md border border-cyan-300 px-2 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-500/40 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
                            >
                                Aplicar {changed.length} sección(es)
                            </button>
                        </>
                    ) : (
                        result.feasible && (
                            <p className="text-[10px] text-slate-500">
                                Las secciones actuales ya son las óptimas.
                            </p>
                        )
                    )}
                    <p className="text-[9px] leading-relaxed text-slate-400">
                        Minimiza la masa de conductores activos de todo el árbol
                        a la vez (programación dinámica exacta, ΔU con IEC
                        60364-5-52 Anexo G redondeada hacia arriba a 0,01 %),
                        respetando ampacidad
                        {result.usedCatalog ? ' del catálogo' : ' (catálogo vacío: serie IEC 60228 sin verificar ampacidad)'}
                        , cortocircuito y 2,5 mm² mínimo.
                        {fixedEdgeIds && fixedEdgeIds.size > 0
                            ? ` ${fixedEdgeIds.size} alimentador(es) conservan la sección fijada en su cable de la planta.`
                            : ''}{' '}
                        Si cambias la red, recalcula.
                    </p>
                </div>
            )}
        </section>
    );
}
