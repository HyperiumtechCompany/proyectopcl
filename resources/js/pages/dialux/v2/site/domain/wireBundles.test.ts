import { describe, expect, it } from 'vitest';
import { offsetPolyline, offsetSegment, wireBundleLanes } from './wireBundles';

describe('cables en paralelo por la misma zanja', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    const c = { x: 10, y: 10 };

    it('dos cables por el mismo tramo quedan en carriles opuestos (no uno encima del otro)', () => {
        // El segundo dibujado al revés: igual comparte el tramo.
        const lanes = wireBundleLanes([
            { id: 'verde', points: [a, b, c] },
            { id: 'naranja', points: [b, a] },
        ]);
        const green = lanes.get('verde')!;
        const orange = lanes.get('naranja')!;
        expect(green[0].lane).toBe(-0.5);
        expect(orange[0].lane).toBe(0.5);
        // Tramo propio (b→c) sin compartir: al centro.
        expect(green[1].lane).toBe(0);
        const [ga] = offsetSegment(a, b, green[0], 1);
        const [ob] = offsetSegment(b, a, orange[0], 1);
        // Mismo tramo, lados opuestos: separados exactamente 1 carril.
        expect(Math.abs(ga.y - ob.y)).toBeCloseTo(1, 9);
    });

    it('un cable solo no se mueve; la polilínea desplazada es continua', () => {
        const alone = wireBundleLanes([{ id: 'x', points: [a, b, c] }]).get('x');
        expect(offsetPolyline([a, b, c], alone, 1)).toEqual([a, b, c]);
        const lanes = wireBundleLanes([
            { id: 'p', points: [a, b, c] },
            { id: 'q', points: [a, b, c] },
        ]);
        const shifted = offsetPolyline([a, b, c], lanes.get('p'), 1);
        expect(shifted).toHaveLength(3);
        expect(shifted[0].y).toBeCloseTo(-0.5, 9);
    });
});

describe('salidas del TG hacia la misma caja (caso del usuario)', () => {
    // Tres salidas: cada una arranca en SU borne (a 0,2 m una de otra) y llega a la misma caja.
    const box = { x: 20, y: 10 };
    const wires = [0, 1, 2].map((i) => ({
        id: `salida-${i + 1}`,
        points: [{ x: 0, y: i * 0.2 }, box],
        startId: 'tg',
        endId: 'caja',
    }));

    it('forman UN haz (antes, por coordenadas, nunca coincidían y se dibujaban encima)', () => {
        const lanes = wireBundleLanes(wires);
        expect(wires.map((wire) => lanes.get(wire.id)![0].lane).sort()).toEqual([-1, 0, 1]);
        // Sin identificar los objetos, cada borne distinto → tramos distintos → sin carriles.
        const byCoords = wireBundleLanes(wires.map(({ id, points }) => ({ id, points })));
        expect(wires.every((wire) => byCoords.get(wire.id)![0].lane === 0)).toBe(true);
    });

    it('el orden de los carriles sigue el de los bornes (no se cruzan) y el borne no se mueve', () => {
        const lanes = wireBundleLanes([...wires].reverse());
        const at = (id: string) => {
            const wire = wires.find((item) => item.id === id)!;
            return offsetSegment(wire.points[0], wire.points[1], lanes.get(id)![0], 1, { start: true });
        };
        // Borne intacto.
        expect(at('salida-2')[0]).toEqual({ x: 0, y: 0.2 });
        // En la caja, el orden a lo ancho es el mismo que en el TG.
        const endY = ['salida-1', 'salida-2', 'salida-3'].map((id) => at(id)[1].y);
        expect(endY[0]).toBeLessThan(endY[1]);
        expect(endY[1]).toBeLessThan(endY[2]);
    });
});
