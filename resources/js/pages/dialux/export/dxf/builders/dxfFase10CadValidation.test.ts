/**
 * Fase 10 del plan maestro DXF: validación CAD integral.
 *
 * Genera el fixture de tres niveles / seis láminas que pide la Fase 10,
 * corre el parser DXF existente del proyecto (`parseDxfTextFallback`, el
 * mismo que usa `useDialuxDxfExport.ts` para releer un plano importado)
 * contra el archivo COMPLETO que produce `buildDxfMultiSheetDocument`, y
 * cuenta bloques/inserciones/capas/texto — todo lo automatizable del
 * criterio de cierre.
 *
 * Lo que este test NO puede hacer (y el plan lo pide explícitamente):
 * abrir el archivo en AutoCAD/QCAD/LibreCAD, verificar que abre sin
 * reparación, alternar capas a ojo, imprimir una lámina a escala y comparar
 * una distancia real contra el plano impreso — eso queda para revisión manual.
 */
import { describe, expect, it } from 'vitest';
import { parseDxfTextFallback } from '@/pages/dialux/hooks/dxfFallbackParser';
import type { Project } from '@/pages/dialux/hooks/types';
import { MULTISHEET_LAYER_DEFS } from '../domain/constants';
import { buildDxfLevelScene } from '../__fixtures__/dxfLevelFixtures';
import { buildDxfDrawingPackage } from './buildDxfDrawingPackage';
import { buildDxfMultiSheetDocument } from './buildDxfMultiSheetDocument';

function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

/** Sótano, planta baja y piso superior — los tres CON alumbrado y tomacorrientes, para forzar las 6 láminas. */
function buildThreeFullLevelsProject(): Project {
    return {
        id: 'fase10-fixture',
        name: 'Fase 10 - Validacion CAD',
        created_at: '2026-07-23T10:00:00.000Z',
        updated_at: '2026-07-23T10:00:00.000Z',
        scenes: [
            buildDxfLevelScene({ id: 'f10-sotano', name: 'Sotano 1', floorIndex: -1 }),
            buildDxfLevelScene({ id: 'f10-planta-baja', name: 'Planta Baja', floorIndex: 0 }),
            buildDxfLevelScene({ id: 'f10-piso-1', name: 'Piso 1', floorIndex: 1 }),
        ],
    };
}

describe('Fase 10 — fixture de tres niveles produce seis láminas', () => {
    const project = buildThreeFullLevelsProject();
    const pkg = buildDxfDrawingPackage({
        project,
        activeSceneId: 'f10-planta-baja',
        globalBasePlan: null,
    });
    const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-07-23' });

    it('genera exactamente 6 láminas (3 niveles × 2 especialidades)', () => {
        expect(result.sheetCount).toBe(6);
    });

    it('secciones DXF obligatorias, balanceadas, terminadas en EOF', () => {
        expect(countOccurrences(result.dxfText, '0\nSECTION')).toBe(4);
        expect(countOccurrences(result.dxfText, '0\nENDSEC')).toBe(4);
        expect(result.dxfText.trim().endsWith('0\nEOF')).toBe(true);
        expect(result.dxfText).toContain('9\n$ACADVER\n1\nAC1009');
    });

    it('la tabla de capas declara exactamente las capas del catálogo multilámina', () => {
        const layerTableMatch = result.dxfText.match(/0\nTABLE\n2\nLAYER\n70\n(\d+)/);
        expect(layerTableMatch).not.toBeNull();
        expect(Number(layerTableMatch![1])).toBe(MULTISHEET_LAYER_DEFS.length);
        expect(countOccurrences(result.dxfText, '0\nLAYER\n')).toBe(MULTISHEET_LAYER_DEFS.length);
    });

    it('un bloque arquitectónico por nivel, insertado una vez por cada una de sus láminas', () => {
        expect(countOccurrences(result.dxfText, '0\nBLOCK\n')).toBe(3);
        expect(countOccurrences(result.dxfText, '0\nENDBLK')).toBe(3);
        expect(countOccurrences(result.dxfText, '0\nINSERT')).toBe(6);
    });

    it('seis marcos completos (exterior + interior = 8 LINE en la capa MARCO por lámina)', () => {
        const marcoLineCount = (result.dxfText.match(/0\nLINE\n8\nMARCO\n/g) ?? []).length;
        expect(marcoLineCount).toBe(6 * 8);
    });

    it('seis cajetines y sus 11 filas de texto cada uno (66 TEXT en la capa TEXTO_LAMINA)', () => {
        const titleBlockTextCount = (result.dxfText.match(/0\nTEXT\n8\nTEXTO_LAMINA\n/g) ?? []).length;
        expect(titleBlockTextCount).toBe(6 * 11);
    });

    it('las seis láminas quedan numeradas de forma única, "01/06".."06/06"', () => {
        for (let i = 1; i <= 6; i++) {
            expect(result.dxfText).toContain(`N. LAMINA: 0${i}/06`);
        }
    });

    it('sin advertencias inesperadas (fixture con todo clasificado, con contenido en ambas disciplinas y sin fondo CAD)', () => {
        const expectedCodes = new Set(['empty-sheet-skipped', 'level-without-base-plan']);
        const unexpected = result.warnings.filter((w) => !expectedCodes.has(w.code));
        expect(unexpected).toEqual([]);
    });

    it('el parser DXF existente del proyecto lee las entidades sueltas sin error', () => {
        const parsed = parseDxfTextFallback(result.dxfText);
        expect(parsed.error).toBeUndefined();
        expect(parsed.entities?.length ?? 0).toBeGreaterThan(0);
        expect(parsed.min_x).toBeLessThan(parsed.max_x!);
        expect(parsed.min_y).toBeLessThan(parsed.max_y!);
        // El parser existente solo lee la sección ENTITIES (no expande BLOCKS/INSERT),
        // así que el fondo arquitectónico —dentro de los bloques por nivel— no aparece
        // aquí; sí aparecen marco, cajetín, leyenda y símbolos eléctricos sueltos.
    });
});
