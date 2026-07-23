import { describe, expect, it } from 'vitest';
import {
    buildModuloIProjectFixture,
} from '../../__fixtures__/moduloIFixture';
import { buildDialuxExportSnapshot } from '../../snapshot/buildDialuxExportSnapshot';
import { buildDrawnTerrainSvg, buildTerrainWithIsoluxSvg } from '../svg/buildTerrainSvg';
import {
    createBoundsFromVertices,
    createTransform,
    MAX_TRANSFORM_SCALE,
    MIN_TRANSFORM_SCALE,
} from './transforms';
import { pickSvgPageDimensions } from './renderPrimitives';

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

describe('Fase 3 — motor gráfico común', () => {
    it('buildTerrainWithIsoluxSvg incluye la leyenda de color (antes ausente)', () => {
        const project = buildModuloIProjectFixture();
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            includeAllScenes: true,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });

        const asset = buildTerrainWithIsoluxSvg(snapshot, null);

        expect(asset.svg).toContain('id="color-legend"');
        // La leyenda debe mostrar unidades de lux, no solo colores.
        expect(asset.svg).toMatch(/\d+ lx/);
    });

    it('buildDrawnTerrainSvg dibuja las luminarias con el mismo símbolo que los planos de ambiente', () => {
        const project = buildModuloIProjectFixture();
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            includeAllScenes: true,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });

        const asset = buildDrawnTerrainSvg(snapshot, null);

        // renderFixtureSymbol dibuja <rect>/<circle>/<ellipse> según la forma;
        // el fixture del fixture de MÓDULO I es "rectangular" → <rect>.
        expect(asset.svg).toContain('<g id="fixtures-layer">');
        expect(asset.svg).toMatch(/<rect[^>]*rx="4\.00"/);
    });

    it('createTransform no produce una escala degenerada para geometría extrema', () => {
        // Pasillo muy largo y angosto.
        const elongatedBounds = createBoundsFromVertices([
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 1.5 },
            { x: 0, y: 1.5 },
        ])!;
        const elongatedTransform = createTransform(elongatedBounds, 900, 900, 48);
        expect(elongatedTransform.scale).toBeGreaterThanOrEqual(MIN_TRANSFORM_SCALE);
        expect(elongatedTransform.scale).toBeLessThanOrEqual(MAX_TRANSFORM_SCALE);
        expect(Number.isFinite(elongatedTransform.scale)).toBe(true);

        // Ambiente diminuto.
        const tinyBounds = createBoundsFromVertices([
            { x: 0, y: 0 },
            { x: 0.5, y: 0 },
            { x: 0.5, y: 0.5 },
            { x: 0, y: 0.5 },
        ])!;
        const tinyTransform = createTransform(tinyBounds, 900, 900, 48);
        expect(tinyTransform.scale).toBeGreaterThanOrEqual(MIN_TRANSFORM_SCALE);
        expect(tinyTransform.scale).toBeLessThanOrEqual(MAX_TRANSFORM_SCALE);
        expect(Number.isFinite(tinyTransform.scale)).toBe(true);
    });

    it('pickSvgPageDimensions mantiene los 3 tramos ya usados por los builders existentes', () => {
        expect(pickSvgPageDimensions(0.5)).toEqual({ width: 800, height: 1131 });
        expect(pickSvgPageDimensions(1)).toEqual({ width: 900, height: 900 });
        expect(pickSvgPageDimensions(2)).toEqual({ width: 1200, height: 780 });
    });
});
