import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { useNetworkSnapshotForSite } from '../hooks/useNetworkSnapshotForSite';
import { SiteViewer3D } from './SiteViewer3D';

interface Props {
    projectId: number;
}

/**
 * Glue de datos para `SiteViewer3D` (que queda puramente presentacional,
 * enfocada en el ciclo de vida de Babylon.js): toma `siteData` del store
 * (ya cargado por `Module.tsx` al montar, igual que en la vista 2D) y
 * `moduleScenes`/`feederCalculations` del mismo endpoint de solo lectura
 * que ya usa el editor 2D para vincular alimentadores — sin fetch propio.
 */
export function SiteViewer3DPage({ projectId }: Props) {
    const siteData = useEditorStore((state) => state.project?.site);
    const { moduleScenes, calculations } = useNetworkSnapshotForSite(projectId);

    if (!siteData) {
        return (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Cargando emplazamiento…
            </div>
        );
    }

    return (
        <SiteViewer3D
            siteData={siteData}
            moduleScenes={moduleScenes}
            feederCalculations={calculations}
        />
    );
}
