import { findBestMatchActivity } from '@/pages/dialux/hooks/normativeEngine';
import type { Fixture, LightingResult, Room } from '@/pages/dialux/hooks/useEditorStore';
import type { RequirementEvaluation } from '../domain/types';

/**
 * Extraído de `buildDialuxExportSnapshot.ts` (presupuesto de 400 líneas,
 * `__architecture__/fileSizeBudget.test.ts`) al agregar la evaluación de
 * Ra/CRI — misma responsabilidad que ya tenía ese archivo (construir
 * `RequirementEvaluation[]` para el PDF), solo separada por tamaño.
 */

/**
 * Trazabilidad de origen de los requisitos: la norma/categoría que el usuario
 * ya asignó al ambiente en el editor (ver [[dialux-normativa-fuente-unica]]),
 * no un valor inventado en el reporte.
 */
export function buildRequirementSource(room: {
    normativeStandard?: string;
    normativeLabel?: string;
    normativeCategory?: string;
}): string | undefined {
    const label = room.normativeLabel ?? room.normativeCategory;

    if (!room.normativeStandard && !label) {
        return undefined;
    }

    return [room.normativeStandard, label].filter(Boolean).join(' · ');
}

/**
 * Decide `pass`/`fail` solo cuando existe una fuente normativa citada
 * (`source`). Sin fuente, el ambiente no tiene `normativeStandard` ni
 * `normativeLabel`/`normativeCategory` asignados (ver `buildRequirementSource`),
 * así que el valor comparado no está vinculado a ninguna norma real — afirmar
 * "cumple"/"no cumple" en ese caso presentaría un juicio normativo sin
 * respaldo (hallazgo de Fase 6, planes/plan_agentes_skills_revision_normativa_dialux.md).
 * `not-evaluated` en este caso significa "sin norma configurada", no "sin
 * cálculo" — el valor calculado se sigue mostrando para no ocultar el dato.
 */
function evaluateRequirementStatus(passes: boolean, source: string | undefined): RequirementEvaluation['status'] {
    if (!source) {
        return 'not-evaluated';
    }
    return passes ? 'pass' : 'fail';
}

/**
 * Requisito de Ra/CRI de la actividad normativa asignada al ambiente, con la
 * MISMA lógica de resolución que usa el panel interactivo
 * (`NormativeCompliancePanel.tsx` → `findBestMatchActivity`) — antes de esto,
 * `buildRequirementEvaluations()` no evaluaba Ra en absoluto, así que un
 * ambiente podía mostrar "Cumple" en el PDF exportado mientras el panel
 * interactivo (que sí evalúa Ra) mostraba "No cumple" para el mismo ambiente
 * (hallazgo bloqueante, planes/plan_cierre_brecha_paridad_dialux_evo.md §-9.4).
 */
export function resolveRaRequired(room: Room): number | null {
    if (!room.normativeActivity || !room.normativeStandard) {
        return null;
    }
    return findBestMatchActivity(room.normativeStandard, room.normativeActivity, room.normativeCategory)?.ra ?? null;
}

/**
 * Peor caso de Ra/CRI entre las luminarias realmente instaladas en el
 * ambiente — basta con que una no alcance el mínimo exigido para que el
 * ambiente no cumpla. Misma fórmula que `evaluateCompliance()` en
 * `normativeEngine.ts`, para que ambos motores de evaluación no diverjan.
 */
export function resolveRaCalculated(fixtures: Fixture[]): number | null {
    const criValues = fixtures
        .map((fixture) => fixture.cri)
        .filter((cri): cri is number => typeof cri === 'number');
    return criValues.length > 0 ? Math.min(...criValues) : null;
}

/** Un recinto cumple cuando todos los requisitos que sí pudieron evaluarse pasan. */
export function requirementsComply(evaluations: RequirementEvaluation[]): boolean {
    const evaluated = evaluations.filter((evaluation) => evaluation.status !== 'not-evaluated');

    return evaluated.length > 0 && evaluated.every((evaluation) => evaluation.status === 'pass');
}

/**
 * `uniformityTarget`/`ugrLimit` en `null` significa que la actividad
 * normativa seleccionada NO regula ese parámetro (ej. UGR en
 * estacionamientos, Uo en baños — ver `normativaData.ts`) — en ese caso NO
 * se agrega ninguna fila para esa métrica (nunca se compara contra un
 * límite genérico inventado, y el PDF ni siquiera la menciona en vez de
 * mostrarla como "conforme" sin haber evaluado nada real).
 */
export function buildRequirementEvaluations(
    inputs: { illuminanceLux: number },
    uniformityTarget: number | null,
    ugrLimit: number | null,
    result: LightingResult | null,
    source: string | undefined,
    manualUgr: number | null,
    raRequired: number | null,
    raCalculated: number | null,
): RequirementEvaluation[] {
    const evaluations: RequirementEvaluation[] = [
        {
            metric: 'illuminance',
            calculatedValue: result?.avg_lux ?? null,
            operator: '>=',
            requiredValue: inputs.illuminanceLux,
            unit: 'lx',
            status: result === null
                ? 'not-evaluated'
                : evaluateRequirementStatus(result.avg_lux >= inputs.illuminanceLux, source),
            source,
        },
    ];

    if (uniformityTarget !== null) {
        evaluations.push({
            metric: 'uniformity',
            calculatedValue: result?.uniformity ?? null,
            operator: '>=',
            requiredValue: uniformityTarget,
            unit: 'ratio',
            status: result === null
                ? 'not-evaluated'
                : evaluateRequirementStatus(result.uniformity >= uniformityTarget, source),
            source,
        });
    }

    if (ugrLimit !== null) {
        // `manualUgr`: tiene prioridad sobre el calculado — cubre H/R>2
        // (todas las luminarias excluidas, ver `glareCalculation.ts`).
        // `source: 'manual'` deja declarado que no lo calculó este motor.
        const effectiveUgr = manualUgr ?? result?.ugr ?? null;
        const isManual = manualUgr !== null;
        evaluations.push({
            metric: 'ugr',
            calculatedValue: effectiveUgr,
            operator: '<=',
            requiredValue: ugrLimit,
            unit: 'UGR',
            // `ugr_not_evaluated`: sin `manualUgr`, todas las luminarias
            // quedaron excluidas (H/R>2) y `ugr: 0` no es un valor real —
            // sin este chequeo, `0 <= ugrLimit` da "Conforme" sin evaluar nada.
            status: isManual
                ? evaluateRequirementStatus(effectiveUgr !== null && effectiveUgr <= ugrLimit, 'manual')
                : result === null || result.ugr_not_evaluated
                    ? 'not-evaluated'
                    : evaluateRequirementStatus(result.ugr <= ugrLimit, source),
            source: isManual ? 'manual' : source,
        });
    }

    if (raRequired !== null) {
        evaluations.push({
            metric: 'ra',
            calculatedValue: raCalculated,
            operator: '>=',
            requiredValue: raRequired,
            unit: 'Ra',
            // `raCalculated === null`: ninguna luminaria del ambiente declara
            // CRI (ej. producto importado sin ese dato) — no hay valor real
            // que comparar, así que no se afirma "cumple" ni "no cumple".
            status: raCalculated === null
                ? 'not-evaluated'
                : evaluateRequirementStatus(raCalculated >= raRequired, source),
            source,
        });
    }

    return evaluations;
}
