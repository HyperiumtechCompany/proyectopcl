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
 *  - EN 1838: Norma Europea de alumbrado de emergencia publicada por CEN/TC 169 (versión 2019).
 *    Los valores numéricos son parámetros técnicos fácticos de dominio público.
 *  - NFPA 101: Life Safety Code - National Fire Protection Association (estructura base, sin catálogo cargado aún).
 *  - DS-024-2016-EM: Reglamento de Seguridad en Minería - MEM Perú (estructura base, sin catálogo cargado aún).
 */

import { a130Regulations, en12464Regulations, en1838Regulations, iesnaRegulations, rnePeruRegulations} from './normativaData';
import type { RawNormativeLeaf, RawNormativeBranch } from './normativaData';
import type { NormativeStandard } from './roomLighting';
import type { Fixture, LightingResult, Room } from './types';

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

// Fase 14 (plan maestro §11): la edición citada anteriormente aquí
// ("EN 1838:2019") no existe en el catálogo público de CEN/BSI — las
// ediciones reales son 1999 → 2013 (retirada 18-dic-2024) → 2024
// (vigente). Los valores numéricos ya cargados en `en1838Regulations`
// (1 lx eje de ruta, 0.5 lx antipánico, 40:1, 50%@5s/100%@60s, 1h)
// coinciden con fuentes secundarias convergentes para la edición 2013 —
// se cita esa edición porque es la que respalda los valores YA cargados,
// no porque se haya verificado el texto de pago de la edición 2024
// (ver `planes/fase14_progreso_dialux.md`, matriz normativa). EN 1838
// NO tiene adopción legal en Perú — usar solo como referencia
// complementaria de buena práctica, nunca como fuente obligatoria para
// un proyecto peruano (esa es RNE A.130, ver `RNE_A130_DISCLAIMER`).
const EN_1838_DISCLAIMER =
    'Valores basados en EN 1838:2013 (Aplicaciones de la iluminación — Alumbrado de emergencia), publicada por CEN/TC 169 — edición retirada el 18-dic-2024, sustituida por EN 1838:2024 (valores exactos de esa edición nueva no verificados en este sistema). Parámetros técnicos fácticos de dominio público. NO tiene adopción legal en Perú: úsese solo como referencia de buena práctica internacional, nunca como sustituto de RNE A.130. Para información completa consulte la publicación oficial.';

const RNE_A130_DISCLAIMER =
    'Valores basados en RNE Norma A.130 "Requisitos de Seguridad" (D.S. N°017-2012-VIVIENDA), Artículos 39-41. Norma oficial peruana de carácter público y de cumplimiento obligatorio — es la fuente legal para alumbrado de emergencia en Perú (a diferencia de RNE EM.010, que no trata este tema). El Art. 40 inciso d) remite a CNE Tomo V (Utilización) Art. 7.1.2.1 para las conexiones eléctricas del circuito — ese artículo específico no está verificado en este sistema.';

const NFPA_DISCLAIMER =
    'Valores basados en NFPA 101 Life Safety Code (National Fire Protection Association). Para información completa consulte la publicación oficial.';

const DS024_DISCLAIMER =
    'Valores basados en DS-024-2016-EM (Reglamento de Seguridad y Salud Ocupacional en Minería - MEM Perú). Norma oficial peruana de carácter público.';

