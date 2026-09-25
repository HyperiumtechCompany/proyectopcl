import type {
    LoadingStage,
    LoadingStageStatus,
} from '../../components/ModuleLoadingOverlay';
import type { SiteCadPlanPhase } from '../hooks/useSiteCadPlan';

const CAD_PHASE_ORDER: Exclude<SiteCadPlanPhase, null>[] = [
    'reading',
    'initializing',
    'opening',
];

function cadStageStatus(
    stage: Exclude<SiteCadPlanPhase, null>,
    current: Exclude<SiteCadPlanPhase, null>,
): LoadingStageStatus {
    const stageIndex = CAD_PHASE_ORDER.indexOf(stage);
    const currentIndex = CAD_PHASE_ORDER.indexOf(current);
    if (stageIndex < currentIndex) return 'done';
    return stageIndex === currentIndex ? 'active' : 'pending';
}

export function formatMegabytes(bytes: number): string {
    return `${(bytes / 1_000_000).toLocaleString('es-PE', { maximumFractionDigits: 1 })} MB`;
}

/**
 * Etapas del indicador de carga del emplazamiento 2D, derivadas de los estados
 * que ya exponen `useSiteCadPlan` (`phase`) y `useNetworkSnapshotForSite`
 * (`loading`) — no simula avance. El visor CAD solo se inicializa una vez por
 * sesión: si se reabre el plano, la fase `initializing` se salta y queda como
 * hecha al pasar a `opening`.
 */
export function buildSiteLoadingStages({
    elementCount,
    networkLoading,
    cadPhase,
    cadFileBytes,
}: {
    elementCount: number;
    networkLoading: boolean;
    cadPhase: Exclude<SiteCadPlanPhase, null>;
    cadFileBytes: number;
}): LoadingStage[] {
    return [
        {
            id: 'site',
            label: 'Objetos del emplazamiento',
            status: 'done',
            detail: `${elementCount} objeto${elementCount === 1 ? '' : 's'}`,
        },
        {
            id: 'network',
            label: 'Red eléctrica y alimentadores',
            status: networkLoading ? 'active' : 'done',
        },
        {
            id: 'cad-file',
            label: 'Buscando el archivo del plano',
            status: cadStageStatus('reading', cadPhase),
        },
        {
            id: 'cad-viewer',
            label: 'Preparando el visor CAD',
            status: cadStageStatus('initializing', cadPhase),
        },
        {
            id: 'cad-open',
            label: 'Abriendo y dibujando el plano',
            status: cadStageStatus('opening', cadPhase),
            detail: cadFileBytes > 0 ? formatMegabytes(cadFileBytes) : undefined,
        },
    ];
}
