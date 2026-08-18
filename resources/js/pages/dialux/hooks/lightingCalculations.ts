/**
 * lightingCalculations.ts
 *
 * Utilidades para cálculos de iluminación según EN 12464-1
 * Cálculos profesionales para cada recinto/pared/luminaria
 */

import { polygonAreaM2 } from '@/pages/dialux/geometry/polygonGeometry';
import type { Room, RoomLightingCalculation } from './types';

/**
 * Calcula el área de un polígono usando la fórmula de Shoelace.
 * Delegado a la fuente única de geometría (geometry/polygonGeometry).
 */
export function calculatePolygonArea(
    vertices: { x: number; y: number }[],
): number {
    return polygonAreaM2(vertices);
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
 * Cálculo de lúmenes requeridos: `((área × norma) / Fm) × Fu` — fórmula
 * indicada TAL CUAL por el ingeniero supervisor del proyecto (Fm=Fu=0.8 por
 * defecto), confirmada explícitamente por el usuario 2026-08-07 tras
 * mostrarle que, con Fm=Fu, esto matemáticamente equivale a `área × norma`
 * sin ningún factor de pérdida real (÷k×k se cancela) — decisión consciente,
 * no un error de transcripción. NO "corregir" a `/Fm/Fu` (método de lúmenes
 * clásico): ya se probó esa lectura antes en este mismo proyecto y se
 * descartó a favor de esta.
 *   - area: área del recinto en m²
 *   - norma: nivel de iluminancia requerido en lux
 *   - Fm: factor de mantenimiento, 0.8 por defecto
 *   - Fu: factor de utilización, 0.8 por defecto
 */
export function calculateLumensRequired(
    areaM2: number,
    normaLux: number,
    options?: {
        maintenanceFactor?: number;
        utilizationFactor?: number;
    },
): number {
    const maintenanceFactor = options?.maintenanceFactor ?? 0.8;
    const utilizationFactor = options?.utilizationFactor ?? 0.8;

    return ((areaM2 * normaLux) / maintenanceFactor) * utilizationFactor;
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
    normaRa?: number | null,
    fixtureRa?: number | null,
): RoomLightingCalculation {
    const lumensRequired = calculateLumensRequired(areaM2, normaLux);
    const exactQuantity = calculateExactQuantity(lumensRequired, fixtureLumens);
    const roundedQuantity = calculateRoundedQuantity(exactQuantity);
    const uniformity = estimateUniformity(roundedQuantity);
    const coverage = determineCoverage(exactQuantity, roundedQuantity);

    let meetsRa: boolean | undefined = undefined;
    if (normaRa != null && fixtureRa != null) {
        meetsRa = fixtureRa >= normaRa;
    }

    return {
        id: `calc-${roomId}-${Date.now()}`,
        roomId,
        name: roomName,
        area: areaM2,
        scaledUnit,
        normaLux,
        normaRa,
        fixtureRa,
        meetsRa,
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

    if (normaLux <= 0) {
        errors.push('La norma de iluminancia debe ser mayor a 0 lux');
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
    const raText = calc.meetsRa === true 
        ? `✅ CUMPLE (Req: ${calc.normaRa}, Lum: ${calc.fixtureRa})` 
        : calc.meetsRa === false 
        ? `❌ NO CUMPLE - ALERTA (Req: ${calc.normaRa}, Lum: ${calc.fixtureRa})`
        : 'N/A';

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
  Fórmula: ((Área × Norma) / 0.8) × 0.8
  
  • Lúmenes Requeridos: ${calc.lumensRequired.toLocaleString('es-PE')} lm
  • Cantidad Exacta: ${calc.exactQuantity.toFixed(2)} luminarias
  • Cantidad Redondeada: ${calc.roundedQuantity} luminarias
  • Cobertura: ${calc.coverage === 'optimal' ? '✅ ÓPTIMA' : calc.coverage === 'insufficient' ? '⚠️ INSUFICIENTE' : '⚠️ EXCESIVA'}

👤 DECISIÓN DEL USUARIO:
  • Cantidad Recomendada: ${calc.recommendedQuantity} luminarias
  • Uniformidad Estimada: ${(calc.uniformityEstimate! * 100).toFixed(1)}%
  • Validación Color (Ra): ${raText}

═══════════════════════════════════════════
`;
}
