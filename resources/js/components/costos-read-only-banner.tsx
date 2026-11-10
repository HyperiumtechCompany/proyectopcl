import { usePage } from '@inertiajs/react';
import { Eye } from 'lucide-react';

/**
 * Aviso fijo cuando el usuario abre un proyecto de Costos compartido como
 * Lector (props.costosAccess, compartido por SetCostosDatabase / show).
 * El bloqueo real de escritura lo hace el servidor; esto solo lo explica.
 */
export function CostosReadOnlyBanner() {
    const { costosAccess } = usePage<{ costosAccess?: string | null }>().props;

    if (costosAccess !== 'viewer') {
        return null;
    }

    return (
        <div className="flex items-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs font-medium text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            <Eye className="h-4 w-4 shrink-0" />
            Estás viendo un proyecto compartido en modo lectura: puedes revisarlo y exportarlo, pero los cambios no se guardarán.
        </div>
    );
}
