import Decimal from 'decimal.js';

/**
 * Constructor Decimal AISLADO para Valorización v2. Se usa un clone en vez de
 * `Decimal.set()` para no alterar la configuración global de decimal.js que
 * comparten otros módulos en producción (Inertia no recarga la página al navegar).
 *
 * ROUND_HALF_UP = "empate se aleja de cero", igual que ROUND() de Excel.
 */
export const Dec = Decimal.clone({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInput = Decimal | number | string;

/** Monto serializable (lo que viaja por JSON / vive en el store): "638827.47". */
export type MoneyString = string;

/** Fracción serializable para porcentajes: "0.1800" = 18 %. */
export type RatioString = string;

/**
 * Decimal seguro: null/undefined/'' → 0. Un texto no numérico LANZA error en vez
 * de convertirse en 0 en silencio (un dato corrupto no debe pasar como cero).
 */
export function D(value?: DecimalInput | null): Decimal {
    if (value === null || value === undefined || value === '') {
        return new Dec(0);
    }

    return new Dec(value);
}

/** Variante tolerante para entradas del usuario: texto inválido → null. */
export function parseDecimal(value: string | null | undefined): Decimal | null {
    if (value === null || value === undefined || value.trim() === '') {
        return null;
    }

    try {
        return new Dec(value.replace(/,/g, '').trim());
    } catch {
        return null;
    }
}

/** ROUND(x, 2) — dinero. */
export const roundMoney = (value: DecimalInput): Decimal => D(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** ROUND(x, 4) — porcentajes de avance. */
export const roundPct = (value: DecimalInput): Decimal => D(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

/** ROUND(x, 0) — detracción y otros enteros. */
export const roundInt = (value: DecimalInput): Decimal => D(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

/** a / b con divisor cero → 0 (convención del Excel: IFERROR implícito). */
export function safeDiv(numerator: DecimalInput, denominator: DecimalInput): Decimal {
    const divisor = D(denominator);

    return divisor.isZero() ? new Dec(0) : D(numerator).div(divisor);
}

/** Suma exacta de una lista de valores. */
export function sum(values: Iterable<DecimalInput | null | undefined>): Decimal {
    let total = new Dec(0);
    for (const value of values) {
        total = total.add(D(value));
    }

    return total;
}

/** Decimal → string serializable con 2 decimales fijos. */
export const toMoneyString = (value: DecimalInput): MoneyString => roundMoney(value).toFixed(2);

/**
 * Entrada de monto que también acepta porcentaje del total: "1600" → "1600",
 * "25%" con total 6400 → "1600". Vacío → null. Inválido → false.
 */
export function parseMontoOPorcentaje(raw: string, total: DecimalInput): string | null | false {
    const value = raw.trim();
    if (value === '') {
        return null;
    }
    if (value.endsWith('%')) {
        const pct = parseDecimal(value.slice(0, -1));

        return pct === null ? false : D(total).mul(pct).div(100).toString();
    }
    const monto = parseDecimal(value);

    return monto === null ? false : monto.toString();
}
