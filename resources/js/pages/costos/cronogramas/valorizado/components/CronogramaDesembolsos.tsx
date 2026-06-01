import React, { useState, useMemo, useRef } from 'react';
import {
    X, TrendingUp, DollarSign,
    Info, BarChart2, Table2,
    Layers, FileText
} from 'lucide-react';
import { Periodo } from '../types';

// TIPOS

interface Props {
    periodos: Periodo[];
    totalPresupuesto: number;
    valorizacionesMensuales: Record<string, { monto: number; porcentaje: number }>;
    totalDias: number;
    diasPorMes: Record<string, number>;
    projectName?: string;
    codigoProyecto?: string;
    ubicacion?: string;
    onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES REGLAMENTARIAS
// ─────────────────────────────────────────────────────────────────────────────
const ADELANTO_EFECTIVO_PCT   = 0.10;
const ADELANTO_MATERIALES_PCT = 0.20;

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────
const fmtSoles = (v: number) =>
    `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE COLORES FORMAL (paleta Excel institucional)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
    navy:         '#1E3A5F',
    navyMid:      '#2A4F7C',
    blue:         '#2F75B6',
    blueLight:    '#5B9BD5',
    headerBg:     '#D6E4F0',
    headerBg2:    '#BDD7EE',
    rowAlt:       '#EBF3FB',
    borderH:      '#9DC3E6',
    borderB:      '#D0D7E0',
    greenBg:      '#E2EFDA',
    greenText:    '#375623',
    greenBorder:  '#A9D18E',
    amberBg:      '#FFF2CC',
    amberText:    '#7D4700',
    red:          '#C00000',
    purple:       '#5B21B6',
    text:         '#1A202C',
    muted:        '#64748B',
    white:        '#FFFFFF',
    surface:      '#F7F9FC',
    surfaceAlt:   '#F0F4F8',
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────
type Vista = 'tabla' | 'grafico' | 'curvaS';

interface FilaMensual {
    key: string;
    diasCalendario: number;
    diasBloqueCalendario: number;
    adelantoEfectivo: number;
    adelantoMateriales: number;
    totalAdelanto: number;
    valorizacion: number;
    pctAvance: number;
    desembolsoMensual: number;
    desembolsoAcumulado: number;
    pctDesembolso: number;
    label: string;
}

interface TooltipState {
    x: number;
    y: number;
    data: FilaMensual;
}

interface CurveTooltipState {
    x: number;
    y: number;
    data: { label: string; acumulado: number; pct: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTILOS TABLA EXCEL
// ─────────────────────────────────────────────────────────────────────────────
function thExcel(extra: React.CSSProperties = {}): React.CSSProperties {
    return {
        padding: '7px 10px',
        fontSize: 10,
        fontWeight: 700,
        textAlign: 'right' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
        border: `1px solid ${C.borderH}`,
        whiteSpace: 'nowrap' as const,
        fontFamily: "'Calibri', 'Segoe UI', sans-serif",
        ...extra,
    };
}

function tdExcel(extra: React.CSSProperties = {}): React.CSSProperties {
    return {
        padding: '5px 10px',
        border: `1px solid ${C.borderB}`,
        whiteSpace: 'nowrap' as const,
        fontSize: 11.5,
        fontFamily: "'Calibri', 'Segoe UI', sans-serif",
        ...extra,
    };
}

const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 11px',
    fontSize: 11,
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.15s',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES SIMPLES
// ─────────────────────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
            {label}:
        </span>
        <span style={{ fontSize: 11.5, color: bold ? C.navy : '#1E293B', fontWeight: bold ? 800 : 600 }}>
            {value}
        </span>
    </div>
);

const KpiCard: React.FC<{ color: string; label: string; value: string; sub: string; icon: React.ReactNode; last?: boolean }> = ({
    color, label, value, sub, icon, last,
}) => (
    <div style={{
        padding: '11px 14px',
        borderRight: last ? 'none' : `1px solid ${C.borderB}`,
        background: C.white,
        position: 'relative',
        overflow: 'hidden',
    }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: color }} />
        <div style={{ paddingLeft: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <div style={{ color, opacity: 0.6 }}>{icon}</div>
                <span style={{ fontSize: 8, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.3 }}>
                    {label}
                </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "'Calibri', monospace", lineHeight: 1.1 }}>
                {value}
            </div>
            <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 3 }}>{sub}</div>
        </div>
    </div>
);

const TabBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({
    active, onClick, icon, label,
}) => (
    <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 12px',
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        color: active ? C.navy : C.muted,
        background: active ? C.white : 'transparent',
        border: active ? `1px solid ${C.borderB}` : '1px solid transparent',
        borderRadius: 4,
        cursor: 'pointer',
        boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
        transition: 'all 0.15s',
    }}>
        {icon}{label}
    </button>
);

const TipRow: React.FC<{ label: string; value: string; color?: string; bold?: boolean }> = ({ label, value, color, bold }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
        <span style={{ color: C.muted, fontSize: 10 }}>{label}</span>
        <span style={{ color: color ?? C.text, fontWeight: bold ? 700 : 500, fontSize: 10.5 }}>{value}</span>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// HISTOGRAMA 3D SVG
// ─────────────────────────────────────────────────────────────────────────────
interface H3DProps {
    data: FilaMensual[];
    maxValue: number;
    onEnter: (e: React.MouseEvent<SVGElement>, d: FilaMensual) => void;
    onMove:  (e: React.MouseEvent<SVGElement>, d: FilaMensual) => void;
    onLeave: () => void;
}

const Histogram3D: React.FC<H3DProps> = ({ data, maxValue, onEnter, onMove, onLeave }) => {
    const SVG_W = 920;
    const SVG_H = 340;
    const ML = 88, MR = 50, MT = 30, MB = 65;
    const CW  = SVG_W - ML - MR;
    const CH  = SVG_H - MT - MB;

    const DX = 11;  // depth offset X
    const DY = -5;  // depth offset Y (negative = upward)

    const n   = data.length;
    const slotW = CW / Math.max(n, 1);
    const GAP   = Math.max(2, slotW * 0.18);
    const BW    = slotW - GAP;

    const scaleH = (v: number) => (v / (maxValue || 1)) * CH;

    const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

    return (
        <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onMouseLeave={onLeave}
        >
            <defs>
                <linearGradient id="gNormal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#5B9BD5" />
                    <stop offset="100%" stopColor="#1E5BB5" />
                </linearGradient>
                <linearGradient id="gPeak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#FFC844" />
                    <stop offset="100%" stopColor="#D4820A" />
                </linearGradient>
                <filter id="bShadow">
                    <feDropShadow dx="2" dy="3" stdDeviation="2.5" floodColor="rgba(30,58,95,0.2)" />
                </filter>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* Grid horizontal */}
            {yTicks.map((t) => {
                const gy = MT + CH - scaleH(t * maxValue);
                return (
                    <g key={t}>
                        <line x1={ML} y1={gy} x2={ML + CW + DX} y2={gy}
                            stroke={t === 0 ? C.borderH : '#E2E8F0'}
                            strokeWidth={t === 0 ? 1.5 : 0.8}
                            strokeDasharray={t === 0 ? 'none' : '5 3'} />
                        <text x={ML - 7} y={gy + 4} textAnchor="end" fontSize={8} fill={C.muted}
                            fontFamily="'Calibri', sans-serif">
                            {fmtSoles(maxValue * t).replace('S/ ', 'S/')}
                        </text>
                    </g>
                );
            })}

            {/* Línea suelo */}
            <line x1={ML} y1={MT + CH} x2={ML + CW + DX} y2={MT + CH}
                stroke={C.borderH} strokeWidth={1.5} />
            {/* Línea eje Y */}
            <line x1={ML} y1={MT} x2={ML} y2={MT + CH}
                stroke={C.borderH} strokeWidth={1} />

            {/* Barras 3D */}
            {data.map((d, i) => {
                const isPeak = d.desembolsoMensual === maxValue;
                const bH = scaleH(d.desembolsoMensual);
                const bX = ML + i * slotW + GAP / 2;
                const bY = MT + CH - bH;        // top of bar
                const bBot = MT + CH;           // bottom (floor)

                const frontFill = isPeak ? 'url(#gPeak)' : 'url(#gNormal)';
                const topFill   = isPeak ? '#FFE38A' : '#7DAED8';
                const sideFill  = isPeak ? '#A86200' : '#154E8C';

                return (
                    <g key={d.key} style={{ cursor: 'crosshair' }} filter="url(#bShadow)"
                        onMouseEnter={(e) => onEnter(e, d)}
                        onMouseMove={(e)  => onMove(e, d)}
                    >
                        {/* Cara derecha (lado) */}
                        <path
                            d={`M ${bX + BW} ${bY} L ${bX + BW + DX} ${bY + DY} L ${bX + BW + DX} ${bBot + DY} L ${bX + BW} ${bBot} Z`}
                            fill={sideFill} opacity={0.9}
                        />
                        {/* Cara superior */}
                        <path
                            d={`M ${bX} ${bY} L ${bX + BW} ${bY} L ${bX + BW + DX} ${bY + DY} L ${bX + DX} ${bY + DY} Z`}
                            fill={topFill}
                        />
                        {/* Cara frontal */}
                        <rect x={bX} y={bY} width={BW} height={bH} fill={frontFill} />

                        {/* Badge PICO */}
                        {isPeak && (
                            <>
                                <rect x={bX + BW / 2 - 14} y={bY - 18} width={28} height={13}
                                    rx={3} fill="#D4820A" />
                                <text x={bX + BW / 2} y={bY - 8}
                                    textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#fff"
                                    fontFamily="'Calibri', sans-serif">
                                    ▲ PICO
                                </text>
                            </>
                        )}

                        {/* Etiqueta eje X */}
                        <text x={bX + BW / 2} y={bBot + 14}
                            textAnchor="middle" fontSize={9} fill={C.navy} fontWeight={700}
                            fontFamily="'Calibri', sans-serif">
                            {d.diasCalendario}
                        </text>
                        <text x={bX + BW / 2} y={bBot + 25}
                            textAnchor="middle" fontSize={7.5} fill={C.muted}
                            fontFamily="'Calibri', sans-serif">
                            {d.label.split(' ').slice(0, 2).join(' ')}
                        </text>
                    </g>
                );
            })}

            {/* Título eje Y */}
            <text transform={`translate(12,${MT + CH / 2}) rotate(-90)`}
                textAnchor="middle" fontSize={9} fill={C.muted} fontWeight={600}
                fontFamily="'Calibri', sans-serif" letterSpacing="0.08em">
                MONTO DESEMBOLSO (S/)
            </text>
        </svg>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// CURVA S SVG INTERACTIVA
// ─────────────────────────────────────────────────────────────────────────────
interface SCurveProps {
    data: { label: string; acumulado: number; pct: number }[];
    onPointEnter: (e: React.MouseEvent<SVGElement>, d: { label: string; acumulado: number; pct: number }) => void;
    onPointLeave: () => void;
}

const SCurveChart: React.FC<SCurveProps> = ({ data, onPointEnter, onPointLeave }) => {
    const [hIdx, setHIdx] = useState<number | null>(null);

    const SVG_W = 920;
    const SVG_H = 320;
    const ML = 72, MR = 50, MT = 24, MB = 55;
    const CW = SVG_W - ML - MR;
    const CH = SVG_H - MT - MB;

    const n = data.length;
    const xStep = CW / Math.max(n - 1, 1);

    const toXY = (i: number, pct: number) => ({
        x: ML + i * xStep,
        y: MT + CH - (pct / 100) * CH,
    });

    // Construir path Bezier suave (curva S)
    const buildPath = () => {
        if (n === 0) return '';
        const pts = data.map((d, i) => toXY(i, d.pct));
        let path = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i - 1];
            const c = pts[i];
            const cpx = (p.x + c.x) / 2;
            path += ` C ${cpx} ${p.y} ${cpx} ${c.y} ${c.x} ${c.y}`;
        }
        return path;
    };

    const curvePath = buildPath();
    const fp = n > 0 ? toXY(0, data[0].pct) : null;
    const lp = n > 0 ? toXY(n - 1, data[n - 1].pct) : null;
    const areaPath = fp && lp
        ? `${curvePath} L ${lp.x} ${MT + CH} L ${fp.x} ${MT + CH} Z`
        : '';

    const yTicks = [0, 25, 50, 75, 100];

    return (
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.blue} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
                </linearGradient>
                <filter id="lineGlow">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <filter id="dotGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Grid horizontal */}
            {yTicks.map((t) => {
                const gy = MT + CH - (t / 100) * CH;
                return (
                    <g key={t}>
                        <line x1={ML} y1={gy} x2={ML + CW} y2={gy}
                            stroke={t === 0 ? C.borderH : '#E8EFF7'}
                            strokeWidth={t === 0 ? 1.5 : 0.8}
                            strokeDasharray={t === 0 ? 'none' : '5 3'} />
                        <text x={ML - 7} y={gy + 4} textAnchor="end" fontSize={9} fill={C.muted}
                            fontFamily="'Calibri', sans-serif">
                            {t}%
                        </text>
                    </g>
                );
            })}

            {/* Grid vertical fino */}
            {data.map((_, i) => {
                const gx = ML + i * xStep;
                return (
                    <line key={i} x1={gx} y1={MT} x2={gx} y2={MT + CH}
                        stroke="#EBF3FB" strokeWidth={0.8} />
                );
            })}

            {/* Líneas de ejes */}
            <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke={C.borderH} strokeWidth={1.2} />
            <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke={C.borderH} strokeWidth={1.2} />

            {/* Área bajo la curva */}
            {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

            {/* Sombra de la línea */}
            <path d={curvePath} fill="none" stroke={C.blueLight} strokeWidth={5}
                strokeLinecap="round" strokeLinejoin="round" opacity={0.3} />

            {/* Línea principal */}
            <path d={curvePath} fill="none" stroke={C.navy} strokeWidth={2.2}
                strokeLinecap="round" strokeLinejoin="round" filter="url(#lineGlow)" />

            {/* Puntos interactivos */}
            {data.map((d, i) => {
                const pt  = toXY(i, d.pct);
                const isH = hIdx === i;
                return (
                    <g key={i} style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => { setHIdx(i); onPointEnter(e, d); }}
                        onMouseLeave={() => { setHIdx(null); onPointLeave(); }}
                    >
                        {/* Área de hit ampliada */}
                        <circle cx={pt.x} cy={pt.y} r={16} fill="transparent" />

                        {/* Halo hover */}
                        {isH && (
                            <circle cx={pt.x} cy={pt.y} r={11}
                                fill="none" stroke={C.blue} strokeWidth={1.5} opacity={0.4} />
                        )}

                        {/* Punto */}
                        <circle cx={pt.x} cy={pt.y} r={isH ? 6 : 4}
                            fill={isH ? C.navy : C.white}
                            stroke={C.navy}
                            strokeWidth={2}
                            filter={isH ? 'url(#dotGlow)' : 'none'}
                            style={{ transition: 'r 0.12s' }}
                        />

                        {/* Etiqueta % */}
                        <text x={pt.x} y={pt.y - (isH ? 15 : 11)}
                            textAnchor="middle" fontSize={isH ? 9.5 : 8}
                            fontWeight={isH ? 800 : 600}
                            fill={isH ? C.navy : C.blue}
                            fontFamily="'Calibri', sans-serif"
                            style={{ transition: 'font-size 0.12s' }}>
                            {d.pct.toFixed(1)}%
                        </text>

                        {/* Etiqueta eje X */}
                        <text x={pt.x} y={MT + CH + 16}
                            textAnchor="middle" fontSize={8} fill={isH ? C.navy : C.muted}
                            fontWeight={isH ? 700 : 400}
                            fontFamily="'Calibri', sans-serif">
                            {d.label.split(' ')[0]}
                        </text>
                    </g>
                );
            })}

            {/* Título eje Y */}
            <text transform={`translate(11,${MT + CH / 2}) rotate(-90)`}
                textAnchor="middle" fontSize={9} fill={C.muted} fontWeight={600}
                fontFamily="'Calibri', sans-serif" letterSpacing="0.08em">
                % DESEMBOLSO ACUMULADO
            </text>
        </svg>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const CronogramaDesembolsos: React.FC<Props> = ({
    periodos,
    totalPresupuesto,
    valorizacionesMensuales,
    totalDias,
    diasPorMes,
    projectName = 'CRONOGRAMA DE DESEMBOLSOS',
    codigoProyecto = '',
    ubicacion = '',
    onClose,
}) => {
    const [vista, setVista]         = useState<Vista>('tabla');
    const [showInfo, setShowInfo]   = useState(false);
    const [tooltip,  setTooltip]    = useState<TooltipState | null>(null);
    const [cTooltip, setCTooltip]   = useState<CurveTooltipState | null>(null);
    const chartRef = useRef<HTMLDivElement>(null);

    // ── Montos totales ────────────────────────────────────────────────────────
    const adelantoEfectivoTotal   = totalPresupuesto * ADELANTO_EFECTIVO_PCT;
    const adelantoMaterialesTotal = totalPresupuesto * ADELANTO_MATERIALES_PCT;
    const totalAdelantoInicial    = adelantoEfectivoTotal + adelantoMaterialesTotal;
    const flujoTotal              = totalPresupuesto + totalAdelantoInicial;

    // ── Cálculo mensual (LÓGICA ORIGINAL SIN CAMBIOS) ────────────────────────
    const datosMensuales = useMemo<FilaMensual[]>(() => {
        let desembolsoAcumulado = totalAdelantoInicial;
        const totalDiasProyecto = Object.values(diasPorMes).reduce((a, b) => a + b, 0) || totalDias || 1;

        return periodos.map((p) => {
            const diasMes      = diasPorMes[p.key] ?? 0;
            const valorizacion = valorizacionesMensuales[p.key]?.monto ?? 0;
            const pctAvance    = valorizacionesMensuales[p.key]?.porcentaje ?? 0;

            const factorDias         = totalDiasProyecto > 0 ? diasMes / totalDiasProyecto : 0;
            const adelantoEfectivo   = adelantoEfectivoTotal   * factorDias;
            const adelantoMateriales = adelantoMaterialesTotal * factorDias;
            const totalAdelanto      = adelantoEfectivo + adelantoMateriales;
            const desembolsoMensual  = totalAdelanto + valorizacion;

            desembolsoAcumulado += desembolsoMensual;
            const pctDesembolso = flujoTotal > 0 ? (desembolsoAcumulado / flujoTotal) * 100 : 0;

            return {
                key:                  p.key,
                diasCalendario:       diasMes,
                diasBloqueCalendario: diasMes,
                adelantoEfectivo,
                adelantoMateriales,
                totalAdelanto,
                valorizacion,
                pctAvance,
                desembolsoMensual,
                desembolsoAcumulado,
                pctDesembolso,
                label: p.labelCal ?? p.label,
            };
        });
    }, [periodos, valorizacionesMensuales, diasPorMes, totalDias, totalAdelantoInicial,
        adelantoEfectivoTotal, adelantoMaterialesTotal, flujoTotal]);

    const maxDesembolsoMensual = useMemo(
        () => Math.max(...datosMensuales.map((d) => d.desembolsoMensual), 1),
        [datosMensuales]
    );
    const mesPico = useMemo(
        () => datosMensuales.find((d) => d.desembolsoMensual === maxDesembolsoMensual),
        [datosMensuales, maxDesembolsoMensual]
    );
    const totalValorizacion = useMemo(
        () => datosMensuales.reduce((s, d) => s + d.valorizacion, 0),
        [datosMensuales]
    );

    const curvaS = useMemo(() => {
        const raw       = datosMensuales.map((d) => ({ label: d.label, acumulado: d.desembolsoAcumulado, pct: d.pctDesembolso }));
        const lastPct   = raw[raw.length - 1]?.pct || 100;
        const scale     = lastPct > 0 ? 100 / lastPct : 1;   // factor para llevar el último a 100 %
        const lastAcum  = raw[raw.length - 1]?.acumulado || flujoTotal;
        const scaleAcum = lastAcum > 0 ? flujoTotal / lastAcum : 1;
        return raw.map((r, i) => ({
            label:     r.label,
            acumulado: i === raw.length - 1 ? flujoTotal          : r.acumulado * scaleAcum,
            pct:       i === raw.length - 1 ? 100                 : r.pct       * scale,
        }));
    }, [datosMensuales, flujoTotal]);

    // ── Handlers de tooltip ───────────────────────────────────────────────────
    const getOffset = (e: React.MouseEvent<SVGElement>) => {
        const rect = chartRef.current?.getBoundingClientRect();
        return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null;
    };

    const handleBarEnter = (e: React.MouseEvent<SVGElement>, d: FilaMensual) => {
        const o = getOffset(e); if (o) setTooltip({ ...o, data: d });
    };
    const handleBarMove  = (e: React.MouseEvent<SVGElement>, d: FilaMensual) => {
        const o = getOffset(e); if (o) setTooltip({ ...o, data: d });
    };
    const handleBarLeave = () => setTooltip(null);

    const handleCurveEnter = (e: React.MouseEvent<SVGElement>, d: { label: string; acumulado: number; pct: number }) => {
        const o = getOffset(e); if (o) setCTooltip({ ...o, data: d });
    };
    const handleCurveLeave = () => setCTooltip(null);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            background: 'rgba(10,20,40,0.55)', backdropFilter: 'blur(4px)',
            overflowY: 'auto', padding: '14px 8px',
        }}>
            <div style={{
                position: 'relative',
                background: C.white,
                width: '100%', maxWidth: 1340,
                minHeight: '92vh',
                display: 'flex', flexDirection: 'column',
                fontFamily: "'Segoe UI', 'Calibri', Arial, sans-serif",
                boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                borderRadius: 3,
                overflow: 'hidden',
            }}>

                {/* ══ CABECERA INSTITUCIONAL ══════════════════════════════════ */}
                <div style={{ background: C.navy, flexShrink: 0 }}>
                    {/* Franja multicolor */}
                    <div style={{ height: 3, background: 'linear-gradient(90deg,#F59E0B,#EF4444,#10B981,#3B82F6)' }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px' }}>
                        {/* Logo + título */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: 6,
                                background: 'rgba(255,255,255,0.1)',
                                border: '1.5px solid rgba(255,255,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                <DollarSign style={{ color: '#F59E0B', width: 20, height: 20 }} />
                            </div>
                            <div>
                                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 8.5, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase' }}>
                                    Proyecta PCL — Módulo Financiero
                                </div>
                                <div style={{ color: C.white, fontSize: 17, fontWeight: 800, letterSpacing: '0.04em', lineHeight: 1.15 }}>
                                    CRONOGRAMA DE DESEMBOLSOS
                                </div>
                                <div style={{ color: '#93C5FD', fontSize: 9.5, marginTop: 1.5 }}>
                                    Art. 155° del Reglamento de la Ley de Contrataciones del Estado
                                </div>
                            </div>
                        </div>

                        {/* Controles */}
                        <div style={{ display: 'flex', gap: 7 }}>
                            <button onClick={() => setShowInfo(!showInfo)} title="Información legal"
                                style={{ ...btnBase, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                                <Info style={{ width: 13, height: 13 }} />
                                <span>Info</span>
                            </button>
                            <button onClick={onClose}
                                style={{ ...btnBase, background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.3)' }}>
                                <X style={{ width: 13, height: 13 }} />
                                <span style={{ fontWeight: 700 }}>Cerrar</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ══ FICHA DEL PROYECTO ══════════════════════════════════════ */}
                <div style={{
                    background: C.surface,
                    borderBottom: `2px solid ${C.headerBg2}`,
                    padding: '8px 20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '5px 22px',
                }}>
                    <InfoRow label="Proyecto"            value={projectName} />
                    {codigoProyecto && <InfoRow label="I.E."    value={codigoProyecto} />}
                    {ubicacion      && <InfoRow label="Ubicación" value={ubicacion} />}
                    <InfoRow label="Presupuesto de Obra" value={fmtSoles(totalPresupuesto)} bold />
                    <InfoRow label="Plazo de Ejecución"  value={`${totalDias} DÍAS CALENDARIO`} />
                    <InfoRow label="Adelanto Total (30%)" value={fmtSoles(totalAdelantoInicial)} />
                </div>

                {/* ══ TARJETAS KPI ════════════════════════════════════════════ */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
                    borderBottom: `2px solid ${C.headerBg2}`,
                    background: C.white,
                }}>
                    <KpiCard color={C.navy}    icon={<FileText style={{ width: 15, height: 15 }} />}
                        label="Presupuesto de Obra"     value={fmtSoles(totalPresupuesto)}       sub="Monto contrato s/IGV" />
                    <KpiCard color="#1A7A3A"   icon={<DollarSign style={{ width: 15, height: 15 }} />}
                        label="Adelanto Directo 10%"    value={fmtSoles(adelantoEfectivoTotal)}   sub="Efectivo — col. (1)" />
                    <KpiCard color={C.blue}    icon={<Layers style={{ width: 15, height: 15 }} />}
                        label="Adelanto Materiales 20%" value={fmtSoles(adelantoMaterialesTotal)} sub="Materiales — col. (2)" />
                    <KpiCard color="#92400E"   icon={<TrendingUp style={{ width: 15, height: 15 }} />}
                        label="Flujo Total"             value={fmtSoles(flujoTotal)}              sub="Contrato + adelantos 30%" />
                    <KpiCard color={C.purple}  icon={<BarChart2 style={{ width: 15, height: 15 }} />}
                        label="Mes Pico"
                        value={mesPico ? fmtSoles(mesPico.desembolsoMensual) : '—'}
                        sub={mesPico?.label ?? '—'}
                        last />
                </div>

                {/* ══ NAVEGACIÓN DE VISTAS ════════════════════════════════════ */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '6px 20px',
                    borderBottom: `1px solid ${C.borderB}`,
                    background: C.surfaceAlt,
                }}>
                    <span style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, letterSpacing: '0.12em', marginRight: 8, textTransform: 'uppercase' }}>VISTA:</span>
                    <TabBtn active={vista === 'tabla'}   onClick={() => setVista('tabla')}   icon={<Table2  style={{ width: 12, height: 12 }} />} label="Tabla de Desembolsos" />
                    <TabBtn active={vista === 'grafico'} onClick={() => setVista('grafico')} icon={<BarChart2 style={{ width: 12, height: 12 }} />} label="Histograma 3D" />
                    <TabBtn active={vista === 'curvaS'}  onClick={() => setVista('curvaS')}  icon={<TrendingUp style={{ width: 12, height: 12 }} />} label="Curva S Acumulada" />
                </div>

                {/* ══ CONTENIDO PRINCIPAL ═════════════════════════════════════ */}
                <div style={{ flex: 1, overflow: 'auto' }}>

                    {/* ─── VISTA TABLA ─────────────────────────────────────── */}
                    {vista === 'tabla' && (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, fontFamily: "'Calibri','Segoe UI',sans-serif" }}>
                                <thead>
                                    {/* Fila de grupos */}
                                    <tr>
                                        <th rowSpan={2} style={thExcel({ textAlign: 'center', minWidth: 90, background: C.navy, color: C.white, borderColor: '#2A4F7C', fontSize: 10 })}>
                                            CALENDARIO<br />
                                            <span style={{ fontSize: 8.5, fontWeight: 400, opacity: 0.75 }}>Días</span>
                                        </th>
                                        <th colSpan={3} style={thExcel({ textAlign: 'center', background: '#1A4F80', color: C.white, borderLeft: `2px solid ${C.navy}`, borderRight: `2px solid ${C.navy}` })}>
                                            ADELANTOS
                                        </th>
                                        <th colSpan={2} style={thExcel({ textAlign: 'center', background: '#16426A', color: C.white, borderRight: `2px solid ${C.navy}` })}>
                                            VALORIZACIÓN
                                        </th>
                                        <th colSpan={2} style={thExcel({ textAlign: 'center', background: C.navy, color: C.white })}>
                                            DESEMBOLSOS Inc/IGV
                                        </th>
                                    </tr>
                                    {/* Fila sub-cabecera */}
                                    <tr style={{ background: C.headerBg }}>
                                        <th style={thExcel({ minWidth: 130, color: C.navy, borderLeft: `2px solid ${C.navyMid}` })}>
                                            EFECTIVO 10%<br />
                                            <span style={{ color: C.blue, fontWeight: 900 }}>(1)</span>
                                        </th>
                                        <th style={thExcel({ minWidth: 140, color: C.navy })}>
                                            MATERIALES 20%<br />
                                            <span style={{ color: C.blue, fontWeight: 900 }}>(2)</span>
                                        </th>
                                        <th style={thExcel({ minWidth: 130, color: C.navy, borderRight: `2px solid ${C.navyMid}` })}>
                                            TOTAL<br />
                                            <span style={{ color: C.blue, fontWeight: 900 }}>(1+2)</span>
                                        </th>
                                        <th style={thExcel({ minWidth: 148, color: C.navy })}>
                                            PARCIAL<br />PRESUPUESTO
                                        </th>
                                        <th style={thExcel({ minWidth: 80, color: C.navy, borderRight: `2px solid ${C.navyMid}` })}>
                                            %<br />AVANCE
                                        </th>
                                        <th style={thExcel({ minWidth: 148, color: C.navy })}>
                                            MONTO<br />DESEMBOLSO
                                        </th>
                                        <th style={thExcel({ minWidth: 98, color: C.navy })}>
                                            % DE<br />DESEMBOLSO
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* FILA 0: Adelanto inicial */}
                                    <tr style={{ background: C.greenBg }}>
                                        <td style={tdExcel({ textAlign: 'center', color: C.greenText, fontWeight: 900, fontSize: 16, borderLeft: `1px solid ${C.borderB}`, borderRight: `1px solid ${C.borderB}` })}>
                                            0
                                        </td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.greenText, fontWeight: 700, borderLeft: `2px solid ${C.greenBorder}` })}>{fmtSoles(adelantoEfectivoTotal)}</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.greenText, fontWeight: 700 })}>{fmtSoles(adelantoMaterialesTotal)}</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.greenText, fontWeight: 900, borderRight: `2px solid ${C.greenBorder}` })}>{fmtSoles(totalAdelantoInicial)}</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.muted, fontStyle: 'italic' })}>—</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.muted, fontStyle: 'italic', borderRight: `2px solid ${C.borderB}` })}>—</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.greenText, fontWeight: 900 })}>{fmtSoles(totalAdelantoInicial)}</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.greenText, fontWeight: 900 })}>
                                            {fmtPct(flujoTotal > 0 ? (totalAdelantoInicial / flujoTotal) * 100 : 0)}
                                        </td>
                                    </tr>

                                    {/* FILAS MENSUALES */}
                                    {datosMensuales.map((d, idx) => {
                                        const esPico = d.desembolsoMensual === maxDesembolsoMensual;
                                        const esPar  = idx % 2 === 0;
                                        const bg     = esPico ? C.amberBg : esPar ? C.white : C.rowAlt;
                                        return (
                                            <tr key={d.key} style={{ background: bg, transition: 'background 0.1s' }}
                                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#DBEAFE'; }}
                                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = bg; }}
                                            >
                                                <td style={tdExcel({ textAlign: 'center', fontWeight: 700, color: esPico ? C.amberText : C.navy, borderLeft: `1px solid ${C.borderB}` })}>
                                                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{d.diasCalendario}</div>
                                                    <div style={{ fontSize: 8, color: C.muted, fontWeight: 400, letterSpacing: '0.02em', marginTop: 1 }}>{d.label}</div>
                                                </td>
                                                <td style={tdExcel({ textAlign: 'right', color: '#166534', borderLeft: `2px solid ${C.borderB}` })}>{fmtSoles(d.adelantoEfectivo)}</td>
                                                <td style={tdExcel({ textAlign: 'right', color: C.blue })}>{fmtSoles(d.adelantoMateriales)}</td>
                                                <td style={tdExcel({ textAlign: 'right', color: C.text, fontWeight: 600, borderRight: `2px solid ${C.borderB}` })}>{fmtSoles(d.totalAdelanto)}</td>
                                                <td style={tdExcel({ textAlign: 'right', color: d.valorizacion > 0 ? '#1D4ED8' : C.muted, fontWeight: d.valorizacion > 0 ? 700 : 400 })}>
                                                    {fmtSoles(d.valorizacion)}
                                                </td>
                                                <td style={tdExcel({ textAlign: 'right', color: '#6D28D9', fontWeight: 600, borderRight: `2px solid ${C.borderB}` })}>
                                                    {fmtPct(d.pctAvance)}
                                                </td>
                                                <td style={tdExcel({ textAlign: 'right', fontWeight: 700, color: esPico ? C.amberText : C.text })}>
                                                    {fmtSoles(d.desembolsoMensual)}
                                                    {esPico && (
                                                        <span style={{ marginLeft: 5, fontSize: 8, background: '#D97706', color: C.white, padding: '1px 4px', borderRadius: 2, fontWeight: 700, verticalAlign: 'middle' }}>
                                                            PICO
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={tdExcel({ textAlign: 'right', color: C.navy, fontWeight: 700 })}>
                                                    {fmtPct(d.pctDesembolso)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* FILA PARCIAL */}
                                    <tr style={{ background: C.surfaceAlt }}>
                                        <td style={tdExcel({ textAlign: 'center', color: C.navy, fontWeight: 800, fontSize: 10, letterSpacing: '0.07em', borderLeft: `1px solid ${C.borderB}` })}>PARCIAL</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.muted, fontStyle: 'italic', borderLeft: `2px solid ${C.borderB}` })}>—</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.muted, fontStyle: 'italic' })}>—</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.muted, fontStyle: 'italic', borderRight: `2px solid ${C.borderB}` })}>—</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.navy, fontWeight: 700 })}>{fmtSoles(totalValorizacion)}</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.navy, borderRight: `2px solid ${C.borderB}` })}>100.00%</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.navy, fontWeight: 700 })}>{fmtSoles(totalValorizacion)}</td>
                                        <td style={tdExcel({ textAlign: 'right', color: C.muted, fontStyle: 'italic' })}>—</td>
                                    </tr>
                                </tbody>

                                <tfoot>
                                    {/* FILA TOTAL */}
                                    <tr style={{ background: C.navy, fontWeight: 700, fontSize: 12 }}>
                                        <td style={{ ...tdExcel(), textAlign: 'center', color: C.white, fontWeight: 900, letterSpacing: '0.09em', borderLeft: `1px solid ${C.navyMid}`, borderColor: C.navyMid }}>
                                            TOTAL
                                        </td>
                                        <td style={{ ...tdExcel(), textAlign: 'right', color: '#A7F3D0', borderLeft: `2px solid ${C.navyMid}`, borderColor: C.navyMid }}>{fmtSoles(adelantoEfectivoTotal)}</td>
                                        <td style={{ ...tdExcel(), textAlign: 'right', color: '#93C5FD', borderColor: C.navyMid }}>{fmtSoles(adelantoMaterialesTotal)}</td>
                                        <td style={{ ...tdExcel(), textAlign: 'right', color: C.white, borderRight: `2px solid rgba(255,255,255,0.15)`, borderColor: C.navyMid }}>{fmtSoles(totalAdelantoInicial)}</td>
                                        <td style={{ ...tdExcel(), textAlign: 'right', color: '#BFDBFE', borderColor: C.navyMid }}>{fmtSoles(totalPresupuesto)}</td>
                                        <td style={{ ...tdExcel(), textAlign: 'right', color: '#C4B5FD', borderRight: `2px solid rgba(255,255,255,0.15)`, borderColor: C.navyMid }}>100.00%</td>
                                        <td style={{ ...tdExcel(), textAlign: 'right', color: '#FDE68A', fontSize: 13, borderColor: C.navyMid }}>{fmtSoles(flujoTotal)}</td>
                                        <td style={{ ...tdExcel(), textAlign: 'right', color: '#6EE7B7', borderColor: C.navyMid }}>100.00%</td>
                                    </tr>

                                    {/* Subtítulos */}
                                    <tr style={{ background: '#253F5E' }}>
                                        <td colSpan={8} style={{ padding: '7px 16px', fontSize: 10.5, borderTop: `1px solid ${C.navyMid}` }}>
                                            <span style={{ color: 'rgba(255,255,255,0.55)', marginRight: 24 }}>
                                                TOTAL PRESUPUESTO DE OBRA: <strong style={{ color: C.white }}>{fmtSoles(totalPresupuesto)}</strong>
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.55)', marginRight: 24 }}>
                                                Adelanto Directo 10%: <strong style={{ color: '#6EE7B7' }}>{fmtSoles(adelantoEfectivoTotal)}</strong>
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                                                Adelanto Materiales 20%: <strong style={{ color: '#93C5FD' }}>{fmtSoles(adelantoMaterialesTotal)}</strong>
                                            </span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* ─── VISTA HISTOGRAMA 3D ─────────────────────────────── */}
                    {vista === 'grafico' && (
                        <div style={{ padding: 24, background: C.surface, position: 'relative' }} ref={chartRef}>
                            <div style={{ marginBottom: 14 }}>
                                <h3 style={{ fontSize: 11.5, fontWeight: 800, color: C.navy, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                                    GAUSS DE DESEMBOLSOS MENSUALES
                                </h3>
                                <p style={{ fontSize: 10, color: C.muted, margin: '3px 0 0 0' }}>
                                    Desembolso mensual (Adelantos + Valorización). Coloque el cursor sobre cada barra para ver el detalle completo.
                                </p>
                            </div>

                            <Histogram3D
                                data={datosMensuales}
                                maxValue={maxDesembolsoMensual}
                                onEnter={handleBarEnter}
                                onMove={handleBarMove}
                                onLeave={handleBarLeave}
                            />

                            {/* Tooltip barra */}
                            {tooltip && (
                                <div style={{
                                    position: 'absolute',
                                    left: Math.min(tooltip.x + 14, (chartRef.current?.clientWidth ?? 800) - 250),
                                    top: Math.max(tooltip.y - 30, 10),
                                    background: C.white,
                                    border: `1.5px solid ${C.headerBg2}`,
                                    borderRadius: 6,
                                    padding: '10px 14px',
                                    boxShadow: '0 8px 28px rgba(30,58,95,0.18)',
                                    fontSize: 11,
                                    zIndex: 200,
                                    minWidth: 228,
                                    pointerEvents: 'none',
                                }}>
                                    <div style={{ color: C.navy, fontWeight: 800, fontSize: 12, paddingBottom: 6, marginBottom: 6, borderBottom: `1px solid ${C.headerBg}` }}>
                                        📅 {tooltip.data.label} — {tooltip.data.diasCalendario} días
                                    </div>
                                    <TipRow label="Adelanto Efectivo 10%"   value={fmtSoles(tooltip.data.adelantoEfectivo)}   color="#166534" />
                                    <TipRow label="Adelanto Materiales 20%" value={fmtSoles(tooltip.data.adelantoMateriales)} color={C.blue} />
                                    <TipRow label="Total Adelantos (1+2)"   value={fmtSoles(tooltip.data.totalAdelanto)}      color={C.navy} bold />
                                    <div style={{ borderTop: `1px solid ${C.borderB}`, margin: '6px 0' }} />
                                    <TipRow label="Valorización Parcial" value={fmtSoles(tooltip.data.valorizacion)} color="#1D4ED8" />
                                    <TipRow label="% Avance"             value={fmtPct(tooltip.data.pctAvance)}        color="#6D28D9" />
                                    <div style={{ borderTop: `1px solid ${C.borderB}`, margin: '6px -14px 0', padding: '7px 14px 0', background: C.surfaceAlt, borderRadius: '0 0 6px 6px' }}>
                                        <TipRow label="DESEMBOLSO MENSUAL"   value={fmtSoles(tooltip.data.desembolsoMensual)} color={C.navy} bold />
                                        <TipRow label="% Desembolso Acum." value={fmtPct(tooltip.data.pctDesembolso)}         color={C.blue} />
                                    </div>
                                </div>
                            )}

                            {/* Leyenda */}
                            <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
                                {[
                                    { g: ['#5B9BD5', '#1E5BB5'], l: 'Desembolso Mensual' },
                                    { g: ['#FFC844', '#D4820A'], l: 'Mes Pico' },
                                ].map(({ g, l }) => (
                                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: C.muted }}>
                                        <div style={{ width: 14, height: 11, background: `linear-gradient(180deg,${g[0]},${g[1]})`, borderRadius: 2 }} />
                                        {l}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ─── VISTA CURVA S ───────────────────────────────────── */}
                    {vista === 'curvaS' && (
                        <div style={{ padding: 24, background: C.surface, position: 'relative' }} ref={chartRef}>
                            <div style={{ marginBottom: 14 }}>
                                <h3 style={{ fontSize: 11.5, fontWeight: 800, color: C.navy, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                                    CURVA S — DESEMBOLSO ACUMULADO (%)
                                </h3>
                                <p style={{ fontSize: 10, color: C.muted, margin: '3px 0 0 0' }}>
                                    Progresión acumulada sobre el flujo total. Pase el cursor sobre cada punto para detalles.
                                </p>
                            </div>


                            <SCurveChart
                                data={curvaS}
                                onPointEnter={handleCurveEnter}
                                onPointLeave={handleCurveLeave}
                            />

                            {/* Tooltip curva S */}
                            {cTooltip && (
                                <div style={{
                                    position: 'absolute',
                                    left: Math.min(cTooltip.x + 14, (chartRef.current?.clientWidth ?? 800) - 230),
                                    top: Math.max(cTooltip.y - 30, 10),
                                    background: C.white,
                                    border: `1.5px solid ${C.headerBg2}`,
                                    borderRadius: 6,
                                    padding: '10px 14px',
                                    boxShadow: '0 8px 28px rgba(30,58,95,0.18)',
                                    fontSize: 11,
                                    zIndex: 200,
                                    minWidth: 210,
                                    pointerEvents: 'none',
                                }}>
                                    <div style={{ color: C.navy, fontWeight: 800, fontSize: 12, paddingBottom: 6, marginBottom: 6, borderBottom: `1px solid ${C.headerBg}` }}>
                                        📊 {cTooltip.data.label}
                                    </div>
                                    <TipRow label="Desembolso Acumulado" value={fmtSoles(cTooltip.data.acumulado)} color={C.blue} bold />
                                    <TipRow label="% Avance Acumulado"   value={fmtPct(cTooltip.data.pct)}         color={C.navy} bold />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ══ FOOTER LEGAL ════════════════════════════════════════════ */}
                <div style={{
                    borderTop: `2px solid ${C.headerBg2}`,
                    background: C.surfaceAlt,
                    padding: '7px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                    flexWrap: 'wrap',
                    gap: 8,
                }}>
                    <p style={{ fontSize: 9.5, color: C.muted, margin: 0, fontStyle: 'italic', maxWidth: '80%' }}>
                        * Porcentajes máximos de Adelanto según Artículo 155° del Reglamento de la Ley de Contrataciones del Estado.
                        Las Bases establecerán el otorgamiento y el porcentaje final de dichos adelantos.
                    </p>
                    <p style={{ fontSize: 9.5, color: '#94A3B8', margin: 0, whiteSpace: 'nowrap' }}>
                        Proyecta PCL © {new Date().getFullYear()} — Módulo Financiero
                    </p>
                </div>

            </div>
        </div>
    );
};

export default CronogramaDesembolsos;