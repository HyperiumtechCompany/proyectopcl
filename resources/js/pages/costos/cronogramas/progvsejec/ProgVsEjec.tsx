import { Head, router } from '@inertiajs/react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { parentCodes } from '@/lib/partidaTree';
import CronogramaNavTabs, { type CronogramaEstado } from '../components/CronogramaNavTabs';

interface Periodo { label: string; labelCal: string; key: string; end?: string }

interface ItemProgVsEjec {
    id:                        string;
    item:                      string;
    descripcion:               string;
    und:                       string;
    metradoContratado:         number;
    metradoEjecutadoAcumulado: number;
    metradoEjecutadoMensual:   number;
    parcial:                   number;
    programadoMensual:         number;
    programadoAcumulado:       number;
    ejecutadoMensual:          number;
    ejecutadoAcumulado:        number;
    pctProgramadoAcumulado:    number;
    pctEjecutadoAcumulado:     number;
    desviacion:                number;
    estado:                    'ATRASADA' | 'CULMINADA' | 'ADELANTADA';
    nivel:                     number;
    isLeaf:                    boolean;
}

interface ProgVsEjecProps {
    project:              string;
    projectName:          string;
    modoCalculo:          'calendario' | '30dias';
    periodos:             Periodo[];
    periodoSeleccionado:  string | null;
    items:                ItemProgVsEjec[];
    sinProgramado:        boolean;
    sinEjecutado:         boolean;
    estado?:              CronogramaEstado;
}

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

