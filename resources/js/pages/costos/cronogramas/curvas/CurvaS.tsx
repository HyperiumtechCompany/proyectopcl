import { Head } from '@inertiajs/react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    LineController,
    Tooltip,
    Legend,
    type TooltipItem,
} from 'chart.js';
import React from 'react';
import { Line } from 'react-chartjs-2';
import AppLayout from '@/layouts/app-layout';
import CronogramaNavTabs, { type CronogramaEstado } from '../components/CronogramaNavTabs';

// LineController es el "controlador" del tipo de gráfico — Chart.js v4 lo
// exige registrado aparte de sus piezas (escalas/elementos), si no la
// primera vez que se intenta dibujar tira "'line' is not a registered
// controller" y React se cae sin error boundary que lo atrape (pantalla en
// negro, sin mensaje visible).
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Tooltip, Legend);

interface FilaCurva {
    periodo:               string;
    periodoCal:             string;
    key:                    string;
    pctProgramadoAcumulado: number;
    pctEjecutadoAcumulado:  number;
    metaMinima80:           number;
    desviacion:             number;
    estado:                 'ATRASADA' | 'CULMINADA' | 'ADELANTADA';
}

interface CurvaSProps {
    project:          string;
    projectName:      string;
    modoCalculo:      'calendario' | '30dias';
    filas:            FilaCurva[];
    totalPresupuesto: number;
    sinProgramado:    boolean;
    sinEjecutado:     boolean;
    estado?:          CronogramaEstado;
}

// Paleta categórica validada (dataviz skill): slot 1 = azul (programado),
// slot 2 = naranja (ejecutado) — orden fijo, nunca ciclado. La meta 80% es
// una línea de referencia, no una serie: gris neutro, discontinua, sin
// marcador — no compite por identidad de color con las dos series reales.
const COLOR_PROGRAMADO = '#2a78d6';
const COLOR_EJECUTADO = '#eb6834';
const COLOR_META = '#94a3b8';

const estadoBadge: Record<FilaCurva['estado'], string> = {
    ATRASADA: 'bg-rose-100 text-rose-700 border-rose-200',
    CULMINADA: 'bg-blue-100 text-blue-700 border-blue-200',
    ADELANTADA: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const fmtPct = (n: number) => `${n.toFixed(2)}%`;

export default function CurvaS(props: CurvaSProps) {
    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: 'Curva S', href: '#' },
    ];

    const faltaDatos = props.sinProgramado || props.sinEjecutado;
    const ultima = props.filas[props.filas.length - 1];

    const data = {
        labels: props.filas.map(f => f.periodoCal),
        datasets: [
            {
                label: 'Programado acumulado',
                data: props.filas.map(f => f.pctProgramadoAcumulado),
                borderColor: COLOR_PROGRAMADO,
                backgroundColor: COLOR_PROGRAMADO,
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: COLOR_PROGRAMADO,
                cubicInterpolationMode: 'monotone' as const,
                tension: 0.3,
            },
            {
                label: 'Ejecutado acumulado',
                data: props.filas.map(f => f.pctEjecutadoAcumulado),
                borderColor: COLOR_EJECUTADO,
                backgroundColor: COLOR_EJECUTADO,
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: COLOR_EJECUTADO,
                cubicInterpolationMode: 'monotone' as const,
                tension: 0.3,
            },
            {
                label: 'Meta mínima 80%',
                data: props.filas.map(f => f.metaMinima80),
                borderColor: COLOR_META,
                backgroundColor: COLOR_META,
                borderWidth: 1.5,
                borderDash: [6, 4],
                pointRadius: 0,
                tension: 0.3,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { usePointStyle: true, boxWidth: 8, font: { size: 11, weight: 'bold' as const } },
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    label: (ctx: TooltipItem<'line'>) => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(2)}%`,
                },
            },
        },
        scales: {
            y: {
                min: 0,
                ticks: { callback: (v: number | string) => `${v}%` },
                grid: { color: '#f1f5f9' },
            },
            x: {
                grid: { display: false },
            },
        },
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Curva S — ${props.projectName}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-900">
                <CronogramaNavTabs project={props.project} modoCalculo={props.modoCalculo} active="curvaS" estado={props.estado} />
                <div className="max-w-[1400px] mx-auto">

                    <div className="mb-4 flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                        <div>
                            <h1 className="text-sm font-black text-slate-700 uppercase tracking-wide">Curva S — Avance Acumulado</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Programado vs. ejecutado, acumulado en el tiempo — modo {props.modoCalculo === 'calendario' ? 'calendario' : '30 días'}.
                            </p>
                        </div>
                        <a
                            href={`/module/control_avance_obra?project=${props.project}&modo=${props.modoCalculo}`}
                            className="px-3 py-1.5 text-xs font-black rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all"
                        >
                            Ver como tabla →
                        </a>
                    </div>

                    {faltaDatos && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                            {props.sinProgramado && <div>⚠ Aún no se guardó el <strong>Valorizado programado</strong> — la curva de programado saldrá en cero hasta que lo guardes.</div>}
                            {props.sinEjecutado && <div>⚠ Aún no se guardó ningún <strong>Avance Real</strong> — la curva de ejecutado saldrá en cero hasta que captures avance.</div>}
                        </div>
                    )}

                    {ultima && (
                        <div className="mb-4 grid grid-cols-3 gap-3">
                            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">% Programado Acumulado</div>
                                <div className="text-2xl font-black text-slate-700 mt-1">{fmtPct(ultima.pctProgramadoAcumulado)}</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">% Ejecutado Acumulado</div>
                                <div className="text-2xl font-black mt-1" style={{ color: COLOR_EJECUTADO }}>{fmtPct(ultima.pctEjecutadoAcumulado)}</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm flex flex-col justify-center">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Situación de la Obra</div>
                                <span className={`self-start px-2.5 py-1 rounded-lg border text-xs font-black ${estadoBadge[ultima.estado]}`}>
                                    {ultima.estado}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        {props.filas.length > 0 ? (
                            <div style={{ height: 420 }}>
                                <Line data={data} options={options} />
                            </div>
                        ) : (
                            <div className="py-16 text-center text-slate-400 text-sm">No hay periodos que mostrar.</div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
