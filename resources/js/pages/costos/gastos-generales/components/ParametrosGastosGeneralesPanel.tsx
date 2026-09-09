import { Save, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useProjectParamsStore, type ProjectParams } from '../../presupuesto/stores/projectParamsStore';
import { useRemuneracionesStore } from '../stores/remuneracionesStore';
import { useGGVariablesStore } from '../stores/ggVariablesStore';

const fields: Array<{ key: keyof ProjectParams; label: string; step: string; suffix: string }> = [
    { key: 'asignacion_familiar_factor', label: 'Asignación familiar', step: '0.0001', suffix: 'S/.' },
    { key: 'snp_porcentaje', label: 'SNP', step: '0.0001', suffix: '%' },
    { key: 'essalud_porcentaje', label: 'EsSalud', step: '0.0001', suffix: '%' },
    { key: 'cts_porcentaje', label: 'CTS', step: '0.0001', suffix: '%' },
    { key: 'gratificacion_porcentaje', label: 'Gratificación', step: '0.0001', suffix: '%' },
    { key: 'vacaciones_porcentaje', label: 'Vacaciones', step: '0.0001', suffix: '%' },
    { key: 'sencico_porcentaje', label: 'SENCICO', step: '0.0001', suffix: '%' },
    { key: 'itf_porcentaje', label: 'ITF', step: '0.0001', suffix: '%' },
    { key: 'itf_cargo_adicional', label: 'Cargo adicional ITF', step: '0.0001', suffix: 'S/.' },
    { key: 'control_concurrente_porcentaje', label: 'Tope Control Concurrente', step: '0.0001', suffix: '%' },
    { key: 'sctr_salud_porcentaje', label: 'SCTR Salud', step: '0.0001', suffix: '%' },
    { key: 'sctr_pension_porcentaje', label: 'SCTR Pensión', step: '0.0001', suffix: '%' },
    { key: 'poliza_essalud_vida_porcentaje', label: 'Póliza EsSalud + Vida', step: '0.0001', suffix: '%' },
    { key: 'seguro_car_porcentaje', label: 'Seguro CAR', step: '0.0001', suffix: '%' },
    { key: 'recargo_administrativo_cc_porcentaje', label: 'Recargo administrativo CC', step: '0.0001', suffix: '%' },
];

export function ParametrosGastosGeneralesPanel({ projectId }: { projectId: number }) {
    const params = useProjectParamsStore((state) => state.params);
    const isSaving = useProjectParamsStore((state) => state.isSaving);
    const updateFinancialParams = useProjectParamsStore((state) => state.updateFinancialParams);
    const [draft, setDraft] = useState<Partial<ProjectParams>>({});
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (params) setDraft(params);
    }, [params]);

    if (!params) return null;

    const save = async () => {
        const updates = Object.fromEntries(fields.map(({ key }) => [key, Number(draft[key] ?? params[key])])) as Partial<ProjectParams>;
        const success = await updateFinancialParams(projectId, updates);
        if (success) {
            useRemuneracionesStore.getState().recalculateAll();
            useGGVariablesStore.getState().recalculateBenefits();
        }
        setSaved(success);
        if (success) window.setTimeout(() => setSaved(false), 1800);
    };

    return (
        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <Settings2 className="h-4 w-4 text-amber-500" />
                Parámetros legales y financieros
                <span className="ml-auto text-[10px] font-normal text-slate-400">Configurables por proyecto</span>
            </summary>
            <div className="grid grid-cols-1 gap-2 border-t border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-700">
                {fields.map(({ key, label, step, suffix }) => (
                    <label key={key} className="grid gap-1 text-[10px] font-semibold text-slate-500 uppercase dark:text-slate-400">
                        {label}
                        <span className="flex items-center gap-1">
                            <input
                                type="number"
                                min="0"
                                max={suffix === '%' ? '100' : undefined}
                                step={step}
                                value={String(draft[key] ?? '')}
                                onChange={(event) => setDraft((current) => ({ ...current, [key]: Number(event.target.value) }))}
                                className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-right font-mono text-xs text-slate-800 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                            <span className="w-5 normal-case">{suffix}</span>
                        </span>
                    </label>
                ))}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-3 py-2 dark:border-slate-700">
                <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void save()}
                    className="flex items-center gap-1.5 rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
                >
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar parámetros'}
                </button>
            </div>
        </details>
    );
}
