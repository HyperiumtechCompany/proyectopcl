import { describe, expect, it } from 'vitest';
import { calculateDaylightFactor } from './daylightFactorEngine';
import type { Room, Wall, Window } from './types';

function buildRoom(): Room {
    return {
        id: 'room-1',
        name: 'Sala con ventana',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
        ],
        height: 2.8,
        color: '#000000',
    };
}

function buildSouthWall(): Wall {
    return {
        id: 'wall-south',
        vertices: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
        ],
        thickness: 0.2,
        height: 2.8,
    };
}

function buildWindow(overrides: Partial<Window> = {}): Window {
    return {
        id: 'window-1',
        wallId: 'wall-south',
        offsetAlongWall: 1,
        width: 2,
        height: 1.2,
        sillHeight: 0.9,
        glazingTransmittance: 1,
        ...overrides,
    };
}

const REFLECTANCES = { ceiling: 0.7, wall: 0.5, floor: 0.2 };

describe('daylightFactorEngine', () => {
    it('sin ventanas, el DF es 0 en todo punto y advierte room-without-daylight-windows', () => {
        const result = calculateDaylightFactor(buildRoom(), [], [buildSouthWall()], REFLECTANCES);
        expect(result.avg_df).toBe(0);
        expect(result.warnings.map((w) => w.code)).toContain('room-without-daylight-windows');
    });

    it('una ventana sin vidrio asignado no aporta DF y advierte window-without-glazing-transmittance', () => {
        const result = calculateDaylightFactor(
            buildRoom(),
            [buildWindow({ glazingTransmittance: null })],
            [buildSouthWall()],
            REFLECTANCES,
        );
        expect(result.avg_df).toBe(0);
        expect(result.warnings.map((w) => w.code)).toContain('window-without-glazing-transmittance');
        expect(result.warnings.map((w) => w.code)).toContain('room-without-daylight-windows');
    });

    it('sin reflectancias asignadas, advierte room-without-material-reflectance (IRC = 0) pero SC sigue calculándose', () => {
        const withMaterial = calculateDaylightFactor(buildRoom(), [buildWindow()], [buildSouthWall()], REFLECTANCES);
        const withoutMaterial = calculateDaylightFactor(buildRoom(), [buildWindow()], [buildSouthWall()], null);

        expect(withoutMaterial.warnings.map((w) => w.code)).toContain('room-without-material-reflectance');
        expect(withoutMaterial.avg_df).toBeGreaterThan(0); // SC sigue aportando aunque IRC sea 0.
        expect(withoutMaterial.avg_df).toBeLessThan(withMaterial.avg_df); // El material añade IRC por encima del SC solo.
    });

    it('siempre incluye la nota metodológica de ERC no modelado', () => {
        const result = calculateDaylightFactor(buildRoom(), [buildWindow()], [buildSouthWall()], REFLECTANCES);
        expect(result.notes.some((note) => note.includes('ERC'))).toBe(true);
    });

    it('con una ventana real, produce un DF promedio positivo y finito', () => {
        const result = calculateDaylightFactor(buildRoom(), [buildWindow()], [buildSouthWall()], REFLECTANCES);
        expect(result.avg_df).toBeGreaterThan(0);
        expect(Number.isFinite(result.avg_df)).toBe(true);
        expect(result.min_df).toBeGreaterThanOrEqual(0);
        expect(result.max_df).toBeGreaterThanOrEqual(result.avg_df);
    });

    it('el DF decrece con la distancia a la ventana (fila más cercana > fila más lejana)', () => {
        const result = calculateDaylightFactor(buildRoom(), [buildWindow()], [buildSouthWall()], REFLECTANCES);
        const { grid_cols, grid_rows, grid_values } = result;
        const rowAvg = (row: number) => {
            const rowValues = grid_values.slice(row * grid_cols, (row + 1) * grid_cols).filter((v): v is number => v !== null);
            return rowValues.reduce((a, b) => a + b, 0) / rowValues.length;
        };
        // La ventana está en el muro y=0 (fila 0, la más cercana) — la fila
        // más lejana (última) debe tener un DF promedio menor.
        expect(rowAvg(0)).toBeGreaterThan(rowAvg(grid_rows - 1));
    });

    it('ignora una ventana en el muro de OTRO recinto de la misma escena (no contamina el cálculo)', () => {
        const farAwayWall: Wall = {
            id: 'wall-far',
            vertices: [
                { x: 100, y: 100 },
                { x: 104, y: 100 },
            ],
            thickness: 0.2,
            height: 2.8,
        };
        const farAwayWindow = buildWindow({ id: 'window-far', wallId: 'wall-far' });

        const withUnrelatedWindow = calculateDaylightFactor(
            buildRoom(),
            [farAwayWindow],
            [buildSouthWall(), farAwayWall],
            REFLECTANCES,
        );
        const withoutAnyWindow = calculateDaylightFactor(buildRoom(), [], [buildSouthWall()], REFLECTANCES);

        expect(withUnrelatedWindow.avg_df).toBe(withoutAnyWindow.avg_df);
        expect(withUnrelatedWindow.warnings.map((w) => w.code)).toContain('room-without-daylight-windows');
    });

    it('escala con la transmitancia del vidrio', () => {
        const full = calculateDaylightFactor(buildRoom(), [buildWindow({ glazingTransmittance: 1 })], [buildSouthWall()], REFLECTANCES);
        const half = calculateDaylightFactor(buildRoom(), [buildWindow({ glazingTransmittance: 0.5 })], [buildSouthWall()], REFLECTANCES);
        expect(half.avg_df).toBeLessThan(full.avg_df);
        expect(half.avg_df).toBeGreaterThan(0);
    });
});
