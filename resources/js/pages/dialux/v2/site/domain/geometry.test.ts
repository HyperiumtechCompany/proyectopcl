import { describe, expect, it } from 'vitest';
import {
    boundingBox,
    closestPointOnPolygon,
    outwardMiterDirections,
    pointInPolygon,
    polygonArea,
    polygonPerimeter,
    polylineLength,
    snapToGrid,
} from './geometry';

describe('site/domain/geometry', () => {
    it('calcula área y perímetro de un rectángulo de 10x5 m', () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 5 },
            { x: 0, y: 5 },
        ];
        expect(polygonArea(square)).toBeCloseTo(50, 6);
        expect(polygonPerimeter(square)).toBeCloseTo(30, 6);
    });

    it('detecta puntos dentro y fuera del polígono', () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
        expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    });

    it('suma la longitud de una polilínea abierta (no la cierra como un anillo)', () => {
        const path = [
            { x: 0, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 4 },
        ];
        expect(polylineLength(path)).toBeCloseTo(7, 6);
    });

    it('polylineLength de un solo punto es 0', () => {
        expect(polylineLength([{ x: 5, y: 5 }])).toBe(0);
    });

    it('calcula la caja envolvente de un conjunto de vértices', () => {
        const vertices = [
            { x: -2, y: 3 },
            { x: 8, y: -1 },
            { x: 4, y: 6 },
        ];
        expect(boundingBox(vertices)).toMatchObject({
            minX: -2,
            minY: -1,
            maxX: 8,
            maxY: 6,
        });
    });

    it('ajusta un punto a la cuadrícula más cercana', () => {
        expect(snapToGrid({ x: 12, y: 27 }, 10)).toEqual({ x: 10, y: 30 });
        expect(snapToGrid({ x: 12, y: 27 }, 0)).toEqual({ x: 12, y: 27 });
    });

    it('encuentra el punto más cercano sobre el lado correcto de un cerco en L', () => {
        // Cerco en L: (0,0)→(10,0)→(10,1)→(0,1) cerrado.
        const fence = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 1 },
            { x: 0, y: 1 },
        ];
        const onBottomEdge = closestPointOnPolygon({ x: 4, y: -3 }, fence);
        expect(onBottomEdge?.point).toEqual({ x: 4, y: 0 });
        expect(onBottomEdge?.tangent).toEqual({ x: 10, y: 0 });

        const onRightEdge = closestPointOnPolygon({ x: 13, y: 0.5 }, fence);
        expect(onRightEdge?.point).toEqual({ x: 10, y: 0.5 });
    });

    it('incluye el lado que cierra el polígono (del último vértice al primero)', () => {
        const triangle = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
        ];
        // El lado de cierre va de (0,10) a (0,0) — un punto cercano a x=-1,y=5
        // debe caer sobre ese lado, no sobre ninguno de los otros dos.
        const closing = closestPointOnPolygon({ x: -1, y: 5 }, triangle);
        expect(closing?.point).toEqual({ x: 0, y: 5 });
    });

    it('un trazado abierto no considera el lado que "cierra" del último al primer punto', () => {
        const path = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ];
        // (2, 6) está más cerca del lado de cierre (10,10)→(0,0) que de los reales.
        const closed = closestPointOnPolygon({ x: 2, y: 6 }, path, true);
        const open = closestPointOnPolygon({ x: 2, y: 6 }, path, false);
        expect(closed?.point.x).toBeCloseTo(4, 6);
        expect(open?.point).toEqual({ x: 2, y: 0 });
    });

    it('informa el lado, la posición sobre él y la distancia (para abrir un vano de portón)', () => {
        const path = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ];
        const hit = closestPointOnPolygon({ x: 4, y: -3 }, path, false);
        expect(hit?.edgeIndex).toBe(0);
        expect(hit?.t).toBeCloseTo(0.4, 6);
        expect(hit?.distance).toBeCloseTo(3, 6);
        const second = closestPointOnPolygon({ x: 13, y: 5 }, path, false);
        expect(second?.edgeIndex).toBe(1);
        expect(second?.t).toBeCloseTo(0.5, 6);
    });

    it('desplaza las esquinas de un cuadrado en diagonal (inglete de 90°), sin importar el sentido de giro', () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        const dirs = outwardMiterDirections(square);
        // Inglete de una esquina de 90°: factor 1/cos(45°) = √2 — cada
        // esquina se mueve en diagonal, no solo perpendicular a un lado.
        for (const dir of dirs) {
            expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(Math.SQRT2, 6);
        }
        // La esquina (0,0) se aleja del cuadrado hacia (-1,-1); offset con
        // spread=1 debe caer fuera del cuadrado original.
        const offsetCorner = {
            x: square[0].x + dirs[0].x,
            y: square[0].y + dirs[0].y,
        };
        expect(pointInPolygon(offsetCorner, square)).toBe(false);

        // Mismo resultado con el polígono en sentido contrario (CW en vez de CCW).
        const reversed = [...square].reverse();
        const dirsReversed = outwardMiterDirections(reversed);
        for (const dir of dirsReversed) {
            expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(Math.SQRT2, 6);
        }
    });

    it('en una huella cóncava (en L), el vértice reflejo no cruza hacia el resto del polígono', () => {
        // L: un cuadrado de 10x10 con un mordisco de 5x5 en la esquina superior derecha.
        const lShape = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 5 },
            { x: 5, y: 5 },
            { x: 5, y: 10 },
            { x: 0, y: 10 },
        ];
        const dirs = outwardMiterDirections(lShape);
        // El vértice reflejo (5,5) — todas las direcciones deben ser finitas
        // y quedar acotadas por el límite de inglete (nunca un pico absurdo).
        for (const dir of dirs) {
            expect(Number.isFinite(dir.x)).toBe(true);
            expect(Number.isFinite(dir.y)).toBe(true);
            expect(Math.hypot(dir.x, dir.y)).toBeLessThanOrEqual(4 + 1e-6);
        }
        // El vértice reflejo debe moverse HACIA el mordisco (x,y crecientes),
        // no hacia afuera del cuadrado grande como haría un offset ingenuo
        // "desde el centroide" (que lo empujaría hacia (0,0)).
        const reflexDir = dirs[3];
        expect(reflexDir.x).toBeGreaterThan(0);
        expect(reflexDir.y).toBeGreaterThan(0);
    });
});
