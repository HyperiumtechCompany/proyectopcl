import { parentCodes, compararCodigosWbs } from '@/lib/partidaTree';
import type { ItemEjecutado, Periodo } from '../types';

export { parentCodes };

const emptyEjecucion = (periodos: Periodo[]) =>
    Object.fromEntries(
        periodos.map((p) => [p.key, { metrado: 0, monto: 0 }]),
    ) as ItemEjecutado['ejecucion'];

/**
 * Mismo algoritmo que buildTreeItems.ts (Valorizado), adaptado a
 * ItemEjecutado: las filas hoja que vienen del backend + filas de grupo
 * sintetizadas por código de partida, con su nombre real
 * (jerarquiaPresupuesto) y su rollup de monto ejecutado (suma de
 * descendientes hoja). El metrado NO se acumula a nivel de grupo — sumar
 * metrados de partidas con unidades distintas (m2 + m3 + und) no tiene
 * sentido físico, igual que ya decide buildTreeItems.ts para el programado.
 */
export function buildTreeItemsEjecutado(
    items: ItemEjecutado[],
    periodos: Periodo[],
    jerarquiaPresupuesto: Record<string, string>,
): ItemEjecutado[] {
    const byCode = new Map<string, ItemEjecutado>();

    items.forEach((item) => {
        const code = item.item || '';
        if (!code) return;
        byCode.set(code, { ...item });

        parentCodes(code).forEach((parentCode) => {
            if (!byCode.has(parentCode)) {
                byCode.set(parentCode, {
                    id: `group:${parentCode}`,
                    item: parentCode,
                    descripcion:
                        jerarquiaPresupuesto[parentCode] ?? `Partida ${parentCode}`,
                    und: '',
                    metradoContratado: 0,
                    precio: 0,
                    ejecucion: emptyEjecucion(periodos),
                });
            }
        });
    });

    const codes = [...byCode.keys()].sort(compararCodigosWbs);

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
        const ejecucion = emptyEjecucion(periodos);

        descendants.forEach((item) => {
            periodos.forEach((periodo) => {
                ejecucion[periodo.key].metrado += item.ejecucion?.[periodo.key]?.metrado ?? 0;
                ejecucion[periodo.key].monto += item.ejecucion?.[periodo.key]?.monto ?? 0;
            });
        });

        periodos.forEach((periodo) => {
            ejecucion[periodo.key] = {
                metrado: Math.round(ejecucion[periodo.key].metrado * 10000) / 10000,
                monto: Math.round(ejecucion[periodo.key].monto * 100) / 100,
            };
        });

        byCode.set(code, { ...row, ejecucion });
    });

    return codes
        .map((code) => byCode.get(code))
        .filter((item): item is ItemEjecutado => Boolean(item));
}
