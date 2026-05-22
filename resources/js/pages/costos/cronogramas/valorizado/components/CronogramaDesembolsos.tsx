import React, { useState, useMemo, useRef } from 'react';
import {
    X, TrendingUp, DollarSign, Download, Printer,
    ChevronDown, ChevronUp, Info, BarChart2, Table2,
    ArrowRight, Calendar, Layers, FileText
} from 'lucide-react';
import { Periodo } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
    periodos: Periodo[];
    totalPresupuesto: number;
    valorizacionesMensuales: Record<string, { monto: number; porcentaje: number }>;
    totalDias: number;
    diasPorMes: Record<string, number>;
    /** Nombre del proyecto (opcional, para encabezado) */
    projectName?: string;
    /** Nro I.E. / código de proyecto (opcional) */
    codigoProyecto?: string;
    /** Ubicación del proyecto */
    ubicacion?: string;
    onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES REGLAMENTARIAS (Art. 155° - Ley de Contrataciones del Estado)
// ─────────────────────────────────────────────────────────────────────────────
const ADELANTO_EFECTIVO_PCT   = 0.10; // 10%  → col (1)
const ADELANTO_MATERIALES_PCT = 0.20; // 20%  → col (2)

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────
const fmtSoles = (v: number) =>
    `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtSolesCompact = (v: number) =>
    `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────
type Vista = 'tabla' | 'grafico' | 'curvaS';

interface FilaMensual {
    key: string;
    diasCalendario: number;        // días del periodo dentro del proyecto
    diasBloqueCalendario: number;  // días totales del mes calendario
    /** col (1) Adelanto efectivo distribuido */
    adelantoEfectivo: number;
    /** col (2) Adelanto materiales distribuido */
    adelantoMateriales: number;
    /** col (1+2) */
    totalAdelanto: number;
    /** Valorización parcial del mes */
    valorizacion: number;
    /** % de avance mensual */
    pctAvance: number;
    /** Desembolso mensual = adelantos + valorización */
    desembolsoMensual: number;
    /** Desembolso acumulado */
    desembolsoAcumulado: number;
    /** % desembolso acumulado */
    pctDesembolso: number;
    /** Label para mostrar */
    label: string;
}

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
    const [vista, setVista]           = useState<Vista>('tabla');
    const [showInfo, setShowInfo]     = useState(false);
    const tableRef = useRef<HTMLDivElement>(null);

    //  Montos de adelanto totales 
    const adelantoEfectivoTotal   = totalPresupuesto * ADELANTO_EFECTIVO_PCT;
    const adelantoMaterialesTotal = totalPresupuesto * ADELANTO_MATERIALES_PCT;
    const totalAdelantoInicial    = adelantoEfectivoTotal + adelantoMaterialesTotal;

    // Flujo total = contrato + adelantos 
    const flujoTotal = totalPresupuesto + totalAdelantoInicial;

    //  Cálculo por mes
