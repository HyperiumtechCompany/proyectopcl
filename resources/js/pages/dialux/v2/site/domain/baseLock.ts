import type { SiteData, SiteElement, SiteElementType } from './types';

/**
 * Elementos "base" del emplazamiento: el terreno, su cerco, las plataformas y la
 * topografía. Se dibujan primero y después se construye ENCIMA; un clic o un
 * arrastre accidental sobre ellos no debe moverlos.
 */
export const BASE_TYPES = new Set<SiteElementType>([
    'terrain',
    'fence',
    'terrace_platform',
    'contour',
    'spot_elevation',
    'street',
]);

export function isBaseType(type: SiteElementType): boolean {
    return BASE_TYPES.has(type);
}

/**
 * ¿Está activo el bloqueo de la base? Si el usuario lo fijó (`baseLocked`), manda
 * su decisión; si no, es AUTOMÁTICO: se activa en cuanto existe algún objeto que
 * no es base (edificio, rampa, poste…), es decir, al pasar de "armar la base" a
 * "construir encima".
 */
export function isBaseLockActive(
    site: Pick<SiteData, 'baseLocked' | 'elements'> | undefined,
): boolean {
    if (!site) return false;
    if (typeof site.baseLocked === 'boolean') return site.baseLocked;
    return site.elements.some((el) => !isBaseType(el.type));
}

/** ¿No se puede mover/editar (bloqueo propio del elemento o base bloqueada)? */
export function isElementFrozen(
    element: Pick<SiteElement, 'type' | 'locked'>,
    site: Pick<SiteData, 'baseLocked' | 'elements'> | undefined,
): boolean {
    return !!element.locked || (isBaseType(element.type) && isBaseLockActive(site));
}
