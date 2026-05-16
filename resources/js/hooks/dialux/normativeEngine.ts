/**
 * normativeEngine.ts
 *
 * Motor de reglas normativas para el módulo de Normativas del Proyecto DIALux.
 *
 * Funciones principales:
 *  - resolveApplicableNorms(): detecta normas aplicables según país/región
 *  - evaluateCompliance():     valida resultados de cálculo vs norma seleccionada
 *  - compareNormsForActivity(): tabla comparativa entre normas para la misma actividad
 *  - findBestMatchActivity():   busca la actividad más parecida en una norma
 *
 * DISCLAIMER DE FUENTES:
 *  - EN 12464-1: Norma Europea publicada por CEN/TC 169 (versión 2021).
 *    Los valores numéricos son parámetros técnicos fácticos de dominio público.
 *  - IES HB-10: Illuminating Engineering Society Lighting Handbook.
 *    Los valores son referencias técnicas fácticas de dominio público.
 *  - RNE EM.010: Reglamento Nacional de Edificaciones - MVCS Perú (D.S. N°006-2014-V).
 *    Norma oficial peruana de carácter público.
 *  - NFPA 101: Life Safety Code - National Fire Protection Association (estructura base).
 *  - DS-024-2016-EM: Reglamento de Seguridad en Minería - MEM Perú (estructura base).
 */

import type { NormativeStandard } from './roomLighting';
import { en12464Regulations, iesnaRegulations, rnePeruRegulations} from './normativaData';
import type { RawNormativeLeaf, RawNormativeBranch } from './normativaData';
import type { LightingResult, Room } from './types';

// ─── Tipos del Motor ──────────────────────────────────────────────────────────

export type ComplianceStatus =
    | 'compliant'      // ✅ cumple plenamente
    | 'non_compliant'  // ❌ no cumple
    | 'warning'        // ⚠️ cumple mínimo pero roza el límite
    | 'needs_review';  // 🔍 falta dato para evaluar

export type LegalStatus = 'mandatory' | 'recommended' | 'reference';
export type NormativeRegionId = 'europe' | 'americas_usa' | 'americas_peru';

export interface ComplianceResult {
    parameterId: string;
    parameterName: string;
    requiredValue: number | null;
    calculatedValue: number | null;
    unit: string;
    status: ComplianceStatus;
    message: string;
    normativeSource: string;
}

export interface NormativeStandardMeta {
    id: NormativeStandard;
    name: string;
    fullName: string;
    region: NormativeRegionId;
    country: string;
    source: string;
    version: string;
    year: number;
    authority: string;
    legalStatus: LegalStatus;
    active: boolean;
    notes: string;
    url?: string;
    disclaimer: string;
}

export interface NormativeCountry {
    code: string;
    name: string;
    flag: string;
    defaultStandard: NormativeStandard;
    applicableStandards: NormativeStandard[];
    priorityOrder: NormativeStandard[];
}

export interface NormativeRegion {
    id: NormativeRegionId;
    name: string;
    countries: NormativeCountry[];
}

export interface NormativeComparisonEntry {
    standard: NormativeStandard;
    standardLabel: string;
    legalStatus: LegalStatus;
    activityTitle: string;
    illuminanceLux: number;
    ugr: number | null;
    uniformity: number | null;
    ra: number | null;
    specificRequirements: string | null;
}

export interface NormativeLeafOption {
    title: string;
    label: string;
    illuminanceLux: number;
    ugr: number | null;
    uniformity: number | null;
    ra: number | null;
    specificRequirements: string | null;
}

// ─── Metadatos de Normas ──────────────────────────────────────────────────────

const EN_DISCLAIMER =
    'Valores basados en EN 12464-1:2021 (CEN/TC 169). Parámetros técnicos fácticos de dominio público. Para información completa consulte la publicación oficial.';

const IES_DISCLAIMER =
    'Valores basados en IES Lighting Handbook HB-10-17 (Illuminating Engineering Society). Parámetros técnicos fácticos de dominio público. Para información completa consulte las publicaciones oficiales de la IES.';

