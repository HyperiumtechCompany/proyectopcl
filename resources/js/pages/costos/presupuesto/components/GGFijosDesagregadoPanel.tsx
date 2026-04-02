import axios from 'axios';
import {
    RefreshCw,
    Calendar,
    DollarSign,
    Clock,
    Info,
    Calculator,
    TrendingUp,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGGVariablesStore } from '../stores/ggVariablesStore';
import { useProjectParamsStore } from '../stores/projectParamsStore';
import { GGFijosDesagregadoEditor } from './GGFijosDesagregadoEditor';
import { PlazoDisplay } from './PlazoDisplay';

interface GGFijosPanelProps {
    projectId: number;
}

export function GGFijosDesagregadoPanel({ projectId }: GGFijosPanelProps) {
    const duracionDias = useProjectParamsStore((s) => s.getDuracionDias());
    const duracionMeses = useProjectParamsStore((s) => s.getDuracionMeses());
    const costoDirecto = useProjectParamsStore((s) => s.getCostoDirecto());

    // Estados para los nuevos inputs de montoCG
    const [ggfPorcentaje, setGgfPorcentaje] = useState<number>(0);
    const [ggvPorcentaje, setGgvPorcentaje] = useState<number>(0);
    const [utilidadPorcentaje, setUtilidadPorcentaje] = useState<number>(0);
    const [montoCG, setMontoCG] = useState<number>(0);

    // Estados para los valores calculados (para mostrar en UI)
    const [ggfMonto, setGgfMonto] = useState<number>(0);
    const [ggvMonto, setGgvMonto] = useState<number>(0);
    const [utilidadMonto, setUtilidadMonto] = useState<number>(10);
    const [precalculo, setPrecalculo] = useState<number>(0);
    const [precalculoIgv, setPrecalculoIgv] = useState<number>(0);

    // Cargar valores guardados al iniciar
    useEffect(() => {
        axios
            .get(`/costos/proyectos/${projectId}/presupuesto/ggfijos-monto-cg`)
            .then((res) => {
                if (res.data?.success && res.data.data) {
                    setGgfPorcentaje(res.data.data.ggf_porcentaje || 0);
                    setGgvPorcentaje(res.data.data.ggv_porcentaje || 0);
                    setUtilidadPorcentaje(
                        res.data.data.utilidad_porcentaje || 10,
                    );
                }
            })
            .catch(console.error);
    }, [projectId]);

    // Calcular montoCG cuando cambian los valores
    useEffect(() => {
        if (costoDirecto <= 0) {
            setMontoCG(0);
            setGgfMonto(0);
            setGgvMonto(0);
            setUtilidadMonto(0);
            setPrecalculo(0);
            setPrecalculoIgv(0);
            return;
        }

        // Cálculos
        const ggf = costoDirecto * ggfPorcentaje;
        const ggv = costoDirecto * ggvPorcentaje;
        const utilidad = costoDirecto * (utilidadPorcentaje / 100);
        const precalc = costoDirecto + ggf + ggv + utilidad;
        const igv = precalc * 0.18;
        const totalMontoCG = precalc + igv;

        setGgfMonto(ggf);
        setGgvMonto(ggv);
        setUtilidadMonto(utilidad);
        setPrecalculo(precalc);
        setPrecalculoIgv(igv);
        setMontoCG(totalMontoCG);
    }, [costoDirecto, ggfPorcentaje, ggvPorcentaje, utilidadPorcentaje]);

    // Guardar cambios en los inputs
    const handleSaveMontoCG = async () => {
        try {
            await axios.post(
                `/costos/proyectos/${projectId}/presupuesto/ggfijos-monto-cg`,
                {
                    ggf_porcentaje: ggfPorcentaje,
                    ggv_porcentaje: ggvPorcentaje,
                    utilidad_porcentaje: utilidadPorcentaje,
                },
            );
        } catch (err) {
            console.error('Error guardando montoCG:', err);
        }
    };

    // Guardar automáticamente al cambiar valores
    useEffect(() => {
        const timer = setTimeout(() => {
            handleSaveMontoCG();
        }, 1000);
        return () => clearTimeout(timer);
    }, [ggfPorcentaje, ggvPorcentaje, utilidadPorcentaje]);

    // GG Variables Totals for SCTR and Essalud (2.01 and 2.02)
    const ggNodes = useGGVariablesStore((s) => s.nodes);
    const ggTotals = useGGVariablesStore(
        useShallow((s) => s.getSectionTotals()),
    );

    const section21 = ggNodes.find(
        (n) => n.item_codigo === '2.01' || n.item_codigo === '02.01',
    );
    const section22 = ggNodes.find(
        (n) => n.item_codigo === '2.02' || n.item_codigo === '02.02',
    );

    const total21 = section21?.id ? ggTotals[String(section21.id)] || 0 : 0;
    const total22 = section22?.id ? ggTotals[String(section22.id)] || 0 : 0;

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
        setSyncTrigger((prev) => prev + 1);
    };

    return (
        <div className="flex h-full flex-col bg-slate-950">
            {/* Header / Stats Bar */}
            <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
                {/* FILA 1: Resultados principales */}
                <div className="flex items-center justify-between border-b border-slate-800/50 px-4 py-2">
                    {/* Lado izquierdo - Métricas principales */}
                    <div className="flex items-center gap-6">
                        {/* Costo Directo */}
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-sky-500/10 p-2">
                                <DollarSign className="h-4 w-4 text-sky-500" />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                                    Costo Directo
                                </p>
                                <p className="font-mono text-base font-black text-sky-400">
                                    S/{' '}
                                    {new Intl.NumberFormat('es-PE', {
                                        minimumFractionDigits: 2,
                                    }).format(costoDirecto)}
                                </p>
                            </div>
                        </div>

                        {/* GGF */}
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-purple-500/10 p-2">
                                <Calculator className="h-4 w-4 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                                    GGF
                                </p>
                                <p className="font-mono text-base font-black text-purple-400">
                                    S/{' '}
                                    {new Intl.NumberFormat('es-PE', {
                                        minimumFractionDigits: 2,
                                    }).format(ggfMonto)}
                                </p>
                            </div>
                        </div>

                        {/* GGV */}
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-amber-500/10 p-2">
                                <Calculator className="h-4 w-4 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                                    GGV
                                </p>
                                <p className="font-mono text-base font-black text-amber-400">
                                    S/{' '}
                                    {new Intl.NumberFormat('es-PE', {
                                        minimumFractionDigits: 2,
                                    }).format(ggvMonto)}
                                </p>
                            </div>
                        </div>

                        {/* UTILIDAD */}
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-emerald-500/10 p-2">
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                                    Utilidad
                                </p>
                                <p className="font-mono text-base font-black text-emerald-400">
                                    S/{' '}
                                    {new Intl.NumberFormat('es-PE', {
                                        minimumFractionDigits: 2,
                                    }).format(utilidadMonto)}
                                </p>
                            </div>
                        </div>

                        {/* Separador */}
                        <div className="h-8 w-px bg-slate-700" />

                        {/* Plazo — usando PlazoDisplay */}
                        <PlazoDisplay variant="cards" color="amber" />
                    </div>

                    {/* Lado derecho - Sueldos totales */}
                    <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2">
                        <Info className="h-5 w-5 text-emerald-500" />
                        <div>
                            <p className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                                Sueldos + Beneficios
                            </p>
                            <p className="font-mono text-lg font-black text-emerald-400">
                                S/{' '}
                                {new Intl.NumberFormat('es-PE', {
                                    minimumFractionDigits: 2,
                                }).format(total21 + total22)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* FILA 2: Controles, desglose y acciones */}
                <div className="flex items-center justify-between bg-slate-900/70 px-4 py-2">
                    {/* Lado izquierdo - Inputs de porcentajes */}
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            %
                        </span>

                        {/* GGF % */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-purple-400">
                                GGF
                            </span>
                            <div className="flex items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
                                <input
                                    type="number"
                                    value={ggfPorcentaje}
                                    onChange={(e) =>
                                        setGgfPorcentaje(
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                    className="w-16 bg-slate-900 px-2 py-1.5 text-right text-xs font-bold text-purple-400 focus:outline-none"
                                    // step="0.01"
                                    placeholder="0"
                                />
                                <span className="bg-slate-800 px-2 text-xs text-slate-500">
                                    %
                                </span>
                            </div>
                        </div>

                        {/* GGV % */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-amber-400">
                                GGV
                            </span>
                            <div className="flex items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
                                <input
                                    type="number"
                                    value={ggvPorcentaje}
                                    onChange={(e) =>
                                        setGgvPorcentaje(
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                    className="w-16 bg-slate-900 px-2 py-1.5 text-right text-xs font-bold text-amber-400 focus:outline-none"
                                    // step="0.01"
                                    placeholder="0"
                                />
                                <span className="bg-slate-800 px-2 text-xs text-slate-500">
                                    %
                                </span>
                            </div>
                        </div>

                        {/* UTIL % */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-emerald-400">
                                UTIL
                            </span>
                            <div className="flex items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
                                <input
                                    type="number"
                                    value={utilidadPorcentaje}
                                    onChange={(e) =>
                                        setUtilidadPorcentaje(
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                    className="w-16 bg-slate-900 px-2 py-1.5 text-right text-xs font-bold text-emerald-400 focus:outline-none"
                                    step="0.01"
                                    placeholder="10"
                                />
                                <span className="bg-slate-800 px-2 text-xs text-slate-500">
                                    %
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Centro - Desglose compacto */}
                    <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-1.5">
                        <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                            Desglose
                        </span>

                        <div className="flex items-center gap-2">
                            {/* CD */}
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] text-slate-500">
                                    CD
                                </span>
                                <span className="font-mono text-xs text-slate-300">
                                    S/{' '}
                                    {new Intl.NumberFormat('es-PE', {
                                        minimumFractionDigits: 0,
                                    }).format(costoDirecto)}
                                </span>
                            </div>

                            <div className="h-4 w-px bg-slate-700" />

                            {/* GGF */}
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] text-purple-400">
                                    F
                                </span>
                                <span className="font-mono text-xs text-purple-400">
                                    S/{' '}
                                    {new Intl.NumberFormat('es-PE', {
                                        minimumFractionDigits: 0,
                                    }).format(ggfMonto)}
                                </span>
                                {/* <span className="text-[8px] text-purple-400/60">({ggfPorcentaje}%)</span> */}
                            </div>

                            <div className="h-4 w-px bg-slate-700" />

                            {/* GGV */}
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] text-amber-400">
                                    V
                                </span>
                                <span className="font-mono text-xs text-amber-400">
                                    S/{' '}
                                    {new Intl.NumberFormat('es-PE', {
                                        minimumFractionDigits: 0,
                                    }).format(ggvMonto)}
                                </span>
                                {/* <span className="text-[8px] text-amber-400/60">({ggvPorcentaje}%)</span> */}
                            </div>

                            <div className="h-4 w-px bg-slate-700" />

                            {/* UTIL */}
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] text-emerald-400">
                                    U
                                </span>
                                <span className="font-mono text-xs text-emerald-400">
                                    S/{' '}
                                    {new Intl.NumberFormat('es-PE', {
                                        minimumFractionDigits: 0,
                                    }).format(utilidadMonto)}
                                </span>
                                {/* <span className="text-[8px] text-emerald-400/60">({utilidadPorcentaje}%)</span> */}
                            </div>

                            <div className="h-4 w-px bg-slate-700" />

                            {/* IGV */}
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] text-rose-400">
                                    IGV
                                </span>
                                <span className="font-mono text-xs text-rose-400">
                                    S/{' '}
                                    {new Intl.NumberFormat('es-PE', {
                                        minimumFractionDigits: 0,
                                    }).format(precalculoIgv)}
                                </span>
                            </div>

                            <div className="h-4 w-px bg-slate-700" />

                            {/* Total CG */}
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] text-sky-400">
                                    TCG
                                </span>
                                <span className="font-mono text-xs text-sky-400">
                                    S/{' '}
                                    {new Intl.NumberFormat('es-PE', {
                                        minimumFractionDigits: 0,
                                    }).format(montoCG)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Lado derecho - Acciones */}
                    <div className="flex items-center gap-2">
                        <p className="hidden text-[8px] text-slate-500 italic xl:block">
                            Actualización automática
                        </p>
                        <button
                            onClick={handleSync}
                            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700 active:scale-95"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Sincronizar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Vertically Combined Tables */}
            <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto bg-slate-950 p-4">
                <div className="w-full">
                    <div className="mb-6 flex items-center gap-4 px-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
                        <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-500 uppercase">
                            Configuración de Gastos Generales Fijos
                        </h2>
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
                                    montoCG={montoCG}
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
