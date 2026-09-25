import { create } from 'zustand';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    calculateSiteLighting,
    type SiteLightingCalculation,
} from '../domain/siteLightingCalculation';
import type { Point2D, SiteData } from '../domain/types';
import {
    loadLuminairePhotometry,
    type LuminairePhotometry,
} from '../lib/luminaireCatalog';
import { useLuminairePhotometry } from './useLuminaireCatalog';

/**
 * Resultado del botón "Calcular alumbrado", COMPARTIDO entre el Emplazamiento
 * 2D y la Vista 3D Exterior (ambas montadas a la vez en `Module.tsx`): el
 * mapa de lux y la verificación normativa del 3D usan exactamente el mismo
 * cálculo del motor V1 que la tabla y los falsos colores del 2D.
 */
interface SiteLightingStore {
    calculation: SiteLightingCalculation | null;
    calculatedFor: SiteData | null;
    running: boolean;
    showIsolux: boolean;
    focusedAreaId: string | null;
    /** Luminarias "fantasma" de la proyección en curso (coordenadas de plano). */
    projectionPreview: { areaId: string; positions: Point2D[] } | null;
    set: (patch: Partial<Omit<SiteLightingStore, 'set'>>) => void;
}

export const useSiteLightingStore = create<SiteLightingStore>((set) => ({
    calculation: null,
    calculatedFor: null,
    running: false,
    showIsolux: true,
    focusedAreaId: null,
    projectionPreview: null,
    set: (patch) => set(patch),
}));

/** Fotometría de los productos indicados, esperando a que carguen (caché de módulo). */
export async function loadSitePhotometry(
    ids: number[],
): Promise<Map<number, LuminairePhotometry>> {
    const unique = [...new Set(ids)];
    const loaded = await Promise.all(
        unique.map((id) => loadLuminairePhotometry(id).catch(() => null)),
    );
    const map = new Map<number, LuminairePhotometry>();
    loaded.forEach((photometry, index) => {
        if (photometry) map.set(unique[index], photometry);
    });
    return map;
}

/** Productos del catálogo usados por postes, portones y techados. */
export function siteLightProductIds(siteData: SiteData | undefined): number[] {
    return (siteData?.elements ?? []).flatMap((element) => {
        const config = element.config;
        if (config?.kind === 'pole' && config.productId !== undefined) {
            return [config.productId];
        }
        if (config?.kind === 'gate' && config.lights?.productId !== undefined) {
            return [config.lights.productId];
        }
        if (config?.kind === 'canopy' && config.lights?.productId !== undefined) {
            return [config.lights.productId];
        }
        return [];
    });
}

/**
 * Botón "Calcular alumbrado" del emplazamiento: corre el motor luminotécnico
 * de la V1 sobre cada superficie de cálculo (`siteLightingCalculation.ts`)
 * SOLO a pedido — como el botón "Calcular" de los recintos en la V1 — para no
 * recalcular miles de puntos en cada edición. El resultado queda marcado como
 * desactualizado si la planta cambió después de calcular.
 */
export function useSiteLightingCalculation(siteData: SiteData | undefined) {
    // Precarga la fotometría (caché de módulo) para que el cálculo no espere.
    useLuminairePhotometry(
        siteLightProductIds(siteData),
    );
    const state = useSiteLightingStore();

    const run = () => {
        if (!siteData || useSiteLightingStore.getState().running) return;
        state.set({ running: true });
        // La planta MÁS RECIENTE del store (no la de este render) y la
        // fotometría de TODOS sus productos ya cargada: un recálculo pedido
        // justo después de colocar luminarias las incluye con su IES/LDT real,
        // nunca con el modelo genérico por una carrera de carga.
        const latest = useEditorStore.getState().project?.site ?? siteData;
        void loadSitePhotometry(siteLightProductIds(latest))
            .then((loaded) => {
                state.set({
                    calculation: calculateSiteLighting(latest, loaded),
                    calculatedFor: latest,
                    showIsolux: true,
                });
            })
            .finally(() => state.set({ running: false }));
    };

    return {
        calculation: state.calculation,
        running: state.running,
        stale:
            state.calculation !== null && state.calculatedFor !== siteData,
        run,
        clear: () =>
            state.set({
                calculation: null,
                calculatedFor: null,
                focusedAreaId: null,
            }),
        showIsolux: state.showIsolux,
        setShowIsolux: (showIsolux: boolean) => state.set({ showIsolux }),
        focusedAreaId: state.focusedAreaId,
        setFocusedAreaId: (focusedAreaId: string | null) =>
            state.set({ focusedAreaId }),
    };
}

export type SiteLightingCalculationState = ReturnType<
    typeof useSiteLightingCalculation
>;
