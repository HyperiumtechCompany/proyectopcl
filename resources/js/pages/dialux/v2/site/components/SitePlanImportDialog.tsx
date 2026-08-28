import { AlertTriangle, Upload, X } from 'lucide-react';
import { useState } from 'react';
import {
    useSitePlanImport,
    type SitePlanImportResult,
} from '../hooks/useSitePlanImport';

interface Props {
    projectId: number;
    generalModuleId: number;
    onImported: (result: SitePlanImportResult) => void;
    onClose: () => void;
}

export function SitePlanImportDialog({
    projectId,
    generalModuleId,
    onImported,
    onClose,
}: Props) {
    const { containerRef, importFile, status, error, loadProgress } =
        useSitePlanImport(projectId, generalModuleId);
    const [fileName, setFileName] = useState<string | null>(null);
    const processing = status === 'processing';

    const handleFile = async (file: File) => {
        setFileName(file.name);
        const result = await importFile(file);
        if (result) onImported(result);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !processing && onClose()}
        >
            <div
                className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        Importar plano DXF/DWG
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={processing}
                        title="Cerrar"
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
                    Se convierte a una imagen fija (como un fondo de calco) —
                    no queda editable como CAD. El tamaño inicial es una
                    estimación; podrás calibrarlo con una distancia real
                    después de importar.
                </p>
                {!processing && (
                    <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-6 text-xs text-slate-500 hover:border-cyan-400 dark:border-white/15 dark:text-slate-400">
                        <Upload className="h-4 w-4" />
                        {fileName ?? 'Seleccionar archivo .dxf o .dwg'}
                        <input
                            type="file"
                            accept=".dxf,.dwg"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void handleFile(file);
                            }}
                        />
                    </label>
                )}
                {processing && (
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                        Procesando {fileName}…{' '}
                        {loadProgress > 0 && loadProgress < 100
                            ? `${Math.round(loadProgress)}%`
                            : 'puede tardar varios segundos con planos pesados'}
                    </p>
                )}
                {error && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {error}
                    </div>
                )}
                {/* Contenedor real del motor CAD — visible como preview mientras procesa. */}
                <div
                    ref={containerRef}
                    className="relative h-64 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-white/10"
                />
            </div>
        </div>
    );
}
