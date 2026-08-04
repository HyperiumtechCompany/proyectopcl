/**
 * Fase 14 del plan maestro ("Emergencia", §11). Evalúa un ambiente marcado
 * como `roomType: 'evacuation-route' | 'antipanic-area'` contra las normas
 * de alumbrado de emergencia aplicables — SIEMPRE por separado, nunca
 * fusionadas en un solo número (a diferencia de `findMostStrictNorm` en
 * `hooks/normativeEngine.ts`, que sí fusiona para el alumbrado normal).
 *
 * Verificado con el agente `chief-electrical-engineer-reviewer` antes de
 * implementar (`planes/fase14_progreso_dialux.md`):
 *   - RNE A.130 (D.S. N°017-2012-VIVIENDA), Art. 40: 10 lx, OBLIGATORIA en
 *     Perú, para medios de evacuación. No define áreas antipánico.
 *   - EN 1838:2013, Cap. de rutas de evacuación/áreas antipánico: 1 lx
 *     (eje ≤2m) / 0.5 lx (núcleo antipánico) — SOLO referencia
 *     internacional, sin adopción legal en Perú.
 *
 * Se evalúa contra `min_lux` (el punto más oscuro), no `avg_lux`: un
 * requisito de emergencia es un mínimo garantizado en todo punto de la
 * ruta/área, no un promedio — coincide con el "punto crítico" que
 * `findResultExtremum(result, 'min')` (Fase 11) ya sabe localizar.
 */

export type EmergencyStandardId = 'rne_a130' | 'en_1838';

export interface EmergencyRequirementEvaluation {
    standard: EmergencyStandardId;
    /** Cita completa de la norma/artículo — nunca se afirma cumplimiento sin esto. */
    source: string;
    /** `true` = exigible legalmente en Perú (RNE A.130). `false` = referencia de buena práctica (EN 1838). */
    mandatory: boolean;
    metric: 'illuminance';
    requiredLux: number;
    /** `null` cuando el ambiente todavía no tiene resultado calculado. */
    calculatedLux: number | null;
    status: 'pass' | 'fail' | 'not-evaluated';
}

const A130_EVACUATION_ROUTE_LUX = 10; // RNE A.130 Art. 40 — obligatorio en Perú.
const EN1838_EVACUATION_ROUTE_LUX = 1; // EN 1838:2013, eje ≤2m — referencia.
const EN1838_ANTIPANIC_AREA_LUX = 0.5; // EN 1838:2013, núcleo del área — referencia; A.130 no tiene equivalente.

const A130_SOURCE = 'RNE A.130 (D.S. N°017-2012-VIVIENDA), Art. 40';
const EN1838_SOURCE = 'EN 1838:2013 (referencia internacional, sin adopción legal en Perú)';

function buildEvaluation(
    standard: EmergencyStandardId,
    source: string,
    mandatory: boolean,
    requiredLux: number,
    calculatedLux: number | null,
): EmergencyRequirementEvaluation {
    return {
        standard,
        source,
        mandatory,
        metric: 'illuminance',
        requiredLux,
        calculatedLux,
        status: calculatedLux === null ? 'not-evaluated' : calculatedLux >= requiredLux ? 'pass' : 'fail',
    };
}

/**
 * `minLux`: el punto más oscuro de la malla del ambiente (`LightingResult.min_lux`,
 * calculado con `config.emergencyMode: true` — ver `runDirectPreviewEngine.ts`).
 * `null` cuando el ambiente aún no tiene un `CalculationRun` de emergencia.
 */
export function evaluateEmergencyCompliance(
    roomType: 'evacuation-route' | 'antipanic-area',
    minLux: number | null,
): EmergencyRequirementEvaluation[] {
    if (roomType === 'evacuation-route') {
        return [
            buildEvaluation('rne_a130', A130_SOURCE, true, A130_EVACUATION_ROUTE_LUX, minLux),
            buildEvaluation('en_1838', EN1838_SOURCE, false, EN1838_EVACUATION_ROUTE_LUX, minLux),
        ];
    }

    // 'antipanic-area': RNE A.130 no define esta categoría (verificado por
    // texto completo del documento oficial) — se documenta la ausencia, no
    // se inventa un mínimo peruano equivalente.
    return [buildEvaluation('en_1838', EN1838_SOURCE, false, EN1838_ANTIPANIC_AREA_LUX, minLux)];
}
