import type { SiteOutputRow } from '../../site/domain/siteOutputs';
import type { EdgeCalculation } from '../domain/calculations';
import type { ElectricalNetworkData } from '../domain/types';

interface Props {
    rows: SiteOutputRow[];
    data: ElectricalNetworkData;
    calculations: EdgeCalculation[];
    onSelect: (id: string) => void;
}

type RowStatus = 'complete' | 'non_compliant' | 'incomplete';

const STATUS: Record<RowStatus, { label: string; className: string }> = {
    complete: {
        label: 'Dentro del límite',
        className:
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    non_compliant: {
        label: 'Fuera del límite',
        className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    },
    incomplete: {
        label: 'Incompleto',
        className:
            'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    },
};

const fmt = (value: number, digits = 2) =>
    Number.isFinite(value)
        ? value.toLocaleString('es-PE', {
              minimumFractionDigits: digits,
              maximumFractionDigits: digits,
          })
        : '—';

/** Estado y motivos con los MISMOS criterios del motor V1 (ΔU, capacidad, circuito mixto). */
function rowStatus(row: SiteOutputRow): { status: RowStatus; reasons: string[] } {
    if (row.installedPowerW <= 0 || row.lengthM <= 0) {
        return {
            status: 'incomplete',
            reasons: [row.installedPowerW <= 0 ? 'Sin carga' : 'Sin longitud'],
        };
    }
    const reasons: string[] = [];
    if (!row.voltageDropOk) {
        reasons.push(
            `ΔU ${fmt(row.voltageDropPct)} % ≥ ${fmt(row.maxVoltageDropPct, 1)} %`,
        );
    }
    if (!row.capacityConforms) {
        reasons.push(
            `I adm. ${fmt(row.admissibleCableCurrentA)} A ≤ I diseño ${fmt(row.theoreticalDesignCurrentA)} A`,
        );
    }
    if (row.normativeViolation) {
        reasons.push('Alumbrado y tomacorriente en la misma salida');
    }
    return {
        status: reasons.length > 0 ? 'non_compliant' : 'complete',
        reasons,
    };
}

const HEADERS = [
    'Circuito',
    'Recorrido',
    'Cargas',
    'P inst. (W)',
    'M.D. (kW)',
    'Sistema',
    'I (A)',
    'I diseño (A)',
    'I adm. (A)',
    'ITM',
    'Long. (m)',
    'Conductor',
    'ΔU % / lím.',
    'Estado',
];

/**
 * Salidas de los tableros dibujados en la Planta General, calculadas con el
 * motor CT por luminaria de la V1 (`calculatePanelCircuitSummaries`, vía
 * `site/domain/siteOutputs.ts`). Una sección por tablero con su alimentador
 * entrante. Solo lectura: sección, conductor y número de hilos se editan en
 * el cable, en la planta. Las filas son informativas por salida — el
 * veredicto del árbol sigue siendo por tablero.
 */
export function SiteOutputsCtTable({ rows, data, calculations, onSelect }: Props) {
    if (rows.length === 0) return null;
    const panelIds = [...new Set(rows.map((row) => row.panelElementId))];
    const calcByEdge = new Map(calculations.map((item) => [item.edgeId, item]));
    const problems = rows.filter(
        (row) => rowStatus(row).status !== 'complete',
    ).length;

    return (
        <details
            open
            className="max-h-[45vh] shrink-0 overflow-auto border-t-2 border-cyan-600 bg-white dark:bg-[#0d1017]"
        >
            <summary className="sticky top-0 z-10 cursor-pointer bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200">
                Salidas de la planta general — {rows.length} circuito(s) en{' '}
                {panelIds.length} tablero(s)
                {problems > 0 && (
                    <span className="ml-2 font-semibold text-amber-700 dark:text-amber-300">
                        · {problems} a revisar
                    </span>
                )}
            </summary>
            <p className="px-4 pt-2 text-[10px] text-slate-500 dark:text-slate-400">
                Cables de un TG o sub tablero de la planta hacia postes,
                tomacorrientes o portones con luces, calculados con el mismo
                motor CT por luminaria de los módulos (V1). Su carga ya suma al
                tablero en la red. Sección, conductor y número de hilos se
                editan en el cable (Emplazamiento 2D → propiedades del cable).
            </p>
            {panelIds.map((panelId) => {
                const panelRows = rows.filter(
                    (row) => row.panelElementId === panelId,
                );
                const node = data.nodes.find(
                    (item) =>
                        item.siteElementId === panelId &&
                        item.type !== 'service' &&
                        item.type !== 'meter',
                );
                const incoming = node
                    ? data.edges.find((edge) => edge.targetNodeId === node.id)
                    : undefined;
                const feeder = incoming
                    ? calcByEdge.get(incoming.id)
                    : undefined;
                const source = incoming
                    ? data.nodes.find(
                          (item) => item.id === incoming.sourceNodeId,
                      )
                    : undefined;
                const phaseTotals = panelRows.reduce(
                    (totals, row) => ({
                        r: totals.r + row.phaseCurrentR,
                        s: totals.s + row.phaseCurrentS,
                        t: totals.t + row.phaseCurrentT,
                    }),
                    { r: 0, s: 0, t: 0 },
                );
                return (
                    <div key={panelId} className="px-4 py-2">
                        <button
                            type="button"
                            disabled={!node}
                            onClick={() => node && onSelect(node.id)}
                            className="mb-1 text-left text-[11px] font-bold text-slate-800 hover:text-cyan-700 dark:text-slate-100"
                        >
                            {node?.label ?? panelRows[0].panelLabel}
                            <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                                {source
                                    ? `alimentado desde ${source.label}`
                                    : 'sin alimentador'}
                                {feeder &&
                                    ` · ΔU hasta el tablero ${fmt(feeder.accumulatedVoltageDropPercent)} %`}
                                {` · I diseño por fase R ${fmt(phaseTotals.r, 1)} / S ${fmt(phaseTotals.s, 1)} / T ${fmt(phaseTotals.t, 1)} A`}
                            </span>
                        </button>
                        <table className="w-full min-w-300 border-collapse text-left text-[10px] text-slate-700 dark:text-slate-200">
                            <thead className="bg-sky-700 text-[9px] font-semibold tracking-wide text-white uppercase dark:bg-sky-900">
                                <tr>
                                    {HEADERS.map((header) => (
                                        <th
                                            key={header}
                                            className="border border-sky-800 px-2 py-1"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {panelRows.map((row) => {
                                    const { status, reasons } = rowStatus(row);
                                    const style = STATUS[status];
                                    const notes = [...reasons, ...row.assumptions];
                                    const cell =
                                        'border border-slate-200 px-2 py-1 dark:border-white/10';
                                    return (
                                        <tr
                                            key={row.rootConductorId}
                                            className="odd:bg-slate-50 dark:odd:bg-white/5"
                                        >
                                            <td className={`${cell} font-semibold`}>
                                                {row.code}
                                                <span className="block font-normal text-slate-500">
                                                    {row.outputLabel}
                                                </span>
                                            </td>
                                            <td className={cell}>
                                                → {row.firstTargetLabel}
                                                {row.conductorCount > 1 &&
                                                    ` (+${row.conductorCount - 1} tramo(s))`}
                                            </td>
                                            <td className={cell}>
                                                {row.loadsDetail || '—'}
                                            </td>
                                            <td className={`${cell} text-right`}>
                                                {fmt(row.installedPowerW, 0)}
                                            </td>
                                            <td className={`${cell} text-right`}>
                                                {fmt(row.maximumDemandKw, 3)}
                                            </td>
                                            <td className={cell}>
                                                {row.phases === 3 ? '3Φ' : '1Φ'}{' '}
                                                {fmt(row.circuitVoltageV, 0)} V ·{' '}
                                                {row.phaseBalance}
                                            </td>
                                            <td className={`${cell} text-right`}>
                                                {fmt(row.currentA)}
                                            </td>
                                            <td className={`${cell} text-right`}>
                                                {fmt(row.theoreticalDesignCurrentA)}
                                            </td>
                                            <td className={`${cell} text-right`}>
                                                {fmt(row.admissibleCableCurrentA)}
                                            </td>
                                            <td className={cell}>{row.itm}</td>
                                            <td className={`${cell} text-right`}>
                                                {fmt(row.lengthM)}
                                            </td>
                                            <td className={cell}>
                                                {row.sectionMm2} mm² {row.conductorType}
                                                {row.assumptions.some((note) =>
                                                    note.startsWith('Sección'),
                                                ) && ' *'}
                                            </td>
                                            <td className={`${cell} text-right font-semibold`}>
                                                {fmt(row.voltageDropPct)} /{' '}
                                                {fmt(row.maxVoltageDropPct, 1)}
                                            </td>
                                            <td
                                                className={cell}
                                                title={notes.join('\n')}
                                            >
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${style.className}`}
                                                >
                                                    {style.label}
                                                </span>
                                                {notes.length > 0 && (
                                                    <span className="ml-1 text-slate-400">
                                                        ⓘ
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            })}
            <p className="px-4 pb-2 text-[10px] text-slate-400">
                * Sección supuesta (2.5 mm²) — defínela en el cable. 2–3
                conductores = monofásico (fases R/S/T repartidas entre
                salidas); 4 o más = trifásico. Pasa el cursor por el estado para
                ver motivos y supuestos.
            </p>
        </details>
    );
}
