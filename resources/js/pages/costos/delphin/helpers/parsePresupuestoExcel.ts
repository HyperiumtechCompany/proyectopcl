import Decimal from 'decimal.js';
import * as XLSX from 'xlsx';
import type { DelphinRow } from '../types';

const roundCantidad = (value: number) => new Decimal(value).toDecimalPlaces(4).toNumber();
const roundMonto = (value: number) => new Decimal(value).toDecimalPlaces(2).toNumber();

export interface ParsePresupuestoResult {
    rows: DelphinRow[];
    warnings: string[];
    totalPartidas: number;
    totalGrupos: number;
}

function normalize(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function normalizeCode(raw: any): string {
    if (raw == null) return '';
    const s = String(raw).trim();
    return /^\d+(\.\d+)*$/.test(s) ? s : '';
}

function parseNumber(raw: any): number {
    if (raw == null) return 0;
    const n = parseFloat(String(raw).replace(',', '.'));
    return isNaN(n) ? 0 : n;
}

function cellText(ws: XLSX.WorkSheet, r: number, c: number): string {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.v == null) return '';
    return String(cell.v).trim();
}

// For item code cells: prefer the formatted display value (cell.w) over the raw numeric value
// because Excel stores "3.10" as the number 3.1, losing the trailing zero.
// If cell.w gives "3.10" (custom format) we use it; otherwise fall back to String(cell.v).
function cellCodeStr(ws: XLSX.WorkSheet, r: number, c: number): string {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.v == null) return '';
    if (cell.t !== 'n') return String(cell.v).trim(); // text/boolean: already correct
    const w = (cell.w ?? '').trim();
    const v = String(cell.v).trim();
    // Use formatted value only when it looks like a dotted code AND differs from raw
    return (w && /^[\d.]+$/.test(w) && w !== v) ? w : v;
}

// Delphin Express: item code column is B (index 1), data starts at Excel row 11 (0-based 10).
// If the header row isn't found we fall back to that row rather than rejecting.
const DATA_START_FALLBACK = 10; // Excel Fila 11

function detectHeaderRow(ws: XLSX.WorkSheet, range: XLSX.Range): number {
    for (let r = range.s.r; r <= Math.min(range.e.r, 30); r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const v = normalize(cellText(ws, r, c));
            // "item", "ítem", "n° item", "n.° item", "nro item", "código", "partida", etc.
            if (v === 'item' || /^n[o°.]?\s*\.?\s*item\.?$/.test(v) ||
                v === 'n°' || v === 'nro' || v === 'nro.' ||
                v === 'cod' || v === 'cod.' || v === 'codigo' ||
                v === 'partida') return r;
        }
    }
    return -1;
}

// Delphin Express Presupuesto General column layout (0-based):
// B=1  C=2  H=7  J=9  M=12  N=13  Q=16
const FALLBACK_COLS = { item: 1, desc: 2, unidad: 7, metrado: 9, precio: 12, parcial: 13 };

function detectColumns(ws: XLSX.WorkSheet, headerRow: number, range: XLSX.Range) {
    const cols = { ...FALLBACK_COLS };
    for (let c = range.s.c; c <= range.e.c; c++) {
        const v = normalize(cellText(ws, headerRow, c));
        if (v === 'item' || /^n[o°.]?\s*\.?\s*item\.?$/.test(v))          cols.item    = c;
        else if (v.startsWith('descrip'))                                  cols.desc    = c;
        else if (v.startsWith('unid') || v === 'u' || v === 'und')        cols.unidad  = c;
        else if (v.startsWith('cant') || v === 'metrado' || v.startsWith('med'))
                                                                           cols.metrado = c;
        else if (v.startsWith('precio') || v.startsWith('p.unit') ||
                 v.startsWith('p. unit') || v.startsWith('p.u'))          cols.precio  = c;
        else if ((v === 'parcial' || v === 'sub total' || v === 'subtotal' ||
                  v === 'sub-total' || v === 'monto' || v === 'importe') &&
                 cols.parcial === FALLBACK_COLS.parcial)                   cols.parcial = c;
    }
    return cols;
}

