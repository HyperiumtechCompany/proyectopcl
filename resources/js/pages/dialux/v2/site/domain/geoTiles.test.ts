import { describe, expect, it } from 'vitest';
import {
    computeSatelliteTiles,
    tileIndexForMercator,
    tileWorldSizeAtZoom,
    toWebMercator,
} from './geoTiles';

describe('toWebMercator / tileIndexForMercator', () => {
    it('el origen geográfico (0,0) cae en el tile (1,1) a zoom 1 — valor de referencia estándar slippy-map', () => {
        const merc = toWebMercator(0, 0);
        expect(merc.x).toBeCloseTo(0, 1);
        expect(merc.y).toBeCloseTo(0, 1);
        const { tx, ty } = tileIndexForMercator(merc.x, merc.y, 1);
        expect(tx).toBe(1);
        expect(ty).toBe(1);
    });

    it('a zoom 0 todo el mundo es un único tile (0,0)', () => {
        const merc = toWebMercator(-9.9, -76.24); // Huánuco, Perú
        const { tx, ty } = tileIndexForMercator(merc.x, merc.y, 0);
        expect(tx).toBe(0);
        expect(ty).toBe(0);
    });

    it('el hemisferio sur cae en la mitad inferior del grid de tiles', () => {
        const merc = toWebMercator(-9.9, -76.24);
        const { ty } = tileIndexForMercator(merc.x, merc.y, 2);
        expect(ty).toBeGreaterThanOrEqual(2); // mitad sur del grid 4x4 (ty 0-3)
    });
});

describe('tileWorldSizeAtZoom', () => {
    it('el tile se reduce a la mitad por cada nivel de zoom adicional', () => {
        const z10 = tileWorldSizeAtZoom(10);
        const z11 = tileWorldSizeAtZoom(11);
        expect(z10 / z11).toBeCloseTo(2, 5);
    });
});

describe('computeSatelliteTiles', () => {
    const location = { lat: -9.93, lon: -76.24, displayName: 'Huánuco, Perú' };

    it('genera un grid cuadrado de (2*gridRadius+1)² tiles', () => {
        const tiles = computeSatelliteTiles(location, 1, 19, 2);
        expect(tiles).toHaveLength(25);
    });

    it('el tile central queda anclado en (0,0) ± un tile completo — el punto buscado siempre cae dentro de él', () => {
        const tiles = computeSatelliteTiles(location, 1, 19, 2);
        const tileSize = tiles[0].size;
        const containingOrigin = tiles.find(
            (tile) =>
                tile.x <= 0 &&
                tile.x + tileSize >= 0 &&
                tile.y <= 0 &&
                tile.y + tileSize >= 0,
        );
        expect(containingOrigin).toBeDefined();
    });

    it('usa el orden z/y/x en la URL (convención Esri)', () => {
        const tiles = computeSatelliteTiles(location, 1, 19, 0);
        expect(tiles[0].url).toMatch(/MapServer\/tile\/19\/\d+\/\d+$/);
    });

    it('terrainScaleM mayor a 1 reduce el tamaño del tile en unidades de canvas', () => {
        const tilesScale1 = computeSatelliteTiles(location, 1, 19, 0);
        const tilesScale2 = computeSatelliteTiles(location, 2, 19, 0);
        expect(tilesScale2[0].size).toBeCloseTo(tilesScale1[0].size / 2, 3);
    });
});
