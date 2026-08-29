import { describe, expect, it } from 'vitest';
import { ajustarResiduoMonetario } from './ajustarResiduoMonetario';

describe('ajustarResiduoMonetario', () => {
    it('compatibiliza un céntimo con el total oficial de Presupuesto', () => {
        const resultado = ajustarResiduoMonetario(
            { m1: 10_000_000, m2: 4_454_349.84 },
            ['m1', 'm2'],
            14_454_349.85,
        );

        expect(resultado.m2).toBe(4_454_349.85);
        expect(Object.values(resultado).reduce((a, b) => a + b, 0)).toBe(14_454_349.85);
    });

    it('no oculta un descuadre real superior a un céntimo', () => {
        expect(ajustarResiduoMonetario({ m1: 90 }, ['m1'], 100)).toEqual({ m1: 90 });
    });
});
