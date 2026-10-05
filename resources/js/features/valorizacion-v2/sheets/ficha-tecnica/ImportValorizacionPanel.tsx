import { useState } from 'react';
import { readValorizacionExcel } from '../../data/importers/readValorizacionExcel';
import type { ValorizacionExcelResult } from '../../data/importers/readValorizacionExcel';
import { ExcelFileButton } from '../../shared/ExcelFileButton';
import { ImportSummaryPanel } from '../../shared/ImportSummaryPanel';
import { useValorizacionStoreApi } from '../../store/ValorizacionStoreProvider';
import type { ValorizacionInput } from '../../types';

interface Preview {
    fileName: string;
    base: ValorizacionInput;
    result: ValorizacionExcelResult;
}

/** Revisión del expediente completo antes de actualizar todas las hojas en un solo paso. */
export function ImportValorizacionPanel() {
    const store = useValorizacionStoreApi();
    const [preview, setPreview] = useState<Preview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importado, setImportado] = useState(false);
    const onFile = async (data: ArrayBuffer, fileName: string) => {
        setError(null);
        setPreview(null);
        setImportado(false);
        try {
            const base = store.getState().input;
            const result = await readValorizacionExcel(data, base);
            setPreview({ fileName, base, result });
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo leer el archivo Excel.',
            );
        }
    };
    const aplicar = () => {
        if (!preview) return;
        if (store.getState().input !== preview.base) {
            setError(
                'Los datos cambiaron después de leer el archivo. Vuelve a seleccionarlo para preparar una importación actualizada.',
            );
            setPreview(null);
            return;
        }
        store.getState().importValorizacion(preview.result.input);
        setImportado(true);
    };

    return (
        <section className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        Importar valorización desde Excel
                    </h3>
                    <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                        Carga la ficha técnica, el presupuesto, el calendario
                        programado y los metrados del mismo expediente. Las
                        hojas de control, pagos y Curva S se recalculan con esos
                        datos.
                    </p>
                </div>
                <ExcelFileButton
                    label="Seleccionar Excel de valorización"
                    onFile={onFile}
                />
            </div>
            {error && (
                <p
                    role="alert"
                    className="text-sm text-red-700 dark:text-red-300"
                >
                    {error}
                </p>
            )}
            {preview && (
                <div className="space-y-3" aria-live="polite">
                    <ImportSummaryPanel
                        summary={{
                            ok: true,
                            title: `${importado ? 'Importado' : 'Archivo listo para importar'}: ${preview.fileName}`,
                            detail: importado
                                ? 'Los datos están conectados a todas las hojas y se guardan automáticamente. Puedes deshacer esta importación.'
                                : 'Se reemplazarán las entradas de las hojas detectadas. Los datos de hojas ausentes se conservan cuando sus partidas siguen en el presupuesto. Puedes deshacer toda la importación.',
                            warnings: preview.result.warnings,
                        }}
                        onClose={() => setPreview(null)}
                    />
                    <ul className="grid gap-2 text-xs sm:grid-cols-2">
                        {preview.result.secciones.map((seccion) => (
                            <li
                                key={seccion.hoja}
                                className="rounded-md bg-stone-50 px-3 py-2 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
                            >
                                <span className="font-semibold">
                                    {seccion.hoja}
                                </span>
                                : {seccion.detalle}
                            </li>
                        ))}
                    </ul>
                    {!importado ? (
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={aplicar}
                                className="min-h-10 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500"
                            >
                                Importar datos y recalcular
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreview(null)}
                                className="min-h-10 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 dark:border-stone-700 dark:text-stone-200"
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-4 text-sm font-semibold text-orange-700 dark:text-orange-300">
                            <a href="#curva-s" className="hover:underline">
                                Ver Curva S
                            </a>
                            <a
                                href="#resumen-porcentajes"
                                className="hover:underline"
                            >
                                Ver indicadores
                            </a>
                            <a href="#resumen-pago" className="hover:underline">
                                Ver resumen de pago
                            </a>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
