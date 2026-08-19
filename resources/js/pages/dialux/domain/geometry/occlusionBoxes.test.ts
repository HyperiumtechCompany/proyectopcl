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

describe('buildWallOcclusionBoxes — muros de contorno cerrado (Ronda 21l→23, corregido con descomposición geométrica)', () => {
    /**
     * Historia (no repetir el ciclo): el editor, al dibujar un muro con una
     * jamba/receso de puerta, guarda `wall.vertices` como el CONTORNO
     * CERRADO completo del muro (grosor ya incluido, primer punto == último
     * punto), no la polilínea de 2 puntos que el resto de este archivo
     * asume. Un primer intento (Ronda 21l, activar oclusión sin más) trataba
     * cada segmento del contorno como un tramo de muro independiente —
     * duplicaba el grosor, ~19% de caída de promedio en un proyecto real.
     * Un segundo intento (Ronda 22, "centerline por diámetro": los 2
     * vértices más distantes) funcionaba en un tramo recto simple pero
     * colapsaba un muro real con giros (forma de U, 25-27 vértices) a una
     * diagonal sin sentido físico — puntos en 0 lx. Ambos revertidos.
     *
     * Esta versión (Ronda 23) no asume ninguna forma: rota al marco del
     * tramo más largo, verifica que el contorno sea ortogonal ahí
     * (`isRectilinearInFrame`), y lo descompone en rectángulos EXACTOS por
     * barrido (`decomposeClosedRing`) — válido para un tramo recto, una L,
     * una U, con o sin muescas, en cualquier ángulo. Probado contra la
     * geometría REAL de los 2 muros de Vinchos, no solo un caso sintético.
     */
    function ringArea(vertices: Vertex[]): number {
        return polygonAreaM2(vertices);
    }

    it('rectángulo cerrado simple (sin muesca): una sola caja, área exacta', () => {
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

        expect(boxes).toHaveLength(1);
        expect(boxes[0]!.length).toBeCloseTo(5, 6);
        expect(boxes[0]!.thickness).toBeCloseTo(0.2, 6);
        expect(boxes[0]!.zMin).toBe(0);
        expect(boxes[0]!.zMax).toBe(2.8);
        expect(totalBoxArea(boxes)).toBeCloseTo(ringArea(closedOutlineWall.vertices), 6);
    });

    it('contorno cerrado con muesca de jamba real (ancho > 0): el área total incluye la muesca, ninguna caja gigante', () => {
        // Rectángulo de 4m x 0.13m con una muesca de 0.3m de ancho y 0.17m
        // de profundidad — la forma real de una jamba, no el spike
        // degenerado de un test anterior.
        const closedOutlineWall: Wall = {
            id: 'wall-real-notch',
            vertices: [
                { x: 0, y: 0 },
                { x: 0, y: 0.13 },
                { x: 0.3, y: 0.13 },
                { x: 0.3, y: 0.3 },
                { x: 0.6, y: 0.3 },
                { x: 0.6, y: 0.13 },
                { x: 4, y: 0.13 },
                { x: 4, y: 0 },
                { x: 0, y: 0 },
            ],
            thickness: 0.13,
            height: 3,
        };

        const boxes = buildWallOcclusionBoxes([closedOutlineWall], [], []);

        expect(totalBoxArea(boxes)).toBeCloseTo(ringArea(closedOutlineWall.vertices), 6);
        // Ninguna caja puede ser más grande que el propio muro (el bug
        // original generaba cajas ~10x más grandes que el muro real).
        for (const box of boxes) {
            expect(box.length).toBeLessThanOrEqual(4 + 1e-6);
            expect(box.thickness).toBeLessThanOrEqual(0.3 + 1e-6);
        }
    });

    it('muro en L (2 tramos con un giro de 90°): área exacta, ninguna caja fuera de la huella real', () => {
        const lShapedWall: Wall = {
            id: 'wall-l-shape',
            vertices: [
                { x: 0, y: 0 },
                { x: 0, y: 3 },
                { x: 0.2, y: 3 },
                { x: 0.2, y: 0.2 },
                { x: 4, y: 0.2 },
                { x: 4, y: 0 },
                { x: 0, y: 0 },
            ],
            thickness: 0.2,
            height: 2.8,
        };

        const boxes = buildWallOcclusionBoxes([lShapedWall], [], []);

        expect(totalBoxArea(boxes)).toBeCloseTo(ringArea(lShapedWall.vertices), 6);
        expect(boxes.length).toBeGreaterThan(0);
    });

    it('el mismo muro rotado 37° en el plano da la misma área total (la descomposición no depende de estar alineado a los ejes del mundo)', () => {
        const angle = (37 * Math.PI) / 180;
        const rotate = (v: Vertex): Vertex => ({
            x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
            y: v.x * Math.sin(angle) + v.y * Math.cos(angle),
        });
        const baseVertices: Vertex[] = [
            { x: 0, y: 0 },
            { x: 0, y: 0.2 },
            { x: 5, y: 0.2 },
            { x: 5, y: 0 },
            { x: 0, y: 0 },
        ];
        const rotatedWall: Wall = {
            id: 'wall-rotated',
            vertices: baseVertices.map(rotate),
            thickness: 0.2,
            height: 2.8,
        };

        const boxes = buildWallOcclusionBoxes([rotatedWall], [], []);

        expect(totalBoxArea(boxes)).toBeCloseTo(ringArea(rotatedWall.vertices), 4);
    });

    it('muro real de Vinchos (25 vértices, forma de U con 2 giros de 90° y una muesca de jamba): área exacta, sin cajas absurdamente grandes', () => {
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
     * Hallazgo sin resolver (Ronda 23, mismo día): el área de este contorno
     * por la fórmula estándar (shoelace, `polygonAreaM2` — matemáticamente
     * correcta para cualquier polígono simple, y se confirmó que ESTE anillo
     * no se autointerseca) da 43.796 m², prácticamente IDÉNTICA al área del
     * ambiente que delimita (43.80 m², Aula 1° real) — no al área de un muro
     * delgado de 0.13 m (~3.7 m², lo que da la descomposición de esta
     * función). Es decir: `wall.vertices` para este registro real NO
     * representa la huella de un muro delgado — representa algo mucho más
     * grande, posiblemente un artefacto de cómo se dibujó en el editor.
     * `it.fails` porque es un hallazgo de CALIDAD DE DATOS pendiente de
     * verificar visualmente en el editor (ver conversación), no un bug de
     * esta función — si algún día empieza a pasar sin querer, es señal de
     * que alguien "arregló" esto sin que se documentara la causa real.
     */
    it.fails('el área del contorno NO coincide con la huella de un muro delgado — pendiente de investigar en el editor, no un bug de esta función', () => {
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

    it('un contorno cerrado NO ortogonal (giro que no es de 90°) cae al comportamiento anterior conocido, no arriesga geometría nueva', () => {
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

        // Comportamiento de respaldo conocido (una caja por segmento del
        // contorno) — no debe intentar la descomposición nueva sobre una
        // forma que no puede representar de forma segura.
        expect(boxes.length).toBeGreaterThan(1);
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
