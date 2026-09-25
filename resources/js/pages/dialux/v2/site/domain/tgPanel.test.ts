import { describe, expect, it } from 'vitest';
import {
    normalizeTgOutputs,
    resizeTgOutputs,
    tgDimensions,
    tgFootprintVertices,
    tgOutputAnchorLocal,
    tgOutputPlanOffset,
    TG_MAX_OUTPUTS,
} from './tgPanel';

describe('tablero general 2D', () => {
    it('crea cinco salidas compatibles para tableros existentes', () => {
        expect(normalizeTgOutputs()).toHaveLength(5);
    });

    it('conserva las salidas editadas al cambiar la cantidad', () => {
        const current = normalizeTgOutputs();
        current[0] = { ...current[0], label: 'Bomba', color: '#123456' };

        const resized = resizeTgOutputs(current, 8);

        expect(resized).toHaveLength(8);
        expect(resized[0]).toMatchObject({ label: 'Bomba', color: '#123456' });
        expect(resized[7].label).toBe('8');
    });

    it('limita una cantidad inválida al rango soportado', () => {
        expect(resizeTgOutputs(undefined, 0)).toHaveLength(1);
        expect(resizeTgOutputs(undefined, 100)).toHaveLength(TG_MAX_OUTPUTS);
    });

    it('resuelve un punto de conexión distinto para cada salida', () => {
        const outputs = normalizeTgOutputs();
        const first = tgOutputAnchorLocal(outputs, outputs[0].id);
        const second = tgOutputAnchorLocal(outputs, outputs[1].id);

        expect(first.x).toBe(second.x);
        expect(first.y).not.toBe(second.y);
        expect(second.output).toEqual(outputs[1]);
    });

    it('usa dimensiones físicas realistas cuando un TG antiguo no tiene configuración', () => {
        expect(tgDimensions()).toEqual({
            widthM: 1.2,
            depthM: 0.4,
            heightM: 2,
        });
        const footprint = tgFootprintVertices({ x: 10, y: 20 }, undefined, 1);
        expect(footprint[1].x - footprint[0].x).toBeCloseTo(1.2);
        expect(footprint[2].y - footprint[1].y).toBeCloseTo(0.4);
    });

    it('tgOutputPlanOffset separa cada salida en metros reales, no en px de pantalla', () => {
        const outputs = normalizeTgOutputs();
        const first = tgOutputPlanOffset(outputs, outputs[0].id, 0, 1);
        const second = tgOutputPlanOffset(outputs, outputs[1].id, 0, 1);
        // Sin rotación: misma distancia "hacia adelante" (x), separadas en y.
        expect(first.x).toBeCloseTo(second.x, 5);
        expect(first.y).not.toBeCloseTo(second.y, 5);
    });

    it('tgOutputPlanOffset gira con el TG (mismo criterio que el símbolo 2D)', () => {
        const outputs = normalizeTgOutputs();
        const flat = tgOutputPlanOffset(outputs, outputs[0].id, 0, 1);
        const rotated = tgOutputPlanOffset(outputs, outputs[0].id, 90, 1);
        // A 90°, lo que antes era el eje x pasa a ser (aprox) el eje y.
        expect(rotated.x).toBeCloseTo(-flat.y, 5);
        expect(rotated.y).toBeCloseTo(flat.x, 5);
    });

    it('tgOutputPlanOffset escala a unidades de plano con `scaleM`', () => {
        const outputs = normalizeTgOutputs();
        const atOne = tgOutputPlanOffset(outputs, outputs[0].id, 0, 1);
        const atTwo = tgOutputPlanOffset(outputs, outputs[0].id, 0, 2);
        // El doble de metros por unidad de plano = la mitad de unidades de plano.
        expect(atTwo.x).toBeCloseTo(atOne.x / 2, 5);
    });
});
