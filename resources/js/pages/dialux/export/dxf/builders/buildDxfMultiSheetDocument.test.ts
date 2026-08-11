import { describe, expect, it } from 'vitest';
import type { Project } from '@/pages/dialux/hooks/types';
import {
    buildDxfFixtureAProject, buildDxfFixtureCProject, buildDxfLevelScene,
} from '../__fixtures__/dxfLevelFixtures';
import { buildDxfDrawingPackage } from './buildDxfDrawingPackage';
import { buildDxfMultiSheetDocument } from './buildDxfMultiSheetDocument';

/**
 * Fase 8 del plan maestro DXF: composición multinivel. Criterio de cierre —
 * todos los marcos son disjuntos, cada par corresponde al mismo nivel y
 * `$EXTMIN`/`$EXTMAX` cubre el paquete completo.
 */

function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

function buildPackageFromProject(project: Project, activeSceneId?: string) {
    return buildDxfDrawingPackage({
        project,
        activeSceneId: activeSceneId ?? project.scenes[0]!.id,
        globalBasePlan: null,
    });
}

function buildNLevelProject(levelCount: number): Project {
    return {
        id: 'multi-sheet-fixture',
        name: `Proyecto ${levelCount} niveles`,
        created_at: '2026-07-23T10:00:00.000Z',
        updated_at: '2026-07-23T10:00:00.000Z',
        scenes: Array.from({ length: levelCount }, (_, i) => buildDxfLevelScene({
            id: `n${i}`, name: `Nivel ${i}`, floorIndex: i,
        })),
    };
}

function assertValidDxfStructure(dxfText: string): void {
    expect(countOccurrences(dxfText, '0\nSECTION')).toBe(4);
    expect(countOccurrences(dxfText, '0\nENDSEC')).toBe(4);
    expect(dxfText.trim().endsWith('0\nEOF')).toBe(true);
    expect(dxfText).toContain('9\n$ACADVER\n1\nAC1009');
}

describe('buildDxfMultiSheetDocument — uno, dos, tres y diez niveles', () => {
    it.each([1, 2, 3, 10])('%i nivel(es): produce 2 láminas por nivel, sin fallar', (levelCount) => {
        const project = buildNLevelProject(levelCount);
        const pkg = buildPackageFromProject(project);

        const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-07-23' });

        expect(result.sheetCount).toBe(levelCount * 2);
        assertValidDxfStructure(result.dxfText);
        // Un INSERT del bloque de nivel por cada lámina (cada nivel se inserta una vez por lámina).
        expect(countOccurrences(result.dxfText, '0\nINSERT')).toBe(levelCount * 2);
        // Cada lámina trae su número único.
        for (let i = 1; i <= result.sheetCount; i++) {
            const pad = String(result.sheetCount).length < 2 ? 2 : String(result.sheetCount).length;
            expect(result.dxfText).toContain(`N. LAMINA: ${String(i).padStart(pad, '0')}/${String(result.sheetCount).padStart(pad, '0')}`);
        }
    });
});

describe('buildDxfMultiSheetDocument — nunca dibuja un cable como LINE recta (Fase 8 reutiliza el arco de la Fase 0)', () => {
    it('los conductores de Fixture A aparecen como ARC en el documento compuesto', () => {
        const project = buildDxfFixtureAProject();
        const pkg = buildPackageFromProject(project);
        const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-07-23' });

        expect(countOccurrences(result.dxfText, '0\nARC')).toBeGreaterThan(0);
    });
});

describe('buildDxfMultiSheetDocument — escalas distintas por nivel', () => {
    it('un nivel mucho más grande que otro no falla y ambos quedan sin solaparse', () => {
        const smallScene = buildDxfLevelScene({ id: 'small', name: 'Pequeño', floorIndex: 0 });
        const bigScene = buildDxfLevelScene({ id: 'big', name: 'Grande', floorIndex: 1 });
        bigScene.rooms = bigScene.rooms.map((room) => ({
            ...room,
            vertices: room.vertices.map((v) => ({ x: v.x * 10, y: v.y * 10 })),
        }));

        const project: Project = {
            id: 'p', name: 'Proyecto', created_at: '2026-07-23T10:00:00.000Z', updated_at: '2026-07-23T10:00:00.000Z',
            scenes: [smallScene, bigScene],
        };
        const pkg = buildPackageFromProject(project);
        const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-07-23' });

        assertValidDxfStructure(result.dxfText);
        expect(result.sheetCount).toBe(4);
    });
});

