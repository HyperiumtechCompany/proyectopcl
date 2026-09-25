import { describe, expect, it } from 'vitest';
import { buildSiteDxf, siteDxfLayerOf, summarizeSiteForDxf } from './siteDxfExport';
import type { SiteData, SiteElement } from './types';

const square = (id: string, type: SiteElement['type'], x: number, y: number, size: number, extra: Partial<SiteElement> = {}): SiteElement => ({
    id,
    type,
    label: id,
    vertices: [
        { x, y },
        { x: x + size, y },
        { x: x + size, y: y + size },
        { x, y: y + size },
    ],
    style: { fillColor: '#000', strokeColor: '#000' },
    ...extra,
});

const pole = (id: string, x: number, y: number): SiteElement =>
    square(id, 'pole', x - 0.3, y - 0.3, 0.6, {
        config: { kind: 'pole', heightM: 8, armLengthM: 2, armDirectionDeg: 90, fixtures: 1, wattage: 120 },
    });

function site(extra: Partial<SiteData> = {}): SiteData {
    return {
        schemaVersion: 1,
        terrainScaleM: 0.5,
        gridSizeM: 1,
        canvasWidth: 400,
        canvasHeight: 400,
        elements: [
            square('Terreno', 'terrain', 0, 0, 200),
            square('Modulo A', 'building_block', 20, 20, 40),
            square('Patio', 'court', 100, 100, 30),
            pole('P1', 80, 80),
            pole('P2', 120, 80),
            square('TG', 'tg_location', 10, 10, 2),
            square('Oculto', 'custom_zone', 150, 150, 10, { visible: false }),
        ],
        feederPaths: [],
        circuits: [
            { id: 'c1', sourceId: 'TG', targetId: 'P1', waypoints: [{ x: 11, y: 11 }, { x: 80, y: 80 }], calculatedLengthM: 0, wireCount: 3, wireLabel: 'F+N+T', sectionMm2: 4, conductorType: 'THW-90', label: 'C1' },
            { id: 'c2', sourceId: 'P1', targetId: 'P2', waypoints: [{ x: 80, y: 80 }, { x: 120, y: 80 }], calculatedLengthM: 0, wireCount: 3, wireLabel: 'F+N+T', sectionMm2: 4, conductorType: 'THW-90' },
        ],
        layers: [],
        ...extra,
    };
}

const entities = (dxf: string, type: string, layer: string) => {
    const lines = dxf.split('\n');
    let count = 0;
    for (let i = 0; i < lines.length - 3; i++) {
        if (lines[i] === '0' && lines[i + 1] === type && lines[i + 3] === layer) count += 1;
    }
    return count;
};

describe('DXF de la planta general (D1)', () => {
    it('DXF R12 bien formado, en metros, con una capa por especialidad', () => {
        const dxf = buildSiteDxf(site(), { projectName: 'Colegio' });
        const lines = dxf.split('\n');
        expect(lines.filter((l) => l === 'SECTION').length).toBe(lines.filter((l) => l === 'ENDSEC').length);
        expect(lines.at(-2)).toBe('EOF');
        expect(dxf).toContain('$INSUNITS\n70\n6');
        for (const layer of ['EMP-TERRENO', 'EMP-EDIFICACION', 'EMP-ALUMBRADO', 'EMP-CABLEADO', 'EMP-TABLEROS']) {
            expect(dxf).toContain(layer);
        }
        expect(dxf).toContain('PLANTA GENERAL - Colegio (m)');
        expect([...dxf].every((ch) => ch === '\n' || (ch >= ' ' && ch <= '~'))).toBe(true);
    });

    it('escala a metros reales e invierte Y (plano Y abajo → DXF Y arriba)', () => {
        const dxf = buildSiteDxf(site());
        // El terreno 200×200 unidades × 0,5 m = 100 m: su esquina (200, 200) → (100, −100).
        expect(dxf).toContain('10\n100.000000\n20\n-100.000000');
    });

    it('postes como símbolo + brazo; cables en su capa con rótulo de sección', () => {
        const dxf = buildSiteDxf(site());
        expect(entities(dxf, 'CIRCLE', 'EMP-ALUMBRADO')).toBeGreaterThanOrEqual(4); // 2 postes + 2 cabezas
        expect(entities(dxf, 'LINE', 'EMP-ALUMBRADO')).toBe(2); // brazos
        expect(entities(dxf, 'LINE', 'EMP-CABLEADO')).toBe(2);
        expect(dxf).toContain('C1 4mm2');
    });

    it('omite objetos ocultos y capas apagadas', () => {
        const dxf = buildSiteDxf(site());
        expect(dxf).not.toContain('\nOculto\n');
        const hidden = buildSiteDxf(site({ layers: [{ id: 'l', label: 'Edif', types: ['building_block'], visible: false, locked: false }] }));
        expect(hidden).not.toContain('\nModulo A\n');
    });

    it('cuadro resumen: cantidades, potencia y metrado de cable por sección', () => {
        const summary = summarizeSiteForDxf(site());
        expect(summary.poles).toBe(2);
        expect(summary.lightingW).toBe(240);
        expect(summary.panels).toBe(1);
        expect(summary.cableByType).toHaveLength(1);
        expect(summary.cableByType[0].label).toBe('THW-90 4 mm2 (F+N+T)');
        expect(summary.cableByType[0].lengthM).toBeGreaterThan(20); // 40 unid. × 0,5 m + recorrido TG→P1
        expect(siteDxfLayerOf('ramp')).toBe('EMP-VIAS');
    });
});
