import { describe, expect, it } from 'vitest';
import type { Fixture } from '@/pages/dialux/hooks/types';
import { computeEngineUgrTable, computeEngineUgrTables } from './computeEngineUgrTable';

function manufacturerWeb(): NonNullable<Fixture['photometricWeb']> {
    return {
        c_angles: [0, 90, 180, 270],
        gamma_angles: [0, 15, 30, 45, 60, 75, 90],
        candela: [
            [1000, 950, 800, 600, 350, 120, 0],
            [1000, 950, 800, 600, 350, 120, 0],
            [1000, 950, 800, 600, 350, 120, 0],
            [1000, 950, 800, 600, 350, 120, 0],
        ],
        reference_lumens: 3000,
        provenance: 'manufacturer',
    };
}

describe('Fase 15 — computeEngineUgrTable (Parte B)', () => {
    it('no disponible sin photometricWeb', () => {
        const result = computeEngineUgrTable({ photometricWeb: undefined });
        expect(result.available).toBe(false);
        if (!result.available) {
            expect(result.reason).toContain('Sin matriz fotométrica');
        }
    });

    it('no disponible para curvas sintéticas (nunca fabrica una tabla desde una aproximación)', () => {
        const result = computeEngineUgrTable({
            photometricWeb: { ...manufacturerWeb(), provenance: 'synthetic' },
        });
        expect(result.available).toBe(false);
        if (!result.available) {
            expect(result.reason).toContain('synthetic');
        }
    });

    it('no disponible para curvas manuales', () => {
        const result = computeEngineUgrTable({
            photometricWeb: { ...manufacturerWeb(), provenance: 'manual-curve' },
        });
        expect(result.available).toBe(false);
    });

    it('no disponible sin matriz de candelas', () => {
        const result = computeEngineUgrTable({
            photometricWeb: { ...manufacturerWeb(), candela: [] },
        });
        expect(result.available).toBe(false);
        if (!result.available) {
            expect(result.reason).toContain('matriz fotométrica');
        }
    });

    it('produce 6 salas de referencia con ambas direcciones, etiquetado como cálculo propio', () => {
        const result = computeEngineUgrTable({ photometricWeb: manufacturerWeb() });

        expect(result.available).toBe(true);
        if (!result.available) return;

        expect(result.table.provenance).toBe('engine-calculated');
        expect(result.table.disclaimer.toLowerCase()).toContain('no es una reproducción certificada');
        expect(result.table.shr).toBe(0.25);
        expect(result.table.reflectances).toEqual({ ceiling: 70, wall: 50, floor: 20 });
        expect(result.table.entries).toHaveLength(6);
        for (const entry of result.table.entries) {
            expect(entry.roomLabel).toMatch(/×.*m/);
            expect(typeof entry.ugrCrosswise === 'number' || entry.ugrCrosswise === null).toBe(true);
            expect(typeof entry.ugrEndwise === 'number' || entry.ugrEndwise === null).toBe(true);
        }
    });

    it('nunca devuelve provenance "manufacturer" (ese origen se reserva para una tabla real del fabricante que hoy no existe)', () => {
        const result = computeEngineUgrTable({ photometricWeb: manufacturerWeb() });
        expect(result.available).toBe(true);
        if (result.available) {
            expect(result.table.provenance).not.toBe('manufacturer');
        }
    });
});

describe('Ronda 21b — computeEngineUgrTables (grilla de reflectancia, modal de previsualización)', () => {
    it('mismas validaciones de disponibilidad que la versión de una sola tabla', () => {
        expect(computeEngineUgrTables({ photometricWeb: undefined }).available).toBe(false);
        expect(computeEngineUgrTables({ photometricWeb: { ...manufacturerWeb(), provenance: 'synthetic' } }).available).toBe(false);
    });

    it('produce 5 tablas (una por combinación de reflectancia habitual), cada una con 6 salas y el mismo SHR', () => {
        const result = computeEngineUgrTables({ photometricWeb: manufacturerWeb() });
        expect(result.available).toBe(true);
        if (!result.available) return;

        expect(result.tables).toHaveLength(5);
        for (const table of result.tables) {
            expect(table.shr).toBe(0.25);
            expect(table.entries).toHaveLength(6);
            expect(table.reflectances.floor).toBe(20); // piso siempre 20% en todas las combinaciones
        }
    });

    it('cada tabla declara una combinación de reflectancia distinta (no las 5 repiten el mismo valor)', () => {
        const result = computeEngineUgrTables({ photometricWeb: manufacturerWeb() });
        expect(result.available).toBe(true);
        if (!result.available) return;

        const combos = result.tables.map((t) => `${t.reflectances.ceiling}/${t.reflectances.wall}/${t.reflectances.floor}`);
        expect(new Set(combos).size).toBe(5);
    });

    it('la tabla singular sigue devolviendo exactamente 70/50/20 (el PDF de producción no debe verse afectado por esta ronda)', () => {
        const single = computeEngineUgrTable({ photometricWeb: manufacturerWeb() });
        expect(single.available).toBe(true);
        if (single.available) {
            expect(single.table.reflectances).toEqual({ ceiling: 70, wall: 50, floor: 20 });
        }
    });
});
