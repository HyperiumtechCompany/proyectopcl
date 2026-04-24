import React from 'react';
import { DollarSign, TrendingUp, Calendar, BarChart2, Zap } from 'lucide-react';

interface CurvaSPoint {
    mes:          string;
    mesLabel:     string;
    key:          string;
    mensual:      number;
    acumulado:    number;
    pctMensual:   number;
    pctAcumulado: number;
}

interface Props {
    total:        number;
    acumulado:    number;
    meses:        number;
    mesPico?:     string | null;
    montoMesPico?: number;
    pctMesPico?:  number;
    curvaSData:   CurvaSPoint[];
}

const fmt  = (v: number) => `S/. ${(v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
const fmtC = (v: number) =>
    v >= 1_000_000 ? `S/. ${(v/1_000_000).toFixed(2)}M`
    : v >= 1_000   ? `S/. ${(v/1_000).toFixed(1)}K`
    : `S/. ${v.toFixed(0)}`;

const ResumenFinanciero: React.FC<Props> = ({
    total = 0, acumulado = 0, meses = 0,
    mesPico, montoMesPico = 0, pctMesPico = 0,
    curvaSData = [],
}) => {
    const pctAvance = total > 0 ? ((acumulado / total) * 100) : 0;
    const maxMensual = Math.max(...curvaSData.map(d => d.mensual), 1);

    return (
        <div className="space-y-4 mb-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                    icon={<DollarSign className="w-5 h-5" />}
                    label="Presupuesto Total"
                    value={fmt(total)}
                    sub="valor contractual"
                    color="blue"
                />
                <KpiCard
                    icon={<TrendingUp className="w-5 h-5" />}
                    label="Valorizado Total"
                    value={fmt(acumulado)}
                    sub={`${pctAvance.toFixed(1)}% de avance`}
                    color="emerald"
                />
                <KpiCard
                    icon={<Calendar className="w-5 h-5" />}
                    label="Plazo de Ejecución"
                    value={`${meses} meses`}
                    sub="duración del proyecto"
                    color="violet"
                />
                <KpiCard
                    icon={<Zap className="w-5 h-5" />}
                    label="Mes Pico"
                    value={mesPico ? fmtC(montoMesPico) : '—'}
                    sub={mesPico ? `${mesPico} · ${pctMesPico.toFixed(1)}%` : 'sin datos'}
                    color="amber"
                />
            </div>

            {/* Curva S */}
            {curvaSData.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <BarChart2 className="w-4 h-4 text-blue-600" />
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                Curva S — Valorización Mensual y Acumulada
                            </h3>
                        </div>
                        <div className="flex items-center gap-4 text-[9px] font-bold text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-2 rounded-sm bg-blue-500 inline-block" /> Mensual
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block" /> Acumulado %
                            </span>
                        </div>
                    </div>

                    {/* Barras + línea curva S */}
                    <div className="relative">
                        {/* Barras mensuales */}
                        <div className="flex items-end gap-1 h-24">
                            {curvaSData.map((d, i) => {
                                const alto    = (d.mensual / maxMensual) * 100;
                                const isPico  = d.mensual === maxMensual;
                                const prevPct = i > 0 ? curvaSData[i-1].pctAcumulado : 0;
                                return (
                                    <div key={d.key} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold rounded-lg px-2.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl">
                                            <div className="font-black">{d.mesLabel}</div>
                                            <div className="text-blue-300">Mes: {fmt(d.mensual)}</div>
                                            <div className="text-blue-200 text-[8px]">{d.pctMensual.toFixed(2)}%</div>
                                            <div className="text-emerald-300">Acum.: {d.pctAcumulado.toFixed(1)}%</div>
                                        </div>

                                        {/* Barra */}
                                        <div className="w-full relative flex-1 flex items-end">
                                            <div
                                                className={`w-full rounded-t transition-all ${
                                                    isPico ? 'bg-amber-500' : 'bg-blue-500'
                                                }`}
                                                style={{ height: `${Math.max(alto, 3)}%` }}
                                            />
                                        </div>

                                        {/* Etiqueta mes */}
                                        <span className="text-[7px] text-slate-400 font-bold truncate w-full text-center leading-tight">
                                            {d.mesLabel.replace('MES ', 'M')}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Línea de acumulado SVG superpuesta */}
                        <svg
                            className="absolute top-0 left-0 w-full h-24 pointer-events-none"
                            preserveAspectRatio="none"
                            viewBox={`0 0 ${Math.max(curvaSData.length * 10, 1)} 100`}
                        >
                            <polyline
                                points={curvaSData.map((d, i) => {
                                    const x = (i + 0.5) * 10;
                                    const y = 100 - d.pctAcumulado;
                                    return `${x},${y}`;
                                }).join(' ')}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {curvaSData.map((d, i) => (
                                <circle
                                    key={d.key}
                                    cx={(i + 0.5) * 10}
                                    cy={100 - d.pctAcumulado}
                                    r="1.5"
                                    fill="#10b981"
                                />
                            ))}
                        </svg>
                    </div>

                    {/* % acumulado labels */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                        {curvaSData.filter((_, i) => i % Math.max(1, Math.floor(curvaSData.length / 8)) === 0 || i === curvaSData.length - 1).map(d => (
                            <span key={d.key} className="text-[9px] text-slate-500 font-bold">
                                <span className="text-emerald-600">{d.mesLabel}</span> {d.pctAcumulado.toFixed(1)}%
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const colorMap: Record<string, string> = {
    blue:    'bg-blue-50   border-blue-100   text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    violet:  'bg-violet-50 border-violet-100 text-violet-700',
    amber:   'bg-amber-50  border-amber-100  text-amber-700',
};

const KpiCard: React.FC<{
    icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}> = ({ icon, label, value, sub, color }) => (
    <div className={`p-4 rounded-2xl border shadow-sm ${colorMap[color]}`}>
        <div className="flex items-start justify-between mb-2">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</p>
            <div className="opacity-40">{icon}</div>
        </div>
        <p className="text-lg font-black leading-tight">{value}</p>
        <p className="text-[10px] font-semibold opacity-50 mt-0.5">{sub}</p>
    </div>
);

export default ResumenFinanciero;