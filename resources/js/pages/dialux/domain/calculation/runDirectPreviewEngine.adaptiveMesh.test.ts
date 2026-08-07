import { describe, expect, it } from 'vitest';
import { GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import { buildGradientProject } from './__fixtures__/gradientProjectFixture';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from './types';

/**
 * `meshPolicy.adaptive` (`hooks/adaptiveGridSpacing.ts`): espaciado de malla
 * adaptativo POR RECINTO — más fino cuanto más gradiente de luz tenga ese
 * recinto, nunca más grueso que `meshPolicy.gridSpacingM`. Archivo dedicado
 * (mismo patrón que `lightingEngineCore.iterativeRadiosity.test.ts` y
 * hermanos) en vez de crecer más `runDirectPreviewEngine.test.ts`
 * (presupuesto de tamaño, `__architecture__/fileSizeBudget.test.ts`).
 */
describe('runDirectPreviewEngine — meshPolicy.adaptive', () => {
    it('sin meshPolicy.adaptive, el resultado es idéntico al de siempre (malla fija)', async () => {
        const snapshot = buildCalculationSnapshot(buildGradientProject());

        const withoutFlag = await runDirectPreviewEngine(snapshot);
        const withFalseFlag = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            meshPolicy: { ...DEFAULT_DIRECT_PREVIEW_CONFIG.meshPolicy, adaptive: false },
        });

        expect(withFalseFlag.surfaces[0]!.result).toEqual(withoutFlag.surfaces[0]!.result);
    });

    it('meshPolicy.adaptive refina la malla en un recinto con gradiente de luz real y liga la zona marginal al espaciado efectivo', async () => {
        // `buildGradientProject`: recinto grande (10x10) con UNA sola
        // luminaria pegada a una esquina — garantiza un gradiente real de
        // iluminancia dentro del mismo recinto.
        const snapshot = buildCalculationSnapshot(buildGradientProject());

        const fixed = await runDirectPreviewEngine(snapshot);
        const adaptive = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            meshPolicy: { ...DEFAULT_DIRECT_PREVIEW_CONFIG.meshPolicy, adaptive: true },
        });

        const fixedResult = fixed.surfaces[0]!.result;
        const adaptiveResult = adaptive.surfaces[0]!.result;

        // Más gradiente -> más puntos que en el modo fijo de siempre.
        expect(adaptiveResult.grid_cols * adaptiveResult.grid_rows).toBeGreaterThan(
            fixedResult.grid_cols * fixedResult.grid_rows,
        );
        // La zona marginal reportada ahora es físicamente real: la mitad
        // del espaciado efectivo usado en ESTE cálculo, no la heurística
        // desconectada de `getRoomMarginalZone`.
        const effectiveSpacingX = 10 / adaptiveResult.grid_cols;
        expect(adaptiveResult.marginal_zone).toBeCloseTo(effectiveSpacingX / 2, 6);
        expect(adaptiveResult.marginal_zone).toBeLessThan(GRID_SPACING / 2);
    });
});
