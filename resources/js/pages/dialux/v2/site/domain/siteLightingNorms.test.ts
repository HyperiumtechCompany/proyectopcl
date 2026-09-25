import { describe, expect, it } from 'vitest';
import type { LightingSummary } from './exteriorLighting';
import {
    ALL_SITE_NORM_REGIONS,
    checkAgainstNorm,
    findActivity,
    isInteriorCatalog,
    listActivities,
    regionSource,
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

describe('región Exterior (EN 12464-2 / EN 13201-2) — fase X1', () => {
    it('tiene su catálogo local con fuente por cifra y va primera', () => {
        const activities = listActivities('exterior');
        expect(activities.length).toBeGreaterThan(10);
        for (const activity of activities) {
            expect(activity.source).toMatch(/EN 12464-2:2014|EN 13201-2:2015/);
            expect(activity.illuminanceLux).toBeGreaterThan(0);
        }
        expect(ALL_SITE_NORM_REGIONS[0]).toBe('exterior');
        expect(isInteriorCatalog('exterior')).toBe(false);
        expect(isInteriorCatalog('peru')).toBe(true);
        expect(regionSource('exterior')).toMatch(/pendientes de confirmar/);
    });

    it('clases P de EN 13201-2: P1…P6 con Ē y Emín', () => {
        const p = (name: string) => findActivity('exterior', `EN 13201-2 · Clases P (peatonal / baja velocidad) › ${name}`)!;
        expect([p('P1'), p('P3'), p('P6')].map((a) => [a.illuminanceLux, a.minLux])).toEqual([
            [15, 3],
            [7.5, 1.5],
            [2, 0.4],
        ]);
    });

    it('clase P: "≥ norma" solo si se cumplen Ē Y Emín', () => {
        const key = 'EN 13201-2 · Clases P (peatonal / baja velocidad) › P3';
        const ok = checkAgainstNorm('exterior', key, summary(10, 0.2)); // Emín 2 ≥ 1,5
        expect(ok.emVerdict).toBe('meets');
        expect(ok.minVerdict).toBe('meets');
        const lowMin = checkAgainstNorm('exterior', key, summary(10, 0.1)); // Emín 1 < 1,5
        expect(lowMin.minVerdict).toBe('below');
        expect(lowMin.emVerdict).toBe('below');
    });

    it('sugerencias por tipo de espacio', () => {
        expect(suggestActivity('exterior', 'sidewalk')?.title).toBe('P3');
        expect(suggestActivity('exterior', 'stair')?.title).toBe('P3');
        expect(suggestActivity('exterior', 'parking')?.illuminanceLux).toBe(10);
        expect(suggestActivity('exterior', 'street')?.illuminanceLux).toBe(20);
        expect(suggestActivity('exterior', 'court')).toBeUndefined(); // EN 12193 no cargada
    });

    it('las regiones de interiores no exigen Emín', () => {
        const [first] = listActivities('europe');
        expect(first.minLux).toBeNull();
    });
});

