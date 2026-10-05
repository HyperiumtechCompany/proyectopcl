import { AlertTriangle } from 'lucide-react';
import { usePersistencia } from '../store/PersistenciaProvider';

/** Aparece si otra pestaña o equipo guardó antes: el usuario elige qué versión conservar. */
export function ConflictoBanner() {
    const { estado, resolverConflicto } = usePersistencia();
    if (estado !== 'conflicto') {
        return null;
    }

    return (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <p className="flex-1">
                <strong>Esta valorización se guardó desde otra pestaña o equipo.</strong> El autoguardado está en pausa para no pisar esos cambios.
            </p>
            <button type="button" onClick={() => resolverConflicto('usar-servidor')} className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-500/40 dark:bg-transparent dark:text-red-200">
                Usar la versión guardada
            </button>
            <button type="button" onClick={() => window.confirm('¿Sobrescribir la versión guardada con tus cambios?') && resolverConflicto('conservar-mios')} className="rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800">
                Conservar mis cambios
            </button>
        </div>
    );
}
