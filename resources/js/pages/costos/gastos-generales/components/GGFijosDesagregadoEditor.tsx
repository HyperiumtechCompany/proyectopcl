import axios from 'axios';
import { Save, Loader2, Plus, Trash2, Info } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useGGFijosStore } from '../stores/ggFijosStore';
import { useProjectParamsStore } from '../../presupuesto/stores/projectParamsStore';
import { decimalSeguro, redondearMoneda, sumarDecimales } from '../lib/calculos';

interface GGFijosDesagregadoEditorProps {
    projectId: number;
    tipoCalculo: string;
    onSaved?: (total: number) => void;
    syncTrigger?: number;
    totalSueldos?: number;
    totalBeneficios?: number;
    montoCG?: number;
}

interface DesagregadoRow {
    id?: number;
    tipo_poliza?: string;
    descripcion: string;
    base_calculo: number;
    garantia_porcentaje: number;
    tea_porcentaje: number;
    duracion_obra_dias: number;
    duracion_liquidacion_dias: number;
    factor_porcentaje: number;
    avance_porcentaje: number;
    renovacion_dias: number;
    duracion_dias: number;
}

const fmt = (n: number) => new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const DEFAULT_ROW: DesagregadoRow = {
    descripcion: '',
    base_calculo: 0,
    garantia_porcentaje: 10,
    tea_porcentaje: 0,
    duracion_obra_dias: 0,
    duracion_liquidacion_dias: 0,
    factor_porcentaje: 100,
    avance_porcentaje: 100,
    renovacion_dias: 0,
    duracion_dias: 0,
};

