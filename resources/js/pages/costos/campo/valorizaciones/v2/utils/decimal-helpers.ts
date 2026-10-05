import Decimal from 'decimal.js';

// Configuración global para operaciones financieras
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Redondear a 2 decimales (para uso en moneda/dinero).
 * Sigue la lógica ROUND(..., 2) del Excel.
 */
export const roundMoney = (v: Decimal | number | string): Decimal => {
    return new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
};

/**
 * Redondear a 4 decimales (para uso en porcentajes de avance).
 * Sigue la lógica ROUND(..., 4) del Excel.
 */
export const roundPct = (v: Decimal | number | string): Decimal => {
    return new Decimal(v).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
};

/**
 * Redondear a número entero (para uso en Detracciones, etc).
 * Sigue la lógica ROUND(..., 0) del Excel.
 */
export const roundInt = (v: Decimal | number | string): Decimal => {
    return new Decimal(v).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
};

/**
 * Formatear como moneda (S/ 123,456.78).
 */
export const fmtMoney = (v: Decimal | number | string | null | undefined): string => {
    if (v == null) return 'S/ 0.00';
    const d = new Decimal(v);
    return `S/ ${d.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/**
 * Formatear como porcentaje (12.34%).
 */
export const fmtPct = (v: Decimal | number | string | null | undefined): string => {
    if (v == null) return '0.00%';
    const d = new Decimal(v);
    return `${d.mul(100).toFixed(2)}%`;
};

/**
 * Crea un Decimal seguro. Si es null o undefined, retorna 0.
 */
export const D = (v?: Decimal | number | string | null): Decimal => {
    if (v == null || v === '') return new Decimal(0);
    try {
        return new Decimal(v);
    } catch {
        return new Decimal(0);
    }
};
