import { D, roundMoney } from './money';
import type { DecimalInput } from './money';

/**
 * Números a letras en español (mayúsculas), como los textos del expediente:
 * "SESENTA (60) DÍAS CALENDARIOS", "SESENTA Y TRES MIL … CON 75/100 SOLES".
 * Rango: 0 … 999 999 999 999.
 */

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_VEINTINUEVE = [
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
    'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function hastaNovecientosNoventaYNueve(n: number): string {
    if (n === 0) {
        return '';
    }
    if (n === 100) {
        return 'CIEN';
    }

    const centena = Math.floor(n / 100);
    const resto = n % 100;
    const words: string[] = [];

    if (centena > 0) {
        words.push(CENTENAS[centena]);
    }
    if (resto >= 10 && resto < 30) {
        words.push(DIEZ_A_VEINTINUEVE[resto - 10]);
    } else if (resto >= 30) {
        const unidad = resto % 10;
        words.push(unidad === 0 ? DECENAS[Math.floor(resto / 10)] : `${DECENAS[Math.floor(resto / 10)]} Y ${UNIDADES[unidad]}`);
    } else if (resto > 0) {
        words.push(UNIDADES[resto]);
    }

    return words.join(' ');
}

/** "UNO" → "UN" delante de MIL/MILLÓN ("VEINTIÚN MIL", "TREINTA Y UN MILLONES"). */
function apocope(words: string): string {
    if (words.endsWith('VEINTIUNO')) {
        return `${words.slice(0, -'VEINTIUNO'.length)}VEINTIÚN`;
    }
    if (words.endsWith('UNO')) {
        return `${words.slice(0, -3)}UN`;
    }

    return words;
}

function hastaNovecientosNoventaYNueveMil(n: number): string {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const words: string[] = [];

    if (miles === 1) {
        words.push('MIL');
    } else if (miles > 1) {
        words.push(`${apocope(hastaNovecientosNoventaYNueve(miles))} MIL`);
    }
    if (resto > 0) {
        words.push(hastaNovecientosNoventaYNueve(resto));
    }

    return words.join(' ');
}

export function numeroALetras(value: number): string {
    if (!Number.isInteger(value) || value < 0 || value > 999_999_999_999) {
        throw new RangeError(`numeroALetras: se esperaba un entero entre 0 y 999 999 999 999, llegó ${value}`);
    }
    if (value === 0) {
        return 'CERO';
    }

    const millones = Math.floor(value / 1_000_000);
    const resto = value % 1_000_000;
    const words: string[] = [];

    if (millones === 1) {
        words.push('UN MILLÓN');
    } else if (millones > 1) {
        words.push(`${apocope(hastaNovecientosNoventaYNueveMil(millones))} MILLONES`);
    }
    if (resto > 0) {
        words.push(hastaNovecientosNoventaYNueveMil(resto));
    }

    return words.join(' ');
}

/** "SESENTA (60) DÍAS CALENDARIOS" */
export function plazoEnLetras(dias: number): string {
    return `${numeroALetras(dias)} (${String(dias).padStart(2, '0')}) ${dias === 1 ? 'DÍA CALENDARIO' : 'DÍAS CALENDARIOS'}`;
}

/** "SESENTA Y TRES MIL OCHOCIENTOS OCHENTA Y DOS CON 75/100 SOLES" */
export function montoEnLetras(monto: DecimalInput): string {
    const rounded = roundMoney(D(monto).abs());
    const entero = rounded.floor().toNumber();
    const centimos = rounded.sub(entero).mul(100).toFixed(0).padStart(2, '0');

    return `${numeroALetras(entero)} CON ${centimos}/100 SOLES`;
}

const MINUSCULAS = new Set(['Y', 'CON', 'SOLES']);

/** "SESENTA Y TRES MIL … CON 75/100 SOLES" → "Sesenta y Tres Mil … con 75/100 soles" (formato de los textos del expediente). */
export function montoEnLetrasTexto(monto: DecimalInput): string {
    return montoEnLetras(monto)
        .split(' ')
        .map((word) => (MINUSCULAS.has(word) || /^\d/.test(word) ? word.toLowerCase() : word.charAt(0) + word.slice(1).toLowerCase()))
        .join(' ');
}
