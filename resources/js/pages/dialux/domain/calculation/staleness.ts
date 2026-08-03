import type { Project } from '@/pages/dialux/hooks/types';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { hashCalculationSnapshot } from './hashSnapshot';
import type { CalculationRun } from './types';

/**
 * Invalidación por comparación, no por evento empujado (ADR 0002, punto 6):
 * un `CalculationRun` no se marca `stale` activamente cuando el usuario edita
 * algo — en su lugar, cualquier consumidor que vaya a MOSTRAR un run
 * pregunta "¿el snapshot actual del proyecto sigue siendo el que produjo
 * este resultado?". Evita mantener listeners de invalidación dispersos por
 * el store (riesgo real de olvidar uno al agregar un campo nuevo).
 */
export async function isCalculationRunStale(run: CalculationRun, currentProject: Project): Promise<boolean> {
    const currentSnapshot = buildCalculationSnapshot(currentProject);
    const currentHash = await hashCalculationSnapshot(currentSnapshot);
    return currentHash !== run.snapshotHash;
}

/** Variante para cuando el snapshot actual ya se construyó (evita reconstruirlo dos veces). */
export async function isCalculationRunStaleForSnapshotHash(
    run: CalculationRun,
    currentSnapshotHash: string,
): Promise<boolean> {
    return currentSnapshotHash !== run.snapshotHash;
}
