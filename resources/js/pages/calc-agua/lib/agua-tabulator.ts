/**
 * Helpers compartidos para los tabs hidráulicos de Cálculo de Agua.
 * Importar desde TuberiasRD, RedesInteriores y RedRiego.
 *
 * IMPORTANTE: estos helpers son PUROS (sin side-effects de React/DOM).
 * Cada componente mantiene sus propios estados y tabulator instances.
 */

import type { FilaTabla, DiametroOption, AccesorioTipo } from '@/types/agua';

// ─── Constantes ────────────────────────────────────────────────────────────────

/** Opciones de diámetro de tubería disponibles (etiqueta + valor en pulgadas) */
export const DIAMETRO_OPTIONS: DiametroOption[] = [
    { label: '1/2 pulg', value: 0.5 },
    { label: '3/4 pulg', value: 0.75 },
    { label: '1 pulg', value: 1 },
    { label: '1 1/4 pulg', value: 1.25 },
    { label: '1 1/2 pulg', value: 1.5 },
    { label: '2 pulg', value: 2 },
    { label: '2 1/2 pulg', value: 2.5 },
    { label: '3 pulg', value: 3 },
    { label: '4 pulg', value: 4 },
    { label: '6 pulg', value: 6 },
    { label: '8 pulg', value: 8 },
];

/** Solo las etiquetas de diámetro (para listas en Tabulator) */
export const DIAMETRO_LABELS: string[] = DIAMETRO_OPTIONS.map(d => d.label);

/** Mapa de tipo de accesorio → nombre legible para cabeceras */
export const ACCESORIO_LABEL_MAP: Record<string, string> = {
    codo45: 'Codo 45°',
    codo90: 'Codo 90°',
    tee: 'Tee',
    valCompuerta: 'Val. Compuerta',
    valCheck: 'Val. Check',
    canastilla: 'Canastilla',
    reduccion1: 'Reducción 1 (d → D)',
    reduccion2: 'Reducción 2 (D → d)',
};

/** Opciones para el select de tipo de accesorio en header filter */
export const ACCESORIO_OPTIONS: { value: string; label: string }[] = Object.entries(ACCESORIO_LABEL_MAP).map(
    ([value, label]) => ({ value, label })
);

// ─── Helpers de cálculo ────────────────────────────────────────────────────────

/**
 * Limpia y redondea un valor numérico de forma segura.
 * Devuelve 0 si el resultado no es finito.
 */
export function sanitize(val: unknown, decimals = 2): number {
    const n = Number(val);
    return isFinite(n) && !isNaN(n) ? parseFloat(n.toFixed(decimals)) : 0;
}

/**
 * Calcula la longitud total equivalente de un tramo de tubería:
 *   L_total = L + N1×Leq_codo + N2×Leq_tee + N3×Leq_valv + N4×Leq_reduccion
 */
export function calcularLongitudTotal(row: Partial<FilaTabla>): number {
    const l = parseFloat(row.longitud as string) || 0;
    const n1 = parseFloat(row.n1 as string) || 0;
    const c = parseFloat(row.codo90 as string) || 0;
    const n2 = parseFloat(row.n2 as string) || 0;
    const t = parseFloat(row.tee as string) || 0;
    const n3 = parseFloat(row.n3 as string) || 0;
    const v = parseFloat(row.val_compuerta as string) || 0;
    const n4 = parseFloat(row.n4 as string) || 0;
    const r = parseFloat(row.reduccion2 as string) || 0;
    return sanitize(l + n1 * c + n2 * t + n3 * v + n4 * r, 3);
}

/**
 * Resuelve el diámetro en metros a partir de la etiqueta de pulg.
 * Retorna 0 si no coincide.
 */
export function diametroEnMetros(label: string): number {
    const opt = DIAMETRO_OPTIONS.find(d => d.label === label);
    if (!opt) return 0;
    return opt.value * 2.54 / 100; // pulg → cm → m
}

/**
 * Calcula los parámetros hidráulicos de UN tramo usando Hazen-Williams.
 * Retorna { s, hf, velocidad } — NO modifica la fila original.
 *
 * Hazen-Williams: Q = 0.2785 × C × D^2.63 × S^0.54  (Q en m³/s)
 * → S = ( (Q/1000) / (0.2785 × C × D^2.63) ) ^ (1/0.54)
 */
