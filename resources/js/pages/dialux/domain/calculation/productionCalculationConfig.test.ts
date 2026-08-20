import { describe, expect, it } from 'vitest';
import type { Project } from '@/pages/dialux/hooks/types';
import { buildProductionCalculationConfig } from './productionCalculationConfig';

/**
 * Rondas 21l→25 (2026-08-19): oclusión reactivada tras corregir la
 * interpretación de los contornos cerrados (anillo = recorrido perimetral
 * del muro, una caja por arista con espesor declarado), e interreflexión
 * cambiada de `'auto-by-shape'` a `'iterative'` tras corregir las dos
 * causas físicas que hacían parecer mejor a `first-bounce` (falta de
 * oclusión + parches de pared sin subdivisión horizontal de campo cercano)
 * — ver el doc-comment de `buildProductionCalculationConfig` para la
 * historia completa con la matriz de verificación.
 */
function buildMinimalProject(): Project {
    return {
        id: 'project-occlusion-config-test',
        name: 'Proyecto de prueba',
        scenes: [],
    } as unknown as Project;
}

describe('buildProductionCalculationConfig — flags de producción', () => {
    it('oclusión activada por defecto — ver doc-comment (Rondas 21l→25, historia completa)', () => {
        const config = buildProductionCalculationConfig(buildMinimalProject());
        expect(config.occlusion).toBe(true);
    });

    it('mantiene los demás defaults de producción ya establecidos', () => {
        const config = buildProductionCalculationConfig(buildMinimalProject());
        expect(config.interreflection).toBe('iterative');
        expect(config.meshPolicy.adaptive).toBe(true);
        expect(config.excludeMarginalZoneFromStats).toBe(true);
    });
});
