import type Decimal from 'decimal.js';
import { BadgeCheck, LockOpen, Stamp } from 'lucide-react';
import { useState } from 'react';
import { useValidaciones } from '../hooks/useValidaciones';
import { formatDate } from '../lib/dates';
import { usePersistencia } from '../store/PersistenciaProvider';
import { useValorizacionStore } from '../store/ValorizacionStoreProvider';
import { HallazgosList } from './ValidacionesMenu';

interface Props {
    valorizado: Decimal;
    liquido: Decimal;
    avanceAcumulado: Decimal;
}

/**
 * Aprobar / reabrir la valorización activa. Aprobar guarda primero y congela en
 * el servidor una copia de los datos (valorizacion_v2_cortes). Los errores de
 * negocio (validarValorizacion) bloquean la aprobación, no el autoguardado.
 */
export function AprobacionControl({ valorizado, liquido, avanceAcumulado }: Props) {
    const periodo = useValorizacionStore((state) => state.input.periodo);
    const { cortes, aprobar, reabrir } = usePersistencia();
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { errores } = useValidaciones();
    const corte = cortes.find((c) => c.numero === periodo.numero);
    const numero = String(periodo.numero).padStart(2, '0');

    const ejecutar = async (accion: () => Promise<void>) => {
        setOcupado(true);
        setError(null);
        try {
            await accion();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setOcupado(false);
        }
    };

    if (corte) {
        return (
            <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200">
                        <BadgeCheck className="size-4" /> N°{numero} aprobada{corte.aprobado_at ? ` el ${formatDate(corte.aprobado_at.slice(0, 10))}` : ''}
                    </span>
                    <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => window.confirm(`¿Reabrir la valorización N°${numero}? Se elimina la copia aprobada.`) && void ejecutar(() => reabrir(periodo.numero))}
                        className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-red-400 hover:text-red-700 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
                    >
                        <LockOpen className="size-3.5" /> Reabrir
                    </button>
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
        );
    }

    if (errores.length > 0) {
        return (
            <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 dark:border-red-500/30 dark:bg-red-500/10">
                <p className="text-xs font-semibold text-red-800 dark:text-red-200">
                    No se puede aprobar la N°{numero}: {errores.length} error{errores.length === 1 ? '' : 'es'} por corregir.
                </p>
                <HallazgosList hallazgos={errores} />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                    window.confirm(`¿Aprobar la valorización N°${numero}? Se guardará una copia congelada de los datos actuales.`) &&
                    void ejecutar(() =>
                        aprobar({
                            numero: periodo.numero,
                            mes: periodo.mes,
                            resumen: { valorizado: valorizado.toFixed(2), liquido: liquido.toFixed(2), avanceAcumulado: avanceAcumulado.toFixed(4) },
                        }),
                    )
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
                <Stamp className="size-3.5" /> {ocupado ? 'Aprobando…' : `Aprobar valorización N°${numero}`}
            </button>
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}