export function calcularTramo(row: Partial<FilaTabla>): {
    s: number;
    hf: number;
    velocidad: number;
} {
    const caudal = parseFloat(row.caudal as string) || 0;       // l/s
    const coefrug = parseFloat(row.coefrug as string) || 0;
    const longitudtotal = parseFloat(row.longitudtotal as string) || 0;
    const D = diametroEnMetros(row.diametro as string);

    if (D <= 0 || coefrug <= 0) return { s: 0, hf: 0, velocidad: 0 };

    const Q = caudal / 1000; // l/s → m³/s
    const sRaw = Math.pow(Q / (0.2785 * coefrug * Math.pow(D, 2.63)), 1 / 0.54);
    const s = sanitize(sRaw, 4);
    const hf = sanitize(longitudtotal * s, 2);
    const area = Math.PI * Math.pow(D, 2) / 4;
    const velocidad = sanitize(Q / area, 2);

    return { s, hf, velocidad };
}

/**
 * Aplica el cálculo hidráulico en cascada a un array de filas.
 * Muta los campos: s, hf, velocidad, hpiez, presion, verificacion1, verificacion2.
 *
 * @param rows       Filas de la tabla (del primer al último tramo)
 * @param hpiezInicial  Altura piezométrica inicial (fondo del tanque elevado)
 * @returns El array mutado (misma referencia)
 */
export function calcularHidraulicaCascada(
    rows: FilaTabla[],
    hpiezInicial: number
): FilaTabla[] {
    let currentHpiez = sanitize(hpiezInicial, 3);

    rows.forEach((row, index) => {
        const { s, hf, velocidad } = calcularTramo(row);
        const cota = parseFloat(row.cota as string) || 0;

        if (index === 0) {
            // La primera fila (usualmente estática TE) mantiene el nivel inicial
            row.hpiez = currentHpiez;
        } else {
            // Para las siguientes filas, restamos el hf de la fila actual al hpiez acumulado
            currentHpiez = sanitize(currentHpiez - hf, 3);
            row.hpiez = currentHpiez;
        }

        row.s = s;
        row.hf = hf;
        row.velocidad = velocidad;
        row.presion = sanitize(Number(row.hpiez) - cota, 3);

        // Verificaciones con etiquetas SI/NO
        // No verificamos si no hay datos de punto o longitud y es estática
        if (row.isStatic && !row.punto && !row.longitud) {
            row.verificacion1 = '';
            row.verificacion2 = '';
        } else {
            row.verificacion1 = (velocidad >= 0.6 && velocidad <= 3) ? 'SI' : 'NO';
            row.verificacion2 = (Number(row.presion) >= 2) ? 'SI' : 'NO';
        }
    });

    return rows;
}

// ─── Formatters de Tabulator reutilizables ─────────────────────────────────────

/**
 * Formatter de verificación: 'SI'/'cumple' → verde, 'NO'/'no cumple' → rojo.
 * Usar en columnDef.formatter de las columnas de verificaciones.
 */
export function verificacionFormatter(cell: any): string {
    const v = cell.getValue();
    if (v === 'SI' || v === 'cumple') return '<span style="color:green;font-weight:bold">SI</span>';
    if (v === 'NO' || v === 'no cumple') return '<span style="color:red;font-weight:bold">NO</span>';
    return v || '';
}

/**
 * Formatter para longitud total: muestra 2 decimales o vacío.
 */
export function longitudTotalFormatter(cell: any): string {
    const v = cell.getValue();
    if (v === '' || v === undefined || v === null) return '';
    const n = Number(v);
    return isFinite(n) ? n.toFixed(2) : String(v);
}

// ─── Opciones base de columnas Tabulator compartidas ─────────────────────────

/**
 * Devuelve la estructura base de columnas Tabulator para las tablas hidráulicas.
 * Los parametros de edición (editor, cellEdited, etc.) deben inyectarse
 * por cada componente según su `mode`.
 */
export const TABULATOR_COLUMN_DEFAULTS = {
    headerHozAlign: 'center' as const,
    hozAlign: 'center' as const,
    vertAlign: 'middle' as const,
};

/**
 * Opciones base de inicialización de Tabulator para las tablas hidráulicas.
 */
export const TABULATOR_BASE_OPTIONS = {
    layout: 'fitData' as const,
    index: 'id',
    height: 'auto',
    resizableColumns: true,
    headerSort: false,
    responsiveLayout: 'scroll' as const,
};
