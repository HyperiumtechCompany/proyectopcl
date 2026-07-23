import { describe, expect, it } from 'vitest';
import { buildDxfFixtureCProject } from '../__fixtures__/dxfLevelFixtures';
import { buildDxfDrawingPackage } from './buildDxfDrawingPackage';
import { numberDxfSheets } from './numberDxfSheets';

/**
 * Fase 4 del plan maestro DXF: numeración de láminas. Prueba requerida —
 * seis láminas numeradas sin duplicados (Fixture C: 3 niveles × 2 disciplinas).
 */

describe('numberDxfSheets', () => {
    it('seis láminas numeradas sin duplicados, en orden estable (nivel por floorIndex, alumbrado antes de tomas)', () => {
        const project = buildDxfFixtureCProject();
        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: 'c-planta-baja',
            globalBasePlan: null,
        });

        const sheets = numberDxfSheets(pkg.levels);

        expect(sheets).toHaveLength(6);
        expect(new Set(sheets.map((s) => s.sheetNumber)).size).toBe(6); // sin duplicados
        expect(sheets.map((s) => s.sheetIndex)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(sheets.every((s) => s.sheetCount === 6)).toBe(true);
        expect(sheets.map((s) => s.sheetNumber)).toEqual([
            '01/06', '02/06', '03/06', '04/06', '05/06', '06/06',
        ]);

        expect(sheets.map((s) => [s.sceneId, s.discipline])).toEqual([
            ['c-sotano', 'lighting'], ['c-sotano', 'outlets'],
            ['c-planta-baja', 'lighting'], ['c-planta-baja', 'outlets'],
            ['c-piso-1', 'lighting'], ['c-piso-1', 'outlets'],
        ]);
    });

    it('un solo nivel produce dos láminas: "01/02" y "02/02"', () => {
        const project = buildDxfFixtureCProject();
        project.scenes = [project.scenes[0]!];

        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: project.scenes[0]!.id,
            globalBasePlan: null,
        });
        const sheets = numberDxfSheets(pkg.levels);

        expect(sheets.map((s) => s.sheetNumber)).toEqual(['01/02', '02/02']);
    });
});
