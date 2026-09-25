import { describe, expect, it } from 'vitest';
import type { EdgeCalculation } from './calculations';
import { sizeSupplies, suggestTransformerKva } from './supplySizing';
import type { ElectricalNetworkData } from './types';

function network(
    service: Partial<ElectricalNetworkData['nodes'][number]> = {},
): ElectricalNetworkData {
    return {
        schemaVersion: 1,
        rootNodeId: 'service',
        settings: {
            nominalVoltageV: 380,
            phases: 3,
            connectionType: 'star',
            frequencyHz: 60,
            conductorMaterial: 'copper',
            workingTemperatureC: 40,
            defaultPowerFactor: 0.9,
            feederDropLimitPercent: 2.5,
            totalDropLimitPercent: 4,
        },
        nodes: [
            { id: 'service', type: 'service', label: 'Suministro', position: { x: 0, y: 0 }, ...service },
            { id: 'tg', type: 'main_panel', label: 'TG', position: { x: 0, y: 0 } },
        ],
        edges: [
            {
                id: 'e1',
                sourceNodeId: 'service',
                targetNodeId: 'tg',
                lengthMode: 'manual',
                horizontalLengthM: 10,
                verticalLengthM: 0,
                conductorType: 'THW-90',
                conductorMaterial: 'copper',
                sectionMm2: 35,
                wireConfiguration: '3F+N+T',
                powerFactor: 0.9,
            },
        ],
    };
}

const calc = (demandPowerW: number): EdgeCalculation[] => [
    { edgeId: 'e1', demandPowerW } as EdgeCalculation,
];

describe('sizeSupplies (R2: transformador / acometida)', () => {
    it('caso a mano: 90 kW, cos φ 0,9, reserva 25 % → 100 kVA × 1,25 = 125 kVA', () => {
        const [supply] = sizeSupplies(network(), calc(90000));
        expect(supply.demandKva).toBeCloseTo(100, 9);
        expect(supply.requiredKva).toBeCloseTo(125, 9);
        expect(supply.suggestedKva).toBe(125);
        expect(supply.loadingPercent).toBeCloseTo(80, 9);
        // In = 125 000 / (√3 · 380) ≈ 189,9 A
        expect(supply.ratedCurrentA).toBeCloseTo(125000 / (Math.sqrt(3) * 380), 6);
        expect(supply.status).toBe('ok');
    });

    it('con potencia fijada por el usuario reporta su % de carga y la sobrecarga', () => {
        const [fits] = sizeSupplies(network({ transformerKva: 160 }), calc(90000));
        expect(fits.loadingPercent).toBeCloseTo(62.5, 9);
        expect(fits.status).toBe('ok');
        const [over] = sizeSupplies(network({ transformerKva: 75 }), calc(90000));
        expect(over.status).toBe('overloaded');
        expect(over.loadingPercent).toBeGreaterThan(100);
    });

    it('la reserva y la simultaneidad de la raíz son editables', () => {
        const [supply] = sizeSupplies(
            network({ supplyReservePercent: 0, simultaneityFactor: 0.8 }),
            calc(90000),
        );
        expect(supply.demandKva).toBeCloseTo(80, 9);
        expect(supply.suggestedKva).toBe(100);
    });

    it('sin carga no sugiere nada', () => {
        const [supply] = sizeSupplies(network(), calc(0));
        expect(supply.status).toBe('no_load');
        expect(supply.suggestedKva).toBeUndefined();
    });

    it('serie normalizada: toma la menor potencia ≥ requerida', () => {
        expect(suggestTransformerKva(30)).toBe(37.5);
        expect(suggestTransformerKva(160)).toBe(160);
        expect(suggestTransformerKva(3000)).toBeUndefined();
    });
});
