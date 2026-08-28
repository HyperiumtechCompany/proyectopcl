import type { GeoLocation, Point2D } from './types';

/**
 * Capa de fondo satelital (Fase 3.1 del plan, "Imagen satelital de fondo —
 * `<image>` SVG"): convierte la ubicación buscada (`GeoLocation`, lat/lon)
 * en un grupo fijo de tiles de Esri World Imagery, posicionados en el
 * espacio LOCAL del canvas del emplazamiento (metros relativos al punto
 * buscado, no coordenadas geográficas absolutas — el canvas nunca tuvo
 * georreferenciación real, solo ese único punto de anclaje).
 *
 * Todo el cálculo se hace en metros de proyección Web Mercator (la MISMA
 * proyección que usa el servicio de tiles) en vez de una aproximación de
 * "metros reales" — así los tiles calzan borde a borde sin costuras. La
 * distorsión de Mercator vs. metros reales en esta latitud (~10°S, Perú) es
 * de ~1.5%, el mismo estándar que usa cualquier mapa web (Google/OSM
 * también muestran metros de Mercator como si fueran reales).
 */

const EARTH_RADIUS_M = 6378137; // radio esférico WGS84 usado por Web Mercator

/**
 * Zoom por defecto de la capa satelital. Esri World Imagery NO tiene la
 * misma resolución en todo el mundo — fuera de grandes ciudades de EE.UU./
 * Europa, muchas zonas (confirmado con Huánuco, Perú, el caso real que
 * reportó el usuario) devuelven el tile placeholder "Map data not yet
 * available" a partir de zoom 18. 17 (~1.2 m/px) es el nivel más alto que
 * tuvo cobertura real al probar contra el servicio — de ahí el default; el
 * usuario puede acercar/alejar con el control de zoom del visor si su zona
 * tiene mejor o peor cobertura.
 */
export const DEFAULT_SATELLITE_ZOOM = 17;
export const MIN_SATELLITE_ZOOM = 12;
export const MAX_SATELLITE_ZOOM = 19;

function lonToMercatorX(lon: number): number {
    return ((lon * Math.PI) / 180) * EARTH_RADIUS_M;
}

function latToMercatorY(lat: number): number {
    const rad = (lat * Math.PI) / 180;
    return Math.log(Math.tan(Math.PI / 4 + rad / 2)) * EARTH_RADIUS_M;
}

export function toWebMercator(lat: number, lon: number): Point2D {
    return { x: lonToMercatorX(lon), y: latToMercatorY(lat) };
}

function worldSizeM(): number {
    return 2 * Math.PI * EARTH_RADIUS_M;
}

/** Tamaño de un tile (256px) en metros de Mercator, a un zoom dado. */
export function tileWorldSizeAtZoom(zoom: number): number {
    return worldSizeM() / 2 ** zoom;
}

/** Índice de tile (esquema slippy-map estándar) que contiene un punto Mercator. */
export function tileIndexForMercator(
    mercX: number,
    mercY: number,
    zoom: number,
): { tx: number; ty: number } {
    const half = worldSizeM() / 2;
    const scale = 2 ** zoom;
    const tx = Math.floor(((mercX + half) / worldSizeM()) * scale);
    const ty = Math.floor(((half - mercY) / worldSizeM()) * scale);
    return { tx, ty };
}

/** Esquina NW (superior-izquierda) de un tile, en metros de Mercator. */
export function tileOriginMercator(
    tx: number,
    ty: number,
    zoom: number,
): Point2D {
    const half = worldSizeM() / 2;
    const scale = 2 ** zoom;
    return {
        x: (tx / scale) * worldSizeM() - half,
        y: half - (ty / scale) * worldSizeM(),
    };
}

export interface SatelliteTile {
    key: string;
    url: string;
    /** Esquina superior-izquierda del tile, en unidades locales del canvas (metros si `terrainScaleM=1`). */
    x: number;
    y: number;
    /** Lado del tile (cuadrado) en unidades locales del canvas. */
    size: number;
}

/**
 * Grid fijo de `(2*gridRadius+1)²` tiles centrado en `location`, a un zoom
 * fijo — no es un mapa deslizante infinito: es un fondo estático que cubre
 * el área alrededor del lote (por defecto zoom 17 ≈ 1.2 m/px, grid 5×5 ≈
 * 1.5×1.5 km — también sirve para ubicarse en la ciudad, no solo el lote),
 * acotado a un número de requests razonable.
 */
export function computeSatelliteTiles(
    location: GeoLocation,
    terrainScaleM: number,
    zoom = DEFAULT_SATELLITE_ZOOM,
    gridRadius = 2,
): SatelliteTile[] {
    const scaleM = terrainScaleM || 1;
    const anchor = toWebMercator(location.lat, location.lon);
    const { tx: centerTx, ty: centerTy } = tileIndexForMercator(
        anchor.x,
        anchor.y,
        zoom,
    );
    const tileSize = tileWorldSizeAtZoom(zoom) / scaleM;
    const tiles: SatelliteTile[] = [];
    for (let dy = -gridRadius; dy <= gridRadius; dy++) {
        for (let dx = -gridRadius; dx <= gridRadius; dx++) {
            const tx = centerTx + dx;
            const ty = centerTy + dy;
            const origin = tileOriginMercator(tx, ty, zoom);
            tiles.push({
                key: `${zoom}/${tx}/${ty}`,
                // Esri usa el orden z/y/x en la URL (al revés que el
                // esquema estándar OSM z/x/y) — mismos índices de tile.
                url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`,
                x: (origin.x - anchor.x) / scaleM,
                // Norte (Mercator Y creciente) = arriba en el canvas (Y de
                // SVG decreciente) — se invierte el signo.
                y: -(origin.y - anchor.y) / scaleM,
                size: tileSize,
            });
        }
    }
    return tiles;
}
