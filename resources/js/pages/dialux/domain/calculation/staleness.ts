import type { Project } from '@/pages/dialux/hooks/types';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { hashCalculationSnapshot } from './hashSnapshot';
import { buildProductionCalculationConfig } from './productionCalculationConfig';
import type { CalculationRun } from './types';

/**
 * Invalidación por comparación, no por evento empujado (ADR 0002, punto 6):
 * un `CalculationRun` no se marca `stale` activamente cuando el usuario edita
 * algo — en su lugar, cualquier consumidor que vaya a MOSTRAR un run
 * pregunta "¿el snapshot actual del proyecto sigue siendo el que produjo
 * este resultado?". Evita mantener listeners de invalidación dispersos por
 * el store (riesgo real de olvidar uno al agregar un campo nuevo).
 *
 * Hasta esta fase, esa pregunta SOLO comparaba el hash del snapshot (datos
 * del proyecto: geometría, luminarias, materiales) — un `CalculationRun`
 * calculado con una `CalculationConfig` vieja (p.ej. antes de un cambio a
 * `buildProductionCalculationConfig`, como `interreflection` o el default de
 * malla adaptativa) se seguía reportando "no stale" mientras el PROYECTO no
 * cambiara, así que un usuario podía quedarse viendo un resultado calculado
 * con lógica vieja hasta forzar un recálculo manual — reportado como "cada
 * cambio que hacemos... volvemos a un cálculo antiguo". Ahora también se
 * compara `run.config` (ya viene guardado en cada `CalculationRun`) contra
 * la config que produciría HOY `buildProductionCalculationConfig` para este
 * proyecto — cualquier cambio de config real invalida el run cacheado sin
 * necesidad de recargar la página. Esto NO cubre un cambio de fórmula que
 * deje `CalculationConfig` bit-a-bit igual (ver `LIGHTING_ENGINE_VERSION` en
 * `hooks/lightingEngineCore.ts` para ese caso — bumpearla fuerza recálculo
 * global, pero requiere que quien toque el motor recuerde hacerlo).
 */
export async function isCalculationRunStale(run: CalculationRun, currentProject: Project): Promise<boolean> {
    const currentSnapshot = buildCalculationSnapshot(currentProject);
    const currentHash = await hashCalculationSnapshot(currentSnapshot);
    if (currentHash !== run.snapshotHash) {
        return true;
    }

    const currentConfig = buildProductionCalculationConfig(currentProject);
    return JSON.stringify(run.config) !== JSON.stringify(currentConfig);
}

/** Variante para cuando el snapshot actual ya se construyó (evita reconstruirlo dos veces). */
export async function isCalculationRunStaleForSnapshotHash(
    run: CalculationRun,
    currentSnapshotHash: string,
): Promise<boolean> {
    return currentSnapshotHash !== run.snapshotHash;
}
