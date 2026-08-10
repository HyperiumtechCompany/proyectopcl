import { describe, expect, it } from 'vitest';
import type { Conductor, Fixture, LightSwitch } from '@/pages/dialux/hooks/types';
import type { DxfDisciplineEntities } from '../domain/types';
import { buildLightingLegendRows } from './buildLightingLegendRows';

/**
 * Fase 6 del plan maestro DXF: leyenda de alumbrado. Criterio de cierre — la
 * leyenda contiene todos y solo los elementos visibles del plano de
 * alumbrado, con cantidades correctas.
 */

function entities(overrides: Partial<DxfDisciplineEntities> = {}): DxfDisciplineEntities {
    return {
        discipline: 'lighting',
        fixtures: [],
        lightSwitches: [],
        electricalDevices: [],
        conductors: [],
        junctionBoxes: [],
        ...overrides,
    };
}

const BASE_FIXTURE: Fixture = {
    id: 'f1', name: 'Panel LED 60x60', x: 0, y: 0, z: 2.8,
    lumens: 4000, efficiency: 0.8, fixtureType: 'panel', fixtureShape: 'rectangular',
    lightColor: '#fff5e1', brand: 'PCL Iluminación', articleNumber: 'PANEL-40W',
    productId: 10, power: 40, catalogSymbol: 'rect_white',
};

describe('buildLightingLegendRows — luminarias', () => {
    it('una luminaria repetida (mismo productId) se agrupa en una sola fila con la cantidad correcta', () => {
        const rows = buildLightingLegendRows(entities({
            fixtures: [
                { ...BASE_FIXTURE, id: 'f1' },
                { ...BASE_FIXTURE, id: 'f2', x: 3, y: 3 },
            ],
        }));

        const fixtureRows = rows.filter((row) => row.kind === 'fixture');
        expect(fixtureRows).toHaveLength(1);
        expect(fixtureRows[0]!.quantity).toBe(2);
    });

    it('dos productos con el mismo catalogSymbol siguen siendo filas distintas (no se agrupa por símbolo)', () => {
        const rows = buildLightingLegendRows(entities({
            fixtures: [
                { ...BASE_FIXTURE, id: 'f1', productId: 10, articleNumber: 'PANEL-40W' },
                { ...BASE_FIXTURE, id: 'f2', productId: 11, articleNumber: 'PANEL-60W', catalogSymbol: 'rect_white' },
            ],
        }));

        const fixtureRows = rows.filter((row) => row.kind === 'fixture');
        expect(fixtureRows).toHaveLength(2);
        expect(fixtureRows.every((row) => row.quantity === 1)).toBe(true);
        expect(new Set(fixtureRows.map((row) => row.symbolRef?.catalogSymbol))).toEqual(new Set(['rect_white']));
    });

    it('producto sin fabricante ni número de artículo no falla: cae a nombre+potencia+flujo+forma', () => {
        const fixtureSinFabricante: Fixture = {
            id: 'f-generic', name: 'Luminaria generica', x: 0, y: 0, z: 2.8,
            lumens: 1500, efficiency: 0.7, fixtureType: 'surface', lightColor: '#ffffff',
        };
        const rows = buildLightingLegendRows(entities({ fixtures: [fixtureSinFabricante] }));

        const fixtureRows = rows.filter((row) => row.kind === 'fixture');
        expect(fixtureRows).toHaveLength(1);
        expect(fixtureRows[0]!.code).toBe('Luminaria generica');
        expect(fixtureRows[0]!.description).toBe('Luminaria generica');
        expect(fixtureRows[0]!.quantity).toBe(1);
    });

    /**
     * `technicalFields` se lee POR ÍNDICE en la leyenda (columnas
     * POTENCIA/FLUJO/MONTAJE de `buildDxfMultiSheetDocument.ts`) — un
     * `.filter()` que quitara la potencia ausente corría el flujo a la
     * posición 0 y lo mostraba en la columna de potencia.
     */
    it('una luminaria sin potencia declarada mantiene el flujo y el montaje en su posición fija', () => {
        const sinPotencia: Fixture = {
            id: 'f-sin-potencia', name: 'Luminaria sin potencia', x: 0, y: 0, z: 2.8,
            lumens: 1200, efficiency: 0.7, fixtureType: 'recessed', lightColor: '#ffffff',
        };
        const rows = buildLightingLegendRows(entities({ fixtures: [sinPotencia] }));

        const fixtureRow = rows.find((row) => row.kind === 'fixture')!;
        expect(fixtureRow.technicalFields).toHaveLength(3);
        expect(fixtureRow.technicalFields[0]).toBe('');
        expect(fixtureRow.technicalFields[1]).toBe('1200lm');
        expect(fixtureRow.technicalFields[2]).toContain('Empotrado');
    });

    it('luminarias de emergencia quedan en filas propias, separadas de las luminarias normales', () => {
        const rows = buildLightingLegendRows(entities({
            fixtures: [
                { ...BASE_FIXTURE, id: 'f1', emergencyType: 'none' },
                { ...BASE_FIXTURE, id: 'f2', productId: 99, emergencyType: 'emergency', catalogSymbol: 'emergency' },
                { ...BASE_FIXTURE, id: 'f3', productId: 98, emergencyType: 'permanent', catalogSymbol: 'emergency_perm' },
            ],
        }));

        expect(rows.filter((r) => r.kind === 'fixture')).toHaveLength(1);
        const emergencyRows = rows.filter((r) => r.kind === 'emergency');
        expect(emergencyRows).toHaveLength(2);
        expect(emergencyRows.map((r) => r.code).sort()).toEqual(['E', 'EP']);
    });
});

