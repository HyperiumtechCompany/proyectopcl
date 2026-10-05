import { readPresupuestoExcel } from '../../data/importers/readPresupuestoExcel';
import type { PresupuestoExcelResult } from '../../data/importers/readPresupuestoExcel';
import { ExcelFileButton } from '../../shared/ExcelFileButton';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';

export interface ImportSummary extends PresupuestoExcelResult {
    fileName: string;
}

const failed = (fileName: string, message: string): ImportSummary => ({
    fileName,
    sheetName: '',
    partidas: [],
    parametros: { gastosGenerales: null, utilidad: null, igv: null },
    excel: { costoDirecto: null, total: null },
    warnings: [message],
});

/** Botón "Importar Excel": lee la hoja PRESUPUESTO y reemplaza el árbol de partidas (se puede deshacer). */
export function ImportPresupuestoButton({ onImported }: { onImported: (summary: ImportSummary) => void }) {
    const replacePresupuesto = useValorizacionStore((state) => state.replacePresupuesto);
    const partidasActuales = useValorizacionStore((state) => state.input.presupuesto.partidas.length);

    const onFile = async (data: ArrayBuffer, fileName: string) => {
        try {
            const result = await readPresupuestoExcel(data);
            const summary = { ...result, fileName };
            if (result.partidas.length > 0) {
                const message = `Se leyeron ${result.partidas.length} filas de la hoja "${result.sheetName}". ¿Reemplazar el presupuesto actual (${partidasActuales} filas)? Puedes deshacerlo con Ctrl+Z.`;
                if (partidasActuales > 0 && !window.confirm(message)) {
                    return;
                }
                const { gastosGenerales, utilidad, igv } = result.parametros;
                replacePresupuesto({ fuente: 'excel', partidas: result.partidas }, gastosGenerales && utilidad && igv ? { gastosGenerales, utilidad, igv } : undefined);
            }
            onImported(summary);
        } catch (error) {
            onImported(failed(fileName, `No se pudo leer el archivo: ${error instanceof Error ? error.message : String(error)}`));
        }
    };

    return <ExcelFileButton onFile={onFile} />;
}
