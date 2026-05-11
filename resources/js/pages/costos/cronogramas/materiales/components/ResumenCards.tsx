import React from 'react';
import { AlertTriangle, CheckCircle2, Info, TrendingUp } from 'lucide-react';
import { ResumenProyecto } from '../types';

interface CurvaSPoint {
    mes:        string;
    key:        string;
    mensual:    number;
    acumulado:  number;
    porcentaje: number;
}

interface Props {
    estaGuardado: boolean;
    sinGantt:     boolean;
    curvaSData:   CurvaSPoint[];
    mesPicoKey:   string;
    resumen?:     ResumenProyecto;  // Añadido para consistencia
}

const fmt = (v: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(v);

const ResumenCards: React.FC<Props> = ({ estaGuardado, sinGantt, curvaSData, mesPicoKey }) => {
    const totalAcumulado = curvaSData[curvaSData.length - 1]?.acumulado ?? 0;
    const maxMensual     = Math.max(...curvaSData.map(d => d.mensual), 1);

    return (
        <div className="space-y-4 mb-6">
            {/* Banner de estado */}
            <div className={`flex items-center gap-3 p-4 rounded-2xl border shadow-sm ${
                sinGantt
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : estaGuardado
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
                {sinGantt
                    ? <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
                    : estaGuardado
                    ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                    : <Info className="w-5 h-5 flex-shrink-0 text-blue-500" />
                }
                <div>
                    <p className="text-xs font-black uppercase tracking-wide">
                        {sinGantt
                            ? 'Sin datos de Cronograma General'
                            : estaGuardado
                            ? 'Cronograma sincronizado con la base de datos'
                            : 'Vista dinámica — datos no guardados aún'}
                    </p>
                    <p className="text-[10px] opacity-70 mt-0.5">
                        {sinGantt
                            ? 'Primero debe guardar el Cronograma General (Gantt) con fechas de inicio y fin.'
                            : estaGuardado
                            ? 'Los datos se leen de cronograma_materiales. Use "Limpiar" para recalcular desde el Gantt.'
                            : 'Los materiales se calculan en tiempo real desde el APU y el Gantt. Guarde para persistirlos.'}
                    </p>
                </div>
            </div>

            {/* Mini Curva S */}
            {curvaSData.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                Curva S — Distribución Mensual de Materiales
                            </h3>
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold">
                            Total: {fmt(totalAcumulado)}
                        </span>
                    </div>

                    {/* Gráfico de barras mini */}
                    <div className="flex items-end gap-1 h-20">
                        {curvaSData.map((d, i) => {
                            const alto = (d.mensual / maxMensual) * 100;
                            const isPico = d.key === mesPicoKey;
                            return (
                                <div key={d.key} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold rounded-lg px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                                        <div>{d.mes}</div>
                                        <div className="text-blue-300">Mes: {fmt(d.mensual)}</div>
                                        <div className="text-emerald-300">Acum.: {d.porcentaje.toFixed(1)}%</div>
                                    </div>
                                    {/* Barra */}
                                    <div className="w-full relative flex-1 flex items-end">
                                        <div
                                            className={`w-full rounded-t-sm transition-all ${
                                                isPico ? 'bg-amber-400' : 'bg-blue-500'
                                            }`}
                                            style={{ height: `${Math.max(alto, 4)}%` }}
                                        />
                                    </div>
                                    {/* Etiqueta mes */}
                                    <span className="text-[8px] text-slate-400 font-bold truncate w-full text-center">
                                        {d.mes.split(' ')[0]}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Línea de porcentaje acumulado */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 flex-wrap">
                        {curvaSData.filter((_, i) => i % Math.max(1, Math.floor(curvaSData.length / 6)) === 0).map(d => (
                            <div key={d.key} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-[9px] text-slate-500 font-bold">
                                    {d.mes.split(' ')[0]}: {d.porcentaje.toFixed(0)}%
                                </span>
                            </div>
                        ))}
                        <div className="ml-auto flex items-center gap-2 text-[9px] text-slate-500">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-2 rounded-sm bg-amber-400 inline-block" /> Mes pico
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-2 rounded-sm bg-blue-500 inline-block" /> Meses normales
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResumenCards;