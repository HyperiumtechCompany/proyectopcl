import { describe, expect, it } from 'vitest';
import type { Door, Partition, Wall, Window } from '@/pages/dialux/hooks/types';
import { buildPartitionOcclusionBoxes, buildWallOcclusionBoxes } from './occlusionBoxes';

function buildWall(overrides: Partial<Wall> = {}): Wall {
    return {
        id: 'wall-1',
        vertices: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
        ],
        thickness: 0.2,
        height: 2.8,
        ...overrides,
    };
}

describe('buildWallOcclusionBoxes', () => {
    it('genera una única caja de piso a techo para un muro sin aberturas', () => {
        const boxes = buildWallOcclusionBoxes([buildWall()], [], []);

        expect(boxes).toHaveLength(1);
        expect(boxes[0]).toMatchObject({ originX: 0, originY: 0, angleRad: 0, length: 4, thickness: 0.2, zMin: 0, zMax: 2.8 });
    });

    it('una ventana produce 4 cajas: antes, antepecho, dintel, después (el vano del vidrio queda sin caja)', () => {
        const window: Window = {
            id: 'win-1',
            wallId: 'wall-1',
            offsetAlongWall: 1.5,
            width: 1.0,
            height: 1.2,
            sillHeight: 0.9,
        };
        const boxes = buildWallOcclusionBoxes([buildWall()], [window], []);

        expect(boxes).toHaveLength(4);
        const zRanges = boxes.map((b) => [b.zMin, b.zMax]);
        // Antepecho (debajo del vidrio) y dintel (encima) deben existir.
        expect(zRanges).toContainEqual([0, 0.9]);
        expect(zRanges).toContainEqual([2.1, 2.8]);
        // Ninguna caja cubre el rango [0.9, 2.1] (el vidrio) en el tramo de la ventana.
        const windowSpanBoxes = boxes.filter((b) => b.originX >= 1.4 && b.originX <= 2.6 && b.length <= 1.01);
        for (const box of windowSpanBoxes) {
            expect(box.zMax <= 0.9 || box.zMin >= 2.1).toBe(true);
        }
    });

    it('una puerta (zFrom=0) NO genera caja de antepecho, solo dintel — 3 cajas en total', () => {
        const door: Door = {
            id: 'door-1',
            wallId: 'wall-1',
            offsetAlongWall: 1.0,
            width: 0.9,
            height: 2.1,
        };
        const boxes = buildWallOcclusionBoxes([buildWall()], [], [door]);

        expect(boxes).toHaveLength(3);
        expect(boxes.some((b) => b.zMin === 0 && b.zMax === 2.1 && b.length <= 0.91)).toBe(false);
        expect(boxes.some((b) => b.zMin === 2.1 && b.zMax === 2.8)).toBe(true);
    });

    it('respeta la orientación de un muro en ángulo (polilínea con giro)', () => {
        const bentWall = buildWall({
            vertices: [
                { x: 0, y: 0 },
                { x: 3, y: 0 },
                { x: 3, y: 3 },
            ],
        });
        const boxes = buildWallOcclusionBoxes([bentWall], [], []);

        expect(boxes).toHaveLength(2);
        const angles = boxes.map((b) => b.angleRad).sort((a, b) => a - b);
        expect(angles[0]).toBeCloseTo(0, 9);
        expect(angles[1]).toBeCloseTo(Math.PI / 2, 9);
    });

    it('ignora ventanas/puertas de otro muro', () => {
        const window: Window = { id: 'win-x', wallId: 'otro-muro', offsetAlongWall: 1, width: 1, height: 1, sillHeight: 1 };
        const boxes = buildWallOcclusionBoxes([buildWall()], [window], []);

        expect(boxes).toHaveLength(1);
    });
});

function buildPartition(overrides: Partial<Partition> = {}): Partition {
    return {
        id: 'part-1',
        vertices: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
        ],
        thickness: 0.05,
        height: 2.1,
        partitionType: 'melamine',
        isPartialHeight: true,
        bottomGap: 0.15,
        ...overrides,
    };
}

describe('buildPartitionOcclusionBoxes', () => {
    it('usa bottomGap como zMin de toda la partición, no solo en las puertas', () => {
        const boxes = buildPartitionOcclusionBoxes([buildPartition()], []);

        expect(boxes).toHaveLength(1);
        expect(boxes[0]).toMatchObject({ zMin: 0.15, zMax: 2.1 });
    });

    it('las particiones de vidrio no generan ninguna caja (transparentes)', () => {
        const boxes = buildPartitionOcclusionBoxes([buildPartition({ partitionType: 'glass' })], []);

        expect(boxes).toHaveLength(0);
    });

    it('una puerta en la partición recorta el tramo entre bottomGap y su altura', () => {
        const door: Door = { id: 'door-p', partitionId: 'part-1', wallId: '', offsetAlongWall: 0.5, width: 0.7, height: 2.0 };
        const boxes = buildPartitionOcclusionBoxes([buildPartition()], [door]);

        // antes, dintel (2.0-2.1), después — no hay "antepecho" porque door.zFrom=0 < bottomGap se recorta a bottomGap y door.zTo(2.0) > bottomGap, dejando el hueco [bottomGap,2.0] libre.
        expect(boxes).toHaveLength(3);
        expect(boxes.some((b) => b.zMin === 2.0 && b.zMax === 2.1)).toBe(true);
    });

    it('ignora puertas que pertenecen a un muro (wallId), no a esta partición', () => {
        const door: Door = { id: 'door-w', wallId: 'wall-1', offsetAlongWall: 0.5, width: 0.7, height: 2.0 };
        const boxes = buildPartitionOcclusionBoxes([buildPartition()], [door]);

        expect(boxes).toHaveLength(1);
    });
});
