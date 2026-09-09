import { describe, expect, it } from 'vitest';
import { verificarSnapshotGastosGenerales } from './verificacion';

describe('verificación de gastos generales', () => {
    it('valida la cascada monetaria del consolidado', () => {
        const result = verificarSnapshotGastosGenerales({
            total_costo_directo: '1000.0000',
            total_gg_fijos: '100.0000',
            total_gg_variables: '200.0000',
            comp_ii_gastos_generales: '300.0000',
            comp_iii_utilidad: '50.0000',
            comp_iv_subtotal_sin_igv: '1350.0000',
            comp_v_igv: '243.0000',
            comp_vi_valor_con_igv: '1593.0000',
            control_concurrente_porcentaje: '0.6000',
            total_control_concurrente_financiado: '11.9300',
            total_inversion_obra: '2000.0000',
        });

        expect(result.every((item) => item.correcto)).toBe(true);
    });

    it('detecta una diferencia superior a un céntimo', () => {
        const [result] = verificarSnapshotGastosGenerales({
            total_gg_fijos: '100.00',
            total_gg_variables: '200.00',
            comp_ii_gastos_generales: '299.98',
        });

        expect(result.correcto).toBe(false);
        expect(result.diferencia).toBe(0.02);
    });
});
