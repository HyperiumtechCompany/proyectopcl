import { useControl } from '../../hooks/useControl';
import { CurvaSChart } from '../../shared/CurvaSChart';
import { SituacionBadge } from '../../shared/SituacionBadge';
import { CurvaSTable } from './CurvaSTable';

/** Hoja CURVA S: gráfico programado vs ejecutado acumulado + tabla de datos. */
export default function CurvaSSheet() {
    const { control } = useControl();

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Curva S</h2>
                    <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">Gráfico de control de avance de obra: programado vs ejecutado (% acumulado).</p>
                </div>
                {control.ultima?.evaluacion && <SituacionBadge situacion={control.ultima.evaluacion.situacion} prefix="Obra " />}
            </div>
            <figure className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                <CurvaSChart meses={control.meses} />
            </figure>
            <CurvaSTable control={control} />
        </div>
    );
}
