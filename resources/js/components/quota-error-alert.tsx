import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import Swal from 'sweetalert2';

interface QuotaPageProps {
    errors?: Record<string, string>;
    flash?: { quota?: string | null };
    [key: string]: unknown;
}

/**
 * Avisos de cupo de plan en cualquier módulo que use el layout:
 * - errors.quota: rechazo al crear (App\Services\ProjectQuotaService).
 * - flash.quota: tras crear, cuántos cupos quedan o que se usó el último.
 * - errors.read_only: un Lector de un proyecto de Costos intentó guardar.
 */
export function QuotaErrorAlert() {
    const { errors, flash } = usePage<QuotaPageProps>().props;
    const quotaError = errors?.quota;
    const quotaNotice = flash?.quota;
    const readOnlyError = errors?.read_only;

    useEffect(() => {
        if (!readOnlyError) {
            return;
        }

        void Swal.fire({
            icon: 'info',
            title: 'Modo lectura',
            text: readOnlyError,
            confirmButtonText: 'Entendido',
        });
    }, [readOnlyError]);

    useEffect(() => {
        if (!quotaError) {
            return;
        }

        void Swal.fire({
            icon: 'warning',
            title: 'Límite de proyectos alcanzado',
            text: quotaError,
            confirmButtonText: 'Entendido',
        });
    }, [quotaError]);

    useEffect(() => {
        if (!quotaNotice) {
            return;
        }

        const isLast = quotaNotice.startsWith('Usaste');

        void Swal.fire({
            icon: isLast ? 'warning' : 'info',
            title: isLast ? 'No te quedan más proyectos' : 'Proyecto creado',
            text: quotaNotice,
            confirmButtonText: 'Entendido',
        });
    }, [quotaNotice]);

    return null;
}
