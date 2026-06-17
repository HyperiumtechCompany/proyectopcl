import { X, FileSpreadsheet, AlertCircle, Upload, CheckCircle } from 'lucide-react';
import React, { useState, useCallback } from 'react';
import axios from 'axios';

interface ImportAcusExcelModalProps {
    projectId: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const ImportAcusExcelModal: React.FC<ImportAcusExcelModalProps> = ({
    projectId,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'select' | 'success'>('select');
    const [summary, setSummary] = useState<{
        created: number;
        updated: number;
        skipped: number;
        errors: string[];
    } | null>(null);

    const reset = useCallback(() => {
        setFiles([]);
        setIsImporting(false);
        setError(null);
        setStep('select');
        setSummary(null);
    }, []);

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles) return;

        const validFiles: File[] = [];
        const invalidNames: string[] = [];

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const ext = file.name.toLowerCase().split('.').pop();
            if (ext === 'xls' || ext === 'xlsx') {
                validFiles.push(file);
            } else {
                invalidNames.push(file.name);
            }
        }

        if (invalidNames.length > 0) {
            setError(`Archivos no soportados: ${invalidNames.join(', ')}. Solo se aceptan .xls y .xlsx`);
        } else {
            setError(null);
        }

        setFiles(validFiles);
        setStep('select');
    };

    const addMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles) return;

        const newFiles: File[] = [];
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const ext = file.name.toLowerCase().split('.').pop();
            if ((ext === 'xls' || ext === 'xlsx') && !files.some(f => f.name === file.name)) {
                newFiles.push(file);
            }
        }
        setFiles(prev => [...prev, ...newFiles]);
    };

    const removeFile = (fileName: string) => {
        setFiles(prev => prev.filter(f => f.name !== fileName));
    };

    const handleImport = async () => {
        if (files.length === 0) return;
        setIsImporting(true);
        setError(null);

        try {
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files[]', file);
            });

            const response = await axios.post(
                `/costos/proyectos/${projectId}/presupuesto/acus/import-excel`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Accept': 'application/json',
                    },
                }
            );

            if (response.data?.success) {
                setSummary(response.data.summary);
                setStep('success');
            } else {
                setError(response.data?.message || 'Error desconocido en la importación');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Error de conexión';
            setError(msg);
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-900/50 px-5 py-4">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-amber-400" />
                        Importar ACUs desde Excel
                    </h3>
                    <button
                        onClick={handleClose}
                        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
                    {step === 'select' && (
                        <>
                            <p className="text-sm text-slate-300">
                                Seleccione los archivos Excel de ACUs (Análisis de Costos Unitarios).
                                Se importarán las partidas que coincidan con el presupuesto actual.
                            </p>

                            {error && (
                                <div className="flex items-center gap-2 rounded bg-red-900/40 p-3 text-sm text-red-400 border border-red-800">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <label className="cursor-pointer flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-slate-600 bg-slate-900/30 p-8 transition-colors hover:border-amber-500/50 hover:bg-slate-900/50">
                                <Upload className="h-10 w-10 text-amber-400" />
                                <span className="text-sm font-medium text-slate-300">
                                    {files.length === 0 ? 'Seleccionar archivos Excel' : 'Agregar más archivos'}
                                </span>
                                <span className="text-xs text-slate-500">ACU ESTRUCTURAS.xls, ACU SANITARIAS.xls, etc.</span>
                                <input
                                    type="file"
                                    accept=".xls,.xlsx"
                                    multiple
                                    className="hidden"
                                    onChange={files.length === 0 ? handleFileSelect : addMoreFiles}
                                    disabled={isImporting}
                                />
                            </label>

                            {files.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Archivos seleccionados ({files.length})
                                    </span>
                                    {files.map(file => (
                                        <div key={file.name} className="flex items-center gap-2 rounded bg-slate-900/60 px-3 py-2 border border-slate-700/50">
                                            <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                                            <span className="text-sm text-slate-200 flex-1 truncate">{file.name}</span>
                                            <span className="text-[10px] text-slate-500">
                                                {(file.size / 1024).toFixed(0)} KB
                                            </span>
                                            <button
                                                onClick={() => removeFile(file.name)}
                                                className="text-slate-500 hover:text-red-400 transition-colors"
                                                disabled={isImporting}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {step === 'success' && summary && (
                        <div className="flex flex-col items-center gap-4 py-6">
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-900/30 border border-emerald-700/40">
                                <CheckCircle className="h-10 w-10 text-emerald-400" />
                            </div>
                            <p className="text-sm text-slate-300 text-center">
                                Importación de ACUs completada exitosamente
                            </p>
                            <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                                <div className="rounded-lg bg-emerald-900/30 p-3 text-center border border-emerald-700/40">
                                    <div className="text-2xl font-bold text-emerald-400">{summary.created}</div>
                                    <div className="text-[10px] text-emerald-300 uppercase font-bold">Creados</div>
                                </div>
                                <div className="rounded-lg bg-amber-900/30 p-3 text-center border border-amber-700/40">
                                    <div className="text-2xl font-bold text-amber-400">{summary.updated}</div>
                                    <div className="text-[10px] text-amber-300 uppercase font-bold">Actualizados</div>
                                </div>
                                <div className="rounded-lg bg-slate-900/60 p-3 text-center border border-slate-700/50">
                                    <div className="text-2xl font-bold text-slate-400">{summary.skipped}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Omitidos</div>
                                </div>
                            </div>
                            {summary.errors && summary.errors.length > 0 && (
                                <div className="w-full">
                                    <span className="text-xs font-bold text-red-400">Errores:</span>
                                    {summary.errors.map((err, i) => (
                                        <p key={i} className="text-xs text-red-300">{err}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-700/50 bg-slate-900/50 p-4">
                    {step === 'select' && (
                        <>
                            <button
                                onClick={handleClose}
                                disabled={isImporting}
                                className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={isImporting || files.length === 0}
                                className="flex items-center gap-2 rounded bg-amber-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500"
                            >
                                {isImporting ? (
                                    <>
                                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Importando...
                                    </>
                                ) : (
                                    <>
                                        <FileSpreadsheet size={14} />
                                        Importar {files.length} Archivo{files.length !== 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                        </>
                    )}
                    {step === 'success' && (
                        <button
                            onClick={() => {
                                onSuccess();
                                handleClose();
                            }}
                            className="rounded bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
                        >
                            Continuar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};