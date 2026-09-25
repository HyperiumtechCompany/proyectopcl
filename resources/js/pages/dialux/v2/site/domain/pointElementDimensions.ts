import { tgDimensions } from './tgPanel';
import type { SiteElement } from './types';

export interface PointElementPlanDimensions {
    widthM: number;
    depthM: number;
}

/** Dimensiones reales en planta de los equipos que se colocan con un clic. */
export function pointElementPlanDimensions(
    element: Pick<SiteElement, 'type' | 'config'>,
): PointElementPlanDimensions {
    const config = element.config;

    switch (config?.kind) {
        case 'tg': {
            const dimensions = tgDimensions(config);
            return {
                widthM: dimensions.widthM,
                depthM: dimensions.depthM,
            };
        }
        case 'transformer':
        case 'sub_panel':
        case 'ats':
        case 'generator':
        case 'mt_cell_arrival':
        case 'mt_cell_protection':
        case 'mt_cell_transformation':
        case 'cable_vault':
        case 'pull_box':
            return {
                widthM: Math.max(0.05, config.widthM),
                depthM: Math.max(0.05, config.depthM),
            };
        case 'tree':
            return {
                widthM: Math.max(0.2, config.crownM),
                depthM: Math.max(0.2, config.crownM),
            };
        case 'gate':
            return {
                widthM: Math.max(0.5, config.widthM),
                depthM: 0.2,
            };
        case 'pole':
            return { widthM: 0.3, depthM: 0.3 };
        case 'outlet':
            return { widthM: 0.14, depthM: 0.14 };
        case 'earth_pit':
            return { widthM: 0.4, depthM: 0.4 };
        default:
            return { widthM: 0.5, depthM: 0.5 };
    }
}

/**
 * Mínimo en pantalla por tipo: la caja de pase mide 100×100 mm reales y con el
 * mínimo genérico quedaba casi invisible — y difícil de acertar al cablear.
 */
export function pointElementMinimumPx(type: SiteElement['type']): number {
    return type === 'pull_box' ? 18 : 7;
}

/**
 * Evita que un equipo físicamente pequeño desaparezca por completo al alejar
 * el plano. Es sólo un factor de representación; no cambia sus dimensiones,
 * coordenadas ni longitudes de cable.
 */
export function pointElementVisibilityFactor(
    widthPx: number,
    depthPx: number,
    selected: boolean,
    /** Tamaño mínimo en pantalla (px) sin seleccionar; seleccionado suma 5 px. */
    minimumUnselectedPx = 7,
): number {
    const currentMaxPx = Math.max(Math.abs(widthPx), Math.abs(depthPx));
    const minimumPx = selected
        ? minimumUnselectedPx + 5
        : minimumUnselectedPx;
    if (!Number.isFinite(currentMaxPx) || currentMaxPx <= 0) return 1;
    return Math.max(1, minimumPx / currentMaxPx);
}
