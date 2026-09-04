import { AlertTriangle, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
    parseSurveyCsv,
    type ColumnMap,
    type SurveyPoint,
} from '../domain/surveyImport';

type XlsxModule = {
    read: (data: ArrayBuffer, opts: { type: 'array' }) => XlsxWorkbook;
    utils: { sheet_to_csv: (ws: unknown) => string };
};
type XlsxWorkbook = {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
};

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
    const [override, setOverride] = useState<Partial<ColumnMap>>({});

    const parsed = useMemo(
        () => (text.trim() ? parseSurveyCsv(text, override) : null),
        [text, override],
    );

    const mismatch = useMemo(() => {
        if (!parsed || parsed.points.length === 0 || !siteCentroid)
            return false;
        const n = parsed.points.length;
        const cx = parsed.points.reduce((s, p) => s + p.este, 0) / n;
        const cy = parsed.points.reduce((s, p) => s + -p.norte, 0) / n;
        return Math.hypot(cx - siteCentroid.x, cy - siteCentroid.y) > 2000;
    }, [parsed, siteCentroid]);

    const cotaRange = useMemo<[number, number]>(() => {
        if (!parsed || parsed.points.length === 0) return [0, 0];
        let lo = Infinity;
        let hi = -Infinity;
        for (const p of parsed.points) {
            if (p.cota < lo) lo = p.cota;
            if (p.cota > hi) hi = p.cota;
        }
        return [lo, hi];
    }, [parsed]);

    const [align, setAlign] = useState(true);
    const [sheets, setSheets] = useState<string[]>([]);
    const [sheet, setSheet] = useState<string>('');
    const xlsxRef = useRef<XlsxModule | null>(null);
    const wbRef = useRef<XlsxWorkbook | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);

    // Un .xlsx pegado como texto empieza con "PK" y trae bytes de control
    // — no se puede pegar, hay que cargarlo como archivo.
    const pastedBinary =
        text.startsWith('PK') &&
        [...text.slice(0, 200)].some((ch) => {
            const c = ch.charCodeAt(0);
            return c < 9 || (c > 13 && c < 32);
        });

    const pickSheet = (name: string) => {
        setSheet(name);
        const XLSX = xlsxRef.current;
        const wb = wbRef.current;
        if (XLSX && wb && wb.Sheets[name]) {
            setText(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
        }
    };

    const handleFile = async (file: File) => {
        setFileError(null);
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
            try {
                const XLSX = (await import('xlsx')) as unknown as XlsxModule;
                xlsxRef.current = XLSX;
                const wb = XLSX.read(await file.arrayBuffer(), {
                    type: 'array',
                });
                wbRef.current = wb;
                setSheets(wb.SheetNames);
                // Preferir una hoja de "levantamiento/topografía/puntos".
                const pick =
                    wb.SheetNames.find((n) =>
                        /levant|topog|punto|estac/i.test(n),
                    ) ?? wb.SheetNames[0];
                pickSheet(pick);
            } catch (err) {
                setFileError(
                    'No se pudo leer el Excel: ' +
                        (err instanceof Error ? err.message : String(err)),
                );
            }
            return;
        }
        setSheets([]);
        const reader = new FileReader();
        reader.onload = () => setText(String(reader.result ?? ''));
        reader.readAsText(file);
    };

    const doImport = () => {
        if (!parsed) return;
        let pts = parsed.points;
        if (align && siteCentroid && pts.length > 0) {
            // Traslada el levantamiento para que su centro coincida con el del
            // plano — útil si el DWG no está georreferenciado en la misma zona.
            const n = pts.length;
            const cx = pts.reduce((s, p) => s + p.este, 0) / n;
            const cy = pts.reduce((s, p) => s + -p.norte, 0) / n;
            const dx = siteCentroid.x - cx;
            const dy = siteCentroid.y - cy;
            pts = pts.map((p) => ({
                ...p,
                este: p.este + dx,
                norte: p.norte - dy, // norte = -y del sitio
            }));
        }
        onImport(pts);
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
                    Carga el archivo (.xlsx, .xls o .csv) o pega el CSV.
                    Columnas Este, Norte y Cota (m). Cada fila se coloca como un
                    punto acotado; la cota alimenta la superficie del terreno.
                </p>

                <div className="mb-2 flex items-center gap-2">
                    <label className="cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                        Cargar archivo
                        <input
                            type="file"
                            accept=".csv,.txt,.xlsx,.xls"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleFile(f);
                            }}
                        />
                    </label>
                    {sheets.length > 1 && (
                        <select
                            value={sheet}
                            onChange={(e) => pickSheet(e.target.value)}
                            className="h-7 rounded-md border border-slate-200 bg-white px-1 text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            {sheets.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        type="button"
                        onClick={() => setText(SAMPLE)}
                        className="text-[11px] text-slate-400 underline hover:text-slate-600"
                    >
                        ver ejemplo
                    </button>
                </div>

                <textarea
                    value={pastedBinary ? '' : text}
                    onChange={(e) => setText(e.target.value)}
                    rows={6}
                    placeholder="N°,NORTE,ESTE,COTA,DESCRIPCIÓN&#10;1,8917727.9,374837.18,2643.25,E-1"
                    className="mb-2 w-full rounded-md border border-slate-200 bg-white p-2 font-mono text-[10px] text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />

                {fileError && (
                    <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {fileError}
                    </div>
                )}

                {pastedBinary && (
                    <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Eso parece un archivo Excel pegado. Usa “Cargar archivo”
                        y elige el .xlsx.
                    </div>
                )}

                {parsed?.error && !pastedBinary && (
                    <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {parsed.error}
                    </div>
                )}

                {parsed && parsed.headers.length > 0 && (
                    <div className="mb-2 grid grid-cols-3 gap-1">
                        {(['este', 'norte', 'cota'] as const).map((key) => (
                            <label
                                key={key}
                                className="text-[10px] text-slate-500 capitalize"
                            >
                                {key}
                                <select
                                    className="mt-0.5 h-7 w-full rounded-md border border-slate-200 bg-white px-1 text-[11px] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                    value={parsed.columnGuess[key]}
                                    onChange={(e) =>
                                        setOverride((o) => ({
                                            ...o,
                                            [key]: Number(e.target.value),
                                        }))
                                    }
                                >
                                    {parsed.headers.map((h, i) => (
                                        <option key={i} value={i}>
                                            {h || `col ${i + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ))}
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
                            {parsed.invalidCota > 0 && (
                                <div className="flex justify-between text-slate-400">
                                    <span>Cota inválida (±99999…)</span>
                                    <span>{parsed.invalidCota}</span>
                                </div>
                            )}
                            {parsed.swapped > 0 && (
                                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                    <span>Este↔Norte corregidos</span>
                                    <span>{parsed.swapped}</span>
                                </div>
                            )}
                            {parsed.skipped > 0 && (
                                <div className="flex justify-between text-slate-400">
                                    <span>Filas sin coordenadas</span>
                                    <span>{parsed.skipped}</span>
                                </div>
                            )}
                            <div className="mt-1 text-[10px] text-slate-400">
                                Cotas {cotaRange[0].toFixed(2)} –{' '}
                                {cotaRange[1].toFixed(2)} m
                            </div>
                        </div>

                        <div className="mb-2 max-h-40 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
                            <table className="w-full text-left text-[10px]">
                                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                                    <tr>
                                        <th className="px-2 py-1">Este</th>
                                        <th className="px-2 py-1">Norte</th>
                                        <th className="px-2 py-1">Cota</th>
                                        <th className="px-2 py-1">Desc.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsed.points.slice(0, 30).map((p, i) => (
                                        <tr
                                            key={i}
                                            className="border-t border-slate-100 dark:border-white/5"
                                        >
                                            <td className="px-2 py-0.5 tabular-nums">
                                                {p.este.toFixed(2)}
                                            </td>
                                            <td className="px-2 py-0.5 tabular-nums">
                                                {p.norte.toFixed(2)}
                                            </td>
                                            <td className="px-2 py-0.5 tabular-nums">
                                                {p.cota.toFixed(2)}
                                            </td>
                                            <td className="px-2 py-0.5 text-slate-500">
                                                {p.desc}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {parsed.points.length > 30 && (
                                <p className="border-t border-slate-100 px-2 py-1 text-[10px] text-slate-400 dark:border-white/5">
                                    … y {parsed.points.length - 30} más
                                </p>
                            )}
                        </div>

                        {mismatch && !align && (
                            <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                Los puntos caen lejos del plano. Actívales
                                “alinear sobre el plano” para traerlos encima.
                            </div>
                        )}

                        {siteCentroid && (
                            <label className="mb-2 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={align}
                                    onChange={(e) => setAlign(e.target.checked)}
                                />
                                Alinear el levantamiento sobre el plano actual
                                {mismatch && (
                                    <span className="text-amber-600 dark:text-amber-400">
                                        (recomendado)
                                    </span>
                                )}
                            </label>
                        )}

                        <button
                            type="button"
                            onClick={doImport}
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
