import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from 'lucide-react';
import {
    EMPTY_PROJECTION_ADJUST,
    isProjectionAdjusted,
    useSiteLightingStore,
} from '../hooks/useSiteLightingCalculation';

/**
 * Mover la proyección en curso antes de colocarla: flechas que desplazan TODO
 * el conjunto (paso en metros) y "Restablecer". Los postes también se
 * arrastran en el plano (uno solo, o todos con Mayús).
 */
export function ProjectionNudge({ scaleM, stepM = 0.5 }: { scaleM: number; stepM?: number }) {
    const adjust = useSiteLightingStore((state) => state.projectionAdjust);
    const setStore = useSiteLightingStore((state) => state.set);
    const step = stepM / Math.max(scaleM, 1e-9);
    const nudge = (dx: number, dy: number) =>
        setStore({
            projectionAdjust: {
                offset: { x: adjust.offset.x + dx * step, y: adjust.offset.y + dy * step },
                overrides: Object.fromEntries(
                    Object.entries(adjust.overrides).map(([key, point]) => [
                        key,
                        { x: point.x + dx * step, y: point.y + dy * step },
                    ]),
                ),
            },
        });
    const button =
        'flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/10';
    const moved = Object.keys(adjust.overrides).length;
    const offsetM = Math.hypot(adjust.offset.x, adjust.offset.y) * scaleM;
    return (
        <div className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 dark:bg-slate-900">
            <div className="min-w-0 flex-1 text-[10px] leading-snug text-slate-500">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Mover la proyección</p>
                <p>
                    Arrastra un poste en el plano (Mayús = todos) o usa las flechas
                    ({stepM} m).
                    {isProjectionAdjusted(adjust) &&
                        ` Desplazada ${offsetM.toFixed(1)} m${moved ? `, ${moved} movido(s) a mano` : ''}.`}
                </p>
            </div>
            <div className="grid grid-cols-3 gap-0.5">
                <span />
                <button type="button" className={button} onClick={() => nudge(0, -1)} title="Arriba">
                    <ArrowUp className="h-3 w-3" />
                </button>
                <span />
                <button type="button" className={button} onClick={() => nudge(-1, 0)} title="Izquierda">
                    <ArrowLeft className="h-3 w-3" />
                </button>
                <button
                    type="button"
                    className={button}
                    disabled={!isProjectionAdjusted(adjust)}
                    onClick={() => setStore({ projectionAdjust: EMPTY_PROJECTION_ADJUST })}
                    title="Restablecer la posición propuesta"
                >
                    <RotateCcw className="h-3 w-3" />
                </button>
                <button type="button" className={button} onClick={() => nudge(1, 0)} title="Derecha">
                    <ArrowRight className="h-3 w-3" />
                </button>
                <span />
                <button type="button" className={button} onClick={() => nudge(0, 1)} title="Abajo">
                    <ArrowDown className="h-3 w-3" />
                </button>
                <span />
            </div>
        </div>
    );
}