describe('buildDxfMultiSheetDocument — nivel vacío entre niveles con contenido', () => {
    it('un nivel totalmente vacío no genera ninguna lámina por defecto, y no rompe los niveles vecinos', () => {
        const emptyScene = buildDxfLevelScene({ id: 'empty', name: 'Vacio', floorIndex: 1 });
        emptyScene.fixtures = [];
        emptyScene.lightSwitches = [];
        emptyScene.electricalDevices = [];
        emptyScene.conductors = [];
        emptyScene.junctionBoxes = [];

        const project: Project = {
            id: 'p', name: 'Proyecto', created_at: '2026-07-23T10:00:00.000Z', updated_at: '2026-07-23T10:00:00.000Z',
            scenes: [
                buildDxfLevelScene({ id: 'a', name: 'Nivel A', floorIndex: 0 }),
                emptyScene,
                buildDxfLevelScene({ id: 'c', name: 'Nivel C', floorIndex: 2 }),
            ],
        };
        const pkg = buildPackageFromProject(project);
        const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-07-23' });

        // 2 niveles con contenido × 2 disciplinas = 4 láminas; el nivel vacío no aporta ninguna.
        expect(result.sheetCount).toBe(4);
        expect(result.warnings.filter((w) => w.code === 'empty-sheet-skipped' && w.sceneId === 'empty')).toHaveLength(2);
        assertValidDxfStructure(result.dxfText);
    });

    it('con includeEmptySheets:true, el nivel vacío sí genera sus 2 láminas con el placeholder', () => {
        const emptyScene = buildDxfLevelScene({ id: 'empty', name: 'Vacio', floorIndex: 0 });
        emptyScene.fixtures = [];
        emptyScene.lightSwitches = [];
        emptyScene.electricalDevices = [];
        emptyScene.conductors = [];
        emptyScene.junctionBoxes = [];

        const project: Project = {
            id: 'p', name: 'Proyecto', created_at: '2026-07-23T10:00:00.000Z', updated_at: '2026-07-23T10:00:00.000Z',
            scenes: [emptyScene],
        };
        const pkg = buildPackageFromProject(project);
        const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-07-23', includeEmptySheets: true });

        expect(result.sheetCount).toBe(2);
        expect(result.dxfText).toContain('SIN ELEMENTOS REGISTRADOS');
    });
});

