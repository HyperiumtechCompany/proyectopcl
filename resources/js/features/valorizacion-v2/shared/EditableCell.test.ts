import { describe, expect, it } from 'vitest';
import { normalizar } from './EditableCell';

describe('EditableCell · normalizar por tipo', () => {
    it('money: acepta S/, comas y redondea a 2 decimales', () => {
        expect(normalizar('money', 'S/ 1,234.5')).toBe('1234.50');
        expect(normalizar('money', '638827.475')).toBe('638827.48');
        expect(normalizar('money', 'abc')).toBe(false);
    });

    it('date: solo fechas ISO válidas (las da el selector del navegador)', () => {
        expect(normalizar('date', '2026-07-15')).toBe('2026-07-15');
        expect(normalizar('date', '2026-02-30')).toBe(false);
    });

    it('integer, number, vacío y parse propio', () => {
        expect(normalizar('integer', '060')).toBe('60');
        expect(normalizar('integer', '6.5')).toBe(false);
        expect(normalizar('number', '1,932.21')).toBe('1932.21');
        expect(normalizar('text', '   ')).toBeNull();
        expect(normalizar('money', '25%', () => '1600')).toBe('1600');
    });
});
