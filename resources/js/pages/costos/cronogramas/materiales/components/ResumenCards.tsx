import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, TrendingUp, BarChart3, Wallet, Activity } from 'lucide-react';
import { ResumenProyecto } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
interface CurvaSPoint {
    mes:        string;
    key:        string;
    mensual:    number;
    acumulado:  number;
    porcentaje: number;
}

interface Props {
    estaGuardado: boolean;
    sinGantt:     boolean;
    curvaSData:   CurvaSPoint[];
    mesPicoKey:   string;
    resumen?:     ResumenProyecto;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(v);

const fmtK = (v: number): string => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
    return v.toFixed(0);
};

// ─────────────────────────────────────────────────────────────────────────────
// GRÁFICO SVG — HISTOGRAMA + CURVA S
// ─────────────────────────────────────────────────────────────────────────────
const CurvaSChart: React.FC<{ data: CurvaSPoint[]; mesPicoKey: string }> = ({ data, mesPicoKey }) => {
    const W = 1000, H = 310;
    const ML = 56, MR = 30, MT = 40, MB = 48;
    const CW  = W - ML - MR;
    const CH  = H - MT - MB;

    const total = data[data.length - 1]?.acumulado ?? 1;
    const barW  = CW / data.length;
    const pad   = Math.max(1.5, barW * 0.12);

    const toY = (pct: number) => MT + CH - (pct / 100) * CH;
    const toX = (i: number)   => ML + (i + 0.5) * barW;

    // Puntos de la curva S
    const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.porcentaje), pct: d.porcentaje }));

    // Path bezier suave
    const curvePath = pts.reduce((acc, pt, i) => {
        if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        const prev = pts[i - 1];
        const cpx  = ((prev.x + pt.x) / 2).toFixed(1);
        return `${acc} C ${cpx} ${prev.y.toFixed(1)}, ${cpx} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }, '');

    // Área relleno bajo la curva
    const last  = pts[pts.length - 1];
    const first = pts[0];
    const areaPath = `${curvePath} L ${last.x.toFixed(1)} ${(MT + CH).toFixed(1)} L ${first.x.toFixed(1)} ${(MT + CH).toFixed(1)} Z`;

    // ¿cada cuántos meses mostrar etiqueta?
    const labelStep = Math.max(1, Math.ceil(data.length / 9));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
                <linearGradient id="rcBarBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="rcBarAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <linearGradient id="rcArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#ea580c" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity="0.01" />
                </linearGradient>
            </defs>

            {/* Fondo área gráfico */}
            <rect x={ML} y={MT} width={CW} height={CH} fill="#f8fafc" rx="3" />

            {/* Grillas horizontales */}
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(pct => {
                const y      = toY(pct);
                const isMaj  = pct % 20 === 0;
                return (
                    <g key={pct}>
                        <line x1={ML} y1={y} x2={W - MR} y2={y}
                              stroke={isMaj ? '#cbd5e1' : '#e2e8f0'}
                              strokeWidth={isMaj ? 0.9 : 0.45}
                              strokeDasharray={pct === 0 || pct === 100 ? '0' : isMaj ? '5 4' : '2 4'} />
                        {isMaj && (
                            <text x={ML - 7} y={y + 3.5} textAnchor="end"
                                  fontSize="10" fill="#94a3b8"
                                  fontFamily="'Courier New', monospace" fontWeight="700">
                                {pct}%
                            </text>
                        )}
                    </g>
                );
            })}

            {/* Línea 100% en verde */}
            <line x1={ML} y1={toY(100)} x2={W - MR} y2={toY(100)}
                  stroke="#10b981" strokeWidth="1.2" strokeDasharray="6 3" opacity="0.6" />
            <rect x={W - MR - 30} y={toY(100) - 10} width={30} height={13}
                  fill="#f0fdf4" stroke="#6ee7b7" strokeWidth="0.8" rx="2" />
            <text x={W - MR - 15} y={toY(100) - 0.5}
                  textAnchor="middle" fontSize="8" fill="#059669" fontWeight="800">100%</text>

            {/* BARRAS */}
            {data.map((d, i) => {
                const barPct = total > 0 ? (d.mensual / total) * 100 : 0;
                const bH     = Math.max((barPct / 100) * CH, 2);
                const bX     = ML + i * barW + pad;
                const bW     = barW - pad * 2;
                const bY     = MT + CH - bH;
                const isPico = d.key === mesPicoKey;

                return (
                    <g key={`b-${d.key}`}>
                        {/* Sombra */}
                        <rect x={bX + 1.5} y={bY + 3} width={bW} height={bH}
                              fill={isPico ? '#78350f' : '#1e3a8a'} opacity="0.1" rx="2" />
                        {/* Barra */}
                        <rect x={bX} y={bY} width={bW} height={bH}
                              fill={isPico ? 'url(#rcBarAmber)' : 'url(#rcBarBlue)'} rx="2" />
                        {/* Brillo */}
                        <rect x={bX + 1} y={bY} width={bW - 2} height={Math.min(4, bH * 0.3)}
                              fill="white" opacity="0.22" rx="1" />
                        {/* % mensual encima (si hay espacio) */}
                        {bH > 22 && (
                            <text x={bX + bW / 2} y={bY - 5}
                                  textAnchor="middle" fontSize="8"
                                  fill={isPico ? '#78350f' : '#1e3a8a'} fontWeight="800"
                                  fontFamily="'Courier New', monospace">
                                {barPct.toFixed(1)}%
                            </text>
                        )}
                        {/* Valor dentro */}
                        {bH > 40 && (
                            <text x={bX + bW / 2} y={bY + bH / 2 + 4}
                                  textAnchor="middle" fontSize="7.5"
                                  fill="white" fontWeight="700" opacity="0.85">
                                {fmtK(d.mensual)}
                            </text>
                        )}
                        {/* Etiqueta eje X — mes */}
                        <text x={toX(i)} y={MT + CH + 14}
                              textAnchor="middle" fontSize="9"
                              fill={isPico ? '#b45309' : '#475569'}
                              fontWeight={isPico ? '800' : '600'}
                              fontFamily="system-ui, sans-serif">
                            {d.mes.split(' ')[0]}
                        </text>
                        {/* Año */}
                        <text x={toX(i)} y={MT + CH + 27}
                              textAnchor="middle" fontSize="7.5"
                              fill="#94a3b8" fontWeight="600">
                            {d.mes.split(' ')[1] ?? ''}
                        </text>
                    </g>
                );
            })}

            {/* Área bajo la curva */}
            <path d={areaPath} fill="url(#rcArea)" />

            {/* Trazo blanco de fondo (halo) */}
            <path d={curvePath} fill="none"
                  stroke="white" strokeWidth="5"
                  strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
            {/* Curva principal */}
            <path d={curvePath} fill="none"
                  stroke="#ea580c" strokeWidth="2.8"
                  strokeLinecap="round" strokeLinejoin="round" />

            {/* NODOS + ETIQUETAS DE % ACUMULADO */}
            {pts.map((pt, i) => {
                const showLabel = (i % labelStep === 0) || i === data.length - 1 || data[i].key === mesPicoKey;
                const isPico    = data[i].key === mesPicoKey;
                const pct       = pt.pct;
                const labelUp   = pt.y > MT + 24;
                const ly        = labelUp ? pt.y - 21 : pt.y + 18;

                return (
                    <g key={`n-${i}`}>
                        {/* Halo del nodo */}
                        {showLabel && (
                            <circle cx={pt.x} cy={pt.y} r={7.5}
                                fill={isPico ? '#fef3c7' : '#fff7ed'}
                                stroke={isPico ? '#d97706' : '#ea580c'}
                                strokeWidth="1.2" opacity="0.55" />
                        )}
                        {/* Nodo */}
                        <circle cx={pt.x} cy={pt.y}
                            r={showLabel ? 4.5 : 2.2}
                            fill="white"
                            stroke={isPico ? '#d97706' : '#ea580c'}
                            strokeWidth={showLabel ? 2.2 : 1.4} />

                        {/* Etiqueta */}
                        {showLabel && (
                            <g>
                                <line x1={pt.x} y1={labelUp ? pt.y - 5 : pt.y + 5}
                                      x2={pt.x} y2={labelUp ? ly + 11 : ly - 1}
                                      stroke={isPico ? '#d97706' : '#ea580c'}
                                      strokeWidth="1" strokeDasharray="2 2" opacity="0.55" />
                                <rect x={pt.x - 17} y={ly - 10} width={34} height={13}
                                      fill={isPico ? '#fffbeb' : '#fff7ed'}
                                      stroke={isPico ? '#fcd34d' : '#fed7aa'}
                                      strokeWidth="0.8" rx="3" opacity="0.96" />
                                <text x={pt.x} y={ly}
                                      textAnchor="middle" fontSize="8.5"
                                      fill={isPico ? '#92400e' : '#c2410c'}
                                      fontWeight="800"
                                      fontFamily="'Courier New', monospace">
                                    {pct.toFixed(1)}%
                                </text>
                            </g>
                        )}
                    </g>
                );
            })}

            {/* EJES */}
            <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#64748b" strokeWidth="1.5" />
            <line x1={ML} y1={MT + CH} x2={W - MR} y2={MT + CH} stroke="#64748b" strokeWidth="1.5" />

            {/* Título eje Y */}
            <text x={13} y={MT + CH / 2} textAnchor="middle"
                  fontSize="9.5" fill="#475569" fontWeight="800"
                  fontFamily="system-ui, sans-serif" letterSpacing="0.06em"
                  transform={`rotate(-90, 13, ${MT + CH / 2})`}>
                AVANCE ACUMULADO (%)
            </text>
        </svg>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const ResumenCards: React.FC<Props> = ({ estaGuardado, sinGantt, curvaSData, mesPicoKey, resumen }) => {
    const totalAcumulado = curvaSData[curvaSData.length - 1]?.acumulado ?? 0;
    const mesPico        = curvaSData.find(d => d.key === mesPicoKey);

    const hitos = useMemo(() =>
        [25, 50, 75, 100].map(target => {
            const p = curvaSData.find(d => d.porcentaje >= target);
            return p ? { mes: p.mes, pct: target, key: p.key } : null;
        }).filter(Boolean) as { mes: string; pct: number; key: string }[]
    , [curvaSData]);

    const banner = sinGantt
        ? { cls: 'bg-amber-950  border-amber-700  text-amber-100',   bar: 'bg-amber-500',   icon: <AlertTriangle className="w-4 h-4 text-amber-400  flex-shrink-0" />, title: 'Sin datos de Cronograma General (Gantt)',           sub: 'Complete el Cronograma General con fechas de inicio y fin antes de calcular materiales.' }
        : estaGuardado
        ? { cls: 'bg-emerald-950 border-emerald-700 text-emerald-100', bar: 'bg-emerald-500', icon: <CheckCircle2  className="w-4 h-4 text-emerald-400 flex-shrink-0" />, title: 'Cronograma sincronizado con la base de datos',     sub: 'Datos en cronograma_materiales. Use "Limpiar" para recalcular desde el Gantt y el APU.' }
        : { cls: 'bg-blue-950   border-blue-700   text-blue-100',     bar: 'bg-blue-500',    icon: <Info           className="w-4 h-4 text-blue-400   flex-shrink-0" />, title: 'Vista dinámica — calculado en tiempo real desde APU', sub: 'Los insumos se calculan desde el APU y el Gantt. Guarde para persistirlos en la BD.' };

    return (
        <div className="flex flex-col gap-3 mb-4">

            {/* BANNER */}
            <div className={`flex items-start gap-0 rounded-xl border overflow-hidden ${banner.cls}`}>
                <div className={`w-1 self-stretch flex-shrink-0 ${banner.bar}`} />
                <div className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5">{banner.icon}</div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest">{banner.title}</p>
                        <p className="text-[10px] opacity-60 mt-0.5 leading-relaxed">{banner.sub}</p>
                    </div>
                </div>
            </div>

            {/* KPI CARDS */}
            {curvaSData.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard label="Total Insumos"     value={fmt(totalAcumulado)}
                        sub="presupuesto directo"
                        icon={<Wallet   className="w-5 h-5 text-blue-600"   />} ring="blue-200"   iconBg="bg-blue-50"   val="text-slate-800" />
                    <KpiCard label="Mes Pico"           value={mesPico?.mes ?? mesPicoKey ?? '—'}
                        sub={mesPico ? fmt(mesPico.mensual) : 'sin datos'}
                        icon={<BarChart3 className="w-5 h-5 text-amber-500" />} ring="amber-200"  iconBg="bg-amber-50"  val="text-amber-700" />
                    <KpiCard label="Duración Proyecto"  value={`${curvaSData.length} meses`}
                        sub={curvaSData.length > 0 ? `${curvaSData[0].mes} → ${curvaSData[curvaSData.length-1].mes}` : ''}
                        icon={<Activity  className="w-5 h-5 text-violet-600"/>} ring="violet-200" iconBg="bg-violet-50" val="text-violet-700" />
                    <KpiCard label="Promedio Mensual"   value={curvaSData.length > 0 ? fmt(totalAcumulado / curvaSData.length) : '—'}
                        sub="inversión promedio"
                        icon={<TrendingUp className="w-5 h-5 text-emerald-600"/>} ring="emerald-200" iconBg="bg-emerald-50" val="text-emerald-700" />
                </div>
            )}

            {/* PANEL CURVA S */}
            {curvaSData.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-white/10 rounded-lg">
                                <TrendingUp className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 className="text-[11px] font-black text-white uppercase tracking-widest">
                                    Curva S — Distribución Financiera Mensual de Insumos
                                </h3>
                                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                                    Histograma de consumo mensual + avance acumulado · Ingeniería Civil
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black bg-white/10 text-white rounded-lg px-3 py-1.5 border border-white/20">
                            <span className="text-slate-300">Total:</span>
                            <span className="text-emerald-300">{fmt(totalAcumulado)}</span>
                        </div>
                    </div>

                    {/* Gráfico */}
                    <div className="px-3 pt-5 pb-1">
                        <CurvaSChart data={curvaSData} mesPicoKey={mesPicoKey} />
                    </div>

                    {/* Leyenda + Hitos */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-t border-slate-100 bg-slate-50/80">

                        {/* Series */}
                        <div className="flex items-center gap-4 text-[9px] font-bold text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <span className="w-5 h-3 rounded" style={{ background: 'linear-gradient(to top, #1e40af, #60a5fa)' }} />
                                Consumo Mensual
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-5 h-3 rounded" style={{ background: 'linear-gradient(to top, #b45309, #fbbf24)' }} />
                                Mes Pico
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-5 h-0.5 rounded" style={{ background: '#ea580c' }} />
                                <span className="w-2 h-2 rounded-full bg-white border-2 border-orange-500 -ml-1" />
                                Curva S Acumulada
                            </span>
                        </div>

                        {/* Hitos de avance */}
                        {hitos.length > 0 && (
                            <div className="flex items-center gap-2 ml-auto flex-wrap">
                                <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Hitos:</span>
                                {hitos.map(h => (
                                    <div key={h.key}
                                         className="flex items-center gap-1 bg-white border border-orange-100 rounded-lg px-2 py-1 shadow-sm">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                        <span className="text-[9px] font-black text-orange-700">{h.pct}%</span>
                                        <span className="text-[9px] text-slate-400 font-semibold">{h.mes}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD AUXILIAR
// ─────────────────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
    label:   string;
    value:   string;
    sub:     string;
    icon:    React.ReactNode;
    ring:    string;
    iconBg:  string;
    val:     string;
}> = ({ label, value, sub, icon, ring, iconBg, val }) => (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between group hover:border-${ring} hover:shadow-md transition-all`}>
        <div className="min-w-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-[15px] font-black leading-tight truncate ${val}`}>{value}</p>
            <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">{sub}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${iconBg} ml-3 flex-shrink-0 group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
    </div>
);

export default ResumenCards;