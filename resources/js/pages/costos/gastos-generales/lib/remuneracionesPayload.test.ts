import { describe, expect, it } from 'vitest';
import { normalizarRemuneracionesParaGuardar } from './remuneracionesPayload';

describe('payload de remuneraciones', () => {
    it('corrige meses inválidos y elimina campos de lectura', () => {
        const [row] = normalizarRemuneracionesParaGuardar([{
            id: 1,
            presupuesto_id: 1,
            gg_variable_id: null,
            cargo: 'Nuevo Cargo',
            categoria: 'Profesional',
            participacion: '100.00',
            cantidad: '1.0000',
            meses: 0,
            sueldo_basico: '0.00',
            asignacion_familiar: 46,
            snp: 5.98,
            essalud: 0,
            cts: 4.15,
            vacaciones: 3.83,
            gratificacion: 3.83,
            total_mensual_unitario: 57.82,
            total_proyecto: 0,
            created_at: '2026-09-02 14:40:21',
            updated_at: '2026-09-02 14:40:21',
            deleted_at: null,
        } as never]);

        expect(row.meses).toBe(1);
        expect(row).not.toHaveProperty('created_at');
        expect(row).not.toHaveProperty('total_proyecto');
    });
});