export function parsePresupuestoExcel(file: File): Promise<ParsePresupuestoResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target?.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                if (!ws || !ws['!ref']) { reject(new Error('Hoja vacía o inválida.')); return; }

                const range   = XLSX.utils.decode_range(ws['!ref']);
                const hdr     = detectHeaderRow(ws, range);
                const warnings: string[] = [];

                // If no header row found, fall back to Delphin Express standard layout
                // (Col B = Ítem, data from Excel Fila 11 = 0-based row 10).
                const cols    = hdr >= 0 ? detectColumns(ws, hdr, range) : { ...FALLBACK_COLS };
                const startRow = hdr >= 0 ? hdr + 1 : DATA_START_FALLBACK;
                if (hdr < 0) {
                    warnings.push('No se detectó encabezado de columnas. Usando layout estándar Delphin Express (Col B=Ítem, desde Fila 11).');
                }

                interface RawRow { code: string; descripcion: string; unidad: string; metrado: number; precio: number; parcial: number; }
                const rawRows: RawRow[] = [];

                for (let r = startRow; r <= range.e.r; r++) {
                    let code = normalizeCode(cellCodeStr(ws, r, cols.item));
                    // Section-header rows in Delphin Express often use a merged cell that starts one
                    // column to the LEFT of cols.item (e.g., col A instead of B). When cols.item is
                    // empty, scan leftward but only accept dotted codes to avoid picking up sequence
                    // numbers (like "47") that share the integer-only code pattern.
                    if (!code && cols.item > 0) {
                        for (let c = Math.max(0, cols.item - 3); c < cols.item && !code; c++) {
                            const alt = normalizeCode(cellCodeStr(ws, r, c));
                            if (alt && alt.includes('.')) code = alt;
                        }
                    }
                    if (!code) continue;

                    // Description: search cols.desc through next 6 cols for first non-empty
                    let descripcion = '';
                    for (let c = cols.desc; c <= Math.min(cols.desc + 6, range.e.c); c++) {
                        const t = cellText(ws, r, c);
                        if (t) { descripcion = t; break; }
                    }

                    let metrado = roundCantidad(parseNumber(ws[XLSX.utils.encode_cell({ r, c: cols.metrado })]?.v));
                    const precio  = parseNumber(ws[XLSX.utils.encode_cell({ r, c: cols.precio  })]?.v);
                    let parcial   = roundMonto(parseNumber(ws[XLSX.utils.encode_cell({ r, c: cols.parcial })]?.v));

                    // Recover missing values using the identity: parcial = metrado × precio.
                    // Many Delphin formats use non-standard headers ("Sub-Total", "Monto", etc.)
                    // causing cols.metrado / cols.parcial to point at wrong/empty fallback columns
                    // while precio IS found. Strategy: scan the ENTIRE row for the largest
                    // numeric value (that's the parcial), then infer metrado = parcial / precio.
                    if (precio > 0) {
                        if (metrado === 0 && parcial > 0) {
                            metrado = roundCantidad(new Decimal(parcial).div(precio).toNumber());
                        } else if (parcial === 0 && metrado > 0) {
                            parcial = roundMonto(new Decimal(metrado).times(precio).toNumber());
                        } else if (metrado === 0 && parcial === 0) {
                            // Scan ALL columns after the description column looking for the
                            // parcial (= the largest value > 10% of precio).  This covers any
                            // column position regardless of header label or fallback index.
                            let maxVal = 0;
                            for (let sc = cols.desc + 1; sc <= range.e.c; sc++) {
                                if (sc === cols.precio) continue; // skip price column itself
                                const sv = parseNumber(ws[XLSX.utils.encode_cell({ r, c: sc })]?.v);
                                if (sv > maxVal && sv >= precio * 0.1) maxVal = sv;
                            }
                            if (maxVal > 0) {
                                parcial = roundMonto(maxVal);
                                metrado = roundCantidad(new Decimal(maxVal).div(precio).toNumber());
                            }
                        }
                    }

                    rawRows.push({
                        code,
                        descripcion,
                        unidad:  cellText(ws, r, cols.unidad),
                        metrado,
                        precio,
                        parcial,
                    });
                }

                if (rawRows.length === 0) { reject(new Error('No se encontraron partidas con código de ítem.')); return; }

                // Build tree: assign negative temp IDs, resolve parent_id from code segments
                const codeToId = new Map<string, number>();
                let nextId = -1;

                const rows: DelphinRow[] = rawRows.map((p) => {
                    const id = nextId--;
                    codeToId.set(p.code, id);

                    const segs       = p.code.split('.');
                    const parentCode = segs.length > 1 ? segs.slice(0, -1).join('.') : null;
                    let   parent_id  = parentCode ? (codeToId.get(parentCode) ?? null) : null;

                    // Trailing-zero fallback: when Excel stores "3.10" as number 3.1, the codeToId
                    // has "3.1" instead of "3.10". Try removing trailing zeros from the last segment
                    // of the parent code (e.g., "3.10" → try "3.1") before emitting a warning.
                    if (parent_id === null && parentCode) {
                        const pSegs  = parentCode.split('.');
                        const last   = pSegs[pSegs.length - 1];
                        if (/^[1-9]\d*0+$/.test(last)) {           // e.g., "10", "20", "100"
                            const alt = [...pSegs.slice(0, -1), last.replace(/0+$/, '')].join('.');
                            parent_id = codeToId.get(alt) ?? null; // "3.1" instead of "3.10"
                        }
                    }

                    if (parentCode && parent_id === null) {
                        warnings.push(`Partida ${p.code}: padre "${parentCode}" no encontrado, se adjunta como raíz.`);
                    }

                    return {
                        id,
                        parent_id,
                        nivel:           segs.length,
                        item_order:      0,
                        partida:         p.code,
                        descripcion:     p.descripcion,
                        duracion_dias:   0,
                        fecha_inicio:    null,
                        fecha_fin:       null,
                        avance:          0,
                        predecesoras:    [],
                        presupuesto:     p.parcial,
                        // DelphinRow budget fields
                        unidad:          p.unidad,
                        metrado:         p.metrado,
                        precio_unitario: p.precio,
                        parcial:         p.parcial,
                    };
                });

                const codeSet  = new Set(rawRows.map((r) => r.code));
                const groupSet = new Set<string>();
                rawRows.forEach((r) => {
                    const segs = r.code.split('.');
                    if (segs.length > 1) groupSet.add(segs.slice(0, -1).join('.'));
                });

                resolve({
                    rows,
                    warnings,
                    totalPartidas: rawRows.filter((r) => !groupSet.has(r.code) && codeSet.has(r.code)).length,
                    totalGrupos:   groupSet.size,
                });
            } catch (err: any) {
                reject(new Error('Error al leer el archivo: ' + (err?.message ?? 'desconocido')));
            }
        };
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        reader.readAsBinaryString(file);
    });
}
