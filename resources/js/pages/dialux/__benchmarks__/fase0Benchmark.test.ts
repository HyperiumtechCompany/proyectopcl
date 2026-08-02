import { describe, expect, it } from 'vitest';
import { buildDxfDrawingPackage } from '@/pages/dialux/export/dxf/builders/buildDxfDrawingPackage';
import { buildDxfMultiSheetDocument } from '@/pages/dialux/export/dxf/builders/buildDxfMultiSheetDocument';
import { buildModuloIProjectFixture } from '@/pages/dialux/export/__fixtures__/moduloIFixture';
import {
    buildFase0MediumAmbients,
} from '@/pages/dialux/hooks/__fixtures__/fase0MediumFixture';
import {
    buildFase0SmallFixtures,
    buildFase0SmallRoom,
} from '@/pages/dialux/hooks/__fixtures__/fase0SmallFixture';
import { calculateLightingResult } from '@/pages/dialux/hooks/lightingEngineCore';

/**
 * Primer benchmark de línea base (Fase 0,
 * planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md, §11 Fase 0 /
 * §17). No es un gate de rendimiento estricto (el tiempo real depende de la
 * máquina que corre el test) — los números capturados aquí se transcriben a
 * `planes/fase0_benchmark_dialux.md` como referencia histórica. Las
 * aserciones solo comprueban techos generosos (10x el valor observado en la
 * máquina de referencia) para detectar una regresión catastrófica de
 * rendimiento, no una micro-variación esperable entre corridas.
 *
 * Cobertura: cálculo lumínico (3 escalas) y construcción DXF (MÓDULO I).
 * El PDF formal NO se mide aquí — depende de Dompdf/Fpdi en el backend
 * (`Editor2DController::formalExport`) y no corre en este entorno Node/vitest;
 * queda como hueco documentado hasta que exista un harness de benchmark
 * server-side (fuera de alcance de Fase 0).
 */
function time(fn: () => void): number {
    const start = performance.now();
    fn();
    return performance.now() - start;
}

describe('Fase 0 — benchmark inicial', () => {
    it('calcula la fixture pequeña (1 recinto, 4 luminarias) por debajo del techo', () => {
        const room = buildFase0SmallRoom();
        const fixtures = buildFase0SmallFixtures();

        const durationMs = time(() => {
            calculateLightingResult(room, fixtures);
        });

        console.log(`[fase0-benchmark] small calc: ${durationMs.toFixed(2)}ms`);
        expect(durationMs).toBeLessThan(500);
    });

    it('calcula la fixture mediana (20 recintos, 200 luminarias) por debajo del techo', () => {
        const ambients = buildFase0MediumAmbients();

        const durationMs = time(() => {
            for (const ambient of ambients) {
                calculateLightingResult(ambient.room, ambient.fixtures);
            }
        });

        console.log(`[fase0-benchmark] medium calc (20 ambientes): ${durationMs.toFixed(2)}ms`);
        expect(durationMs).toBeLessThan(2000);
    });

    it('calcula la fixture MÓDULO I (24 ambientes) por debajo del techo', () => {
        const project = buildModuloIProjectFixture();

        const durationMs = time(() => {
            for (const scene of project.scenes) {
                scene.rooms.forEach((room, index) => {
                    calculateLightingResult(room, [scene.fixtures[index]!]);
                });
            }
        });

        console.log(`[fase0-benchmark] MODULO I calc (24 ambientes): ${durationMs.toFixed(2)}ms`);
        expect(durationMs).toBeLessThan(2000);
    });

    it('construye el paquete + documento DXF de MÓDULO I por debajo del techo', () => {
        const project = buildModuloIProjectFixture();

        let dxfText = '';
        const durationMs = time(() => {
            const pkg = buildDxfDrawingPackage({
                project,
                activeSceneId: project.scenes[0]!.id,
                globalBasePlan: null,
            });
            const result = buildDxfMultiSheetDocument({ package: pkg, exportedAtLabel: '2026-08-02' });
            dxfText = result.dxfText;
        });

        console.log(`[fase0-benchmark] MODULO I DXF build (3 niveles): ${durationMs.toFixed(2)}ms, ${dxfText.length} chars`);
        expect(dxfText.length).toBeGreaterThan(0);
        expect(durationMs).toBeLessThan(5000);
    });
});
