import { describe, expect, it } from 'vitest';
import { polygonAreaM2 } from '@/pages/dialux/geometry/polygonGeometry';
import type { Door, Partition, Vertex, Wall, Window } from '@/pages/dialux/hooks/types';
import { buildPartitionOcclusionBoxes, buildWallOcclusionBoxes } from './occlusionBoxes';

/** Suma de áreas de las cajas devueltas — invariante de correctitud reutilizado en varios tests: para un contorno cerrado ortogonal, debe coincidir con `polygonAreaM2` del contorno original, sea cual sea su forma. */
function totalBoxArea(boxes: ReturnType<typeof buildWallOcclusionBoxes>): number {
    return boxes.reduce((sum, b) => sum + b.length * b.thickness, 0);
}

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

describe('buildWallOcclusionBoxes — muros de contorno cerrado (Rondas 21l→25: una caja por arista del recorrido)', () => {
    /**
     * Historia (no repetir el ciclo — detalle completo en el doc-comment de
     * `occlusionBoxes.ts`): el editor guarda `wall.vertices` de un muro
     * interior como un CONTORNO CERRADO. Las Rondas 23/24 lo interpretaban
     * como la huella RELLENA de un muro grueso y la descomponían en
     * rectángulos — matemáticamente exacto, pero la premisa era falsa: en
     * el proyecto real Módulo 22 el anillo es el RECORRIDO PERIMETRAL del
     * muro alrededor del ambiente (encierra el interior del ambiente, no la
     * huella de un muro), y rellenarlo ocluía la luz de las propias
     * luminarias del ambiente (Ē caía -64.5%). Desde la Ronda 25 todo
     * contorno pasa por el camino por-segmento: una caja por arista, con el
     * espesor DECLARADO (`wall.thickness`) centrado en la arista.
     */
    function ringArea(vertices: Vertex[]): number {
        return polygonAreaM2(vertices);
    }

    it('rectángulo cerrado simple: una caja por arista no degenerada, espesor declarado en todas', () => {
        const closedOutlineWall: Wall = {
            id: 'wall-simple-outline',
            vertices: [
                { x: 0, y: 0 },
                { x: 0, y: 0.2 },
                { x: 5, y: 0.2 },
                { x: 5, y: 0 },
                { x: 0, y: 0 },
            ],
            thickness: 0.2,
            height: 2.8,
        };

        const boxes = buildWallOcclusionBoxes([closedOutlineWall], [], []);

        // 4 aristas (2 caras largas + 2 remates cortos) — cada una es una
        // caja con el espesor declarado; la oclusión es binaria, así que
        // trazar ambas caras de una banda delgada no "bloquea doble".
        expect(boxes).toHaveLength(4);
        for (const box of boxes) {
            expect(box.thickness).toBeCloseTo(0.2, 9);
            expect(box.zMin).toBe(0);
            expect(box.zMax).toBe(2.8);
        }
        const lengths = boxes.map((b) => b.length).sort((a, b) => a - b);
        expect(lengths[2]).toBeCloseTo(5, 6);
        expect(lengths[3]).toBeCloseTo(5, 6);
    });

    it('anillo perimetral real (Módulo 22, muro 31efa5ea alrededor de SS.HH): ninguna caja cubre el interior del ambiente', () => {
        // Copiado exacto del proyecto real — el anillo encierra 2.18 m²,
        // el INTERIOR del ambiente SS.HH, con muescas de jamba de ~0.13 m.
        const modulo22Ring: Wall = {
            id: 'wall-modulo22-ring',
            vertices: [
                { x: 3541.381, y: 1654.979 },
                { x: 3540.681, y: 1654.979 },
                { x: 3540.681, y: 1654.869 },
                { x: 3540.551, y: 1654.869 },
                { x: 3540.551, y: 1652.659 },
                { x: 3541.381, y: 1652.659 },
                { x: 3541.381, y: 1652.779 },
                { x: 3541.516, y: 1652.779 },
                { x: 3541.516, y: 1654.749 },
                { x: 3541.381, y: 1654.749 },
                { x: 3541.381, y: 1654.979 },
            ],
            thickness: 0.13,
            height: 4.67,
        };

        const boxes = buildWallOcclusionBoxes([modulo22Ring], [], []);

        // El área total de cajas debe ser la de una BANDA delgada a lo largo
        // del recorrido (~perímetro × espesor), nunca acercarse al área
        // encerrada por el anillo (2.18 m² × altura — el bug de la Ronda
        // 23/24 que ocluía el interior del ambiente).
        const perimeter = modulo22Ring.vertices
            .slice(0, -1)
            .reduce((sum, v, i) => sum + Math.hypot(modulo22Ring.vertices[i + 1]!.x - v.x, modulo22Ring.vertices[i + 1]!.y - v.y), 0);
        expect(totalBoxArea(boxes)).toBeCloseTo(perimeter * 0.13, 6);
        expect(totalBoxArea(boxes)).toBeLessThan(ringArea(modulo22Ring.vertices));
        for (const box of boxes) {
            expect(box.thickness).toBeCloseTo(0.13, 9);
        }
        // Un punto en el CENTRO del ambiente no puede quedar dentro de
        // ninguna caja (era exactamente lo que pasaba con el relleno).
        const cx = 3541.03;
        const cy = 1653.8;
        for (const box of boxes) {
            const dx = cx - box.originX;
            const dy = cy - box.originY;
            const cos = Math.cos(box.angleRad);
            const sin = Math.sin(box.angleRad);
            const localX = dx * cos + dy * sin;
            const localY = -dx * sin + dy * cos;
            const inside = localX >= 0 && localX <= box.length && Math.abs(localY) <= box.thickness / 2;
            expect(inside).toBe(false);
        }
    });

    it('muro real de Vinchos (25 vértices, forma de U con 2 giros de 90° y una muesca de jamba): sin cajas absurdamente grandes', () => {
        // Copiado exacto de `wall.vertices` del proyecto real (id 749e2ef7…, Aula 1°).
        const vinchosRealWall: Wall = {
            id: 'wall-vinchos-real',
            vertices: [
                { x: 0.3293902924498556, y: 20.708813908873935 },
                { x: 0.3293902924498556, y: 20.002543242004588 },
                { x: 0.16264309223185677, y: 20.002543242004588 },
                { x: 0.16264309223185686, y: 16.854580771903375 },
                { x: 0.331291625365373, y: 16.854580771903375 },
                { x: 0.331291625365373, y: 16.50561453035579 },
                { x: 0.6299223232802723, y: 16.50561453035579 },
                { x: 0.6299223232802722, y: 16.173994103349806 },
                { x: 0.3307747801644439, y: 16.173994103349806 },
                { x: 0.3307747801644438, y: 15.823738102796034 },
                { x: 0.15995507372287587, y: 15.823738102796034 },
                { x: 0.15995507372287598, y: 14.462572547086648 },
                { x: 7.3017703729712835, y: 14.462572547086648 },
                { x: 7.3017703729712835, y: 15.82466200088533 },
                { x: 7.1282057304383235, y: 15.82466200088533 },
                { x: 7.1282057304383235, y: 16.17387284897188 },
                { x: 6.829027573876065, y: 16.17387284897188 },
                { x: 6.829027573876065, y: 16.502793512832483 },
                { x: 7.129283301192599, y: 16.502793512832483 },
                { x: 7.129283301192599, y: 16.85342391324082 },
                { x: 7.300350325415456, y: 16.85441041763989 },
                { x: 7.300350325415455, y: 20.007428658232083 },
                { x: 7.1301456464975645, y: 20.007428658232083 },
                { x: 7.1301456464975645, y: 20.70646376726999 },
                { x: 0.3293902924498556, y: 20.708813908873935 },
            ],
            thickness: 0.13,
            height: 3,
        };

        const boxes = buildWallOcclusionBoxes([vinchosRealWall], [], []);

        // El bug de la Ronda 21l generaba una pared ~28 m² (techo a piso,
        // varios metros de largo, extruida otra vez por el grosor) para un
        // muro real de ~1 m² de huella — ninguna caja debe acercarse a eso.
        // Esto SÍ pasa con la descomposición nueva (no es lo que falla abajo).
        for (const box of boxes) {
            expect(box.length * box.thickness).toBeLessThan(2);
        }
    });

    /**
     * Hallazgo de la Ronda 23, REINTERPRETADO en la Ronda 25: el área de
     * este contorno (shoelace) da 43.796 m², idéntica al área del ambiente
     * que delimita (43.80 m², Aula 1° real) — porque el anillo es el
     * RECORRIDO PERIMETRAL del muro alrededor del ambiente, no la huella de
     * un muro delgado. Con el comportamiento por-arista de la Ronda 25 las
     * cajas cubren solo la banda del recorrido (~perímetro × 0.13), así que
     * este assert (área de cajas == área encerrada) DEBE seguir fallando —
     * si algún día pasa, alguien volvió a rellenar el interior del anillo
     * (el bug que ocluía la luz de las propias luminarias del ambiente).
     */
    it.fails('el área de cajas NUNCA debe igualar el área encerrada por el anillo (eso era el bug de relleno de las Rondas 23/24)', () => {
        const vinchosRealWall: Wall = {
            id: 'wall-vinchos-real-anomaly',
            vertices: [
                { x: 0.3293902924498556, y: 20.708813908873935 },
                { x: 0.3293902924498556, y: 20.002543242004588 },
                { x: 0.16264309223185677, y: 20.002543242004588 },
                { x: 0.16264309223185686, y: 16.854580771903375 },
                { x: 0.331291625365373, y: 16.854580771903375 },
                { x: 0.331291625365373, y: 16.50561453035579 },
                { x: 0.6299223232802723, y: 16.50561453035579 },
                { x: 0.6299223232802722, y: 16.173994103349806 },
                { x: 0.3307747801644439, y: 16.173994103349806 },
                { x: 0.3307747801644438, y: 15.823738102796034 },
                { x: 0.15995507372287587, y: 15.823738102796034 },
                { x: 0.15995507372287598, y: 14.462572547086648 },
                { x: 7.3017703729712835, y: 14.462572547086648 },
                { x: 7.3017703729712835, y: 15.82466200088533 },
                { x: 7.1282057304383235, y: 15.82466200088533 },
                { x: 7.1282057304383235, y: 16.17387284897188 },
                { x: 6.829027573876065, y: 16.17387284897188 },
                { x: 6.829027573876065, y: 16.502793512832483 },
                { x: 7.129283301192599, y: 16.502793512832483 },
                { x: 7.129283301192599, y: 16.85342391324082 },
                { x: 7.300350325415456, y: 16.85441041763989 },
                { x: 7.300350325415455, y: 20.007428658232083 },
                { x: 7.1301456464975645, y: 20.007428658232083 },
                { x: 7.1301456464975645, y: 20.70646376726999 },
                { x: 0.3293902924498556, y: 20.708813908873935 },
            ],
            thickness: 0.13,
            height: 3,
        };

        const boxes = buildWallOcclusionBoxes([vinchosRealWall], [], []);

        expect(totalBoxArea(boxes)).toBeCloseTo(ringArea(vinchosRealWall.vertices), 3);
    });

    it('un contorno cerrado NO ortogonal (giro que no es de 90°) también genera una caja por arista', () => {
        const diagonalClosedWall: Wall = {
            id: 'wall-non-orthogonal',
            vertices: [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4.3, y: 1.5 }, // giro que no es 90° respecto al tramo anterior
                { x: 0.3, y: 1.5 },
                { x: 0, y: 0 },
            ],
            thickness: 0.2,
            height: 2.8,
        };

        const boxes = buildWallOcclusionBoxes([diagonalClosedWall], [], []);

        expect(boxes.length).toBeGreaterThan(1);
        for (const box of boxes) {
            expect(box.thickness).toBeCloseTo(0.2, 9);
        }
    });
});

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
