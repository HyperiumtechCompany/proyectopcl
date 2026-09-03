import { AlertTriangle, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { parseSurveyCsv, type SurveyPoint } from '../domain/surveyImport';

interface Props {
    /** Centroide (x, y en coords del sitio) de la geometría actual, para avisar si el levantamiento no coincide. */
    siteCentroid: { x: number; y: number } | null;
    onImport: (points: SurveyPoint[]) => void;
    onClose: () => void;
}

const SAMPLE =
    'N°,NORTE,ESTE,COTA,DESCRIPCIÓN\n1,8917727.9,374837.18,2643.25,E-1\n2,8917726.19,374839.349,2643.39,BM-01';

export function SiteSurveyImportDialog({
    siteCentroid,
    onImport,
    onClose,
}: Props) {
    const [text, setText] = useState('');

    const parsed = useMemo(
        () => (text.trim() ? parseSurveyCsv(text) : null),
        [text],
    );

    const mismatch = useMemo(() => {
        if (!parsed || parsed.points.length === 0 || !siteCentroid)
            return false;
        const n = parsed.points.length;
        const cx = parsed.points.reduce((s, p) => s + p.este, 0) / n;
        const cy = parsed.points.reduce((s, p) => s + -p.norte, 0) / n;
        return Math.hypot(cx - siteCentroid.x, cy - siteCentroid.y) > 2000;
    }, [parsed, siteCentroid]);

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => setText(String(reader.result ?? ''));
        reader.readAsText(file);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        Importar levantamiento topográfico
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                    Pega el CSV o carga el archivo. Columnas Este, Norte y Cota
                    (m). Cada fila se coloca como un punto acotado; la cota
                    alimenta la superficie del terreno.
                </p>

                <div className="mb-2 flex items-center gap-2">
                    <label className="cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                        Cargar .csv
                        <input
                            type="file"
                            accept=".csv,.txt"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFile(f);
                            }}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => setText(SAMPLE)}
                        className="text-[11px] text-slate-400 underline hover:text-slate-600"
                    >
                        ver ejemplo
                    </button>
                </div>

                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={6}
                    placeholder="N°,NORTE,ESTE,COTA,DESCRIPCIÓN&#10;1,8917727.9,374837.18,2643.25,E-1"
                    className="mb-2 w-full rounded-md border border-slate-200 bg-white p-2 font-mono text-[10px] text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />

                {parsed?.error && (
                    <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {parsed.error}
                    </div>
                )}

                {parsed && parsed.points.length > 0 && (
                    <>
                        <div className="mb-2 rounded-lg border border-slate-200 p-2 text-[11px] dark:border-white/10">
                            <div className="flex justify-between">
                                <span className="text-slate-500">
                                    Puntos válidos
                                </span>
                                <strong>{parsed.points.length}</strong>
                            </div>
                            {parsed.skipped > 0 && (
                                <div className="flex justify-between text-slate-400">
                                    <span>Filas descartadas</span>
                                    <span>{parsed.skipped}</span>
                                </div>
                            )}
                            <div className="mt-1 text-[10px] text-slate-400">
                                Columnas: Este = «
                                {parsed.headers[parsed.columnGuess.este] ??
                                    parsed.columnGuess.este}
                                », Norte = «
                                {parsed.headers[parsed.columnGuess.norte] ??
                                    parsed.columnGuess.norte}
                                », Cota = «
                                {parsed.headers[parsed.columnGuess.cota] ??
                                    parsed.columnGuess.cota}
                                »
                            </div>
                            <div className="mt-1 text-[10px] text-slate-400">
                                Cotas{' '}
                                {Math.min(
                                    ...parsed.points.map((p) => p.cota),
                                ).toFixed(2)}{' '}
                                –{' '}
                                {Math.max(
                                    ...parsed.points.map((p) => p.cota),
                                ).toFixed(2)}{' '}
                                m
                            </div>
                        </div>

                        {mismatch && (
                            <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                Los puntos caen lejos del plano. Si el plano no
                                está georreferenciado en la misma zona UTM,
                                tendrás que moverlos después.
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => onImport(parsed.points)}
                            className="h-8 w-full rounded-md bg-amber-600 text-xs font-semibold text-white"
                        >
                            Importar {parsed.points.length} puntos acotados
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
