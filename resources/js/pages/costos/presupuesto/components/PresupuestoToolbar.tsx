import React from 'react';

interface PresupuestoToolbarProps {
    subsectionLabel: string;
    rowCount: number;
    columnCount: number;
    selectedCell: { row: number; col: number } | null;
    deleting: boolean;
    onDeleteRow: (rowIndex: number) => void;
    pendingSave: boolean;
    saving: boolean;
    lastSaved: Date | null;
    error: string | null;
    subsection: string;
    availableMetrados: Array<{ type: string; label: string; rowCount: number }>;
    importing: boolean;
    importMessage: string | null;
    onImportMetrado: (metradoType: string) => void;
}

export function PresupuestoToolbar({
    subsectionLabel,
    rowCount,
    columnCount,
    selectedCell,
    deleting,
    onDeleteRow,
    pendingSave,
    saving,
    lastSaved,
    error,
    subsection,
    availableMetrados,
    importing,
    importMessage,
    onImportMetrado,
}: PresupuestoToolbarProps) {
    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {subsectionLabel}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {rowCount} registro(s) | {columnCount} columnas
                        {selectedCell && ` | Fila ${selectedCell.row} seleccionada`}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {selectedCell && (
                        <button
                            onClick={() => onDeleteRow(selectedCell.row - 1)}
                            disabled={deleting}
                            className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300"
                        >
                            {deleting ? 'Eliminando...' : '🗑️ Eliminar fila'}
                        </button>
                    )}

                    <div className="flex items-center gap-2 text-xs">
                        {pendingSave && !saving && (
                            <span className="rounded bg-blue-100 px-2 py-1 text-blue-700">
                                Cambios pendientes...
                            </span>
                        )}
                        {saving && (
                            <span className="rounded bg-yellow-100 px-2 py-1 text-yellow-700">
                                Guardando...
                            </span>
                        )}
                        {!saving && lastSaved && (
                            <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">
                                Guardado{' '}
                                {lastSaved.toLocaleTimeString('es-PE', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </span>
                        )}
                        {error && (
                            <span className="max-w-xs truncate rounded bg-red-100 px-2 py-1 text-red-700">
                                {error}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {subsection === 'general' && availableMetrados.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
                    <p className="mb-2 text-xs text-blue-700 dark:text-blue-300">
                        Importar estructura desde metrados:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {availableMetrados.map((m) => (
                            <button
                                key={m.type}
                                onClick={() => onImportMetrado(m.type)}
                                disabled={importing}
                                className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                                {importing ? 'Importando...' : `${m.label} (${m.rowCount})`}
                            </button>
                        ))}
                    </div>
                    {importMessage && (
                        <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                            {importMessage}
                        </p>
                    )}
                </div>
            )}
        </>
    );
}
