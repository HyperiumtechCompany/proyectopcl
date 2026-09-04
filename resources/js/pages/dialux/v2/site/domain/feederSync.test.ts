import { describe, expect, it } from 'vitest';
import type { EdgeCalculation } from '../../electrical-network/domain/calculations';
import type { ElectricalEdge } from '../../electrical-network/domain/types';
import {
    buildFeederPathFromNetwork,
    deriveFeederStatus,
    feederStatusColor,
    syncFeederLengths,
} from './feederSync';
import type { FeederPath } from './types';

function makeEdge(overrides: Partial<ElectricalEdge> = {}): ElectricalEdge {
    return {
        id: 'edge-1',
        sourceNodeId: 'tg',
        targetNodeId: 'td-1',
        lengthMode: 'manual',
        horizontalLengthM: 50,
        verticalLengthM: 2,
        conductorType: 'N2XOH',
        conductorMaterial: 'copper',
        sectionMm2: 10,
        wireConfiguration: '3F+N+T',
        ...overrides,
    };
}

function makePath(overrides: Partial<FeederPath> = {}): FeederPath {
    return {
        id: 'path-1',
        networkEdgeId: 'edge-1',
        waypoints: [
            { x: 0, y: 0 },
            { x: 30, y: 40 },
        ],
        calculatedLengthM: 50,
        ...overrides,
    };
}

describe('syncFeederLengths', () => {
    it('deja intactos los edges sin trazado asociado', () => {
        const edges = [makeEdge()];
        expect(syncFeederLengths(edges, [])).toBe(edges);
    });

    it('fuerza lengthMode a "site" y toma la longitud de la polilínea cuando hay un trazado vinculado', () => {
        const edges = [
            makeEdge({ lengthMode: 'plan', horizontalLengthM: 999 }),
        ];
        const [result] = syncFeederLengths(edges, [makePath()]);
        expect(result.lengthMode).toBe('site');
        expect(result.horizontalLengthM).toBeCloseTo(50);
    });

    it('no crea un objeto nuevo si el edge ya está sincronizado (referencia estable)', () => {
        const edges = [makeEdge({ lengthMode: 'site', horizontalLengthM: 50 })];
        const result = syncFeederLengths(edges, [makePath()]);
        expect(result[0]).toBe(edges[0]);
    });

    it('recalcula calculatedLengthM=0 a partir de los waypoints si no viene precalculado', () => {
        const edges = [makeEdge()];
        const path = makePath({ calculatedLengthM: 0 });
        const [result] = syncFeederLengths(edges, [path]);
        expect(result.horizontalLengthM).toBeCloseTo(50);
    });
});

describe('deriveFeederStatus / feederStatusColor', () => {
    const calculations: EdgeCalculation[] = [
        {
            edgeId: 'edge-1',
            lengthM: 50,
            installedPowerW: 0,
            demandPowerW: 0,
            currentA: 0,
            designCurrentA: 0,
            breakerA: 0,
            ownVoltageDropV: 0,
            ownVoltageDropPercent: 0,
            accumulatedVoltageDropPercent: 0,
            accumulatedVoltageDropV: 0,
            status: 'warning',
            warnings: [],
        },
    ];

    it('devuelve el status real del edge calculado', () => {
        expect(deriveFeederStatus('edge-1', calculations)).toBe('warning');
    });

    it('devuelve "incomplete" si el edge todavía no tiene cálculo', () => {
        expect(deriveFeederStatus('edge-2', calculations)).toBe('incomplete');
    });

    it('mapea cada status a un color distinto', () => {
        expect(feederStatusColor('complete')).not.toBe(
            feederStatusColor('warning'),
        );
        expect(feederStatusColor('non_compliant')).not.toBe(
            feederStatusColor('incomplete'),
        );
    });
});

describe('buildFeederPathFromNetwork', () => {
    it('genera dos waypoints y calcula la longitud de esa línea recta', () => {
        const skeleton = buildFeederPathFromNetwork(
            { id: 'edge-1', label: 'TG → TD-01' },
            { x: 0, y: 0 },
            { x: 30, y: 40 },
        );
        expect(skeleton.networkEdgeId).toBe('edge-1');
        expect(skeleton.waypoints).toHaveLength(2);
        expect(skeleton.calculatedLengthM).toBeCloseTo(50);
    });
});