export const NORMATIVE_STANDARDS_META: Record<NormativeStandard, NormativeStandardMeta> = {
    en_12464_1: {
        id: 'en_12464_1',
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
    iesna_handbook: {
        id: 'iesna_handbook',
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
    // Fase 14 (plan maestro §11, "Emergencia"): fuente OBLIGATORIA real
    // para alumbrado de emergencia en Perú — RNE EM.010 (arriba) no trata
    // este tema en absoluto (verificado por texto completo del documento
    // oficial, cero coincidencias de "alumbrado de emergencia"/"evacuación").
    rne_a130: {
        id: 'rne_a130',
        name: 'RNE A.130',
        fullName: 'Reglamento Nacional de Edificaciones — A.130 Requisitos de Seguridad (Arts. 39-41)',
        region: 'americas_peru',
        country: 'PE',
        source: 'RNE A.130 (D.S. N°017-2012-VIVIENDA), Arts. 39-41',
        version: '2012',
        year: 2012,
        authority: 'MVCS – Ministerio de Vivienda, Construcción y Saneamiento',
        legalStatus: 'mandatory',
        active: true,
        notes: 'Norma obligatoria en el Perú para alumbrado de emergencia (10 lx a nivel de piso en medios de evacuación, autonomía 1½ h, transferencia ≤10 s, señalización según NTP 399.010-1). No define áreas antipánico ni relación de uniformidad — ver EN 1838 como referencia complementaria opcional para esos conceptos.',
        url: 'https://www.gob.pe/mvcs',
        disclaimer: RNE_A130_DISCLAIMER,
    },
    en_1838: {
        id: 'en_1838',
        name: 'EN 1838',
        fullName: 'Aplicaciones de la iluminación — Alumbrado de emergencia',
        region: 'europe',
        country: 'EU',
        source: 'EN 1838:2013',
        version: '2013',
        year: 2013,
        authority: 'CEN/TC 169',
        legalStatus: 'mandatory',
        active: true,
        notes: 'Norma europea de cumplimiento obligatorio EN SU PROPIA JURISDICCIÓN (no en Perú) para rutas de evacuación, áreas antipánico y zonas de tarea de alto riesgo. Complementa a EN 12464-1, no la reemplaza. Para proyectos peruanos, la fuente obligatoria es RNE A.130 — esta norma solo aporta como referencia de buena práctica los conceptos que A.130 no cubre (áreas antipánico, uniformidad 40:1, curva de respuesta).',
        url: 'https://www.en-standard.eu',
        disclaimer: EN_1838_DISCLAIMER,
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
        name: 'D.S. 024 (Minería)',
        fullName: 'DS 024-2016-EM - Reglamento de Minería',
        region: 'americas_peru',
        country: 'PE',
        source: 'Decreto Supremo Nº 024-2016-EM (Perú)',
        version: '2016',
        year: 2016,
        authority: 'Ministerio de Energía y Minas del Perú (MEM)',
        legalStatus: 'mandatory',
        active: true,
        notes: 'Norma obligatoria para instalaciones mineras en el Perú. Estructura base incluida; valores detallados por actividad en proceso de carga.',
        url: 'https://www.gob.pe/minem',
        disclaimer: DS024_DISCLAIMER,
        
        
        
    },
    en_12464_2: {
        id: 'en_12464_2',
        name: 'EN 12464-2',
        fullName: 'Iluminación de lugares de trabajo en exteriores',
        region: 'europe',
        country: 'EU',
        source: 'EN 12464-2 (CEN/TC 169)',
        version: '2014',
        year: 2014,
        authority: 'CEN/TC 169',
        legalStatus: 'recommended',
        active: true,
        notes: 'Norma europea para iluminación de áreas exteriores.',
        
        
        disclaimer: '',
        
    },
    en_13201_2: {
        id: 'en_13201_2',
        name: 'EN 13201-2',
        fullName: 'Iluminación de carreteras',
        region: 'europe',
        country: 'EU',
        source: 'EN 13201-2',
        version: '2015',
        year: 2015,
        authority: 'CEN/TC 169',
        legalStatus: 'recommended',
        active: true,
        notes: 'Norma europea para iluminación de carreteras.',
        
        
        disclaimer: '',
        
    },
    en_12193: {
        id: 'en_12193',
        name: 'EN 12193',
        fullName: 'Iluminación de instalaciones deportivas',
        region: 'europe',
        country: 'EU',
        source: 'EN 12193',
        version: '2020',
        year: 2020,
        authority: 'CEN/TC 169',
        legalStatus: 'recommended',
        active: true,
        notes: 'Norma europea para iluminación deportiva.',
        
        
        disclaimer: '',
        
    },
    en_15193: {
        id: 'en_15193',
        name: 'EN 15193',
        fullName: 'Eficiencia energética de los edificios',
        region: 'europe',
        country: 'EU',
        source: 'EN 15193',
        version: '2017',
        year: 2017,
        authority: 'CEN/TC 169',
        legalStatus: 'recommended',
        active: true,
        notes: 'Norma europea para eficiencia energética en iluminación.',
        
        
        disclaimer: '',
        
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
                // ds024 no está en esta lista: no tiene catálogo cargado
                // (getNormData() devolvería vacío) — ofrecerla como norma de
                // referencia/comparación mostraría una comparación vacía sin aviso.
                // rne_a130 (Fase 14): fuente obligatoria de alumbrado de
                // emergencia en Perú — distinta de rne_peru (EM.010, que no
                // trata emergencia). en_1838 se ofrece como referencia
                // complementaria opcional (áreas antipánico/uniformidad),
                // nunca como sustituto de rne_a130.
                applicableStandards: ['rne_peru', 'rne_a130', 'en_12464_1', 'en_1838'],
                priorityOrder: ['rne_peru', 'rne_a130', 'en_12464_1', 'iesna_handbook'],
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
                defaultStandard: 'en_12464_1',
                applicableStandards: ['en_12464_1', 'en_1838'],
                priorityOrder: ['en_12464_1', 'en_1838'],
            },
            {
                code: 'ES',
                name: 'España',
                flag: '🇪🇸',
                defaultStandard: 'en_12464_1',
                applicableStandards: ['en_12464_1', 'en_1838'],
                priorityOrder: ['en_12464_1', 'en_1838'],
            },
            {
                code: 'FR',
                name: 'Francia',
                flag: '🇫🇷',
                defaultStandard: 'en_12464_1',
                applicableStandards: ['en_12464_1', 'en_1838'],
                priorityOrder: ['en_12464_1', 'en_1838'],
            },
            {
                code: 'IT',
                name: 'Italia',
                flag: '🇮🇹',
                defaultStandard: 'en_12464_1',
                applicableStandards: ['en_12464_1', 'en_1838'],
                priorityOrder: ['en_12464_1', 'en_1838'],
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
                defaultStandard: 'iesna_handbook',
                // nfpa101 no está en esta lista: no tiene catálogo cargado
                // (getNormData() devolvería vacío) — ofrecerla como norma de
                // referencia/comparación mostraría una comparación vacía sin aviso.
                applicableStandards: ['iesna_handbook'],
                priorityOrder: ['iesna_handbook'],
            },
            {
                code: 'CA',
                name: 'Canadá',
                flag: '🇨🇦',
                defaultStandard: 'iesna_handbook',
                applicableStandards: ['iesna_handbook'],
                priorityOrder: ['iesna_handbook'],
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
    return ['en_12464_1'];
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
    return config?.defaultStandard ?? 'en_12464_1';
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
 * Overrides cargados en runtime (p.ej. el catálogo EM.010 completo servido
 * por el backend desde la BD). Tienen prioridad sobre los datasets estáticos.
 */
const normDataOverrides = new Map<NormativeStandard, RawNormativeBranch[]>();

export function setNormDataOverride(standard: NormativeStandard, data: RawNormativeBranch[]): void {
    normDataOverrides.set(standard, data);
}

/**
 * Retorna los datos normativos de una norma según su ID.
 */
export function getNormData(standard: NormativeStandard): RawNormativeBranch[] {
    const override = normDataOverrides.get(standard);
    if (override && override.length > 0) {
        return override;
    }

    switch (standard) {
        case 'en_12464_1':
            return en12464Regulations;
        case 'iesna_handbook':
            return iesnaRegulations;
        case 'rne_peru':
            return rnePeruRegulations;
        case 'rne_a130':
            return a130Regulations;
        case 'en_1838':
            return en1838Regulations;
        case 'nfpa101':
        case 'ds024':
            // Sin catálogo cargado todavía — ver notas en NORMATIVE_STANDARDS_META.
            return [];
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

/**
 * `notEvaluated`: todas las luminarias del ambiente quedaron excluidas de la
 * suma de deslumbramiento (`LightingResult.ugr_not_evaluated` — ver
 * `glareCalculation.ts`), así que `calculated: 0` no es un UGR real. Sin este
 * chequeo, `0 <= limit` siempre es verdadero y el ambiente se reportaría
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
 * `AmbientConfig.manualUgr` — ver doc-comment en `types.ts`). Inline en vez
 * de importar `getRoomManualUgr` de `roomLighting.ts` porque ese módulo ya
 * importa `getNormData` de ESTE archivo — un import de vuelta crearía un
 * ciclo runtime nuevo por una función de una línea.
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
 * Evalúa el cumplimiento de un recinto contra su norma seleccionada.
 * Usa los resultados del motor de cálculo (isolux / lightingCalculations).
 *
 * `fixtures` (opcional, luminarias YA filtradas a las de este ambiente):
 * cuando se provee, el Ra evaluado se deriva del dato REAL de las luminarias
 * instaladas (`Fixture.cri`, el peor caso entre ellas) en vez de
 * `room.colorRenderingRa` — antes ese campo se sobrescribía silenciosamente
 * con el propio requisito de la norma al elegir la actividad
 * (`RoomLightingSection.tsx`), así que la comparación terminaba siendo del
 * requisito contra sí mismo y "Conforme" salía sin importar qué luminaria
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
    // `manualUgr`: cargado a mano cuando el método analítico de posición de
    // Guth excluye TODAS las luminarias del ambiente (H/R fuera de su rango
    // de validez documentado — ver `glareCalculation.ts`) y no queda nada
    // que evaluar. Con un valor manual, SIEMPRE se evalúa contra él (nunca
    // "needs_review") — el mensaje deja explícito que es un dato cargado,
    // no calculado por este motor.
    const manualUgr = manualUgrOf(room);
    const effectiveUgr = manualUgr ?? result.ugr;
    const ugrSt = ugrStatus(effectiveUgr, normative.ugr, manualUgr === null && (result.ugr_not_evaluated ?? false));
    results.push({
        parameterId: 'ugr',
        parameterName: 'Índice de deslumbramiento (UGR)',
        requiredValue: normative.ugr,
        calculatedValue: effectiveUgr,
        unit: '',
        status: ugrSt,
        message: normative.ugr === null
            ? 'UGR no especificado en esta norma/actividad'
            : manualUgr !== null
            ? (ugrSt === 'compliant'
                ? `UGR ${effectiveUgr.toFixed(1)} ≤ ${normative.ugr} límite (valor cargado a mano)`
                : ugrSt === 'warning'
                ? `UGR ${effectiveUgr.toFixed(1)} cumple pero próximo al límite (valor cargado a mano)`
                : `UGR ${effectiveUgr.toFixed(1)} > ${normative.ugr} límite (valor cargado a mano)`)
            : result.ugr_not_evaluated
            ? 'UGR no evaluado: todas las luminarias quedaron fuera del cálculo de deslumbramiento'
            : ugrSt === 'compliant'
            ? `UGR ${result.ugr.toFixed(1)} ≤ ${normative.ugr} límite`
            : ugrSt === 'warning'
            ? `UGR ${result.ugr.toFixed(1)} cumple pero próximo al límite`
            : `UGR ${result.ugr.toFixed(1)} > ${normative.ugr} límite`,
        normativeSource: source,
    });

    // 4. Ra (si está disponible en el recinto y en la norma)
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
    standards: NormativeStandard[] = ['rne_peru', 'en_12464_1', 'iesna_handbook'],
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