const estadoBadge: Record<ItemProgVsEjec['estado'], string> = {
    ATRASADA: 'bg-rose-100 text-rose-700 border-rose-200',
    CULMINADA: 'bg-blue-100 text-blue-700 border-blue-200',
    ADELANTADA: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function ProgVsEjec(props: ProgVsEjecProps) {
    const breadcrumbs = [
        { title: 'Costos', href: '/costos' },
        { title: props.projectName || `Proyecto ${props.project}`, href: `/costos/${props.project}` },
        { title: 'Programado vs. Ejecutado', href: '#' },
    ];

    const faltaDatos = props.sinProgramado || props.sinEjecutado;
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
        router.get('/module/prog_vs_ejec', {
            project: props.project,
            modo: props.modoCalculo,
            periodo: periodoKey,
        }, { preserveState: true });
    };

    // Solo hojas — items también trae las filas de grupo (rollup), sumarlas
    // de nuevo aquí duplicaría cada monto.
    const totales = props.items.filter(it => it.isLeaf).reduce((acc, it) => ({
        parcial: acc.parcial + it.parcial,
        progAcum: acc.progAcum + it.programadoAcumulado,
        ejecAcum: acc.ejecAcum + it.ejecutadoAcumulado,
    }), { parcial: 0, progAcum: 0, ejecAcum: 0 });

    // Visible = pasa la búsqueda (coincide o es ancestro/descendiente de una
    // coincidencia, para no perder el contexto del árbol) Y no está oculto
    // por un colapso. Los montos no se recalculan al buscar — ya vienen
    // sumados desde el servidor sobre TODOS los descendientes reales.
    const visibleItems = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        let items = props.items;

        if (q) {
            const matchCodes = new Set(
                props.items
                    .filter(it => it.descripcion.toLowerCase().includes(q) || it.item.toLowerCase().includes(q))
                    .map(it => it.item)
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Programado vs. Ejecutado — ${props.projectName}`} />

            <div className="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-900">
                <CronogramaNavTabs project={props.project} modoCalculo={props.modoCalculo} active="progvsejec" estado={props.estado} />
                <div className="max-w-[1900px] mx-auto">

                    <div className="mb-4 flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                        <div>
                            <h1 className="text-sm font-black text-slate-700 uppercase tracking-wide">
                                Avance Programado vs. Ejecutado
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Por partida, acumulado hasta el periodo de corte seleccionado.
                            </p>
                        </div>
                        {props.periodos.length > 0 && (
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Corte al:</label>
                                <select
                                    value={props.periodoSeleccionado ?? ''}
                                    onChange={e => cambiarPeriodo(e.target.value)}
                                    className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700"
                                >
                                    {props.periodos.map(p => (
                                        <option key={p.key} value={p.key}>{p.label} ({p.labelCal})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {faltaDatos && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                            {props.sinProgramado && <div>⚠ Aún no se guardó el <strong>Valorizado programado</strong> — la columna Programado saldrá en cero hasta que lo guardes.</div>}
                            {props.sinEjecutado && <div>⚠ Aún no se guardó ningún <strong>Avance Real</strong> — la columna Ejecutado saldrá en cero hasta que captures avance.</div>}
                        </div>
                    )}

                    <div className="mb-4 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar partida..."
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white shadow-sm focus:border-amber-400 focus:outline-none"
                        />
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                        <table className="min-w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-600 font-black uppercase tracking-wide">
                                    <th className="px-3 py-2 text-left sticky left-0 bg-slate-100 z-10">Item</th>
                                    <th className="px-3 py-2 text-left min-w-[200px]">Descripción</th>
                                    <th className="px-2 py-2 text-center">Und</th>
                                    <th className="px-2 py-2 text-right">Metrado Contrat.</th>
                                    <th className="px-2 py-2 text-right">Metrado Ejec. Acum.</th>
                                    <th className="px-2 py-2 text-right border-l border-slate-200">Prog. Mensual</th>
                                    <th className="px-2 py-2 text-right">Prog. Acumulado</th>
                                    <th className="px-2 py-2 text-right">% Prog. Acum.</th>
                                    <th className="px-2 py-2 text-right border-l border-slate-200">Ejec. Mensual</th>
                                    <th className="px-2 py-2 text-right">Ejec. Acumulado</th>
                                    <th className="px-2 py-2 text-right">% Ejec. Acum.</th>
                                    <th className="px-2 py-2 text-right border-l border-slate-200">Desviación</th>
                                    <th className="px-2 py-2 text-center">Situación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleItems.map(it => {
                                    const n = it.nivel;
                                    const isCollapsed = collapsed.has(it.item);
                                    const rowBg = !it.isLeaf
                                        ? (n === 0 ? 'bg-slate-800 text-white' : n === 1 ? 'bg-slate-200 text-slate-900' : 'bg-slate-100 text-slate-800')
                                        : '';

                                    return (
                                        <tr key={it.id} className={`border-t border-slate-100 ${rowBg} ${it.isLeaf ? 'hover:bg-slate-50' : ''}`}>
                                            <td
                                                className={`px-3 py-1.5 font-semibold sticky left-0 z-10 ${rowBg || 'bg-white text-slate-700'}`}
                                                style={{ paddingLeft: `${8 + n * 18}px` }}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    {!it.isLeaf ? (
                                                        <button
                                                            onClick={() => toggleCollapse(it.item)}
                                                            className="shrink-0 opacity-70 hover:opacity-100"
                                                            title={isCollapsed ? 'Expandir' : 'Colapsar'}
                                                        >
                                                            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                                        </button>
                                                    ) : (
                                                        <span className="w-[13px] shrink-0" />
                                                    )}
                                                    {it.item}
                                                </div>
                                            </td>
                                            <td className={`px-3 py-1.5 ${it.isLeaf ? 'italic text-slate-600' : 'font-bold'}`}>{it.descripcion}</td>
                                            <td className="px-2 py-1.5 text-center text-slate-500">{it.und}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-slate-500">{it.isLeaf ? it.metradoContratado.toLocaleString('es-PE', { maximumFractionDigits: 4 }) : ''}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-slate-500">{it.isLeaf ? it.metradoEjecutadoAcumulado.toLocaleString('es-PE', { maximumFractionDigits: 4 }) : ''}</td>
                                            <td className="px-2 py-1.5 text-right font-mono border-l border-slate-100">{fmt(it.programadoMensual)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{fmt(it.programadoAcumulado)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono font-bold">{fmtPct(it.pctProgramadoAcumulado)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono border-l border-slate-100">{fmt(it.ejecutadoMensual)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{fmt(it.ejecutadoAcumulado)}</td>
                                            <td className={`px-2 py-1.5 text-right font-mono font-bold ${it.isLeaf ? 'text-emerald-700' : ''}`}>{fmtPct(it.pctEjecutadoAcumulado)}</td>
                                            <td className={`px-2 py-1.5 text-right font-mono font-bold border-l border-slate-100 ${it.desviacion < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {it.desviacion >= 0 ? '+' : ''}{fmtPct(it.desviacion)}
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${estadoBadge[it.estado]}`}>
                                                    {it.estado}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {visibleItems.length === 0 && (
                                    <tr>
                                        <td colSpan={13} className="px-3 py-8 text-center text-slate-400">
                                            No hay partidas que mostrar.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {props.items.length > 0 && (
                                <tfoot>
                                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-black text-slate-700">
                                        <td colSpan={6} className="px-3 py-2 sticky left-0 bg-slate-50 z-10">TOTAL</td>
                                        <td className="px-2 py-2 text-right font-mono">{fmt(totales.progAcum)}</td>
                                        <td className="px-2 py-2 text-right font-mono">
                                            {totales.parcial > 0 ? fmtPct(totales.progAcum / totales.parcial * 100) : '—'}
                                        </td>
                                        <td className="px-2 py-2 border-l border-slate-200" />
                                        <td className="px-2 py-2 text-right font-mono">{fmt(totales.ejecAcum)}</td>
                                        <td className="px-2 py-2 text-right font-mono text-emerald-700">
                                            {totales.parcial > 0 ? fmtPct(totales.ejecAcum / totales.parcial * 100) : '—'}
                                        </td>
                                        <td className="px-2 py-2 border-l border-slate-200" colSpan={2} />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
