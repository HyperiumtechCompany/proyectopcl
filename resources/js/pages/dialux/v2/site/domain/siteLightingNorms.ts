import type { RawNormativeBranch } from '@/pages/dialux/hooks/normativaData';
import {
    flattenNormTree,
    getNormData,
    NORMATIVE_STANDARDS_META,
} from '@/pages/dialux/hooks/normativeEngine';
import type { NormativeStandard } from '@/pages/dialux/hooks/roomLighting';
import type { LightingSummary } from './exteriorLighting';
import { EXTERIOR_NORM_CATALOG, EXTERIOR_NORM_SOURCE } from './exteriorNormCatalog';
import type { SiteElementType, SiteNormRegion } from './types';

/**
 * Normativa de iluminación para los espacios del emplazamiento. La región
 * "Exterior" usa el catálogo propio de alumbrado exterior (EN 12464-2 /
 * EN 13201-2, `exteriorNormCatalog.ts`); las demás leen los catálogos de
 * INTERIORES que ya usa el motor normativo de la v1 (EN 12464-1, IES HB-10,
 * RNE EM.010), incluidos los overrides cargados desde BD.
 */
export const SITE_NORM_REGIONS: Array<{
    id: SiteNormRegion;
    label: string;
    standard: NormativeStandard;
}> = [
    { id: 'exterior', label: 'Exterior (EN 12464-2 / 13201)', standard: 'en_12464_2' },
    { id: 'europe', label: 'Europa', standard: 'en_12464_1' },
    { id: 'usa', label: 'EE.UU.', standard: 'iesna_handbook' },
    { id: 'peru', label: 'Perú', standard: 'rne_peru' },
];

export const ALL_SITE_NORM_REGIONS: SiteNormRegion[] = ['exterior', 'europe', 'usa', 'peru'];

/** Regiones cuyo catálogo es de INTERIORES (aviso de aplicabilidad en exteriores). */
export function isInteriorCatalog(region: SiteNormRegion): boolean {
    return region !== 'exterior';
}

export function regionStandard(region: SiteNormRegion): NormativeStandard {
    const found = SITE_NORM_REGIONS.find((r) => r.id === region);
    return found ? found.standard : 'en_12464_1';
}

/** Fuente citable de la norma de una región (nombre + edición) — para mostrar junto a cada cifra. */
export function regionSource(region: SiteNormRegion): string {
    if (region === 'exterior') return EXTERIOR_NORM_SOURCE;
    const meta = NORMATIVE_STANDARDS_META[regionStandard(region)];
    return meta ? `${meta.source} (${meta.version})` : regionStandard(region);
}

export interface NormActivity {
    key: string; // `categoría › título`
    category: string;
    section: string;
    title: string;
    label: string;
    illuminanceLux: number;
    uniformity: number | null;
    ugr: number | null;
    ra: number | null;
    specificRequirements: string | null;
    /** Emín mantenida exigida (lx) — clases P de EN 13201-2; null si no aplica. */
    minLux: number | null;
    /** Norma y tabla de la cifra. */
    source?: string;
}

// Aplanar cientos de hojas en cada render sería costoso: se cachea por identidad del dataset.
const activityCache = new WeakMap<RawNormativeBranch[], NormActivity[]>();

/** Actividades de la norma de la región (todas las hojas del catálogo, con su categoría). */
const EXTERIOR_ACTIVITIES: NormActivity[] = EXTERIOR_NORM_CATALOG.map((item) => ({
    key: item.key,
    category: item.category,
    section: item.category,
    title: item.title,
    label: item.title,
    illuminanceLux: item.illuminanceLux,
    uniformity: item.uniformity,
    ugr: null,
    ra: item.ra,
    specificRequirements:
        item.minLux !== null ? `Emín mantenida ≥ ${item.minLux} lx` : null,
    minLux: item.minLux,
    source: item.source,
}));

export function listActivities(region: SiteNormRegion): NormActivity[] {
    if (region === 'exterior') return EXTERIOR_ACTIVITIES;
    const data = getNormData(regionStandard(region));
    const cached = activityCache.get(data);
    if (cached) return cached;
    const list = flattenNormTree(data).map((leaf) => ({
        key: `${leaf.category} › ${leaf.title}`,
        category: leaf.category,
        section: leaf.section,
        title: leaf.title,
        label: leaf.label,
        illuminanceLux: leaf.illuminanceLux,
        uniformity: leaf.uniformity,
        ugr: leaf.ugr,
        ra: leaf.ra,
        specificRequirements: leaf.specificRequirements,
        minLux: null,
    }));
    activityCache.set(data, list);
    return list;
}

export function findActivity(
    region: SiteNormRegion,
    key: string | undefined,
): NormActivity | undefined {
    if (!key) return undefined;
    return listActivities(region).find((a) => a.key === key);
}

