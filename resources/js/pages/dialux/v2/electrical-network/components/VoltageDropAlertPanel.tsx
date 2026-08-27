import { AlertCircle, AlertOctagon, CheckCircle2, Clock } from 'lucide-react';
import type { EdgeCalculation } from '../domain/calculations';
import type { ElectricalNetworkData } from '../domain/types';

interface Props {
    data: ElectricalNetworkData;
    calculations: EdgeCalculation[];
    selectedId?: string;
    onSelect: (id: string) => void;
}

function edgeLabel(data: ElectricalNetworkData, edgeId: string): string {
    const edge = data.edges.find((item) => item.id === edgeId);
    return edge?.label ?? 'Alimentador';
}

function incompleteReason(calculation: EdgeCalculation): string {
    if (calculation.lengthM <= 0) return 'longitud pendiente';
    if (calculation.demandPowerW <= 0) return 'sin demanda publicada';
    return 'datos incompletos';
}

/**
 * No siempre es la caída de tensión: `warnings` puede venir de sección
 * inexistente en el catálogo, ampacidad insuficiente, etc. Mostrar siempre
 * "ΔU X% > límite%" aquí era engañoso cuando la causa real era otra (ej.
 * "la sección 300 mm² no existe para N2XOH").
 */
function criticalReason(item: EdgeCalculation): string {
    if (item.warnings.length > 0) return item.warnings.join(' · ');
    return `ΔU ${item.accumulatedVoltageDropPercent.toFixed(2)}% supera el límite`;
}

export function VoltageDropAlertPanel({
    data,
    calculations,
    selectedId,
    onSelect,
}: Props) {
    const critical = calculations.filter(
        (item) => item.status === 'non_compliant',
    );
    const warning = calculations.filter((item) => item.status === 'warning');
    const incomplete = calculations.filter(
        (item) => item.status === 'incomplete',
    );
    const compliant = calculations.filter(
        (item) => item.status === 'complete',
    );
    const alertCount = critical.length + warning.length + incomplete.length;

    if (calculations.length === 0) return null;

    return (
        <details
            className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#101218]"
            open={alertCount > 0}
        >
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Alertas de caída de tensión
                {alertCount > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                        ⚠ {alertCount} alertas
                    </span>
                )}
            </summary>
            <div className="max-h-56 overflow-y-auto px-4 pb-3 text-xs">
                {critical.length > 0 && (
                    <div className="mb-2">
                        <div className="mb-1 flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                            <AlertOctagon className="h-3.5 w-3.5" />
                            Críticos
                        </div>
                        {critical.map((item) => (
                            <button
                                key={item.edgeId}
                                type="button"
                                onClick={() => onSelect(item.edgeId)}
                                className={`block w-full rounded px-2 py-1 text-left text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30 ${selectedId === item.edgeId ? 'bg-red-50 dark:bg-red-950/30' : ''}`}
                            >
                                {`${edgeLabel(data, item.edgeId)}: ${criticalReason(item)}`}
                            </button>
                        ))}
                    </div>
                )}
                {warning.length > 0 && (
                    <div className="mb-2">
                        <div className="mb-1 flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Advertencias
                        </div>
                        {warning.map((item) => (
                            <button
                                key={item.edgeId}
                                type="button"
                                onClick={() => onSelect(item.edgeId)}
                                className={`block w-full rounded px-2 py-1 text-left text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30 ${selectedId === item.edgeId ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}
                            >
                                {`${edgeLabel(data, item.edgeId)}: ΔU ${item.ownVoltageDropPercent.toFixed(2)}%`}
                            </button>
                        ))}
                    </div>
                )}
                {incomplete.length > 0 && (
                    <div className="mb-2">
                        <div className="mb-1 flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            Incompletos
                        </div>
                        {incomplete.map((item) => (
                            <button
                                key={item.edgeId}
                                type="button"
                                onClick={() => onSelect(item.edgeId)}
                                className={`block w-full rounded px-2 py-1 text-left text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 ${selectedId === item.edgeId ? 'bg-slate-100 dark:bg-white/5' : ''}`}
                            >
                                {`${edgeLabel(data, item.edgeId)}: ${incompleteReason(item)}`}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex items-center gap-1 pt-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {`Conformes: ${compliant.length} de ${calculations.length}`}
                </div>
            </div>
        </details>
    );
}
