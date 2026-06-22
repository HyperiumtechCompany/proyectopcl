import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Filter, X, Package, Tag } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Periodo, ViewMode, SortField, SortDir, FiltroState } from '../types';

// ✅ Definir MaterialItem aquí (si no existe en types.ts)
interface MaterialItem {
    descripcion: string;
    unidad: string;
    tipo: string;
    precio: number;
    cantidad_total: number;
    costo_total: number;
    partida_origen?: string;
    descripcion_partida?: string;
    distribucion: Record<string, { cantidad: number; monto: number }>;
}

// TIPOS / PROPS
interface Props {
    materiales:       MaterialItem[];
    periodos:         Periodo[];
    viewMode:         ViewMode;
    totalesMensuales: Record<string, number>;
    totalGeneral:     number;
    sortField:        SortField;
    sortDir:          SortDir;
    filtro:           FiltroState;
    mesPicoKey:       string;
    destacado:        string | null;
    setDestacado:     (d: string | null) => void;
    onToggleSort:     (field: SortField) => void;
    onFiltroChange:   (f: Partial<FiltroState>) => void;
    getIntensidad:    (val: number) => number;
}

// UTILIDADES
const fmtNum = (v: number, dec = 2) => {
    if (v === undefined || v === null || isNaN(v)) return '0.00';
    return v.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};
const fmtSoles = (v: number) => {
    if (v === undefined || v === null || isNaN(v)) return 'S/. 0.00';
    return `S/. ${fmtNum(v)}`;
};

const getCantidad = (m: MaterialItem, key: string) => {
    if (!m || !m.distribucion || !m.distribucion[key]) return 0;
    return m.distribucion[key].cantidad || 0;
};

const getMonto = (m: MaterialItem, key: string) => {
    if (!m || !m.distribucion || !m.distribucion[key]) return 0;
    return m.distribucion[key].monto || 0;
};

