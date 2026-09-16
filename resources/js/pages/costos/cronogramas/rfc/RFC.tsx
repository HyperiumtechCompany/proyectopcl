import { Head } from '@inertiajs/react';
import React from 'react';
import AppLayout from '@/layouts/app-layout';
import CronogramaNavTabs, { type CronogramaEstado } from '../components/CronogramaNavTabs';

interface FilaRFC {
    periodo:                    string;
    periodoCal:                 string;
    montoValorizado:            number;
    retencionMensualProgramada: number | null;
    retencionEfectiva:          number;
    retencionAcumulada:         number;
}

interface RFCProps {
    project:               string;
    projectName:           string;
    modoCalculo:           'calendario' | '30dias';
    montoContrato:         number;
    retencionTotal:        number;
    filas:                 FilaRFC[];
    retencionAcumuladaFinal: number;
    saldoPorRetener:       number;
    sinMontoContrato:      boolean;
    sinProgramado:         boolean;
    sinEjecutado:          boolean;
    estado?:               CronogramaEstado;
}

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RFC(props: RFCProps) {
    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: 'R.F.C.', href: '#' },
    ];

    const faltaDatos = props.sinMontoContrato || props.sinProgramado || props.sinEjecutado;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`R.F.C. — ${props.projectName}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-900">
                <CronogramaNavTabs project={props.project} modoCalculo={props.modoCalculo} active="rfc" estado={props.estado} />
                <div className="max-w-[1100px] mx-auto">

                    <div className="mb-4 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                        <h1 className="text-sm font-black text-slate-700 uppercase tracking-wide">Retención de Garantía de Fiel Cumplimiento</h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            10% del Monto del Contrato Original, retenido de forma prorrateada con cargo a las primeras valorizaciones (Art. 114, Ley N°32069).
                        </p>
                    </div>

                    {faltaDatos && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
                            {props.sinMontoContrato && <div>⚠ Aún no se guardó el <strong>Monto del Contrato</strong> — vuelve a Valorizado y presiona "Guardar".</div>}
                            {props.sinProgramado && <div>⚠ Aún no se guardó el <strong>Valorizado programado</strong>.</div>}
                            {props.sinEjecutado && <div>⚠ Aún no se guardó ningún <strong>Avance Real</strong>.</div>}
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Monto del Contrato</div>
                            <div className="text-xl font-black text-slate-700 mt-1">S/. {fmt(props.montoContrato)}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total de Retención (10%)</div>
                            <div className="text-xl font-black text-indigo-700 mt-1">S/. {fmt(props.retencionTotal)}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Saldo por Retener</div>
                            <div className={`text-xl font-black mt-1 ${props.saldoPorRetener > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                S/. {fmt(props.saldoPorRetener)}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                        <table className="min-w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-600 font-black uppercase tracking-wide">
                                    <th className="px-3 py-2 text-left">N°</th>
                                    <th className="px-3 py-2 text-left">Periodo</th>
                                    <th className="px-2 py-2 text-right">Monto Valorizado</th>
                                    <th className="px-2 py-2 text-right">Retención Mensual Programada</th>
                                    <th className="px-2 py-2 text-right">Retención Efectiva</th>
                                    <th className="px-2 py-2 text-right">Retención Acumulada</th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.filas.map((f, i) => (
                                    <tr key={f.periodo} className="border-t border-slate-100 hover:bg-slate-50">
                                        <td className="px-3 py-1.5 text-slate-500">{String(i + 1).padStart(2, '0')}</td>
                                        <td className="px-3 py-1.5 font-semibold text-slate-700">{f.periodoCal}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{f.montoValorizado > 0 ? fmt(f.montoValorizado) : '-'}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-slate-500">{f.retencionMensualProgramada != null ? `S/ ${fmt(f.retencionMensualProgramada)}` : '-'}</td>
                                        <td className="px-2 py-1.5 text-right font-mono font-bold text-indigo-700">{f.retencionEfectiva > 0 ? fmt(f.retencionEfectiva) : '-'}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{f.retencionAcumulada > 0 ? fmt(f.retencionAcumulada) : '-'}</td>
                                    </tr>
                                ))}
                                {props.filas.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-8 text-center text-slate-400">No hay periodos que mostrar.</td>
                                    </tr>
                                )}
                            </tbody>
                            {props.filas.length > 0 && (
                                <tfoot>
                                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-black text-slate-700">
                                        <td colSpan={2} className="px-3 py-2">RETENCIÓN ANTERIOR ACUMULADA</td>
                                        <td colSpan={2} />
                                        <td className="px-2 py-2 text-right font-mono">{fmt(props.retencionAcumuladaFinal)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                        <span className="text-xs font-bold text-amber-800 uppercase tracking-wide mr-2">Total a Retenerse por Garantía de Fiel Cumplimiento:</span>
                        <span className="text-lg font-black text-amber-900">S/ {fmt(props.saldoPorRetener)}</span>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
