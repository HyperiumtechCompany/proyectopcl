import { describe, expect, it } from 'vitest';
import type { Conductor } from './types';
import { connectedCircuitConductorIds } from './conductorCircuitGroups';

const wire = (
    id: string,
    sourceId: string,
    targetId: string,
): Conductor => ({
    id,
    sourceId,
    targetId,
    wireCount: 3,
    routeType: 'wall_ceiling',
    tubeSize: 20,
    conductorType: 'THW-90',
    sectionMm2: 2.5,
    waypoints: [],
});

describe('connectedCircuitConductorIds', () => {
    it('agrupa la salida completa sin atravesar el tablero', () => {
        const conductors = [
            wire('c1-1', 'td-1', 'luz-1'),
            wire('c1-2', 'luz-1', 'luz-2'),
            wire('c1-3', 'luz-2', 'emergencia-1'),
            wire('c1-4', 'emergencia-1', 'interruptor-1'),
            wire('c2-1', 'td-1', 'luz-otra'),
        ];

        expect(
            connectedCircuitConductorIds(
                conductors,
                'c1-2',
                new Set(['td-1']),
            ),
        ).toEqual(['c1-1', 'c1-2', 'c1-3', 'c1-4']);
    });

    it('respeta un grupo persistido cuando ya existe', () => {
        const conductors = [
            { ...wire('a', 'td-1', 'luz-1'), circuitGroupId: 'circuito-a' },
            { ...wire('b', 'luz-1', 'luz-2'), circuitGroupId: 'circuito-a' },
            wire('c', 'luz-2', 'interruptor-1'),
        ];

        expect(
            connectedCircuitConductorIds(conductors, 'a', new Set(['td-1'])),
        ).toEqual(['a', 'b']);
    });
});
