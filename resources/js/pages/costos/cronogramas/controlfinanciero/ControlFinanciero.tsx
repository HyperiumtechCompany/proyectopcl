import { Head } from '@inertiajs/react';
import axios from 'axios';
import {
    Chart as ChartJS,
    ArcElement,
    PieController,
    Tooltip,
    Legend,
    type TooltipItem,
} from 'chart.js';
import React, { useCallback, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import AppLayout from '@/layouts/app-layout';
import CronogramaNavTabs, { type CronogramaEstado } from '../components/CronogramaNavTabs';

ChartJS.register(ArcElement, PieController, Tooltip, Legend);

interface FilaValorizacion {
    numero:          number;
    periodo:         string;
    periodoCal:      string;
    key:             string;
    montoFacturable: number;
    devengado:       boolean;
    montoDevengado:  number;
    pctDevengado:    number;
    montoPendiente:  number;
}

interface PieSlice { label: string; monto: number; pct: number }

interface ControlFinancieroProps {
    project:              string;
    projectName:          string;
    modoCalculo:          'calendario' | '30dias';
    montoContrato:        number;
    sinMontoContrato:     boolean;
    adelantoDirecto:      number;
    adelantoMateriales:   number;
    filasValorizaciones:  FilaValorizacion[];
    totalFacturable:      number;
    totalDevengado:       number;
    pctTotalDevengado:    number;
    totalPendiente:       number;
    saldoFacturable:      number;
    saldoDevengado:       number;
    pctSaldoDevengado:    number;
    saldoPendiente:       number;
    pie:                  PieSlice[];
    estado?:              CronogramaEstado;
}

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

const PIE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#4a3aa7', '#e87ba4', '#eda100'];
const COLOR_SALDO = '#94a3b8';

export default function ControlFinanciero(props: ControlFinancieroProps) {
    const [filas, setFilas] = useState(props.filasValorizaciones);
    const [saving, setSaving] = useState<string | null>(null);

    const toggleDevengado = useCallback(async (periodoKey: string, nuevoValor: boolean) => {
        setSaving(periodoKey);
        setFilas(prev => prev.map(f => f.key === periodoKey ? { ...f, devengado: nuevoValor } : f));
        try {
            await axios.post('/module/control_financiero/toggle-devengado', {
                project_id: props.project,
                periodo_key: periodoKey,
                devengado: nuevoValor,
            });
            window.location.reload();
        } catch {
            setFilas(prev => prev.map(f => f.key === periodoKey ? { ...f, devengado: !nuevoValor } : f));
            setSaving(null);
        }
    }, [props.project]);

    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: 'Control Financiero', href: '#' },
    ];

    const pieColors = props.pie.map((s, i) => s.label === 'Saldo' ? COLOR_SALDO : PIE_COLORS[i % PIE_COLORS.length]);
    const pieData = {
        labels: props.pie.map(s => s.label),
        datasets: [{
            data: props.pie.map(s => Math.max(0, s.pct)),
            backgroundColor: pieColors,
            borderColor: '#ffffff',
            borderWidth: 2,
        }],
    };
    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: {
                callbacks: {
                    label: (ctx: TooltipItem<'pie'>) => {
                        const slice = props.pie[ctx.dataIndex];
                        return `${slice.label}: ${fmtPct(slice.pct)} (S/. ${fmt(slice.monto)})`;
                    },
                },
            },
        },
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Control Financiero — ${props.projectName}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-900">
                <CronogramaNavTabs project={props.project} modoCalculo={props.modoCalculo} active="controlFinanciero" estado={props.estado} />
                <div className="max-w-[1400px] mx-auto">

                    <div className="mb-4 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                        <h1 className="text-sm font-black text-slate-700 uppercase tracking-wide">Control de Avance Financiero de la Obra</h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Marca cada valorización como "Devengada" cuando quede formalmente aprobada para pago.
                        </p>
                    </div>

                    {props.sinMontoContrato && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                            ⚠ Aún no se guardó el <strong>Monto del Contrato</strong> — vuelve a Valorizado y presiona "Guardar".
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                            <table className="min-w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-600 font-black uppercase tracking-wide">
                                        <th className="px-3 py-2 text-left">N°</th>
                                        <th className="px-3 py-2 text-left">Periodo</th>
                                        <th className="px-2 py-2 text-right">Monto Facturable</th>
                                        <th className="px-2 py-2 text-right">Devengado</th>
                                        <th className="px-2 py-2 text-right">%</th>
                                        <th className="px-2 py-2 text-right">Pendiente</th>
                                        <th className="px-2 py-2 text-center">¿Devengada?</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                                        <td colSpan={7} className="px-3 py-1.5 font-black text-slate-500 text-[10px] uppercase tracking-wide">A. Adelantos Otorgados</td>
                                    </tr>
                                    <tr className="border-t border-slate-100">
                                        <td className="px-3 py-1.5 text-slate-400">-</td>
                                        <td className="px-3 py-1.5 font-semibold text-slate-700">Adelanto directo</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{fmt(props.adelantoDirecto)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{fmt(props.adelantoDirecto)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-slate-400">{props.montoContrato > 0 ? fmtPct(props.adelantoDirecto / props.montoContrato * 100) : '—'}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">0.00</td>
                                        <td className="px-2 py-1.5 text-center text-slate-400">—</td>
                                    </tr>
                                    <tr className="border-t border-slate-100">
                                        <td className="px-3 py-1.5 text-slate-400">-</td>
                                        <td className="px-3 py-1.5 font-semibold text-slate-700">Adelanto de materiales</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{fmt(props.adelantoMateriales)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{fmt(props.adelantoMateriales)}</td>
                                        <td className="px-2 py-1.5 text-right font-mono text-slate-400">{props.montoContrato > 0 ? fmtPct(props.adelantoMateriales / props.montoContrato * 100) : '—'}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">0.00</td>
                                        <td className="px-2 py-1.5 text-center text-slate-400">—</td>
                                    </tr>

                                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                                        <td colSpan={7} className="px-3 py-1.5 font-black text-slate-500 text-[10px] uppercase tracking-wide">B. Valorizaciones de Obra</td>
                                    </tr>
                                    {filas.map(f => (
                                        <tr key={f.key} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className="px-3 py-1.5 text-slate-500">{String(f.numero).padStart(2, '0')}</td>
                                            <td className="px-3 py-1.5 font-semibold text-slate-700">Valorización {f.periodoCal}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{fmt(f.montoFacturable)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono font-bold text-emerald-700">{f.montoDevengado > 0 ? fmt(f.montoDevengado) : '-'}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-slate-400">{fmtPct(f.pctDevengado)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{f.montoPendiente > 0 ? fmt(f.montoPendiente) : '-'}</td>
                                            <td className="px-2 py-1.5 text-center">
                                                <button
                                                    onClick={() => toggleDevengado(f.key, !f.devengado)}
                                                    disabled={saving === f.key}
                                                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-black transition-all disabled:opacity-50 ${
                                                        f.devengado
                                                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                                            : 'bg-slate-100 text-slate-500 border-slate-300'
                                                    }`}
                                                >
                                                    {f.devengado ? '✓ Devengada' : 'Pendiente'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    <tr className="border-t-2 border-slate-300 bg-slate-100 font-black text-slate-700">
                                        <td colSpan={2} className="px-3 py-2">ACUMULADO</td>
                                        <td className="px-2 py-2 text-right font-mono">{fmt(props.totalFacturable)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-emerald-700">{fmt(props.totalDevengado)}</td>
                                        <td className="px-2 py-2 text-right font-mono">{fmtPct(props.pctTotalDevengado)}</td>
                                        <td className="px-2 py-2 text-right font-mono">{fmt(props.totalPendiente)}</td>
                                        <td />
                                    </tr>
                                    <tr className="bg-amber-50 font-black text-amber-800">
                                        <td colSpan={2} className="px-3 py-2">SALDO</td>
                                        <td className="px-2 py-2 text-right font-mono">{fmt(props.saldoFacturable)}</td>
                                        <td className="px-2 py-2 text-right font-mono">{fmt(props.saldoDevengado)}</td>
                                        <td className="px-2 py-2 text-right font-mono">{fmtPct(props.pctSaldoDevengado)}</td>
                                        <td className="px-2 py-2 text-right font-mono">{fmt(props.saldoPendiente)}</td>
                                        <td />
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                            <h2 className="text-xs font-black text-slate-600 uppercase tracking-wide text-center mb-2">Control Financiero de la Obra</h2>
                            {props.pie.length > 0 ? (
                                <div style={{ height: 280 }}>
                                    <Pie data={pieData} options={pieOptions} />
                                </div>
                            ) : (
                                <div className="py-16 text-center text-slate-400 text-xs">Sin datos suficientes.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
