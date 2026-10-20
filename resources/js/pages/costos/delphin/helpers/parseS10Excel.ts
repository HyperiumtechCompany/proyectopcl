import Decimal from 'decimal.js';
import * as XLSX from 'xlsx';
import type { DelphinRow } from '../types';
import type { ParseAcuResult, ParsedAcu, ParsedAcuComponente } from './parseAcuExcel';
import type { ParsePresupuestoResult } from './parsePresupuestoExcel';

// Importación desde los reportes Excel que exporta S10 Costos y Presupuestos:
//   · "Presupuesto": Item | Descripción | Und. | Metrado | Precio S/. | Parcial S/. (al final, COSTO
//     DIRECTO / GG / UTILIDAD / IGV sin ítem, que se ignoran)
//   · "Análisis de precios unitarios": bloques "Partida <código> <descripción>" + Rendimiento +
//     Código | Descripción Recurso | Unidad | Cuadrilla | Cantidad | Precio S/. | Parcial S/.
//
// Devuelve EXACTAMENTE los mismos tipos que los parsers de Delphin Express (parsePresupuestoExcel /
// parseAcuExcel), así el modal de importación aplica, vincula y guarda igual. Los parsers de Delphin
// no se tocan: los formatos difieren (cabecera de página, códigos con ceros como texto, columnas en
// otras posiciones). Verificado contra exportaciones reales de S10 (Estructuras, 2026-10-20).

const roundCantidad = (value: number) => new Decimal(value).toDecimalPlaces(4).toNumber();
const roundMonto = (value: number) => new Decimal(value).toDecimalPlaces(2).toNumber();

function normalize(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function cellText(ws: XLSX.WorkSheet, r: number, c: number): string {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.v == null) return '';
    return String(cell.v).trim();
}

/** Número de una celda. S10 (Perú) usa "." decimal y "," de miles: "1,250.00" → 1250. */
function cellNumber(ws: XLSX.WorkSheet, r: number, c: number): number | null {
    if (c < 0) return null;
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.v == null || cell.v === '') return null;
    if (typeof cell.v === 'number') return cell.v;
    const cleaned = String(cell.v).replace(/[S/\s]/g, '').replace(/,/g, '');
    if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
    return Number(cleaned);
}

/** Código de ítem/partida: texto "01.01.01" (S10 lo exporta como texto); si vino numérico, su formato. */
function cellCode(ws: XLSX.WorkSheet, r: number, c: number): string {
    if (c < 0) return '';
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.v == null) return '';
    const raw = cell.t === 'n' && cell.w && /^[\d.]+$/.test(cell.w.trim()) ? cell.w.trim() : String(cell.v).trim();
    return /^\d+(\.\d+)*$/.test(raw) ? raw : '';
}

function readWorkbook(file: File): Promise<XLSX.WorkBook> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                resolve(XLSX.read(e.target?.result, { type: 'binary' }));
            } catch (err) {
                reject(new Error('Error al leer el archivo: ' + ((err as Error)?.message ?? 'desconocido')));
            }
        };
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        reader.readAsBinaryString(file);
    });
}

// ─── Presupuesto ──────────────────────────────────────────────────────────────

interface PresupuestoCols { item: number; desc: number; unidad: number; metrado: number; precio: number; parcial: number }

/** Fila de cabecera de columnas: "Item" + "Descripción" + (Parcial | Metrado). Se repite en cada página. */
function detectPresupuestoHeader(ws: XLSX.WorkSheet, r: number, maxC: number): PresupuestoCols | null {
    const cols: Partial<PresupuestoCols> = {};
    for (let c = 0; c <= maxC; c++) {
        const v = normalize(cellText(ws, r, c));
        if (!v) continue;
        if (v === 'item' || v === 'items') cols.item ??= c;
        else if (v.startsWith('descrip')) cols.desc ??= c;
        else if (v.startsWith('und') || v.startsWith('unid')) cols.unidad ??= c;
        else if (v.startsWith('metrado') || v.startsWith('cant')) cols.metrado ??= c;
        else if (v.startsWith('precio') || v.startsWith('p.u') || v.startsWith('p. u')) cols.precio ??= c;
        else if (v.startsWith('parcial') || v.startsWith('total')) cols.parcial ??= c;
    }
    if (cols.item === undefined || cols.desc === undefined || (cols.parcial === undefined && cols.metrado === undefined)) return null;
    return { unidad: -1, metrado: -1, precio: -1, parcial: -1, ...cols } as PresupuestoCols;
}

