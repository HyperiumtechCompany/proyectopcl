import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import MoNumberCell from '../mo/MoNumberCell';
import { money } from '../shared/format';
import { resumenApi } from './resumenApi';
import type { Armada, MontoInvertirRow, ResumenParametros, ResumenPayload, ResumenResponse } from './types';

interface Props {
    projectId: number;
    documentId: string;
    initial: ResumenPayload;
    onRevision: (revision: number) => void;
}

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

const ARMADA_LABEL: Record<Armada, string> = { armada_1: '1ER', armada_2: '2DO', liquidacion: 'LIQUIDACIÓN' };
const ARMADAS: Armada[] = ['armada_1', 'armada_2', 'liquidacion'];

const EXPEDIENTE_KEY: Partial<Record<string, keyof ResumenParametros['expediente']>> = { equipos: 'equipos', utilidad: 'utilidad', igv: 'igv', descuento: 'descuento' };
const IDEAL_KEY: Partial<Record<string, keyof ResumenParametros['aprobado_ideal']>> = {
    materiales: 'materiales', mano_obra: 'mano_obra', equipos: 'equipos', gastos_generales: 'gastos_generales', utilidad: 'utilidad', igv: 'igv', descuento: 'descuento',
};
const BOLD_GENERAL = new Set(['costo_directo', 'total', 'total_adjudicado']);
const MONTO_INVERTIR_KEYS = new Set(['materiales', 'mano_obra', 'equipos', 'gastos_generales', 'descuento']);

function pct(value: string | null): string {
    return value === null ? '—' : `${value}%`;
}

