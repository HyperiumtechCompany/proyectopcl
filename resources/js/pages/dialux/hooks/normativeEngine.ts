/**
 * normativeEngine.ts
 *
 * Motor de reglas normativas para el mÃ³dulo de Normativas del Proyecto DIALux.
 *
 * Funciones principales:
 *  - resolveApplicableNorms(): detecta normas aplicables segÃºn paÃ­s/regiÃ³n
 *  - evaluateCompliance():     valida resultados de cÃ¡lculo vs norma seleccionada
 *  - compareNormsForActivity(): tabla comparativa entre normas para la misma actividad
 *  - findBestMatchActivity():   busca la actividad mÃ¡s parecida en una norma
 *
 * DISCLAIMER DE FUENTES:
 *  - EN 12464-1: Norma Europea publicada por CEN/TC 169 (versiÃ³n 2021).
 *    Los valores numÃ©ricos son parÃ¡metros tÃ©cnicos fÃ¡cticos de dominio pÃºblico.
 *  - IES HB-10: Illuminating Engineering Society Lighting Handbook.
 *    Los valores son referencias tÃ©cnicas fÃ¡cticas de dominio pÃºblico.
 *  - RNE EM.010: Reglamento Nacional de Edificaciones - MVCS PerÃº (D.S. NÂ°006-2014-V).
 *    Norma oficial peruana de carÃ¡cter pÃºblico.
 *  - EN 1838: Norma Europea de alumbrado de emergencia publicada por CEN/TC 169 (versiÃ³n 2019).
 *    Los valores numÃ©ricos son parÃ¡metros tÃ©cnicos fÃ¡cticos de dominio pÃºblico.
 *  - NFPA 101: Life Safety Code - National Fire Protection Association (estructura base, sin catÃ¡logo cargado aÃºn).
 *  - DS-024-2016-EM: Reglamento de Seguridad en MinerÃ­a - MEM PerÃº (estructura base, sin catÃ¡logo cargado aÃºn).
 */

import { a130Regulations, en12464Regulations, en1838Regulations, iesnaRegulations, rnePeruRegulations} from './normativaData';
import type { RawNormativeLeaf, RawNormativeBranch } from './normativaData';
import type { NormativeStandard } from './roomLighting';
import type { Fixture, LightingResult, Room } from './types';

// â”€â”€â”€ Tipos del Motor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type ComplianceStatus =
    | 'compliant'      // âœ… cumple plenamente
    | 'non_compliant'  // âŒ no cumple
    | 'warning'        // âš ï¸ cumple mÃ­nimo pero roza el lÃ­mite
    | 'needs_review';  // ðŸ” falta dato para evaluar

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

// â”€â”€â”€ Metadatos de Normas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EN_DISCLAIMER =
    'Valores basados en EN 12464-1:2021 (CEN/TC 169). ParÃ¡metros tÃ©cnicos fÃ¡cticos de dominio pÃºblico. Para informaciÃ³n completa consulte la publicaciÃ³n oficial.';

const IES_DISCLAIMER =
    'Valores basados en IES Lighting Handbook HB-10-17 (Illuminating Engineering Society). ParÃ¡metros tÃ©cnicos fÃ¡cticos de dominio pÃºblico. Para informaciÃ³n completa consulte las publicaciones oficiales de la IES.';

const RNE_DISCLAIMER =
    'Valores basados en Norma EM.010 del Reglamento Nacional de Edificaciones (MVCS - D.S. NÂ°006-2014-V). Norma oficial peruana de carÃ¡cter pÃºblico.';

