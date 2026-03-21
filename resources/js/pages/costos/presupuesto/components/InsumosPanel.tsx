import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Package, Users, Wrench, Briefcase, Layers } from 'lucide-react';
import type { InsumoProducto } from '@/types/presupuestos';

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
    const [insumos, setInsumos] = useState<InsumoProducto[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        axios.get(`/costos/proyectos/${projectId}/presupuesto/insumos/search?tipo=${activeTab}`)
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
    }, [projectId, activeTab]);

    return (
        <div className="flex h-full flex-col bg-slate-900 border border-slate-700/50 rounded-lg overflow-hidden relative">
            <div className="flex flex-col border-b border-slate-700 bg-slate-800/80 px-4 py-3 backdrop-blur-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-slate-200 uppercase">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]"></span>
                    Catálogo de Insumos
                </h2>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
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
            </div>

            <div className="custom-scrollbar flex-1 overflow-auto">
                <div className="min-w-[800px]">
                    <table className="w-full border-collapse text-left text-[11px]">
                        <thead className="sticky top-0 z-10 bg-slate-800/95 text-[10px] font-bold tracking-wider text-slate-400 uppercase backdrop-blur-md">
                            <tr>
                                <th className="border-b border-slate-700 p-3 w-28 pl-4">Código</th>
                                <th className="border-b border-slate-700 p-3">Descripción</th>
                                <th className="border-b border-slate-700 p-3 w-32">Unidad</th>
                                <th className="border-b border-slate-700 p-3 w-56">Diccionario</th>
                                <th className="border-b border-slate-700 p-3 w-32 text-right pr-4">Precio (S/)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-400">
                                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-500 mb-3" />
                                        <p className="text-xs uppercase tracking-widest font-semibold">Cargando Insumos...</p>
                                    </td>
                                </tr>
                            ) : insumos.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500">
                                        <Package className="mx-auto h-12 w-12 text-slate-700 mb-3" />
                                        <p className="text-xs">No se encontraron insumos de este tipo.</p>
                                    </td>
                                </tr>
                            ) : (
                                insumos.map(insumo => (
                                    <tr key={insumo.id} className="transition-colors hover:bg-slate-800/30 group">
                                        <td className="p-3 pl-4 font-mono text-[10px] text-slate-500 group-hover:text-slate-400">{insumo.codigo || '-'}</td>
                                        <td className="p-3 text-slate-200 font-medium">{insumo.descripcion}</td>
                                        <td className="p-3 text-slate-400">{insumo.unidad?.descripcion_singular ?? insumo.unidad?.abreviatura_unidad ?? '-'}</td>
                                        <td className="p-3 text-slate-400 truncate max-w-[200px]" title={insumo.diccionario ? `${insumo.diccionario.codigo} - ${insumo.diccionario.descripcion}` : '-'}>
                                            {insumo.diccionario ? (
                                                <span className="bg-slate-800/80 px-2 py-0.5 rounded text-[10px] whitespace-nowrap overflow-hidden text-ellipsis block text-slate-400">
                                                    <strong className="text-slate-300">{insumo.diccionario.codigo}</strong> - {insumo.diccionario.descripcion}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="p-3 pr-4 text-right font-mono font-bold text-emerald-400">
                                            {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(insumo.precio ?? 0)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
