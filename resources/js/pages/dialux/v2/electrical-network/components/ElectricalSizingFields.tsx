import type { EdgeCalculation } from '../domain/calculations';
import {
    simultaneityFactorOf,
    suggestedSimultaneityFactor,
} from '../domain/calculations';
import type { NodeShortCircuit } from '../domain/shortCircuit';
import {
    DEFAULT_UPSTREAM_SHORT_CIRCUIT_MVA,
    defaultTransformerUkPercent,
} from '../domain/shortCircuit';
import { DEFAULT_SUPPLY_RESERVE_PERCENT, sizeSupplies } from '../domain/supplySizing';
import type { ElectricalNetworkData, ElectricalNode } from '../domain/types';

/**
 * Campos de dimensionamiento de la red (plan
 * `plan_red_ct_dimensionamiento_multimodulo.md`): simultaneidad (R1),
 * suministro / transformador (R2) y cortocircuito (R3). Compartidos por
 * `ElectricalPropertiesPanel`.
 */

export const inputClass =
    'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

const kw = (watts: number) =>
    `${(watts / 1000).toLocaleString('es-PE', { maximumFractionDigits: 2 })} kW`;

/**
 * Factor de simultaneidad del tablero (R1 de
 * `plan_red_ct_dimensionamiento_multimodulo.md`): reduce la suma de las
 * demandas de sus salidas. Vacío = 1 (suma simple). La referencia IEC 61439-1
 * solo se SUGIERE; el usuario decide aplicarla.
 */
export function SimultaneityFields({
    node,
    outgoingCount,
    result,
    onUpdateNode,
}: {
    node: ElectricalNode;
    outgoingCount: number;
    result?: EdgeCalculation;
    onUpdateNode: (id: string, patch: Partial<ElectricalNode>) => void;
}) {
    const fs = simultaneityFactorOf(node);
    const suggested = suggestedSimultaneityFactor(outgoingCount);
    return (
        <div className="grid gap-1">
            <label className="text-[11px] text-slate-500">
                Simultaneidad de salidas (fs)
                <input
                    type="number"
                    min={0.1}
                    max={1}
                    step="0.05"
                    placeholder="1 (suma simple)"
                    className={inputClass}
                    value={node.simultaneityFactor ?? ''}
                    onChange={(event) => {
                        const value = Number(event.target.value);
                        onUpdateNode(node.id, {
                            simultaneityFactor:
                                event.target.value === '' || !(value > 0)
                                    ? undefined
                                    : Math.min(1, value),
                        });
                    }}
                />
            </label>
            {result && result.simultaneityFactor < 1 && (
                <Info
                    label="Σ MD salidas → con fs"
                    value={`${kw(result.outgoingDemandPowerW)} → ${kw(result.outgoingDemandPowerW * result.simultaneityFactor)}`}
                />
            )}
            {outgoingCount > 1 && suggested !== fs && (
                <button
                    type="button"
                    onClick={() =>
                        onUpdateNode(node.id, { simultaneityFactor: suggested })
                    }
                    className="rounded-md border border-cyan-300 px-2 py-1 text-left text-[10px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-500/40 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
                >
                    Aplicar referencia {suggested} ({outgoingCount} salidas)
                </button>
            )}
            <span className="block text-[10px] leading-relaxed text-slate-400">
                Reduce la suma de las demandas de sus salidas (no la carga
                propia ni la potencia instalada); cambia la corriente, la
                sección y la ΔU de su alimentador y de todo lo que está aguas
                arriba. Referencia: IEC 61439-1, factor de simultaneidad
                asignado (verificar edición). Los factores de demanda del
                CNE-Utilización van dentro de cada módulo.
            </span>
        </div>
    );
}

export const optionalNumber = (raw: string): number | undefined => {
    const value = Number(raw);
    return raw === '' || !Number.isFinite(value) || value < 0 ? undefined : value;
};

export const fmtNumber = (value: number | undefined, digits = 1) =>
    value === undefined
        ? '—'
        : value.toLocaleString('es-PE', { maximumFractionDigits: digits });

/**
 * Suministro / transformador de una raíz de la red (R2 de
 * `plan_red_ct_dimensionamiento_multimodulo.md`): demanda en kVA, potencia
 * normalizada sugerida con reserva y % de carga.
 */
