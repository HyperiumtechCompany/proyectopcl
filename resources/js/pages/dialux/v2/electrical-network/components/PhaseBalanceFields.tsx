import type { EdgeCalculation } from '../domain/calculations';
import type { NodePhaseBalance, Phase } from '../domain/phaseBalance';
import {
    PHASES,
    PROJECT_UNBALANCE_LIMIT_PERCENT,
    proposedPhasePatches,
} from '../domain/phaseBalance';
import type { ElectricalNode } from '../domain/types';
import { fmtNumber, Info, inputClass } from './ElectricalSizingFields';

const PHASE_COLOR: Record<Phase, string> = {
    R: 'bg-red-500',
    S: 'bg-amber-500',
    T: 'bg-sky-500',
};

/**
 * Balance de fases de un tablero trifásico (R4 de
 * `plan_red_ct_dimensionamiento_multimodulo.md`): corriente por fase,
 * desbalance y la fase de cada tablero 1Φ que cuelga de él. La propuesta solo
 * toca los que no tienen fase fijada.
 */
export function PhaseBalanceFields({
    balance,
    incomingResult,
    designFactor,
    onUpdateNode,
}: {
    balance: NodePhaseBalance;
    incomingResult?: EdgeCalculation;
    designFactor: number;
    onUpdateNode: (id: string, patch: Partial<ElectricalNode>) => void;
}) {
    const patches = proposedPhasePatches(balance);
    const scale = Math.max(balance.maxPhaseA, 1e-9);
    const overLimit = balance.unbalancePercent > PROJECT_UNBALANCE_LIMIT_PERCENT;
    const maxPhaseDesignA = balance.maxPhaseA * designFactor;
    const ampacityShort =
        incomingResult?.ampacityA !== undefined &&
        incomingResult.ampacityA < maxPhaseDesignA;
    if (balance.maxPhaseA <= 0 && balance.singlePhaseChildren.length === 0) {
        return null;
    }
    return (
        <div className="grid gap-1">
            <div className="mt-1 border-t border-slate-200 pt-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-300">
                Balance de fases
            </div>
            {PHASES.map((phase) => (
                <div key={phase} className="flex items-center gap-2 text-[11px]">
                    <span className="w-3 font-bold text-slate-600 dark:text-slate-300">
                        {phase}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-white/10">
                        <div
                            className={`h-full ${PHASE_COLOR[phase]}`}
                            style={{
                                width: `${(balance.currents[phase] / scale) * 100}%`,
                            }}
                        />
                    </div>
                    <span className="w-16 text-right tabular-nums">
                        {fmtNumber(balance.currents[phase], 1)} A
                    </span>
                </div>
            ))}
            <Info
                label={balance.usesProposal ? 'Desbalance (con propuesta)' : 'Desbalance'}
                value={`${fmtNumber(balance.unbalancePercent, 1)} %`}
            />
            {overLimit && (
                <p className="rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    Supera el {PROJECT_UNBALANCE_LIMIT_PERCENT} % (criterio de
                    proyecto usual, no normativo): redistribuye los tableros 1Φ.
                </p>
            )}
            {ampacityShort && (
                <p className="rounded bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    La fase más cargada ({fmtNumber(maxPhaseDesignA, 1)} A de
                    diseño) supera la ampacidad del alimentador (
                    {incomingResult?.ampacityA} A): la corriente promedio no
                    muestra este exceso.
                </p>
            )}
            {balance.singlePhaseChildren.length > 0 && (
                <div className="grid gap-1">
                    <p className="text-[10px] text-slate-500">
                        Tableros 1Φ conectados ({balance.singlePhaseChildren.length})
                    </p>
                    {balance.singlePhaseChildren.map((child) => (
                        <label
                            key={child.nodeId}
                            className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300"
                        >
                            <span className="min-w-0 flex-1 truncate" title={child.label}>
                                {child.label}
                            </span>
                            <span className="tabular-nums text-slate-400">
                                {fmtNumber(child.currentA, 1)} A
                            </span>
                            <select
                                className={`${inputClass} !mt-0 !h-6 !w-24 !px-1 !text-[10px]`}
                                value={child.fixedPhase ?? ''}
                                onChange={(event) =>
                                    onUpdateNode(child.nodeId, {
                                        phase:
                                            event.target.value === ''
                                                ? undefined
                                                : (event.target.value as Phase),
                                    })
                                }
                            >
                                <option value="">Auto ({child.phase})</option>
                                {PHASES.map((phase) => (
                                    <option key={phase} value={phase}>
                                        {phase}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ))}
                    {patches.length > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                patches.forEach((patch) =>
                                    onUpdateNode(patch.nodeId, { phase: patch.phase }),
                                )
                            }
                            className="rounded-md border border-cyan-300 px-2 py-1 text-left text-[10px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-500/40 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
                        >
                            Fijar propuesta ({patches.length} tablero
                            {patches.length === 1 ? '' : 's'})
                        </button>
                    )}
                </div>
            )}
            <span className="block text-[10px] leading-relaxed text-slate-400">
                Corrientes por fase de lo que cuelga del tablero (carga propia
                repartida por igual; salidas de la planta en la fase de su fila
                CT). "Auto" = propuesta por el balance (mayor corriente a la
                fase menos cargada); una fase elegida a mano no se cambia.
            </span>
        </div>
    );
}