const RNE_DISCLAIMER =
    'Valores basados en Norma EM.010 del Reglamento Nacional de Edificaciones (MVCS - D.S. N°006-2014-V). Norma oficial peruana de carácter público.';

const NFPA_DISCLAIMER =
    'Valores basados en NFPA 101 Life Safety Code (National Fire Protection Association). Para información completa consulte la publicación oficial.';

const DS024_DISCLAIMER =
    'Valores basados en DS-024-2016-EM (Reglamento de Seguridad y Salud Ocupacional en Minería - MEM Perú). Norma oficial peruana de carácter público.';

export const NORMATIVE_STANDARDS_META: Record<NormativeStandard, NormativeStandardMeta> = {
    en_12464: {
        id: 'en_12464',
        name: 'EN 12464-1',
        fullName: 'Iluminación de lugares de trabajo en interiores',
        region: 'europe',
        country: 'EU',
        source: 'EN 12464-1:2021',
        version: '2021',
        year: 2021,
        authority: 'CEN/TC 169',
        legalStatus: 'recommended',
        active: true,
        notes: 'Norma europea de referencia internacional. Aplicable como norma de referencia en Perú y Latinoamérica.',
        url: 'https://www.en-standard.eu',
        disclaimer: EN_DISCLAIMER,
    },
    ies_na: {
        id: 'ies_na',
        name: 'IES HB-10',
        fullName: 'IES Lighting Handbook – North America',
        region: 'americas_usa',
        country: 'US',
        source: 'IES HB-10-17',
        version: 'HB-10-17',
        year: 2017,
        authority: 'Illuminating Engineering Society (IES)',
        legalStatus: 'recommended',
        active: true,
        notes: 'Referencia técnica de iluminación de Norteamérica.',
        url: 'https://www.ies.org',
        disclaimer: IES_DISCLAIMER,
    },
    rne_peru: {
        id: 'rne_peru',
        name: 'RNE EM.010',
        fullName: 'Reglamento Nacional de Edificaciones – EM.010 Instalaciones Eléctricas',
        region: 'americas_peru',
        country: 'PE',
        source: 'RNE EM.010 (D.S. N°006-2014-V)',
        version: '2014',
        year: 2014,
        authority: 'MVCS – Ministerio de Vivienda, Construcción y Saneamiento',
        legalStatus: 'mandatory',
        active: true,
        notes: 'Norma obligatoria en el Perú para instalaciones eléctricas en edificaciones.',
        url: 'https://www.gob.pe/mvcs',
        disclaimer: RNE_DISCLAIMER,
    },
    nfpa101: {
        id: 'nfpa101',
        name: 'NFPA 101',
        fullName: 'Life Safety Code – Emergency Lighting',
        region: 'americas_usa',
        country: 'US',
        source: 'NFPA 101:2021',
        version: '2021',
        year: 2021,
        authority: 'National Fire Protection Association (NFPA)',
        legalStatus: 'reference',
        active: true,
        notes: 'Norma de referencia para iluminación de emergencia y seguridad. Estructura base incluida; valores detallados por actividad en proceso de carga.',
        url: 'https://www.nfpa.org',
        disclaimer: NFPA_DISCLAIMER,
    },
    ds024: {
        id: 'ds024',
        name: 'DS-024-2016',
        fullName: 'Reglamento de Seguridad y Salud Ocupacional en Minería',
        region: 'americas_peru',
        country: 'PE',
        source: 'DS-024-2016-EM',
        version: '2016',
        year: 2016,
        authority: 'Ministerio de Energía y Minas del Perú (MEM)',
        legalStatus: 'mandatory',
        active: true,
        notes: 'Norma obligatoria para instalaciones mineras en el Perú. Estructura base incluida; valores detallados por actividad en proceso de carga.',
        url: 'https://www.gob.pe/minem',
        disclaimer: DS024_DISCLAIMER,
    },
} as const;

// ─── Mapa de Regiones y Países ────────────────────────────────────────────────

