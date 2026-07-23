import { describe, expect, it } from 'vitest';
import { buildDialuxExportSnapshot } from '../snapshot/buildDialuxExportSnapshot';
import { buildDialuxDxfExport } from './buildDialuxDxfExport';
import {
    DXF_FIXTURE_B_DXF_ENTITIES,
    buildDxfFixtureAProject,
    buildDxfFixtureBProject,
} from './__fixtures__/dxfLevelFixtures';

/**
 * Fase 0 del plan maestro DXF (planes/plan_maestro_planos_dxf_por_nivel_marcos_leyendas.md):
 * congela el comportamiento actual del exportador (un solo plano en Model
 * Space, sin marco/cajetín/multinivel) antes de introducir el modelo de
 * láminas. Si alguno de estos asserts se rompe durante el refactor de fases
 * posteriores, es una señal de regresión, no de que el test esté "desactualizado".
 */

const VISUAL_CONFIG = {
    showGrid: true,
    showIsolux: true,
    show3DView: false,
    isoluxMode: 'functional' as const,
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedId: null,
};

function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

describe('buildDialuxDxfExport — línea base (Fase 0)', () => {
    it('Fixture A (nivel mínimo): estructura AC1009 completa y estable', () => {
        const project = buildDxfFixtureAProject();
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });

        const dxf = buildDialuxDxfExport(snapshot);

        // Cuatro secciones obligatorias, balanceadas, y terminación EOF.
        expect(countOccurrences(dxf, '0\nSECTION')).toBe(4);
        expect(countOccurrences(dxf, '0\nENDSEC')).toBe(4);
        expect(dxf.trim().endsWith('0\nEOF')).toBe(true);
        expect(dxf).toContain('9\n$ACADVER\n1\nAC1009');

        // El fondo arquitectónico es un único bloque insertado una vez.
        expect(countOccurrences(dxf, '0\nBLOCK\n')).toBe(1);
        expect(dxf).toContain('2\nPLANO_BASE');
        expect(countOccurrences(dxf, '0\nINSERT')).toBe(1);

        // Un interruptor, una luminaria (círculo+cruz) y un tomacorriente exportados.
        expect(countOccurrences(dxf, '8\nLUMINARIAS')).toBeGreaterThan(0);
        expect(countOccurrences(dxf, '8\nINTERRUPTORES')).toBeGreaterThan(0);
        expect(countOccurrences(dxf, '8\nDISP_ELECTRICOS')).toBeGreaterThan(0);

        // Leyenda: solo símbolos usados (luminaria + interruptor simple + toma + cable).
        expect(dxf).toContain('LEYENDA ELECTRICA');

        expect(dxf).toMatchSnapshot();
    });

    it('Fixture B (nivel completo): todas las capas declaradas y sin bloques/inserts duplicados', () => {
        const project = buildDxfFixtureBProject();
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            resultsByRoom: {},
            dxfEntities: DXF_FIXTURE_B_DXF_ENTITIES,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });

        const dxf = buildDialuxDxfExport(snapshot);

        expect(countOccurrences(dxf, '0\nSECTION')).toBe(4);
        expect(countOccurrences(dxf, '0\nENDSEC')).toBe(4);
        expect(dxf.trim().endsWith('0\nEOF')).toBe(true);

        // Tabla de capas: exactamente las 14 capas documentadas en el encabezado del archivo.
        const layerTableMatch = dxf.match(/0\nTABLE\n2\nLAYER\n70\n(\d+)/);
        expect(layerTableMatch).not.toBeNull();
        expect(layerTableMatch?.[1]).toBe('14');
        expect(countOccurrences(dxf, '0\nLAYER\n')).toBe(14);

        // Fondo CAD + arquitectura siguen bundleados en un único bloque/insert.
        expect(countOccurrences(dxf, '0\nBLOCK\n')).toBe(1);
        expect(countOccurrences(dxf, '0\nINSERT')).toBe(1);

        // Cobertura de todos los tipos de dispositivo del fixture.
        for (const label of ['T-01', 'TI-01', 'TA-01', 'TR-01', 'TP', 'TE', 'TG', 'TD-01']) {
            expect(dxf).toContain(label);
        }

        // Extensión global: EXTMIN estrictamente menor que EXTMAX en ambos ejes.
        const extMin = dxf.match(/9\n\$EXTMIN\n10\n([-\d.]+)\n20\n([-\d.]+)/);
        const extMax = dxf.match(/9\n\$EXTMAX\n10\n([-\d.]+)\n20\n([-\d.]+)/);
        expect(extMin).not.toBeNull();
        expect(extMax).not.toBeNull();
        expect(Number(extMin![1])).toBeLessThan(Number(extMax![1]));
        expect(Number(extMin![2])).toBeLessThan(Number(extMax![2]));

        expect(dxf).toMatchSnapshot();
    });

    it('sigue exportando un proyecto de una sola escena (regresión Fase 1)', () => {
        const project = buildDxfFixtureAProject();
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });

        expect(() => buildDialuxDxfExport(snapshot)).not.toThrow();
    });
});
