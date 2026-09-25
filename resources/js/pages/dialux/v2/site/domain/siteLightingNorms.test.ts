import { describe, expect, it } from 'vitest';
import type { LightingSummary } from './exteriorLighting';
import {
    checkAgainstNorm,
    listActivities,
    suggestActivity,
} from './siteLightingNorms';

const summary = (avgLux: number, uniformity: number): LightingSummary => ({
    luminaires: 2,
    fluxLm: 6000,
    avgLux,
    minLux: avgLux * uniformity,
    maxLux: avgLux * 2,
    uniformity,
    areaM2: 400,
});

describe('site/domain/siteLightingNorms', () => {
    it('las tres regiones leen su catálogo de la v1', () => {
        for (const region of ['europe', 'usa', 'peru'] as const) {
            expect(listActivities(region).length).toBeGreaterThan(0);
        }
    });

    it('sugiere una actividad de estacionamiento exterior en Perú', () => {
        const hit = suggestActivity('peru', 'parking');
        expect(hit?.title).toBe('Estacionamiento exterior');
    });

    it('compara Em y Uo contra la actividad elegida', () => {
        const activity = suggestActivity('peru', 'parking');
        expect(activity).toBeDefined();
        const key = activity!.key;
        const ok = checkAgainstNorm('peru', key, summary(activity!.illuminanceLux + 10, 0.5));
        expect(ok.emVerdict).toBe('meets');
        const low = checkAgainstNorm('peru', key, summary(activity!.illuminanceLux - 5, 0.5));
        expect(low.emVerdict).toBe('below');
    });

    it('sin luminarias o sin actividad no hay veredicto', () => {
        expect(checkAgainstNorm('peru', undefined, summary(100, 0.5)).emVerdict).toBe('no-data');
        const key = suggestActivity('peru', 'parking')!.key;
        expect(checkAgainstNorm('peru', key, null).emVerdict).toBe('no-data');
    });
});
