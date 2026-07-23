/**
 * Fórmulas puras del motor de cálculo eléctrico DIALux.
 *
 * Todas las funciones son deterministas, sin efectos secundarios y sin
 * dependencias externas. Ante datos inválidos (negativos, cero donde no
 * corresponde, división entre cero, valores faltantes) NUNCA retornan
 * NaN/Infinity: devuelven 0 y dejan que el llamador agregue el warning
 * correspondiente (o lo agregan aquí cuando la firma lo permite).
 */

import type { ComplianceStatus, ConductorCatalog, OutletRule } from './types';

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Resistividad eléctrica en Ω·mm²/m a temperatura de operación. */
export const RESISTIVITY: Record<'cobre' | 'aluminio', number> = {
    cobre: 0.0175,
    aluminio: 0.0286,
};

/** Escala estándar de interruptores termomagnéticos (A). */
export const BREAKER_SCALE = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250] as const;

// ─── Guardas numéricas ───────────────────────────────────────────────────────

/** true si el valor es un número finito estrictamente mayor que 0. */
export function isPositive(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** true si el valor es un número finito mayor o igual que 0. */
export function isNonNegative(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Devuelve el número si es finito; 0 en caso contrario (nunca NaN/Infinity). */
export function safeNumber(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

// ─── Iluminación (método de lúmenes) ─────────────────────────────────────────

/**
 * Cantidad mínima de luminarias: N = ceil(E·A / (F·CU·FM)).
 * Retorna 0 si el flujo, CU, FM o el área son inválidos (≤ 0 o no finitos),
 * o si el nivel requerido es ≤ 0.
 */
export function computeMinLuminaires(
    luxRequired: number,
    areaM2: number,
    lumensPerFixture: number,
    cu: number,
    fm: number,
): number {
    if (!isPositive(luxRequired) || !isPositive(areaM2) || !isPositive(lumensPerFixture) || !isPositive(cu) || !isPositive(fm)) {
        return 0;
    }

    return Math.ceil((luxRequired * areaM2) / (lumensPerFixture * cu * fm));
}

/**
 * Iluminancia estimada: E = N·F·CU·FM / A (lux).
 * Retorna 0 ante cantidad, flujo, CU, FM o área inválidos.
 */
export function estimateIlluminance(qty: number, lumensPerFixture: number, cu: number, fm: number, areaM2: number): number {
    if (!isPositive(qty) || !isPositive(lumensPerFixture) || !isPositive(cu) || !isPositive(fm) || !isPositive(areaM2)) {
        return 0;
    }

    return safeNumber((qty * lumensPerFixture * cu * fm) / areaM2);
}

/**
 * Estado de cumplimiento respecto al nivel requerido.
 * pct = estimado/requerido·100. Umbrales: <90 no_cumple, [90,100) advertencia,
 * [100,150] cumple, >150 exceso. Sin nivel requerido (≤ 0) se considera cumple.
 */
export function complianceStatus(estimatedLux: number, requiredLux: number): { status: ComplianceStatus; pct: number; deltaLux: number } {
    const estimated = isNonNegative(estimatedLux) ? estimatedLux : 0;

    if (!isPositive(requiredLux)) {
        // Sin exigencia normativa no hay nada que incumplir.
        return { status: 'cumple', pct: 100, deltaLux: estimated };
    }

    const pct = safeNumber((estimated / requiredLux) * 100);
    const deltaLux = estimated - requiredLux;

    let status: ComplianceStatus;
    if (pct < 90) {
        status = 'no_cumple';
    } else if (pct < 100) {
        status = 'advertencia';
    } else if (pct <= 150) {
        status = 'cumple';
    } else {
        status = 'exceso';
    }

    return { status, pct, deltaLux };
}

// ─── Tomacorrientes ──────────────────────────────────────────────────────────

/**
 * Cantidad automática de puntos según la regla del tipo de ambiente:
 * 'area' → ceil(A/valor); 'perimeter' → ceil(P/valor); 'fixed' → round(valor).
 * Sin regla o con datos inválidos retorna 0.
 */
export function computeOutletsAuto(rule: OutletRule | undefined, areaM2: number, perimeterM: number): number {
    if (!rule) {
        return 0;
    }

    switch (rule.method) {
        case 'area':
            if (!isPositive(rule.value) || !isPositive(areaM2)) {
                return 0;
            }
            return Math.ceil(areaM2 / rule.value);
        case 'perimeter':
            if (!isPositive(rule.value) || !isPositive(perimeterM)) {
                return 0;
            }
            return Math.ceil(perimeterM / rule.value);
        case 'fixed':
            return isPositive(rule.value) ? Math.round(rule.value) : 0;
        default:
            return 0;
    }
}

// ─── Circuitos ───────────────────────────────────────────────────────────────

/**
 * Corriente de un circuito: monofásico I = P/(V·fp); trifásico I = P/(√3·V·fp).
 * Retorna 0 ante potencia, tensión o factor de potencia inválidos.
 */
export function circuitCurrent(powerW: number, voltageV: number, phases: 1 | 3, powerFactor: number): number {
    if (!isPositive(powerW) || !isPositive(voltageV) || !isPositive(powerFactor)) {
        return 0;
    }

    const divisor = phases === 3 ? Math.sqrt(3) * voltageV * powerFactor : voltageV * powerFactor;

    return safeNumber(powerW / divisor);
}

/**
 * Caída de tensión porcentual.
 * Monofásico: ΔV = 2·ρ·L·I/S; trifásico: ΔV = √3·ρ·L·I/S. Retorna ΔV/V·100.
 * Retorna 0 ante sección, tensión, longitud o corriente inválidas.
 */
export function voltageDropPct(
    currentA: number,
    lengthM: number,
    sectionMm2: number,
    voltageV: number,
    phases: 1 | 3,
    material: 'cobre' | 'aluminio',
): number {
    if (!isPositive(currentA) || !isPositive(lengthM) || !isPositive(sectionMm2) || !isPositive(voltageV)) {
        return 0;
    }

    const rho = RESISTIVITY[material] ?? RESISTIVITY.cobre;
    const factor = phases === 3 ? Math.sqrt(3) : 2;
    const dropV = (factor * rho * lengthM * currentA) / sectionMm2;

    return safeNumber((dropV / voltageV) * 100);
}

/**
 * Selección de interruptor termomagnético: el primer valor de la escala
 * estándar ≥ corriente de diseño. Si la corriente excede la escala se usa el
 * máximo disponible (el llamador debe marcar el error). Un valor manual
 * positivo tiene prioridad y se reporta con source 'manual'.
 */
export function selectBreaker(designCurrentA: number, manual?: number | null): { amps: number; source: 'auto' | 'manual' } {
    if (manual != null && isPositive(manual)) {
        return { amps: manual, source: 'manual' };
    }

    const design = isPositive(designCurrentA) ? designCurrentA : 0;
    const amps = BREAKER_SCALE.find((a) => a >= design) ?? BREAKER_SCALE[BREAKER_SCALE.length - 1];

    return { amps, source: 'auto' };
}

export interface SelectConductorParams {
    designCurrentA: number;
    lengthM: number;
    voltageV: number;
    phases: 1 | 3;
    minSectionMm2: number;
    maxVoltageDropPct: number;
    conductors: ConductorCatalog[];
    manualSectionMm2?: number | null;
    material?: 'cobre' | 'aluminio';
}

export interface SelectConductorResult {
    conductor: ConductorCatalog | null;
    sectionMm2: number;
    source: 'auto' | 'manual';
    voltageDropPct: number;
    warnings: string[];
}

/**
 * Selección de conductor por ampacidad + caída de tensión.
 * Automático: la menor sección del catálogo (del material indicado) que
 * cumpla sección ≥ mínima, ampacidad ≥ corriente de diseño y caída ≤ máxima.
 * Manual: se usa la sección del catálogo igual o inmediatamente superior a la
 * pedida y se validan ampacidad/caída (warnings si no cumplen).
 * Si ninguna sección cumple, se usa la mayor disponible con warning.
 */
export function selectConductor(params: SelectConductorParams): SelectConductorResult {
    const material = params.material ?? 'cobre';
    const warnings: string[] = [];
    const source: 'auto' | 'manual' = params.manualSectionMm2 != null && isPositive(params.manualSectionMm2) ? 'manual' : 'auto';

    const candidates = params.conductors
        .filter((c) => c.material === material && isPositive(c.section_mm2) && isPositive(c.ampacity_a))
        .sort((a, b) => a.section_mm2 - b.section_mm2);

    if (candidates.length === 0) {
        warnings.push(`No hay conductores de ${material} en el catálogo.`);
        return { conductor: null, sectionMm2: 0, source, voltageDropPct: 0, warnings };
    }

    const designCurrent = isPositive(params.designCurrentA) ? params.designCurrentA : 0;
    const dropFor = (sectionMm2: number): number =>
        voltageDropPct(designCurrent, params.lengthM, sectionMm2, params.voltageV, params.phases, material);

    let chosen: ConductorCatalog;

    if (source === 'manual') {
        const manual = params.manualSectionMm2 as number;
        const match = candidates.find((c) => c.section_mm2 >= manual);
        if (match) {
            chosen = match;
            if (match.section_mm2 !== manual) {
                warnings.push(`La sección manual de ${manual} mm² no existe en el catálogo; se usa ${match.section_mm2} mm².`);
            }
        } else {
            chosen = candidates[candidates.length - 1];
            warnings.push(`La sección manual de ${manual} mm² supera el catálogo; se usa la mayor disponible (${chosen.section_mm2} mm²).`);
        }
    } else {
        const minSection = isPositive(params.minSectionMm2) ? params.minSectionMm2 : 0;
        const maxDrop = isPositive(params.maxVoltageDropPct) ? params.maxVoltageDropPct : Number.POSITIVE_INFINITY;
        const match = candidates.find(
            (c) => c.section_mm2 >= minSection && c.ampacity_a >= designCurrent && dropFor(c.section_mm2) <= maxDrop,
        );
        if (match) {
            chosen = match;
        } else {
            chosen = candidates[candidates.length - 1];
            warnings.push(`Ninguna sección del catálogo cumple los criterios; se usa la mayor disponible (${chosen.section_mm2} mm²).`);
        }
    }

    const drop = dropFor(chosen.section_mm2);

    // Validación final del conductor elegido (aplica a manual y a fallback).
    if (chosen.ampacity_a < designCurrent) {
        warnings.push(
            `La ampacidad del conductor de ${chosen.section_mm2} mm² (${chosen.ampacity_a} A) es menor que la corriente de diseño (${designCurrent.toFixed(2)} A).`,
        );
    }
    if (isPositive(params.maxVoltageDropPct) && drop > params.maxVoltageDropPct) {
        warnings.push(
            `La caída de tensión (${drop.toFixed(2)}%) supera el máximo permitido (${params.maxVoltageDropPct}%) con ${chosen.section_mm2} mm².`,
        );
    }

    return { conductor: chosen, sectionMm2: chosen.section_mm2, source, voltageDropPct: drop, warnings };
}

// ─── Utilitarios de distribución y metrados ──────────────────────────────────

/**
 * Grilla sugerida de distribución: cols = ceil(√N), rows = ceil(N/cols).
 * Retorna (0,0) para cantidades inválidas o cero.
 */
export function suggestGrid(qty: number): { rows: number; cols: number } {
    if (!isPositive(qty)) {
        return { rows: 0, cols: 0 };
    }

    const n = Math.ceil(qty);
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);

    return { rows, cols };
}

/**
 * Longitud total de cable: L·n·factor de reserva (p.ej. 25·3·1.10 = 82.5 m).
 * Retorna 0 ante longitud, número de conductores o factor inválidos.
 */
export function cableLength(routeLengthM: number, wireCount: number, reserveFactor: number): number {
    if (!isPositive(routeLengthM) || !isPositive(wireCount) || !isPositive(reserveFactor)) {
        return 0;
    }

    return safeNumber(routeLengthM * wireCount * reserveFactor);
}