// Fase 14 (plan maestro Â§11): la ediciÃ³n citada anteriormente aquÃ­
// ("EN 1838:2019") no existe en el catÃ¡logo pÃºblico de CEN/BSI â€” las
// ediciones reales son 1999 â†’ 2013 (retirada 18-dic-2024) â†’ 2024
// (vigente). Los valores numÃ©ricos ya cargados en `en1838Regulations`
// (1 lx eje de ruta, 0.5 lx antipÃ¡nico, 40:1, 50%@5s/100%@60s, 1h)
// coinciden con fuentes secundarias convergentes para la ediciÃ³n 2013 â€”
// se cita esa ediciÃ³n porque es la que respalda los valores YA cargados,
// no porque se haya verificado el texto de pago de la ediciÃ³n 2024
// (ver `planes/fase14_progreso_dialux.md`, matriz normativa). EN 1838
// NO tiene adopciÃ³n legal en PerÃº â€” usar solo como referencia
// complementaria de buena prÃ¡ctica, nunca como fuente obligatoria para
// un proyecto peruano (esa es RNE A.130, ver `RNE_A130_DISCLAIMER`).
const EN_1838_DISCLAIMER =
    'Valores basados en EN 1838:2013 (Aplicaciones de la iluminaciÃ³n â€” Alumbrado de emergencia), publicada por CEN/TC 169 â€” ediciÃ³n retirada el 18-dic-2024, sustituida por EN 1838:2024 (valores exactos de esa ediciÃ³n nueva no verificados en este sistema). ParÃ¡metros tÃ©cnicos fÃ¡cticos de dominio pÃºblico. NO tiene adopciÃ³n legal en PerÃº: Ãºsese solo como referencia de buena prÃ¡ctica internacional, nunca como sustituto de RNE A.130. Para informaciÃ³n completa consulte la publicaciÃ³n oficial.';

const RNE_A130_DISCLAIMER =
    'Valores basados en RNE Norma A.130 "Requisitos de Seguridad" (D.S. NÂ°017-2012-VIVIENDA), ArtÃ­culos 39-41. Norma oficial peruana de carÃ¡cter pÃºblico y de cumplimiento obligatorio â€” es la fuente legal para alumbrado de emergencia en PerÃº (a diferencia de RNE EM.010, que no trata este tema). El Art. 40 inciso d) remite a CNE Tomo V (UtilizaciÃ³n) Art. 7.1.2.1 para las conexiones elÃ©ctricas del circuito â€” ese artÃ­culo especÃ­fico no estÃ¡ verificado en este sistema.';

const NFPA_DISCLAIMER =
    'Valores basados en NFPA 101 Life Safety Code (National Fire Protection Association). Para informaciÃ³n completa consulte la publicaciÃ³n oficial.';

const DS024_DISCLAIMER =
    'Valores basados en DS-024-2016-EM (Reglamento de Seguridad y Salud Ocupacional en MinerÃ­a - MEM PerÃº). Norma oficial peruana de carÃ¡cter pÃºblico.';

