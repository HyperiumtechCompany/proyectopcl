import { describe, expect, it } from 'vitest';
import type { Project } from '@/pages/dialux/hooks/types';
import { DXF_FIXTURE_B_DXF_ENTITIES, buildDxfFixtureCProject } from '../__fixtures__/dxfLevelFixtures';
import { buildDxfDrawingPackage } from './buildDxfDrawingPackage';
import { buildDxfExportPreview } from './buildDxfMultiSheetDocument';

/**
 * Fase 9 del plan maestro DXF: configuración de exportación. Criterio de
 * cierre — el usuario sabe qué láminas se generarán y puede corregir
 * advertencias antes de descargar (aquí, a nivel de datos: el preview no
 * genera el DXF completo).
 */

function buildPackage(project: Project, activeSceneId?: string) {
    return buildDxfDrawingPackage({
        project,
        activeSceneId: activeSceneId ?? project.scenes[0]!.id,
        globalBasePlan: null,
    });
}

describe('buildDxfExportPreview — valores predeterminados', () => {
    it('sin opciones extra, incluye todos los niveles y ambas especialidades', () => {
        const project = buildDxfFixtureCProject();
        const pkg = buildPackage(project, 'c-planta-baja');

        const preview = buildDxfExportPreview({ package: pkg });

        const sceneIds = new Set(preview.sheets.map((sheet) => sheet.sceneId));
        expect(sceneIds).toEqual(new Set(['c-sotano', 'c-planta-baja', 'c-piso-1']));
        expect(preview.sheets.some((s) => s.discipline === 'lighting')).toBe(true);
        // c-piso-1 no tiene tomacorrientes en el fixture (ver Fase 1) → no todas las combinaciones existen,
        // pero sí debe haber tomacorrientes en al menos sótano/planta baja.
        expect(preview.sheets.some((s) => s.discipline === 'outlets')).toBe(true);
    });
});

describe('buildDxfExportPreview — selección parcial de niveles', () => {
    it('con levelSceneIds, solo esos niveles aparecen en el preview', () => {
        const project = buildDxfFixtureCProject();
        const pkg = buildPackage(project, 'c-planta-baja');

        const preview = buildDxfExportPreview({ package: pkg, levelSceneIds: ['c-sotano'] });

        expect(new Set(preview.sheets.map((sheet) => sheet.sceneId))).toEqual(new Set(['c-sotano']));
    });
});

describe('buildDxfExportPreview — solo alumbrado / solo tomacorrientes', () => {
    it('disciplines: { lighting: true, outlets: false } → solo láminas de alumbrado', () => {
        const project = buildDxfFixtureCProject();
        const pkg = buildPackage(project, 'c-planta-baja');

        const preview = buildDxfExportPreview({ package: pkg, disciplines: { lighting: true, outlets: false } });

        expect(preview.sheets.length).toBeGreaterThan(0);
        expect(preview.sheets.every((sheet) => sheet.discipline === 'lighting')).toBe(true);
        // No debe advertir "empty-sheet-skipped" para tomacorrientes: fue una elección, no una ausencia.
        expect(preview.warnings.some((w) => w.code === 'empty-sheet-skipped')).toBe(false);
    });

    it('disciplines: { lighting: false, outlets: true } → solo láminas de tomacorrientes', () => {
        const project = buildDxfFixtureCProject();
        const pkg = buildPackage(project, 'c-planta-baja');

        const preview = buildDxfExportPreview({ package: pkg, disciplines: { lighting: false, outlets: true } });

        expect(preview.sheets.length).toBeGreaterThan(0);
        expect(preview.sheets.every((sheet) => sheet.discipline === 'outlets')).toBe(true);
    });
});

describe('buildDxfExportPreview — error de fondo multinivel', () => {
    it('la advertencia de fondo compartido no configurado (Fase 1) llega hasta el preview', () => {
        const project = buildDxfFixtureCProject();
        const pkg = buildDxfDrawingPackage({
            project,
            activeSceneId: 'c-planta-baja',
            globalBasePlan: { entities: DXF_FIXTURE_B_DXF_ENTITIES, extents: null },
            // Sin basePlanPolicy explícita en un proyecto multinivel con fondo global: Fase 1 advierte.
        });

        const preview = buildDxfExportPreview({ package: pkg });

        expect(preview.warnings.some((w) => w.code === 'shared-base-plan-not-configured')).toBe(true);
    });
});

describe('buildDxfExportPreview — escala manual', () => {
    it('con scaleMode manual, todas las láminas usan el denominador pedido', () => {
        const project = buildDxfFixtureCProject();
        const pkg = buildPackage(project, 'c-planta-baja');

        const preview = buildDxfExportPreview({ package: pkg, scaleMode: 'manual', manualScaleDenominator: 100 });

        expect(preview.sheets.every((sheet) => sheet.scaleDenominator === 100)).toBe(true);
    });
});