export function GGFijosDesagregadoEditor({ 
    projectId, 
    tipoCalculo, 
    onSaved, 
    syncTrigger,
    totalSueldos = 0,
    totalBeneficios = 0,
    montoCG = 0
}: GGFijosDesagregadoEditorProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<DesagregadoRow[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const syncMainTable = useGGFijosStore(s => s.syncFromGlobals);

    // Consume parameters from store
    const globalBase = useProjectParamsStore(s => s.getCostoDirecto());
    const globalDays = useProjectParamsStore(s => s.getDuracionDias());
    const sencicoPorcentaje = useProjectParamsStore(s => s.params?.sencico_porcentaje ?? 0.2);
    const itfPorcentaje = useProjectParamsStore(s => s.params?.itf_porcentaje ?? 0.005);
    const itfCargoAdicional = useProjectParamsStore(s => s.params?.itf_cargo_adicional ?? 0);
    const sctrSaludPorcentaje = useProjectParamsStore(s => s.params?.sctr_salud_porcentaje ?? 0.5);
    const sctrPensionPorcentaje = useProjectParamsStore(s => s.params?.sctr_pension_porcentaje ?? 1.5);
    const polizaEssaludVidaPorcentaje = useProjectParamsStore(s => s.params?.poliza_essalud_vida_porcentaje ?? 0.53);
    const seguroCarPorcentaje = useProjectParamsStore(s => s.params?.seguro_car_porcentaje ?? 0.3);
    
    // Usar montoCG como base para los cálculos si está disponible, sino usar globalBase
    const baseParaCalculos = montoCG > 0 ? montoCG : globalBase;

    useEffect(() => {
        if (tipoCalculo === 'manual') return;

        setLoading(true);
        axios.get(`/costos/proyectos/${projectId}/presupuesto/gastos-fijos-global/desagregado`, {
            params: { tipo_calculo: tipoCalculo }
        })
            .then(res => {
                if (res.data?.success && res.data.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
                    setRows(res.data.data.map((r: any) => ({ ...DEFAULT_ROW, ...r })));
                } else {
                    // Initialize default rows based on tipoCalculo
                    if (tipoCalculo === 'poliza_sctr') {
                        setRows([
                            { ...DEFAULT_ROW, descripcion: 'Tasa SALUD (Empleados)', tipo_poliza: 'sctr_salud', tea_porcentaje: sctrSaludPorcentaje },
                            { ...DEFAULT_ROW, descripcion: 'Tasa PENSION', tipo_poliza: 'sctr_pension', tea_porcentaje: sctrPensionPorcentaje }
                        ]);
                    } else if (tipoCalculo === 'sencico') {
                        setRows([{ ...DEFAULT_ROW, descripcion: 'Sencico', tea_porcentaje: sencicoPorcentaje }]);
                    } else if (tipoCalculo === 'itf') {
                        setRows([{ ...DEFAULT_ROW, descripcion: 'Impuestos ITF', tea_porcentaje: itfPorcentaje }]);
                    } else if (tipoCalculo === 'fianza_fiel_cumplimiento') {
                        setRows([{ ...DEFAULT_ROW, descripcion: 'FIANZA POR GARANTIA DE FC', garantia_porcentaje: 10 }]);
                    } else if (tipoCalculo === 'fianza_adelanto_efectivo') {
                        setRows([{ ...DEFAULT_ROW, descripcion: 'FIANZA Adelanto en Efectivo', garantia_porcentaje: 10 }]);
                    } else if (tipoCalculo === 'fianza_adelanto_materiales') {
                        setRows([{ ...DEFAULT_ROW, descripcion: 'FIANZA Adelanto en Materiales', garantia_porcentaje: 20 }]);
                    } else if (tipoCalculo === 'poliza_essalud_vida') {
                        setRows([{ ...DEFAULT_ROW, descripcion: 'PÓLIZA DE SEGUROS ESSALUD + VIDA' }]);
                    } else if (tipoCalculo === 'poliza_car') {
                        setRows([{ ...DEFAULT_ROW, descripcion: 'SEGUROS CAR', tea_porcentaje: seguroCarPorcentaje }]);
                    } else {
                        setRows([{ ...DEFAULT_ROW }]);
                    }
                }
            })
            .finally(() => setLoading(false));
    }, [itfPorcentaje, polizaEssaludVidaPorcentaje, projectId, seguroCarPorcentaje, sencicoPorcentaje, sctrPensionPorcentaje, sctrSaludPorcentaje, tipoCalculo]);

    // syncTrigger, totalSueldos, totalBeneficios, baseParaCalculos, globalDays
    useEffect(() => {
        if (loading) return;

        setRows(prev => {
            let changed = false;
            const newRows = prev.map(row => {
                const nr = { ...row };
                const configuredRate = tipoCalculo === 'sencico'
                    ? sencicoPorcentaje
                    : tipoCalculo === 'itf'
                      ? itfPorcentaje
                      : tipoCalculo === 'poliza_car'
                        ? seguroCarPorcentaje
                        : tipoCalculo === 'poliza_essalud_vida'
                          ? polizaEssaludVidaPorcentaje
                          : row.tipo_poliza === 'sctr_pension'
                            ? sctrPensionPorcentaje
                            : tipoCalculo === 'poliza_sctr'
                              ? sctrSaludPorcentaje
                              : null;

                if (configuredRate !== null && nr.tea_porcentaje !== configuredRate) {
                    nr.tea_porcentaje = configuredRate;
                    changed = true;
                }
                
                // Determine base calculation - usar montoCG si está disponible
                let targetBase = baseParaCalculos;
                if (tipoCalculo === 'poliza_sctr') {
                    targetBase = totalSueldos + totalBeneficios;
                } else if (tipoCalculo === 'poliza_essalud_vida') {
                    targetBase = totalSueldos;
                }

                if (targetBase > 0 && nr.base_calculo !== targetBase) {
                    nr.base_calculo = targetBase;
                    changed = true;
                }

                if (globalDays > 0) {
                    if (tipoCalculo === 'fianza_fiel_cumplimiento' && nr.duracion_obra_dias !== globalDays) {
                        nr.duracion_obra_dias = globalDays;
                        changed = true;
                    } else if ((tipoCalculo === 'poliza_car' || tipoCalculo === 'poliza_sctr' || tipoCalculo.startsWith('fianza_adelanto_')) && nr.duracion_dias !== globalDays) {
                        nr.duracion_dias = globalDays;
                        changed = true;
                    }
                }
                return nr;
            });
            
            if (changed) setIsDirty(true);
            return changed ? newRows : prev;
        });
    }, [baseParaCalculos, globalDays, itfPorcentaje, loading, polizaEssaludVidaPorcentaje, seguroCarPorcentaje, sencicoPorcentaje, sctrPensionPorcentaje, sctrSaludPorcentaje, syncTrigger, tipoCalculo, totalBeneficios, totalSueldos]);

    // Auto-save effect
    useEffect(() => {
        if (!isDirty || saving || loading) return;

        const timer = setTimeout(async () => {
            setSaving(true);
            try {
                const res = await axios.post(`/costos/proyectos/${projectId}/presupuesto/gastos-fijos-global/desagregado`, {
                    tipo_calculo: tipoCalculo,
                    data: rows
                });
                if (res.data?.success) {
                    setIsDirty(false);
                    if (onSaved) onSaved(res.data.total);
                    syncMainTable(projectId);
                }
            } catch (err) {
                console.error("Auto-save Desagregado error", err);
            } finally {
                setSaving(false);
            }
        }, 3000); // 3s debounce

        return () => clearTimeout(timer);
    }, [isDirty, rows, projectId, tipoCalculo, saving, loading, onSaved, syncMainTable]);


    const updateRow = (index: number, field: keyof DesagregadoRow, value: any) => {
        setRows(prev => {
            const newRows = [...prev];
            newRows[index] = { ...newRows[index], [field]: value };
            return newRows;
        });
        setIsDirty(true);
    };

    const addRow = () => {
        // Al añadir fila, hereda la base actual - usar montoCG si está disponible
        let targetBase = baseParaCalculos;
        if (tipoCalculo === 'poliza_sctr') targetBase = totalSueldos + totalBeneficios;
        else if (tipoCalculo === 'poliza_essalud_vida') targetBase = totalSueldos;

        setRows(prev => [...prev, { ...DEFAULT_ROW, descripcion: `Fila ${prev.length + 1}`, base_calculo: targetBase }]);
        setIsDirty(true);
    };

    const removeRow = (index: number) => {
        setRows(prev => prev.filter((_, i) => i !== index));
        setIsDirty(true);
    };

    if (tipoCalculo === 'manual') return null;

    if (loading) return null;

    const calcRowTotal = (row: DesagregadoRow) => {
        if (tipoCalculo.startsWith('fianza_')) {
            const montoGarantia = decimalSeguro(row.base_calculo).times(row.garantia_porcentaje).dividedBy(100);
            const teaDiaria = decimalSeguro(row.tea_porcentaje).dividedBy(100).dividedBy(360);
            if (tipoCalculo === 'fianza_fiel_cumplimiento') {
                return redondearMoneda(montoGarantia.times(teaDiaria).times(decimalSeguro(row.duracion_obra_dias).plus(row.duracion_liquidacion_dias)));
            } else {
                return redondearMoneda(montoGarantia.times(teaDiaria).times(row.renovacion_dias || 0).times(row.factor_porcentaje).dividedBy(100));
            }
        } else {
            if (row.duracion_dias > 0) {
                const tasaDiaria = decimalSeguro(row.tea_porcentaje).dividedBy(100).dividedBy(360);
                return redondearMoneda(decimalSeguro(row.base_calculo).times(tasaDiaria).times(row.duracion_dias));
            } else {
                const total = decimalSeguro(row.base_calculo).times(row.tea_porcentaje).dividedBy(100);
                return redondearMoneda(tipoCalculo === 'itf' && rows[0] === row ? total.plus(itfCargoAdicional) : total);
            }
        }
    };

    const globalTotal = sumarDecimales(rows.map(calcRowTotal));

    const isFianza = tipoCalculo.startsWith('fianza_');
    const isSctr = tipoCalculo === 'poliza_sctr';
    const isAdelanto = tipoCalculo === 'fianza_adelanto_efectivo' || tipoCalculo === 'fianza_adelanto_materiales';
    const isFielCump = tipoCalculo === 'fianza_fiel_cumplimiento';
    const isCar = tipoCalculo === 'poliza_car';
    const isSimple = tipoCalculo === 'poliza_essalud_vida' || tipoCalculo === 'sencico' || tipoCalculo === 'itf';

    const globalGarantiaPorc = rows.length > 0 ? rows[0].garantia_porcentaje : 0;

    const handleGlobalGarantiaChange = (val: number) => {
        setRows(prev => prev.map(r => ({ ...r, garantia_porcentaje: val })));
        setIsDirty(true);
    };

    return (
        <div className="flex flex-col bg-slate-900/40 p-5 rounded-xl border border-slate-800/60 shadow-lg mb-6 group/editor">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                    <div>
                        <h3 className="text-xs font-black tracking-[0.2em] text-slate-200 uppercase">
                            {tipoCalculo.replace(/_/g, ' ')}
                        </h3>
                    </div>
                </div>
                <div className="flex gap-1.5 items-center">
                    {(isFianza || isSctr || isAdelanto) && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20">
                            <span className="text-xs font-bold text-sky-400 capitalize">Base: {isSctr || tipoCalculo === 'poliza_essalud_vida' ? 'Variable' : 'General'}</span>
                        </div>
                    )}

                    {(isAdelanto || isSctr) && (
                        <button
                            onClick={addRow}
                            className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700"
                        >
                            <Plus className="h-3 w-3" /> Añadir Fila
                        </button>
                    )}
                    
                    <div className="flex items-center gap-1 min-w-[100px] justify-end">
                        {saving ? (
                            <span className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-sky-400 uppercase">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                Guardando
                            </span>
                        ) : isDirty ? (
                            <span className="flex animate-pulse items-center gap-1.5 text-xs font-bold tracking-widest text-amber-500 uppercase">
                                <span className="h-1 w-1 rounded-full bg-amber-500" />
                                Pendiente
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-emerald-500 uppercase opacity-0 group-hover/editor:opacity-100 transition-opacity">
                                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                Guardado
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {isFianza && (
                <div className="mb-4 flex items-center gap-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700/30 w-fit">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        % Garantía Global
                    </label>
                    <input
                        type="number"
                        value={globalGarantiaPorc}
                        onChange={e => handleGlobalGarantiaChange(parseFloat(e.target.value) || 0)}
                        className="w-20 bg-slate-950 border border-slate-700 rounded p-1 text-xs text-amber-500 font-bold text-center focus:border-sky-500 focus:outline-none"
                    />
                </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                    <thead className="bg-slate-800/40 text-xs tracking-widest text-slate-500 uppercase">
                        <tr>
                            <th className="p-1.5 font-bold">Descripción</th>
                            <th className="p-1.5 font-bold text-right border-x border-slate-800/50">Base S/.</th>
                            <th className="p-1.5 font-bold text-right w-20">{isSimple ? 'Tasa %' : 'TEA %'}</th>
                            {!isSimple && (
                                <th className="p-1.5 font-bold text-right border-x border-slate-800/50">P.D %</th>
                            )}
                            {isFielCump || isCar || isSctr ? (
                                <th className="p-1.5 font-bold text-right w-20">Días</th>
                            ) : null}
                            {isFielCump && (
                                <th className="p-1.5 font-bold text-right w-20 border-x border-slate-800/50">Liq.</th>
                            )}
                            {isAdelanto && (
                                <>
                                    <th className="p-1.5 font-bold text-right w-16">Factor %</th>
                                    <th className="p-1.5 font-bold text-right w-16">Avance %</th>
                                    <th className="p-1.5 font-bold text-right w-16 border-x border-slate-800/50">Renov.</th>
                                </>
                            )}
                            <th className="p-1.5 font-bold text-right text-sky-400 bg-sky-500/5">
                                Parcial S/.
                            </th>
                            {isAdelanto && <th className="p-1.5 w-8"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 bg-slate-900/20">
                        {rows.map((row, index) => (
                            <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                                <td className="p-1 min-w-[100px]">
                                    <input
                                        type="text"
                                        value={row.descripcion ?? ''}
                                        onChange={e => updateRow(index, 'descripcion', e.target.value)}
                                        className="w-full bg-transparent border-none p-1 text-xs focus:bg-slate-800 rounded focus:outline-none"
                                    />
                                </td>
                                <td className="p-1 text-right font-mono text-slate-500 selection:bg-sky-500/30">
                                    {fmt(row.base_calculo ?? 0)}
                                </td>
                                <td className="p-1">
                                    <input
                                        type="number"
                                        value={row.tea_porcentaje ?? ''}
                                        onChange={e => updateRow(index, 'tea_porcentaje', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-slate-950 border border-slate-700/50 rounded px-2 py-1 text-right text-amber-500 font-bold focus:border-sky-500/50 focus:outline-none"
                                        step="0.01"
                                    />
                                </td>
                                {!isSimple && (
                                    <td className="p-1 text-right font-mono text-slate-500 text-xs">
                                        {(((row.tea_porcentaje ?? 0) / 100) / 360 * 100).toFixed(6)}%
                                    </td>
                                )}
                                {(isFielCump || isCar || isSctr) ? (
                                    <td className="p-1">
                                        <input
                                            type="number"
                                            value={isFielCump ? (row.duracion_obra_dias ?? '') : (row.duracion_dias ?? '')}
                                            onChange={e => {
                                                if (isFielCump) updateRow(index, 'duracion_obra_dias', parseInt(e.target.value) || 0);
                                                else updateRow(index, 'duracion_dias', parseInt(e.target.value) || 0);
                                            }}
                                            className="w-full bg-slate-950 border border-slate-700/50 rounded px-2 py-1 text-right focus:border-sky-500/50 focus:outline-none"
                                        />
                                    </td>
                                ) : null}
                                {isFielCump && (
                                    <td className="p-1">
                                        <input
                                            type="number"
                                            value={row.duracion_liquidacion_dias ?? ''}
                                            onChange={e => updateRow(index, 'duracion_liquidacion_dias', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-950 border border-slate-700/50 rounded px-2 py-1 text-right text-indigo-400 focus:border-sky-500/50 focus:outline-none"
                                        />
                                    </td>
                                )}
                                {isAdelanto && (
                                    <>
                                        <td className="p-1"><input type="number" value={row.factor_porcentaje ?? ''} onChange={e => updateRow(index, 'factor_porcentaje', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-700/50 rounded px-1 py-1 text-right focus:border-sky-500/50 focus:outline-none" /></td>
                                        <td className="p-1"><input type="number" value={row.avance_porcentaje ?? ''} onChange={e => updateRow(index, 'avance_porcentaje', parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-700/50 rounded px-1 py-1 text-right focus:border-sky-500/50 focus:outline-none" /></td>
                                        <td className="p-1"><input type="number" value={row.renovacion_dias ?? ''} onChange={e => updateRow(index, 'renovacion_dias', parseInt(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-700/50 rounded px-1 py-1 text-right focus:border-sky-500/50 focus:outline-none" /></td>
                                    </>
                                )}
                                <td className="p-1 text-right font-mono font-bold text-sky-400 bg-sky-500/5">
                                    {fmt(calcRowTotal(row))}
                                </td>
                                {isAdelanto && (
                                    <td className="p-1 text-center">
                                        <button onClick={() => removeRow(index)} className="text-slate-600 hover:text-red-400 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-800/20">
                        <tr>
                            <td colSpan={isSimple ? 2 : 3} className="p-1 text-right text-xs font-bold text-slate-500 tracking-widest uppercase">Subtotal {tipoCalculo.replace(/_/g, ' ')}</td>
                            <td colSpan={10} className="p-1 text-right font-mono font-black text-sky-400">S/. {fmt(globalTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
