import { Head } from '@inertiajs/react';
import React from 'react';
import AppLayout from '@/layouts/app-layout';
import CronogramaNavTabs, { type CronogramaEstado } from '../components/CronogramaNavTabs';

interface FilaControl {
    periodo:                 string;
    periodoCal:               string;
    key:                      string;
    programadoMensual:        number;
    programadoAcumulado:      number;
    pctProgramadoMensual:     number;
    pctProgramadoAcumulado:   number;
    ejecutadoMensual:         number;
    ejecutadoAcumulado:       number;
    pctEjecutadoMensual:      number;
    pctEjecutadoAcumulado:    number;
    desviacion:               number;
    estado:                   'ATRASADA' | 'CULMINADA' | 'ADELANTADA';
    metaMinima80:             number;
    bajoMeta80:               boolean;
}

interface ControlAvanceObraProps {
    project:          string;
    projectName:      string;
    modoCalculo:      'calendario' | '30dias';
    filas:            FilaControl[];
    totalPresupuesto: number;
    sinProgramado:    boolean;
    sinEjecutado:     boolean;
    estado?:          CronogramaEstado;
}

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

const estadoBadge: Record<FilaControl['estado'], string> = {
    ATRASADA: 'bg-rose-100 text-rose-700 border-rose-200',
    CULMINADA: 'bg-blue-100 text-blue-700 border-blue-200',
    ADELANTADA: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function ControlAvanceObra(props: ControlAvanceObraProps) {
    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: 'Control General de Avance de Obra', href: '#' },
    ];

    const faltaDatos = props.sinProgramado || props.sinEjecutado;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Control Avance de Obra — ${props.projectName}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-900">
                <CronogramaNavTabs project={props.project} modoCalculo={props.modoCalculo} active="control" estado={props.estado} />
                <div className="max-w-[1400px] mx-auto">

                    <div className="mb-4 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                        <h1 className="text-sm font-black text-slate-700 uppercase tracking-wide">
                            Control General de Avance de Obra
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Programado (Valorizado guardado) vs. Ejecutado (Avance Real guardado) — modo {props.modoCalculo === 'calendario' ? 'calendario' : '30 días'}.
                        </p>
                    </div>

                    {faltaDatos && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                            {props.sinProgramado && <div>⚠ Aún no se guardó el <strong>Valorizado programado</strong> — la columna Programado saldrá en cero hasta que lo guardes.</div>}
                            {props.sinEjecutado && <div>⚠ Aún no se guardó ningún <strong>Avance Real</strong> — la columna Ejecutado saldrá en cero hasta que captures avance.</div>}
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                        <table className="min-w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-600 font-black uppercase tracking-wide">
                                    <th rowSpan={2} className="px-3 py-2 text-left align-bottom">Periodo</th>
                                    <th colSpan={4} className="px-2 py-1 text-center border-l border-slate-200">Programado</th>
                                    <th colSpan={4} className="px-2 py-1 text-center border-l border-slate-200">Ejecutado</th>
                                    <th rowSpan={2} className="px-2 py-2 text-center align-bottom border-l border-slate-200">Desviación</th>
                                    <th rowSpan={2} className="px-2 py-2 text-center align-bottom">Meta Mín. 80%</th>
                                    <th rowSpan={2} className="px-2 py-2 text-center align-bottom">Situación</th>
                                </tr>
                                <tr className="bg-slate-50 text-slate-500 font-bold">
                                    <th className="px-2 py-1 text-right border-l border-slate-200">Mensual</th>
                                    <th className="px-2 py-1 text-right">Acumulado</th>
                                    <th className="px-2 py-1 text-right">% Mens.</th>
                                    <th className="px-2 py-1 text-right">% Acum.</th>
                                    <th className="px-2 py-1 text-right border-l border-slate-200">Mensual</th>
                                    <th className="px-2 py-1 text-right">Acumulado</th>
                                    <th className="px-2 py-1 text-right">% Mens.</th>
                                    <th className="px-2 py-1 text-right">% Acum.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.filas.map(f => (
                                    <tr key={f.key} className="border-t border-slate-100 hover:bg-slate-50">
                                        <td className="px-3 py-1.5 font-semibold text-slate-700">
                                            {f.periodo}
                                            <div className="text-[10px] font-normal text-slate-400">{f.periodoCal}</div>
                                        </td>
                                        <td className="px-2 py-1.5 text-right font-mono border-l border-slate-100">{fmt(f.programadoMensual)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{fmt(f.programadoAcumulado)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-slate-500">{fmtPct(f.pctProgramadoMensual)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-700">{fmtPct(f.pctProgramadoAcumulado)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono border-l border-slate-100">{fmt(f.ejecutadoMensual)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{fmt(f.ejecutadoAcumulado)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-slate-500">{fmtPct(f.pctEjecutadoMensual)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono font-bold text-emerald-700">{fmtPct(f.pctEjecutadoAcumulado)}</td>
                                        <td className={`px-2 py-1.5 text-right font-mono font-bold border-l border-slate-100 ${f.desviacion < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            {f.desviacion >= 0 ? '+' : ''}{fmtPct(f.desviacion)}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {f.bajoMeta80 ? (
                                                <span className="px-2 py-0.5 rounded-md border text-[10px] font-black bg-red-100 text-red-800 border-red-300" title={`Meta mínima: ${fmtPct(f.metaMinima80)}`}>
                                                    ⚠ BAJO {fmtPct(f.metaMinima80)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-[10px]">{fmtPct(f.metaMinima80)}</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${estadoBadge[f.estado]}`}>
                                                {f.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {props.filas.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="px-3 py-8 text-center text-slate-400">
                                            No hay periodos que mostrar.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
