/**
 * normativeRemoteData.ts
 *
 * Fuente única de verdad para las normas sembradas en BD (tabla
 * dialux_normative_requirements, ver DialuxNormativeRequirementsSeeder):
 * carga el catálogo completo de una norma desde el backend y lo convierte al
 * árbol RawNormativeBranch que consume el motor normativo, además de las
 * secciones que consume el panel rápido del toolbar. Mientras no cargue (o
 * si falla la red), ambos consumidores siguen usando su dataset estático
 * embebido de respaldo.
 */

import { setStandardSections, type NormKey, type NormProfile, type NormSection } from '../components/toolbar/normativeData';
import type { RawNormativeBranch, RawNormativeLeaf } from './normativaData';
import { setNormDataOverride } from './normativeEngine';
import type { NormativeStandard } from './roomLighting';

/** Standard (BD/motor) → NormKey (panel toolbar) para las normas con fuente única en BD. */
const STANDARD_TO_NORM_KEY: Partial<Record<NormativeStandard, NormKey>> = {
    rne_peru: 'NTP_370',
    en_1838: 'EN_1838',
};

interface RequirementRow {
    id: number;
    standard: string;
    category_key: string;
    category: string;
    subcategory_key: string | null;
    subcategory: string | null;
    area_name: string;
    em_lux: number | null;
    ugrl: number | null;
    uo: number | null;
    ra: number | null;
    requirements: string[] | null;
}

function toLeaf(row: RequirementRow): RawNormativeLeaf {
    const requirements = Array.isArray(row.requirements) ? row.requirements.join('. ') : null;

    return {
        title: row.area_name,
        label: `${row.area_name}${row.subcategory ? ` — ${row.subcategory}` : ''}`,
        iluminancia_lux: row.em_lux ?? 0,
        UGR: row.ugrl,
        Uo: row.uo,
        Ra: row.ra,
        requisitos_especificos: requirements,
    };
}

/** Convierte las filas planas del backend al árbol categoría → subcategoría → áreas. */
export function buildTreeFromRows(rows: RequirementRow[]): RawNormativeBranch[] {
    const byCategory = new Map<string, { name: string; direct: RawNormativeLeaf[]; subs: Map<string, { name: string; leaves: RawNormativeLeaf[] }> }>();

    for (const row of rows) {
        let category = byCategory.get(row.category_key);
        if (!category) {
            category = { name: row.category, direct: [], subs: new Map() };
            byCategory.set(row.category_key, category);
        }

        if (row.subcategory_key) {
            let sub = category.subs.get(row.subcategory_key);
            if (!sub) {
                sub = { name: row.subcategory ?? row.subcategory_key, leaves: [] };
                category.subs.set(row.subcategory_key, sub);
            }
            sub.leaves.push(toLeaf(row));
        } else {
            category.direct.push(toLeaf(row));
        }
    }

    const tree: RawNormativeBranch[] = [];

    for (const [, category] of byCategory) {
        const branch: RawNormativeBranch = { title: category.name };

        if (category.subs.size > 0) {
            branch.subsections = [...category.subs.values()].map((sub) => ({
                title: sub.name,
                subsubsections: sub.leaves,
            }));
            if (category.direct.length > 0) {
                branch.subsections.push({ title: 'General', subsubsections: category.direct });
            }
        } else {
            branch.subsections = [{ title: category.name, subsubsections: category.direct }];
        }

        tree.push(branch);
    }

    return tree;
}

/** Convierte las filas planas al formato del panel Normativa del toolbar. */
export function buildToolbarSectionsFromRows(rows: RequirementRow[]): NormSection[] {
    const byCategory = new Map<string, { name: string; subs: Map<string, { name: string; rows: RequirementRow[] }> }>();

    for (const row of rows) {
        let category = byCategory.get(row.category_key);
        if (!category) {
            category = { name: row.category, subs: new Map() };
            byCategory.set(row.category_key, category);
        }

        const subKey = row.subcategory_key ?? row.category_key;
        let sub = category.subs.get(subKey);
        if (!sub) {
            sub = { name: row.subcategory ?? row.category, rows: [] };
            category.subs.set(subKey, sub);
        }
        sub.rows.push(row);
    }

    const sections: NormSection[] = [];

    for (const [categoryKey, category] of byCategory) {
        sections.push({
            id: categoryKey,
            label: `${categoryKey} — ${category.name}`,
            subsections: [...category.subs.entries()].map(([subKey, sub]) => ({
                id: subKey,
                label: subKey === categoryKey ? category.name : `${subKey} ${sub.name}`,
                profiles: sub.rows.map((row, index): NormProfile => ({
                    id: `${subKey}.${index + 1}`,
                    application: row.area_name,
                    Em_work: row.em_lux ?? 0,
                    uniformity: row.uo ?? undefined,
                    UGR: row.ugrl ?? undefined,
                    Ra: row.ra ?? 80,
                    notes: Array.isArray(row.requirements) ? row.requirements.join('. ') : undefined,
                })),
            })),
        });
    }

    return sections;
}

const loadPromises = new Map<NormativeStandard, Promise<void>>();

/**
 * Carga (una sola vez por sesión y por norma) el catálogo sembrado en BD
 * para `standard` y lo registra como override del dataset estático en el
 * motor normativo y, si el toolbar tiene un NormKey asociado, también en el
 * panel rápido de Normativa.
 */
export function ensureStandardDataLoaded(standard: NormativeStandard): Promise<void> {
    const cached = loadPromises.get(standard);
    if (cached) {
        return cached;
    }

    const promise = (async () => {
        try {
            const response = await fetch(`/dialux/normative-config/requirements?standard=${standard}`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const json = (await response.json()) as { data: RequirementRow[] };

            if (Array.isArray(json.data) && json.data.length > 0) {
                setNormDataOverride(standard, buildTreeFromRows(json.data));
                const normKey = STANDARD_TO_NORM_KEY[standard];
                if (normKey) {
                    setStandardSections(normKey, buildToolbarSectionsFromRows(json.data));
                }
            }
        } catch {
            // Sin red o sin seed: los consumidores siguen con su dataset estático embebido.
            loadPromises.delete(standard);
        }
    })();

    loadPromises.set(standard, promise);
    return promise;
}

/** @deprecated usa ensureStandardDataLoaded('rne_peru') */
export function ensureRneDataLoaded(): Promise<void> {
    return ensureStandardDataLoaded('rne_peru');
}
