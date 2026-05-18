/**
 * stairNorms.ts — Presets normativos de escaleras para el editor DIAlux
 *
 * Normativas aplicadas:
 *   RNE A.010 (Condiciones Generales de Diseño — Vivienda)
 *   RNE A.040 (Educación)
 *   RNE A.050 (Salud)
 *   RNE A.060 (Industria)
 *
 * Fuente: Reglamento Nacional de Edificaciones, Capítulo V
 * (artículos 25-29 para escaleras interiores).
 */

import type { StairConfig, StairFlight } from './types';

// ─── Tipos auxiliares ──────────────────────────────────────────────────────────

export type StairNormativeUse = 'education' | 'housing' | 'health' | 'industry' | 'generic';

export interface StairPreset {
    /** Clave identificadora del preset */
    use: StairNormativeUse;
    /** Etiqueta para mostrar al usuario */
    label: string;
    /** Norma RNE de referencia */
    normReference: string;
    /** Contrahuella máxima recomendada (metros) */
    maxRiserHeight: number;
    /** Contrahuella mínima recomendada (metros) */
    minRiserHeight: number;
    /** Huella mínima recomendada (metros) */
    minTreadDepth: number;
    /** Ancho mínimo de escalera (metros) */
    minStairWidth: number;
    /** Profundidad de descanso mínima (metros) */
    minLandingDepth: number;
    /** Número de escalones máximo antes de requerir descanso */
    maxStepsBeforeLanding: number;
    /** Contrahuella recomendada por defecto para este uso */
    recommendedRiserHeight: number;
    /** Huella recomendada por defecto para este uso */
    recommendedTreadDepth: number;
    /** Ancho recomendado por defecto para este uso */
    recommendedStairWidth: number;
    /** Escalones recomendados por tramo (antes del descanso) */
    recommendedStepsPerFlight: number;
    /** Notas normativas para mostrar al usuario */
    notes: string[];
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const STAIR_PRESETS: Record<StairNormativeUse, StairPreset> = {
    education: {
        use: 'education',
        label: 'Educación (RNE A.040)',
        normReference: 'RNE A.040 Art. 13-14',
        maxRiserHeight: 0.170,
        minRiserHeight: 0.150,
        minTreadDepth: 0.300,
        minStairWidth: 1.200,
        minLandingDepth: 1.200,
        maxStepsBeforeLanding: 16,
        recommendedRiserHeight: 0.165,
        recommendedTreadDepth: 0.300,
        recommendedStairWidth: 1.500,
        recommendedStepsPerFlight: 8,
        notes: [
            'RNE A.040: contrahuella máx. 0.17m, huella mín. 0.30m',
            'Ancho libre mínimo 1.20m (colegios)',
            'Máximo 16 escalones entre descansos',
            'Descanso mínimo de ancho = ancho de escalera',
        ],
    },
    housing: {
        use: 'housing',
        label: 'Vivienda (RNE A.010)',
        normReference: 'RNE A.010 Art. 25-26',
        maxRiserHeight: 0.175,
        minRiserHeight: 0.150,
        minTreadDepth: 0.280,
        minStairWidth: 0.900,
        minLandingDepth: 0.900,
        maxStepsBeforeLanding: 18,
        recommendedRiserHeight: 0.175,
        recommendedTreadDepth: 0.280,
        recommendedStairWidth: 1.000,
        recommendedStepsPerFlight: 9,
        notes: [
            'RNE A.010: contrahuella máx. 0.175m, huella mín. 0.28m',
            'Ancho libre mínimo 0.90m (vivienda unifamiliar)',
            'Fórmula de Blondel: 2h + a = 0.60-0.64m',
        ],
    },
    health: {
        use: 'health',
        label: 'Salud (RNE A.050)',
        normReference: 'RNE A.050 Art. 21',
        maxRiserHeight: 0.160,
        minRiserHeight: 0.130,
        minTreadDepth: 0.300,
        minStairWidth: 1.800,
        minLandingDepth: 1.800,
        maxStepsBeforeLanding: 12,
        recommendedRiserHeight: 0.150,
        recommendedTreadDepth: 0.300,
        recommendedStairWidth: 1.800,
        recommendedStepsPerFlight: 8,
        notes: [
            'RNE A.050: contrahuella máx. 0.16m para uso hospitalario',
            'Ancho mínimo 1.80m para circulación de camillas',
            'Escaleras de evacuación: ancho libre mín. 1.20m',
        ],
    },
    industry: {
        use: 'industry',
        label: 'Industrial (RNE A.060)',
        normReference: 'RNE A.060 Art. 14',
        maxRiserHeight: 0.175,
        minRiserHeight: 0.150,
        minTreadDepth: 0.280,
        minStairWidth: 1.000,
        minLandingDepth: 1.200,
        maxStepsBeforeLanding: 18,
        recommendedRiserHeight: 0.175,
        recommendedTreadDepth: 0.280,
        recommendedStairWidth: 1.200,
        recommendedStepsPerFlight: 9,
        notes: [
            'RNE A.060: mismos parámetros que A.010 para uso general',
            'Ancho mínimo 1.00m para tránsito de personal',
        ],
    },
    generic: {
        use: 'generic',
        label: 'Genérico',
        normReference: 'Sin norma específica',
        maxRiserHeight: 0.200,
        minRiserHeight: 0.100,
        minTreadDepth: 0.250,
        minStairWidth: 0.600,
        minLandingDepth: 0.900,
        maxStepsBeforeLanding: 20,
        recommendedRiserHeight: 0.175,
        recommendedTreadDepth: 0.280,
        recommendedStairWidth: 1.000,
        recommendedStepsPerFlight: 10,
        notes: ['Sin restricciones normativas específicas.'],
    },
};

// ─── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve el preset normativo para el uso indicado.
 */
export function getStairPreset(use: StairNormativeUse): StairPreset {
    return STAIR_PRESETS[use] ?? STAIR_PRESETS.generic;
}

/**
 * Devuelve todos los presets disponibles (para poblar un selector).
 */
export function getAllStairPresets(): StairPreset[] {
    return Object.values(STAIR_PRESETS);
}

/**
 * Genera una configuración de escalera por defecto según el uso normativo.
 * Produce una escalera con descanso de dos tramos (típico en colegios y
 * edificios de uso general con piso-a-piso de 3.0m).
 *
 * @param use        Uso normativo (education, housing, etc.)
 * @param floorHeight Altura libre piso-a-techo en metros (default 3.0)
 */
export function buildDefaultStairConfig(
    use: StairNormativeUse = 'housing',
    floorHeight: number = 3.0,
): StairConfig {
    const preset = getStairPreset(use);

    const totalSteps = Math.round(floorHeight / preset.recommendedRiserHeight);
    const stepsPerFlight = Math.min(
        preset.recommendedStepsPerFlight,
        Math.ceil(totalSteps / 2),
    );
    const remainingSteps = totalSteps - stepsPerFlight;

    const isSingleFlight = totalSteps <= preset.maxStepsBeforeLanding;

    const flights: StairFlight[] = isSingleFlight
        ? [
              {
                  id: crypto.randomUUID(),
                  stepCount: totalSteps,
                  direction: 'south',
                  hasLanding: false,
                  landingDepth: 0,
              },
          ]
        : [
              {
                  id: crypto.randomUUID(),
                  stepCount: stepsPerFlight,
                  direction: 'south',
                  hasLanding: true,
                  landingDepth: preset.minLandingDepth,
              },
              {
                  id: crypto.randomUUID(),
                  stepCount: remainingSteps,
                  direction: 'north',
                  hasLanding: false,
                  landingDepth: 0,
              },
          ];

    return {
        normativeUse: use === 'health' || use === 'industry' ? 'generic' : use,
        orientation: 'south',
        riserHeight: preset.recommendedRiserHeight,
        treadDepth: preset.recommendedTreadDepth,
        stairWidth: preset.recommendedStairWidth,
        stepCount: totalSteps,
        flights,
    };
}

/**
 * Valida una configuración de escalera contra la norma.
 * Devuelve un array de mensajes de advertencia (vacío si todo está bien).
 */
export function validateStairConfig(
    config: StairConfig,
    use: StairNormativeUse = 'housing',
): string[] {
    const preset = getStairPreset(use);
    const warnings: string[] = [];

    if (config.riserHeight > preset.maxRiserHeight) {
        warnings.push(
            `Contrahuella ${(config.riserHeight * 100).toFixed(1)}cm supera el máximo de ${(preset.maxRiserHeight * 100).toFixed(1)}cm (${preset.normReference})`,
        );
    }

    if (config.riserHeight < preset.minRiserHeight) {
        warnings.push(
            `Contrahuella ${(config.riserHeight * 100).toFixed(1)}cm es menor al mínimo de ${(preset.minRiserHeight * 100).toFixed(1)}cm`,
        );
    }

    if (config.treadDepth < preset.minTreadDepth) {
        warnings.push(
            `Huella ${(config.treadDepth * 100).toFixed(1)}cm es menor al mínimo de ${(preset.minTreadDepth * 100).toFixed(1)}cm (${preset.normReference})`,
        );
    }

    if (config.stairWidth < preset.minStairWidth) {
        warnings.push(
            `Ancho ${(config.stairWidth * 100).toFixed(0)}cm es menor al mínimo de ${(preset.minStairWidth * 100).toFixed(0)}cm (${preset.normReference})`,
        );
    }

    config.flights.forEach((flight, idx) => {
        if (flight.stepCount > preset.maxStepsBeforeLanding) {
            warnings.push(
                `Tramo ${idx + 1}: ${flight.stepCount} escalones supera el máximo de ${preset.maxStepsBeforeLanding} sin descanso`,
            );
        }

        if (flight.hasLanding && flight.landingDepth < preset.minLandingDepth) {
            warnings.push(
                `Tramo ${idx + 1}: descanso de ${(flight.landingDepth * 100).toFixed(0)}cm es menor al mínimo de ${(preset.minLandingDepth * 100).toFixed(0)}cm`,
            );
        }
    });

    // Fórmula de Blondel (confort ergonómico): 2h + a debe estar entre 60 y 64 cm
    const blondel = 2 * config.riserHeight + config.treadDepth;
    if (blondel < 0.60 || blondel > 0.64) {
        warnings.push(
            `Fórmula de Blondel: 2h+a = ${(blondel * 100).toFixed(1)}cm (recomendado 60-64cm)`,
        );
    }

    return warnings;
}
