import { describe, expect, it } from 'vitest';
import { buildVinchosProject } from './__fixtures__/vinchosProjectFixture';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { buildProductionCalculationConfig } from './productionCalculationConfig';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';

/**
 * Segundo caso dorado real (junto a `modulo22GoldenCase.test.ts`) — un
 * proyecto de geometría OPUESTA a Módulo 22: ambientes grandes (43 m²) y
 * bajos (3 m) en vez de chicos y altos. Fue exactamente esta pareja la que
 * destapó que el overshoot de la radiosidad iterativa era un problema de
 * RESOLUCIÓN de parches, no del método (`NEAR_FIELD_PATCH_CAP_M`,
 * `roomPatches.ts`, Ronda 25): sin la cota absoluta, Vinchos daba +17%/+24%
 * sobre evo mientras Módulo 22 daba +11-13% — con ella, ambos proyectos
 * quedan dentro de ±5%.
 *
 * Referencia real (DIALux evo, mismo proyecto, captura 2026-08-19):
 *   Aula 1° PRIMARIA (43.80 m²): Ē=544 lx (≥500), Uo=0.51
 *   Aula 2° PRIMARIA (42.71 m²): Ē=567 lx (≥500), Uo=0.53
 */
describe('Vinchos — caso dorado (medición, no regresión estricta)', () => {
    it('reporta Ē/Uo por ambiente con la config de producción', async () => {
        const project = buildVinchosProject();
        const snapshot = buildCalculationSnapshot(project);

        expect(snapshot.calculationObjects).toHaveLength(2);

        const run = await runDirectPreviewEngine(snapshot, buildProductionCalculationConfig(project));
        expect(run.status).toBe('completed');

        // Los dos ambientes se llaman igual ("Guarderías") — se distinguen
        // por área (la misma que muestra la UI y el informe evo), calculada
        // del polígono con la fórmula estándar.
        const polygonArea = (vertices: { x: number; y: number }[]): number => {
            let sum = 0;
            for (let i = 0; i < vertices.length; i++) {
                const a = vertices[i]!;
                const b = vertices[(i + 1) % vertices.length]!;
                sum += a.x * b.y - b.x * a.y;
            }
            return Math.abs(sum) / 2;
        };
        const areaById = new Map(snapshot.calculationObjects.map((obj) => [obj.id, polygonArea(obj.vertices)]));
        const reference = [
            { label: 'Aula 1° (43.80 m²)', area: 43.8, avg: 544, uo: 0.51, target: 500 },
            { label: 'Aula 2° (42.71 m²)', area: 42.71, avg: 567, uo: 0.53, target: 500 },
        ];

        // eslint-disable-next-line no-console
        console.log('\n=== Vinchos — motor propio (config de producción) vs DIALux evo ===');
        for (const ref of reference) {
            const surface = run.surfaces.find((s) => Math.abs((areaById.get(s.objectId) ?? 0) - ref.area) < 0.2);
            expect(surface, `no se encontró el ambiente de ${ref.label}`).toBeDefined();
            const result = surface!.result;

            const avgDeltaPct = ((result.avg_lux - ref.avg) / ref.avg) * 100;
            // eslint-disable-next-line no-console
            console.log(
                `${ref.label.padEnd(22)} Ē=${result.avg_lux.toFixed(1)} lx (evo ${ref.avg} lx, Δ${avgDeltaPct >= 0 ? '+' : ''}${avgDeltaPct.toFixed(1)}%)` +
                    ` | Uo=${result.uniformity.toFixed(2)} (evo ${ref.uo})` +
                    ` | objetivo norma=${ref.target} lx → ${result.avg_lux >= ref.target ? 'CONFORME' : 'no conforme'}`,
            );

            expect(result.avg_lux).toBeGreaterThan(0);
            expect(result.uniformity).toBeGreaterThan(0);
            expect(result.uniformity).toBeLessThanOrEqual(1);
            // Cota de brecha REAL medida el día que se congeló este caso
            // (+1%/+4% con cap=0.6): si el error vs. evo vuelve a superar
            // ±10%, algo regresionó de verdad — no aflojar esta tolerancia
            // sin documentar la causa física en el plan de paridad.
            expect(Math.abs(avgDeltaPct)).toBeLessThan(10);
        }
    });
});
