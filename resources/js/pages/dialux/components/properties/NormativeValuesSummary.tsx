import type { NormativeLeafOption } from '@/pages/dialux/hooks/roomLighting';

function formatRequirement(value: number | null, suffix = ''): string {
    return value === null ? 'No especificado' : `${value}${suffix}`;
}

export function NormativeValuesSummary({
    requirement,
    manualValues,
}: {
    requirement: NormativeLeafOption | null;
    manualValues?: { ugr?: number | null; uniformity?: number | null; ra?: number | null };
}) {
    if (!requirement) return null;

    const missing = [
        requirement.ugr === null && typeof manualValues?.ugr !== 'number' ? 'UGRL' : null,
        requirement.uniformity === null && typeof manualValues?.uniformity !== 'number' ? 'Uo' : null,
        requirement.ra === null && typeof manualValues?.ra !== 'number' ? 'Ra' : null,
    ].filter((value): value is string => value !== null);

    const values = [
        ['Em', formatRequirement(requirement.illuminanceLux, ' lx')],
        ['UGRL', formatRequirement(requirement.ugr)],
        ['Uo', formatRequirement(requirement.uniformity)],
        ['Ra', formatRequirement(requirement.ra)],
    ];

    return (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50/70 p-2 dark:border-cyan-900/60 dark:bg-cyan-950/20">
            <p className="mb-2 text-[9px] font-semibold tracking-wider text-cyan-800 uppercase dark:text-cyan-300">
                Valores de la aplicación seleccionada
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {values.map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-md border border-cyan-100 bg-white px-2 py-1.5 dark:border-cyan-900/50 dark:bg-slate-950/70">
                        <span className="block text-[8px] font-semibold text-slate-500 uppercase">{label}</span>
                        <span className="block truncate font-mono text-[10px] font-semibold text-slate-900 dark:text-slate-100" title={value}>
                            {value}
                        </span>
                    </div>
                ))}
            </div>
            {requirement.specificRequirements && (
                <p className="mt-2 text-[9px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {requirement.specificRequirements}
                </p>
            )}
            {missing.length > 0 ? (
                <div role="alert" className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[9px] leading-relaxed text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200">
                    <strong>Evaluación incompleta:</strong> la aplicación no especifica {missing.join(', ')}. Selecciona una aplicación más específica o completa esos límites manualmente antes de calcular.
                </div>
            ) : requirement.ugr === null || requirement.uniformity === null || requirement.ra === null ? (
                <p className="mt-2 text-[9px] font-medium text-emerald-700 dark:text-emerald-300">
                    Requisitos faltantes completados manualmente.
                </p>
            ) : null}
        </div>
    );
}