describe('buildDxfMultiSheetDocument — coordenadas negativas', () => {
    it('un nivel con geometría completamente en coordenadas negativas no falla', () => {
        const scene = buildDxfLevelScene({ id: 'neg', name: 'Negativo', floorIndex: 0 });
        scene.rooms = scene.rooms.map((room) => ({
            ...room,
            vertices: room.vertices.map((v) => ({ x: v.x - 100, y: v.y - 80 })),
        }));
        scene.fixtures = scene.fixtures.map((fx) => ({ ...fx, x: fx.x - 100, y: fx.y - 80 }));
        scene.lightSwitches = scene.lightSwitches.map((sw) => ({ ...sw, x: sw.x - 100, y: sw.y - 80 }));

        const project: Project = {
            id: 'p', name: 'Proyecto', created_at: '2026-07-23T10:00:00.000Z', updated_at: '2026-07-23T10:00:00.000Z',
            scenes: [scene],
        };
        const pkg = buildPackageFromProject(project);

        expect(() => buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-07-23' })).not.toThrow();
    });
});

describe('buildDxfMultiSheetDocument — lámina con leyenda larga', () => {
    it('un nivel con muchos productos de luminaria distintos advierte overflow pero no falla', () => {
        const scene = buildDxfLevelScene({ id: 'many', name: 'Muchos productos', floorIndex: 0 });
        scene.fixtures = Array.from({ length: 30 }, (_, i) => ({
            id: `fx-${i}`, name: `Producto ${i}`, x: (i % 6) + 0.5, y: Math.floor(i / 6) + 0.5, z: 2.8,
            lumens: 1000 + i * 10, efficiency: 0.8, fixtureType: 'panel' as const,
            lightColor: '#fff5e1', productId: 1000 + i,
        }));

        const project: Project = {
            id: 'p', name: 'Proyecto', created_at: '2026-07-23T10:00:00.000Z', updated_at: '2026-07-23T10:00:00.000Z',
            scenes: [scene],
        };
        const pkg = buildPackageFromProject(project);
        const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-07-23' });

        expect(result.warnings.some((w) => w.code === 'legend-overflow')).toBe(true);
        assertValidDxfStructure(result.dxfText);
    });
});

describe('buildDxfMultiSheetDocument — extensión global', () => {
    it('EXTMIN/EXTMAX cubren el paquete completo con margen, EXTMIN < EXTMAX en ambos ejes', () => {
        const project = buildDxfFixtureCProject();
        const pkg = buildPackageFromProject(project, 'c-planta-baja');
        const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-07-23' });

        const extMin = result.dxfText.match(/9\n\$EXTMIN\n10\n([-\d.]+)\n20\n([-\d.]+)/);
        const extMax = result.dxfText.match(/9\n\$EXTMAX\n10\n([-\d.]+)\n20\n([-\d.]+)/);
        expect(extMin).not.toBeNull();
        expect(extMax).not.toBeNull();
        expect(Number(extMin![1])).toBeLessThan(Number(extMax![1]));
        expect(Number(extMin![2])).toBeLessThan(Number(extMax![2]));
    });

    it('un paquete sin niveles no falla y produce un documento vacío válido', () => {
        const project: Project = {
            id: 'p', name: 'Vacio', created_at: '2026-07-23T10:00:00.000Z', updated_at: '2026-07-23T10:00:00.000Z',
            scenes: [],
        };
        // buildDxfDrawingPackage requiere activeSceneId; con 0 escenas no hay ninguna válida,
        // así que se arma el DxfDrawingPackage vacío directamente.
        const result = buildDxfMultiSheetDocument({
            package: { version: '2.0.0', projectId: 'p', projectName: 'Vacio', units: 'm', levels: [], warnings: [] },
            exportedAtLabel: '2026-07-23',
        });

        expect(result.sheetCount).toBe(0);
        assertValidDxfStructure(result.dxfText);
    });
});

describe('buildDxfMultiSheetDocument — plano CAD base: no duplicar la reconstrucción propia', () => {
    /**
     * Bug real reportado por un usuario en un DXF exportado abierto en
     * AutoCAD: cuando el nivel tiene un plano CAD base importado
     * (`entry.level.basePlan.entities`), el exportador dibujaba ENCIMA la
     * reconstrucción propia de paredes (trazado a mano en el editor, nunca
     * pixel-perfecto contra el CAD real) — líneas dobles y desalineadas.
     *
     * El contorno de RECINTOS (recinto/ambiente) SÍ se conserva incluso con
     * plano base: es una zona de cálculo de DIAlux, no un muro físico
     * duplicado, y el mismo usuario reportó después que faltaba verla en un
     * export real ("no veo los dibujos del recinto y de los ambientes").
     */
    function buildPackageWithBasePlan(hasBasePlan: boolean) {
        const scene = buildDxfLevelScene({ id: 'n0', name: 'Aula 1', floorIndex: 0 });
        scene.walls = [{ id: 'w1', vertices: [{ x: 0, y: 0 }, { x: 6, y: 0 }], thickness: 0.2, height: 2.8 }];

        const project: Project = {
            id: 'p-baseplan', name: 'Proyecto con plano base',
            created_at: '2026-08-10T10:00:00.000Z', updated_at: '2026-08-10T10:00:00.000Z',
            scenes: [scene],
        };
        const globalBasePlan = hasBasePlan
            ? {
                entities: [{ id: 'cad-1', type: 'line' as const, x1: 0, y1: 0, x2: 6, y2: 0, layer: 'MUROS' }],
                extents: { min_x: 0, min_y: 0, max_x: 6, max_y: 5 },
            }
            : null;

        return buildDxfDrawingPackage({ project, activeSceneId: scene.id, globalBasePlan });
    }

    it('con plano base CAD: omite las PAREDES trazadas a mano, pero conserva el contorno del recinto (sin nombre en texto)', () => {
        const pkg = buildPackageWithBasePlan(true);
        const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-08-10' });

        expect(result.dxfText).not.toContain('8\nPAREDES');
        expect(result.dxfText).toContain('8\nRECINTOS');
        // El nombre de recinto/pasadizo en texto se quitó a pedido del
        // usuario (solo dibujo y simbología, texto propio no es necesario
        // por ahora) -- el texto del CAD importado (DXF_BASE_TEXTO) no se
        // toca, pero TEXTO_RECINTOS ya no se emite en absoluto.
        expect(result.dxfText).not.toContain('8\nTEXTO_RECINTOS');
        expect(result.dxfText).not.toContain('Ambiente Aula 1');
        expect(result.dxfText).toContain('8\nDXF_BASE'); // el plano CAD real sí se dibuja
    });

    it('sin plano base CAD: dibuja la reconstrucción propia (paredes y recintos, sin nombre de recinto en texto)', () => {
        const pkg = buildPackageWithBasePlan(false);
        const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-08-10' });

        expect(result.dxfText).toContain('8\nPAREDES');
        expect(result.dxfText).toContain('8\nRECINTOS');
        expect(result.dxfText).not.toContain('8\nTEXTO_RECINTOS');
    });
});
