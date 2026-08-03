/**
 * Overlays de estado del canvas 2D (carga, error, documento activo,
 * calibración). Extraído de `MlightcadCanvas2D.tsx` (Fase 2, extracción
 * conservadora) — puramente presentacional, sin estado ni efectos propios;
 * mismo JSX, mismas clases, mismas condiciones de visibilidad.
 */

export interface CadStatusOverlaysProps {
    isLoading: boolean;
    loadProgress: number;
    fileName: string | null;
    error: string | null;
    /** Solo se evalúa su presencia (truthy) — el documento en sí no se usa aquí. */
    activeDoc: unknown;
    onFitToView: () => void;
    isCalibrated: boolean;
    calibrationFactor: number;
}

export function CadStatusOverlays({
    isLoading,
    loadProgress,
    fileName,
    error,
    activeDoc,
    onFitToView,
    isCalibrated,
    calibrationFactor,
}: CadStatusOverlaysProps) {
    return (
        <>
            {/* ── Overlay de carga ── */}
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="flex min-w-65 flex-col items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
                        <div className="relative h-12 w-12">
                            <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-slate-200">Procesando archivo CAD</p>
                            <p className="mt-1 font-mono text-xs text-slate-400">{fileName}</p>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-700">
                            <div className="h-1.5 rounded-full bg-cyan-500 transition-all" style={{ width: `${loadProgress}%` }} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Error banner ── */}
            {error && !isLoading && (
                <div className="absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-red-700/70 bg-red-900/90 px-4 py-2 text-xs text-red-200 shadow-lg backdrop-blur-sm">
                    <span>⚠</span>
                    <span>{error}</span>
                </div>
            )}

            {/* ── Badge de documento activo ── */}
            {activeDoc && !isLoading && (
                <div className="absolute top-3 right-3 z-30 flex items-center gap-2 rounded-lg border border-cyan-900/60 bg-slate-900/85 px-3 py-1.5 text-xs shadow-xl backdrop-blur">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                    <span className="font-mono text-cyan-300">{fileName}</span>
                    <button
                        onClick={onFitToView}
                        className="ml-1 rounded border border-cyan-700/40 bg-cyan-800/40 px-2 py-0.5 text-[10px] text-cyan-200 hover:bg-cyan-700/50"
                    >
                        Fit
                    </button>
                </div>
            )}

            {/* ── Badge de calibración activa ── */}
            {isCalibrated && calibrationFactor !== 1 && (
                <div className="absolute top-14 right-3 z-30 flex items-center gap-2 rounded-lg border border-amber-900/60 bg-slate-900/85 px-3 py-1.5 text-xs shadow-xl backdrop-blur">
                    <div className="text-amber-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
                            <path d="m14.5 12.5 2-2" />
                            <path d="m11.5 9.5 2-2" />
                            <path d="m8.5 6.5 2-2" />
                            <path d="m17.5 15.5 2-2" />
                        </svg>
                    </div>
                    <span className="font-mono text-amber-300 font-semibold" title="Los objetos arquitectónicos están escalados con este factor.">
                        Calibrado ×{calibrationFactor.toFixed(4)}
                    </span>
                </div>
            )}

            {/* ── Label del motor ── */}
            <div className="pointer-events-none absolute right-3 bottom-3 z-20 font-mono text-[9px] text-cyan-900/60 select-none">
                mlightcad engine
            </div>
        </>
    );
}
