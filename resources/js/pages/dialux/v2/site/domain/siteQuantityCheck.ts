import {
    calculateExactQuantity,
    calculateLumensRequired,
    determineCoverage,
} from '@/pages/dialux/hooks/lightingCalculations';
import type { SiteLightingAreaResult } from './siteLightingCalculation';

/**
 * Verificación de CANTIDAD de luminarias de una superficie exterior — la
 * misma de la tabla de Resultados de la V1 (`ResultsPanel`: Lm req. →
 * cantidad → cobertura Óptimo/Insuficiente/Excesivo), con sus funciones sin
 * modificar:
 *  - lúmenes requeridos: fórmula literal de la V1 ((A·E)/Fm)·Fu, Fu = 0,8;
 *  - como el flujo de cada luminaria exterior ya viene MANTENIDO (lm × Fm),
 *    se pasa Fm = 1: ((A·E)/1)·Fu / (lm·Fm) ≡ ((A·E)/Fm)·Fu / lm, idéntico;
 *  - cobertura = `determineCoverage(exacta, colocadas)`: < 90 % insuficiente,
 *    > 150 % excesivo (criterio de la V1).
 * Es un chequeo por MÉTODO DE LÚMENES (estimación); el resultado real es el
 * Ēm punto a punto del motor, que se muestra al lado.
 */
export interface SiteQuantityCheck {
    lumensRequired: number;
    lumensEach: number;
    exactQuantity: number;
    placed: number;
    coverage: 'optimal' | 'insufficient' | 'excessive';
}

export const SITE_UTILIZATION_FACTOR = 0.8;

export function siteQuantityCheck(
    area: Pick<SiteLightingAreaResult, 'areaM2' | 'ownLuminaires' | 'ownMaintainedFluxLm'>,
    targetLux: number | undefined,
): SiteQuantityCheck | null {
    if (!targetLux || targetLux <= 0 || area.areaM2 <= 0) return null;
    const lumensRequired = calculateLumensRequired(area.areaM2, targetLux, {
        maintenanceFactor: 1,
        utilizationFactor: SITE_UTILIZATION_FACTOR,
    });
    if (area.ownLuminaires === 0) {
        return { lumensRequired, lumensEach: 0, exactQuantity: Infinity, placed: 0, coverage: 'insufficient' };
    }
    const lumensEach = area.ownMaintainedFluxLm / area.ownLuminaires;
    const exactQuantity = calculateExactQuantity(lumensRequired, lumensEach);
    return {
        lumensRequired,
        lumensEach,
        exactQuantity,
        placed: area.ownLuminaires,
        coverage: determineCoverage(exactQuantity, area.ownLuminaires),
    };
}