export const NORMATIVE_REGIONS: NormativeRegion[] = [
    {
        id: 'americas_peru',
        name: 'Perú',
        countries: [
            {
                code: 'PE',
                name: 'Perú',
                flag: '🇵🇪',
                defaultStandard: 'rne_peru',
                applicableStandards: ['rne_peru', 'en_12464', 'ds024'],
                priorityOrder: ['rne_peru', 'en_12464', 'ies_na'],
            },
        ],
    },
    {
        id: 'europe',
        name: 'Europa',
        countries: [
            {
                code: 'DE',
                name: 'Alemania',
                flag: '🇩🇪',
                defaultStandard: 'en_12464',
                applicableStandards: ['en_12464'],
                priorityOrder: ['en_12464'],
            },
            {
                code: 'ES',
                name: 'España',
                flag: '🇪🇸',
                defaultStandard: 'en_12464',
                applicableStandards: ['en_12464'],
                priorityOrder: ['en_12464'],
            },
            {
                code: 'FR',
                name: 'Francia',
                flag: '🇫🇷',
                defaultStandard: 'en_12464',
                applicableStandards: ['en_12464'],
                priorityOrder: ['en_12464'],
            },
            {
                code: 'IT',
                name: 'Italia',
                flag: '🇮🇹',
                defaultStandard: 'en_12464',
                applicableStandards: ['en_12464'],
                priorityOrder: ['en_12464'],
            },
        ],
    },
    {
        id: 'americas_usa',
        name: 'Norteamérica',
        countries: [
            {
                code: 'US',
                name: 'Estados Unidos',
                flag: '🇺🇸',
                defaultStandard: 'ies_na',
                applicableStandards: ['ies_na', 'nfpa101'],
                priorityOrder: ['ies_na', 'nfpa101'],
            },
            {
                code: 'CA',
                name: 'Canadá',
                flag: '🇨🇦',
                defaultStandard: 'ies_na',
                applicableStandards: ['ies_na'],
                priorityOrder: ['ies_na'],
            },
        ],
    },
];

// ─── Funciones del Motor ──────────────────────────────────────────────────────

/**
 * Retorna las normas aplicables para un país dado, en orden de prioridad.
 * La norma local/obligatoria siempre va primero.
 */
export function resolveApplicableNorms(countryCode: string): NormativeStandard[] {
    for (const region of NORMATIVE_REGIONS) {
        const country = region.countries.find((c) => c.code === countryCode);
        if (country) {
            return country.priorityOrder;
        }
    }
    // Fallback: EN 12464 como referencia internacional
    return ['en_12464'];
}

/**
 * Retorna el país y su configuración normativa a partir del código de país.
 */
export function resolveCountryConfig(countryCode: string): NormativeCountry | null {
    for (const region of NORMATIVE_REGIONS) {
        const country = region.countries.find((c) => c.code === countryCode);
        if (country) {
            return country;
        }
    }
    return null;
}

/**
 * Retorna la norma primaria (obligatoria o por defecto) para un país.
 */
export function resolvePrimaryStandard(countryCode: string): NormativeStandard {
    const config = resolveCountryConfig(countryCode);
    return config?.defaultStandard ?? 'en_12464';
}

/**
 * Flattening recursivo del árbol normativo para una norma específica.
 * Retorna array plano de hojas con categoría y sección padres.
 */
