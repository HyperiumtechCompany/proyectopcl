import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { useValorizacionStoreApi } from '../store/ValorizacionStoreProvider';

/**
 * Exporta la valorización COMPLETA a un solo .xlsx con el formato formal del
 * expediente (una pestaña por hoja, encabezados, gráficos), armado desde los
 * datos calculados. El módulo de exportación (ExcelJS) se carga al usarlo.
 */
export function ExportarValorizacion({ nombreDocumento, className }: { nombreDocumento: string; className?: string }) {
    const store = useValorizacionStoreApi();
    const [exportando, setExportando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const exportar = async () => {
        setExportando(true);
        setError(null);
        try {
            const { exportarLibro } = await import('../export/libro/exportarLibro');
            await exportarLibro(store.getState().input, nombreDocumento);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setExportando(false);
        }
    };

    return (
        <>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="button" className={className} onClick={() => void exportar()} disabled={exportando} title="Exporta toda la valorización a un solo Excel con el formato del expediente: una pestaña por hoja, con gráficos">
                <FileSpreadsheet className="size-4" /> {exportando ? 'Generando Excel…' : 'Exportar valorización (Excel)'}
            </button>
        </>
    );
}
