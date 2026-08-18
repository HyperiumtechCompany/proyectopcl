import { describe, expect, it } from 'vitest';
import type { Project } from '@/pages/dialux/hooks/types';
import { buildProductionCalculationConfig } from './productionCalculationConfig';

/**
 * Ronda 21l: `config.occlusion` se activó y se REVIRTIÓ el mismo día. El
 * pipeline pasa los tests unitarios (`lightingEngineCore.occlusion.test.ts`,
 * con paredes simples de 2 vértices), pero contra un proyecto real con
 * muros dibujados con jambas de puerta (`wall.vertices` como contorno
 * cerrado de 24+ puntos), `buildLinearOcclusionBoxes()` los trata como
 * polilínea-centro y extruye cada segmento del contorno por el grosor OTRA
 * VEZ — obstrucción mucho mayor que el muro real, promedio -19% y mínimo
 * peor que sin oclusión. Este test es el guardián en la dirección opuesta:
 * si alguien reactiva el flag sin corregir `buildLinearOcclusionBoxes()`
 * primero, esto debe fallar y recordar por qué.
 */
function buildMinimalProject(): Project {
    return {
        id: 'project-occlusion-config-test',
        name: 'Proyecto de prueba',
        scenes: [],
    } as unknown as Project;
}

describe('buildProductionCalculationConfig — flags de producción', () => {
    it('oclusión sigue desactivada por defecto — ver doc-comment (bug de geometría con contornos de muro reales, Ronda 21l)', () => {
        const config = buildProductionCalculationConfig(buildMinimalProject());
        expect(config.occlusion).toBe(false);
    });

    it('mantiene los demás defaults de producción ya establecidos', () => {
        const config = buildProductionCalculationConfig(buildMinimalProject());
        expect(config.interreflection).toBe('auto-by-shape');
        expect(config.meshPolicy.adaptive).toBe(true);
        expect(config.excludeMarginalZoneFromStats).toBe(true);
    });
});