function flattenNormTree(
    branches: Array<RawNormativeBranch | RawNormativeLeaf>,
    categoryTitle = '',
    sectionTitle = '',
): Array<NormativeLeafOption & { category: string; section: string }> {
    const leaves: Array<NormativeLeafOption & { category: string; section: string }> = [];

    for (const node of branches) {
        if ('iluminancia_lux' in node) {
            // Es una hoja
            const leaf = node as RawNormativeLeaf;
            leaves.push({
                title: leaf.title,
                label: leaf.label,
                illuminanceLux: leaf.iluminancia_lux,
                ugr: leaf.UGR,
                uniformity: leaf.Uo,
                ra: leaf.Ra,
                specificRequirements: leaf.requisitos_especificos,
                category: categoryTitle,
                section: sectionTitle,
            });
        } else {
            // Es una rama
            const branch = node as RawNormativeBranch;
            const newCategory = categoryTitle || branch.title;
            const newSection = categoryTitle ? branch.title : sectionTitle;

            if (branch.subsubsections) {
                for (const leaf of branch.subsubsections) {
                    leaves.push({
                        title: leaf.title,
                        label: leaf.label,
                        illuminanceLux: leaf.iluminancia_lux,
                        ugr: leaf.UGR,
                        uniformity: leaf.Uo,
                        ra: leaf.Ra,
                        specificRequirements: leaf.requisitos_especificos,
                        category: newCategory,
                        section: newSection,
                    });
                }
            }
            if (branch.subsections) {
                leaves.push(...flattenNormTree(branch.subsections, newCategory, newSection));
            }
        }
    }

    return leaves;
}

/**
 * Retorna los datos normativos de una norma según su ID.
 */
function getNormData(standard: NormativeStandard): RawNormativeBranch[] {
    switch (standard) {
        case 'en_12464':
            return en12464Regulations;
        case 'ies_na':
            return iesnaRegulations;
        case 'rne_peru':
            return rnePeruRegulations;
        default:
            return [];
    }
}

/**
 * Busca la mejor actividad en una norma dado un texto de búsqueda.
 * Usa coincidencia de palabras clave en title y label.
 */
export function findBestMatchActivity(
    standard: NormativeStandard,
    searchText: string,
    category?: string,
): NormativeLeafOption | null {
    const data = getNormData(standard);
    if (!data.length) {
        return null;
    }

    const flat = flattenNormTree(data);
    const query = searchText.toLowerCase();

    // Prioridad 1: coincidencia exacta en title
    const exactTitle = flat.find((l) => l.title.toLowerCase() === query);
    if (exactTitle) {
        return exactTitle;
    }

    // Prioridad 2: título contiene la búsqueda
    const titleContains = flat.find((l) => l.title.toLowerCase().includes(query));
    if (titleContains) {
        return titleContains;
    }

    // Prioridad 3: label contiene la búsqueda
    const labelContains = flat.find((l) => l.label.toLowerCase().includes(query));
    if (labelContains) {
        return labelContains;
    }

    // Prioridad 4: filtrar por categoría si se provee
    if (category) {
        const catLower = category.toLowerCase();
        const catMatch = flat.find((l) => l.category.toLowerCase().includes(catLower));
        if (catMatch) {
            return catMatch;
        }
    }

    return null;
}

// ─── Evaluación de Cumplimiento ───────────────────────────────────────────────

/** Umbral de "advertencia": dentro del 15% del límite mínimo */
const WARNING_THRESHOLD_PERCENT = 0.15;

function luxStatus(calculated: number, required: number): ComplianceStatus {
    if (calculated >= required) {
        if (calculated < required * (1 + WARNING_THRESHOLD_PERCENT)) {
            return 'warning'; // Cumple pero muy justo
        }
        return 'compliant';
    }
    return 'non_compliant';
}

function ugrStatus(calculated: number, limit: number | null): ComplianceStatus {
    if (limit === null) {
        return 'needs_review';
    }
    if (calculated <= limit) {
        if (calculated > limit * (1 - WARNING_THRESHOLD_PERCENT)) {
            return 'warning';
        }
        return 'compliant';
    }
    return 'non_compliant';
}

function uniformityStatus(calculated: number, required: number | null): ComplianceStatus {
    if (required === null) {
        return 'needs_review';
    }
    if (calculated >= required) {
        if (calculated < required * (1 + WARNING_THRESHOLD_PERCENT)) {
            return 'warning';
        }
        return 'compliant';
    }
    return 'non_compliant';
}

/**
 * Evalúa el cumplimiento de un recinto contra su norma seleccionada.
 * Usa los resultados del motor de cálculo (isolux / lightingCalculations).
 */