export default function ResumenSheet({ projectId, documentId, initial, onRevision }: Props) {
    const [payload, setPayload] = useState<ResumenPayload>(initial);
    const [busy, setBusy] = useState(false);

    const apply = (res: ResumenResponse) => {
        setPayload(res.resumen);
        onRevision(res.revision);
    };

    const run = async (task: () => Promise<ResumenResponse>) => {
        setBusy(true);
        try {
            apply(await task());
        } catch (error) {
            const data = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
            window.alert(data?.message ?? Object.values(data?.errors ?? {})[0]?.[0] ?? 'No se pudo guardar el cambio.');
        } finally {
            setBusy(false);
        }
    };

    const patch = (partial: DeepPartial<ResumenParametros>) => void run(() => resumenApi.updateParametros(projectId, documentId, partial));

    const moneyCell = (value: string, editable: boolean, onCommit: (v: string) => void, bold = false) =>
        editable ? (
            <MoNumberCell value={value} editable onCommit={(v) => onCommit(v ?? '0')} />
        ) : (
            <span className={`block px-2 py-1 text-right tabular-nums ${bold ? 'font-semibold' : ''}`}>{money(value)}</span>
        );

    const montoInvertirRow = (row: MontoInvertirRow, editable: boolean, onCommitArmada: (armada: Armada, value: string) => void) => (
        <tr key={row.componente} className={`[&>td]:border-b [&>td]:border-slate-100 dark:[&>td]:border-slate-800 ${MONTO_INVERTIR_KEYS.has(row.componente) || row.componente.startsWith('socio') ? '' : 'bg-slate-100 font-semibold dark:bg-slate-800'}`}>
            <td className="px-2 py-1">{row.label}</td>
            {ARMADAS.map((armada) => (
                <td key={armada} className="p-0">
                    {editable ? <MoNumberCell value={row.armadas[armada]} editable onCommit={(v) => onCommitArmada(armada, v ?? '0')} /> : <span className="block px-2 py-1 text-right tabular-nums">{money(row.armadas[armada])}</span>}
                </td>
            ))}
            <td className="px-2 py-1 text-right font-semibold tabular-nums">{money(row.sub_total)}</td>
        </tr>
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-3 text-xs">
            {busy && <Loader2 size={14} className="animate-spin self-end text-blue-500" />}

            <div className="grid gap-4 2xl:grid-cols-2">
                {/* RESUMEN GENERAL */}
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-center font-semibold dark:border-slate-800 dark:bg-slate-800">RESUMEN GENERAL</div>
                    <table className="w-full border-separate border-spacing-0">
                        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                            <tr className="[&>th]:border-b [&>th]:border-slate-200 [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-right [&>th]:font-medium dark:[&>th]:border-slate-700">
                                <th className="text-left">Componente</th>
                                <th>Presupuesto Expediente</th>
                                <th>Presupuesto Aprobado Ideal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payload.general.rows.map((row) => {
                                const bold = BOLD_GENERAL.has(row.componente);
                                return (
                                    <tr key={row.componente} className={`[&>td]:border-b [&>td]:border-slate-100 dark:[&>td]:border-slate-800 ${bold ? 'bg-slate-50 font-semibold dark:bg-slate-900/60' : ''}`}>
                                        <td className="px-2 py-1">{row.label}</td>
                                        <td className="p-0">
                                            {moneyCell(row.expediente, row.editable.expediente, (v) => {
                                                const key = EXPEDIENTE_KEY[row.componente];
                                                if (key) patch({ expediente: { [key]: v } });
                                            }, bold)}
                                        </td>
                                        <td className="p-0">
                                            {moneyCell(row.aprobado_ideal, row.editable.aprobado_ideal, (v) => {
                                                const key = IDEAL_KEY[row.componente];
                                                if (key) patch({ aprobado_ideal: { [key]: v } });
                                            }, bold)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* RESUMEN DESAGREGADO */}
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-center font-semibold dark:border-slate-800 dark:bg-slate-800">RESUMEN DESAGREGADO</div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-separate border-spacing-0 whitespace-nowrap">
                            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                <tr className="[&>th]:border-b [&>th]:border-slate-200 [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-right [&>th]:font-medium dark:[&>th]:border-slate-700">
                                    <th className="text-left">Componente</th>
                                    <th>Aprob. Ideal</th>
                                    <th>Proy. Real</th>
                                    <th>Actual</th>
                                    <th>Deuda</th>
                                    <th>Déficit</th>
                                    <th>% Gasto</th>
                                    <th>% Avance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payload.desagregado.rows.map((row, index) => {
                                    if (row.tipo === 'blank') return <tr key={`blank-${index}`}><td className="h-2" colSpan={8} /></tr>;
                                    if (row.tipo === 'sub') return (
                                        <tr key={`sub-${index}`}><td className="px-2 pt-2 pb-1 font-semibold" colSpan={8}>{row.label}</td></tr>
                                    );
                                    const bold = row.tipo === 'rollup';
                                    return (
                                        <tr key={`row-${index}`} className={`[&>td]:border-b [&>td]:border-slate-100 dark:[&>td]:border-slate-800 ${bold ? 'bg-slate-50 font-semibold dark:bg-slate-900/60' : ''}`}>
                                            <td className="px-2 py-1" style={{ paddingLeft: bold ? '8px' : '20px' }}>{row.label}</td>
                                            <td className="px-2 py-1 text-right tabular-nums">{money(row.aprobado_ideal)}</td>
                                            <td className="px-2 py-1 text-right tabular-nums">{money(row.proyectado_real)}</td>
                                            <td className="px-2 py-1 text-right tabular-nums">{money(row.actual)}</td>
                                            <td className="px-2 py-1 text-right tabular-nums">{money(row.deuda)}</td>
                                            <td className={`px-2 py-1 text-right tabular-nums ${row.deficit.startsWith('-') ? 'text-amber-700 dark:text-amber-300' : ''}`}>{money(row.deficit)}</td>
                                            <td className="px-2 py-1 text-right tabular-nums">{pct(row.pct_gasto_actual)}</td>
                                            <td className="p-0">
                                                {row.avance_key ? (
                                                    <MoNumberCell value={row.pct_avance ?? '0'} editable onCommit={(v) => patch({ avance_obra_pct: { [row.avance_key as string]: v ?? '0' } })} />
                                                ) : (
                                                    <span className="block px-2 py-1 text-right tabular-nums">{pct(row.pct_avance)}</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
                {/* MONTO A INVERTIR */}
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="border-b border-slate-200 bg-rose-100 px-3 py-1.5 text-center font-semibold text-rose-900 dark:border-slate-800 dark:bg-rose-950/40 dark:text-rose-200">MONTO A INVERTIR</div>
                    <table className="w-full border-separate border-spacing-0">
                        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                            <tr className="[&>th]:border-b [&>th]:border-slate-200 [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-right [&>th]:font-medium dark:[&>th]:border-slate-700">
                                <th className="text-left">Componente</th>
                                {ARMADAS.map((a) => <th key={a}>{ARMADA_LABEL[a]}</th>)}
                                <th>Sub Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payload.monto_invertir.componentes.map((row) =>
                                montoInvertirRow(row, MONTO_INVERTIR_KEYS.has(row.componente), (armada, value) => patch({ monto_invertir: { [row.componente]: { [armada]: value } } })),
                            )}
                            {payload.monto_invertir.socios.map((row) =>
                                montoInvertirRow(row, row.componente === 'socio1' || row.componente === 'socio2', (armada, value) => {
                                    if (row.componente === 'socio1') patch({ aportes_socios: { socio1: { [armada]: value } } });
                                    else if (row.componente === 'socio2') patch({ aportes_socios: { socio2: { [armada]: value } } });
                                }),
                            )}
                        </tbody>
                    </table>
                </div>

                {/* GASTO REAL */}
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-center font-semibold dark:border-slate-800 dark:bg-slate-800">GASTO REAL</div>
                    <table className="w-full border-separate border-spacing-0">
                        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                            <tr className="[&>th]:border-b [&>th]:border-slate-200 [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-right [&>th]:font-medium dark:[&>th]:border-slate-700">
                                <th className="text-left">Concepto</th>
                                <th>Ejecutado</th>
                                <th>Por Pagar</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payload.gasto_real.lineas.map((linea) => {
                                const editable = linea.label === 'APOYO TÉC.';
                                const bold = linea.label.startsWith('SUB TOTAL') || linea.label === 'TOTAL';
                                return (
                                    <tr key={linea.label} className={`[&>td]:border-b [&>td]:border-slate-100 dark:[&>td]:border-slate-800 ${bold ? 'bg-slate-50 font-semibold dark:bg-slate-900/60' : ''}`}>
                                        <td className="px-2 py-1">{linea.label}</td>
                                        <td className="p-0">{moneyCell(linea.ejecutado, editable, (v) => patch({ apoyo_tecnico: { ejecutado: v } }))}</td>
                                        <td className="p-0">{moneyCell(linea.por_pagar, editable, (v) => patch({ apoyo_tecnico: { por_pagar: v } }))}</td>
                                        <td className="px-2 py-1 text-right font-semibold tabular-nums">{money(linea.total)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 px-3 py-2 dark:border-slate-800">
                        <span><b>GASTO TOTAL</b> {money(payload.gasto_real.gasto_total)}</span>
                        <span><b>TOTAL ADJUDICADO</b> {money(payload.gasto_real.total_adjudicado)}</span>
                        <span className="rounded bg-yellow-100 px-1.5 py-0.5 font-semibold text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200">
                            UTILIDAD {money(payload.gasto_real.utilidad)}
                        </span>
                        <span>{pct(payload.gasto_real.pct_ejecucion)} ejecutado</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
