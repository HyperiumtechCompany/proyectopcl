import { useEffect, useState, type ReactNode } from 'react';

export type LoadingStageStatus =
    | 'pending'
    | 'active'
    | 'done'
    | 'skipped'
    | 'error';

export interface LoadingStage {
    id: string;
    label: string;
    status: LoadingStageStatus;
    /** Texto corto bajo la etapa (ej. "Abriendo plano… 3,2 MB"). */
    detail?: string;
}

interface Props {
    title: string;
    stages: LoadingStage[];
    /**
     * `screen`: ocupa todo el contenedor con fondo opaco (nada que ver debajo).
     * `overlay`: tarjeta sobre un velo semitransparente — el trabajo ya
     * dibujado se ve debajo — y se puede minimizar a una pastilla.
     */
    variant?: 'screen' | 'overlay';
    /** Segundos tras los que se muestra `slowHint`. */
    slowAfterS?: number;
    slowHint?: string;
    /** Acciones extra (ej. "Usar imagen" para abandonar el plano pesado). */
    actions?: ReactNode;
}

/**
 * Indicador de carga por etapas REALES del Módulo General (y reutilizable en
 * otros módulos): cada etapa refleja un estado que ya existe en su hook
 * (`useSiteCadPlan.status/phase`, `useNetworkSnapshotForSite.loading`…), no
 * un avance simulado. La animación usa solo `transform`/`opacity` (Tailwind
 * `animate-spin`/`animate-pulse`), que el navegador anima en el compositor —
 * sigue girando aunque el hilo principal esté ocupado parseando el DWG o
 * construyendo la escena 3D, que es justo cuando el cliente cree que se trabó.
 */
export function ModuleLoadingOverlay({
    title,
    stages,
    variant = 'screen',
    slowAfterS = 8,
    slowHint = 'Sigue cargando — los planos pesados pueden tardar un poco más.',
    actions,
}: Props) {
    const [elapsedS, setElapsedS] = useState(0);
    const [minimized, setMinimized] = useState(false);

    useEffect(() => {
        const timer = window.setInterval(
            () => setElapsedS((seconds) => seconds + 1),
            1000,
        );
        return () => window.clearInterval(timer);
    }, []);

    const finished = stages.filter(
        (stage) => stage.status === 'done' || stage.status === 'skipped',
    ).length;
    const active = stages.some((stage) => stage.status === 'active') ? 0.5 : 0;
    const percent =
        stages.length > 0
            ? Math.min(99, Math.round(((finished + active) / stages.length) * 100))
            : 0;
    const current = stages.find((stage) => stage.status === 'active');

    if (variant === 'overlay' && minimized) {
        return (
            <button
                type="button"
                onClick={() => setMinimized(false)}
                className="absolute top-2 right-2 z-20 flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow hover:bg-white dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-200"
                title="Mostrar detalle de la carga"
            >
                <Spinner small />
                <span>
                    {current?.label ?? title} · {percent}% · {elapsedS} s
                </span>
            </button>
        );
    }

    const card = (
        <div
            role="status"
            aria-live="polite"
            className="w-[min(22rem,calc(100%-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#12151c]"
        >
            <div className="flex items-center gap-3">
                <Spinner />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {percent}% · {elapsedS} s
                    </p>
                </div>
                {variant === 'overlay' && (
                    <button
                        type="button"
                        onClick={() => setMinimized(true)}
                        className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                        title="Seguir trabajando mientras carga"
                    >
                        Minimizar
                    </button>
                )}
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div
                    className="h-full rounded-full bg-amber-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${percent}%` }}
                />
            </div>

            <ul className="mt-3 space-y-1.5">
                {stages.map((stage) => (
                    <li key={stage.id} className="flex items-start gap-2">
                        <StageIcon status={stage.status} />
                        <div className="min-w-0">
                            <p
                                className={`text-xs ${
                                    stage.status === 'active'
                                        ? 'font-semibold text-slate-800 dark:text-slate-100'
                                        : stage.status === 'error'
                                          ? 'text-red-600 dark:text-red-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                }`}
                            >
                                {stage.label}
                            </p>
                            {stage.detail && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                    {stage.detail}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

            {elapsedS >= slowAfterS && (
                <p className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    {slowHint}
                </p>
            )}

            {actions && <div className="mt-3 flex justify-end gap-2">{actions}</div>}
        </div>
    );

    return (
        <div
            className={`absolute inset-0 z-20 flex items-center justify-center ${
                variant === 'screen'
                    ? 'bg-slate-50 dark:bg-[#0d0f14]'
                    : 'bg-slate-900/20 backdrop-blur-[1px] dark:bg-black/40'
            }`}
        >
            {card}
        </div>
    );
}

function Spinner({ small = false }: { small?: boolean }) {
    const size = small ? 'h-3.5 w-3.5 border-2' : 'h-8 w-8 border-[3px]';
    return (
        <span
            aria-hidden
            className={`${size} inline-block shrink-0 animate-spin rounded-full border-amber-500/25 border-t-amber-500`}
        />
    );
}

function StageIcon({ status }: { status: LoadingStageStatus }) {
    if (status === 'active') {
        return (
            <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            </span>
        );
    }
    if (status === 'done') {
        return (
            <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[9px] leading-none font-bold text-white">
                ✓
            </span>
        );
    }
    if (status === 'error') {
        return (
            <span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[9px] leading-none font-bold text-white">
                !
            </span>
        );
    }
    return (
        <span
            className={`mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-full border ${
                status === 'skipped'
                    ? 'border-dashed border-slate-300 dark:border-white/20'
                    : 'border-slate-300 dark:border-white/20'
            }`}
        />
    );
}
