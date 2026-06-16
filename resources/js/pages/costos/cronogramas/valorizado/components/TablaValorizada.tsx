import { RefreshCw, X, TrendingUp, AlertTriangle, Lock } from 'lucide-react';
import React, { useState, useRef } from 'react';
import type { ItemValorizado, Periodo, ViewMode, TotalesColumna } from '../types';

// FORMATOS
const fmtN = (v: number) =>
    (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtS = (v: number) => `S/. ${fmtN(v)}`;
const fmtP = (v: number) => `${(v ?? 0).toFixed(4)}%`;

const nivel = (item: string) => (item?.split('.').length ?? 1) - 1;

const bgNivel = (n: number, isLeaf: boolean): string => {
    if (isLeaf)  return '';
    if (n === 0) return 'bg-slate-800 text-white';
    if (n === 1) return 'bg-slate-200 text-slate-900';
    if (n === 2) return 'bg-slate-100 text-slate-800';
    return 'bg-slate-50 text-slate-700';
};

// TIPOS
interface FinancieroState {
    pctGastosGenerales: number;  
    pctUtilidad:        number;  
    pctIGV:             number;  
    montoMobiliario:    number;  
    pctIGVMobiliario:   number;  
    pctSupervision:     number;  
}

// CELDA EDITABLE PARTIDAS
interface EditableCellProps {
    value: number; viewMode: ViewMode; parcial: number;
    onChange: (v: number) => void; isPico: boolean; bloqueada: boolean;
}
const EditableCell: React.FC<EditableCellProps> = ({ value, viewMode, parcial, onChange, isPico, bloqueada }) => {
    const [editing, setEditing] = useState(false);
    const [rawVal, setRawVal]   = useState('');
    const inputRef              = useRef<HTMLInputElement>(null);

    if (bloqueada) return (
        <td className="p-2 border border-slate-200 text-center bg-slate-50 cursor-not-allowed" title="Fuera del rango de ejecución">
            <Lock className="w-3 h-3 text-slate-300 mx-auto" />
        </td>
    );

    const startEdit = () => { setRawVal(value.toFixed(2)); setEditing(true); setTimeout(() => inputRef.current?.select(), 30); };
    const commitEdit = () => {
        const parsed = parseFloat(rawVal.replace(/,/g, '.'));
        if (!isNaN(parsed)) {
            const finalVal = viewMode === 'porcentaje' ? (parsed / 100) * parcial : parsed;
            onChange(Math.max(0, finalVal));
        }
        setEditing(false);
    };
    const display  = viewMode === 'monto' ? fmtN(value) : fmtP(parcial > 0 ? (value / parcial) * 100 : 0);
    const hasValue = value > 0;

    if (editing) return (
        <td className={`p-0 border border-slate-200 ${isPico ? 'ring-1 ring-inset ring-amber-400' : ''}`}>
            <input ref={inputRef} type="text" value={rawVal}
                onChange={e => setRawVal(e.target.value)} onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                className="w-full h-full px-2 py-2 text-xs text-right font-mono bg-yellow-50 border-0 outline-none focus:ring-2 focus:ring-blue-400"
            />
        </td>
    );

    return (
        <td onClick={startEdit} title="Clic para editar"
            className={`p-2 text-right text-[11px] font-mono border border-slate-200 cursor-pointer transition-colors select-none
                ${hasValue ? 'text-slate-800 font-semibold hover:bg-blue-50' : 'text-slate-300 hover:bg-slate-50'}
                ${isPico && hasValue ? 'ring-1 ring-inset ring-amber-300 bg-amber-50/20' : ''}`}>
            {hasValue ? display : '—'}
        </td>
    );
};

// CELDA % EDITABLE 
const PctCell: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw]         = useState('');
    const inputRef              = useRef<HTMLInputElement>(null);
    const startEdit = () => { setRaw(value.toFixed(2)); setEditing(true); setTimeout(() => inputRef.current?.select(), 30); };
    const commit    = () => { const p = parseFloat(raw.replace(/,/g, '.')); if (!isNaN(p)) onChange(Math.max(0, p)); setEditing(false); };

    if (editing) return (
        <td className="p-0 border border-slate-300 w-20">
            <input ref={inputRef} type="text" value={raw}
                onChange={e => setRaw(e.target.value)} onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
                className="w-full h-full px-2 py-1.5 text-[11px] text-center font-mono bg-yellow-50 text-slate-900 border-0 outline-none"
            />
        </td>
    );
    return (
        <td onClick={startEdit} title="Clic para editar %"
            className="p-2 text-center text-[11px] font-semibold border border-slate-300 cursor-pointer bg-slate-100 text-slate-600 hover:bg-yellow-50 transition-colors select-none w-20">
            {value.toFixed(2)}%
        </td>
    );
};

