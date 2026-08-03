import { describe, expect, it } from 'vitest';
import {
    buildModuloIProjectFixture,
    MODULO_I_EXPECTED_AMBIENT_COUNT,
    MODULO_I_EXPECTED_LEVEL_COUNT,
} from '@/pages/dialux/export/__fixtures__/moduloIFixture';
import {
    buildFase0MediumAmbients,
    FASE0_MEDIUM_EXPECTED_FIXTURE_COUNT,
    FASE0_MEDIUM_EXPECTED_ROOM_COUNT,
} from './__fixtures__/fase0MediumFixture';
import { buildFase0SmallFixtures, buildFase0SmallRoom } from './__fixtures__/fase0SmallFixture';
import { calculateLightingResult, LIGHTING_ENGINE_VERSION } from './lightingEngineCore';

/**
 * Golden numérico de línea base (Fase 0,
 * planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md, §11 Fase 0 /
 * §14.4). Congela el resultado ACTUAL de `calculateLightingResult` para las
 * fixtures pequeña y mediana — no es una afirmación de que estos valores sean
 * correctos frente a una referencia externa (eso es trabajo de Fase 5/10), es
 * la prueba de que el refactor de fases posteriores no cambia el resultado
 * numérico sin que alguien lo decida explícitamente.
 *
 * - Fuente: fixtures sintéticas propias (`hooks/__fixtures__/fase0*.ts`), no
 *   hay proyecto de referencia externo para este golden.
 * - Versión de motor: LIGHTING_ENGINE_VERSION ('direct-preview-v1').
 * - Configuración: GRID_SPACING = 0.5 (fija, ver lightingEngineCore.ts).
 * - Tolerancia: 1e-6 — el motor es determinista, no debería haber variación
 *   ninguna entre corridas; cualquier diferencia mayor es una regresión real.
 * - Justificación de valores: capturados ejecutando esta misma suite y
 *   pegados aquí; si el algoritmo cambia intencionalmente, regenerar y anotar
 *   el motivo en el commit que actualiza este archivo.
 */
describe('Fase 0 — golden numérico del motor direct-preview-v1', () => {
    it('mantiene el LIGHTING_ENGINE_VERSION etiquetado', () => {
        expect(LIGHTING_ENGINE_VERSION).toBe('direct-preview-v1');
    });

    it('fixture pequeña (1 recinto, 4 luminarias) reproduce el mismo resultado', () => {
        const room = buildFase0SmallRoom();
        const fixtures = buildFase0SmallFixtures();
        expect(fixtures).toHaveLength(4);

        const first = calculateLightingResult(room, fixtures);
        const second = calculateLightingResult(room, fixtures);

        // Reproducibilidad: dos corridas del mismo snapshot dan el mismo resultado (puerta de salida Fase 0).
        expect(second).toEqual(first);

        expect(first.avg_lux).toBeCloseTo(268.3732582039019, 6);
        expect(first.min_lux).toBeCloseTo(143.14873218257404, 6);
        expect(first.max_lux).toBeCloseTo(353.6331042666314, 6);
        expect(first.uniformity).toBeCloseTo(0.5333941732518445, 6);
        expect(first.ugr).toBeCloseTo(31.68313516282294, 6);
        expect(first.grid_rows * first.grid_cols).toBeGreaterThan(0);
    });

    it('fixture mediana (1 nivel, 20 recintos, 200 luminarias) agrega totales estables', () => {
        const ambients = buildFase0MediumAmbients();
        expect(ambients).toHaveLength(FASE0_MEDIUM_EXPECTED_ROOM_COUNT);
        const totalFixtures = ambients.reduce((sum, a) => sum + a.fixtures.length, 0);
        expect(totalFixtures).toBe(FASE0_MEDIUM_EXPECTED_FIXTURE_COUNT);

        const results = ambients.map((a) => calculateLightingResult(a.room, a.fixtures));
        const avgLuxTotal = results.reduce((sum, r) => sum + r.avg_lux, 0);
        const minLuxAcrossRooms = Math.min(...results.map((r) => r.min_lux));
        const maxLuxAcrossRooms = Math.max(...results.map((r) => r.max_lux));

        // Todos los ambientes son geométricamente idénticos (misma grilla de
        // luminarias relativa a su propio recinto), así que el promedio por
        // ambiente debe ser idéntico entre ellos.
        for (const result of results) {
            expect(result.avg_lux).toBeCloseTo(results[0]!.avg_lux, 6);
        }

        expect(avgLuxTotal / FASE0_MEDIUM_EXPECTED_ROOM_COUNT).toBeCloseTo(545.2818686296467, 6);
        expect(minLuxAcrossRooms).toBeCloseTo(329.1728754786152, 6);
        expect(maxLuxAcrossRooms).toBeCloseTo(707.0499819969476, 6);
    });

    it('fixture grande MÓDULO I (3 niveles x 8 ambientes) agrega totales estables', () => {
        const project = buildModuloIProjectFixture();
        expect(project.scenes).toHaveLength(MODULO_I_EXPECTED_LEVEL_COUNT);
        const ambientCount = project.scenes.reduce((sum, s) => sum + s.rooms.length, 0);
        expect(ambientCount).toBe(MODULO_I_EXPECTED_AMBIENT_COUNT);

        // Cada recinto de este fixture tiene exactamente 1 luminaria propia,
        // nombrada `${room.id}-fixture-1` — se empareja por índice en vez de
        // reimplementar la resolución de ambientes compuestos (`hooks/ambientSpaces.ts`),
        // que no es el objeto bajo prueba en este golden.
        const results = project.scenes.flatMap((scene) =>
            scene.rooms.map((room, index) =>
                calculateLightingResult(room, [scene.fixtures[index]!]),
            ),
        );

        const avgLuxTotal = results.reduce((sum, r) => sum + r.avg_lux, 0) / results.length;
        const minLuxAcrossRooms = Math.min(...results.map((r) => r.min_lux));
        const maxLuxAcrossRooms = Math.max(...results.map((r) => r.max_lux));

        expect(avgLuxTotal).toBeCloseTo(54.34801473956015, 6);
        expect(minLuxAcrossRooms).toBeCloseTo(14.97077998818699, 6);
        expect(maxLuxAcrossRooms).toBeCloseTo(183.763331511139, 6);
    });
});
