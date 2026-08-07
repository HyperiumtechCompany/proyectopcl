import { describe, expect, it } from 'vitest';
import { buildGradientProject } from './__fixtures__/gradientProjectFixture';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from './types';

/**
 * `excludeMarginalZoneFromStats` (`hooks/marginalZoneFilter.ts`): excluye la
 * franja de borde del recinto del promedio/min/max/uniformidad reales — la
 * zona marginal ya se calculaba, pero hasta esta bandera solo se reportaba,
 * nunca afectaba el cálculo. Archivo dedicado (mismo criterio que
 * `runDirectPreviewEngine.adaptiveMesh.test.ts`) para no volver a chocar con
 * el presupuesto de tamaño del archivo principal de test.
 *
 * Con el espaciado de malla FIJO por defecto (0.5 m), el punto más cercano
 * a una pared ya está a 0.25 m de distancia — más lejos que el margen
 * heurístico típico (máx. 0.2 m) — así que la exclusión es un no-op sin
 * malla adaptativa. Esto es esperado, no un bug: en producción
 * (`EditorLayout.tsx`) esta bandera SIEMPRE se activa junto con
 * `meshPolicy.adaptive`, que produce mallas más finas donde hay gradiente,
 * así que los tests de esta bandera combinan ambas, igual que en producción.
 */
describe('runDirectPreviewEngine — excludeMarginalZoneFromStats', () => {
    it('sin la bandera, el resultado es idéntico al de siempre', async () => {
        const snapshot = buildCalculationSnapshot(buildGradientProject());

        const withoutFlag = await runDirectPreviewEngine(snapshot);
        const withFalseFlag = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            excludeMarginalZoneFromStats: false,
        });

        expect(withFalseFlag.surfaces[0]!.result).toEqual(withoutFlag.surfaces[0]!.result);
    });

    it('combinada con malla adaptativa (uso real de producción), avg/min cambian y la malla completa no se filtra', async () => {
        const snapshot = buildCalculationSnapshot(buildGradientProject());
        const adaptiveConfig = {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            meshPolicy: { ...DEFAULT_DIRECT_PREVIEW_CONFIG.meshPolicy, adaptive: true },
        };

        const withoutExclusion = await runDirectPreviewEngine(snapshot, adaptiveConfig);
        const withExclusion = await runDirectPreviewEngine(snapshot, {
            ...adaptiveConfig,
            excludeMarginalZoneFromStats: true,
        });

        const before = withoutExclusion.surfaces[0]!.result;
        const after = withExclusion.surfaces[0]!.result;

        expect(after.avg_lux).not.toBeCloseTo(before.avg_lux, 6);
        // La malla completa (isolux/contornos) NO se filtra — mismo tamaño
        // de grilla, mismos grid_values, con o sin la bandera.
        expect(after.grid_cols).toBe(before.grid_cols);
        expect(after.grid_rows).toBe(before.grid_rows);
        expect(after.grid_values).toEqual(before.grid_values);
    });

    it('recinto tan chico que la zona marginal lo cubre entero: cae al cálculo sin excluir (nunca un promedio "sin puntos")', async () => {
        const project = buildGradientProject();
        // Encoge el único recinto a un cuadrado de 0.3x0.3 m — con la zona
        // marginal por defecto (heurística ~0.15 m para recintos así de
        // chicos) más una malla adaptativa fina, el margen podría cubrir
        // toda la malla si no hubiera respaldo.
        const room = project.scenes[0]!.rooms[0]!;
        room.vertices = [
            { x: 0, y: 0 },
            { x: 0.3, y: 0 },
            { x: 0.3, y: 0.3 },
            { x: 0, y: 0.3 },
        ];
        // Reubica la luminaria sobre el recinto encogido — si no, "sin luz
        // llega ahí" (avg=0, legítimo) se confundiría con el bug que este
        // test busca prevenir (array vacío -> NaN).
        project.scenes[0]!.fixtures[0]!.x = 0.15;
        project.scenes[0]!.fixtures[0]!.y = 0.15;
        const snapshot = buildCalculationSnapshot(project);

        const run = await runDirectPreviewEngine(snapshot, {
            ...DEFAULT_DIRECT_PREVIEW_CONFIG,
            meshPolicy: { ...DEFAULT_DIRECT_PREVIEW_CONFIG.meshPolicy, adaptive: true },
            excludeMarginalZoneFromStats: true,
        });

        expect(Number.isFinite(run.surfaces[0]!.result.avg_lux)).toBe(true);
        expect(run.surfaces[0]!.result.avg_lux).toBeGreaterThan(0);
    });
});
