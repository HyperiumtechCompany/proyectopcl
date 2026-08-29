import { describe, expect, it } from 'vitest';
import { calcularCostoDirectoParcial } from './calcularCostoDirecto';
import { calcularDesembolso } from './calcularDesembolso';
import { calcularResumenFinanciero } from './calcularResumenFinanciero';

describe('calcularCostoDirectoParcial', () => {
    it('suma únicamente los parciales de partidas hoja como F28 del Excel', () => {
        const items = [
            { parcial: 999_999, is_leaf: false },
            { parcial: 202_991.71, is_leaf: true },
            { parcial: 32_253.52, is_leaf: true },
            { parcial: 29_953.69, is_leaf: true },
        ];

        expect(calcularCostoDirectoParcial(items as never)).toBeCloseTo(265_198.92, 2);
    });

    it('usa F33 como presupuesto de obra y el desembolso cierra al 100%', () => {
        const resumen = calcularResumenFinanciero({
            costoDirecto: 265_198.92,
            pctGastosGenerales: 10,
            pctUtilidad: 10,
            pctIGV: 18,
            montoMobiliario: 0,
            pctIGVMobiliario: 18,
            hasComponentII: false,
            componentesExtra: [],
            conceptosAdicionales: [],
        });
        const desembolso = calcularDesembolso(resumen.presupI, [
            { key: 'm1', label: 'Mes 1', dias: 30, valorizacion: resumen.presupI },
        ]);

        expect(resumen.presupI).toBeCloseTo(375_521.67, 2);
        expect(desembolso.totalValorizacion).toBeCloseTo(resumen.presupI, 2);
        expect(desembolso.totalDesembolsado).toBeCloseTo(resumen.presupI, 2);
        expect(desembolso.filas[0].pctDesembolsoAcumulado).toBeCloseTo(100, 8);
    });
});
