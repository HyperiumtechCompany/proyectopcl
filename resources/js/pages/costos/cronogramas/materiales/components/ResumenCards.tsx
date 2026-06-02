import React from 'react';
import { AlertTriangle, CheckCircle2, Info, TrendingUp, BarChart3, Activity, Calendar, Zap } from 'lucide-react';
import { ResumenProyecto } from '../types';

interface CurvaSPoint {
    mes:         string;
    key:         string;
    mensual:     number;
    acumulado:   number;
    porcentaje:  number;
}

interface Props {
    estaGuardado: boolean;
    sinGantt:     boolean;
    curvaSData:   CurvaSPoint[];
    mesPicoKey:   string;
    resumen?:     ResumenProyecto;  
}

const fmt = (v: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(v);

const ResumenCards: React.FC<Props> = ({ estaGuardado, sinGantt, curvaSData, mesPicoKey, resumen }) => {
    // Cálculos de control 
    const totalInsumos   = curvaSData[curvaSData.length - 1]?.acumulado ?? 0;
    const maxMensual     = Math.max(...curvaSData.map(d => d.mensual), 1);
    
    // Simulación de avance acumulado planificado vs real para el cuadro de variación formal
    const ultimoPuntoConDatos = curvaSData.filter(d => d.mensual > 0).pop();
    const porcentajePlanificado = 100; // Meta final del proyecto
    const porcentajeActual      = ultimoPuntoConDatos?.porcentaje ?? 0;
    const variacionPorcentual   = porcentajePlanificado - porcentajeActual;

    return (
        <div className="space-y-6 mb-6">
            
            {/* BANNER DE ESTADO TÉCNICO */}
            <div className={`flex items-center gap-4 p-4 rounded-xl border shadow-sm transition-all duration-300 ${
                sinGantt
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                    : estaGuardado
                    ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl'
                    : 'bg-blue-50/70 border-blue-200 text-blue-900'
            }`}>
                <div className="flex-shrink-0">
                    {sinGantt ? (
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500"><AlertTriangle className="w-5 h-5" /></div>
                    ) : estaGuardado ? (
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 animate-pulse"><CheckCircle2 className="w-5 h-5" /></div>
                    ) : (
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Info className="w-5 h-5" /></div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider">
                        {sinGantt
                            ? 'ESTADO: Base de datos desvinculada del Cronograma General'
                            : estaGuardado
                            ? 'ESTADO: Matriz de Materiales Sincronizada y Persistida (Producción)'
                            : 'ESTADO: Simulación Dinámica en Memoria Volátil'}
                    </p>
                    <p className="text-[11px] opacity-75 mt-0.5 font-medium truncate">
                        {sinGantt
                            ? 'Requiere asignación de dependencias temporales en el módulo Gantt principal.'
                            : estaGuardado
                            ? 'Bloque de costos de insumos conciliado con las tablas dinámicas de Laragon/MySQL.'
                            : 'Cálculo algorítmico en tiempo real desde el APU. Cambios no escritos en el backend.'}
                    </p>
                </div>
            </div>

            {curvaSData.length > 0 && (
                <>
                    {/* PANEL SUPERIOR: CUADRO DE VARIACIÓN DE ALTA INGENIERÍA */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        
                        {/* Card 1: Costo Presupuestado */}
                        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Presupuesto Insumos</span>
                                <span className="text-xl font-black text-slate-800 tracking-tight">{fmt(totalInsumos)}</span>
                            </div>
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-600"><Activity className="w-5 h-5" /></div>
                        </div>

                        {/* Card 2: Mes Crítico */}
                        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pico de Desembolso</span>
                                <span className="text-xl font-black text-blue-600 tracking-tight">{mesPicoKey || 'N/A'}</span>
                            </div>
                            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-blue-600"><Calendar className="w-5 h-5" /></div>
                        </div>

                        {/* Card 3: Cuadro Matemático de Variación Estilo Excel Patrón */}
                        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md text-white grid grid-cols-3 gap-2 items-center">
                            <div className="text-center border-r border-slate-800">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Avance Planificado</span>
                                <span className="text-lg font-black text-amber-400">{porcentajePlanificado.toFixed(2)}%</span>
                            </div>
                            <div className="text-center border-r border-slate-800">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Avance Real Calc.</span>
                                <span className="text-lg font-black text-emerald-400">{porcentajeActual.toFixed(2)}%</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Desviación / Brecha</span>
                                <span className={`text-lg font-black ${variacionPorcentual === 0 ? 'text-slate-300' : 'text-rose-400'}`}>
                                    {variacionPorcentual.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* GRAN GRÁFICO AVANZADO: HISTOGRAMA INTEGRADO CON CURVA S */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-pink-500" />
                                <div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                        Curva S de Avance Físico-Financiero Acumulado
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium">Línea de base técnica y distribución analítica por periodo</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-500">
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-600 rounded-sm" /> Inversión Mensual</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-500 rounded-sm" /> Hito Mayor Consumo</span>
                                <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 bg-pink-500 inline-block relative after:w-1.5 after:h-1.5 after:bg-white after:border-2 after:border-pink-500 after:rounded-full after:absolute after:-top-[3px] after:left-1" /> Trayectoria Curva S</span>
                            </div>
                        </div>

                        {/* Área del Lienzo del Gráfico */}
                        <div className="relative h-72 w-full mt-4 flex select-none">
                            
                            {/* EJE Y IZQUIERDO: Escala Financiera (Montos en Soles) */}
                            <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-[9px] font-bold text-slate-400 text-right pr-2 border-r border-slate-100 z-10 bg-white/90">
                                <span>{fmt(maxMensual)}</span>
                                <span>{fmt(maxMensual * 0.75)}</span>
                                <span>{fmt(maxMensual * 0.5)}</span>
                                <span>{fmt(maxMensual * 0.25)}</span>
                                <span>S/. 0</span>
                            </div>

                            {/* EJE Y DERECHO: Escala Porcentual (0% - 100% de la Curva S) */}
                            <div className="absolute right-0 top-0 bottom-0 w-12 flex flex-col justify-between text-[9px] font-bold text-slate-400 text-left pl-2 border-l border-slate-100 z-10 bg-white/90">
                                <span>100.00%</span>
                                <span>75.00%</span>
                                <span>50.00%</span>
                                <span>25.00%</span>
                                <span>0.00%</span>
                            </div>

                            {/* CUADRÍCULA DE CONTROL TÉCNICO (Grid Lines de Fondo) */}
                            <div className="absolute inset-x-12 inset-y-0 flex flex-col justify-between pointer-events-none">
                                <div className="w-full border-t stroke-dasharray border-slate-100" />
                                <div className="w-full border-t stroke-dasharray border-slate-100" />
                                <div className="w-full border-t stroke-dasharray border-slate-100" />
                                <div className="w-full border-t stroke-dasharray border-slate-100" />
                                <div className="w-full border-b border-slate-200" />
                            </div>

                            {/* CONTENEDOR DE BARRAS Y ESFERAS DE CÁLCULO */}
                            <div className="flex-1 mx-12 h-full flex items-end gap-3 px-2 relative z-0">
                                {curvaSData.map((d) => {
                                    const altoBarra = (d.mensual / maxMensual) * 100;
                                    const isPico = d.key === mesPicoKey;

                                    return (
                                        <div key={d.key} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                                            
                                            {/* TOOLTIP EMPRESARIAL FLOTANTE */}
                                            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[10px] rounded-xl p-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-30 shadow-2xl border border-slate-800 w-44">
                                                <div className="font-black text-slate-300 mb-1.5 border-b border-slate-800 pb-1.5 text-center flex items-center justify-center gap-1">
                                                    <Zap className="w-3 h-3 text-amber-400" /> {d.mes}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Desembolso:</span>
                                                        <span className="font-black text-blue-400">{fmt(d.mensual)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Acumulado S:</span>
                                                        <span className="font-black text-pink-400">{d.porcentaje.toFixed(2)}%</span>
                                                    </div>
                                                    <div className="flex justify-between pt-1 border-t border-slate-900 text-[9px]">
                                                        <span className="text-slate-500">Monto Acum.:</span>
                                                        <span className="font-bold text-slate-300">{fmt(d.acumulado)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* INTERSECCIÓN DE LA CURVA S (Nodo Matemático basado en Porcentaje Acumulado) */}
                                            <div 
                                                className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-pink-500 shadow-md z-20 group-hover:bg-pink-500 group-hover:scale-125 transition-all duration-300"
                                                style={{ bottom: `calc(${d.porcentaje}% - 5px)` }}
                                            />

                                            {/* HISTOGRAMA (Barra de consumo mensual) */}
                                            <div className="w-full h-full flex items-end">
                                                <div
                                                    className={`w-full rounded-t transition-all duration-300 relative group-hover:opacity-90 ${
                                                        isPico 
                                                            ? 'bg-gradient-to-t from-amber-500 to-amber-400 shadow-lg shadow-amber-500/10' 
                                                            : 'bg-gradient-to-t from-slate-200 to-slate-100 border-x border-t border-slate-300/40 group-hover:from-blue-600 group-hover:to-blue-500 group-hover:border-transparent'
                                                    }`}
                                                    style={{ height: `${Math.max(altoBarra, 3)}%` }}
                                                >
                                                    {/* Marcador estático superior de la barra */}
                                                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-black text-slate-400 opacity-100 group-hover:text-blue-600 transition-colors whitespace-nowrap">
                                                        {d.mensual > 0 ? `${(d.mensual / 1000).toFixed(0)}k` : ''}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* EJE X: Identificadores de los periodos */}
                                            <span className="absolute -bottom-5 text-[9px] text-slate-500 font-black tracking-tighter truncate w-full text-center">
                                                {d.mes.toUpperCase()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* SUB-EJE INFERIOR: PORCENTAJES ESCRITOS COMPLETO (Estilo Reporte Técnico) */}
                        <div className="mt-8 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                            {curvaSData.map(d => (
                                <div key={`footer-${d.key}`} className="bg-slate-50/60 border border-slate-100 rounded-lg p-2 text-center">
                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">{d.mes}</span>
                                    <span className="text-xs font-black text-slate-700 mt-0.5 block">{d.porcentaje.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ResumenCards;