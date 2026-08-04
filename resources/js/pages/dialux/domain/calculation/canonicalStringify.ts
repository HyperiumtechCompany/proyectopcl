/**
 * Serialización determinista para hashing (ADR 0002, punto 2). Reglas:
 *
 *   - Claves de objeto: siempre ordenadas alfabéticamente.
 *   - Arrays cuyos elementos son objetos con `id` (o `luminaireId`, ver
 *     `STABLE_ID_KEYS` — Fase 10: `LuminaireState` usa ese nombre en vez de
 *     `id`, auditoría `dialux-calc-reviewer` de esa fase): se ordenan por
 *     ese campo (orden lexicográfico) antes de serializar — el orden de
 *     inserción de niveles/luminarias/materiales/escenas/objetos de cálculo
 *     no es semánticamente significativo para el hash.
 *   - Cualquier otro array (vértices de un polígono, `luminaireIds`, etc.):
 *     se preserva el orden tal cual — el orden de un polígono SÍ es
 *     significativo (define su forma) y no debe alterarse nunca.
 */

type Canonical = string | number | boolean | null | Canonical[] | { [key: string]: Canonical };

/** Campos que identifican de forma estable un elemento dentro de su array — ver comentario de cabecera. */
const STABLE_ID_KEYS = ['id', 'luminaireId'] as const;

function getStableIdKey(value: unknown): (typeof STABLE_ID_KEYS)[number] | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    for (const key of STABLE_ID_KEYS) {
        if (typeof record[key] === 'string') {
            return key;
        }
    }
    return null;
}

export function canonicalize(value: unknown): Canonical {
    if (Array.isArray(value)) {
        const mapped = value.map(canonicalize);
        const stableKey = value.length > 0 ? getStableIdKey(value[0]) : null;
        if (stableKey && value.every((item) => getStableIdKey(item) === stableKey)) {
            return [...mapped].sort((a, b) => {
                const idA = (a as Record<string, string>)[stableKey];
                const idB = (b as Record<string, string>)[stableKey];
                return idA.localeCompare(idB);
            });
        }
        return mapped;
    }

    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => [key, canonicalize(val)] as const);
        return Object.fromEntries(entries);
    }

    return value as Canonical;
}

export function canonicalStringify(value: unknown): string {
    return JSON.stringify(canonicalize(value));
}