export const NORMATIVE_STANDARDS_META: Record<NormativeStandard, NormativeStandardMeta> = {
    en_12464: {
        id: 'en_12464_1',
        name: 'EN 12464-1',
        fullName: 'IluminaciÃ³n de lugares de trabajo en interiores',
        region: 'europe',
        country: 'EU',
        source: 'EN 12464-1:2021',
        version: '2021',
        year: 2021,
        authority: 'CEN/TC 169',
        legalStatus: 'recommended',
        active: true,
        notes: 'Norma europea de referencia internacional. Aplicable como norma de referencia en PerÃº y LatinoamÃ©rica.',
        url: 'https://www.en-standard.eu',
        disclaimer: EN_DISCLAIMER,
    },
    ies_na: {
        id: 'ies_na',
        name: 'IES HB-10',
        fullName: 'IES Lighting Handbook â€“ North America',
        region: 'americas_usa',
        country: 'US',
        source: 'IES HB-10-17',
        version: 'HB-10-17',
        year: 2017,
        authority: 'Illuminating Engineering Society (IES)',
        legalStatus: 'recommended',
        active: true,
        notes: 'Referencia tÃ©cnica de iluminaciÃ³n de NorteamÃ©rica.',
        url: 'https://www.ies.org',
        disclaimer: IES_DISCLAIMER,
    },
    rne_peru: {
        id: 'rne_peru',
        name: 'RNE EM.010',
        fullName: 'Reglamento Nacional de Edificaciones â€“ EM.010 Instalaciones ElÃ©ctricas',
        region: 'americas_peru',
        country: 'PE',
        source: 'RNE EM.010 (D.S. NÂ°006-2014-V)',
        version: '2014',
        year: 2014,
        authority: 'MVCS â€“ Ministerio de Vivienda, ConstrucciÃ³n y Saneamiento',
        legalStatus: 'mandatory',
        active: true,
        notes: 'Norma obligatoria en el PerÃº para instalaciones elÃ©ctricas en edificaciones.',
        url: 'https://www.gob.pe/mvcs',
        disclaimer: RNE_DISCLAIMER,
    },
    // Fase 14 (plan maestro Â§11, "Emergencia"): fuente OBLIGATORIA real
    // para alumbrado de emergencia en PerÃº â€” RNE EM.010 (arriba) no trata
    // este tema en absoluto (verificado por texto completo del documento
    // oficial, cero coincidencias de "alumbrado de emergencia"/"evacuaciÃ³n").
    rne_a130: {
        id: 'rne_a130',
        name: 'RNE A.130',
        fullName: 'Reglamento Nacional de Edificaciones â€” A.130 Requisitos de Seguridad (Arts. 39-41)',
        region: 'americas_peru',
        country: 'PE',
        source: 'RNE A.130 (D.S. NÂ°017-2012-VIVIENDA), Arts. 39-41',
        version: '2012',
        year: 2012,
        authority: 'MVCS â€“ Ministerio de Vivienda, ConstrucciÃ³n y Saneamiento',
        legalStatus: 'mandatory',
        active: true,
        notes: 'Norma obligatoria en el PerÃº para alumbrado de emergencia (10 lx a nivel de piso en medios de evacuaciÃ³n, autonomÃ­a 1Â½ h, transferencia â‰¤10 s, seÃ±alizaciÃ³n segÃºn NTP 399.010-1). No define Ã¡reas antipÃ¡nico ni relaciÃ³n de uniformidad â€” ver EN 1838 como referencia complementaria opcional para esos conceptos.',
        url: 'https://www.gob.pe/mvcs',
        disclaimer: RNE_A130_DISCLAIMER,
    },
    en_1838: {
        id: 'en_1838',
        name: 'EN 1838',
        fullName: 'Aplicaciones de la iluminaciÃ³n â€” Alumbrado de emergencia',
        region: 'europe',
        country: 'EU',
        source: 'EN 1838:2013',
        version: '2013',
        year: 2013,
        authority: 'CEN/TC 169',
        legalStatus: 'mandatory',
        active: true,
        notes: 'Norma europea de cumplimiento obligatorio EN SU PROPIA JURISDICCIÃ“N (no en PerÃº) para rutas de evacuaciÃ³n, Ã¡reas antipÃ¡nico y zonas de tarea de alto riesgo. Complementa a EN 12464-1, no la reemplaza. Para proyectos peruanos, la fuente obligatoria es RNE A.130 â€” esta norma solo aporta como referencia de buena prÃ¡ctica los conceptos que A.130 no cubre (Ã¡reas antipÃ¡nico, uniformidad 40:1, curva de respuesta).',
        url: 'https://www.en-standard.eu',
        disclaimer: EN_1838_DISCLAIMER,
    },
    nfpa101: {
        id: 'nfpa101',
        name: 'NFPA 101',
        fullName: 'Life Safety Code â€“ Emergency Lighting',
        region: 'americas_usa',
        country: 'US',
        source: 'NFPA 101:2021',
        version: '2021',
        year: 2021,
        authority: 'National Fire Protection Association (NFPA)',
        legalStatus: 'reference',
        active: true,
        notes: 'Norma de referencia para iluminaciÃ³n de emergencia y seguridad. Estructura base incluida; valores detallados por actividad en proceso de carga.',
        url: 'https://www.nfpa.org',
        disclaimer: NFPA_DISCLAIMER,
    },
    ds024: {
        id: 'ds024',
        name: 'DS-024-2016',
        fullName: 'Reglamento de Seguridad y Salud Ocupacional en MinerÃ­a',
        region: 'americas_peru',
        country: 'PE',
        source: 'DS-024-2016-EM',
        version: '2016',
        year: 2016,
        authority: 'Ministerio de EnergÃ­a y Minas del PerÃº (MEM)',
        legalStatus: 'mandatory',
        active: true,
        notes: 'Norma obligatoria para instalaciones mineras en el PerÃº. Estructura base incluida; valores detallados por actividad en proceso de carga.',
        url: 'https://www.gob.pe/minem',
        disclaimer: DS024_DISCLAIMER,
    },
} as const;

