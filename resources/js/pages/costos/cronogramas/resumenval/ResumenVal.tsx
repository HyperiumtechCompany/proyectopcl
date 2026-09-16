import { Head, router } from '@inertiajs/react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { parentCodes } from '@/lib/partidaTree';
import CronogramaNavTabs, { type CronogramaEstado } from '../components/CronogramaNavTabs';

interface Periodo { label: string; labelCal: string; key: string; end?: string }

interface ItemResumenVal {
    id:                        string;
    item:                      string;
    descripcion:               string;
    und:                       string;
    parcial:                   number;
    ejecutadoAcumuladoAnterior: number;
    ejecutadoMensual:          number;
    ejecutadoAcumulado:        number;
    pctEjecutadoAcumulado:     number;
    nivel:                     number;
    isLeaf:                    boolean;
}

interface FilaCascada {
    etiqueta:          string;
    contratado:        number;
    acumuladoAnterior: number;
    actual:            number;
    acumuladoActual:   number;
    saldo:             number;
}

interface ResumenValProps {
    project:             string;
    projectName:         string;
    modoCalculo:         'calendario' | '30dias';
    periodos:            Periodo[];
    periodoSeleccionado: string | null;
    items:               ItemResumenVal[];
    filasCascada:        FilaCascada[];
    pct:                 { pctGastosGenerales: number; pctUtilidad: number; pctIGV: number };
    sinProgramado:       boolean;
    sinEjecutado:        boolean;
    estado?:             CronogramaEstado;
}

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

