import type { GeoLocation } from '../domain/types';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const MIN_REQUEST_INTERVAL_MS = 1000;

const ZONE_LABELS: Record<string, string> = {
    residential: 'Residencial',
    commercial: 'Comercial',
    retail: 'Comercial',
    industrial: 'Industrial',
    school: 'Educativo',
    university: 'Educativo',
    college: 'Educativo',
    hospital: 'Salud',
    civic: 'Institucional',
};

interface NominatimResult {
    lat: string;
    lon: string;
    display_name: string;
    boundingbox: [string, string, string, string];
    type?: string;
    class?: string;
    error?: string;
}

let lastRequestAt = 0;

/** Nominatim exige máximo 1 solicitud/segundo — se espacían las llamadas del lado del cliente. */
async function throttledFetch(url: string): Promise<Response> {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
        await new Promise((resolve) =>
            setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed),
        );
    }
    lastRequestAt = Date.now();
    return fetch(url, { headers: { Accept: 'application/json' } });
}

function parseResult(item: NominatimResult): GeoLocation {
    return {
        lat: Number(item.lat),
        lon: Number(item.lon),
        displayName: item.display_name,
        boundingBox: item.boundingbox.map(Number) as [
            number,
            number,
            number,
            number,
        ],
        zoneType: item.type ?? item.class,
    };
}

/** Busca lugares/direcciones por texto libre. */
export async function searchLocation(query: string): Promise<GeoLocation[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const url = `${NOMINATIM_BASE_URL}/search?format=json&addressdetails=0&limit=5&q=${encodeURIComponent(trimmed)}`;
    const response = await throttledFetch(url);
    if (!response.ok) {
        throw new Error(`Nominatim respondió ${response.status}`);
    }
    const results = (await response.json()) as NominatimResult[];
    return results.map(parseResult);
}

/** Obtiene la dirección/lugar más cercano a unas coordenadas. */
export async function reverseGeocode(
    lat: number,
    lon: number,
): Promise<GeoLocation | null> {
    const url = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lon}`;
    const response = await throttledFetch(url);
    if (!response.ok) {
        throw new Error(`Nominatim respondió ${response.status}`);
    }
    const item = (await response.json()) as NominatimResult;
    if (item.error) return null;
    return parseResult(item);
}

/**
 * Deriva una etiqueta de zona legible a partir de la clasificación OSM que
 * ya viene incluida en el resultado de búsqueda/reverse — Nominatim no
 * expone un endpoint aparte de "tipo de terreno", así que esto NO hace una
 * llamada de red adicional.
 */
export function getTerrainInfo(location: GeoLocation): { zoneLabel: string } {
    return {
        zoneLabel:
            (location.zoneType && ZONE_LABELS[location.zoneType]) ??
            'Sin clasificar',
    };
}