// â”€â”€â”€ Mapa de Regiones y PaÃ­ses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const NORMATIVE_REGIONS: NormativeRegion[] = [
    {
        id: 'americas_peru',
        name: 'PerÃº',
        countries: [
            {
                code: 'PE',
                name: 'PerÃº',
                flag: 'ðŸ‡µðŸ‡ª',
                defaultStandard: 'rne_peru',
                // ds024 no estÃ¡ en esta lista: no tiene catÃ¡logo cargado
                // (getNormData() devolverÃ­a vacÃ­o) â€” ofrecerla como norma de
                // referencia/comparaciÃ³n mostrarÃ­a una comparaciÃ³n vacÃ­a sin aviso.
                // rne_a130 (Fase 14): fuente obligatoria de alumbrado de
                // emergencia en PerÃº â€” distinta de rne_peru (EM.010, que no
                // trata emergencia). en_1838 se ofrece como referencia
                // complementaria opcional (Ã¡reas antipÃ¡nico/uniformidad),
                // nunca como sustituto de rne_a130.
                applicableStandards: ['rne_peru', 'rne_a130', 'en_12464_1', 'en_1838'],
                priorityOrder: ['rne_peru', 'rne_a130', 'en_12464_1', 'ies_na'],
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
                flag: 'ðŸ‡©ðŸ‡ª',
                defaultStandard: 'en_12464_1',
                applicableStandards: ['en_12464_1', 'en_1838'],
                priorityOrder: ['en_12464_1', 'en_1838'],
            },
            {
                code: 'ES',
                name: 'EspaÃ±a',
                flag: 'ðŸ‡ªðŸ‡¸',
                defaultStandard: 'en_12464_1',
                applicableStandards: ['en_12464_1', 'en_1838'],
                priorityOrder: ['en_12464_1', 'en_1838'],
            },
            {
                code: 'FR',
                name: 'Francia',
                flag: 'ðŸ‡«ðŸ‡·',
                defaultStandard: 'en_12464_1',
                applicableStandards: ['en_12464_1', 'en_1838'],
                priorityOrder: ['en_12464_1', 'en_1838'],
            },
            {
                code: 'IT',
                name: 'Italia',
                flag: 'ðŸ‡®ðŸ‡¹',
                defaultStandard: 'en_12464_1',
                applicableStandards: ['en_12464_1', 'en_1838'],
                priorityOrder: ['en_12464_1', 'en_1838'],
            },
        ],
    },
    {
        id: 'americas_usa',
        name: 'NorteamÃ©rica',
        countries: [
            {
                code: 'US',
                name: 'Estados Unidos',
                flag: 'ðŸ‡ºðŸ‡¸',
                defaultStandard: 'ies_na',
                // nfpa101 no estÃ¡ en esta lista: no tiene catÃ¡logo cargado
                // (getNormData() devolverÃ­a vacÃ­o) â€” ofrecerla como norma de
                // referencia/comparaciÃ³n mostrarÃ­a una comparaciÃ³n vacÃ­a sin aviso.
                applicableStandards: ['ies_na'],
                priorityOrder: ['ies_na'],
            },
            {
                code: 'CA',
                name: 'CanadÃ¡',
                flag: 'ðŸ‡¨ðŸ‡¦',
                defaultStandard: 'ies_na',
                applicableStandards: ['ies_na'],
                priorityOrder: ['ies_na'],
            },
        ],
    },
];

