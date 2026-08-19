import { describe, expect, it } from 'vitest';
import { getRoomMarginalZone } from '@/pages/dialux/hooks/roomLighting';
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

    it('meshPolicy.adaptive refina la malla en un recinto con gradiente de luz real, sin tocar la zona marginal real (Ronda 21n)', async () => {
        // `buildGradientProject`: recinto grande (10x10) con UNA sola
        // luminaria pegada a una esquina — garantiza un gradiente real de
        // iluminancia dentro del mismo recinto.
        const project = buildGradientProject();
        const snapshot = buildCalculationSnapshot(project);

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
        // Ronda 21n: la zona marginal NUNCA debe atarse al espaciado
        // adaptativo (una heurística de coeficiente de variación calibrada
        // para resolución de cálculo, sin relación con la norma) — debe ser
        // SIEMPRE `getRoomMarginalZone(room)` (fórmula EN 12464-1, la misma
        // que reporta un valor casi idéntico al que declara DIALux evo),
        // sin importar si la malla es fija o adaptativa. Hallazgo real:
        // atarla al espaciado adaptativo encogió el margen en un proyecto
        // real (0.229→0.117 m) y dejó puntos de una esquina oscura dentro
        // de Emin/Uo cuando debían excluirse.
        const room = project.scenes[0]!.rooms[0]!;
        expect(adaptiveResult.marginal_zone).toBeCloseTo(getRoomMarginalZone(room), 6);
        expect(adaptiveResult.marginal_zone).toBe(fixedResult.marginal_zone);
    });
});
