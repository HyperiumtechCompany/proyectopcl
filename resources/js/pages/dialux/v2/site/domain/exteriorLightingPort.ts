import { circuitCurrent, selectBreaker } from '@/pages/dialux/electrical/engine/formulas';
import type { ModuleElectricalPort } from '../../electrical-network/domain/types';
import { DEFAULT_LUMINAIRE } from './exteriorLighting';
import { gateLightsPowerW } from './gateLayout';
import { canopyLightCount, canopyLights } from './siteLightPlacement';
import type { SiteElement } from './types';

/** Identificadores fijos del tablero virtual "Alumbrado exterior" del emplazamiento. */
export const EXTERIOR_LIGHTING_SCENE_ID = 'site';
export const EXTERIOR_LIGHTING_PANEL_ID = 'site-exterior-lighting';

/** Potencia (W) de un poste: la manual, o la de su ficha (guardada al elegirla), o la de referencia. */
export function poleInstalledPowerW(element: SiteElement): {
    watts: number;
    estimated: boolean;
} {
    if (element.config?.kind !== 'pole') return { watts: 0, estimated: false };
    const cfg = element.config;
    const perFixture = cfg.wattage ?? cfg.resolvedWatts;
    return {
        watts:
            (perFixture ?? DEFAULT_LUMINAIRE.watts) *
            Math.max(1, cfg.fixtures ?? 1),
        estimated: perFixture === undefined,
    };
}

export interface ExteriorLightingSummary {
    poles: number;
    installedPowerW: number;
    /** Postes cuya potencia es la de referencia (sin luminaria elegida ni vatios manuales). */
    estimatedPoles: number;
}

export function summarizeExteriorLighting(
    elements: SiteElement[],
    /** Postes/portones ya alimentados por una salida de tablero de la planta. */
    excludeIds: ReadonlySet<string> = new Set(),
): ExteriorLightingSummary {
    let poles = 0;
    let installedPowerW = 0;
    let estimatedPoles = 0;
    for (const element of elements) {
        if (element.visible === false || excludeIds.has(element.id)) continue;
        if (element.type === 'canopy') {
            // Luminarias bajo la cubierta del techado.
            const lights = canopyLights(element);
            if (lights) {
                poles += 1;
                installedPowerW += canopyLightCount(lights) * lights.wattage;
            }
            continue;
        }
        if (element.type === 'gate') {
            // Luminarias del ingreso (bajo la cubierta / sobre los muros).
            const gateWatts = gateLightsPowerW(element);
            if (gateWatts > 0) {
                poles += 1;
                installedPowerW += gateWatts;
            }
            continue;
        }
        if (element.type !== 'pole') continue;
        const { watts, estimated } = poleInstalledPowerW(element);
        poles += 1;
        installedPowerW += watts;
        if (estimated) estimatedPoles += 1;
    }
    return { poles, installedPowerW, estimatedPoles };
}

/**
 * Tablero virtual con todo el alumbrado exterior del emplazamiento (postes),
 * para poder colgarlo del TG en la red eléctrica y que la caída de tensión
 * incluya el tramo aéreo/subterráneo que lo alimenta. Demanda = potencia
 * instalada (el alumbrado exterior funciona todo a la vez de noche).
 * Devuelve `null` si no hay postes.
 */
export function buildExteriorLightingPort(
    elements: SiteElement[],
    generalModuleId: number,
    system: { nominalVoltageV: number; phases: 1 | 3; powerFactor: number },
    excludeIds: ReadonlySet<string> = new Set(),
): ModuleElectricalPort | null {
    const summary = summarizeExteriorLighting(elements, excludeIds);
    if (summary.poles === 0) return null;
    const currentA = circuitCurrent(
        summary.installedPowerW,
        system.nominalVoltageV,
        system.phases,
        system.powerFactor,
    );
    return {
        key: `${generalModuleId}:${EXTERIOR_LIGHTING_SCENE_ID}:${EXTERIOR_LIGHTING_PANEL_ID}`,
        moduleId: generalModuleId,
        moduleName: 'Emplazamiento',
        sceneId: EXTERIOR_LIGHTING_SCENE_ID,
        sceneName: 'Exteriores',
        panelId: EXTERIOR_LIGHTING_PANEL_ID,
        panelLabel: `Alumbrado exterior (${summary.poles} punto${summary.poles === 1 ? '' : 's'} de luz)`,
        parentPanelId: null,
        panelRole: 'distribution',
        nominalVoltageV: system.nominalVoltageV,
        phases: system.phases,
        installedPowerW: summary.installedPowerW,
        demandPowerW: summary.installedPowerW,
        ownInstalledPowerW: summary.installedPowerW,
        ownDemandPowerW: summary.installedPowerW,
        currentA,
        mainBreakerA: selectBreaker(currentA * 1.25).amps,
        circuitsCount: 1,
        revision: `site-${summary.poles}-${Math.round(summary.installedPowerW)}`,
        isFallback: summary.estimatedPoles > 0,
    };
}
