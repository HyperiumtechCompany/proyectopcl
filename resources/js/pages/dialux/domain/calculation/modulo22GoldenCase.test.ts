import { describe, expect, it } from 'vitest';
import { buildModulo22Project } from './__fixtures__/modulo22ProjectFixture';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { buildProductionCalculationConfig } from './productionCalculationConfig';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';

/**
 * Caso dorado base para medir la brecha contra DIALux evo — NO es un test
 * de regresión con tolerancia estrecha todavía. Corre con
 * `buildProductionCalculationConfig`, la MISMA configuración que usa hoy
 * tanto el botón "Calcular" como el recálculo de respaldo del export
 * formal (malla adaptativa, zona marginal excluida, interreflexión
 * `first-bounce` —NO `iterative`, ver el porqué en
 * `productionCalculationConfig.ts`—, UGR guth-observers) — para que este
 * número sea comparable 1:1 con lo que un usuario ve en el panel de
 * resultados o en el PDF exportado.
 *
 * Referencia real (DIALux evo, mismo proyecto, export 2025-06-20):
 *   CASETA DE CONTROL: Ē=203 lx, Uo=0.87, RUG,max=22
 *   SS.HH:              Ē=206 lx, Uo=0.88, RUG,max=22
 *   VENTANILLA/CIRCULACION 1: Ē=100 lx, Uo=0.60
 */
describe('Módulo 22 — caso dorado (medición, no regresión estricta)', () => {
    it('reporta Ē/Uo/UGR por ambiente con la fotometría real ya reparada', async () => {
        const project = buildModulo22Project();
        const snapshot = buildCalculationSnapshot(project);

        expect(snapshot.calculationObjects).toHaveLength(3);

        const run = await runDirectPreviewEngine(snapshot, buildProductionCalculationConfig(project));
        expect(run.status).toBe('completed');

        const byName = new Map(snapshot.calculationObjects.map((obj) => [obj.name, obj.id]));
        const resultByObjectId = new Map(run.surfaces.map((s) => [s.objectId, s.result]));

        const reference: Record<string, { avg: number; uo: number; ugr: number; target: number }> = {
            'Caseta de Control': { avg: 203, uo: 0.87, ugr: 22, target: 200 },
            'SS.HH': { avg: 206, uo: 0.88, ugr: 22, target: 200 },
            'Ventanilla de atencion': { avg: 100, uo: 0.6, ugr: 0, target: 100 },
        };

        // eslint-disable-next-line no-console
        console.log('\n=== Módulo 22 — motor propio (config de producción: first-bounce + malla adaptativa + zona marginal) vs DIALux evo ===');
        for (const [name, ref] of Object.entries(reference)) {
            const objectId = byName.get(name);
            expect(objectId, `no se encontró el ambiente "${name}" en calculationObjects`).toBeDefined();
            const result = resultByObjectId.get(objectId!);
            expect(result, `no se encontró resultado para "${name}" (${objectId})`).toBeDefined();

            const avgDeltaPct = ((result!.avg_lux - ref.avg) / ref.avg) * 100;
            // eslint-disable-next-line no-console
            console.log(
                `${name.padEnd(24)} Ē=${result!.avg_lux.toFixed(1)} lx (evo ${ref.avg} lx, Δ${avgDeltaPct >= 0 ? '+' : ''}${avgDeltaPct.toFixed(1)}%)` +
                    ` | Uo=${result!.uniformity.toFixed(2)} (evo ${ref.uo})` +
                    ` | UGR=${result!.ugr.toFixed(1)} (evo ${ref.ugr})` +
                    ` | objetivo norma=${ref.target} lx → ${result!.avg_lux >= ref.target ? 'CONFORME' : 'no conforme'}`,
            );

            // Solo verifica que el motor produjo un resultado físico válido,
            // no que ya empate con DIALux evo — las causas #2-#4 siguen
            // pendientes. Sirve como red de regresión mínima para este fixture.
            expect(result!.avg_lux).toBeGreaterThan(0);
            expect(result!.uniformity).toBeGreaterThan(0);
            expect(result!.uniformity).toBeLessThanOrEqual(1);
        }
    });
});