// Encabezado de página de S10 (se repite en cada hoja impresa): no son partidas.
const PAGE_HEADER_LABELS = ['s10', 'pagina', 'presupuesto', 'subpresupuesto', 'cliente', 'lugar', 'costo al', 'fecha'];

function isPageHeaderRow(ws: XLSX.WorkSheet, r: number, maxC: number): boolean {
    for (let c = 0; c <= Math.min(maxC, 6); c++) {
        const v = normalize(cellText(ws, r, c)).replace(/[:.]$/, '');
        if (v && PAGE_HEADER_LABELS.includes(v)) return true;
    }
    return false;
}

export function parseS10PresupuestoWorkbook(wb: XLSX.WorkBook): ParsePresupuestoResult {
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws || !ws['!ref']) throw new Error('Hoja vacía o inválida.');

    const range = XLSX.utils.decode_range(ws['!ref']);
    const maxC = range.e.c;
    const warnings: string[] = [];
    const subpresupuestos = new Set<string>();

    interface RawRow { code: string; descripcion: string; unidad: string; metrado: number; precio: number; parcial: number }
    const rawRows: RawRow[] = [];
    const seen = new Set<string>();

    let cols: PresupuestoCols | null = null;
    let inPageHeader = false;

    for (let r = range.s.r; r <= range.e.r; r++) {
        const header = detectPresupuestoHeader(ws, r, maxC);
        if (header) {
            cols = header;
            inPageHeader = false;
            continue;
        }

        if (isPageHeaderRow(ws, r, maxC)) {
            const label = normalize(cellText(ws, r, 0) || cellText(ws, r, 1));
            if (label.startsWith('subpresupuesto')) {
                const name = Array.from({ length: maxC + 1 }, (_, c) => cellText(ws, r, c)).filter(Boolean).slice(1).join(' ');
                if (name) subpresupuestos.add(name);
            }
            inPageHeader = true; // hasta la próxima fila "Item | Descripción…"
            continue;
        }
        if (!cols || inPageHeader) continue;

        const code = cellCode(ws, r, cols.item);
        const descripcion = Array.from({ length: Math.max(1, (cols.unidad > cols.desc ? cols.unidad : cols.desc + 4) - cols.desc) }, (_, i) => cellText(ws, r, cols!.desc + i))
            .filter(Boolean)
            .join(' ')
            .trim();
        const metrado = cellNumber(ws, r, cols.metrado);
        const precio = cellNumber(ws, r, cols.precio);
        const parcial = cellNumber(ws, r, cols.parcial);

        if (!code) continue; // totales finales (COSTO DIRECTO, IGV…), "SON: …", líneas en blanco

        if (seen.has(code)) {
            warnings.push(`Ítem ${code} repetido (¿otro subpresupuesto con la misma numeración?): se omitió la segunda aparición.`);
            continue;
        }
        seen.add(code);

        let m = metrado ?? 0;
        const p = precio ?? 0;
        let total = parcial ?? 0;
        if (p > 0 && m === 0 && total > 0) m = new Decimal(total).div(p).toNumber();
        if (p > 0 && total === 0 && m > 0) total = new Decimal(m).times(p).toNumber();

        rawRows.push({
            code,
            descripcion,
            unidad: cols.unidad >= 0 ? cellText(ws, r, cols.unidad) : '',
            metrado: roundCantidad(m),
            precio: p,
            parcial: roundMonto(total),
        });
    }

    if (rawRows.length === 0) {
        throw new Error('No se encontraron partidas. Verifica que sea el reporte "Presupuesto" exportado desde S10.');
    }
    if (subpresupuestos.size > 1) {
        warnings.push(`El archivo trae ${subpresupuestos.size} subpresupuestos (${[...subpresupuestos].join(' · ')}).`);
    }

    // Árbol por código (mismo criterio que parsePresupuestoExcel): ids temporales negativos, padre = prefijo.
    const codeToId = new Map<string, number>();
    let nextId = -1;
    const rows: DelphinRow[] = rawRows.map((p) => {
        const id = nextId--;
        codeToId.set(p.code, id);
        const segs = p.code.split('.');
        const parentCode = segs.length > 1 ? segs.slice(0, -1).join('.') : null;
        const parent_id = parentCode ? (codeToId.get(parentCode) ?? null) : null;
        if (parentCode && parent_id === null) {
            warnings.push(`Partida ${p.code}: padre "${parentCode}" no encontrado, se adjunta como raíz.`);
        }
        return {
            id,
            parent_id,
            nivel: segs.length,
            item_order: 0,
            partida: p.code,
            descripcion: p.descripcion,
            duracion_dias: 0,
            fecha_inicio: null,
            fecha_fin: null,
            avance: 0,
            predecesoras: [],
            presupuesto: p.parcial,
            unidad: p.unidad,
            metrado: p.metrado,
            precio_unitario: p.precio,
            parcial: p.parcial,
        };
    });

    const groupSet = new Set<string>();
    rawRows.forEach((r) => {
        const segs = r.code.split('.');
        if (segs.length > 1) groupSet.add(segs.slice(0, -1).join('.'));
    });

    return {
        rows,
        warnings,
        totalPartidas: rawRows.filter((r) => !groupSet.has(r.code)).length,
        totalGrupos: groupSet.size,
    };
}

