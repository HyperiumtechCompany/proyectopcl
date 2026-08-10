import { describe, expect, it } from 'vitest';
import type { RoomNormativeRef } from './types';
import { formatNormativeSummary } from './normativeSummary';

/**
 * Regresión: seleccionar un área en `NormativePicker` guardaba
 * `ugrl`/`uo`/`ra` en `room.normative` (`RoomsTab.tsx`, `applyNormative`)
 * pero ningún lugar de la UI los mostraba — solo `emLux` tenía efecto
 * visible (vía "Lux req."). Verificado contra el Anexo "Requisitos Mínimos
 * de Iluminación" de la EM.010 (RM N° 083-2019-VIVIENDA): los valores que
 * llegan desde la BD son correctos, el problema era puramente de display.
 */
function normativeRef(overrides: Partial<RoomNormativeRef> = {}): RoomNormativeRef {
    return {
        standard: 'rne_peru',
        categoryKey: '1',
        category: 'VIVIENDA',
        areaName: 'Dormitorio',
        emLux: 50,
        ugrl: null,
        uo: null,
        ra: null,
        requirements: null,
        ...overrides,
    };
}

describe('formatNormativeSummary', () => {
    it('incluye UGRL/Uo/Ra cuando la norma los especifica (ej. Áreas de circulación y pasillos)', () => {
        const normative = normativeRef({
            areaName: 'Áreas de circulación y pasillos',
            emLux: 100,
            ugrl: 28,
            uo: 0.4,
            ra: 40,
        });

        expect(formatNormativeSummary(normative)).toBe('Em 100 lx · UGR≤28 · Uo≥0.4 · Ra≥40');
    });

    it('omite UGRL/Uo/Ra cuando la norma no los especifica para esa área (ej. Dormitorio, zona privada)', () => {
        const normative = normativeRef({ areaName: 'Dormitorio', emLux: 50 });

        expect(formatNormativeSummary(normative)).toBe('Em 50 lx');
    });

    it('muestra "—" si emLux es null', () => {
        expect(formatNormativeSummary(normativeRef({ emLux: null }))).toBe('Em — lx');
    });
});
