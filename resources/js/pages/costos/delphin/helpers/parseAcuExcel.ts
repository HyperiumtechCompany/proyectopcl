import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedAcuComponente {
    codigo: string | null;
    descripcion: string;
    unidad: string;
    recursos: number;
    cantidad: number;
    precio_unitario: number;   // mano_obra / materiales / subcontratos / subpartidas
    precio_hora: number;       // equipos
    factor_desperdicio: number; // materiales (default 1)
}

export interface ParsedAcu {
    partida_code: string;      // "1.1.1.1" — primary match key
    partida_desc: string;      // description — fallback match key
    unidad: string;
    rendimiento: number;
    mano_de_obra:  ParsedAcuComponente[];
    materiales:    ParsedAcuComponente[];
    equipos:       ParsedAcuComponente[];
    subcontratos:  ParsedAcuComponente[];
    subpartidas:   ParsedAcuComponente[];
}

export interface ParseAcuResult {
    acus:     ParsedAcu[];
    warnings: string[];
}

// ─── Section detection ────────────────────────────────────────────────────────

type SectionKey = keyof Omit<ParsedAcu, 'partida_code' | 'partida_desc' | 'unidad' | 'rendimiento'>;

const SECTION_PREFIXES: [string, SectionKey][] = [
    ['mano de obra',  'mano_de_obra'],
    ['mano obra',     'mano_de_obra'],
    ['materiales',    'materiales'],
    ['material',      'materiales'],
    ['equipo',        'equipos'],
    ['subcontrato',   'subcontratos'],
    ['sub-contrato',  'subcontratos'],
    ['sub contrato',  'subcontratos'],
    ['subpartida',    'subpartidas'],
    ['sub-partida',   'subpartidas'],
    ['sub partida',   'subpartidas'],
];

function detectSection(text: string): SectionKey | null {
    const t = normalize(text);
    for (const [prefix, key] of SECTION_PREFIXES) {
        if (t.startsWith(prefix)) return key;
    }
    return null;
}

// Search ALL cells of a row for a section header (fixes Bug 1)
function detectSectionInRow(texts: string[]): SectionKey | null {
    for (const t of texts) {
        if (!t) continue;
        const s = detectSection(t);
        if (s) return s;
    }
    return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip accents: é→e, ó→o
        .trim();
}

function cellStr(ws: XLSX.WorkSheet, r: number, c: number): string {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.v == null) return '';
    return String(cell.v).trim();
}

