import { AlertTriangle, Calculator, CheckCircle2, FileText, X, XCircle } from 'lucide-react';
import { siteExportChecklist } from '../domain/siteExportChecklist';
import type { SiteOutputRow } from '../domain/siteOutputs';
import { useLuminaireCatalog } from '../hooks/useLuminaireCatalog';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { useSiteLightingCalculation } from '../hooks/useSiteLightingCalculation';

/**
 * Revisión antes de exportar el PDF de la planta: lo obligatorio (cálculo
 * vigente, espacios) bloquea hasta resolverlo — con el botón para hacerlo
 * ahí mismo —; lo recomendado se lista con dónde corregirlo y deja exportar.
 * La lista se actualiza sola al terminar el cálculo.
 */
export function SiteExportCheckDialog({
    editor,
    exporting,
    error,
    onExport,
    onClose,
}: {
    editor: UseSiteEditorReturn;
    exporting: boolean;
    error: string | null;
    onExport: () => void;
    onClose: () => void;
}) {
    const lighting = useSiteLightingCalculation(editor.siteData);
    const catalog = useLuminaireCatalog();
    const site = editor.siteData;
    if (!site) return null;
    const outputRows = [
        ...new Map(
            Object.values(editor.circuitOutputs ?? {}).map((row: SiteOutputRow) => [
                `${row.panelElementId}:${row.rootConductorId}`,
                row,
            ]),
        ).values(),
    ];
    const items = siteExportChecklist({
        site,
        calculation: lighting.calculation,
        calculationStale: lighting.stale,
        outputRows,
        feeds: editor.circuitFeeds,
        products: new Map(catalog.items.map((item) => [item.id, { name: item.name, fixtureType: item.fixtureType }])),
    });
    const required = items.filter((item) => item.level === 'required');
    const recommended = items.filter((item) => item.level === 'recommended');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="site-export-check-title">
            <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#12151c]">
                <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
                    <h2 id="site-export-check-title" className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                        <FileText className="h-4 w-4 text-amber-500" />
                        Antes de exportar el informe PDF
                    </h2>
                    <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                        <X className="h-4 w-4" />
                    </button>
                </header>
                <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
                    {items.length === 0 && (
                        <p className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" />
                            Todo configurado: el informe saldrá completo.
                        </p>
                    )}
                    {required.length > 0 && (
                        <section className="space-y-2">
                            <p className="text-[10px] font-bold tracking-wide text-rose-600 uppercase">Falta configurar (obligatorio)</p>
                            {required.map((item) => (
                                <div key={item.id} className="rounded-md border border-rose-200 bg-rose-50 p-2.5 dark:border-rose-500/30 dark:bg-rose-500/10">
                                    <p className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-300">
                                        <XCircle className="h-3.5 w-3.5" />
                                        {item.title}
                                    </p>
                                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{item.detail}</p>
                                    {item.action === 'calculate' && (
                                        <button
                                            type="button"
                                            disabled={lighting.running}
                                            onClick={lighting.run}
                                            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                                        >
                                            <Calculator className={`h-3.5 w-3.5 ${lighting.running ? 'animate-spin' : ''}`} />
                                            {lighting.running ? 'Calculando…' : 'Calcular ahora'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </section>
                    )}
                    {recommended.length > 0 && (
                        <section className="space-y-2">
                            <p className="text-[10px] font-bold tracking-wide text-amber-600 uppercase">Recomendado (el informe sale, pero con estos avisos)</p>
                            {recommended.map((item) => (
                                <div key={item.id} className="rounded-md border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                                    <p className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        {item.title}
                                    </p>
                                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{item.detail}</p>
                                </div>
                            ))}
                        </section>
                    )}
                    {error && <p className="rounded-md bg-rose-50 p-2 text-[11px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
                </div>
                <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-white/10">
                    <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                        Cerrar y configurar
                    </button>
                    <button
                        type="button"
                        disabled={required.length > 0 || exporting}
                        onClick={onExport}
                        title={required.length > 0 ? 'Resuelve primero lo obligatorio' : undefined}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                        <FileText className={`h-3.5 w-3.5 ${exporting ? 'animate-pulse' : ''}`} />
                        {exporting ? 'Generando…' : recommended.length > 0 ? `Exportar con ${recommended.length} aviso(s)` : 'Exportar PDF'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
