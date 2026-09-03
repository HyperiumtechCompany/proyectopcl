export interface SurveyPoint {
    este: number; // X (easting)
    norte: number; // Y (northing)
    cota: number; // Z (elevación en metros)
    desc: string;
}

export interface SurveyParseResult {
    points: SurveyPoint[];
    headers: string[];
    /** Índices detectados: [este, norte, cota, desc]. -1 si no se detectó. */
    columnGuess: { este: number; norte: number; cota: number; desc: number };
    skipped: number;
    error?: string;
}

function norm(s: string): string {
    return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
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
 * (`,` `;` tab) y mapea las columnas por encabezado (Este/Norte/Cota/Desc);
 * si no hay encabezado usable, asume el orden Nº, Norte, Este, Cota, Desc.
 */
export function parseSurveyCsv(text: string): SurveyParseResult {
    const empty: SurveyParseResult = {
        points: [],
        headers: [],
        columnGuess: { este: -1, norte: -1, cota: -1, desc: -1 },
        skipped: 0,
    };
    const lines = text
        .split(/\r\n|\r|\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    if (lines.length < 2) {
        return { ...empty, error: 'El texto no tiene filas de datos.' };
    }

    const sep = [',', ';', '\t'].reduce((best, s) =>
        lines[0].split(s).length > lines[0].split(best).length ? s : best,
    );
    const cells = (line: string) => line.split(sep).map((c) => c.trim());

    const first = cells(lines[0]);
    const firstIsHeader = first.some(
        (c) => Number.isNaN(Number(c)) && c !== '',
    );
    const headers = firstIsHeader
        ? first
        : ['n', 'norte', 'este', 'cota', 'descripcion'];
    const dataLines = firstIsHeader ? lines.slice(1) : lines;

    let guess = {
        este: pickColumn(headers, ESTE_KEYS),
        norte: pickColumn(headers, NORTE_KEYS),
        cota: pickColumn(headers, COTA_KEYS),
        desc: pickColumn(headers, DESC_KEYS),
    };
    // Fallback posicional (Nº, Norte, Este, Cota, Desc).
    if (guess.este < 0 && guess.norte < 0 && guess.cota < 0) {
        guess = { norte: 1, este: 2, cota: 3, desc: 4 };
    }

    const points: SurveyPoint[] = [];
    let skipped = 0;
    for (const line of dataLines) {
        const c = cells(line);
        const este = Number(c[guess.este]);
        const norte = Number(c[guess.norte]);
        const cota = Number(c[guess.cota]);
        if (
            !Number.isFinite(este) ||
            !Number.isFinite(norte) ||
            !Number.isFinite(cota)
        ) {
            skipped++;
            continue;
        }
        points.push({
            este,
            norte,
            cota,
            desc: guess.desc >= 0 ? (c[guess.desc] ?? '') : '',
        });
    }

    return {
        points,
        headers,
        columnGuess: guess,
        skipped,
        error:
            points.length === 0
                ? 'Ninguna fila tenía Este/Norte/Cota numéricos.'
                : undefined,
    };
}
