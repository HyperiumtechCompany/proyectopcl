import { describe, expect, it } from 'vitest';
import { ALLOWED_SCALE_DENOMINATORS, DEFAULT_RESERVED_ZONES_MM, resolvePaperSizeMm } from '../domain/constants';
import type { DxfBounds } from '../domain/types';
import { computeAutoScale, computeSheetGeometry, computeSheetGeometryAtScale, translateSheetGeometry } from './sheetScale';

/**
 * Fase 3 del plan maestro DXF: geometría de papel y escala. Criterio de
 * cierre — las dimensiones del marco en Model Space corresponden
 * matemáticamente al formato y escala declarados.
 */

const TINY_BOUNDS: DxfBounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };

describe('computeSheetGeometryAtScale — dimensiones conocidas de marco', () => {
    it('A1 horizontal a 1:50 → 42.05m × 29.70m (ejemplo de la sección 7.2)', () => {
        const paper = resolvePaperSizeMm('A1', 'landscape');
        expect(paper).toEqual({ widthMm: 841, heightMm: 594 });

        const geometry = computeSheetGeometryAtScale(TINY_BOUNDS, paper, DEFAULT_RESERVED_ZONES_MM, 50);

        expect(geometry.scaleDenominator).toBe(50);
        expect(geometry.frameOuter.minX).toBe(0);
        expect(geometry.frameOuter.minY).toBe(0);
        expect(geometry.frameOuter.maxX).toBeCloseTo(42.05, 6);
        expect(geometry.frameOuter.maxY).toBeCloseTo(29.7, 6);
    });

    it('A3 horizontal a 1:100 → 42.0m × 29.7m', () => {
        const paper = resolvePaperSizeMm('A3', 'landscape');
        expect(paper).toEqual({ widthMm: 420, heightMm: 297 });

        const geometry = computeSheetGeometryAtScale(TINY_BOUNDS, paper, DEFAULT_RESERVED_ZONES_MM, 100);

        expect(geometry.frameOuter.maxX).toBeCloseTo(42.0, 6);
        expect(geometry.frameOuter.maxY).toBeCloseTo(29.7, 6);
    });

    it('el área de plano nunca invade la columna de leyenda/cajetín', () => {
        const paper = resolvePaperSizeMm('A1', 'landscape');
        const geometry = computeSheetGeometryAtScale(TINY_BOUNDS, paper, DEFAULT_RESERVED_ZONES_MM, 50);

        expect(geometry.planArea.maxX).toBeLessThanOrEqual(geometry.legendArea.minX);
        expect(geometry.titleBlockArea.maxY).toBeCloseTo(geometry.legendArea.minY, 9);
        expect(geometry.legendArea.maxY).toBeCloseTo(geometry.frameInner.maxY, 9);
        expect(geometry.titleBlockArea.minY).toBeCloseTo(geometry.frameInner.minY, 9);
    });
});

describe('computeAutoScale — planos ancho, alto, pequeño e irregular', () => {
    const availableWidthMm = 641; // ancho de plano disponible típico (A1 - márgenes - leyenda)
    const availableHeightMm = 574;

    it('plano muy ancho y bajo: el ancho domina el denominador requerido', () => {
        const result = computeAutoScale(40, 2, availableWidthMm, availableHeightMm);
        const requiredForWidth = (40 * 1000) / availableWidthMm;
        expect(result.requiredMinimumDenominator).toBeCloseTo(requiredForWidth, 6);
    });

    it('plano muy alto y angosto: el alto domina el denominador requerido', () => {
        const result = computeAutoScale(2, 30, availableWidthMm, availableHeightMm);
        const requiredForHeight = (30 * 1000) / availableHeightMm;
        expect(result.requiredMinimumDenominator).toBeCloseTo(requiredForHeight, 6);
    });

    it('plano pequeño: usa la escala más chica permitida (menor denominador)', () => {
        const result = computeAutoScale(0.5, 0.5, availableWidthMm, availableHeightMm);
        expect(result.fits).toBe(true);
        expect(result.scaleDenominator).toBe(Math.min(...ALLOWED_SCALE_DENOMINATORS));
    });

    it('plano irregular (aspecto muy distinto a la lámina): cabe sin deformarse', () => {
        const modelWidthM = 25;
        const modelHeightM = 3;
        const result = computeAutoScale(modelWidthM, modelHeightM, availableWidthMm, availableHeightMm);

        // Un único denominador para X e Y: el modelo escalado cabe en ambos ejes.
        expect((modelWidthM * 1000) / result.scaleDenominator).toBeLessThanOrEqual(availableWidthMm + 1e-6);
        expect((modelHeightM * 1000) / result.scaleDenominator).toBeLessThanOrEqual(availableHeightMm + 1e-6);
    });
});

