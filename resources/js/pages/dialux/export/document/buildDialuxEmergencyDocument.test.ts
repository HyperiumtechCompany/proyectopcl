import { describe, expect, it } from 'vitest';
import type { LightingResult, Project, Room, Scene } from '@/pages/dialux/hooks/types';
import { buildDialuxEmergencyDocument } from './buildDialuxEmergencyDocument';

/**
 * Suite de la Fase 14 ("Emergencia", plan maestro §11). Puerta de salida
 * explícita: "los resultados de emergencia nunca se confunden con
 * iluminación normal" — este documento es un `DialuxFormalDocument`
 * DISTINTO del informe normal, con su propia portada y sin las páginas del
 * informe normal (fichas de producto, catálogo de luminarias, planos).
 */
function buildRoom(overrides: Partial<Room> = {}): Room {
    return {
        id: 'route-1',
        name: 'Pasillo principal',
        roomType: 'evacuation-route',
        vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 2 },
            { x: 0, y: 2 },
        ],
        height: 3,
        color: '#000000',
        ...overrides,
    };
}

function buildProject(room: Room): Project {
    const scene: Scene = {
        id: 'scene-1',
        name: 'Piso 1',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: { unit: 'm', factor: 1, displayUnit: 'Metros (1 = 1m)', calibrationFactor: 1, isCalibrated: true },
        rooms: [room],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: [],
        lightSwitches: [],
        partitions: [],
    };
    return {
        id: 'emergency-doc-project',
        name: 'Proyecto de prueba — informe de emergencia',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        scenes: [scene],
    };
}

function buildResult(minLux: number): LightingResult {
    return {
        avg_lux: minLux + 2,
        min_lux: minLux,
        max_lux: minLux + 5,
        uniformity: 0.5,
        ugr: 0,
        grid_rows: 1,
        grid_cols: 2,
        grid_values: [minLux, minLux + 5],
        grid_origin_x: 0,
        grid_origin_y: 0,
        grid_cell_width: 5,
        grid_cell_height: 2,
    };
}

describe('buildDialuxEmergencyDocument', () => {
    it('genera una portada de emergencia distinta a la del informe normal', () => {
        const project = buildProject(buildRoom());
        const document = buildDialuxEmergencyDocument({
            project,
            emergencyResultsByRoom: {},
            exportedAt: '2026-08-04T00:00:00.000Z',
        });

        expect(document.title).toContain('Alumbrado de Emergencia');
        expect(document.title).not.toContain('Reporte DIAlux');
        expect(document.fileBaseName).toContain('informe-emergencia');
        expect(document.pages[0]!.kind).toBe('emergency-cover');
        expect(document.pages[0]!.title).toBe('INFORME DE ALUMBRADO DE EMERGENCIA');
    });

    it('no incluye páginas del informe normal (fichas de producto, catálogo, planos)', () => {
        const project = buildProject(buildRoom());
        const document = buildDialuxEmergencyDocument({
            project,
            emergencyResultsByRoom: {},
            exportedAt: '2026-08-04T00:00:00.000Z',
        });

        const kinds = document.pages.map((p) => p.kind);
        expect(kinds).not.toContain('product-sheet');
        expect(kinds).not.toContain('luminaire-list');
        expect(kinds).not.toContain('ambient-summary');
        expect(document.luminaires).toEqual([]);
        expect(document.assets).toEqual([]);
    });

    it('evalúa cada ambiente evacuation-route/antipanic-area contra A.130 y EN 1838 por separado', () => {
        const room = buildRoom();
        const project = buildProject(room);
        const objectId = `${room.id}::ambient-1`;

        const document = buildDialuxEmergencyDocument({
            project,
            emergencyResultsByRoom: { [objectId]: buildResult(5) },
            exportedAt: '2026-08-04T00:00:00.000Z',
        });

        const tablePage = document.pages.find((p) => p.kind === 'emergency-compliance-table')!;
        expect(tablePage.emergencyRooms).toHaveLength(1);

        const report = tablePage.emergencyRooms![0]!;
        expect(report.roomType).toBe('evacuation-route');
        expect(report.minLux).toBe(5);
        expect(report.criticalPoint).not.toBeNull();
        expect(report.evaluations).toHaveLength(2);

        const a130 = report.evaluations.find((e) => e.standard === 'rne_a130')!;
        expect(a130.status).toBe('fail'); // 5 lx < 10 lx exigido por A.130
        const en1838 = report.evaluations.find((e) => e.standard === 'en_1838')!;
        expect(en1838.status).toBe('pass'); // 5 lx >= 1 lx de referencia
    });

    it('ambientes normales (roomType ambient) no aparecen en el informe de emergencia', () => {
        const normalRoom = buildRoom({ id: 'office-1', roomType: 'ambient' });
        const project = buildProject(normalRoom);

        const document = buildDialuxEmergencyDocument({
            project,
            emergencyResultsByRoom: {},
            exportedAt: '2026-08-04T00:00:00.000Z',
        });

        const tablePage = document.pages.find((p) => p.kind === 'emergency-compliance-table')!;
        expect(tablePage.emergencyRooms).toEqual([]);
    });

    it('sin resultado de emergencia calculado para un ambiente, queda not-evaluated en vez de asumir 0 o pasar', () => {
        const room = buildRoom();
        const project = buildProject(room);

        const document = buildDialuxEmergencyDocument({
            project,
            emergencyResultsByRoom: {}, // ningún resultado calculado todavía
            exportedAt: '2026-08-04T00:00:00.000Z',
        });

        const tablePage = document.pages.find((p) => p.kind === 'emergency-compliance-table')!;
        const report = tablePage.emergencyRooms![0]!;
        expect(report.minLux).toBeNull();
        expect(report.evaluations.every((e) => e.status === 'not-evaluated')).toBe(true);
    });
});