export function evaluateCompliance(
    room: Room,
    result: LightingResult,
    normative: NormativeLeafOption,
    standardMeta?: NormativeStandardMeta,
): ComplianceResult[] {
    const source = standardMeta?.source ?? 'Norma seleccionada';
    const results: ComplianceResult[] = [];

    // 1. Iluminancia media (Em)
    const luxSt = luxStatus(result.avg_lux, normative.illuminanceLux);
    results.push({
        parameterId: 'em',
        parameterName: 'Iluminancia media (Em)',
        requiredValue: normative.illuminanceLux,
        calculatedValue: result.avg_lux,
        unit: 'lux',
        status: luxSt,
        message: luxSt === 'compliant'
            ? `Em ${result.avg_lux.toFixed(0)} lux ≥ ${normative.illuminanceLux} lux requerido`
            : luxSt === 'warning'
            ? `Em ${result.avg_lux.toFixed(0)} lux cumple pero muy próximo al mínimo`
            : `Em ${result.avg_lux.toFixed(0)} lux < ${normative.illuminanceLux} lux requerido`,
        normativeSource: source,
    });

    // 2. Uniformidad (Uo)
    const uoSt = uniformityStatus(result.uniformity, normative.uniformity);
    results.push({
        parameterId: 'uo',
        parameterName: 'Uniformidad (Uo)',
        requiredValue: normative.uniformity,
        calculatedValue: result.uniformity,
        unit: '',
        status: uoSt,
        message: normative.uniformity === null
            ? 'Uniformidad no especificada en esta norma/actividad'
            : uoSt === 'compliant'
            ? `Uo ${result.uniformity.toFixed(3)} ≥ ${normative.uniformity} requerido`
            : uoSt === 'warning'
            ? `Uo ${result.uniformity.toFixed(3)} cumple pero próximo al mínimo`
            : `Uo ${result.uniformity.toFixed(3)} < ${normative.uniformity} requerido`,
        normativeSource: source,
    });

    // 3. UGR
    const ugrSt = ugrStatus(result.ugr, normative.ugr);
    results.push({
        parameterId: 'ugr',
        parameterName: 'Índice de deslumbramiento (UGR)',
        requiredValue: normative.ugr,
        calculatedValue: result.ugr,
        unit: '',
        status: ugrSt,
        message: normative.ugr === null
            ? 'UGR no especificado en esta norma/actividad'
            : ugrSt === 'compliant'
            ? `UGR ${result.ugr.toFixed(1)} ≤ ${normative.ugr} límite`
            : ugrSt === 'warning'
            ? `UGR ${result.ugr.toFixed(1)} cumple pero próximo al límite`
            : `UGR ${result.ugr.toFixed(1)} > ${normative.ugr} límite`,
        normativeSource: source,
    });

    // 4. Ra (si está disponible en el recinto y en la norma)
    const raRequired = normative.ra;
    const raCalculated = room.colorRenderingRa ?? null;

    if (raRequired !== null) {
        const raSt: ComplianceStatus =
            raCalculated === null
                ? 'needs_review'
                : raCalculated >= raRequired
                ? raCalculated < raRequired * (1 + WARNING_THRESHOLD_PERCENT)
                    ? 'warning'
                    : 'compliant'
                : 'non_compliant';

        results.push({
            parameterId: 'ra',
            parameterName: 'Índice de reproducción cromática (Ra)',
            requiredValue: raRequired,
            calculatedValue: raCalculated,
            unit: '',
            status: raSt,
            message: raCalculated === null
                ? 'Ra de la luminaria no especificado — revisar producto seleccionado'
                : raSt === 'compliant'
                ? `Ra ${raCalculated} ≥ ${raRequired} requerido`
                : raSt === 'warning'
                ? `Ra ${raCalculated} cumple pero próximo al mínimo`
                : `Ra ${raCalculated} < ${raRequired} requerido`,
            normativeSource: source,
        });
    }

    return results;
}

/**
 * Genera el estado global de cumplimiento de un recinto a partir de los resultados individuales.
 */
