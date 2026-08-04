import { describe, expect, it } from 'vitest';
import { buildFase0MediumAmbients } from '@/pages/dialux/hooks/__fixtures__/fase0MediumFixture';
import { buildFase0SmallFixtures, buildFase0SmallRoom } from '@/pages/dialux/hooks/__fixtures__/fase0SmallFixture';
import { illuminanceFromFixture, type SurfacePoint } from '@/pages/dialux/hooks/directIlluminance';
import { GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Fixture, Room } from '@/pages/dialux/hooks/types';

/**
 * Benchmark del kernel de la Fase 12 ("Rendimiento: Worker y WASM", plan
 * maestro §11) — aísla SOLO el término de iluminancia directa (el mismo
 * trabajo que hace `dialux-core::compute_direct_illuminance_grid`), no
 * `calculateLightingResult` completo (que además calcula reflexión/UGR).
 *
 * IMPORTANTE — esto mide el motor TS puro, NO compara contra el kernel WASM
 * real: cruzar la frontera JS↔WASM (`dialux_core_bg.wasm`, servido desde
 * `public/`) no es posible en este entorno Node/vitest sin un servidor Vite
 * (ver `wasmDirectIlluminanceKernel.test.ts`). El número equivalente del
 * lado Rust se obtiene por separado con
 * `cargo test --release -- --ignored --nocapture` en `dialux-core/` (test
 * `direct_illuminance::tests::bench_compute_direct_illuminance_grid`,
 * marcado `#[ignore]` para no correr en cada `cargo test` normal) y se
 * documenta junto a este número en `planes/fase12_progreso_dialux.md` — son
 * dos mediciones en runtimes distintos (Node vs. binario nativo), útiles
 * como referencia direccional, no un benchmark riguroso en el mismo proceso.
 */
function time(fn: () => void): number {
    const start = performance.now();
    fn();
    return performance.now() - start;
}

function buildGridPoints(room: Room, spacing: number): SurfacePoint[] {
    const xValues = room.vertices.map((v) => v.x);
    const yValues = room.vertices.map((v) => v.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const points: SurfacePoint[] = [];
    for (let y = minY + spacing / 2; y < maxY; y += spacing) {
        for (let x = minX + spacing / 2; x < maxX; x += spacing) {
            points.push({ x, y, z: 0.8, normal: { x: 0, y: 0, z: 1 } });
        }
    }
    return points;
}

function timeDirectIlluminanceGrid(points: SurfacePoint[], fixtures: Fixture[]): number {
    return time(() => {
        for (const point of points) {
            let sum = 0;
            for (const fixture of fixtures) {
                sum += illuminanceFromFixture(point, fixture, []);
            }
            void sum;
        }
    });
}

describe('Fase 12 — benchmark del kernel de iluminancia directa (motor TS)', () => {
    it('malla pequeña (~96 puntos x 4 luminarias)', () => {
        const room = buildFase0SmallRoom();
        const fixtures = buildFase0SmallFixtures();
        const points = buildGridPoints(room, GRID_SPACING);

        const durationMs = timeDirectIlluminanceGrid(points, fixtures);

        console.log(`[fase12-benchmark] TS directo — malla pequeña (${points.length} pts x ${fixtures.length} luminarias): ${durationMs.toFixed(3)}ms`);
        expect(durationMs).toBeLessThan(500);
    });

    it('malla mediana (20 ambientes, ~10 luminarias cada uno)', () => {
        const ambients = buildFase0MediumAmbients();
        const room = buildFase0SmallRoom();
        const points = buildGridPoints(room, GRID_SPACING);

        const durationMs = time(() => {
            for (const ambient of ambients) {
                timeDirectIlluminanceGrid(points, ambient.fixtures);
            }
        });

        const totalFixtures = ambients.reduce((sum, a) => sum + a.fixtures.length, 0);
        console.log(
            `[fase12-benchmark] TS directo — malla mediana (${ambients.length} ambientes, ${points.length} pts c/u, ${totalFixtures} luminarias en total): ${durationMs.toFixed(3)}ms`,
        );
        expect(durationMs).toBeLessThan(5000);
    });
});
