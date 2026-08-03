import { describe, expect, it } from 'vitest';
import { DEFAULT_RESERVED_ZONES_MM, resolvePaperSizeMm } from '../domain/constants';
import type { DxfBounds, DxfSheetMetadata } from '../domain/types';
import { computeSheetGeometryAtScale } from '../geometry/sheetScale';
import { renderTitleBlock } from './titleBlock';

/**
 * Fase 4 del plan maestro DXF: cajetín. Criterio de cierre — toda lámina
 * tiene título, nivel, especialidad, escala y número legibles, incluso con
 * texto largo, caracteres especiales o campos opcionales ausentes.
 */

const MODEL_BOUNDS: DxfBounds = { minX: 0, minY: 0, maxX: 10, maxY: 8 };

function buildGeometry() {
    const paper = resolvePaperSizeMm('A1', 'landscape');
    return computeSheetGeometryAtScale(MODEL_BOUNDS, paper, DEFAULT_RESERVED_ZONES_MM, 50);
}

function buildMetadata(overrides: Partial<DxfSheetMetadata> = {}): DxfSheetMetadata {
    return {
        sceneId: 'scene-1',
        levelName: 'Nivel 1',
        discipline: 'lighting',
        sheetIndex: 1,
        sheetCount: 6,
        sheetNumber: '01/06',
        projectName: 'Proyecto de prueba',
        disciplineLabel: 'ALUMBRADO',
        scaleDenominator: 50,
        units: 'm',
        exportedAtLabel: '2026-07-22',
        drawnBy: 'J. Perez',
        reviewedBy: 'M. Gomez',
        revision: 'A',
        ...overrides,
    };
}

function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

describe('renderTitleBlock', () => {
    it('siempre dibuja el rectángulo del cajetín y las 11 filas de texto', () => {
        const geometry = buildGeometry();
        const out: string[] = [];
        renderTitleBlock(out, geometry, buildMetadata());
        const dxf = out.join('\n');

        expect(countOccurrences(dxf, '0\nTEXT')).toBe(11);
        expect(countOccurrences(dxf, '8\nCAJETIN')).toBe(4); // 4 lados del rectángulo del cajetín
        expect(countOccurrences(dxf, '8\nTEXTO_LAMINA')).toBe(11);
        expect(dxf).toContain('NIVEL: Nivel 1');
        expect(dxf).toContain('ESPECIALIDAD: ALUMBRADO');
        expect(dxf).toContain('ESCALA: 1:50');
        expect(dxf).toContain('N. LAMINA: 01/06');
    });

    it('texto largo de proyecto no rompe la generación', () => {
        const geometry = buildGeometry();
        const longName = 'Proyecto '.repeat(60); // muy por encima del límite ASCII de 255
        const out: string[] = [];

        expect(() => renderTitleBlock(out, geometry, buildMetadata({ projectName: longName }))).not.toThrow();
        const dxf = out.join('\n');
        expect(countOccurrences(dxf, '0\nTEXT')).toBe(11);
        expect(dxf).toContain('PROYECTO: Proyecto Proyecto');
    });

    it('nivel con caracteres especiales se transcribe a ASCII, sin bytes no-ASCII', () => {
        const geometry = buildGeometry();
        const out: string[] = [];
        renderTitleBlock(out, geometry, buildMetadata({ levelName: 'Nível Ñoño – 3° 😀' }));
        const dxf = out.join('\n');

        expect(dxf).toContain('Nivel Nono');
        expect(dxf).not.toMatch(/[íÑ°😀–]/);
    });

    it('sin autor/revisor: las filas se rellenan con "-", no se omiten', () => {
        const geometry = buildGeometry();
        const out: string[] = [];
        renderTitleBlock(out, geometry, buildMetadata({ drawnBy: null, reviewedBy: null }));
        const dxf = out.join('\n');

        expect(countOccurrences(dxf, '0\nTEXT')).toBe(11);
        expect(dxf).toContain('DIBUJADO POR: -');
        expect(dxf).toContain('REVISADO POR: -');
    });

    it('fecha y revisión aparecen como filas propias y legibles', () => {
        const geometry = buildGeometry();
        const out: string[] = [];
        renderTitleBlock(out, geometry, buildMetadata({ exportedAtLabel: '2026-07-22', revision: 'B' }));
        const dxf = out.join('\n');

        expect(dxf).toContain('FECHA: 2026-07-22');
        expect(dxf).toContain('REVISION: B');
    });
});