/** Palabras clave para sugerir una actividad según el tipo de espacio (el cliente siempre puede cambiarla). */
const SUGGEST_KEYWORDS: Partial<Record<SiteElementType, string[]>> = {
    parking: ['estacionamiento exterior', 'parking', 'estacionamiento', 'aparcamiento'],
    street: ['circulación', 'circulacion', 'circulation', 'zona peatonal'],
    sidewalk: ['zona peatonal', 'circulación', 'circulacion', 'walkway'],
    court: ['pista polideportiva', 'polideportiv', 'deport', 'gymnas', 'sport'],
    canopy: ['entrada institucional techada', 'vestíbulo', 'vestibulo', 'entrada', 'entrance'],
    terrace_platform: ['patio educativo', 'patio', 'plaza'],
    green_area: ['patio educativo', 'patio', 'jard', 'garden'],
    custom_zone: ['patio'],
};

/** Actividad sugerida de la región para un tipo de espacio, o `undefined` si el catálogo no tiene nada parecido. */
/**
 * Sugerencia del catálogo exterior por tipo de espacio (el cliente siempre
 * puede cambiarla): clase P3 para zonas peatonales y patios (uso nocturno
 * moderado), tránsito regular para calles internas, estacionamiento de
 * tránsito medio para instituciones.
 */
const EXTERIOR_SUGGESTION: Partial<Record<SiteElementType, string>> = {
    sidewalk: 'EN 13201-2 · Clases P (peatonal / baja velocidad) › P3',
    ramp: 'EN 13201-2 · Clases P (peatonal / baja velocidad) › P3',
    stair: 'EN 13201-2 · Clases P (peatonal / baja velocidad) › P3',
    terrace_platform: 'EN 13201-2 · Clases P (peatonal / baja velocidad) › P3',
    green_area: 'EN 13201-2 · Clases P (peatonal / baja velocidad) › P4',
    custom_zone: 'EN 13201-2 · Clases P (peatonal / baja velocidad) › P3',
    terrain: 'EN 13201-2 · Clases P (peatonal / baja velocidad) › P5',
    street: 'EN 12464-2 · Circulación › Tránsito vehicular regular (máx. 40 km/h)',
    parking: 'EN 12464-2 · Estacionamientos › Tránsito medio (oficinas, colegios, complejos deportivos)',
    canopy: 'EN 12464-2 · Circulación › Pasos peatonales, giro de vehículos, carga y descarga',
};

export function suggestActivity(
    region: SiteNormRegion,
    type: SiteElementType,
): NormActivity | undefined {
    if (region === 'exterior') {
        return findActivity(region, EXTERIOR_SUGGESTION[type]);
    }
    const activities = listActivities(region);
    for (const word of SUGGEST_KEYWORDS[type] ?? []) {
        const hit = activities.find((a) =>
            `${a.title} ${a.label}`.toLowerCase().includes(word),
        );
        if (hit) return hit;
    }
    return undefined;
}

export type SiteNormVerdict = 'meets' | 'below' | 'no-data';

export interface SiteNormCheck {
    region: SiteNormRegion;
    source: string;
    activity: NormActivity | undefined;
    /** Em calculada (lx) vs. requerida. `no-data` = sin luminarias calculadas o sin actividad elegida. */
    emVerdict: SiteNormVerdict;
    /** Uo calculada vs. requerida (`no-data` si la norma no fija Uo). */
    uoVerdict: SiteNormVerdict;
    /** Emín calculada vs. requerida (clases P; `no-data` si no aplica). */
    minVerdict: SiteNormVerdict;
}

/**
 * Compara el resultado calculado del área con el valor de la actividad elegida.
 * Es una comparación numérica contra el catálogo cargado, NO una declaración de
 * cumplimiento: los valores exteriores de estos catálogos siguen "sin confirmar".
 */
export function checkAgainstNorm(
    region: SiteNormRegion,
    activityKey: string | undefined,
    summary: LightingSummary | null,
): SiteNormCheck {
    const activity = findActivity(region, activityKey);
    const base = { region, source: regionSource(region), activity };
    if (!activity || !summary || summary.areaM2 <= 0 || summary.luminaires === 0) {
        return { ...base, emVerdict: 'no-data', uoVerdict: 'no-data', minVerdict: 'no-data' };
    }
    const minVerdict: SiteNormVerdict =
        activity.minLux === null
            ? 'no-data'
            : summary.minLux >= activity.minLux
              ? 'meets'
              : 'below';
    return {
        ...base,
        minVerdict,
        // Clases P: el requisito es Ē Y Emín — "≥ norma" solo si ambos.
        emVerdict:
            summary.avgLux >= activity.illuminanceLux && minVerdict !== 'below'
                ? 'meets'
                : 'below',
        uoVerdict:
            activity.uniformity === null
                ? 'no-data'
                : summary.uniformity >= activity.uniformity
                  ? 'meets'
                  : 'below',
    };
}