function cellNum(ws: XLSX.WorkSheet, r: number, c: number): number {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.v == null) return 0;
    const n = parseFloat(String(cell.v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
}

function rowTexts(ws: XLSX.WorkSheet, r: number, maxC: number): string[] {
    const out: string[] = [];
    for (let c = 0; c <= maxC; c++) out.push(cellStr(ws, r, c));
    return out;
}

// ─── Column map ───────────────────────────────────────────────────────────────

interface ColMap { cod: number; desc: number; unidad: number; recursos: number; cantidad: number; precio: number; }

// Keywords that identify each column type (handles "Código", "Cod.", "CUADRILLA", "Cuadrilla", etc.)
const COL_KEYWORDS: [keyof ColMap, string[]][] = [
    ['cod',      ['cod', 'item']],
    ['desc',     ['descrip']],
    ['unidad',   ['unid', 'und']],         // Note: "und." and "unid." both match
    ['recursos', ['recur', 'cuadr', 'c.', 'cua']],
    ['cantidad', ['cant']],
    ['precio',   ['precio', 'p.unit', 'p. unit', 'p.u']],
];

// Wider trigger: any row with 3+ recognized column keywords (fixes Bug 2)
const ALL_COL_KEYWORDS = COL_KEYWORDS.flatMap(([, kws]) => kws);
function looksLikeColHeader(joined: string): boolean {
    let hits = 0;
    for (const kw of ALL_COL_KEYWORDS) {
        if (joined.includes(kw)) hits++;
        if (hits >= 3) return true;
    }
    return false;
}

function detectResourceCols(ws: XLSX.WorkSheet, r: number, maxC: number): ColMap | null {
    const result: Partial<ColMap> = {};
    let hits = 0;
    for (let c = 0; c <= maxC; c++) {
        const v = normalize(cellStr(ws, r, c));
        if (!v) continue;
        for (const [field, kws] of COL_KEYWORDS) {
            if (!(field in result) && kws.some((kw) => v.startsWith(kw))) {
                (result as any)[field] = c;
                hits++;
                break;
            }
        }
    }
    return hits >= 3 ? (result as ColMap) : null;
}

// ─── Heuristic column detection from a resource row (fixes Bug 4) ─────────────
// Used when no column header row was found. Detects positions from the first
// real data row by using unit strings and numeric patterns.

const UNIT_SET = new Set([
    'hh', 'hm', 'm', 'm2', 'm3', 'kg', 'tn', 'glb', 'und', 'km', 'lt', 'lts',
    'gal', 'bls', 'bolt', 'pt', 'pln', 'bld', 'sem', 'mes', 'dia', 'día',
    'vje', 'jg', 'est', 'pie', 'rll', 'pza', 'p2', 'p3',
    '%mo', '%eq', '%mat',  // Delphin Express percentage units (e.g., herramientas = %MO)
]);
const IS_NUMERIC = /^[\d.,]+$/;
const IS_CODE    = /^[\dA-Z._-]{1,15}$/i;  // short alphanumeric: "47", "MO-01", etc.

function detectColsFromRow(texts: string[]): ColMap | null {
    // Find the unit cell
    let unidIdx = -1;
    for (let i = 0; i < texts.length; i++) {
        if (texts[i] && UNIT_SET.has(texts[i].toLowerCase())) {
            unidIdx = i;
            break;
        }
    }
    if (unidIdx < 0) return null;

    // Cells before unit: code and/or description
    const before = texts.slice(0, unidIdx)
        .map((v, i) => ({ v, i }))
        .filter((x) => x.v.trim());

    // Cells after unit: cuadrilla, cantidad, precio (all numbers)
    const afterNums = texts.slice(unidIdx + 1)
        .map((v, i) => ({ v, i: unidIdx + 1 + i }))
        .filter((x) => x.v.trim() && IS_NUMERIC.test(x.v.replace(',', '.')));

    if (afterNums.length < 2) return null;

    // Identify code vs description from 'before' cells
    // Code = short, numeric-like; Description = longer text
    let codIdx  = -1;
    let descIdx = -1;

    const numericBefore = before.filter((x) => IS_CODE.test(x.v) && x.v.length <= 10);
    const textBefore    = before.filter((x) => !IS_CODE.test(x.v) || x.v.length > 10);

    if (numericBefore.length > 0 && textBefore.length > 0) {
        codIdx  = numericBefore[0].i;
        descIdx = textBefore.sort((a, b) => b.v.length - a.v.length)[0].i;
    } else if (textBefore.length > 0) {
        descIdx = textBefore.sort((a, b) => b.v.length - a.v.length)[0].i;
        const other = before.find((x) => x.i !== descIdx);
        codIdx = other?.i ?? -1;
    } else if (before.length >= 2) {
        codIdx  = before[0].i;
        descIdx = before[1].i;
    } else if (before.length === 1) {
        descIdx = before[0].i;
    }

    // After-unit numbers: [cuadrilla?] [cantidad] [precio] [parcial?]
    // We need at least cantidad + precio. Cuadrilla is optional.
    const recurIdx    = afterNums.length >= 3 ? afterNums[0].i : -1;
    const cantidadIdx = afterNums.length >= 3 ? afterNums[1].i : afterNums[0].i;
    const precioIdx   = afterNums.length >= 3 ? afterNums[2].i : afterNums[1].i;

    return {
        cod:      codIdx,
        desc:     descIdx,
        unidad:   unidIdx,
        recursos: recurIdx,
        cantidad: cantidadIdx,
        precio:   precioIdx,
    };
}

// ─── ACU init ─────────────────────────────────────────────────────────────────

function emptyAcu(): ParsedAcu {
    return {
        partida_code: '',
        partida_desc: '',
        unidad: '',
        rendimiento: 1,
        mano_de_obra:  [],
        materiales:    [],
        equipos:       [],
        subcontratos:  [],
        subpartidas:   [],
    };
}

// Extract a number from a text like "Rendimiento: 25 m²/Día" or from the next cell
function extractRendimiento(texts: string[], startCol: number): number {
    for (let c = startCol; c < texts.length; c++) {
        const t = texts[c];
        if (!t) continue;
        if (normalize(t).includes('rendimiento')) {
            // Try to extract number from same cell
            const m = t.match(/(\d+(?:[.,]\d+)?)/);
            if (m) return parseFloat(m[1].replace(',', '.'));
            // Try next cell
            for (let c2 = c + 1; c2 <= Math.min(c + 4, texts.length - 1); c2++) {
                const v = parseFloat(texts[c2].replace(',', '.'));
                if (!isNaN(v) && v > 0) return v;
            }
        }
    }
    return 1;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseAcuExcel(file: File): Promise<ParseAcuResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb   = XLSX.read(e.target?.result, { type: 'binary' });
                const acus: ParsedAcu[] = [];
                const warnings: string[] = [];

                for (const sheetName of wb.SheetNames) {
                    const ws = wb.Sheets[sheetName];
                    if (!ws || !ws['!ref']) continue;

                    const range  = XLSX.utils.decode_range(ws['!ref']);
                    const maxC   = range.e.c;

                    let current:      ParsedAcu | null = null;
                    let section:      SectionKey | null = null;
                    let colMap:       ColMap | null = null;      // null = not yet detected
                    let colDetected = false;

                    // Column D (index 3) always holds the partida code in Delphin Express ACU exports.
                    const COL_PARTIDA_D = 3;

                    for (let r = range.s.r; r <= range.e.r; r++) {
                        const texts = rowTexts(ws, r, maxC);
                        const joined = texts.map(normalize).join('|');

                        // ── 1. Column header row — detect BEFORE checking if a partida is open,
                        //    because in Delphin Express the header row often comes before the
                        //    first "PARTIDA:" block and would otherwise be skipped by the
                        //    `if (!current) continue` guard below.
                        //    colMap/colDetected are NOT reset per-partida: layout is fixed for
                        //    the whole file, so one detection suffices for all partidas.
                        if (!colDetected && looksLikeColHeader(joined)) {
                            const detected = detectResourceCols(ws, r, maxC);
                            if (detected) { colMap = detected; colDetected = true; }
                            continue;
                        }

                        // ── 2. Partida header ─────────────────────────────────
                        // Primary: Delphin Express puts the dotted code in column D (index 3).
                        // Fallback: scan all cells when "partida:" colon marker is present.
                        const _hasPartidaKw    = joined.includes('partida');
                        const _hasPartidaColon = joined.includes('partida:') || joined.includes('partida :');
                        const codInD           = (texts[COL_PARTIDA_D] ?? '').trim();
                        const isCodeInD        = /^\d+(\.\d+)*$/.test(codInD) && codInD.length > 0;

                        let foundCode = '';
                        if (_hasPartidaKw && isCodeInD) {
                            foundCode = codInD;
                        } else if (_hasPartidaKw && _hasPartidaColon) {
                            // Fallback: any dotted code in the row (older Delphin Express versions)
                            for (const t of texts) {
                                if (/^\d+(\.\d+)+$/.test(t.trim())) { foundCode = t.trim(); break; }
                            }
                        }

                        if (foundCode) {
                            if (current && current.partida_code) acus.push(current);
                            current = emptyAcu();
                            section = null;
                            // colMap / colDetected intentionally kept — layout is the same throughout

                            current.partida_code = foundCode;

                            // Description: first non-numeric text after the code column
                            const codeCol = isCodeInD ? COL_PARTIDA_D : texts.findIndex((t) => t.trim() === foundCode);
                            for (let c = codeCol + 1; c <= maxC; c++) {
                                const t = texts[c];
                                if (t && !/^\d+(\.\d+)*$/.test(t)) { current.partida_desc = t; break; }
                            }

                            current.rendimiento = extractRendimiento(texts, 0);
                            for (const t of texts) {
                                const m = t.match(/por\s+([^\s:]+)/i);
                                if (m) { current.unidad = m[1].replace(':', ''); break; }
                            }
                            continue;
                        }

                        if (!current) continue;

                        // ── 3. Rendimiento on its own row (some Delphin versions) ──
                        if (!current.rendimiento || current.rendimiento === 1) {
                            const rend = extractRendimiento(texts, 0);
                            if (rend !== 1) current.rendimiento = rend;
                        }

                        // ── 4. Section header — scan ALL cells ────────────────────
                        const detectedSection = detectSectionInRow(texts);
                        if (detectedSection) {
                            section = detectedSection;
                            continue;
                        }

                        if (!section) continue;

                        // ── 5. Skip all-blank rows ─────────────────────────────────
                        if (texts.every((t) => !t)) continue;

                        // ── 6. Auto-detect columns from first resource row (Bug 4 fix)
                        if (!colDetected) {
                            const autoDetected = detectColsFromRow(texts);
                            if (autoDetected) { colMap = autoDetected; colDetected = true; }
                        }

                        // Use detected colMap or fall back to heuristic defaults
                        const cm = colMap;

                        // ── 7. Parse the resource row ──────────────────────────────
                        const desc     = cm ? cellStr(ws, r, cm.desc)     : (texts.find((t, i) => t && i > 0 && !IS_NUMERIC.test(t)) ?? '');
                        const codigo   = cm ? cellStr(ws, r, cm.cod)      : (texts.find((t) => t && IS_CODE.test(t) && t.length <= 10) ?? '');
                        const unidad   = cm ? cellStr(ws, r, cm.unidad)   : (texts.find((t) => UNIT_SET.has(t.toLowerCase())) ?? '');
                        const recursos = cm && cm.recursos >= 0 ? cellNum(ws, r, cm.recursos) : 0;
                        const cantidad = cm ? cellNum(ws, r, cm.cantidad) : 0;
                        const precio   = cm ? cellNum(ws, r, cm.precio)   : 0;

                        if (!desc) continue;

                        // Skip summary/total lines ("Costo de mano de obra", "TOTAL", etc.)
                        const descNorm = normalize(desc);
                        if (descNorm.startsWith('costo') || descNorm === 'total' || descNorm === 'subtotal') continue;
                        if (!codigo && descNorm.startsWith('costo')) continue;

                        // Skip blank data rows
                        if (cantidad === 0 && precio === 0 && recursos === 0) continue;

                        current[section].push({
                            codigo:             codigo || null,
                            descripcion:        desc,
                            unidad:             unidad || '',
                            recursos,
                            cantidad,
                            precio_unitario:    section === 'equipos' ? 0 : precio,
                            precio_hora:        section === 'equipos' ? precio : 0,
                            factor_desperdicio: 1,
                        });
                    }

                    // Flush last ACU of this sheet
                    if (current && current.partida_code) acus.push(current);
                }

                if (acus.length === 0) {
                    warnings.push('No se encontraron ACUs. Verifica que el archivo sea exportado desde Delphin Express.');
                }

                resolve({ acus, warnings });
            } catch (err: any) {
                reject(new Error('Error al leer el archivo ACU: ' + (err?.message ?? 'desconocido')));
            }
        };
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        reader.readAsBinaryString(file);
    });
}