// CELDA MONTO EDITABLE 
const MontoCell: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw]         = useState('');
    const inputRef              = useRef<HTMLInputElement>(null);
    const startEdit = () => { setRaw(value.toFixed(2)); setEditing(true); setTimeout(() => inputRef.current?.select(), 30); };
    const commit    = () => { const p = parseFloat(raw.replace(/,/g, '.')); if (!isNaN(p)) onChange(Math.max(0, p)); setEditing(false); };

    if (editing) return (
        <td className="p-0 border border-slate-300">
            <input ref={inputRef} type="text" value={raw}
                onChange={e => setRaw(e.target.value)} onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
                className="w-full h-full px-2 py-1.5 text-[11px] text-right font-mono bg-yellow-50 text-slate-900 border-0 outline-none"
            />
        </td>
    );
    return (
        <td onClick={startEdit} title="Clic para editar monto"
            className="p-2 text-right text-[11px] font-semibold border border-slate-300 cursor-pointer bg-slate-100 text-slate-700 hover:bg-yellow-50 transition-colors select-none tabular-nums">
            {value > 0 ? fmtS(value) : '—'}
        </td>
    );
};

// BADGE DESVÍO
const BadgeDesviacion: React.FC<{ desvio: number }> = ({ desvio }) => {
    if (desvio <= 0.01) return null;
    return (
        <span title={`Diferencia: S/. ${fmtN(desvio)}`}
            className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 bg-rose-100 border border-rose-300 text-rose-700 text-[8px] font-black rounded-full">
            <AlertTriangle className="w-2.5 h-2.5" />S/. {fmtN(desvio)}
        </span>
    );
};

// PROPS
interface Props {
    items:               ItemValorizado[];
    periodos:            Periodo[];
    viewMode:            ViewMode;
    totales:             Record<string, TotalesColumna>;
    totalPresupuesto:    number;
    onEditarCelda:       (itemId: number | string, key: string, monto: number) => void;
    onRedistribuir:      (itemId: number | string) => void;
    onRedistribuirGauss: (itemId: number | string) => void;
    onLimpiar:           (itemId: number | string) => void;
    mesPicoKey?:         string;
    diasPorMes?:         Record<string, number>;
    desviaciones?:       Record<string | number, number>;
    totalDesviadas?:     number;
    isPeriodoBloqueado:  (item: ItemValorizado, key: string) => boolean;
    totalesPorItem?:     Record<string | number, number>;
    totalGeneralPeriodos?: number;
    // Valores iniciales de la sección financiera 
    finDefaults?: {
        pctGastosGenerales?: number;
        pctUtilidad?:        number;
        pctIGV?:             number;
        montoMobiliario?:    number;
        pctIGVMobiliario?:   number;
        pctSupervision?:     number;
    };
}

