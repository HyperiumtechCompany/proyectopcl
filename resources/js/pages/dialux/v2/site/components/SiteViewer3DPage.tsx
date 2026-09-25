import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { ModuleLoadingOverlay } from '../../components/ModuleLoadingOverlay';
import { deriveSiteNetworkLive } from '../domain/siteNetworkLive';
import { useLuminairePhotometry } from '../hooks/useLuminaireCatalog';
import { useNetworkSnapshotForSite } from '../hooks/useNetworkSnapshotForSite';
import {
    siteLightProductIds,
    useSiteLightingStore,
} from '../hooks/useSiteLightingCalculation';
import { SiteViewer3D } from './SiteViewer3D';

interface Props {
    projectId: number;
    /** `false` cuando la pestaña 2D está al frente (el 3D sigue montado, oculto). */
    isActive?: boolean;
}

/**
 * Glue de datos para `SiteViewer3D` (que queda puramente presentacional,
 * enfocada en el ciclo de vida de Babylon.js): toma `siteData` del store
 * (ya cargado por `Module.tsx` al montar, igual que en la vista 2D) y
 * `moduleScenes`/`feederCalculations` del mismo endpoint de solo lectura
 * que ya usa el editor 2D para vincular alimentadores — sin fetch propio.
 */
export function SiteViewer3DPage({ projectId, isActive = true }: Props) {
    const siteData = useEditorStore((state) => state.project?.site);
    const snapshot = useNetworkSnapshotForSite(projectId);
    const { moduleScenes, loading } = snapshot;
    // Misma red "en vivo" que el 2D: la planta actual (cables recién
    // dibujados, cargas de las salidas) colorea los alimentadores en 3D.
    const calculations = snapshot.network
        ? deriveSiteNetworkLive(
              snapshot.network,
              siteData,
              snapshot.ports,
              snapshot.conductors,
          ).calculations
        : snapshot.calculations;
    // Fotometría real de las luminarias del catálogo usadas por los postes.
    const luminairePhotometry = useLuminairePhotometry(
        siteLightProductIds(siteData),
    );
    // Resultado de "Calcular alumbrado" del 2D (mismo store).
    const calculation = useSiteLightingStore((state) => state.calculation);
    const calculatedFor = useSiteLightingStore((state) => state.calculatedFor);

    if (!siteData) {
        return (
            <div className="relative h-full">
                <ModuleLoadingOverlay
                    title="Cargando vista 3D"
                    stages={[
                        {
                            id: 'site',
                            label: 'Objetos del emplazamiento',
                            status: 'active',
                        },
                        {
                            id: 'scene',
                            label: 'Construyendo la escena 3D',
                            status: 'pending',
                        },
                    ]}
                />
            </div>
        );
    }

    return (
        <SiteViewer3D
            siteData={siteData}
            moduleScenes={moduleScenes}
            feederCalculations={calculations}
            luminairePhotometry={luminairePhotometry}
            isActive={isActive}
            networkLoading={loading}
            calculatedLighting={calculation}
            calculatedLightingStale={
                calculation !== null && calculatedFor !== siteData
            }
        />
    );
}