export function SupplyFields({
    node,
    data,
    calculations,
    onUpdateNode,
}: {
    node: ElectricalNode;
    data: ElectricalNetworkData;
    calculations: EdgeCalculation[];
    onUpdateNode: (id: string, patch: Partial<ElectricalNode>) => void;
}) {
    const sizing = sizeSupplies(data, calculations).find(
        (item) => item.nodeId === node.id,
    );
    return (
        <div className="grid gap-1">
            <div className="mt-1 border-t border-slate-200 pt-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-300">
                Suministro / transformador
            </div>
            <label className="text-[11px] text-slate-500">
                Potencia nominal (kVA)
                <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder={
                        sizing?.suggestedKva
                            ? `Sin definir (sugerido ${fmtNumber(sizing.suggestedKva)})`
                            : 'Sin definir'
                    }
                    className={inputClass}
                    value={node.transformerKva ?? ''}
                    onChange={(event) => {
                        const value = optionalNumber(event.target.value);
                        onUpdateNode(node.id, {
                            transformerKva: value && value > 0 ? value : undefined,
                        });
                    }}
                />
            </label>
            <label className="text-[11px] text-slate-500">
                Reserva sobre la demanda (%)
                <input
                    type="number"
                    min={0}
                    max={200}
                    step="5"
                    placeholder={`${DEFAULT_SUPPLY_RESERVE_PERCENT}`}
                    className={inputClass}
                    value={node.supplyReservePercent ?? ''}
                    onChange={(event) =>
                        onUpdateNode(node.id, {
                            supplyReservePercent: optionalNumber(
                                event.target.value,
                            ),
                        })
                    }
                />
            </label>
            <label className="text-[11px] text-slate-500">
                Tensión de cortocircuito uk (%)
                <input
                    type="number"
                    min={0}
                    step="0.5"
                    placeholder={`${defaultTransformerUkPercent(
                        sizing?.ratedKva ?? sizing?.suggestedKva ?? 0,
                    )} (IEC 60076-5)`}
                    className={inputClass}
                    value={node.transformerUkPercent ?? ''}
                    onChange={(event) => {
                        const value = optionalNumber(event.target.value);
                        onUpdateNode(node.id, {
                            transformerUkPercent:
                                value && value > 0 ? value : undefined,
                        });
                    }}
                />
            </label>
            <label className="text-[11px] text-slate-500">
                Potencia de cortocircuito de la red S″kQ (MVA)
                <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder={`${DEFAULT_UPSTREAM_SHORT_CIRCUIT_MVA} (dato de la distribuidora)`}
                    className={inputClass}
                    value={node.upstreamShortCircuitMva ?? ''}
                    onChange={(event) => {
                        const value = optionalNumber(event.target.value);
                        onUpdateNode(node.id, {
                            upstreamShortCircuitMva:
                                value && value > 0 ? value : undefined,
                        });
                    }}
                />
            </label>
            {sizing && sizing.status !== 'no_load' ? (
                <>
                    <Info
                        label="Demanda"
                        value={`${fmtNumber(sizing.demandKva, 2)} kVA`}
                    />
                    <Info
                        label={`Requerida (+${fmtNumber(sizing.reservePercent, 0)} %)`}
                        value={`${fmtNumber(sizing.requiredKva, 2)} kVA`}
                    />
                    <Info
                        label="Potencia normalizada sugerida"
                        value={
                            sizing.suggestedKva
                                ? `${fmtNumber(sizing.suggestedKva)} kVA`
                                : '> 2500 kVA (dividir en suministros)'
                        }
                    />
                    <Info
                        label={
                            sizing.ratedKva ? 'Carga (placa)' : 'Carga (sugerida)'
                        }
                        value={`${fmtNumber(sizing.loadingPercent, 1)} %`}
                    />
                    <Info
                        label="In secundario"
                        value={`${fmtNumber(sizing.ratedCurrentA, 1)} A`}
                    />
                    {sizing.status === 'overloaded' && (
                        <p className="rounded bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
                            La demanda supera la potencia nominal fijada.
                        </p>
                    )}
                </>
            ) : (
                <p className="text-[10px] text-slate-400">
                    Sin demanda publicada aguas abajo.
                </p>
            )}
            <span className="block text-[10px] leading-relaxed text-slate-400">
                S = Σ P/cos φ de sus salidas (× fs si lo tiene). Serie de
                potencias usuales de distribución + R10 de IEC 60076-1. La
                reserva es criterio de proyecto, no un valor normativo.
            </span>
        </div>
    );
}

/**
 * Cortocircuito en las barras del tablero (R3): I″k máxima (IEC 60909-0) y
 * poder de corte del interruptor general.
 */
export function ShortCircuitFields({
    node,
    result,
    withoutSource,
    onUpdateNode,
}: {
    node: ElectricalNode;
    result?: NodeShortCircuit;
    withoutSource: number;
    onUpdateNode: (id: string, patch: Partial<ElectricalNode>) => void;
}) {
    return (
        <div className="grid gap-1">
            <div className="mt-1 border-t border-slate-200 pt-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-300">
                Cortocircuito
            </div>
            {result && Number.isFinite(result.ikKa) ? (
                <Info
                    label={
                        result.kind === '3F'
                            ? 'I″k3 máx. en barras'
                            : 'I″k1 fase-neutro (aprox.)'
                    }
                    value={`${fmtNumber(result.ikKa, 2)} kA`}
                />
            ) : (
                <p className="text-[10px] text-slate-400">
                    {withoutSource > 0
                        ? 'Define la potencia del transformador (o publica la demanda) en el Suministro para calcularlo.'
                        : 'Sin cálculo (tablero sin alimentador).'}
                </p>
            )}
            <label className="text-[11px] text-slate-500">
                Poder de corte del interruptor Icu (kA)
                <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Sin definir"
                    className={inputClass}
                    value={node.breakingCapacityKa ?? ''}
                    onChange={(event) => {
                        const value = optionalNumber(event.target.value);
                        onUpdateNode(node.id, {
                            breakingCapacityKa:
                                value && value > 0 ? value : undefined,
                        });
                    }}
                />
            </label>
            {result?.breakingCapacityOk === false && (
                <p className="rounded bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    Icu {result.breakingCapacityKa} kA &lt; I″k{' '}
                    {fmtNumber(result.ikKa, 2)} kA: el interruptor no puede
                    despejar la falla máxima.
                </p>
            )}
            <span className="block text-[10px] leading-relaxed text-slate-400">
                IEC 60909-0 (c = 1,05; cables a 20 °C; transformador como
                reactancia pura: lado seguro). En tableros 1Φ, falla fase-neutro
                aproximada con neutro de igual sección.
            </span>
        </div>
    );
}

export function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-2 py-1 text-xs">
            <span className="text-slate-500">{label}</span>
            <strong className="text-right text-slate-900 dark:text-white">
                {value}
            </strong>
        </div>
    );
}