describe('computeSheetGeometry — coordenadas negativas', () => {
    it('centra el nivel dentro del área de plano aunque minX/minY sean negativos', () => {
        const paper = resolvePaperSizeMm('A1', 'landscape');
        const modelBounds: DxfBounds = { minX: -20, minY: -10, maxX: -5, maxY: 5 };

        const geometry = computeSheetGeometry(modelBounds, paper, DEFAULT_RESERVED_ZONES_MM);
        const { modelToPlanOffset: offset } = geometry;

        const translatedMinX = modelBounds.minX + offset.x;
        const translatedMaxX = modelBounds.maxX + offset.x;
        const translatedMinY = modelBounds.minY + offset.y;
        const translatedMaxY = modelBounds.maxY + offset.y;

        expect(translatedMinX).toBeGreaterThanOrEqual(geometry.planArea.minX - 1e-6);
        expect(translatedMaxX).toBeLessThanOrEqual(geometry.planArea.maxX + 1e-6);
        expect(translatedMinY).toBeGreaterThanOrEqual(geometry.planArea.minY - 1e-6);
        expect(translatedMaxY).toBeLessThanOrEqual(geometry.planArea.maxY + 1e-6);

        const translatedCenterX = (translatedMinX + translatedMaxX) / 2;
        const translatedCenterY = (translatedMinY + translatedMaxY) / 2;
        const planAreaCenterX = (geometry.planArea.minX + geometry.planArea.maxX) / 2;
        const planAreaCenterY = (geometry.planArea.minY + geometry.planArea.maxY) / 2;
        expect(translatedCenterX).toBeCloseTo(planAreaCenterX, 6);
        expect(translatedCenterY).toBeCloseTo(planAreaCenterY, 6);
    });
});

describe('computeAutoScale — límite exacto y exceso mínimo', () => {
    it('denominador requerido exactamente igual a una escala permitida: la usa tal cual', () => {
        // requiredForWidth = 100 * 1000 / 1000 = 100 (coincide exacto con la lista permitida).
        const result = computeAutoScale(100, 1, 1000, 100000);
        expect(result.requiredMinimumDenominator).toBe(100);
        expect(result.scaleDenominator).toBe(100);
        expect(result.fits).toBe(true);
    });

    it('exceso mínimo sobre una escala permitida: redondea hacia arriba a la siguiente, nunca hacia abajo', () => {
        const result = computeAutoScale(100.001, 1, 1000, 100000);
        expect(result.requiredMinimumDenominator).toBeGreaterThan(100);
        expect(result.scaleDenominator).toBe(125);
        expect(result.fits).toBe(true);
    });

    it('cuando ni la escala más grande de la lista alcanza, usa la mayor disponible y reporta fits=false', () => {
        const result = computeAutoScale(10000, 1, 1000, 100000);
        expect(result.fits).toBe(false);
        expect(result.scaleDenominator).toBe(Math.max(...ALLOWED_SCALE_DENOMINATORS));
    });
});

describe('translateSheetGeometry — Fase 8', () => {
    it('desplaza todos los rectángulos y el offset de centrado por (dx, dy), preservando tamaños', () => {
        const paper = resolvePaperSizeMm('A1', 'landscape');
        const modelBounds: DxfBounds = { minX: 0, minY: 0, maxX: 10, maxY: 8 };
        const geometry = computeSheetGeometryAtScale(modelBounds, paper, DEFAULT_RESERVED_ZONES_MM, 50);

        const translated = translateSheetGeometry(geometry, 100, -50);

        expect(translated.frameOuter.minX).toBeCloseTo(geometry.frameOuter.minX + 100, 6);
        expect(translated.frameOuter.minY).toBeCloseTo(geometry.frameOuter.minY - 50, 6);
        expect(translated.frameOuter.maxX - translated.frameOuter.minX).toBeCloseTo(
            geometry.frameOuter.maxX - geometry.frameOuter.minX, 6,
        );
        expect(translated.modelToPlanOffset.x).toBeCloseTo(geometry.modelToPlanOffset.x + 100, 6);
        expect(translated.modelToPlanOffset.y).toBeCloseTo(geometry.modelToPlanOffset.y - 50, 6);
        expect(translated.scaleDenominator).toBe(geometry.scaleDenominator);
    });
});
