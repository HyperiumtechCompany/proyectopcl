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
 * Índice del local (k) del método de los lúmenes: k = (L·W) / (Hm·(L+W)).
 * A menor k, más "estrecho/alto" el recinto y menor la fracción de flujo
 * que llega al plano de trabajo tras las reflexiones en techo/paredes.
 */
export function calculateRoomIndex(
    length: number,
    width: number,
    mountingHeight: number,
): number {
    if (length <= 0 || width <= 0 || mountingHeight <= 0) {
        return 0;
    }
    return (length * width) / (mountingHeight * (length + width));
}

/** Reflectancias de referencia (techo 70% / pared 50% / piso 20%) usadas como base de comparación. */
const REFERENCE_WEIGHTED_REFLECTANCE = 0.5 * 0.7 + 0.3 * 0.5 + 0.2 * 0.2;

/**
 * Tabla de factor de utilización (UF) por índice de local `k`, para una luminaria
 * directa de distribución media-ancha (el caso típico de paneles LED/downlights de
 * la mayoría del catálogo) con reflectancias de referencia 70/50/20. Son los valores
 * publicados en tablas de UF de manuales de alumbrado (CIBSE/IESNA) para ese tipo de
 * luminaria — a diferencia de una curva de saturación inventada, esto reproduce los
 * factores de utilización reales que usa un software certificado (DIALux) a partir
 * de la fotometría del fabricante, evitando pedir muchas más luminarias de la cuenta.
 */
const UF_TABLE: Array<[k: number, uf: number]> = [
    [0.6, 0.43],
    [0.8, 0.51],
    [1.0, 0.57],
    [1.25, 0.62],
    [1.5, 0.66],
    [2.0, 0.71],
    [2.5, 0.75],
    [3.0, 0.77],
    [4.0, 0.8],
    [5.0, 0.82],
];

function lookupBaseUtilization(roomIndex: number): number {
    const [firstK, firstUf] = UF_TABLE[0];
    if (roomIndex <= firstK) {
        // Por debajo del rango tabulado, extrapola linealmente hacia un mínimo
        // razonable en vez de cortar en seco en el primer valor de la tabla.
        const slope = (UF_TABLE[1][1] - firstUf) / (UF_TABLE[1][0] - firstK);
        return Math.max(0.2, firstUf + slope * (roomIndex - firstK));
    }

    const [lastK, lastUf] = UF_TABLE[UF_TABLE.length - 1];
    if (roomIndex >= lastK) {
        return Math.min(0.88, lastUf);
    }

    for (let i = 0; i < UF_TABLE.length - 1; i++) {
        const [k0, uf0] = UF_TABLE[i];
        const [k1, uf1] = UF_TABLE[i + 1];
        if (roomIndex >= k0 && roomIndex <= k1) {
            const t = (roomIndex - k0) / (k1 - k0);
            return uf0 + (uf1 - uf0) * t;
        }
    }

    return lastUf;
}

/**
 * Estima el factor de utilización (fracción del flujo emitido que llega al plano de
 * trabajo) a partir del índice del local y las reflectancias de las superficies,
 * interpolando la tabla de UF (`UF_TABLE`) y ajustando por reflectancia media
 * ponderada. No sustituye la tabla de utilización específica del fabricante de la
 * luminaria si está disponible (ver `lightingEngineCore.ts` para el cálculo punto a
 * punto con la fotometría real IES/LDT).
 */
export function estimateUtilizationFactor(
    roomIndex: number,
    reflectances?: { ceiling: number; wall: number; floor: number },
): number {
    if (roomIndex <= 0) {
        return 0.4;
    }

    const baseUtilization = lookupBaseUtilization(roomIndex);
    const weightedReflectance = reflectances
        ? 0.5 * reflectances.ceiling + 0.3 * reflectances.wall + 0.2 * reflectances.floor
        : REFERENCE_WEIGHTED_REFLECTANCE;
    const reflectanceFactor =
        0.85 + (0.15 * weightedReflectance) / REFERENCE_WEIGHTED_REFLECTANCE;

    return Number(
        Math.min(0.9, Math.max(0.15, baseUtilization * reflectanceFactor)).toFixed(3),
    );
}

/**
 * Cálculo de lúmenes requeridos (método de los lúmenes): (area * norma) / Fm / UF
 *   - area: área del recinto en m²
 *   - norma: nivel de iluminancia requerido en lux
 *   - Fm: factor de mantenimiento (depreciación por suciedad/envejecimiento), 0.8 por defecto
 *   - UF: factor de utilización — dinámico según índice de local y reflectancias si se
 *     provee `roomIndex`; si no hay geometría de sala disponible (ej. cálculo de pared),
 *     se mantiene el valor de referencia 0.99 usado históricamente.
 */
export function calculateLumensRequired(
    areaM2: number,
    normaLux: number,
    options?: {
        roomIndex?: number;
        reflectances?: { ceiling: number; wall: number; floor: number };
        maintenanceFactor?: number;
    },
): number {
    const maintenanceFactor = options?.maintenanceFactor ?? 0.8;
    const utilizationFactor = options?.roomIndex
        ? estimateUtilizationFactor(options.roomIndex, options.reflectances)
        : 0.99;

    return (areaM2 * normaLux) / maintenanceFactor / utilizationFactor;
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
