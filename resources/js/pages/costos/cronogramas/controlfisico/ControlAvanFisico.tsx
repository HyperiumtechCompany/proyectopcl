import { Head } from '@inertiajs/react';
import React from 'react';
import AppLayout from '@/layouts/app-layout';
import CronogramaNavTabs, { type CronogramaEstado } from '../components/CronogramaNavTabs';

interface ControlAvanFisicoProps {
    project:                string;
    projectName:            string;
    modoCalculo:            'calendario' | '30dias';
    montoContrato:          number;
    ejecutadoAcumulado:     number;
    pctEjecutadoAcumulado:  number;
    saldoMonto:             number;
    saldoPct:               number;
    sinMontoContrato:       boolean;
    sinProgramado:          boolean;
    sinEjecutado:           boolean;
    estado?:                CronogramaEstado;
}

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

export default function ControlAvanFisico(props: ControlAvanFisicoProps) {
    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: 'Control de Avance Físico', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Control de Avance Físico — ${props.projectName}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-900">
                <CronogramaNavTabs project={props.project} modoCalculo={props.modoCalculo} active="controlFisico" estado={props.estado} />
                <div className="max-w-[1200px] mx-auto">

                    <div className="mb-4 flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                        <div>
                            <h1 className="text-sm font-black text-slate-700 uppercase tracking-wide">Control de Avance Físico de Obra</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Saldo por ejecutar sobre el Monto del Contrato Original — modo {props.modoCalculo === 'calendario' ? 'calendario' : '30 días'}.
                            </p>
                        </div>
                        <a
                            href={`/module/curva_s?project=${props.project}&modo=${props.modoCalculo}`}
                            className="px-3 py-1.5 text-xs font-black rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all"
                        >
                            Ver Curva S →
                        </a>
                    </div>

                    {(props.sinMontoContrato || props.sinProgramado || props.sinEjecutado) && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
                            {props.sinMontoContrato && <div>⚠ Aún no se guardó el <strong>Monto del Contrato</strong> — vuelve a Valorizado y presiona "Guardar" para calcularlo.</div>}
                            {props.sinProgramado && <div>⚠ Aún no se guardó el <strong>Valorizado programado</strong>.</div>}
                            {props.sinEjecutado && <div>⚠ Aún no se guardó ningún <strong>Avance Real</strong>.</div>}
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Monto del Contrato</div>
                            <div className="text-xl font-black text-slate-700 mt-1">S/. {fmt(props.montoContrato)}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ejecutado Acumulado</div>
                            <div className="text-xl font-black text-emerald-700 mt-1">S/. {fmt(props.ejecutadoAcumulado)}</div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">{fmtPct(props.pctEjecutadoAcumulado)}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Saldo por Ejecutar</div>
                            <div className="text-xl font-black text-amber-700 mt-1">S/. {fmt(props.saldoMonto)}</div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">{fmtPct(props.saldoPct)}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm flex flex-col justify-center">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Avance Físico</div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, Math.max(0, props.pctEjecutadoAcumulado))}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
