import { useState } from 'react';
import type { S10PdfPreview } from '../helpers/previewS10Pdf';

const amount = (value: number | null) =>
    value === null
        ? 'No declarado'
        : value.toLocaleString('es-PE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 10,
          });

export function S10PdfPreviewPanel({
    preview,
    included,
    disabled,
    onInclude,
}: {
    preview: S10PdfPreview;
    included: boolean;
    disabled: boolean;
    onInclude: (included: boolean) => void;
}) {
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const search = query.trim().toLowerCase();
    const visible = preview.entries.filter((entry) =>
        `${entry.source.partida_code} ${entry.source.partida_desc} ${entry.reasons.join(' ')} ${entry.warnings.join(' ')}`
            .toLowerCase()
            .includes(search),
    );
    const compatible = preview.applicableMatches.length;
    const linked = preview.entries.filter((entry) => entry.match.row).length;

    return (
        <div className="mt-3 flex flex-col gap-3 text-xs text-slate-300">
            <p className="rounded border border-blue-800 bg-blue-950/40 px-3 py-2 text-blue-200">
                PDF de ACU: {preview.pages} páginas,{' '}
                {preview.entries.length} ACU principales y{' '}
                {preview.auxiliaryCount} auxiliares. {linked} vinculados con
                este presupuesto.
            </p>
            <p>
                <strong className="text-green-300">
                    {compatible} compatibles
                </strong>{' '}
                para cargar conservando los precios del Excel y los parciales
                del PDF. {preview.entries.length - compatible} pendientes por
                vínculos o lecturas incompletas.
            </p>
            <label className="flex items-start gap-2 rounded border border-slate-700 px-3 py-2">
                <input
                    type="checkbox"
                    aria-label="Incluir ACU del PDF"
                    checked={included}
                    disabled={disabled || compatible === 0}
                    onChange={(event) => onInclude(event.target.checked)}
                    className="mt-0.5"
                />
                <span>
                    Incluir únicamente los {compatible} ACU compatibles en la
                    carga. Después usa «Cargar en vista» y revisa el presupuesto
                    antes de guardar.
                </span>
            </label>
            <details>
                <summary className="cursor-pointer text-blue-300">
                    Revisar vínculos, costos y partidas pendientes
                </summary>
                <input
                    aria-label="Buscar partida del PDF"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(0);
                    }}
                    placeholder="Buscar código, descripción o motivo"
                    className="my-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200"
                />
                <p className="mb-2 text-slate-400">
                    {visible.length} resultados. Página {page + 1} de{' '}
                    {Math.max(1, Math.ceil(visible.length / 100))}. La carga
                    incluye los {compatible} seleccionables, no solo esta
                    página.
                </p>
                <div className="mb-2 flex gap-3">
                    <button
                        type="button"
                        disabled={page === 0}
                        onClick={() => setPage((value) => value - 1)}
                        className="text-blue-300 disabled:opacity-40"
                    >
                        Anterior
                    </button>
                    <button
                        type="button"
                        disabled={(page + 1) * 100 >= visible.length}
                        onClick={() => setPage((value) => value + 1)}
                        className="text-blue-300 disabled:opacity-40"
                    >
                        Siguiente
                    </button>
                </div>
                <div className="max-h-64 overflow-auto rounded border border-slate-700">
                    <table className="w-full text-left text-[10px]">
                        <thead className="sticky top-0 bg-slate-900 text-slate-300">
                            <tr>
                                <th className="p-2">Partida / página</th>
                                <th className="p-2">PDF / cálculo actual</th>
                                <th className="p-2">Resultado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible
                                .slice(page * 100, (page + 1) * 100)
                                .map((entry, index) => (
                                    <tr
                                        key={`${entry.source.partida_code}-${index}`}
                                        className="border-t border-slate-800 align-top"
                                    >
                                        <td className="p-2">
                                            <div className="font-mono">
                                                {entry.source.partida_code} ·
                                                pág. {entry.source.page}
                                            </div>
                                            {entry.source.partida_desc}
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                            {amount(entry.source.declared_cost)}
                                            <br />
                                            {amount(entry.calculatedCost)}
                                        </td>
                                        <td
                                            className={`p-2 ${entry.reasons.length ? 'text-amber-300' : 'text-green-300'}`}
                                        >
                                            {entry.reasons.length
                                                ? entry.reasons.join(' ')
                                                : 'Listo para cargar con valores del PDF.'}
                                            {entry.warnings.length > 0 && (
                                                <p className="mt-1 text-amber-300">
                                                    {entry.warnings.join(' ')}
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </details>
            {preview.issues.length > 0 && (
                <details>
                    <summary className="cursor-pointer text-amber-300">
                        Observaciones de lectura ({preview.issues.length})
                    </summary>
                    <div className="mt-2 max-h-40 overflow-auto rounded bg-slate-900 p-2 text-[10px] text-amber-200">
                        {preview.issues.map((issue, index) => (
                            <p key={index}>
                                {issue.code ?? 'Documento'} · pág.{' '}
                                {issue.page ?? '—'}: {issue.message}
                            </p>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}
