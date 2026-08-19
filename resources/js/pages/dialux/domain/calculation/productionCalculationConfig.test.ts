import { describe, expect, it } from 'vitest';
import type { Project } from '@/pages/dialux/hooks/types';
import { buildProductionCalculationConfig } from './productionCalculationConfig';

/**
 * Ronda 21l→23: `config.occlusion` se activó, se revirtió el mismo día por
 * un bug real de geometría (`wall.vertices` como contorno cerrado tratado
 * como polilínea-centro), y quedó reactivado el 2026-08-19 tras corregir
 * `buildLinearOcclusionBoxes()` con una descomposición geométrica exacta
 * (`decomposeClosedRing`) verificada contra 5 formas sintéticas y los 2
 * muros reales de Vinchos — ver el doc-comment de
 * `buildProductionCalculationConfig` para la historia completa.
 */
function buildMinimalProject(): Project {
    return {
        id: 'project-occlusion-config-test',
        name: 'Proyecto de prueba',
        scenes: [],
    } as unknown as Project;
}

describe('buildProductionCalculationConfig — flags de producción', () => {
    it('oclusión activada por defecto — ver doc-comment (Ronda 21l→23, historia completa)', () => {
        const config = buildProductionCalculationConfig(buildMinimalProject());
        expect(config.occlusion).toBe(true);
    });

    it('mantiene los demás defaults de producción ya establecidos', () => {
        const config = buildProductionCalculationConfig(buildMinimalProject());
        expect(config.interreflection).toBe('auto-by-shape');
        expect(config.meshPolicy.adaptive).toBe(true);
        expect(config.excludeMarginalZoneFromStats).toBe(true);
    });
});