// COMPONENTE PRINCIPAL
const TablaValorizada: React.FC<Props> = ({
    items = [], periodos = [], viewMode, totales = {},
    totalPresupuesto = 0,
    onEditarCelda, onRedistribuir, onRedistribuirGauss, onLimpiar,
    mesPicoKey, diasPorMes,
    desviaciones = {}, totalDesviadas = 0,
    isPeriodoBloqueado,
    totalesPorItem = {},
    totalGeneralPeriodos = 0,
    finDefaults = {},
}) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const [fin, setFin] = useState<FinancieroState>({
        pctGastosGenerales: finDefaults.pctGastosGenerales ?? 11.56,
        pctUtilidad:        finDefaults.pctUtilidad        ?? 5.00,
        pctIGV:             finDefaults.pctIGV             ?? 18.00,
        montoMobiliario:    finDefaults.montoMobiliario    ?? 0,
        pctIGVMobiliario:   finDefaults.pctIGVMobiliario   ?? 18.00,
        pctSupervision:     finDefaults.pctSupervision     ?? 5.13,
    });
    const setPct = (key: keyof FinancieroState, val: number) =>
        setFin(prev => ({ ...prev, [key]: val }));

    const toggleCollapse = (code: string) => {
        setCollapsed(prev => { const n = new Set(prev); if (n.has(code)) n.delete(code); else n.add(code); return n; });
    };

    const visibleItems = items.filter(item => {
        const code = item.item || '';
        for (const col of collapsed) {
            if (code.startsWith(col + '.') || code.startsWith(col + ' ')) return false;
        }
        return true;
    });

    if (items.length === 0) return (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center text-slate-400">
            <span className="text-5xl">📋</span>
            <p className="mt-4 font-bold">No hay partidas para mostrar</p>
        </div>
    );

    const lastKey             = periodos.length > 0 ? periodos[periodos.length - 1].key : '';
    const totalAcumuladoFinal = totales[lastKey]?.acumuladoMonto ?? 0;

    const costoDirecto = totalPresupuesto > 0 ? totalPresupuesto : totalGeneralPeriodos;

    const cdPorPeriodo: Record<string, number> = {};
    periodos.forEach(p => { cdPorPeriodo[p.key] = totales[p.key]?.monto ?? 0; });
    const cdTotalReal = Object.values(cdPorPeriodo).reduce((a, b) => a + b, 0);

    const montoGG    = costoDirecto * (fin.pctGastosGenerales / 100);
    const montoUT    = costoDirecto * (fin.pctUtilidad / 100);
    const subTotal   = costoDirecto + montoGG + montoUT;
    const montoIGV   = subTotal * (fin.pctIGV / 100);
    const presupI    = subTotal + montoIGV;

    const montoIGVMob = fin.montoMobiliario * (fin.pctIGVMobiliario / 100);
    const subTotalII  = fin.montoMobiliario + montoIGVMob;
    const totalI_II   = presupI + subTotalII;

    const montoSup    = presupI * (fin.pctSupervision / 100);
    const presupTotal = totalI_II + montoSup;

    const propDist = (total: number): Record<string, number> => {
        const r: Record<string, number> = {};
        periodos.forEach(p => {
            r[p.key] = cdTotalReal > 0 ? total * ((cdPorPeriodo[p.key] ?? 0) / cdTotalReal) : 0;
        });
        return r;
    };

    const distGG    = propDist(montoGG);
    const distUT    = propDist(montoUT);
    const distSub   = propDist(subTotal);
    const distIGV   = propDist(montoIGV);
    const distPresI = propDist(presupI);
    const distSup   = propDist(montoSup);

    // Avance acumulado 
    let acumCD = 0;
    const avAcumReal: Record<string, number> = {};
    periodos.forEach(p => {
        acumCD += cdPorPeriodo[p.key] ?? 0;
        avAcumReal[p.key] = costoDirecto > 0 ? (acumCD / costoDirecto) * 100 : 0;
    });

    const finTd = (v: number, key: string, cls: string) => (
        <td key={key} className={`p-2 text-right text-[11px] border border-slate-300 tabular-nums font-medium ${cls}
            ${v > 0 ? 'text-slate-700' : 'text-slate-300'}
            ${key === mesPicoKey && v > 0 ? 'ring-1 ring-inset ring-amber-400' : ''}`}>
            {v > 0 ? fmtN(v) : '—'}
        </td>
    );

    const nCols = 8 + periodos.length + 1;

    return (
        <div ref={tableRef} className="rounded-xl border border-slate-200 shadow-lg bg-white overflow-hidden">

            {/* Leyenda */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>📌 Clic en celda para editar</span>
                <span>⟳ = Uniforme</span>
                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> = Gauss (Curva S)</span>
                <span>✕ = Limpiar</span>
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> = Fuera de rango</span>
                <span className="ml-auto flex items-center gap-4">
                    {totalDesviadas > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-600 rounded">
                            <AlertTriangle className="w-3 h-3" />
                            {totalDesviadas} partida{totalDesviadas > 1 ? 's' : ''} con desvío
                        </span>
                    )}
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-2 rounded-sm bg-amber-400 inline-block" /> Mes pico
                    </span>
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse"
                    style={{ minWidth: `${Math.max(1300, 900 + periodos.length * 95)}px` }}>

                    {/* ══════════════ ENCABEZADO ══════════════ */}
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                            <th className="p-2.5 border border-slate-700 text-center w-10">N°</th>
                            <th className="p-2.5 border border-slate-700 text-center w-20">ÍTEM</th>
                            <th className="p-2.5 border border-slate-700 text-left min-w-[240px] sticky left-0 bg-slate-900 z-30">DESCRIPCIÓN</th>
                            <th className="p-2.5 border border-slate-700 text-center w-12">UND</th>
                            <th className="p-2.5 border border-slate-700 text-right w-24">METRADO</th>
                            <th className="p-2.5 border border-slate-700 text-right w-28">P.U. (S/.)</th>
                            <th className="p-2.5 border border-slate-700 text-right w-32 bg-blue-900">PARCIAL (S/.)</th>
                            <th className="p-2.5 border border-slate-700 text-center w-20 bg-slate-800">ACC.</th>
                            {periodos.map(p => (
                                <th key={p.key} className={`p-2.5 border border-slate-700 text-center min-w-[88px] ${p.key === mesPicoKey ? 'bg-amber-700' : ''}`}>
                                    <div>{p.label}</div>
                                    <div className="text-[8px] font-normal text-slate-400 normal-case">{p.labelCal}</div>
                                </th>
                            ))}
                            <th className="p-2.5 border border-slate-700 text-center min-w-[110px] bg-emerald-900 text-emerald-200 sticky right-0 z-30">
                                <div>TOTAL</div>
                                <div className="text-[8px] font-normal text-emerald-400 normal-case">S/. acumulado</div>
                            </th>
                        </tr>
                    </thead>

                    {/* ══════════════ CUERPO ══════════════ */}
                    <tbody>
                        {visibleItems.map((item, idx) => {
                            const n           = nivel(item.item);
                            const isLeaf      = item.is_leaf;
                            const hasKids     = items.some(i => i.item.startsWith(item.item + '.') || i.item.startsWith(item.item + ' '));
                            const isCollapsed = collapsed.has(item.item);
                            const bg          = bgNivel(n, isLeaf);
                            const desvio      = isLeaf ? (desviaciones[item.id] ?? 0) : 0;
                            const tieneDesv   = desvio > 0.01;
                            const totalFila   = totalesPorItem[item.id] ?? 0;

                            return (
                                <tr key={item.id}
                                    className={`${bg || (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40')} hover:bg-blue-50/30 transition-colors ${tieneDesv ? 'ring-1 ring-inset ring-rose-200' : ''}`}>
                                    <td className="p-2 border border-slate-200 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                                    <td className={`p-2 border border-slate-200 text-center font-mono text-xs ${n === 0 ? 'text-slate-300' : 'text-slate-500'}`}>{item.item}</td>
                                    <td className={`p-2 border border-slate-200 sticky left-0 z-10 shadow-[1px_0_4px_rgba(0,0,0,0.05)] ${
                                        n === 0 ? 'bg-slate-800 text-white' : n === 1 ? 'bg-slate-200 text-slate-900' : n === 2 ? 'bg-slate-100 text-slate-800' : 'bg-white text-slate-700'
                                    }`} style={{ paddingLeft: `${8 + n * 14}px` }}>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {hasKids && (
                                                <button onClick={() => toggleCollapse(item.item)}
                                                    className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 hover:text-blue-600"
                                                    title={isCollapsed ? 'Expandir' : 'Colapsar'}>
                                                    {isCollapsed ? '▶' : '▼'}
                                                </button>
                                            )}
                                            <span className={`leading-tight ${n <= 1 ? 'font-bold' : n === 2 ? 'font-semibold' : 'font-normal'} ${item.is_leaf ? 'italic' : ''}`}>
                                                {item.descripcion}
                                            </span>
                                            {tieneDesv && <BadgeDesviacion desvio={desvio} />}
                                        </div>
                                    </td>
                                    <td className="p-2 border border-slate-200 text-center text-slate-500 uppercase text-[10px]">{item.und || '—'}</td>
                                    <td className="p-2 border border-slate-200 text-right font-mono text-slate-600 tabular-nums">{item.metrado > 0 ? fmtN(item.metrado) : '—'}</td>
                                    <td className="p-2 border border-slate-200 text-right font-mono text-slate-600 tabular-nums">{item.precio > 0 ? fmtN(item.precio) : '—'}</td>
                                    <td className="p-2 border border-slate-200 text-right font-bold text-blue-800 bg-blue-50/20 tabular-nums">{item.parcial > 0 ? fmtS(item.parcial) : '—'}</td>
                                    <td className="p-2 border border-slate-200 text-center bg-slate-50">
                                        {isLeaf && (
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => onRedistribuir(item.id)} className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Redistribuir uniformemente"><RefreshCw className="w-3 h-3" /></button>
                                                <button onClick={() => onRedistribuirGauss(item.id)} className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Redistribuir con curva Gauss"><TrendingUp className="w-3 h-3" /></button>
                                                <button onClick={() => onLimpiar(item.id)} className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Limpiar distribución"><X className="w-3 h-3" /></button>
                                            </div>
                                        )}
                                    </td>
                                    {periodos.map(p => {
                                        const dist   = item.distribucion?.[p.key];
                                        const monto  = dist?.monto ?? 0;
                                        const isPico = p.key === mesPicoKey;
                                        if (!isLeaf) return (
                                            <td key={p.key} className={`p-2 text-right text-[11px] border border-slate-200 font-semibold tabular-nums ${monto > 0 ? 'text-slate-700' : 'text-slate-200'} ${isPico && monto > 0 ? 'bg-amber-50/30' : ''}`}>
                                                {monto > 0 ? (viewMode === 'monto' ? fmtN(monto) : fmtP(item.parcial > 0 ? (monto / item.parcial) * 100 : 0)) : '—'}
                                            </td>
                                        );
                                        const bloqueada = isPeriodoBloqueado(item, p.key);
                                        return <EditableCell key={p.key} value={monto} viewMode={viewMode} parcial={item.parcial} onChange={v => onEditarCelda(item.id, p.key, v)} isPico={isPico} bloqueada={bloqueada} />;
                                    })}
                                    <td className={`p-2 text-right text-[11px] font-bold border border-slate-200 sticky right-0 z-10 shadow-[-1px_0_4px_rgba(0,0,0,0.05)] tabular-nums ${
                                        totalFila > 0 ? (tieneDesv ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50/60 text-emerald-800') : 'bg-slate-50 text-slate-300'
                                    }`} title={tieneDesv ? `Desvío: S/. ${fmtN(desvio)}` : 'Total acumulado'}>
                                        {totalFila > 0 ? fmtS(totalFila) : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>

                    {/* ══════════════ FOOTER ══════════════ */}
                    <tfoot className="text-[11px]">

                        {/* ════════ BANDA DIVISORIA PARTIDAS → RESUMEN FINANCIERO ════════ */}
                        <tr>
                            <td colSpan={nCols} style={{ padding: 0, border: 'none' }}>
                                <div style={{ background: '#1e293b', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '3px solid #475569', borderBottom: '3px solid #475569' }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                        ▼ RESUMEN FINANCIERO DEL PRESUPUESTO
                                    </span>
                                </div>
                            </td>
                        </tr>

                        {/* ── COSTO DIRECTO ── */}
                        <tr className="bg-slate-100 text-slate-900 font-bold">
                            <td className="p-2 border border-slate-300 text-center text-[10px] text-slate-400" />
                            <td className="p-2 border border-slate-300 text-center text-[10px] text-slate-400" />
                            <td className="p-2.5 border border-slate-300 text-left text-[11px] uppercase tracking-wide sticky left-0 z-10 bg-slate-100">COSTO DIRECTO</td>
                            <td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" />
                            <td className="p-2.5 border border-slate-300 text-right tabular-nums">{costoDirecto > 0 ? fmtS(costoDirecto) : '—'}</td>
                            <td className="p-2 border border-slate-300" />
                            {periodos.map(p => finTd(cdPorPeriodo[p.key] ?? 0, p.key, 'bg-white'))}
                            <td className="p-2.5 border border-slate-300 text-right font-bold tabular-nums sticky right-0 z-10 bg-slate-100">
                                {costoDirecto > 0 ? fmtS(costoDirecto) : '—'}
                            </td>
                        </tr>

                        {/* ── GASTOS GENERALES ── */}
                        <tr className="bg-white text-slate-800">
                            <td className="p-2 border border-slate-300 text-center text-slate-400" />
                            <PctCell value={fin.pctGastosGenerales} onChange={v => setPct('pctGastosGenerales', v)} />
                            <td className="p-2.5 border border-slate-300 text-left text-[11px] uppercase tracking-wide sticky left-0 z-10 bg-white font-semibold">GASTOS GENERALES</td>
                            <td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" />
                            <td className="p-2.5 border border-slate-300 text-right tabular-nums font-semibold">{fmtS(montoGG)}</td>
                            <td className="p-2 border border-slate-300" />
                            {periodos.map(p => finTd(distGG[p.key] ?? 0, p.key, 'bg-white'))}
                            <td className="p-2.5 border border-slate-300 text-right font-semibold tabular-nums sticky right-0 z-10 bg-white">{fmtS(montoGG)}</td>
                        </tr>

                        {/* ── UTILIDAD ── */}
                        <tr className="bg-white text-slate-800">
                            <td className="p-2 border border-slate-300 text-center text-slate-400" />
                            <PctCell value={fin.pctUtilidad} onChange={v => setPct('pctUtilidad', v)} />
                            <td className="p-2.5 border border-slate-300 text-left text-[11px] uppercase tracking-wide sticky left-0 z-10 bg-white font-semibold">UTILIDAD</td>
                            <td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" />
                            <td className="p-2.5 border border-slate-300 text-right tabular-nums font-semibold">{fmtS(montoUT)}</td>
                            <td className="p-2 border border-slate-300" />
                            {periodos.map(p => finTd(distUT[p.key] ?? 0, p.key, 'bg-white'))}
                            <td className="p-2.5 border border-slate-300 text-right font-semibold tabular-nums sticky right-0 z-10 bg-white">{fmtS(montoUT)}</td>
                        </tr>

                        {/* ── SUB TOTAL ── */}
                        <tr className="bg-slate-200 text-slate-900 font-bold">
                            <td colSpan={7} className="p-2.5 text-right border border-slate-300 uppercase tracking-wider text-[10px]">SUB TOTAL</td>
                            <td className="border border-slate-300 bg-slate-300" />
                            {periodos.map(p => finTd(distSub[p.key] ?? 0, p.key, 'bg-slate-50'))}
                            <td className="p-2.5 border border-slate-300 text-right font-bold tabular-nums sticky right-0 z-10 bg-slate-200">{fmtS(subTotal)}</td>
                        </tr>

                        {/* ── I.G.V. ── */}
                        <tr className="bg-white text-slate-800">
                            <td className="p-2 border border-slate-300 text-center text-slate-400" />
                            <PctCell value={fin.pctIGV} onChange={v => setPct('pctIGV', v)} />
                            <td className="p-2.5 border border-slate-300 text-left text-[11px] uppercase tracking-wide sticky left-0 z-10 bg-white font-semibold">I.G.V.</td>
                            <td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" />
                            <td className="p-2.5 border border-slate-300 text-right tabular-nums font-semibold">{fmtS(montoIGV)}</td>
                            <td className="p-2 border border-slate-300" />
                            {periodos.map(p => finTd(distIGV[p.key] ?? 0, p.key, 'bg-white'))}
                            <td className="p-2.5 border border-slate-300 text-right font-semibold tabular-nums sticky right-0 z-10 bg-white">{fmtS(montoIGV)}</td>
                        </tr>

                        {/* ── PRESUPUESTADO COMP. I ── */}
                        <tr className="bg-slate-700 text-white font-bold">
                            <td colSpan={7} className="p-2.5 text-right border border-slate-600 uppercase tracking-wide text-[10px]">PRESUPUESTADO DE OBRA INFRAESTRUCTURA COMPONENTE I</td>
                            <td className="border border-slate-600 bg-slate-800" />
                            {periodos.map(p => finTd(distPresI[p.key] ?? 0, p.key, 'bg-slate-700 text-slate-200'))}
                            <td className="p-2.5 border border-slate-600 text-right font-bold tabular-nums sticky right-0 z-10 bg-slate-800 text-white">{fmtS(presupI)}</td>
                        </tr>

                        {/* SEPARADOR COMPONENTE II */}
                        <tr><td colSpan={nCols} style={{ height: 2, padding: 0, border: 'none', background: '#94a3b8' }} /></tr>

                        {/* ── MOBILIARIO Y EQUIPAMIENTO COMP. II ── */}
                        <tr className="bg-white text-slate-700">
                            <td className="p-2 border border-slate-300 text-center text-[9px] text-slate-400" />
                            <td className="p-2 border border-slate-300 text-center text-[9px] italic text-slate-400">monto</td>
                            <td className="p-2.5 border border-slate-300 text-left text-[11px] uppercase tracking-wide sticky left-0 z-10 bg-white font-semibold">MOBILIARIO Y EQUIPAMIENTO COMPONENTE II</td>
                            <td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" />
                            <MontoCell value={fin.montoMobiliario} onChange={v => setPct('montoMobiliario', v)} />
                            <td className="p-2 border border-slate-300" />
                            {periodos.map(p => <td key={p.key} className="p-2 text-center border border-slate-300 text-slate-300 text-[10px]">—</td>)}
                            <td className="p-2.5 border border-slate-300 text-right font-semibold tabular-nums sticky right-0 z-10 bg-white">
                                {fin.montoMobiliario > 0 ? fmtS(fin.montoMobiliario) : '—'}
                            </td>
                        </tr>

                        {/* ── IGV MOBILIARIO ── */}
                        <tr className="bg-white text-slate-700">
                            <td className="p-2 border border-slate-300 text-center text-slate-400" />
                            <PctCell value={fin.pctIGVMobiliario} onChange={v => setPct('pctIGVMobiliario', v)} />
                            <td className="p-2.5 border border-slate-300 text-left text-[11px] uppercase tracking-wide sticky left-0 z-10 bg-white font-semibold">IGV (MOBILIARIO Y EQUIPAMIENTO)</td>
                            <td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" />
                            <td className="p-2.5 border border-slate-300 text-right tabular-nums font-semibold">{fin.montoMobiliario > 0 ? fmtS(montoIGVMob) : '—'}</td>
                            <td className="p-2 border border-slate-300" />
                            {periodos.map(p => <td key={p.key} className="p-2 text-center border border-slate-300 text-slate-300 text-[10px]">—</td>)}
                            <td className="p-2.5 border border-slate-300 text-right font-semibold tabular-nums sticky right-0 z-10 bg-white">
                                {fin.montoMobiliario > 0 ? fmtS(montoIGVMob) : '—'}
                            </td>
                        </tr>

                        {/* ── SUB TOTAL COMPONENTE II ── */}
                        <tr className="bg-slate-100 text-slate-800 font-bold">
                            <td colSpan={7} className="p-2.5 text-right border border-slate-300 uppercase tracking-wider text-[10px]">SUB TOTAL COMPONENTE II</td>
                            <td className="border border-slate-300 bg-slate-200" />
                            {periodos.map(p => <td key={p.key} className="p-2 text-center border border-slate-300 text-slate-300 text-[10px]">—</td>)}
                            <td className="p-2.5 border border-slate-300 text-right font-bold tabular-nums sticky right-0 z-10 bg-slate-100">
                                {subTotalII > 0 ? fmtS(subTotalII) : '—'}
                            </td>
                        </tr>

                        {/* ── TOTAL PRESUPUESTO COMPONENTE I+II ── */}
                        <tr className="bg-slate-800 text-white font-bold">
                            <td colSpan={7} className="p-2.5 text-right border border-slate-600 uppercase tracking-wide text-[10px]">TOTAL PRESUPUESTO DE OBRA COMPONENTE I+II</td>
                            <td className="border border-slate-600 bg-slate-900" />
                            {periodos.map(p => <td key={p.key} className="p-2 text-center border border-slate-600 text-slate-500 text-[10px]">—</td>)}
                            <td className="p-2.5 border border-slate-600 text-right font-bold tabular-nums text-[12px] sticky right-0 z-10 bg-slate-900">{fmtS(totalI_II)}</td>
                        </tr>

                        {/* SEPARADOR */}
                        <tr><td colSpan={nCols} style={{ height: 2, padding: 0, border: 'none', background: '#94a3b8' }} /></tr>

                        {/* ── GASTOS DE SUPERVISIÓN ── */}
                        <tr className="bg-white text-slate-800">
                            <td className="p-2 border border-slate-300 text-center text-slate-400" />
                            <PctCell value={fin.pctSupervision} onChange={v => setPct('pctSupervision', v)} />
                            <td className="p-2.5 border border-slate-300 text-left text-[11px] uppercase tracking-wide sticky left-0 z-10 bg-white font-semibold">GASTOS DE SUPERVISIÓN Y LIQUIDACIÓN</td>
                            <td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" /><td className="p-2 border border-slate-300" />
                            <td className="p-2.5 border border-slate-300 text-right tabular-nums font-semibold">{fmtS(montoSup)}</td>
                            <td className="p-2 border border-slate-300" />
                            {periodos.map(p => finTd(distSup[p.key] ?? 0, p.key, 'bg-white'))}
                            <td className="p-2.5 border border-slate-300 text-right font-semibold tabular-nums sticky right-0 z-10 bg-white">{fmtS(montoSup)}</td>
                        </tr>

                        {/* ── PRESUPUESTO TOTAL ── */}
                        <tr className="bg-slate-900 text-white font-bold text-[12px]">
                            <td colSpan={7} className="p-3 text-right border border-slate-700 uppercase tracking-widest text-[11px]">PRESUPUESTO TOTAL</td>
                            <td className="border border-slate-700" />
                            {periodos.map(p => {
                                const v = (distPresI[p.key] ?? 0) + (distSup[p.key] ?? 0);
                                return (
                                    <td key={p.key} className={`p-2.5 text-right border border-slate-700 tabular-nums font-bold ${v > 0 ? 'text-slate-200' : 'text-slate-600'} ${p.key === mesPicoKey && v > 0 ? 'ring-1 ring-inset ring-amber-400' : ''}`}>
                                        {v > 0 ? fmtN(v) : '—'}
                                    </td>
                                );
                            })}
                            <td className="p-3 border-2 border-emerald-500 text-right font-bold tabular-nums text-emerald-300 sticky right-0 z-10 bg-slate-900 text-[13px]">
                                {fmtS(presupTotal)}
                            </td>
                        </tr>

                        {/* ════════ BANDA DIVISORIA RESUMEN → VALORIZACIÓN ════════ */}
                        <tr>
                            <td colSpan={nCols} style={{ padding: 0, border: 'none' }}>
                                <div style={{ background: '#0f172a', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '3px solid #334155', borderBottom: '3px solid #334155' }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                        ▼ VALORIZACIÓN Y AVANCE DE OBRA
                                    </span>
                                </div>
                            </td>
                        </tr>

                        {/* ── VALORIZACIÓN MENSUAL (S/.) ── */}
                        <tr className="bg-[#0d2060] text-white font-bold">
                            <td colSpan={7} className="p-2.5 text-right border border-[#1a3070] uppercase tracking-wide text-[10px]">Valorización Mensual (S/.)</td>
                            <td className="border border-[#1a3070] bg-[#081840]" />
                            {periodos.map(p => (
                                <td key={p.key} className={`p-2.5 text-center border border-[#1a3070] tabular-nums ${p.key === mesPicoKey ? 'bg-amber-700' : ''}`}>
                                    {(totales[p.key]?.monto ?? 0) > 0 ? fmtN(totales[p.key].monto) : '—'}
                                </td>
                            ))}
                            <td className="p-2.5 text-center border border-[#1a3070] bg-emerald-900 text-emerald-200 sticky right-0 tabular-nums font-bold">
                                {totalGeneralPeriodos > 0 ? fmtN(totalGeneralPeriodos) : '—'}
                            </td>
                        </tr>

                        {/* ── % AVANCE MENSUAL ── */}
                        <tr className="bg-[#1a2030] text-slate-400 text-[10px]">
                            <td colSpan={7} className="p-2 text-right border border-[#2a3044] uppercase tracking-wider">% Avance Mensual</td>
                            <td className="border border-[#2a3044]" />
                            {periodos.map(p => (
                                <td key={p.key} className="p-2 text-center border border-[#2a3044] tabular-nums">
                                    {(totales[p.key]?.porcentaje ?? 0) > 0 ? `${totales[p.key].porcentaje.toFixed(3)}%` : '—'}
                                </td>
                            ))}
                            <td className="p-2 text-center border border-[#2a3044] bg-[#111824] sticky right-0">—</td>
                        </tr>

                        {/* ── DÍAS TRABAJADOS ── */}
                        {diasPorMes && (
                            <tr className="bg-[#141e38] text-slate-300 text-[10px]">
                                <td colSpan={7} className="p-2 text-right border border-[#1e2a4a] uppercase tracking-wider font-semibold">Días Trabajados</td>
                                <td className="border border-[#1e2a4a]" />
                                {periodos.map(p => {
                                    const dias = diasPorMes[p.key] ?? 0;
                                    return <td key={p.key} className="p-2 text-center border border-[#1e2a4a] font-mono tabular-nums">{dias > 0 ? dias : '—'}</td>;
                                })}
                                <td className="p-2 text-center border border-[#1e2a4a] bg-[#0c1428] sticky right-0">—</td>
                            </tr>
                        )}

                        {/* ── VALORIZACIÓN ACUMULADA (S/.) ── */}
                        <tr className="bg-[#0a2e1a] text-white font-bold">
                            <td colSpan={7} className="p-2.5 text-right border border-[#0e4025] uppercase tracking-wide text-[10px]">Valorización Acumulada (S/.)</td>
                            <td className="border border-[#0e4025] bg-[#062010]" />
                            {periodos.map(p => (
                                <td key={p.key} className="p-2.5 text-center border border-[#0e4025] text-emerald-300 tabular-nums">
                                    {(totales[p.key]?.acumuladoMonto ?? 0) > 0 ? fmtN(totales[p.key].acumuladoMonto) : '—'}
                                </td>
                            ))}
                            <td className="p-2.5 text-center border border-[#0e4025] bg-[#062010] text-emerald-200 sticky right-0 tabular-nums">
                                {totalAcumuladoFinal > 0 ? fmtN(totalAcumuladoFinal) : '—'}
                            </td>
                        </tr>

                        {/* ── % AVANCE ACUMULADO (CURVA S) ── */}
                        <tr className="bg-[#0a1e10] text-slate-400 text-[10px]">
                            <td colSpan={7} className="p-2 text-right border border-[#0e2a18] uppercase tracking-wider">% Avance Acumulado (Curva S)</td>
                            <td className="border border-[#0e2a18]" />
                            {periodos.map(p => {
                                const pct = totales[p.key]?.acumuladoPorcentaje ?? 0;
                                return (
                                    <td key={p.key} className="p-2 text-center border border-[#0e2a18] tabular-nums">
                                        {pct > 0 ? <span className="text-emerald-400 font-bold">{pct.toFixed(2)}%</span> : '—'}
                                    </td>
                                );
                            })}
                            <td className="p-2 text-center border border-[#0e2a18] bg-[#062010] sticky right-0">
                                {totalAcumuladoFinal > 0 && totalPresupuesto > 0
                                    ? <span className="text-emerald-400 font-bold">{((totalAcumuladoFinal / totalPresupuesto) * 100).toFixed(2)}%</span>
                                    : '—'}
                            </td>
                        </tr>



                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default TablaValorizada;