export async function parseS10PresupuestoExcel(file: File): Promise<ParsePresupuestoResult> {
    return parseS10PresupuestoWorkbook(await readWorkbook(file));
}

// ─── ACU (Análisis de precios unitarios) ──────────────────────────────────────

type SectionKey = 'mano_de_obra' | 'materiales' | 'equipos' | 'subcontratos' | 'subpartidas';

function sectionOf(text: string): SectionKey | null {
    const t = normalize(text);
    if (t === 'mano de obra' || t === 'mano obra') return 'mano_de_obra';
    if (t === 'materiales' || t === 'material') return 'materiales';
    if (t === 'equipos' || t === 'equipo' || t === 'equipos y herramientas') return 'equipos';
    if (t.startsWith('subcontrato') || t.startsWith('sub-contrato') || t.startsWith('sub contrato')) return 'subcontratos';
    if (t.startsWith('subpartida') || t.startsWith('sub-partida') || t.startsWith('sub partida')) return 'subpartidas';
    return null;
}

interface AcuCols { cod: number; desc: number; unidad: number; cuadrilla: number; cantidad: number; precio: number; parcial: number }

/** "Código | Descripción Recurso | Unidad | Cuadrilla | Cantidad | Precio S/. | Parcial S/." (se repite por partida). */
function detectAcuHeader(ws: XLSX.WorkSheet, r: number, maxC: number): AcuCols | null {
    const cols: Partial<AcuCols> = {};
    for (let c = 0; c <= maxC; c++) {
        const v = normalize(cellText(ws, r, c));
        if (!v) continue;
        if (v.startsWith('codigo') || v === 'cod' || v === 'cod.') cols.cod ??= c;
        else if (v.startsWith('descrip')) cols.desc ??= c;
        else if (v.startsWith('unid') || v.startsWith('und')) cols.unidad ??= c;
        else if (v.startsWith('cuadr')) cols.cuadrilla ??= c;
        else if (v.startsWith('cant')) cols.cantidad ??= c;
        else if (v.startsWith('precio') || v.startsWith('p.u')) cols.precio ??= c;
        else if (v.startsWith('parcial')) cols.parcial ??= c;
    }
    if (cols.desc === undefined || cols.cantidad === undefined || cols.precio === undefined) return null;
    return { cod: -1, unidad: -1, cuadrilla: -1, parcial: -1, ...cols } as AcuCols;
}

function emptyAcu(): ParsedAcu {
    return { partida_code: '', partida_desc: '', unidad: '', rendimiento: 1, mano_de_obra: [], materiales: [], equipos: [], subcontratos: [], subpartidas: [] };
}

