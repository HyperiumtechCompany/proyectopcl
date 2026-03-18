import React, { useState } from 'react';
import { GGFijosDesagregadoEditor } from './GGFijosDesagregadoEditor';
import { RefreshCw, Calendar, DollarSign, Clock, Info } from 'lucide-react';
import { useProjectParamsStore } from '../stores/projectParamsStore';
import { useGGVariablesStore } from '../stores/ggVariablesStore';
import { useShallow } from 'zustand/react/shallow';

interface GGFijosPanelProps {
    projectId: number;
}

export function GGFijosDesagregadoPanel({ projectId }: GGFijosPanelProps) {
    const duracionDias = useProjectParamsStore((s) => s.getDuracionDias());
    const duracionMeses = useProjectParamsStore((s) => s.getDuracionMeses());
    const costoDirecto = useProjectParamsStore((s) => s.getCostoDirecto());

    // GG Variables Totals for SCTR and Essalud (2.01 and 2.02)
    const ggNodes = useGGVariablesStore((s) => s.nodes);
    const ggTotals = useGGVariablesStore(useShallow((s) => s.getSectionTotals()));
    
    const section21 = ggNodes.find(n => n.item_codigo === '2.01' || n.item_codigo === '02.01');
    const section22 = ggNodes.find(n => n.item_codigo === '2.02' || n.item_codigo === '02.02');
    
    const total21 = section21?.id ? (ggTotals[String(section21.id)] || 0) : 0;
    const total22 = section22?.id ? (ggTotals[String(section22.id)] || 0) : 0;

    const calculationTypes = [
        'fianza_fiel_cumplimiento',
        'fianza_adelanto_efectivo',
        'fianza_adelanto_materiales',
        'poliza_car',
        'poliza_sctr',
        'poliza_essalud_vida',
        'sencico',
        'itf',
    ];

    const [syncTrigger, setSyncTrigger] = useState(0);

    const handleSync = () => {
        setSyncTrigger(prev => prev + 1);
    };

    return (
        <div className="flex h-full flex-col bg-slate-950">
            {/* Header / Stats Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 p-4 backdrop-blur-sm sticky top-0 z-30">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-sky-500/10 p-2 text-sky-500">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Presupuesto Base</p>
                            <p className="font-mono text-sm font-black text-sky-400">
                                S/. {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(costoDirecto)}
                            </p>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-slate-800" />

                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Plazo</p>
                            <p className="text-sm font-black text-white">{duracionDias} <span className="text-[10px] text-slate-500">DÍAS</span></p>
                        </div>
                    </div>
                    
                    <div className="h-8 w-px bg-slate-800" />

                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
                             <Info className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sueldos + Beneficios</p>
                            <p className="text-sm font-black text-emerald-400">S/. {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(total21 + total22)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <p className="text-[9px] text-slate-500 italic max-w-[200px] text-right">
                        Los cálculos se actualizan automáticamente al detectar cambios en el presupuesto o personal.
                    </p>
                    <button
                        onClick={handleSync}
                        className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700 active:scale-95 border border-slate-700"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Forzar Sincro
                    </button>
                </div>
            </div>

            {/* Vertically Combined Tables */}
            <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar bg-slate-950">
                <div className="w-full">
                    <div className="mb-6 flex items-center gap-4 px-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
                        <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-500 uppercase">Configuración de Gastos Generales Fijos</h2>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        {calculationTypes.map((type) => (
                            <section key={type} className="scroll-mt-24">
                                <GGFijosDesagregadoEditor
                                    projectId={projectId}
                                    tipoCalculo={type}
                                    syncTrigger={syncTrigger}
                                    totalSueldos={total21}
                                    totalBeneficios={total22}
                                />
                            </section>
                        ))}
                    </div>

                    <div className="h-20" /> {/* Extra spacing at bottom */}
                </div>
            </div>
        </div>
    );
}
