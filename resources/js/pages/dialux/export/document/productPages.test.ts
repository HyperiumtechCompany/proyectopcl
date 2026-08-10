import { describe, expect, it } from 'vitest';
import type { Fixture } from '@/pages/dialux/hooks/types';
import type { DialuxExportSnapshot } from '../domain/types';
import { buildAmbientLuminaireList, buildLuminaireList } from './productPages';

/**
 * Regresión: `buildAmbientLuminaireList` alimenta las tarjetas de producto de
 * la sub-sección "Lista de luminarias" por ambiente (`renderAmbientProductCards`
 * en formal-pdf.blade.php, que busca `luminaire.polarDiagramAssetId` /
 * `productPhotoAssetId` / `brandLogoAssetId`). Hasta este fix, el objeto que
 * construía nunca copiaba esos 4 campos (aunque `buildLuminaireList` — usado
 * por las páginas "Ficha de producto" a nivel proyecto — sí lo hacía), así
 * que esa sub-sección mostraba "Gráfico no disponible" siempre, sin importar
 * si el producto tenía fotometría real.
 */
function buildFixture(overrides: Partial<Fixture> = {}): Fixture {
    return {
        id: 'fx-1',
        name: 'Luminaria de prueba',
        x: 0,
        y: 0,
        z: 2.5,
        rotation: 0,
        lumens: 3000,
        efficiency: 100,
        fixtureType: 'downlight',
        lightColor: '#ffffff',
        productId: 42,
        polarDiagramAssetId: 'prod-42-polar',
        productPhotoAssetId: 'prod-42-photo',
        brandLogoAssetId: 'prod-42-logo',
        lineDrawingAssetId: 'prod-42-drawing',
        ...overrides,
    } as Fixture;
}

describe('buildAmbientLuminaireList — propagación de asset IDs de producto', () => {
    it('copia polarDiagramAssetId/productPhotoAssetId/brandLogoAssetId/lineDrawingAssetId igual que buildLuminaireList', () => {
        const fixture = buildFixture();
        const ambient = {
            id: 'amb-1',
            roomName: 'Baño',
            name: 'Baño',
            fixtures: [fixture],
        } as unknown as DialuxExportSnapshot['ambients'][number];

        const [item] = buildAmbientLuminaireList(ambient);

        expect(item?.polarDiagramAssetId).toBe('prod-42-polar');
        expect(item?.productPhotoAssetId).toBe('prod-42-photo');
        expect(item?.brandLogoAssetId).toBe('prod-42-logo');
        expect(item?.lineDrawingAssetId).toBe('prod-42-drawing');
    });

    it('produce los mismos IDs de assets que buildLuminaireList para el mismo fixture', () => {
        const fixture = buildFixture();
        const ambient = {
            id: 'amb-1',
            roomName: 'Baño',
            name: 'Baño',
            room: { id: 'room-1' },
            fixtures: [fixture],
        } as unknown as DialuxExportSnapshot['ambients'][number];
        const snapshot = {
            fixtures: [{ ...fixture, roomId: 'room-1' }],
            ambients: [ambient],
            rooms: [],
        } as unknown as DialuxExportSnapshot;

        const [ambientItem] = buildAmbientLuminaireList(ambient);
        const [projectItem] = buildLuminaireList(snapshot);

        expect(ambientItem?.polarDiagramAssetId).toBe(projectItem?.polarDiagramAssetId);
        expect(ambientItem?.productPhotoAssetId).toBe(projectItem?.productPhotoAssetId);
        expect(ambientItem?.brandLogoAssetId).toBe(projectItem?.brandLogoAssetId);
        expect(ambientItem?.lineDrawingAssetId).toBe(projectItem?.lineDrawingAssetId);
    });
});