export function parseS10AcuWorkbook(wb: XLSX.WorkBook): ParseAcuResult {
    const acus: ParsedAcu[] = [];
    const warnings: string[] = [];

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws || !ws['!ref']) continue;
        const range = XLSX.utils.decode_range(ws['!ref']);
        const maxC = range.e.c;

        let current: ParsedAcu | null = null;
        let section: SectionKey | null = null;
        let cols: AcuCols | null = null;

        const flush = () => {
            if (current?.partida_code) acus.push(current);
        };

        for (let r = range.s.r; r <= range.e.r; r++) {
            const texts = Array.from({ length: maxC + 1 }, (_, c) => cellText(ws, r, c));
            const norms = texts.map(normalize);

            // 1. "Partida | 01.01.01.01.01 | CONSTRUCCIÓN OFICINA…" abre un ACU nuevo.
            const partidaIdx = norms.findIndex((v) => v === 'partida' || v === 'partida:');
            if (partidaIdx >= 0) {
                let code = '';
                let codeCol = -1;
                for (let c = partidaIdx + 1; c <= maxC && !code; c++) {
                    const candidate = cellCode(ws, r, c);
                    if (candidate.includes('.')) {
                        code = candidate;
                        codeCol = c;
                    }
                }
                if (code) {
                    flush();
                    current = emptyAcu();
                    current.partida_code = code;
                    current.partida_desc = texts.slice(codeCol + 1).find((t) => t && !/^[\d.,]+$/.test(t)) ?? '';
                    section = null;
                    continue;
                }
            }
            if (!current) continue;

            // 2. "Rendimiento | m2/DIA | 7.0000 | EQ. 7.0000 | Costo unitario directo por : m2 | 137.55"
            const rendIdx = norms.findIndex((v) => v.startsWith('rendimiento'));
            if (rendIdx >= 0) {
                for (let c = rendIdx + 1; c <= maxC; c++) {
                    const n = cellNumber(ws, r, c);
                    if (n !== null && n > 0) {
                        current.rendimiento = n;
                        break;
                    }
                }
                for (const t of texts) {
                    const m = t.match(/por\s*:?\s*([^\s:]+)\s*$/i);
                    if (m) {
                        current.unidad = m[1];
                        break;
                    }
                }
                if (!current.unidad) {
                    const unitCell = texts.slice(rendIdx + 1).find((t) => t && /\//.test(t));
                    if (unitCell) current.unidad = unitCell.split('/')[0];
                }
                continue;
            }

            // 3. Cabecera de columnas (se repite en cada partida).
            const header = detectAcuHeader(ws, r, maxC);
            if (header) {
                cols = header;
                continue;
            }

            // 4. Sección: fila que solo dice "Mano de Obra" / "Materiales" / "Equipos"…
            const filled = texts.filter(Boolean);
            if (filled.length === 1) {
                const s = sectionOf(filled[0]);
                if (s) {
                    section = s;
                    continue;
                }
            }
            if (!section || !cols) continue;

            // 5. Recurso. La fila de subtotal (solo el parcial, sin descripción) se descarta.
            const descripcion = cellText(ws, r, cols.desc);
            if (!descripcion) continue;
            const cantidad = cellNumber(ws, r, cols.cantidad) ?? 0;
            const precio = cellNumber(ws, r, cols.precio) ?? 0;
            const cuadrilla = cellNumber(ws, r, cols.cuadrilla) ?? 0;
            if (cantidad === 0 && precio === 0) continue;

            const componente: ParsedAcuComponente = {
                codigo: cols.cod >= 0 ? cellText(ws, r, cols.cod) || null : null,
                proveedor: null,
                descripcion,
                unidad: cols.unidad >= 0 ? cellText(ws, r, cols.unidad) : '',
                recursos: cuadrilla,
                cantidad: roundCantidad(cantidad),
                precio_unitario: section === 'equipos' ? 0 : precio,
                precio_hora: section === 'equipos' ? precio : 0,
                factor_desperdicio: 1,
            };
            current[section].push(componente);
        }
        flush();
    }

    if (acus.length === 0) {
        warnings.push('No se encontraron ACUs. Verifica que sea el reporte "Análisis de precios unitarios" exportado desde S10.');
    }
    return { acus, warnings };
}

export async function parseS10AcuExcel(file: File): Promise<ParseAcuResult> {
    return parseS10AcuWorkbook(await readWorkbook(file));
}
