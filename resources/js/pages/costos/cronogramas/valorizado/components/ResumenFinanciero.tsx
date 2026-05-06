import React from 'react';
import { DollarSign, TrendingUp, Calendar, BarChart2, Zap, Info } from 'lucide-react';

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
    total:         number;
    acumulado:     number;
    meses:         number;
    mesPico?:      string | null;
    montoMesPico?: number;
    pctMesPico?:   number;
    curvaSData:    CurvaSPoint[];
}

const fmt = (v: number) => `S/. ${(v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
const fmtC = (v: number) =>
    v >= 1_000_000 ? `S/. ${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000   ? `S/. ${(v / 1_000).toFixed(1)}K`
    : `S/. ${v.toFixed(0)}`;

const ResumenFinanciero: React.FC<Props> = ({
    total = 0, acumulado = 0, meses = 0,
    mesPico, montoMesPico = 0, pctMesPico = 0,
    curvaSData = [],
}) => {
    const pctAvance  = total > 0 ? ((acumulado / total) * 100) : 0;
    const maxMensual = Math.max(...curvaSData.map(d => d.mensual), 1);
    const maxAcumulado = 100; // Porcentaje máximo siempre 100%

    // Calcular puntos para la curva suavizada (bezier)
    const getBezierPoints = () => {
        if (curvaSData.length === 0) return '';
        const step = 100 / Math.max(curvaSData.length - 1, 1);
        return curvaSData.map((d, i) => {
            const x = i * step;
            const y = maxAcumulado - d.pctAcumulado;
            return `${x},${y}`;
        }).join(' ');
    };

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
                    label={`Plazo de Ejecución (${meses} meses)`}
                    value={`${meses} ${meses === 1 ? 'mes' : 'meses'}`}
                    sub="duración del proyecto"
                    color="violet"
                />
                <KpiCard
                    icon={<Zap className="w-5 h-5" />}
                    label="Mes Pico"
                    value={mesPico ? fmtC(montoMesPico) : '—'}
                    sub={mesPico ? `${mesPico} · ${pctMesPico.toFixed(1)}% del total` : 'sin datos'}
                    color="amber"
                />
            </div>

            {/* Curva S - Estilo MS Project */}
            {curvaSData.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                <BarChart2 className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                                    Curva S — Avance Físico Valorizado
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    Distribución mensual vs. avance acumulado
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-5 text-[10px] font-bold">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-blue-500 shadow-sm" />
                                <span className="text-slate-600">Valorización Mensual</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-0.5 rounded-full bg-emerald-500 shadow-sm" />
                                <span className="text-slate-600">Curva S (Avance Acumulado)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
                                <span className="text-slate-600">Mes Pico</span>
                            </div>
                        </div>
                    </div>

                    {/* Gráfico */}
                    <div className="relative pt-2">
                        {/* Líneas de cuadrícula horizontales */}
                        <div className="absolute left-0 right-0 top-0 bottom-0 pointer-events-none">
                            {[0, 20, 40, 60, 80, 100].map(porcentaje => (
                                <div
                                    key={porcentaje}
                                    className="absolute w-full border-t border-slate-100"
                                    style={{ bottom: `${porcentaje}%` }}
                                >
                                    <span className="absolute -left-6 -translate-y-1/2 text-[8px] text-slate-400 font-mono">
                                        {porcentaje}%
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Barras mensuales */}
                        <div className="flex items-end gap-1 h-32 relative z-10 ml-6 mr-2">
                            {curvaSData.map((d, i) => {
                                const alto = (d.mensual / maxMensual) * 100;
                                const isPico = d.mensual === maxMensual;
                                return (
                                    <div key={d.key} className="flex-1 flex flex-col items-center gap-1 group relative">
                                        {/* Tooltip moderno */}
                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-medium rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-20 shadow-xl transform -translate-y-1 group-hover:translate-y-0">
                                            <div className="font-bold text-blue-300 text-center">{d.mesLabel}</div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <div>
                                                    <span className="text-slate-400 text-[8px]">Mensual</span>
                                                    <div className="font-mono text-blue-200">{fmt(d.mensual)}</div>
                                                </div>
                                                <div className="w-px h-6 bg-slate-600" />
                                                <div>
                                                    <span className="text-slate-400 text-[8px]">% Mes</span>
                                                    <div className="font-mono text-emerald-200">{d.pctMensual.toFixed(2)}%</div>
                                                </div>
                                                <div className="w-px h-6 bg-slate-600" />
                                                <div>
                                                    <span className="text-slate-400 text-[8px]">Acumulado</span>
                                                    <div className="font-mono text-amber-200">{d.pctAcumulado.toFixed(1)}%</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Barra */}
                                        <div className="w-full relative flex items-end" style={{ height: `${Math.max(alto, 4)}%` }}>
                                            <div
                                                className={`w-full rounded-t transition-all duration-300 cursor-pointer ${
                                                    isPico ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-500 hover:bg-blue-600'
                                                }`}
                                                style={{ height: '100%' }}
                                            />
                                        </div>

                                        {/* Etiqueta del mes */}
                                        <span className="text-[8px] font-bold text-slate-500 truncate w-full text-center">
                                            {d.mesLabel.replace('MES ', '')}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Línea de Curva S suavizada */}
                        <svg
                            className="absolute top-0 left-0 w-full h-32 pointer-events-none"
                            preserveAspectRatio="none"
                            viewBox={`0 0 100 100`}
                            style={{ marginLeft: '24px', width: 'calc(100% - 16px)' }}
                        >
                            {/* Área bajo la curva (sombreado) */}
                            <polygon
                                points={`0,100 ${getBezierPoints()} 100,100`}
                                fill="url(#gradientCurve)"
                                opacity="0.15"
                            />
                            
                            {/* Línea suavizada */}
                            <polyline
                                points={getBezierPoints()}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="drop-shadow-sm"
                            />
                            
                            {/* Puntos de control */}
                            {curvaSData.map((d, i) => {
                                const step = 100 / Math.max(curvaSData.length - 1, 1);
                                const x = i * step;
                                const y = maxAcumulado - d.pctAcumulado;
                                const isLast = i === curvaSData.length - 1;
                                return (
                                    <circle
                                        key={d.key}
                                        cx={x}
                                        cy={y}
                                        r={isLast ? 3.5 : 2.5}
                                        fill={isLast ? '#059669' : '#10b981'}
                                        stroke="white"
                                        strokeWidth="1.5"
                                        className="cursor-pointer transition-all hover:r-4"
                                    />
                                );
                            })}
                            
                            {/* Degradado para el área bajo la curva */}
                            <defs>
                                <linearGradient id="gradientCurve" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    {/* Tabla de valores resumida */}
                    <div className="mt-5 pt-4 border-t border-slate-100">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="p-2 rounded-lg bg-slate-50">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Inicio</p>
                                <p className="text-[11px] font-mono font-bold text-slate-700">
                                    {curvaSData[0]?.mesLabel || '-'}
                                </p>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-50">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pico</p>
                                <p className="text-[11px] font-mono font-bold text-amber-600">
                                    {curvaSData.reduce((max, d) => d.mensual > max.mensual ? d : max, curvaSData[0])?.mesLabel || '-'}
                                </p>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-50">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Acumulado Final</p>
                                <p className="text-[11px] font-mono font-bold text-emerald-600">
                                    {curvaSData[curvaSData.length - 1]?.pctAcumulado.toFixed(1)}%
                                </p>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-50">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fin del Proyecto</p>
                                <p className="text-[11px] font-mono font-bold text-slate-700">
                                    {curvaSData[curvaSData.length - 1]?.mesLabel || '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const colorMap: Record<string, string> = {
    blue:    'bg-blue-50    border-blue-100    text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    violet:  'bg-violet-50  border-violet-100  text-violet-700',
    amber:   'bg-amber-50   border-amber-100   text-amber-700',
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