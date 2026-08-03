import { describe, expect, it } from 'vitest';
import type { Fixture, Project, Room, Scene } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxFormalDocument } from './buildDialuxFormalDocument';
import { buildDialuxExportSnapshot } from '../snapshot/buildDialuxExportSnapshot';
import {
    buildModuloIProjectFixture,
    MODULO_I_EXPECTED_LEVEL_COUNT,
} from '../__fixtures__/moduloIFixture';

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

const ROOM_WIDTH = 5;
const ROOM_HEIGHT = 4;
const ROOM_GAP = 1;
const ROOMS_PER_LEVEL = 8;

/**
 * Proyecto grande (N niveles × 8 ambientes, mismo patrón que MÓDULO I) para
 * forzar un informe de más de 242 páginas y verificar la estabilidad del
 * paginador con volumen real.
 */
function buildLargeProjectFixture(levelCount: number): Project {
    const scenes: Scene[] = Array.from({ length: levelCount }, (_, levelIndex) => {
        const rooms: Room[] = Array.from({ length: ROOMS_PER_LEVEL }, (_, roomIndex) => {
            const col = roomIndex % 4;
            const row = Math.floor(roomIndex / 4);
            const x0 = col * (ROOM_WIDTH + ROOM_GAP);
            const y0 = row * (ROOM_HEIGHT + ROOM_GAP);

            return {
                id: `l${levelIndex}-r${roomIndex}`,
                name: `Ambiente ${roomIndex + 1} - Nivel ${levelIndex + 1}`,
                vertices: [
                    { x: x0, y: y0 },
                    { x: x0 + ROOM_WIDTH, y: y0 },
                    { x: x0 + ROOM_WIDTH, y: y0 + ROOM_HEIGHT },
                    { x: x0, y: y0 + ROOM_HEIGHT },
                ],
                height: 2.8,
                color: 'rgba(56,189,248,0.25)',
                illuminanceLux: 300 + roomIndex * 10,
                norma: 300 + roomIndex * 10,
                fixtureLumens: 3000,
                fixtureFlux: 3000,
            };
        });

        const fixtures: Fixture[] = rooms.map((room, roomIndex) => ({
            id: `l${levelIndex}-r${roomIndex}-fixture`,
            name: 'Panel LED',
            x: room.vertices[0]!.x + ROOM_WIDTH / 2,
            y: room.vertices[0]!.y + ROOM_HEIGHT / 2,
            z: 2.6,
            lumens: 3000,
            efficiency: 0.8,
            fixtureType: 'panel' as const,
            fixtureShape: 'rectangular' as const,
            lightColor: '#fff5e1',
            roomId: `${room.id}::ambient-1`,
            brand: `Fabricante Nivel ${levelIndex + 1}`,
            articleNumber: `ART-L${levelIndex}-${roomIndex}`,
            power: 30,
        }));

        return {
            id: `scene-${levelIndex}`,
            name: `Nivel ${levelIndex + 1}`,
            floorIndex: levelIndex,
            floorElevation: levelIndex * 2.8,
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
            rooms,
            walls: [],
            windows: [],
            doors: [],
            canopies: [],
            fixtures,
        };
    });

    return {
        id: 'large-project-fixture',
        name: 'Proyecto Grande Multinivel',
        created_at: '2026-07-22T10:00:00.000Z',
        updated_at: '2026-07-22T10:00:00.000Z',
        scenes,
    };
}

describe('Fase 7 — paginador e índice estable', () => {
    it('un informe de más de 242 páginas no tiene números de página duplicados ni huecos', async () => {
        // 12 niveles × 8 ambientes con producto distinto por ambiente ya
        // supera holgadamente las 242 páginas de la referencia.
        const project = buildLargeProjectFixture(12);
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            includeAllScenes: true,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        expect(documentModel.pages.length).toBeGreaterThan(242);

        const pageNumbers = documentModel.pages
            .map((page) => page.pageNumber)
            .sort((a, b) => a - b);
        // Sin duplicados.
        expect(new Set(pageNumbers).size).toBe(pageNumbers.length);
        // Sin huecos: secuencia exacta 1..N.
        for (let i = 0; i < pageNumbers.length; i++) {
            expect(pageNumbers[i]).toBe(i + 1);
        }

        // IDs de página únicos en todo el documento.
        const pageIds = documentModel.pages.map((page) => page.id);
        expect(new Set(pageIds).size).toBe(pageIds.length);

        // Toda entrada de índice "item" apunta a una página real existente.
        const realPageNumbers = new Set(pageNumbers);
        const itemEntries = documentModel.toc.filter(
            (entry) => (entry.kind ?? 'item') === 'item',
        );
        expect(itemEntries.length).toBeGreaterThan(0);
        for (const entry of itemEntries) {
            expect(realPageNumbers.has(entry.pageNumber)).toBe(true);
        }
    });

    it('regenerar el documento con los mismos datos produce la misma paginación', async () => {
        const project = buildModuloIProjectFixture();
        const buildOnce = () => {
            const snapshot = buildDialuxExportSnapshot({
                project,
                activeSceneId: project.scenes[0]!.id,
                includeAllScenes: true,
                resultsByRoom: {},
                dxfEntities: null,
                dxfExtents: null,
                visualConfig: VISUAL_CONFIG,
            });
            return buildDialuxFormalDocument(snapshot, []);
        };

        const first = buildOnce();
        const second = buildOnce();

        // Comparamos estructura de paginación (ids, kinds, pageNumber, toc),
        // no el documento completo — campos como provenance.calculatedAt son
        // legítimamente distintos entre invocaciones (timestamp real).
        const summarize = (doc: ReturnType<typeof buildOnce>) => ({
            pages: doc.pages.map((p) => ({
                id: p.id,
                kind: p.kind,
                pageNumber: p.pageNumber,
                sectionId: p.sectionId,
            })),
            toc: doc.toc.map((t) => ({
                sectionId: t.sectionId,
                pageNumber: t.pageNumber,
                title: t.title,
            })),
        });

        expect(summarize(first)).toEqual(summarize(second));
    });

    it('un informe sin niveles con contenido (0 ambientes) sigue generando un índice consistente', async () => {
        const project = buildLargeProjectFixture(0);
        project.scenes.push({
            id: 'scene-empty',
            name: 'Nivel único vacío',
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
            rooms: [],
            walls: [],
            windows: [],
            doors: [],
            canopies: [],
            fixtures: [],
        });

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-empty',
            includeAllScenes: true,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });

        expect(() => buildDialuxFormalDocument(snapshot, [])).not.toThrow();
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        const pageNumbers = documentModel.pages
            .map((page) => page.pageNumber)
            .sort((a, b) => a - b);
        expect(new Set(pageNumbers).size).toBe(pageNumbers.length);
        for (let i = 0; i < pageNumbers.length; i++) {
            expect(pageNumbers[i]).toBe(i + 1);
        }
    });

    it('MÓDULO I (3 niveles) también cumple continuidad de paginación sin huecos ni duplicados', async () => {
        const project = buildModuloIProjectFixture();
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            includeAllScenes: true,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        expect(documentModel.levels).toHaveLength(MODULO_I_EXPECTED_LEVEL_COUNT);

        const pageNumbers = documentModel.pages
            .map((page) => page.pageNumber)
            .sort((a, b) => a - b);
        expect(new Set(pageNumbers).size).toBe(pageNumbers.length);
        for (let i = 0; i < pageNumbers.length; i++) {
            expect(pageNumbers[i]).toBe(i + 1);
        }
    });
});
