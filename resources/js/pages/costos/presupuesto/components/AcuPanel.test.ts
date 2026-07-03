import { describe, expect, it } from 'vitest';
import type { InsumoProducto } from '@/types/presupuestos';
import type { ACURowSummary } from '@/types/presupuestos';
import { calculateAcuLocally, upsertLocalAcuRow } from '../hooks/usePresupuestoAcu';
import { createAcuComponentFromResource } from './AcuPanel';

const electricista = {
    id: 47,
    codigo: 'MO-047',
    descripcion: 'ELECTRICISTA',
    precio: 23.46,
    tipo: 'mano_de_obra',
    unidad: { abreviatura_unidad: 'hh' },
} as InsumoProducto;

describe('ACU resource selection', () => {
    it('keeps the catalog code and calculates a newly added labor resource', () => {
        const component = createAcuComponentFromResource(
            electricista,
            'mano_de_obra',
            0.64,
            2,
        );
        const calculated = calculateAcuLocally({
            mano_de_obra: [component],
            materiales: [],
            equipos: [],
            subcontratos: [],
            subpartidas: [],
        });

        expect(component.cod_insumo).toBe('MO-047');
        // 0.64 * 23.46 = 15.0144 — mantiene 6 decimales internamente (no se
        // aplana a 2dp) para que Costo Directo e Insumos Consolidados
        // reconcilien exactamente; la UI sigue mostrando 15.01.
        expect(calculated.mano_de_obra[0].parcial).toBe(15.0144);
        expect(calculated.costo_mano_obra).toBe(15.0144);
        expect(calculated.costo_unitario_total).toBe(15.0144);
    });

    it('keeps local ACU changes when the same partida is selected again', () => {
        const original = {
            id: 1,
            partida: '01.01',
            costo_unitario_total: 0,
        } as ACURowSummary;
        const updated = {
            ...original,
            costo_unitario_total: 15.01,
            mano_de_obra: [{ cod_insumo: 'MO-047', descripcion: 'ELECTRICISTA', parcial: 15.01 }],
        } as ACURowSummary;

        const rows = upsertLocalAcuRow([original], updated);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toBe(updated);
        expect(rows[0].mano_de_obra[0].cod_insumo).toBe('MO-047');
    });
});