// â”€â”€â”€ Funciones del Motor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Retorna las normas aplicables para un paÃ­s dado, en orden de prioridad.
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
    return ['en_12464_1'];
}

/**
 * Retorna el paÃ­s y su configuraciÃ³n normativa a partir del cÃ³digo de paÃ­s.
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
 * Retorna la norma primaria (obligatoria o por defecto) para un paÃ­s.
 */
export function resolvePrimaryStandard(countryCode: string): NormativeStandard {
    const config = resolveCountryConfig(countryCode);
    return config?.defaultStandard ?? 'en_12464_1';
}

/**
 * Flattening recursivo del Ã¡rbol normativo para una norma especÃ­fica.
 * Retorna array plano de hojas con categorÃ­a y secciÃ³n padres.
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
 * Overrides cargados en runtime (p.ej. el catÃ¡logo EM.010 completo servido
 * por el backend desde la BD). Tienen prioridad sobre los datasets estÃ¡ticos.
 */
const normDataOverrides = new Map<NormativeStandard, RawNormativeBranch[]>();

export function setNormDataOverride(standard: NormativeStandard, data: RawNormativeBranch[]): void {
    normDataOverrides.set(standard, data);
}

/**
 * Retorna los datos normativos de una norma segÃºn su ID.
 */
export function getNormData(standard: NormativeStandard): RawNormativeBranch[] {
    const override = normDataOverrides.get(standard);
    if (override && override.length > 0) {
        return override;
    }

    switch (standard) {
        case 'en_12464_1':
            return en12464Regulations;
        case 'ies_na':
            return iesnaRegulations;
        case 'rne_peru':
            return rnePeruRegulations;
        case 'rne_a130':
            return a130Regulations;
        case 'en_1838':
            return en1838Regulations;
        case 'nfpa101':
        case 'ds024':
            // Sin catÃ¡logo cargado todavÃ­a â€” ver notas en NORMATIVE_STANDARDS_META.
            return [];
        default:
            return [];
    }
}

/**
 * Busca la mejor actividad en una norma dado un texto de bÃºsqueda.
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

    // Prioridad 2: tÃ­tulo contiene la bÃºsqueda
    const titleContains = flat.find((l) => l.title.toLowerCase().includes(query));
    if (titleContains) {
        return titleContains;
    }

    // Prioridad 3: label contiene la bÃºsqueda
    const labelContains = flat.find((l) => l.label.toLowerCase().includes(query));
    if (labelContains) {
        return labelContains;
    }

    // Prioridad 4: filtrar por categorÃ­a si se provee
    if (category) {
        const catLower = category.toLowerCase();
        const catMatch = flat.find((l) => l.category.toLowerCase().includes(catLower));
        if (catMatch) {
            return catMatch;
        }
    }

    return null;
}

// â”€â”€â”€ EvaluaciÃ³n de Cumplimiento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Umbral de "advertencia": dentro del 15% del lÃ­mite mÃ­nimo */
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

/**
 * `notEvaluated`: todas las luminarias del ambiente quedaron excluidas de la
 * suma de deslumbramiento (`LightingResult.ugr_not_evaluated` â€” ver
 * `glareCalculation.ts`), asÃ­ que `calculated: 0` no es un UGR real. Sin este
 * chequeo, `0 <= limit` siempre es verdadero y el ambiente se reportarÃ­a
 * "compliant" sin haberse evaluado el deslumbramiento en absoluto.
 */
