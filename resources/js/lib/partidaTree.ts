/**
 * Utilidades compartidas para reconstruir el árbol de partidas (códigos WBS
 * punteados: "01.01.01.01") a partir de una lista plana — usadas por
 * Valorizado (buildTreeItems.ts) y Avance Real (buildTreeItemsEjecutado.ts).
 * Cada módulo sigue agregando sus propios campos (monto/porcentaje vs.
 * metrado/monto) porque esa parte SÍ difiere entre ellos; lo que es
 * idéntico — encontrar ancestros y ordenar códigos WBS — vive acá una sola
 * vez.
 */

/** Códigos de todos los ancestros de una partida ("1.2.3" → ["1","1.2"]). */
export const parentCodes = (code: string): string[] => {
    const parts = code.split('.').filter(Boolean);
    return parts.slice(0, -1).map((_, idx) => parts.slice(0, idx + 1).join('.'));
};

/** Nivel de indentación de un código WBS ("1.2.3" → 2). */
export const nivelPartida = (code: string): number => (code?.split('.').length ?? 1) - 1;

/** Orden numérico de códigos WBS ("1.2" antes que "1.10"). */
export const compararCodigosWbs = (a: string, b: string): number =>
    a.localeCompare(b, 'es', { numeric: true });