export function computeOverallStatus(results: ComplianceResult[]): ComplianceStatus {
    if (results.some((r) => r.status === 'non_compliant')) {
        return 'non_compliant';
    }
    if (results.some((r) => r.status === 'warning')) {
        return 'warning';
    }
    if (results.some((r) => r.status === 'needs_review')) {
        return 'needs_review';
    }
    return 'compliant';
}

// ─── Comparación entre Normas ─────────────────────────────────────────────────

/**
 * Compara los requisitos para una actividad dada entre todas las normas disponibles.
 * Útil para el modal de comparación normativa.
 */
export function compareNormsForActivity(
    searchText: string,
    standards: NormativeStandard[] = ['rne_peru', 'en_12464', 'ies_na'],
): NormativeComparisonEntry[] {
    const entries: NormativeComparisonEntry[] = [];

    for (const standard of standards) {
        const meta = NORMATIVE_STANDARDS_META[standard];
        if (!meta) {
            continue;
        }

        const match = findBestMatchActivity(standard, searchText);
        if (match) {
            entries.push({
                standard,
                standardLabel: meta.name,
                legalStatus: meta.legalStatus,
                activityTitle: match.title,
                illuminanceLux: match.illuminanceLux,
                ugr: match.ugr,
                uniformity: match.uniformity,
                ra: match.ra,
                specificRequirements: match.specificRequirements,
            });
        } else {
            // Norma sin datos para esta actividad (estructura base)
            entries.push({
                standard,
                standardLabel: meta.name,
                legalStatus: meta.legalStatus,
                activityTitle: 'No disponible en esta versión',
                illuminanceLux: 0,
                ugr: null,
                uniformity: null,
                ra: null,
                specificRequirements: meta.notes,
            });
        }
    }

    return entries;
}

/**
 * Retorna la norma más exigente (mayor iluminancia requerida) entre las entradas de comparación.
 */
export function findMostStrictNorm(
    comparison: NormativeComparisonEntry[],
): NormativeComparisonEntry | null {
    if (!comparison.length) {
        return null;
    }
    return comparison.reduce((prev, curr) =>
        curr.illuminanceLux > prev.illuminanceLux ? curr : prev,
    );
}

/**
 * Retorna el disclaimer completo para una norma.
 */
export function getNormDisclaimer(standard: NormativeStandard): string {
    return NORMATIVE_STANDARDS_META[standard]?.disclaimer ?? '';
}

/**
 * Retorna las instalaciones types disponibles con etiquetas amigables.
 */
export function getInstallationTypes(): Array<{
    id: string;
    label: string;
    icon: string;
    description: string;
}> {
    return [
        { id: 'vivienda',    label: 'Vivienda',          icon: '🏠', description: 'Casas, departamentos, edificios residenciales' },
        { id: 'educacion',   label: 'Educación',         icon: '🏫', description: 'Colegios, universidades, centros de formación' },
        { id: 'salud',       label: 'Salud',             icon: '🏥', description: 'Hospitales, clínicas, centros médicos' },
        { id: 'oficina',     label: 'Oficinas',          icon: '🏢', description: 'Oficinas, salas de reuniones, espacios de trabajo' },
        { id: 'industria',   label: 'Industria',         icon: '🏭', description: 'Fábricas, plantas industriales, talleres' },
        { id: 'comercio',    label: 'Comercio',          icon: '🛒', description: 'Tiendas, centros comerciales, locales' },
        { id: 'deportes',    label: 'Deportes',          icon: '⚽', description: 'Canchas, estadios, gimnasios, piscinas' },
        { id: 'transporte',  label: 'Transporte',        icon: '🚉', description: 'Aeropuertos, estaciones, terminales' },
        { id: 'mineria',     label: 'Minería',           icon: '⛏️', description: 'Minas, plantas de procesamiento, túneles' },
        { id: 'emergencia',  label: 'Emergencia',        icon: '🚨', description: 'Vías de evacuación, iluminación de seguridad' },
    ];
}