// CATÁLOGO DE TIPOS
const TIPO_META: Record<string, { label: string; bg: string; text: string; border: string; headerBg: string }> = {
    mano_de_obra: { label: 'MANO DE OBRA', bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', headerBg: '#ea580c' },
    materiales:   { label: 'MATERIALES',   bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', headerBg: '#2563eb' },
    equipos:      { label: 'EQUIPOS',      bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', headerBg: '#7c3aed' },
    subcontratos: { label: 'SUBCONTRATOS', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', headerBg: '#16a34a' },
    subpartidas:  { label: 'SUBPARTIDAS',  bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4', headerBg: '#0d9488' },
    otros:        { label: 'OTROS',        bg: '#f8fafc', text: '#475569', border: '#cbd5e1', headerBg: '#64748b' },
};
const getTipoMeta = (tipo: string) => TIPO_META[tipo] || TIPO_META['otros'];

// INTENSIDAD
const intensityStyle = (i: number): React.CSSProperties => {
    if (i <= 0)    return { backgroundColor: '#ffffff', color: '#94a3b8' };
    if (i < 0.12)  return { backgroundColor: '#dbeafe', color: '#1e40af' };
    if (i < 0.28)  return { backgroundColor: '#93c5fd', color: '#1e3a8a' };
    if (i < 0.48)  return { backgroundColor: '#3b82f6', color: '#ffffff' };
    if (i < 0.68)  return { backgroundColor: '#1d4ed8', color: '#ffffff' };
    if (i < 0.85)  return { backgroundColor: '#1e40af', color: '#ffffff' };
    return { backgroundColor: '#0c4a6e', color: '#ffffff', fontWeight: 700 };
};

// ESTILOS FIJOS DE TABLA 
const TH_MAIN: React.CSSProperties = {
    background: '#1e293b', color: '#f1f5f9',
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '9px 6px', textAlign: 'center',
    border: '1px solid #334155', whiteSpace: 'nowrap',
};
const TH_SUB: React.CSSProperties = {
    background: '#334155', color: '#cbd5e1',
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    padding: '5px 6px', textAlign: 'center',
    border: '1px solid #475569',
};
const TD_BASE: React.CSSProperties = {
    fontSize: 11, padding: '6px 7px',
    border: '1px solid #cbd5e1',
    whiteSpace: 'nowrap',
};
const STICKY_SHADOW: React.CSSProperties = { boxShadow: '3px 0 6px rgba(0,0,0,0.18)' };

// SUB-COMPONENTE: TARJETA INFO
const InfoCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = '#1e293b' }) => (
    <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
        padding: '6px 10px', minWidth: 110,
    }}>
        <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            {label}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>
            {value}
        </div>
    </div>
);

// SUB-COMPONENTE: DETALLE EXPANDIDO 
const DetalleInsumo: React.FC<{
    material:    MaterialItem;
    periodos:    Periodo[];
    mesPicoKey:  string;
    onClose:     () => void;
}> = ({ material, periodos, mesPicoKey, onClose }) => {
    const meta = getTipoMeta(material.tipo || 'otros');

    const meses = periodos.map(p => ({
        key:      p.key,
        label:    p.labelCal || p.label,
        cantidad: getCantidad(material, p.key),
        monto:    getMonto(material, p.key),
        isPico:   p.key === mesPicoKey,
    })).filter(m => m.cantidad > 0 || m.monto > 0);

    const maxMonto = Math.max(...meses.map(m => m.monto), 1);

    return (
        <div style={{
            background: 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)',
            borderLeft: `5px solid ${meta.headerBg}`,
            padding: '14px 20px',
            position: 'relative',
        }}>
            {/* Botón cerrar */}
            <button
                onClick={onClose}
                title="Cerrar detalle"
                style={{
                    position: 'absolute', top: 10, right: 12,
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                    borderRadius: 6, cursor: 'pointer', padding: '3px 8px',
                    display: 'flex', alignItems: 'center', gap: 4,
                    color: '#64748b', fontSize: 11, fontWeight: 600,
                }}
            >
                <X style={{ width: 13, height: 13 }} />
                Cerrar
            </button>

            {/* Encabezado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Package style={{ width: 16, height: 16, color: meta.headerBg }} />
                <span style={{
                    background: meta.bg, color: meta.text,
                    border: `1px solid ${meta.border}`,
                    padding: '3px 10px', borderRadius: 4,
                    fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                }}>
                    {material.partida_origen || '---'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                    {material.descripcion}
                </span>
                <span style={{
                    background: meta.headerBg, color: '#fff',
                    fontSize: 9, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase',
                }}>
                    {meta.label}
                </span>
            </div>
            

            {/* Grid de datos clave */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <InfoCard label="Unidad"        value={material.unidad}                      color="#475569" />
                <InfoCard label="Precio Unit."  value={fmtSoles(material.precio)}            color="#0f766e" />
                <InfoCard label="Cantidad Total" value={fmtNum(material.cantidad_total, 2)}  color="#1d4ed8" />
                <InfoCard label="Costo Total"   value={fmtSoles(material.costo_total)}       color="#059669" />

                {/* Descripcion de la partida*/}
                <InfoCard label="Descripcion de la Partida" value={material.descripcion_partida || material.partida_origen || '__'} color="#0f766e" />
            </div>

            {/* Distribución mensual */}
            {meses.length > 0 && (
                <>
                    <div style={{
                        fontSize: 9, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <Tag style={{ width: 12, height: 12 }} />
                        Distribución mensual
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {meses.map(m => (
                            <div key={m.key} style={{
                                background: m.isPico ? '#fffbeb' : '#fff',
                                border: `1px solid ${m.isPico ? '#fcd34d' : '#e2e8f0'}`,
                                borderRadius: 6, padding: '7px 10px', minWidth: 100,
                            }}>
                                <div style={{
                                    fontSize: 9, color: m.isPico ? '#b45309' : '#94a3b8',
                                    fontWeight: 700, marginBottom: 3,
                                }}>
                                    {m.isPico ? '🔝 ' : ''}{m.label}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>
                                    {fmtNum(m.cantidad, 2)}
                                </div>
                                <div style={{ fontSize: 10, color: '#0f766e', fontFamily: 'monospace', fontWeight: 600 }}>
                                    {fmtSoles(m.monto)}
                                </div>
                                {/* Barra de proporción */}
                                <div style={{
                                    marginTop: 5, height: 4, background: '#e2e8f0',
                                    borderRadius: 2, overflow: 'hidden',
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${Math.round((m.monto / maxMonto) * 100)}%`,
                                        background: m.isPico ? '#f59e0b' : meta.headerBg,
                                        borderRadius: 2, transition: 'width 0.4s ease',
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// SUB-COMPONENTE: 
const SortTh: React.FC<{
    field:   SortField;
    current: SortField;
    dir:     SortDir;
    label:   string;
    align?:  'left' | 'center' | 'right';
    onClick: (f: SortField) => void;
    style?:  React.CSSProperties;
}> = ({ field, current, dir, label, align = 'center', onClick, style }) => {
    const isActive = current === field;
    return (
        <th
            onClick={() => onClick(field)}
            style={{
                ...TH_MAIN,
                textAlign: align,
                cursor: 'pointer',
                background: isActive ? '#0f172a' : '#1e293b',
                color: isActive ? '#60a5fa' : '#f1f5f9',
                userSelect: 'none',
                ...style,
            }}
        >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {label}
                {isActive
                    ? (dir === 'asc'
                        ? <ChevronUp   style={{ width: 12, height: 12, color: '#60a5fa' }} />
                        : <ChevronDown style={{ width: 12, height: 12, color: '#60a5fa' }} />)
                    : <ChevronsUpDown style={{ width: 11, height: 11, color: '#64748b' }} />
                }
            </span>
        </th>
    );
};

// SUB-COMPONENTE:
const BarraFiltro: React.FC<{
    filtro:         FiltroState;
    onFiltroChange: (f: Partial<FiltroState>) => void;
    count:          number;
    total:          number;
}> = ({ filtro, onFiltroChange, count }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: '#f8fafc',
        borderBottom: '2px solid #e2e8f0',
    }}>
        {/* Búsqueda */}
        <div style={{ position: 'relative', flex: '1', maxWidth: 280 }}>
            <Search style={{
                position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                width: 14, height: 14, color: '#94a3b8',
            }} />
            <input
                type="text"
                placeholder="Buscar insumo..."
                value={filtro.busqueda}
                onChange={e => onFiltroChange({ busqueda: e.target.value })}
                style={{
                    width: '100%', paddingLeft: 30, paddingRight: 28,
                    paddingTop: 6, paddingBottom: 6,
                    fontSize: 12, color: '#1e293b',
                    background: '#fff', border: '1px solid #cbd5e1',
                    borderRadius: 6, outline: 'none', fontFamily: 'inherit',
                }}
            />
            {filtro.busqueda && (
                <button
                    onClick={() => onFiltroChange({ busqueda: '' })}
                    style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#94a3b8', padding: 2,
                    }}
                >
                    <X style={{ width: 12, height: 12 }} />
                </button>
            )}
        </div>

        {/* Checkbox solo con cantidad */}
        <label style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
            padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#475569',
            userSelect: 'none',
        }}>
            <input
                type="checkbox"
                checked={filtro.soloConCant}
                onChange={e => onFiltroChange({ soloConCant: e.target.checked })}
                style={{ accentColor: '#2563eb', width: 13, height: 13 }}
            />
            Solo con cantidad
        </label>

        {/* Filtro por tipo */}
        <select
            value={filtro.tipoFiltro || ''}
            onChange={e => onFiltroChange({ tipoFiltro: e.target.value || undefined })}
            style={{
                fontSize: 11, fontWeight: 600, color: '#1e293b',
                background: '#fff', border: '1px solid #cbd5e1',
                borderRadius: 6, padding: '5px 10px', outline: 'none',
                cursor: 'pointer',
            }}
        >
            <option value="">— Todos los tipos —</option>
            <option value="mano_de_obra">👷 Mano de Obra</option>
            <option value="materiales">🧱 Materiales</option>
            <option value="equipos">⚙️ Equipos</option>
            <option value="subcontratos">🤝 Subcontratos</option>
            <option value="subpartidas">📐 Subpartidas</option>
        </select>

        {/* Contador */}
        <div style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#1e293b', color: '#94a3b8',
            borderRadius: 6, padding: '5px 12px',
            fontSize: 11, fontWeight: 700,
        }}>
            <Filter style={{ width: 13, height: 13 }} />
            <span style={{ color: '#f1f5f9' }}>{count}</span>
            <span>insumos</span>
        </div>

        {/* Ayuda */}
        <div style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
            Doble clic para ver detalle
        </div>
    </div>
);

// COMPONENTE PRINCIPAL
const TablaMateriales: React.FC<Props> = ({
    materiales, periodos, viewMode,
    totalesMensuales, totalGeneral,
    sortField, sortDir, filtro, mesPicoKey,
    destacado, setDestacado,
    onToggleSort, onFiltroChange,
}) => {
    const tableRef    = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    // Máximos por período para intensidad
    const maxCantPeriodo: Record<string, number> = {};
    const maxMontoPeriodo: Record<string, number> = {};
    periodos.forEach(p => {
        maxCantPeriodo[p.key]  = Math.max(...materiales.map(m => getCantidad(m, p.key)), 1);
        maxMontoPeriodo[p.key] = Math.max(...materiales.map(m => getMonto(m, p.key)), 1);
    });

    const totalMensualGeneral = Object.values(totalesMensuales).reduce((a, b) => a + b, 0);
    const anchoTabla = 590 + periodos.length * 170;

    // ── Sin resultados
  // ── Sin resultados
if (!materiales || materiales.length === 0) {
    return (
        <div style={{
            background: '#fff', borderRadius: 10,
            border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
            <BarraFiltro filtro={filtro} onFiltroChange={onFiltroChange} count={0} total={0} />
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '80px 0', color: '#94a3b8',
            }}>
                <span style={{ fontSize: 56, marginBottom: 14 }}>📦</span>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#475569' }}>No hay insumos que mostrar</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Ajuste los filtros o verifique el Gantt general</p>
            </div>
        </div>
    );
}

    return (
        <div style={{
            background: '#fff', borderRadius: 10,
            border: '1px solid #cbd5e1',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            overflow: 'hidden',
        }}>
            <BarraFiltro
                filtro={filtro}
                onFiltroChange={onFiltroChange}
                count={materiales.length}
                total={materiales.length}
            />

            <div ref={tableRef} style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
                <table style={{
                    width: '100%', borderCollapse: 'collapse',
                    minWidth: `${anchoTabla}px`, fontSize: 12,
                }}>
                    {/* ══ ENCABEZADOS ══ */}
                    <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                        {/* Fila 1 */}
                        <tr>
                            {/* Columnas fijas */}
                            <th rowSpan={2} style={{ ...TH_MAIN, position: 'sticky', left: 0,   zIndex: 31, minWidth: 110, ...STICKY_SHADOW }}>TIPO</th>
                            <th rowSpan={2} style={{ ...TH_MAIN, position: 'sticky', left: 110, zIndex: 31, minWidth: 96  }}>PARTIDA</th>
                            <th rowSpan={2} style={{ ...TH_MAIN, position: 'sticky', left: 206, zIndex: 31, minWidth: 220, ...STICKY_SHADOW }}>DESCRIPCIÓN</th>
                            <th rowSpan={2} style={{ ...TH_MAIN, minWidth: 58 }}>UND</th>
                            <th rowSpan={2} style={{ ...TH_MAIN, minWidth: 90 }}>PRECIO U.</th>
                            {/* Períodos */}
                            {periodos.map(p => (
                                <th
                                    key={`h-${p.key}`}
                                    colSpan={2}
                                    style={{
                                        ...TH_MAIN,
                                        minWidth: 160,
                                        background: p.key === mesPicoKey ? '#78350f' : '#1e293b',
                                        color:      p.key === mesPicoKey ? '#fde68a' : '#f1f5f9',
                                        borderBottom: p.key === mesPicoKey ? '2px solid #fbbf24' : undefined,
                                    }}
                                >
                                    {p.key === mesPicoKey && (
                                        <span style={{ display: 'block', fontSize: 8, color: '#fbbf24', marginBottom: 2 }}>
                                            🔝 MES PICO
                                        </span>
                                    )}
                                    {p.labelCal || p.label}
                                </th>
                            ))}
                            {/* Totales */}
                            <th rowSpan={2} style={{ ...TH_MAIN, minWidth: 105, background: '#064e3b', color: '#6ee7b7' }}>TOTAL CANT.</th>
                            <th rowSpan={2} style={{ ...TH_MAIN, minWidth: 110, background: '#064e3b', color: '#6ee7b7' }}>TOTAL S/.</th>
                        </tr>
                        {/* Fila 2 — sub-columnas */}
                        <tr>
                            {periodos.map(p => (
                                <React.Fragment key={`sub-${p.key}`}>
                                    <th style={{
                                        ...TH_SUB,
                                        background: p.key === mesPicoKey ? '#92400e' : '#334155',
                                        color:      p.key === mesPicoKey ? '#fde68a' : '#94a3b8',
                                    }}>
                                        CANTIDAD
                                    </th>
                                    <th style={{
                                        ...TH_SUB,
                                        background: p.key === mesPicoKey ? '#78350f' : '#1e293b',
                                        color:      p.key === mesPicoKey ? '#fbbf24' : '#64748b',
                                    }}>
                                        PARCIAL S/.
                                    </th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>

                    {/* ══ CUERPO ══ */}
                    <tbody>
                        {materiales.map((mat, idx) => {
                            const isExpanded = expanded === `${mat.descripcion}-${idx}`;
                            const meta       = getTipoMeta(mat.tipo || 'otros');
                            const rowBg      = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                            const borderColor = '#d1d5db';

                            return (
                                <React.Fragment key={`${mat.descripcion}-${idx}`}>
                                    <tr
                                        style={{ cursor: 'pointer', background: rowBg }}
                                        onDoubleClick={() => setExpanded(isExpanded ? null : `${mat.descripcion}-${idx}`)}
                                        title="Doble clic para ver detalles del insumo"
                                        onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                                        onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                                    >
                                        {/* TIPO */}
                                        <td style={{
                                            ...TD_BASE,
                                            position: 'sticky', left: 0, zIndex: 10,
                                            background: rowBg, ...STICKY_SHADOW,
                                            textAlign: 'center',
                                        }}>
                                            <span style={{
                                                display: 'inline-block',
                                                background: meta.bg, color: meta.text,
                                                border: `1px solid ${meta.border}`,
                                                borderRadius: 4, padding: '2px 6px',
                                                fontSize: 9, fontWeight: 700,
                                                textTransform: 'uppercase', letterSpacing: '0.04em',
                                            }}>
                                                {meta.label}
                                            </span>
                                        </td>

                                        {/* PARTIDA */}
                                        <td style={{
                                            ...TD_BASE,
                                            position: 'sticky', left: 110, zIndex: 10,
                                            background: rowBg, textAlign: 'center',
                                        }}>
                                            <span style={{
                                                display: 'inline-block',
                                                background: '#eff6ff', color: '#1d4ed8',
                                                border: '1px solid #bfdbfe',
                                                borderRadius: 4, padding: '2px 7px',
                                                fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                                            }}>
                                                {mat.partida_origen || '—'}
                                            </span>
                                        </td>

                                        {/* DESCRIPCIÓN */}
                                        <td style={{
                                            ...TD_BASE,
                                            position: 'sticky', left: 206, zIndex: 10,
                                            background: rowBg, ...STICKY_SHADOW,
                                            maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis',
                                            fontWeight: isExpanded ? 700 : 400,
                                            color: '#1e293b',
                                        }}
                                            title={mat.descripcion}
                                        >
                                            {isExpanded && (
                                                <span style={{
                                                    display: 'inline-block', marginRight: 6,
                                                    color: meta.headerBg, fontSize: 10,
                                                }}>▼</span>
                                            )}
                                            {mat.descripcion}
                                        </td>

                                        {/* UNIDAD */}
                                        <td style={{ ...TD_BASE, textAlign: 'center', fontWeight: 700, color: '#475569', textTransform: 'uppercase', background: rowBg }}>
                                            {mat.unidad}
                                        </td>

                                        {/* PRECIO */}
                                        <td style={{ ...TD_BASE, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0f766e', background: rowBg }}>
                                            {fmtSoles(mat.precio)}
                                        </td>

                                        {/* DATOS POR PERÍODO */}
                                        {periodos.map(p => {
                                            const cant  = getCantidad(mat, p.key);
                                            const monto = getMonto(mat, p.key);
                                            const iCant  = maxCantPeriodo[p.key]  > 0 ? cant  / maxCantPeriodo[p.key]  : 0;
                                            const iMonto = maxMontoPeriodo[p.key] > 0 ? monto / maxMontoPeriodo[p.key] : 0;

                                            return (
                                                <React.Fragment key={`${mat.descripcion}-${p.key}`}>
                                                    <td style={{ ...TD_BASE, textAlign: 'right', fontFamily: 'monospace', ...intensityStyle(iCant) }}>
                                                        {cant > 0
                                                            ? fmtNum(cant, 2)
                                                            : <span style={{ color: '#cbd5e1' }}>—</span>
                                                        }
                                                    </td>
                                                    <td style={{ ...TD_BASE, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, ...intensityStyle(iMonto) }}>
                                                        {monto > 0
                                                            ? fmtSoles(monto)
                                                            : <span style={{ color: '#cbd5e1' }}>—</span>
                                                        }
                                                    </td>
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* TOTALES */}
                                        <td style={{ ...TD_BASE, textAlign: 'right', fontWeight: 700, color: '#1e293b', background: rowBg, fontFamily: 'monospace' }}>
                                            {fmtNum(mat.cantidad_total, 2)}
                                        </td>
                                        <td style={{ ...TD_BASE, textAlign: 'right', fontWeight: 700, color: '#059669', background: rowBg, fontFamily: 'monospace' }}>
                                            {fmtSoles(mat.costo_total)}
                                        </td>
                                    </tr>

                                    {/* ── FILA EXPANDIDA ── */}
                                    {isExpanded && (
                                        <tr>
                                            <td
                                                colSpan={5 + periodos.length * 2 + 2}
                                                style={{ padding: 0, borderBottom: `2px solid ${meta.headerBg}` }}
                                            >
                                                <DetalleInsumo
                                                    material={mat}
                                                    periodos={periodos}
                                                    mesPicoKey={mesPicoKey}
                                                    onClose={() => setExpanded(null)}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>

                    {/* ══ TOTALES GENERALES ══ */}
                    <tfoot>
                        {/* Fila % distribución */}
                        <tr>
                            <td colSpan={5} style={{
                                ...TD_BASE, textAlign: 'right', fontWeight: 700,
                                fontSize: 9, color: '#64748b', background: '#f1f5f9',
                                position: 'sticky', left: 0, zIndex: 10,
                            }}>
                                % DISTRIBUCIÓN MENSUAL
                            </td>
                            {periodos.map(p => {
                                const pct = totalMensualGeneral > 0
                                    ? ((totalesMensuales[p.key] || 0) / totalMensualGeneral * 100)
                                    : 0;
                                return (
                                    <React.Fragment key={`pct-${p.key}`}>
                                        <td style={{ ...TD_BASE, textAlign: 'center', background: '#f1f5f9', color: '#94a3b8', fontSize: 10 }}>—</td>
                                        <td style={{
                                            ...TD_BASE, textAlign: 'center', fontWeight: 700, fontSize: 10,
                                            background: p.key === mesPicoKey ? '#fffbeb' : '#f1f5f9',
                                            color:      p.key === mesPicoKey ? '#b45309' : '#475569',
                                        }}>
                                            {pct > 0 ? `${fmtNum(pct, 1)}%` : '—'}
                                        </td>
                                    </React.Fragment>
                                );
                            })}
                            <td style={{ ...TD_BASE, background: '#f1f5f9' }} />
                            <td style={{ ...TD_BASE, textAlign: 'center', fontWeight: 700, fontSize: 10, color: '#0f766e', background: '#f0fdf4' }}>
                                100%
                            </td>
                        </tr>

                        {/* Fila totales */}
                        <tr>
                            <td colSpan={5} style={{
                                ...TD_BASE,
                                background: '#0f172a', color: '#94a3b8',
                                fontWeight: 700, fontSize: 10, textAlign: 'right',
                                position: 'sticky', left: 0, zIndex: 10,
                                ...STICKY_SHADOW,
                            }}>
                                TOTALES GENERALES — {materiales.length} insumos
                            </td>
                            {periodos.map(p => {
                                const totalCant  = materiales.reduce((s, m) => s + getCantidad(m, p.key), 0);
                                const totalMonto = materiales.reduce((s, m) => s + getMonto(m, p.key), 0);
                                return (
                                    <React.Fragment key={`tot-${p.key}`}>
                                        <td style={{
                                            ...TD_BASE, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace',
                                            background: p.key === mesPicoKey ? '#1c1917' : '#0f172a',
                                            color: p.key === mesPicoKey ? '#fcd34d' : '#6ee7b7',
                                        }}>
                                            {fmtNum(totalCant, 0)}
                                        </td>
                                        <td style={{
                                            ...TD_BASE, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace',
                                            background: p.key === mesPicoKey ? '#1c1917' : '#0f172a',
                                            color: p.key === mesPicoKey ? '#fbbf24' : '#6ee7b7',
                                        }}>
                                            {fmtSoles(totalMonto)}
                                        </td>
                                    </React.Fragment>
                                );
                            })}
                            <td style={{
                                ...TD_BASE, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace',
                                background: '#064e3b', color: '#6ee7b7',
                            }}>
                                {fmtNum(materiales.reduce((s, m) => s + m.cantidad_total, 0), 0)}
                            </td>
                            <td style={{
                                ...TD_BASE, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace',
                                background: '#064e3b', color: '#34d399', fontSize: 12,
                            }}>
                                {fmtSoles(totalGeneral)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default TablaMateriales;