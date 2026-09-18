import {
    importMethod,
    index as productsIndex,
    show as productShow,
} from '@/actions/App/Http/Controllers/Dialux/ProductController';

/**
 * Catálogo de luminarias COMPARTIDO con el editor de interiores (v1): el
 * mismo endpoint `dialux/products` y la misma tabla `luminaire_products`
 * (globales + propias del usuario). Este módulo solo LEE (index/show) e
 * IMPORTA (el mismo endpoint de importación LDT/IES/GLDF de v1) — no cambia
 * nada del lado del servidor ni del editor v1, y lo que se importe aquí
 * aparece allá y viceversa.
 */

export interface LuminaireCatalogItem {
    id: number;
    name: string;
    manufacturer: string | null;
    totalLumens: number | null;
    powerWatts: number | null;
    beamAngle50: number | null;
    cct: string | null;
    criRa: number | null;
    fixtureType: string | null;
    distributionType: string | null;
    sourceFormat: string | null;
    isGlobal: boolean;
}

/** Matriz fotométrica (misma forma que `Fixture.photometricWeb` de v1). */
export interface LuminairePhotometricWeb {
    c_angles: number[];
    gamma_angles: number[];
    candela: number[][];
    reference_lumens?: number;
}

export interface LuminairePhotometry {
    id: number;
    totalLumens: number | null;
    web: LuminairePhotometricWeb | null;
}

const num = (value: unknown): number | null => {
    const n = Number(value);
    return value === null || value === undefined || !Number.isFinite(n)
        ? null
        : n;
};

function toItem(raw: Record<string, unknown>): LuminaireCatalogItem {
    return {
        id: Number(raw.id),
        name: String(raw.name ?? 'Luminaria'),
        manufacturer: (raw.manufacturer as string | null) ?? null,
        totalLumens: num(raw.total_lumens),
        powerWatts: num(raw.power_watts),
        beamAngle50: num(raw.beam_angle_50),
        cct: raw.cct === null || raw.cct === undefined ? null : String(raw.cct),
        criRa: num(raw.cri_ra),
        fixtureType: (raw.fixture_type as string | null) ?? null,
        distributionType: (raw.distribution_type as string | null) ?? null,
        sourceFormat: (raw.source_format as string | null) ?? null,
        isGlobal: Boolean(raw.is_global),
    };
}

async function getJson(url: string): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
}

let catalogPromise: Promise<LuminaireCatalogItem[]> | null = null;

/** Lista del catálogo (una sola petición por sesión; `force` la vuelve a pedir). */
export function loadLuminaireCatalog(
    force = false,
): Promise<LuminaireCatalogItem[]> {
    if (force || !catalogPromise) {
        catalogPromise = getJson(productsIndex.url())
            .then((json) =>
                ((json.products as Array<Record<string, unknown>>) ?? []).map(
                    toItem,
                ),
            )
            .catch((error) => {
                catalogPromise = null;
                throw error;
            });
    }
    return catalogPromise;
}

const photometryCache = new Map<number, Promise<LuminairePhotometry | null>>();

/** Matriz fotométrica de UN producto (cacheada por id). */
export function loadLuminairePhotometry(
    id: number,
): Promise<LuminairePhotometry | null> {
    let cached = photometryCache.get(id);
    if (!cached) {
        cached = getJson(productShow.url(id))
            .then((json) => {
                const product = json.product as Record<string, unknown>;
                const web = product?.photometric_web as
                    | LuminairePhotometricWeb
                    | null
                    | undefined;
                return {
                    id,
                    totalLumens: num(product?.total_lumens),
                    web: web && web.gamma_angles?.length ? web : null,
                };
            })
            .catch(() => {
                photometryCache.delete(id);
                return null;
            });
        photometryCache.set(id, cached);
    }
    return cached;
}

function readXsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

/** Sube un archivo IES/LDT/GLDF al MISMO catálogo que usa v1 (queda disponible en ambos editores). */
export async function importLuminaireFile(
    file: File,
): Promise<{ item: LuminaireCatalogItem; warnings: string[] }> {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(importMethod.url(), {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'X-XSRF-TOKEN': readXsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body,
    });
    const json = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
    >;
    if (!response.ok) {
        const errors = json.errors as Record<string, string[]> | undefined;
        const first = errors ? Object.values(errors)[0]?.[0] : undefined;
        throw new Error(
            first ?? (json.message as string) ?? `HTTP ${response.status}`,
        );
    }
    catalogPromise = null; // recargar la lista con el producto nuevo
    return {
        item: toItem(json.product as Record<string, unknown>),
        warnings: ((json.warnings as unknown[]) ?? []).map(String),
    };
}
