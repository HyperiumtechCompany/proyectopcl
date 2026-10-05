import { useValorizacionBase } from '../hooks/useValorizacionBase';
import { usePersistencia } from '../store/PersistenciaProvider';
import { useValorizacionStore } from '../store/ValorizacionStoreProvider';

/** Elige la valorización activa (N°01, N°02…): cada hoja se recalcula al corte de ese mes. */
export function PeriodoSelector() {
    const { periodos } = useValorizacionBase();
    const periodo = useValorizacionStore((state) => state.input.periodo);
    const setPeriodo = useValorizacionStore((state) => state.setPeriodo);
    const { cortes } = usePersistencia();
    const aprobadas = new Set(cortes.map((corte) => corte.numero));

    return (
        <label className="inline-flex items-center gap-2 text-[11px] text-stone-400">
            <span className="hidden sm:inline">Valorización</span>
            <select
                value={periodo.mes.slice(0, 7)}
                onChange={(event) => {
                    const index = periodos.findIndex((p) => p.key === event.target.value);
                    if (index >= 0) {
                        setPeriodo(index + 1, periodos[index].mes);
                    }
                }}
                className="min-h-9 max-w-full rounded-md border border-stone-700 bg-stone-800 px-2 py-1.5 text-base font-semibold text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 focus:outline-none sm:text-xs"
            >
                {periodos.map((p, index) => (
                    <option key={p.key} value={p.key}>
                        N°{String(index + 1).padStart(2, '0')} · {p.label}{aprobadas.has(index + 1) ? ' · aprobada' : ''}
                    </option>
                ))}
            </select>
        </label>
    );
}