function ugrStatus(calculated: number, limit: number | null, notEvaluated: boolean): ComplianceStatus {
    if (limit === null || notEvaluated) {
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

/**
 * UGR cargado a mano para este ambiente (`Room.manualUgr`/
 * `AmbientConfig.manualUgr` â€” ver doc-comment en `types.ts`). Inline en vez
 * de importar `getRoomManualUgr` de `roomLighting.ts` porque ese mÃ³dulo ya
 * importa `getNormData` de ESTE archivo â€” un import de vuelta crearÃ­a un
 * ciclo runtime nuevo por una funciÃ³n de una lÃ­nea.
 */
function manualUgrOf(room: Room): number | null {
    return typeof room.manualUgr === 'number' ? room.manualUgr : null;
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
 * EvalÃºa el cumplimiento de un recinto contra su norma seleccionada.
 * Usa los resultados del motor de cÃ¡lculo (isolux / lightingCalculations).
 *
 * `fixtures` (opcional, luminarias YA filtradas a las de este ambiente):
 * cuando se provee, el Ra evaluado se deriva del dato REAL de las luminarias
 * instaladas (`Fixture.cri`, el peor caso entre ellas) en vez de
 * `room.colorRenderingRa` â€” antes ese campo se sobrescribÃ­a silenciosamente
 * con el propio requisito de la norma al elegir la actividad
 * (`RoomLightingSection.tsx`), asÃ­ que la comparaciÃ³n terminaba siendo del
 * requisito contra sÃ­ mismo y "Conforme" salÃ­a sin importar quÃ© luminaria
 * real se hubiera instalado. Sin `fixtures` (callers antiguos/tests), se
 * mantiene el comportamiento previo leyendo `room.colorRenderingRa`.
 */
export function evaluateCompliance(
    room: Room,
    result: LightingResult,
    normative: NormativeLeafOption,
    standardMeta?: NormativeStandardMeta,
    fixtures?: Fixture[],
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
            ? `Em ${result.avg_lux.toFixed(0)} lux â‰¥ ${normative.illuminanceLux} lux requerido`
            : luxSt === 'warning'
            ? `Em ${result.avg_lux.toFixed(0)} lux cumple pero muy prÃ³ximo al mÃ­nimo`
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
            ? `Uo ${result.uniformity.toFixed(3)} â‰¥ ${normative.uniformity} requerido`
            : uoSt === 'warning'
            ? `Uo ${result.uniformity.toFixed(3)} cumple pero prÃ³ximo al mÃ­nimo`
            : `Uo ${result.uniformity.toFixed(3)} < ${normative.uniformity} requerido`,
        normativeSource: source,
    });

    // 3. UGR
    // `manualUgr`: cargado a mano cuando el mÃ©todo analÃ­tico de posiciÃ³n de
    // Guth excluye TODAS las luminarias del ambiente (H/R fuera de su rango
    // de validez documentado â€” ver `glareCalculation.ts`) y no queda nada
    // que evaluar. Con un valor manual, SIEMPRE se evalÃºa contra Ã©l (nunca
    // "needs_review") â€” el mensaje deja explÃ­cito que es un dato cargado,
    // no calculado por este motor.
    const manualUgr = manualUgrOf(room);
    const effectiveUgr = manualUgr ?? result.ugr;
    const ugrSt = ugrStatus(effectiveUgr, normative.ugr, manualUgr === null && (result.ugr_not_evaluated ?? false));
    results.push({
        parameterId: 'ugr',
        parameterName: 'Ãndice de deslumbramiento (UGR)',
        requiredValue: normative.ugr,
        calculatedValue: effectiveUgr,
        unit: '',
        status: ugrSt,
        message: normative.ugr === null
            ? 'UGR no especificado en esta norma/actividad'
            : manualUgr !== null
            ? (ugrSt === 'compliant'
                ? `UGR ${effectiveUgr.toFixed(1)} â‰¤ ${normative.ugr} lÃ­mite (valor cargado a mano)`
                : ugrSt === 'warning'
                ? `UGR ${effectiveUgr.toFixed(1)} cumple pero prÃ³ximo al lÃ­mite (valor cargado a mano)`
                : `UGR ${effectiveUgr.toFixed(1)} > ${normative.ugr} lÃ­mite (valor cargado a mano)`)
            : result.ugr_not_evaluated
            ? 'UGR no evaluado: todas las luminarias quedaron fuera del cÃ¡lculo de deslumbramiento'
            : ugrSt === 'compliant'
            ? `UGR ${result.ugr.toFixed(1)} â‰¤ ${normative.ugr} lÃ­mite`
            : ugrSt === 'warning'
            ? `UGR ${result.ugr.toFixed(1)} cumple pero prÃ³ximo al lÃ­mite`
            : `UGR ${result.ugr.toFixed(1)} > ${normative.ugr} lÃ­mite`,
        normativeSource: source,
    });

    // 4. Ra (si estÃ¡ disponible en el recinto y en la norma)
    const raRequired = normative.ra;
    const fixtureCriValues = (fixtures ?? [])
        .map((fixture) => fixture.cri)
        .filter((cri): cri is number => typeof cri === 'number');
    // Peor caso entre las luminarias instaladas: basta con que UNA no
    // alcance el Ra exigido para que el ambiente no cumpla realmente.
    const raCalculated =
        fixtures !== undefined
            ? fixtureCriValues.length > 0
                ? Math.min(...fixtureCriValues)
                : null
            : (room.colorRenderingRa ?? null);

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
            parameterName: 'Ãndice de reproducciÃ³n cromÃ¡tica (Ra)',
            requiredValue: raRequired,
            calculatedValue: raCalculated,
            unit: '',
            status: raSt,
            message: raCalculated === null
                ? 'Ra de la luminaria no especificado â€” revisar producto seleccionado'
                : raSt === 'compliant'
                ? `Ra ${raCalculated} â‰¥ ${raRequired} requerido`
                : raSt === 'warning'
                ? `Ra ${raCalculated} cumple pero prÃ³ximo al mÃ­nimo`
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

// â”€â”€â”€ ComparaciÃ³n entre Normas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Compara los requisitos para una actividad dada entre todas las normas disponibles.
 * Ãštil para el modal de comparaciÃ³n normativa.
 */
export function compareNormsForActivity(
    searchText: string,
    standards: NormativeStandard[] = ['rne_peru', 'en_12464_1', 'ies_na'],
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
                activityTitle: 'No disponible en esta versiÃ³n',
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
 * Retorna la norma mÃ¡s exigente (mayor iluminancia requerida) entre las entradas de comparaciÃ³n.
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
        { id: 'vivienda',    label: 'Vivienda',          icon: 'ðŸ ', description: 'Casas, departamentos, edificios residenciales' },
        { id: 'educacion',   label: 'EducaciÃ³n',         icon: 'ðŸ«', description: 'Colegios, universidades, centros de formaciÃ³n' },
        { id: 'salud',       label: 'Salud',             icon: 'ðŸ¥', description: 'Hospitales, clÃ­nicas, centros mÃ©dicos' },
        { id: 'oficina',     label: 'Oficinas',          icon: 'ðŸ¢', description: 'Oficinas, salas de reuniones, espacios de trabajo' },
        { id: 'industria',   label: 'Industria',         icon: 'ðŸ­', description: 'FÃ¡bricas, plantas industriales, talleres' },
        { id: 'comercio',    label: 'Comercio',          icon: 'ðŸ›’', description: 'Tiendas, centros comerciales, locales' },
        { id: 'deportes',    label: 'Deportes',          icon: 'âš½', description: 'Canchas, estadios, gimnasios, piscinas' },
        { id: 'transporte',  label: 'Transporte',        icon: 'ðŸš‰', description: 'Aeropuertos, estaciones, terminales' },
        { id: 'mineria',     label: 'MinerÃ­a',           icon: 'â›ï¸', description: 'Minas, plantas de procesamiento, tÃºneles' },
        { id: 'emergencia',  label: 'Emergencia',        icon: 'ðŸš¨', description: 'VÃ­as de evacuaciÃ³n, iluminaciÃ³n de seguridad' },
    ];
}

