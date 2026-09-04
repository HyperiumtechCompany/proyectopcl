export interface SurveyPoint {
    este: number; // X (easting)
    norte: number; // Y (northing)
    cota: number; // Z (elevación en metros)
    desc: string;
}

export interface ColumnMap {
    este: number;
    norte: number;
    cota: number;
    desc: number;
}

export interface SurveyParseResult {
    points: SurveyPoint[];
    headers: string[];
    /** Todas las celdas de datos (para dejar re-mapear columnas a mano). */
    rows: string[][];
    /** Índices detectados: [este, norte, cota, desc]. -1 si no se detectó. */
    columnGuess: ColumnMap;
    /** Filas con cota inválida/centinela (−99999, etc.). */
    invalidCota: number;
    skipped: number;
    /** Filas donde se corrigió Este↔Norte porque venían invertidas (UTM). */
    swapped: number;
    error?: string;
}

/** Cotas fuera de este rango se consideran "sin dato" (centinelas de campo). */
const COTA_LIMIT = 9000;

function norm(s: string): string {
    return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Parte una línea de CSV respetando comillas (RFC4180-ish): una celda
 * entre comillas puede contener el propio separador (ej. números con coma
 * de miles: `"8,917,727.900"`) sin que la fila se desalinee.
 */
function splitCsvLine(line: string, sep: string): string[] {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === sep) {
            cells.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    cells.push(cur.trim());
    return cells;
}

/**
 * Convierte una celda numérica a `number`, tolerando coma de miles dentro
 * de un valor entre comillas (`"374,837.180"` → 374837.18). El separador
 * decimal siempre es `.` en estos levantamientos (formato US/Excel).
 */
function parseCellNumber(s: string | undefined): number {
    if (s === undefined) return NaN;
    return Number(s.replace(/,/g, '').trim());
}

const ESTE_KEYS = ['este', 'x', 'e', 'easting'];
const NORTE_KEYS = ['norte', 'y', 'n', 'northing'];
const COTA_KEYS = ['cota', 'z', 'elev', 'elevacion', 'altura'];
const DESC_KEYS = ['descripcion', 'desc', 'codigo', 'punto', 'nombre'];

function pickColumn(headers: string[], keys: string[]): number {
    for (let i = 0; i < headers.length; i++) {
        if (keys.includes(norm(headers[i]))) return i;
    }
    return -1;
}

/**
 * Parsea un CSV de levantamiento topográfico. Autodetecta el separador
 * (`,` `;` tab), mapea columnas por encabezado (o por posición), descarta
 * cotas centinela (±99999), y corrige filas con Este↔Norte invertidos
 * (frecuente en exportaciones mixtas: en UTM peruano el Norte es ~8-9 M y
 * el Este ~0,1-0,8 M). `override` fuerza el mapeo de columnas.
 */
export function parseSurveyCsv(
    text: string,
    override?: Partial<ColumnMap>,
): SurveyParseResult {
    const empty: SurveyParseResult = {
        points: [],
        headers: [],
        rows: [],
        columnGuess: { este: -1, norte: -1, cota: -1, desc: -1 },
        invalidCota: 0,
        skipped: 0,
        swapped: 0,
    };
    const lines = text
        .split(/\r\n|\r|\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    if (lines.length < 2) {
        return { ...empty, error: 'El texto no tiene filas de datos.' };
    }

    const sep = [',', ';', '\t'].reduce((best, s) =>
        splitCsvLine(lines[0], s).length > splitCsvLine(lines[0], best).length
            ? s
            : best,
    );
    const cells = (line: string) => splitCsvLine(line, sep);

    const first = cells(lines[0]);
    const firstIsHeader = first.some(
        (c) => Number.isNaN(Number(c)) && c !== '',
    );
    const headers = firstIsHeader
        ? first
        : ['n', 'norte', 'este', 'cota', 'descripcion'];
    const rows = (firstIsHeader ? lines.slice(1) : lines).map(cells);

    let guess: ColumnMap = {
        este: pickColumn(headers, ESTE_KEYS),
        norte: pickColumn(headers, NORTE_KEYS),
        cota: pickColumn(headers, COTA_KEYS),
        desc: pickColumn(headers, DESC_KEYS),
    };
    if (guess.este < 0 && guess.norte < 0 && guess.cota < 0) {
        guess = { norte: 1, este: 2, cota: 3, desc: 4 };
    }
    const map: ColumnMap = { ...guess, ...override };

    const points: SurveyPoint[] = [];
    let skipped = 0;
    let invalidCota = 0;
    let swapped = 0;
    for (const c of rows) {
        let este = parseCellNumber(c[map.este]);
        let norte = parseCellNumber(c[map.norte]);
        const cota = parseCellNumber(c[map.cota]);
        if (!Number.isFinite(este) || !Number.isFinite(norte)) {
            skipped++;
            continue;
        }
        // Este↔Norte invertidos: en UTM el Norte es siempre mucho mayor.
        if (norte < este && este > 1_000_000) {
            [este, norte] = [norte, este];
            swapped++;
        }
        if (!Number.isFinite(cota) || Math.abs(cota) > COTA_LIMIT) {
            invalidCota++;
            continue;
        }
        points.push({
            este,
            norte,
            cota,
            desc: map.desc >= 0 ? (c[map.desc] ?? '') : '',
        });
    }

    return {
        points,
        headers,
        rows,
        columnGuess: map,
        invalidCota,
        skipped,
        swapped,
        error:
            points.length === 0
                ? 'Ninguna fila tenía Este/Norte/Cota válidos. Revisa el mapeo de columnas.'
                : undefined,
    };
}
