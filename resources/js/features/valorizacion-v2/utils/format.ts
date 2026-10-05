import { D } from '../lib/money';
import type { DecimalInput } from '../lib/money';

type Nullable<T> = T | null | undefined;

const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 1234567.891 → "1,234,567.89" (negativos con signo). */
export function fmtNumber(value: Nullable<DecimalInput>, decimals = 2): string {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    const fixed = D(value).toFixed(decimals);
    const negative = fixed.startsWith('-');
    const [int, frac] = fixed.replace('-', '').split('.');

    return `${negative ? '-' : ''}${group(int)}${frac ? `.${frac}` : ''}`;
}

/** S/ 638,827.47 · negativos contables: (S/ 1,234.56) */
export function fmtMoney(value: Nullable<DecimalInput>): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    const d = D(value);
    const body = `S/ ${fmtNumber(d.abs(), 2)}`;

    return d.isNegative() && !d.isZero() ? `(${body})` : body;
}

/** 0.9782 → "97.82%" */
export function fmtPct(value: Nullable<DecimalInput>, decimals = 2): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    return `${D(value).mul(100).toFixed(decimals)}%`;
}

/** Texto vacío → guion largo, para celdas de solo lectura. */
export const orDash = (value: Nullable<string>): string => (value && value.trim() !== '' ? value : '—');
