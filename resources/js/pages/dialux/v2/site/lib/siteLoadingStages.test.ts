import { describe, expect, it } from 'vitest';
import { buildSiteLoadingStages } from './siteLoadingStages';

const statusById = (stages: ReturnType<typeof buildSiteLoadingStages>) =>
    Object.fromEntries(stages.map((stage) => [stage.id, stage.status]));

describe('buildSiteLoadingStages', () => {
    it('marca en curso solo la fase actual del plano CAD', () => {
        const stages = buildSiteLoadingStages({
            elementCount: 12,
            networkLoading: true,
            cadPhase: 'initializing',
            cadFileBytes: 3_200_000,
        });

        expect(statusById(stages)).toEqual({
            site: 'done',
            network: 'active',
            'cad-file': 'done',
            'cad-viewer': 'active',
            'cad-open': 'pending',
        });
        expect(stages.find((stage) => stage.id === 'cad-open')?.detail).toMatch(
            /^3[.,]2 MB$/,
        );
    });

    it('da por hecho el visor si ya estaba inicializado y se reabre el plano', () => {
        const stages = buildSiteLoadingStages({
            elementCount: 1,
            networkLoading: false,
            cadPhase: 'opening',
            cadFileBytes: 0,
        });

        expect(statusById(stages)['cad-viewer']).toBe('done');
        expect(statusById(stages)['cad-open']).toBe('active');
        expect(stages[0].detail).toBe('1 objeto');
    });
});
