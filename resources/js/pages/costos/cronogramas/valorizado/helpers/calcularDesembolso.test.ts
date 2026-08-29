import { describe, expect, it } from 'vitest';
import { calcularDesembolso } from './calcularDesembolso';

describe('calcularDesembolso', () => {
    it('replica el cierre de la hoja Excel al 100%', () => {
        const resultado = calcularDesembolso(1_000, [
            { key: 'm1', label: 'Mes 1', dias: 31, valorizacion: 400 },
            { key: 'm2', label: 'Mes 2', dias: 28, valorizacion: 600 },
        ]);

        expect(resultado.adelantoTotal).toBe(300);
        expect(resultado.filas.map((fila) => fila.desembolsoMensual)).toEqual([280, 420]);
        expect(resultado.totalDesembolsado).toBe(1_000);
        expect(resultado.saldoAdelantoEfectivo).toBe(0);
        expect(resultado.saldoAdelantoMateriales).toBe(0);
        expect(resultado.filas.at(-1)?.pctDesembolsoAcumulado).toBe(100);
        expect(resultado.filas.map((fila) => fila.calendario)).toEqual([30, 60]);
    });
});
