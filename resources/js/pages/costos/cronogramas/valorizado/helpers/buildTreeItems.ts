import type { ItemValorizado, Periodo } from '../types';

/** Códigos de todos los ancestros de una partida ("1.2.3" → ["1","1.2"]). */
export const parentCodes = (code: string): string[] => {
    const parts = code.split('.').filter(Boolean);
    return parts.slice(0, -1).map((_, idx) => parts.slice(0, idx + 1).join('.'));
};

const emptyDistribucion = (periodos: Periodo[]) =>
    Object.fromEntries(
        periodos.map((p) => [p.key, { monto: 0, porcentaje: 0 }]),
    ) as ItemValorizado['distribucion'];

/**
 * Construye el árbol jerárquico del valorizado: las filas hoja que vienen del
 * backend + las filas de grupo sintetizadas por código de partida, con su
 * nombre real (jerarquiaPresupuesto) y su rollup (parcial y distribución
 * mensual = suma de descendientes hoja).
 *
 * MISMA lógica que usa la tabla en pantalla, para que el export (Excel/PDF)
 * salga idéntico a lo que se visualiza — antes el export recibía solo las hojas
 * y perdía todos los títulos de grupo.
 */
export function buildTreeItems(
    items: ItemValorizado[],
    periodos: Periodo[],
    jerarquiaPresupuesto: Record<string, string>,
): ItemValorizado[] {
    const byCode = new Map<string, ItemValorizado>();

    items.forEach((item) => {
        const code = item.item || '';
        if (!code) return;
        byCode.set(code, { ...item });

        parentCodes(code).forEach((parentCode) => {
            if (!byCode.has(parentCode)) {
                byCode.set(parentCode, {
                    parent_id: null,
                    id: `group:${parentCode}`,
                    item: parentCode,
                    descripcion:
                        jerarquiaPresupuesto[parentCode] ?? `Partida ${parentCode}`,
                    und: '',
                    metrado: 0,
                    precio: 0,
                    parcial: 0,
                    is_leaf: false,
                    distribucion: emptyDistribucion(periodos),
                });
            }
        });
    });

    const codes = [...byCode.keys()].sort((a, b) =>
        a.localeCompare(b, 'es', { numeric: true }),
    );

    const hasChildren = new Set<string>();
    codes.forEach((code) => {
        parentCodes(code).forEach((parentCode) => hasChildren.add(parentCode));
    });

    const leafItems = items.filter(
        (item) => item.item && !hasChildren.has(item.item),
    );

    codes.forEach((code) => {
        const row = byCode.get(code);
        if (!row || !hasChildren.has(code)) return;

        const descendants = leafItems.filter((item) =>
            item.item.startsWith(`${code}.`),
        );
        const parcial = descendants.reduce(
            (acc, item) => acc + (item.parcial ?? 0),
            0,
        );
        const distribucion = emptyDistribucion(periodos);

        descendants.forEach((item) => {
            periodos.forEach((periodo) => {
                distribucion[periodo.key].monto +=
                    item.distribucion?.[periodo.key]?.monto ?? 0;
            });
        });

        periodos.forEach((periodo) => {
            const monto = Math.round(distribucion[periodo.key].monto * 100) / 100;
            distribucion[periodo.key] = {
                monto,
                porcentaje: parcial > 0 ? (monto / parcial) * 100 : 0,
            };
        });

        byCode.set(code, { ...row, parcial, distribucion, is_leaf: false });
    });

    return codes
        .map((code) => byCode.get(code))
        .filter((item): item is ItemValorizado => Boolean(item));
}
