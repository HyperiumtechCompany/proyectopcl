/**
 * Serialización determinista para hashing (ADR 0002, punto 2). Reglas:
 *
 *   - Claves de objeto: siempre ordenadas alfabéticamente.
 *   - Arrays cuyos elementos son objetos con `id`: se ordenan por `id`
 *     (orden lexicográfico) antes de serializar — el orden de inserción de
 *     niveles/luminarias/materiales/escenas/objetos de cálculo no es
 *     semánticamente significativo para el hash.
 *   - Cualquier otro array (vértices de un polígono, `luminaireIds`, etc.):
 *     se preserva el orden tal cual — el orden de un polígono SÍ es
 *     significativo (define su forma) y no debe alterarse nunca.
 */

type Canonical = string | number | boolean | null | Canonical[] | { [key: string]: Canonical };

function hasStableId(value: unknown): value is { id: string } {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof (value as Record<string, unknown>).id === 'string'
    );
}

export function canonicalize(value: unknown): Canonical {
    if (Array.isArray(value)) {
        const mapped = value.map(canonicalize);
        if (value.length > 0 && value.every(hasStableId)) {
            return [...mapped].sort((a, b) => {
                const idA = (a as { id: string }).id;
                const idB = (b as { id: string }).id;
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
