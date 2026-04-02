import type {
    SortingState
} from '@tanstack/react-table';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable
} from '@tanstack/react-table';
import axios from 'axios';
import { Loader2, Package, Users, Wrench, Briefcase, Layers, Search, Edit3 } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { ReemplazarInsumoModal } from './ReemplazarInsumoModal';

interface InsumosPanelProps {
    projectId: number;
}

const TABS = [
    { key: 'mano_de_obra', label: 'Mano de Obra', icon: Users },
    { key: 'materiales', label: 'Materiales', icon: Package },
    { key: 'equipos', label: 'Equipos', icon: Wrench },
    { key: 'subcontratos', label: 'Sub-contratos', icon: Briefcase },
    { key: 'subpartidas', label: 'Sub-partidas', icon: Layers },
];

export function InsumosPanel({ projectId }: InsumosPanelProps) {
    const [activeTab, setActiveTab] = useState(TABS[0].key);
    const [insumos, setInsumos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [usadosOnly, setUsadosOnly] = useState(true);
    const [especialidad, setEspecialidad] = useState('todas');
    const [especialidadesList, setEspecialidadesList] = useState<{value: string, label: string}[]>([]);

    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState<SortingState>([]);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [targetInsumo, setTargetInsumo] = useState<any>(null);

    const fetchInsumos = () => {
        let isMounted = true;
        setLoading(true);
        const url = `/costos/proyectos/${projectId}/presupuesto/insumos/search?tipo=${activeTab}${usadosOnly ? '&usados_only=1' : ''}${usadosOnly && especialidad !== 'todas' ? `&especialidad=${especialidad}` : ''}`;
        axios.get(url)
            .then(res => {
                if (isMounted && res.data?.success) {
                    setInsumos(res.data.productos || []);
                }
            })
            .catch(err => {
                console.error(err);
                if (isMounted) setInsumos([]);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    };

    useEffect(() => {
        fetchInsumos();
    }, [projectId, activeTab, usadosOnly, especialidad]);

    useEffect(() => {
        let isMounted = true;
        axios.get(`/costos/proyectos/${projectId}/presupuesto/insumos/especialidades`)
            .then(res => {
                if (isMounted && res.data?.success) {
                    setEspecialidadesList(res.data.especialidades || []);
                }
            })
            .catch(err => console.error(err));
        return () => { isMounted = false; };
    }, [projectId]);

    const columnHelper = createColumnHelper<any>();

    const columns = useMemo(() => {
        const cols = [
            columnHelper.accessor('codigo', {
                header: 'Código',
                cell: info => <span className="font-mono text-slate-400">{info.getValue() || '-'}</span>,
                enableSorting: true,
                size: 100,
            }),
            columnHelper.accessor('descripcion', {
                header: 'Descripción',
                cell: info => {
                    const row = info.row.original;
                    return (
                        <div className="flex items-center group/desc gap-2">
                            <span className="font-medium text-slate-200">{info.getValue()}</span>
                            {usadosOnly && (
                                <button 
                                    onClick={() => {
                                        setTargetInsumo(row);
                                        setIsModalOpen(true);
                                    }}
                                    className="opacity-0 group-hover/desc:opacity-100 p-1 text-slate-500 hover:text-sky-400 bg-slate-800 rounded-md transition-all ml-auto"
                                    title="Editar o reemplazar insumo"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    );
                },
                enableSorting: true,
            }),
            columnHelper.accessor('unidad_nombre', {
                header: 'Unidad',
                cell: info => <span className="text-slate-400">{info.getValue() ?? (info.row.original.unidad?.abreviatura_unidad ?? info.row.original.unidad?.descripcion_singular ?? '-')}</span>,
                enableSorting: false,
                size: 80,
            }),
            columnHelper.accessor('proveedor', {
                header: 'Proveedor',
                cell: info => <span className="text-slate-500 text-[10px] bg-slate-800 px-2 py-0.5 rounded">{info.getValue() || info.row.original.tipo_proveedor}</span>,
                enableSorting: true,
                size: 150,
            }),
        ];

        if (usadosOnly) {
            cols.push(
                columnHelper.accessor('cantidad', {
                    header: 'Cantidad',
                    cell: info => <span className="text-amber-400/90 font-mono">{new Intl.NumberFormat('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(info.getValue() ?? 0)}</span>,
                    enableSorting: true,
                    size: 100,
                })
            );
        }

        cols.push(
            columnHelper.accessor('precio', {
                header: 'Costo (S/)',
                cell: info => <span className="text-emerald-400 font-mono font-bold">{new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(info.getValue() ?? 0)}</span>,
                enableSorting: true,
                size: 100,
            })
        );

        if (usadosOnly) {
            cols.push(
                columnHelper.accessor('total', {
                    header: 'Total (S/)',
                    cell: info => <span className="text-sky-400 font-mono font-bold">{new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(info.getValue() ?? 0)}</span>,
                    enableSorting: true,
                    size: 100,
                })
            );
        }

        return cols;
    }, [usadosOnly]);

    const table = useReactTable({
        data: insumos,
        columns,
        state: {
            globalFilter,
            sorting,
        },
        onGlobalFilterChange: setGlobalFilter,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    // Calculate aggregated totals
    const grandTotal = useMemo(() => {
        if (!usadosOnly) return 0;
        return table.getFilteredRowModel().rows.reduce((sum, row) => sum + (row.original.total || 0), 0);
    }, [table.getFilteredRowModel().rows, usadosOnly]);

    return (
        <div className="flex h-full flex-col bg-slate-900 border border-slate-700/50 rounded-lg overflow-hidden relative">
            <div className="flex flex-col border-b border-slate-700 bg-slate-800/80 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-slate-200 uppercase">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]"></span>
                        {usadosOnly ? 'Lista de insumos del proyecto' : 'Catálogo Maestro de Insumos'}
                    </h2>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter group-hover:text-slate-300 transition-colors">
                            {usadosOnly ? 'Ver Todo el Catálogo' : 'Ver solo usados'}
                        </span>
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={usadosOnly}
                                onChange={() => {
                                    setUsadosOnly(!usadosOnly);
                                    setGlobalFilter('');
                                }}
                            />
                            <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-600"></div>
                        </div>
                    </label>
                </div>

                <div className="flex items-center justify-between mt-2 gap-4">
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase transition-all whitespace-nowrap ${
                                        isActive
                                            ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/40 translate-y-px'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700/50'
                                    }`}
                                >
                                    <Icon size={14} className={isActive ? 'text-white' : 'text-slate-500'} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2">
                        {usadosOnly && (
                            <div className="relative">
                                <select 
                                    className="appearance-none bg-slate-950/50 border border-slate-700 rounded-md py-1.5 pl-3 pr-8 text-[11px] text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-semibold uppercase min-w-[140px] cursor-pointer hover:bg-slate-900"
                                    value={especialidad}
                                    onChange={(e) => setEspecialidad(e.target.value)}
                                >
                                    <option value="todas">Todas las Especialidades</option>
                                    {especialidadesList.map((esp, i) => (
                                        <option key={i} value={esp.value}>{esp.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        )}
                        <div className="relative w-64 min-w-48">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                            <input
                                type="text"
                                value={globalFilter ?? ''}
                                onChange={e => setGlobalFilter(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-xs text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium placeholder-slate-600"
                                placeholder="Buscar en columnas..."
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="custom-scrollbar flex-1 overflow-auto bg-slate-900/50">
                <table className="w-full border-collapse text-left text-[11px]">
                    <thead className="sticky top-0 z-10 bg-slate-800/95 text-[10px] font-bold tracking-wider text-slate-400 uppercase backdrop-blur-md">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th 
                                        key={header.id} 
                                        className="border-b border-slate-700 p-2.5 px-4 cursor-pointer select-none hover:bg-slate-700/50 transition-colors"
                                        onClick={header.column.getToggleSortingHandler()}
                                        style={{ width: header.getSize() !== 150 ? header.getSize() : 'auto' }}
                                    >
                                        <div className="flex items-center gap-1">
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            {{
                                                asc: ' ↑',
                                                desc: ' ↓',
                                            }[header.column.getIsSorted() as string] ?? null}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} className="p-12 text-center text-slate-400">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-500 mb-3" />
                                    <p className="text-xs uppercase tracking-widest font-semibold">Cargando Insumos...</p>
                                </td>
                            </tr>
                        ) : table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="p-12 text-center text-slate-500">
                                    <Package className="mx-auto h-12 w-12 text-slate-700 mb-3" />
                                    <p className="text-xs">No se encontraron insumos.</p>
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map(row => (
                                <tr key={row.id} className="transition-colors hover:bg-slate-800/40 group">
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="p-2 px-4">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                        
                        {/* Resumen Total general visible solo cuando count > 0 y usadosOnly = true */}
                        {!loading && usadosOnly && table.getRowModel().rows.length > 0 && (
                            <tr className="bg-slate-800/80 sticky bottom-0 text-[11px] font-bold text-white shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
                                <td colSpan={6} className="p-3 px-4 text-right border-t border-slate-700">SUBTOTAL {TABS.find(t => t.key === activeTab)?.label.toUpperCase()} =</td>
                                <td className="p-3 px-4 text-sky-400 font-mono text-[12px] border-t border-slate-700 border-l">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(grandTotal)}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Reemplazar */}
            <ReemplazarInsumoModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                projectId={projectId}
                targetInsumo={targetInsumo}
                tipo={activeTab}
                onSuccess={() => {
                    fetchInsumos();
                }}
            />
        </div>
    );
}
