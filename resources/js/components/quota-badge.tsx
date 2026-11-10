export interface QuotaStatus {
    limit: number | null;
    used: number;
    remaining: number | null;
    demo: boolean;
    shared: boolean;
}

/**
 * Indicador compacto del cupo de proyectos del plan (ProjectQuotaService::quotaStatus).
 * No muestra nada si el plan es ilimitado.
 */
export function QuotaBadge({ quota }: { quota?: QuotaStatus | null }) {
    if (!quota || quota.limit === null || quota.remaining === null) {
        return null;
    }

    const exhausted = quota.remaining === 0;
    const low = !exhausted && quota.remaining <= 1;

    const tone = exhausted
        ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
        : low
          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
          : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300';

    let text: string;
    if (quota.demo) {
        text = exhausted ? 'Demo en uso · sube de plan para crear más' : 'Plan gratuito · 1 proyecto demo disponible';
    } else if (exhausted) {
        text = `Sin cupos (${quota.used}/${quota.limit}) · sube de plan o elimina un proyecto`;
    } else {
        text = `Te quedan ${quota.remaining} de ${quota.limit} proyectos${quota.shared ? ' (cupo de la organización)' : ''}`;
    }

    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tone}`}>
            {text}
        </span>
    );
}
