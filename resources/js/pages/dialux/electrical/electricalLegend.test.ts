import { describe, expect, it } from 'vitest';
import { ELECTRICAL_LEGEND_ITEMS } from './electricalLegend';

describe('ELECTRICAL_LEGEND_ITEMS', () => {
    it('incluye los símbolos exigidos sin claves duplicadas', () => {
        const labels = ELECTRICAL_LEGEND_ITEMS.map((item) => item.label);
        expect(labels).toContain('Luminaria de emergencia');
        expect(labels).toContain('Tablero general');
        expect(labels).toContain('Tomacorriente inicial · 1.50 m');
        expect(labels).toContain('Cableado empotrado en piso');
        expect(new Set(ELECTRICAL_LEGEND_ITEMS.map((item) => `${item.group}:${item.code}`)).size)
            .toBe(ELECTRICAL_LEGEND_ITEMS.length);
    });
});

