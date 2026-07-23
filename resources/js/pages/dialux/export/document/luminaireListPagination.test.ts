import { describe, expect, it } from 'vitest';
import type { Fixture, Project } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxFormalDocument } from './buildDialuxFormalDocument';
import { buildDialuxExportSnapshot } from '../snapshot/buildDialuxExportSnapshot';

const VISUAL_CONFIG = {
    showGrid: true,
    showIsolux: true,
    show3DView: false,
    isoluxMode: 'functional' as const,
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedId: null,
};

/** 25 productos distintos (cada uno con su propio articleNumber) en un solo ambiente. */
function buildManyProductsFixture(productCount: number): Project {
    const fixtures: Fixture[] = Array.from(
        { length: productCount },
        (_, index) => ({
            id: `fixture-${index}`,
            name: `Luminaria modelo ${index}`,
            x: 1 + (index % 5),
            y: 1 + Math.floor(index / 5),
            z: 2.6,
            lumens: 3000 + index,
            efficiency: 0.8,
            fixtureType: 'panel' as const,
            fixtureShape: 'rectangular' as const,
            lightColor: '#fff5e1',
            roomId: 'room-1::ambient-1',
            brand: 'Fabricante Test',
            articleNumber: `ART-${index}`,
            power: 30 + index,
        }),
    );

    return {
        id: 'many-products-fixture',
        name: 'Proyecto Muchos Productos',
        created_at: '2026-07-22T10:00:00.000Z',
        updated_at: '2026-07-22T10:00:00.000Z',
        scenes: [
            {
                id: 'scene-1',
                name: 'Planta Baja',
                floorIndex: 0,
                floorElevation: 0,
                floorHeight: 2.8,
                lightSwitches: [],
                partitions: [],
                scaleConfig: {
                    unit: 'm',
                    factor: 1,
                    displayUnit: 'Metros (1 = 1m)',
                    calibrationFactor: 1,
                    isCalibrated: false,
                },
                rooms: [
                    {
                        id: 'room-1',
                        name: 'Salón grande',
                        vertices: [
                            { x: 0, y: 0 },
                            { x: 10, y: 0 },
                            { x: 10, y: 10 },
                            { x: 0, y: 10 },
                        ],
                        height: 2.8,
                        color: 'rgba(56,189,248,0.25)',
                        illuminanceLux: 500,
                        norma: 500,
                        fixtureLumens: 4000,
                        fixtureFlux: 4000,
                    },
                ],
                walls: [],
                windows: [],
                doors: [],
                canopies: [],
                fixtures,
            },
        ],
    };
}

describe('Fase 4 — paginación de listas de luminarias', () => {
    it('divide la lista global de luminarias en varias páginas cuando excede el límite por página', async () => {
        const project = buildManyProductsFixture(25);
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        expect(documentModel.luminaires).toHaveLength(25);

        const luminaireListPages = documentModel.pages.filter(
            (page) => page.kind === 'luminaire-list',
        );
        expect(luminaireListPages.length).toBeGreaterThan(1);

        // Sin huecos ni solapes: los rangos cubren exactamente [0, 25).
        const sortedRanges = [...luminaireListPages]
            .map((page) => [page.rowRangeStart ?? 0, page.rowRangeEnd ?? 0] as const)
            .sort((a, b) => a[0] - b[0]);
        expect(sortedRanges[0]![0]).toBe(0);
        expect(sortedRanges.at(-1)![1]).toBe(25);
        for (let i = 1; i < sortedRanges.length; i++) {
            expect(sortedRanges[i]![0]).toBe(sortedRanges[i - 1]![1]);
        }

        // Solo la primera página del rango debe partir en 0 (única que
        // debería mostrar los totales — verificado a nivel de rowRangeStart,
        // la decisión real de ocultarlos vive en el Blade).
        const firstPages = luminaireListPages.filter(
            (page) => (page.rowRangeStart ?? 0) === 0,
        );
        expect(firstPages).toHaveLength(1);
    });

    it('no pagina cuando la lista cabe en una sola página', async () => {
        const project = buildManyProductsFixture(3);
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        const luminaireListPages = documentModel.pages.filter(
            (page) => page.kind === 'luminaire-list',
        );
        expect(luminaireListPages).toHaveLength(1);
        expect(luminaireListPages[0]?.rowRangeStart).toBe(0);
        expect(luminaireListPages[0]?.rowRangeEnd).toBe(3);
    });
});
