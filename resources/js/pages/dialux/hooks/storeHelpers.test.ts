import { describe, expect, it } from 'vitest';
import { detectScaleFromExtents } from './storeHelpers';

describe('detectScaleFromExtents — heurístico de respaldo (sin $INSUNITS en el DXF)', () => {
    it('una casa de 20x20 en el CAD se detecta como metros: 20x20 en el sistema', () => {
        const scale = detectScaleFromExtents({
            min_x: 0,
            min_y: 0,
            max_x: 20,
            max_y: 20,
        });

        expect(scale.unit).toBe('m');
        expect(scale.factor).toBe(1);
        // factor=1 y sin calibración adicional: 20 unidades CAD = 20 metros reales.
        expect(scale.calibrationFactor).toBe(1);
    });

    it('un plano en milímetros (casa de 20x20m dibujada como 20000x20000) se detecta como mm', () => {
        const scale = detectScaleFromExtents({
            min_x: 0,
            min_y: 0,
            max_x: 20000,
            max_y: 20000,
        });

        expect(scale.unit).toBe('mm');
        expect(scale.factor).toBe(0.001);
    });

    it('un cuarto de 5x5m dibujado en centímetros (500x500) se detecta como cm', () => {
        const scale = detectScaleFromExtents({
            min_x: 0,
            min_y: 0,
            max_x: 500,
            max_y: 500,
        });

        expect(scale.unit).toBe('cm');
        expect(scale.factor).toBe(0.01);
    });

    it('LÍMITE CONOCIDO: una casa de 20x20m dibujada en centímetros (2000x2000, sin $INSUNITS) se malinterpreta como milímetros', () => {
        // El heurístico solo mira la magnitud del extent, no puede distinguir
        // "20m en mm" de "200m en cm" — este caso requiere calibración manual
        // (CalibrationDialog) o que el DXF declare $INSUNITS correctamente.
        const scale = detectScaleFromExtents({
            min_x: 0,
            min_y: 0,
            max_x: 2000,
            max_y: 2000,
        });

        expect(scale.unit).toBe('mm');
    });
});