const datosMensuales = useMemo<FilaMensual[]>(() => {
    // El acumulado empieza con el adelanto inicial (ya pagado en la fila 0)
    let desembolsoAcumulado = totalAdelantoInicial;
    const totalDiasProyecto = Object.values(diasPorMes).reduce((a, b) => a + b, 0) || totalDias || 1;

    return periodos.map((p) => {
        const diasMes        = diasPorMes[p.key] ?? 0;
        const valorizacion   = valorizacionesMensuales[p.key]?.monto ?? 0;
        const pctAvance      = valorizacionesMensuales[p.key]?.porcentaje ?? 0;

        // Distribución proporcional de adelantos 
        const factorDias         = totalDiasProyecto > 0 ? diasMes / totalDiasProyecto : 0;
        const adelantoEfectivo   = adelantoEfectivoTotal   * factorDias;
        const adelantoMateriales = adelantoMaterialesTotal * factorDias;
        const totalAdelanto      = adelantoEfectivo + adelantoMateriales;
        
        // 🔥 CORRECCIÓN: El desembolso mensual es SOLO la valorización
        // El adelanto ya se pagó completo en la fila 0, NO se vuelve a pagar cada mes
        const desembolsoMensual = valorizacion;  // ← SOLO VALORIZACIÓN

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
}, [periodos, valorizacionesMensuales, diasPorMes, totalDias, totalAdelantoInicial, adelantoEfectivoTotal, adelantoMaterialesTotal, flujoTotal]);

    // ── Estadísticas rápidas ──────────────────────────────────────────────────
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

    // ── Curva S (acumulado) ───────────────────────────────────────────────────
    const curvaS = useMemo(() => {
        return datosMensuales.map((d) => ({
            label: d.label,
            acumulado: d.desembolsoAcumulado,
            pct: d.pctDesembolso,
        }));
    }, [datosMensuales]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-4 px-2">
            <div
                className="relative bg-white w-full rounded-none shadow-2xl flex flex-col"
                style={{ maxWidth: '1280px', minHeight: '90vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}
            >
                {/* ══════════════════════════════════════════════════════════
                    BANDA SUPERIOR INSTITUCIONAL
                ══════════════════════════════════════════════════════════ */}
                <div
                    className="flex-none"
                    style={{
                        background: 'linear-gradient(90deg, #0a2342 0%, #1a3a5c 60%, #1e4976 100%)',
                        padding: '0',
                    }}
                >
                    {/* Franja decorativa superior */}
                    <div style={{ height: '4px', background: 'linear-gradient(90deg, #f59e0b, #ef4444, #10b981, #3b82f6)' }} />

                    <div className="flex items-center justify-between px-6 py-4">
                        {/* Logo + Título */}
                        <div className="flex items-center gap-4">
                            <div
                                style={{
                                    width: 48, height: 48,
                                    background: 'rgba(255,255,255,0.12)',
                                    border: '1.5px solid rgba(255,255,255,0.25)',
                                    borderRadius: 8,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <DollarSign style={{ color: '#f59e0b', width: 26, height: 26 }} />
                            </div>
                            <div>
                                <div style={{ color: '#94a3b8', fontSize: 10, letterSpacing: '0.15em', fontWeight: 600, textTransform: 'uppercase' }}>
                                    Proyecta PCL — Módulo Financiero
                                </div>
                                <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, letterSpacing: '0.03em', lineHeight: 1.2 }}>
                                    CRONOGRAMA DE DESEMBOLSOS
                                </div>
                                <div style={{ color: '#60a5fa', fontSize: 11, marginTop: 2 }}>
                                </div>
                            </div>
                        </div>

                        {/* Controles */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowInfo(!showInfo)}
                                title="Información"
                                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '6px 10px', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                            >
                                <Info style={{ width: 14, height: 14 }} />
                            </button>
                            <button
                                onClick={onClose}
                                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '6px 10px', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                            >
                                <X style={{ width: 14, height: 14 }} />
                                <span style={{ fontWeight: 600 }}>Cerrar</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════
                    FICHA DEL PROYECTO
                ══════════════════════════════════════════════════════════ */}
                <div
                    style={{
                        background: '#f8fafc',
                        borderBottom: '2px solid #e2e8f0',
                        padding: '10px 24px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '8px 24px',
                    }}
                >
                    <FichaRow label="PROYECTO" value={projectName} />
                    {codigoProyecto && <FichaRow label="I.E." value={codigoProyecto} />}
                    {ubicacion && <FichaRow label="UBICACIÓN" value={ubicacion} />}
                    <FichaRow label="PRESUPUESTO DE OBRA" value={fmtSoles(totalPresupuesto)} highlight />
                    <FichaRow label="PLAZO DE EJECUCIÓN" value={`${totalDias} DÍAS CALENDARIO`} />
                    <FichaRow label="ADELANTO TOTAL (30%)" value={fmtSoles(totalAdelantoInicial)} />
                </div>

                {/* ══════════════════════════════════════════════════════════
                    TARJETAS KPI
                ══════════════════════════════════════════════════════════ */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 0,
                        borderBottom: '2px solid #e2e8f0',
                        background: '#fff',
                    }}
                >
                    <KpiCard
                        color="#0a2342"
                        label="PRESUPUESTO OBRA"
                        value={fmtSolesCompact(totalPresupuesto)}
                        sub="Monto de contrato s/IGV"
                        icon={<FileText style={{ width: 18, height: 18 }} />}
                    />
                    <KpiCard
                        color="#15803d"
                        label="ADELANTO DIRECTO 10%"
                        value={fmtSolesCompact(adelantoEfectivoTotal)}
                        sub="Efectivo — col. (1)"
                        icon={<DollarSign style={{ width: 18, height: 18 }} />}
                    />
                    <KpiCard
                        color="#1d4ed8"
                        label="ADELANTO MATERIALES 20%"
                        value={fmtSolesCompact(adelantoMaterialesTotal)}
                        sub="Materiales — col. (2)"
                        icon={<Layers style={{ width: 18, height: 18 }} />}
                    />
                    <KpiCard
                        color="#b45309"
                        label="FLUJO TOTAL (contrato + adel.)"
                        value={fmtSolesCompact(flujoTotal)}
                        sub={`30.00% adelantos`}
                        icon={<TrendingUp style={{ width: 18, height: 18 }} />}
                    />
                    <KpiCard
                        color="#7c3aed"
                        label="MES PICO"
                        value={mesPico ? fmtSolesCompact(mesPico.desembolsoMensual) : '—'}
                        sub={mesPico?.label ?? '—'}
                        icon={<BarChart2 style={{ width: 18, height: 18 }} />}
                    />
                </div>

                {/* ══════════════════════════════════════════════════════════
                    BARRA DE NAVEGACIÓN DE VISTAS
                ══════════════════════════════════════════════════════════ */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '8px 24px',
                        borderBottom: '1px solid #e2e8f0',
                        background: '#f1f5f9',
                    }}
                >
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginRight: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>VISTA:</span>
                    <TabBtn active={vista === 'tabla'}   onClick={() => setVista('tabla')}   icon={<Table2 style={{ width: 13, height: 13 }} />}   label="Tabla de Desembolsos" />
                    <TabBtn active={vista === 'grafico'} onClick={() => setVista('grafico')} icon={<BarChart2 style={{ width: 13, height: 13 }} />} label="Histograma Mensual" />
                    <TabBtn active={vista === 'curvaS'}  onClick={() => setVista('curvaS')}  icon={<TrendingUp style={{ width: 13, height: 13 }} />} label="Curva S Acumulada" />
                </div>

                {/* ══════════════════════════════════════════════════════════
                    CONTENIDO PRINCIPAL
                ══════════════════════════════════════════════════════════ */}
                <div className="flex-1 overflow-auto" ref={tableRef}>

                    {/* ─── VISTA: TABLA ────────────────────────────────────── */}
                    {vista === 'tabla' && (
                        <div style={{ overflowX: 'auto' }}>
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: 12,
                                    fontFamily: "'DM Mono', 'Consolas', monospace",
                                }}
                            >
                                {/* ── CABECERA GRUPO ── */}
                                <thead>
                                    <tr style={{ background: '#0a2342', color: '#fff' }}>
                                        <th rowSpan={2} style={th({ textAlign: 'center', minWidth: 100, borderRight: '1px solid #1e3a5f' })}>
                                            CALENDARIO
                                        </th>
                                        <th colSpan={3} style={{ ...th(), textAlign: 'center', borderRight: '1px solid #1e3a5f', background: '#0d2d4d' }}>
                                            ADELANTOS
                                        </th>
                                        <th colSpan={2} style={{ ...th(), textAlign: 'center', borderRight: '1px solid #1e3a5f', background: '#0f3460' }}>
                                            VALORIZACIÓN
                                        </th>
                                        <th colSpan={2} style={{ ...th(), textAlign: 'center', background: '#0f3460' }}>
                                            DESEMBOLSOS Inc/IGV
                                        </th>
                                    </tr>
                                    <tr style={{ background: '#1a3a5c', color: '#cbd5e1', fontSize: 10 }}>
                                        <th style={th({ minWidth: 120, borderRight: '1px solid #2a4a6c' })}>EFECTIVO 10%<br /><span style={{ color: '#60a5fa' }}>(1)</span></th>
                                        <th style={th({ minWidth: 130, borderRight: '1px solid #2a4a6c' })}>MATERIALES 20%<br /><span style={{ color: '#60a5fa' }}>(2)</span></th>
                                        <th style={th({ minWidth: 120, borderRight: '1px solid #2a4a6c' })}>TOTAL<br /><span style={{ color: '#60a5fa' }}>(1+2)</span></th>
                                        <th style={th({ minWidth: 140, borderRight: '1px solid #2a4a6c' })}>PARCIAL<br />PRESUPUESTO</th>
                                        <th style={th({ minWidth: 80, borderRight: '1px solid #2a4a6c' })}>%<br />AVANCE</th>
                                        <th style={th({ minWidth: 140, borderRight: '1px solid #2a4a6c' })}>MONTO<br />DESEMBOLSO</th>
                                        <th style={th({ minWidth: 90 })}>% DE<br />DESEMBOLSO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* FILA 0: Adelanto Inicial */}
                                    <tr style={{ background: '#ecfdf5', fontWeight: 700 }}>
                                        <td style={td({ textAlign: 'center', color: '#065f46', fontWeight: 800, letterSpacing: '0.05em' })}>0</td>
                                        <td style={td({ textAlign: 'right', color: '#065f46' })}>{fmtSoles(adelantoEfectivoTotal)}</td>
                                        <td style={td({ textAlign: 'right', color: '#065f46' })}>{fmtSoles(adelantoMaterialesTotal)}</td>
                                        <td style={td({ textAlign: 'right', color: '#065f46', fontWeight: 800 })}>{fmtSoles(totalAdelantoInicial)}</td>
                                        <td style={td({ textAlign: 'right', color: '#94a3b8' })}>—</td>
                                        <td style={td({ textAlign: 'right', color: '#94a3b8' })}>—</td>
                                        <td style={td({ textAlign: 'right', color: '#065f46', fontWeight: 800 })}>{fmtSoles(totalAdelantoInicial)}</td>
                                        <td style={td({ textAlign: 'right', color: '#065f46', fontWeight: 800 })}>
                                            {fmtPct(flujoTotal > 0 ? (totalAdelantoInicial / flujoTotal) * 100 : 0)}
                                        </td>
                                    </tr>

                                    {/* FILAS MENSUALES */}
                                    {datosMensuales.map((d, idx) => {
                                        const esPico = d.desembolsoMensual === maxDesembolsoMensual;
                                        const esPar  = idx % 2 === 0;
                                        return (
                                            <tr
                                                key={d.key}
                                                style={{
                                                    background: esPico ? '#fffbeb' : esPar ? '#fff' : '#f8fafc',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; }}
                                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = esPico ? '#fffbeb' : esPar ? '#fff' : '#f8fafc'; }}
                                            >
                                                <td style={td({ textAlign: 'center', fontWeight: 700, color: '#1e293b', fontSize: 11 })}>
                                                    {d.diasCalendario}
                                                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400 }}>{d.label}</div>
                                                </td>
                                                <td style={td({ textAlign: 'right', color: '#166534' })}>{fmtSoles(d.adelantoEfectivo)}</td>
                                                <td style={td({ textAlign: 'right', color: '#1d4ed8' })}>{fmtSoles(d.adelantoMateriales)}</td>
                                                <td style={td({ textAlign: 'right', fontWeight: 600, color: '#334155' })}>{fmtSoles(d.totalAdelanto)}</td>
                                                <td style={td({ textAlign: 'right', color: d.valorizacion > 0 ? '#1d4ed8' : '#94a3b8', fontWeight: d.valorizacion > 0 ? 700 : 400 })}>
                                                    {fmtSoles(d.valorizacion)}
                                                </td>
                                                <td style={td({ textAlign: 'right', color: '#7c3aed', fontWeight: 600 })}>
                                                    {fmtPct(d.pctAvance)}
                                                </td>
                                                <td style={td({ textAlign: 'right', fontWeight: 700, color: esPico ? '#b45309' : '#0f172a', fontSize: esPico ? 12.5 : 12 })}>
                                                    {fmtSoles(d.desembolsoMensual)}
                                                    {esPico && <span style={{ marginLeft: 4, fontSize: 9, background: '#f59e0b', color: '#fff', padding: '1px 4px', borderRadius: 3 }}>PICO</span>}
                                                </td>
                                                <td style={td({ textAlign: 'right', fontWeight: 700, color: '#0a2342' })}>
                                                    {fmtPct(d.pctDesembolso)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* FILA PARCIAL (totales mensuales) */}
                                    <tr style={{ background: '#f1f5f9', fontStyle: 'italic', color: '#64748b' }}>
                                        <td style={td({ textAlign: 'center', fontWeight: 700 })}>PARCIAL</td>
                                        <td style={td({ textAlign: 'right' })}>—</td>
                                        <td style={td({ textAlign: 'right' })}>—</td>
                                        <td style={td({ textAlign: 'right' })}>—</td>
                                        <td style={td({ textAlign: 'right' })}>{fmtSoles(totalValorizacion)}</td>
                                        <td style={td({ textAlign: 'right' })}>100.00%</td>
                                        <td style={td({ textAlign: 'right' })}>{fmtSoles(totalValorizacion)}</td>
                                        <td style={td({ textAlign: 'right' })}>—</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    {/* TOTALES */}
                                    <tr style={{ background: '#0a2342', color: '#fff', fontWeight: 800, fontSize: 12.5 }}>
                                        <td style={{ ...td(), textAlign: 'center', letterSpacing: '0.08em' }}>TOTAL</td>
                                        <td style={{ ...td(), textAlign: 'right' }}>{fmtSoles(adelantoEfectivoTotal)}</td>
                                        <td style={{ ...td(), textAlign: 'right' }}>{fmtSoles(adelantoMaterialesTotal)}</td>
                                        <td style={{ ...td(), textAlign: 'right' }}>{fmtSoles(totalAdelantoInicial)}</td>
                                        <td style={{ ...td(), textAlign: 'right' }}>{fmtSoles(totalPresupuesto)}</td>
                                        <td style={{ ...td(), textAlign: 'right', color: '#60a5fa' }}>100.00%</td>
                                        <td style={{ ...td(), textAlign: 'right', color: '#f59e0b' }}>{fmtSoles(flujoTotal)}</td>
                                        <td style={{ ...td(), textAlign: 'right', color: '#34d399' }}>100.00%</td>
                                    </tr>
                                    {/* Subtotales */}
                                    <tr style={{ background: '#1a3a5c', color: '#94a3b8', fontSize: 11 }}>
                                        <td colSpan={8} style={{ padding: '8px 12px' }}>
                                            <span style={{ marginRight: 24 }}>
                                                TOTAL PRESUPUESTO DE OBRA: <strong style={{ color: '#fff' }}>{fmtSoles(totalPresupuesto)}</strong>
                                            </span>
                                            <span style={{ marginRight: 24 }}>
                                                Adelanto Directo 10%: <strong style={{ color: '#34d399' }}>{fmtSoles(adelantoEfectivoTotal)}</strong>
                                            </span>
                                            <span>
                                                Adelanto Materiales 20%: <strong style={{ color: '#60a5fa' }}>{fmtSoles(adelantoMaterialesTotal)}</strong>
                                            </span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* ─── VISTA: HISTOGRAMA ───────────────────────────────── */}
                    {vista === 'grafico' && (
                        <div style={{ padding: '24px', background: '#f8fafc', minHeight: 400 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0a2342', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
                                HISTOGRAMA DE DESEMBOLSOS MENSUALES — Curva de Caja
                            </h3>

                            {/* Eje Y labels */}
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 280 }}>
                                {/* Eje Y */}
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', alignItems: 'flex-end', paddingBottom: 28 }}>
                                    {[100, 80, 60, 40, 20, 0].map((pct) => (
                                        <span key={pct} style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>
                                            {fmtSolesCompact((maxDesembolsoMensual * pct) / 100)}
                                        </span>
                                    ))}
                                </div>

                                {/* Barras */}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%', paddingBottom: 0, position: 'relative' }}>
                                    {/* Líneas guía horizontales */}
                                    {[20, 40, 60, 80].map((pct) => (
                                        <div
                                            key={pct}
                                            style={{
                                                position: 'absolute',
                                                left: 0, right: 0,
                                                bottom: `calc(28px + ${pct}% - 28px * ${pct / 100})`,
                                                borderTop: '1px dashed #e2e8f0',
                                                pointerEvents: 'none',
                                            }}
                                        />
                                    ))}

                                    {datosMensuales.map((d) => {
                                        const alturaPct = maxDesembolsoMensual > 0
                                            ? (d.desembolsoMensual / maxDesembolsoMensual) * 100
                                            : 0;
                                        const esPico    = d.desembolsoMensual === maxDesembolsoMensual;
                                        return (
                                            <div
                                                key={d.key}
                                                title={`${d.label}: ${fmtSoles(d.desembolsoMensual)}`}
                                                style={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'flex-end',
                                                    height: '100%',
                                                    cursor: 'default',
                                                }}
                                            >
                                                {/* Barra adelantos */}
                                                <div
                                                    style={{
                                                        width: '100%',
                                                        height: `${Math.max(alturaPct, 2)}%`,
                                                        background: esPico
                                                            ? 'linear-gradient(180deg, #f59e0b, #d97706)'
                                                            : 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
                                                        borderRadius: '3px 3px 0 0',
                                                        boxShadow: esPico ? '0 0 8px rgba(245,158,11,0.4)' : 'none',
                                                        transition: 'opacity 0.15s',
                                                        position: 'relative',
                                                    }}
                                                >
                                                    {esPico && (
                                                        <div style={{
                                                            position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                                                            background: '#f59e0b', color: '#fff', fontSize: 8, fontWeight: 700,
                                                            padding: '1px 4px', borderRadius: 2, whiteSpace: 'nowrap',
                                                        }}>
                                                            PICO
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Etiqueta mes */}
                                                <div style={{ fontSize: 8, color: '#64748b', marginTop: 4, textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {d.diasCalendario}
                                                </div>
                                                <div style={{ fontSize: 7, color: '#94a3b8', textAlign: 'center', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                                    {d.label.split(' ').slice(0, 2).join(' ')}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Leyenda */}
                            <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: 11, color: '#64748b' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 12, height: 12, background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)', borderRadius: 2 }} />
                                    Desembolso Mensual
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 12, height: 12, background: 'linear-gradient(180deg,#f59e0b,#d97706)', borderRadius: 2 }} />
                                    Mes Pico
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── VISTA: CURVA S ──────────────────────────────────── */}
                    {vista === 'curvaS' && (
                        <div style={{ padding: '24px', background: '#f8fafc', minHeight: 400 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0a2342', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
                                CURVA S — DESEMBOLSO ACUMULADO
                            </h3>
                            <div style={{ position: 'relative', height: 300 }}>
                                <svg width="100%" height="300" viewBox={`0 0 ${curvaS.length * 60 + 60} 300`} preserveAspectRatio="none">
                                    {/* Grid */}
                                    {[0, 25, 50, 75, 100].map((pct) => (
                                        <g key={pct}>
                                            <line
                                                x1={40} y1={300 - pct * 2.5 - 10}
                                                x2={curvaS.length * 60 + 40} y2={300 - pct * 2.5 - 10}
                                                stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4"
                                            />
                                            <text x={0} y={300 - pct * 2.5 - 6} fontSize={9} fill="#94a3b8">{pct}%</text>
                                        </g>
                                    ))}

                                    {/* Área bajo la curva */}
                                    <defs>
                                        <linearGradient id="curvaSGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d={[
                                            `M ${40} ${290}`,
                                            ...curvaS.map((p, i) => `L ${i * 60 + 70} ${290 - p.pct * 2.4}`),
                                            `L ${(curvaS.length - 1) * 60 + 70} 290`,
                                            'Z',
                                        ].join(' ')}
                                        fill="url(#curvaSGrad)"
                                    />

                                    {/* Línea */}
                                    <polyline
                                        points={curvaS.map((p, i) => `${i * 60 + 70},${290 - p.pct * 2.4}`).join(' ')}
                                        fill="none"
                                        stroke="#2563eb"
                                        strokeWidth={2.5}
                                        strokeLinejoin="round"
                                    />

                                    {/* Puntos y etiquetas */}
                                    {curvaS.map((p, i) => (
                                        <g key={i}>
                                            <circle cx={i * 60 + 70} cy={290 - p.pct * 2.4} r={4} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
                                            <text x={i * 60 + 70} y={280 - p.pct * 2.4} textAnchor="middle" fontSize={8} fill="#1d4ed8" fontWeight={700}>
                                                {p.pct.toFixed(1)}%
                                            </text>
                                            <text x={i * 60 + 70} y={298} textAnchor="middle" fontSize={8} fill="#64748b">
                                                {p.label.split(' ').slice(0, 1).join(' ')}
                                            </text>
                                        </g>
                                    ))}
                                </svg>
                            </div>
                        </div>
                    )}
                </div>

                {/* ══════════════════════════════════════════════════════════
                    FOOTER LEGAL
                ══════════════════════════════════════════════════════════ */}
                <div
                    style={{
                        borderTop: '1px solid #e2e8f0',
                        background: '#f1f5f9',
                        padding: '8px 24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                    }}
                >
                    <p style={{ fontSize: 10, color: '#64748b', margin: 0, fontStyle: 'italic' }}>
                        * Porcentajes máximos de Adelanto según Artículo 155° del Reglamento de la Ley de Contrataciones del Estado.
                        Las Bases establecerán el otorgamiento y el porcentaje final de dichos adelantos.
                    </p>
                    <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>
                        Proyecta PCL © {new Date().getFullYear()} — Módulo Financiero
                    </p>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

const FichaRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            {label}:
        </span>
        <span style={{ fontSize: 12, color: highlight ? '#0a2342' : '#1e293b', fontWeight: highlight ? 800 : 600 }}>
            {value}
        </span>
    </div>
);

const KpiCard: React.FC<{ color: string; label: string; value: string; sub: string; icon: React.ReactNode }> = ({
    color, label, value, sub, icon,
}) => (
    <div
        style={{
            padding: '14px 16px',
            borderRight: '1px solid #e2e8f0',
            borderBottom: '1px solid #e2e8f0',
            background: '#fff',
            position: 'relative',
            overflow: 'hidden',
        }}
    >
        <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: color }} />
        <div style={{ paddingLeft: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ color, opacity: 0.7 }}>{icon}</div>
                <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{sub}</div>
        </div>
    </div>
);

const TabBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({
    active, onClick, icon, label,
}) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: active ? 700 : 500,
            color: active ? '#0a2342' : '#64748b',
            background: active ? '#fff' : 'transparent',
            border: active ? '1px solid #e2e8f0' : '1px solid transparent',
            borderRadius: 5,
            cursor: 'pointer',
            boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
        }}
    >
        {icon}
        {label}
    </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE ESTILO
// ─────────────────────────────────────────────────────────────────────────────
function th(extra: React.CSSProperties = {}): React.CSSProperties {
    return {
        padding: '8px 10px',
        fontSize: 10,
        fontWeight: 700,
        textAlign: 'right',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderBottom: '1px solid #1a3a5c',
        whiteSpace: 'nowrap',
        fontFamily: "'DM Sans', sans-serif",
        ...extra,
    };
}

function td(extra: React.CSSProperties = {}): React.CSSProperties {
    return {
        padding: '7px 10px',
        borderBottom: '1px solid #f1f5f9',
        whiteSpace: 'nowrap',
        fontSize: 12,
        ...extra,
    };
}

export default CronogramaDesembolsos;