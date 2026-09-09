import { describe, expect, it } from 'vitest';
import { calcularParcial, calcularRemuneracion, calcularSencico, calcularTopeControlConcurrente, factorParticipacion, sumarDecimales } from './calculos';

describe('motor de gastos generales', () => {
    it('respeta una participación de cero', () => {
        expect(factorParticipacion(0)).toBe(0);
        expect(calcularParcial(2, 6, 0, 1_000)).toBe(0);
    });

    it('limita la participación al rango válido', () => {
        expect(factorParticipacion(-10)).toBe(0);
        expect(factorParticipacion(150)).toBe(1);
    });

    it('aplica cantidad y participación a toda la remuneración', () => {
        const total = calcularRemuneracion({ sueldoBasico: 6_000, cantidad: 2, meses: 3, participacion: 50 });
        expect(total.sueldoBase).toBe(6_000);
        expect(total.asignacionFamiliar).toBe(46);
        expect(total.totalProyecto).toBeCloseTo(total.totalMensual * 3, 1);
    });

    it('calcula tasas presupuestales con redondeo monetario', () => {
        expect(calcularSencico(1_000_000)).toBe(2_000);
        expect(calcularTopeControlConcurrente(1_000_000)).toBe(6_000);
        expect(calcularSencico(-100)).toBe(0);
    });

    it('suma montos sin errores de coma flotante', () => {
        expect(sumarDecimales([0.1, 0.2])).toBe(0.3);
        expect(calcularParcial('3', '1', '100', '19.995')).toBe(59.99);
    });
});