export default function ResumenVal(props: ResumenValProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const toggleCollapse = useCallback((code: string) => {
        setCollapsed(prev => {
            const n = new Set(prev);
            if (n.has(code)) n.delete(code); else n.add(code);
            return n;
        });
    }, []);

    const cambiarPeriodo = (periodoKey: string) => {
        router.get('/module/resumen_val', { project: props.project, modo: props.modoCalculo, periodo: periodoKey }, { preserveState: true });
    };

    const visibleItems = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        let items = props.items;

        if (q) {
            const matchCodes = new Set(
                props.items.filter(it => it.descripcion.toLowerCase().includes(q) || it.item.toLowerCase().includes(q)).map(it => it.item)
            );
            const keepCodes = new Set<string>();
            matchCodes.forEach(code => {
                keepCodes.add(code);
                parentCodes(code).forEach(pc => keepCodes.add(pc));
                props.items.forEach(it => { if (it.item.startsWith(`${code}.`)) keepCodes.add(it.item); });
            });
            items = props.items.filter(it => keepCodes.has(it.item));
        }

        return items.filter(it => {
            for (const col of collapsed) {
                if (it.item.startsWith(`${col}.`)) return false;
            }
            return true;
        });
    }, [props.items, searchTerm, collapsed]);

    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: 'Resumen de Valorización', href: '#' },
    ];

    const faltaDatos = props.sinProgramado || props.sinEjecutado;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Resumen de Valorización — ${props.projectName}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-900">
                <CronogramaNavTabs project={props.project} modoCalculo={props.modoCalculo} active="resumenVal" estado={props.estado} />
                <div className="max-w-[1900px] mx-auto">

                    <div className="mb-4 flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                        <div>
                            <h1 className="text-sm font-black text-slate-700 uppercase tracking-wide">Resumen de Valorización por Componentes</h1>
                            <p className="text-xs text-slate-500 mt-0.5">Ejecutado real, acumulado hasta el corte — por partida y por componente financiero.</p>
                        </div>
                        {props.periodos.length > 0 && (
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Corte al:</label>
                                <select
                                    value={props.periodoSeleccionado ?? ''}
                                    onChange={e => cambiarPeriodo(e.target.value)}
                                    className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700"
                                >
                                    {props.periodos.map(p => <option key={p.key} value={p.key}>{p.label} ({p.labelCal})</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {faltaDatos && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                            {props.sinProgramado && <div>⚠ Aún no se guardó el <strong>Valorizado programado</strong>.</div>}
                            {props.sinEjecutado && <div>⚠ Aún no se guardó ningún <strong>Avance Real</strong> — todo saldrá en cero hasta que captures avance.</div>}
                        </div>
                    )}

                    <div className="mb-4 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar partida..."
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white shadow-sm focus:border-blue-400 focus:outline-none"
                        />
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto mb-4">
                        <table className="min-w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-600 font-black uppercase tracking-wide">
                                    <th className="px-3 py-2 text-left sticky left-0 bg-slate-100 z-10">Item</th>
                                    <th className="px-3 py-2 text-left min-w-[220px]">Descripción</th>
                                    <th className="px-2 py-2 text-center">Und</th>
                                    <th className="px-2 py-2 text-right">Monto Contratado</th>
                                    <th className="px-2 py-2 text-right border-l border-slate-200">Acumulado Anterior</th>
                                    <th className="px-2 py-2 text-right">Actual</th>
                                    <th className="px-2 py-2 text-right">Acumulado Actual</th>
                                    <th className="px-2 py-2 text-right border-l border-slate-200">% Saldo</th>
                                    <th className="px-2 py-2 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleItems.map(it => {
                                    const n = it.nivel;
                                    const isCollapsed = collapsed.has(it.item);
                                    const rowBg = !it.isLeaf
                                        ? (n === 0 ? 'bg-slate-800 text-white' : n === 1 ? 'bg-slate-200 text-slate-900' : 'bg-slate-100 text-slate-800')
                                        : '';
                                    const saldo = it.parcial - it.ejecutadoAcumulado;
                                    const pctSaldo = it.parcial > 0 ? (saldo / it.parcial) * 100 : 0;

                                    return (
                                        <tr key={it.id} className={`border-t border-slate-100 ${rowBg} ${it.isLeaf ? 'hover:bg-slate-50' : ''}`}>
                                            <td className={`px-3 py-1.5 font-semibold sticky left-0 z-10 ${rowBg || 'bg-white text-slate-700'}`} style={{ paddingLeft: `${8 + n * 18}px` }}>
                                                <div className="flex items-center gap-1.5">
                                                    {!it.isLeaf ? (
                                                        <button onClick={() => toggleCollapse(it.item)} className="shrink-0 opacity-70 hover:opacity-100">
                                                            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                                        </button>
                                                    ) : <span className="w-[13px] shrink-0" />}
                                                    {it.item}
                                                </div>
                                            </td>
                                            <td className={`px-3 py-1.5 ${it.isLeaf ? 'italic text-slate-600' : 'font-bold'}`}>{it.descripcion}</td>
                                            <td className="px-2 py-1.5 text-center text-slate-500">{it.und}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{fmt(it.parcial)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono border-l border-slate-100">{fmt(it.ejecutadoAcumuladoAnterior)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{fmt(it.ejecutadoMensual)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono font-bold text-emerald-700">{fmt(it.ejecutadoAcumulado)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-slate-500 border-l border-slate-100">{fmtPct(pctSaldo)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{fmt(saldo)}</td>
                                        </tr>
                                    );
                                })}
                                {visibleItems.length === 0 && (
                                    <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">No hay partidas que mostrar.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                        <table className="min-w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-600 font-black uppercase tracking-wide">
                                    <th className="px-3 py-2 text-left">Componente</th>
                                    <th className="px-2 py-2 text-right">Monto Contratado</th>
                                    <th className="px-2 py-2 text-right">Acumulado Anterior</th>
                                    <th className="px-2 py-2 text-right">Actual</th>
                                    <th className="px-2 py-2 text-right">Acumulado Actual</th>
                                    <th className="px-2 py-2 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.filasCascada.map(f => {
                                    const esTotal = f.etiqueta === 'MONTO TOTAL VALORIZADO';
                                    return (
                                        <tr key={f.etiqueta} className={`border-t border-slate-100 ${esTotal ? 'bg-emerald-50 font-black' : ''}`}>
                                            <td className="px-3 py-1.5 font-bold text-slate-700">
                                                {f.etiqueta}
                                                {f.etiqueta === 'GASTOS GENERALES' && <span className="ml-1 text-[10px] text-slate-400 font-normal">({props.pct.pctGastosGenerales.toFixed(2)}%)</span>}
                                                {f.etiqueta === 'UTILIDAD' && <span className="ml-1 text-[10px] text-slate-400 font-normal">({props.pct.pctUtilidad.toFixed(2)}%)</span>}
                                                {f.etiqueta === 'IGV' && <span className="ml-1 text-[10px] text-slate-400 font-normal">({props.pct.pctIGV.toFixed(2)}%)</span>}
                                            </td>
                                            <td className="px-2 py-1.5 text-right font-mono">{fmt(f.contratado)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{fmt(f.acumuladoAnterior)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{fmt(f.actual)}</td>
                                            <td className={`px-2 py-1.5 text-right font-mono ${esTotal ? 'text-emerald-700' : ''}`}>{fmt(f.acumuladoActual)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{fmt(f.saldo)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
