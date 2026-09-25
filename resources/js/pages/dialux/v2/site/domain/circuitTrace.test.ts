import { describe, expect, it } from 'vitest';
import { compactCircuitTrace } from './circuitTrace';

describe('compactCircuitTrace', () => {
    it('conserva un recorrido que pasa por varios objetos', () => {
        const trace = compactCircuitTrace(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 20, y: 5 },
            ],
            ['aerial', 'underground'],
        );

        expect(trace.waypoints).toHaveLength(3);
        expect(trace.modes).toEqual(['aerial', 'underground']);
    });

    it('elimina el punto duplicado producido al cerrar con doble clic', () => {
        const trace = compactCircuitTrace(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 0 },
            ],
            ['aerial', 'aerial'],
        );

        expect(trace.waypoints).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ]);
        expect(trace.modes).toEqual(['aerial']);
    });
});
