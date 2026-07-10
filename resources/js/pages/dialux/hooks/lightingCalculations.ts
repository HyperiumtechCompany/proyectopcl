/**
 * lightingCalculations.ts
 *
 * Utilidades para cálculos de iluminación según EN 12464-1
 * Cálculos profesionales para cada recinto/pared/luminaria
 */

import type { Room, RoomLightingCalculation } from './types';

/**
 * Calcula el área de un polígono usando la fórmula de Shoelace
 */
export function calculatePolygonArea(
    vertices: { x: number; y: number }[],
): number {
    if (vertices.length < 3) return 0;

    let area = 0;
    const n = vertices.length;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += vertices[i].x * vertices[j].y;
        area -= vertices[j].x * vertices[i].y;
    }

    return Math.abs(area / 2);
}

/**
 * Calcula el perímetro de un polígono cerrado usando sus vértices (en metros).
 * Para una polilínea abierta (pared/pasadizo lineal), suma solo los segmentos.
 * Si se pasa `closed=true`, incluye el segmento del último al primer vértice.
 */
export function calculatePolygonPerimeter(
    vertices: { x: number; y: number }[],
    closed = true,
): number {
    if (vertices.length < 2) return 0;

    let perimeter = 0;
    const n = vertices.length;
    const segments = closed ? n : n - 1;

    for (let i = 0; i < segments; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % n];
        perimeter += Math.hypot(b.x - a.x, b.y - a.y);
    }

    return perimeter;
}

/**
 * Cálculo de lúmenes requeridos según fórmula: ((area * norma) / 0.8) / 0.99
 * donde:
 *   - area: área del recinto en m²
 *   - norma: nivel de iluminación requerido (200, 300, 500 lux)
 *   - 0.8: factor de depreciación
 *   - 0.99: factor de utilización
 */
export function calculateLumensRequired(
    areaM2: number,
    normaLux: number,
): number {
    return (areaM2 * normaLux) / 0.8 / 0.99;
}

/**
 * Calcula cantidad exacta de luminarias
 */
export function calculateExactQuantity(
    lumensRequired: number,
    fixtureLumens: number,
): number {
    if (fixtureLumens <= 0) return 0;
    return lumensRequired / fixtureLumens;
}

/**
 * Calcula cantidad redondeada de luminarias (hacia arriba)
 */
export function calculateRoundedQuantity(exactQuantity: number): number {
    return Math.ceil(exactQuantity);
}

/**
 * Estima uniformidad basada en cantidad de luminarias
 * Fórmula simplificada: uniformidad = min(1, roundedQuantity * 0.2 + 0.4)
 */
export function estimateUniformity(roundedQuantity: number): number {
    const base = Math.min(1, roundedQuantity * 0.15 + 0.5);
    return parseFloat(base.toFixed(3));
}

/**
 * Determina si la cobertura es óptima, insuficiente o excesiva
 */
export function determineCoverage(
    exactQuantity: number,
    roundedQuantity: number,
): 'optimal' | 'insufficient' | 'excessive' {
    const ratio = roundedQuantity / exactQuantity;

    if (ratio < 0.9) return 'insufficient'; // menos del 90% de lo recomendado
    if (ratio > 1.5) return 'excessive'; // más del 150% de lo recomendado
    return 'optimal'; // entre 90% y 150%
}

/**
 * Crea un cálculo completo para un recinto
 */
export function createRoomLightingCalculation(
    roomId: string,
    roomName: string,
    areaM2: number,
    normaLux: number,
    fixtureType: string,
    fixtureLumens: number,
    scaledUnit: 'mm' | 'cm' | 'm' = 'm',
    recommendedQuantity?: number,
): RoomLightingCalculation {
    const lumensRequired = calculateLumensRequired(areaM2, normaLux);
    const exactQuantity = calculateExactQuantity(lumensRequired, fixtureLumens);
    const roundedQuantity = calculateRoundedQuantity(exactQuantity);
    const uniformity = estimateUniformity(roundedQuantity);
    const coverage = determineCoverage(exactQuantity, roundedQuantity);

    return {
        id: `calc-${roomId}-${Date.now()}`,
        roomId,
        name: roomName,
        area: areaM2,
        scaledUnit,
        normaLux,
        lumensRequired: parseFloat(lumensRequired.toFixed(0)),
        fixtureType,
        fixtureLumens,
        exactQuantity: parseFloat(exactQuantity.toFixed(2)),
        roundedQuantity,
        recommendedQuantity: recommendedQuantity ?? roundedQuantity,
        uniformityEstimate: uniformity,
        coverage,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Valida que los datos sean válidos para realizar cálculos
 */
export function validateCalculationInputs(
    areaM2: number,
    normaLux: number,
    fixtureLumens: number,
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (areaM2 <= 0) {
        errors.push('El área debe ser mayor a 0 m²');
    }

    if (![200, 300, 500].includes(normaLux)) {
        errors.push('La norma debe ser 200, 300 o 500 lux');
    }

    if (fixtureLumens <= 0) {
        errors.push('Los lúmenes de la luminaria deben ser mayor a 0');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Formatea un resultado de cálculo para presentación profesional
 */
export function formatCalculationResult(calc: RoomLightingCalculation): string {
    return `
═══════════════════════════════════════════
📊 CÁLCULO DE ILUMINACIÓN: ${calc.name.toUpperCase()}
═══════════════════════════════════════════

📐 DATOS DEL RECINTO:
  • Área: ${calc.area.toFixed(2)} m²
  • Norma (EN 12464-1): ${calc.normaLux} lux

💡 LUMINARIA SELECCIONADA:
  • Tipo: ${calc.fixtureType}
  • Lúmenes: ${calc.fixtureLumens.toLocaleString('es-PE')} lm

🔢 CÁLCULOS:
  Fórmula: ((Área × Norma) / 0.8) / 0.99
  
  • Lúmenes Requeridos: ${calc.lumensRequired.toLocaleString('es-PE')} lm
  • Cantidad Exacta: ${calc.exactQuantity.toFixed(2)} luminarias
  • Cantidad Redondeada: ${calc.roundedQuantity} luminarias
  • Cobertura: ${calc.coverage === 'optimal' ? '✅ ÓPTIMA' : calc.coverage === 'insufficient' ? '⚠️ INSUFICIENTE' : '⚠️ EXCESIVA'}

👤 DECISIÓN DEL USUARIO:
  • Cantidad Recomendada: ${calc.recommendedQuantity} luminarias
  • Uniformidad Estimada: ${(calc.uniformityEstimate! * 100).toFixed(1)}%

═══════════════════════════════════════════
`;
}