describe('buildLightingLegendRows — interruptores', () => {
    it('interruptor triple: código "3S" y descripción propia', () => {
        const tripleSwitch: LightSwitch = {
            id: 's1', x: 0, y: 0, mountingHeight: 1.4, type: 'triple', connectedFixtureIds: [],
        };
        const rows = buildLightingLegendRows(entities({ lightSwitches: [tripleSwitch] }));

        const switchRows = rows.filter((row) => row.kind === 'switch');
        expect(switchRows).toHaveLength(1);
        expect(switchRows[0]!.code).toBe('3S');
        expect(switchRows[0]!.description).toBe('Interruptor triple');
        expect(switchRows[0]!.quantity).toBe(1);
    });
});

describe('buildLightingLegendRows — cableado', () => {
    it('cableado con varias secciones produce una fila distinta por sección', () => {
        const conductors: Conductor[] = [
            { id: 'c1', sourceId: 'a', targetId: 'b', wireCount: 2, routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [] },
            { id: 'c2', sourceId: 'a', targetId: 'c', wireCount: 3, routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 4, waypoints: [] },
            { id: 'c3', sourceId: 'a', targetId: 'd', wireCount: 2, routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [] },
        ];
        const rows = buildLightingLegendRows(entities({ conductors }));

        const cableRows = rows.filter((row) => row.kind === 'cable');
        expect(cableRows).toHaveLength(2);
        const bySection = new Map(cableRows.map((row) => [row.description, row.quantity]));
        expect([...bySection.values()].sort()).toEqual([1, 2]);
        expect(cableRows.some((row) => row.description.includes('AWG 14'))).toBe(true);
        expect(cableRows.some((row) => row.description.includes('AWG 12'))).toBe(true);
    });

    /**
     * AC1009/R12 (`ascii()` en `emitters/primitives.ts`) convierte cualquier
     * carácter no-ASCII a "?" — el separador "·" y el superíndice de "mm²"
     * se veían literalmente como "?" en AutoCAD real.
     */
    it('la descripción del cableado no usa caracteres no-ASCII (separador ni superíndice)', () => {
        const conductors: Conductor[] = [
            { id: 'c1', sourceId: 'a', targetId: 'b', wireCount: 2, routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'Cu LSOH', sectionMm2: 2.5, waypoints: [] },
        ];
        const rows = buildLightingLegendRows(entities({ conductors }));

        const description = rows.find((row) => row.kind === 'cable')!.description;
        expect(description).toBe('Cu LSOH, 2.5 mm2 (AWG 14)');
        expect(/^[\x20-\x7E]*$/.test(description)).toBe(true);
    });
});

describe('buildLightingLegendRows — leyenda vacía', () => {
    it('un nivel sin elementos de alumbrado produce un arreglo vacío, sin fallar', () => {
        expect(buildLightingLegendRows(entities())).toEqual([]);
    });
});
