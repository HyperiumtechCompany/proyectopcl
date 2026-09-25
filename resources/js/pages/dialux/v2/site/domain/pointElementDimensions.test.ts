import { describe, expect, it } from 'vitest';
import {
    pointElementPlanDimensions,
    pointElementVisibilityFactor,
} from './pointElementDimensions';

describe('pointElementPlanDimensions', () => {
    it('usa las dimensiones configuradas del TG', () => {
        expect(
            pointElementPlanDimensions({
                type: 'tg_location',
                config: {
                    kind: 'tg',
                    mount: 'floor',
                    widthM: 1.4,
                    depthM: 0.5,
                    heightM: 2,
                },
            }),
        ).toEqual({ widthM: 1.4, depthM: 0.5 });
    });

    it('usa el diámetro de copa del árbol en planta', () => {
        expect(
            pointElementPlanDimensions({
                type: 'tree',
                config: {
                    kind: 'tree',
                    species: 'broadleaf',
                    heightM: 6,
                    crownM: 4,
                },
            }),
        ).toEqual({ widthM: 4, depthM: 4 });
    });

    it('mantiene dimensiones constructivas pequeñas para cajas de pase', () => {
        expect(
            pointElementPlanDimensions({
                type: 'pull_box',
                config: {
                    kind: 'pull_box',
                    widthM: 0.1,
                    depthM: 0.1,
                    heightM: 0.05,
                },
            }),
        ).toEqual({ widthM: 0.1, depthM: 0.1 });
    });
});

describe('pointElementVisibilityFactor', () => {
    it('keeps the physical scale when the symbol is already readable', () => {
        expect(pointElementVisibilityFactor(18, 12, false)).toBe(1);
    });

    it('gives tiny symbols a moderate minimum and emphasizes selection', () => {
        expect(pointElementVisibilityFactor(1, 1, false)).toBe(7);
        expect(pointElementVisibilityFactor(1, 1, true)).toBe(12);
    });
});
