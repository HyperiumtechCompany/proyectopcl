import { roomBBox } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Room } from '@/pages/dialux/hooks/types';

/**
 * Heurística de selección automática de modo de interreflexión por forma de
 * ambiente ("Ronda 21i" — pedido explícito del usuario: no quiere configurar
 * el modo ambiente por ambiente porque el sistema maneja demasiados tipos de
 * recinto/proyecto distintos como para hacerlo a mano).
 *
 * Evidencia (`planes/plan_cierre_brecha_paridad_dialux_evo.md`, múltiples
 * rondas con el oráculo Radiance y con datos reales de DIALux evo):
 *   - Ambientes elongados (aspecto bounding-box ≥ ~2.3:1) favorecen
 *     `first-bounce`: `sshh-vs-bano` (2.3:1) y `long-corridor` (5:1).
 *   - Ambientes compactos/casi cuadrados (aspecto ≤ ~1.5:1) favorecen
 *     `iterative`: `caseta-vs-guarderias`, `large-square`, `small-dark-square`,
 *     y las 3 formas irregulares compactas de la Ronda 19
 *     (l-shape/chamfered-pentagon/trapezoid, aspecto ~1:1-1.5:1).
 *
 * El propio plan marca este patrón como "todavía una hipótesis, no una
 * regla — pocos casos" y NUNCA cambió el default de producción por eso. El
 * usuario, informado de ese riesgo, pidió automatizarlo igual porque un
 * override manual por ambiente no es viable con la variedad de proyectos
 * reales del sistema. El umbral de 2.0 se eligió a propósito EN EL MEDIO del
 * hueco documentado (1.5:1 favorece iterative, 2.3:1 favorece first-bounce) —
 * nunca dentro del rango de ninguno de los casos medidos.
 *
 * Verificado contra el proyecto real "Módulo 22" (`modulo22ProjectFixture.ts`,
 * el mismo que usa `modulo22GoldenCase.test.ts`): con este umbral, "SS.HH"
 * (aspecto 2.40:1, el caso documentado con +43%/+37% de sobreestimación al
 * forzar `iterative`) cae del lado correcto (`first-bounce`), y "Caseta de
 * Control" (aspecto 1.12:1, compacto) cae en `iterative`.
 */
export const AUTO_INTERREFLECTION_ASPECT_THRESHOLD = 2.0;

export interface AutoInterreflectionDecision {
    mode: 'first-bounce' | 'iterative';
    aspectRatio: number;
}

/**
 * Decide el modo de interreflexión para UN ambiente según la relación de
 * aspecto de su bounding box (misma convención que `getRoomMarginalZone`,
 * `hooks/roomLighting.ts` — mayor dimensión / menor dimensión).
 */
export function resolveAutoInterreflectionMode(room: Room): AutoInterreflectionDecision {
    const { width, length } = roomBBox(room);
    const longer = Math.max(width, length);
    const shorter = Math.min(width, length);
    const aspectRatio = shorter > 0 ? longer / shorter : Number.POSITIVE_INFINITY;

    return {
        mode: aspectRatio < AUTO_INTERREFLECTION_ASPECT_THRESHOLD ? 'iterative' : 'first-bounce',
        aspectRatio,
    };
}
