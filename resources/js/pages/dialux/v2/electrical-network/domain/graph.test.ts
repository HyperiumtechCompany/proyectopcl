import { describe, expect, it } from 'vitest';
import { calculateElectricalNetwork } from './calculations';
import { validateElectricalNetwork } from './graph';
import type { ElectricalNetworkData, ModuleElectricalPort } from './types';

const network = (): ElectricalNetworkData => ({
    schemaVersion: 1,
    rootNodeId: 'source',
    settings: {
        nominalVoltageV: 380,
        phases: 3,
        connectionType: 'star',
        frequencyHz: 60,
        conductorMaterial: 'copper',
        workingTemperatureC: 20,
        defaultPowerFactor: 0.9,
        feederDropLimitPercent: 2.5,
        totalDropLimitPercent: 4,
    },
    nodes: [
        {
            id: 'source',
            type: 'service',
            label: 'Suministro',
            position: { x: 0, y: 0 },
        },
        {
            id: 'tg',
            type: 'main_panel',
            label: 'TG',
            position: { x: 200, y: 0 },
        },
        {
            id: 'td',
            type: 'module_panel_port',
            label: 'TD-1',
            moduleId: 1,
            sceneId: 'floor',
            deviceId: 'panel',
            position: { x: 400, y: 0 },
        },
    ],
    edges: [
        {
            id: 'a',
            sourceNodeId: 'source',
            targetNodeId: 'tg',
            lengthMode: 'manual',
            horizontalLengthM: 10,
            verticalLengthM: 0,
            conductorType: 'N2XOH',
            conductorMaterial: 'copper',
            sectionMm2: 16,
            wireConfiguration: '3F+N+T',
            powerFactor: 0.9,
        },
        {
            id: 'b',
            sourceNodeId: 'tg',
            targetNodeId: 'td',
            lengthMode: 'manual',
            horizontalLengthM: 20,
            verticalLengthM: 5,
            conductorType: 'N2XOH',
            conductorMaterial: 'copper',
            sectionMm2: 10,
            wireConfiguration: '3F+N+T',
            powerFactor: 0.9,
        },
    ],
});

describe('electrical network domain', () => {
    it('validates a radial network and detects cycles', () => {
        expect(validateElectricalNetwork(network())).toEqual([]);
        const cyclic = network();
        cyclic.edges.push({
            ...cyclic.edges[0],
            id: 'cycle',
            sourceNodeId: 'td',
            targetNodeId: 'tg',
        });
        expect(
            validateElectricalNetwork(cyclic).map((issue) => issue.code),
        ).toContain('cycle');
    });

    it('propagates voltage drop from the root', () => {
        const ports: ModuleElectricalPort[] = [
            {
                key: '1:floor:panel',
                moduleId: 1,
                moduleName: 'Piso 1',
                sceneId: 'floor',
                sceneName: 'Nivel',
                panelId: 'panel',
                panelLabel: 'TD-1',
                panelRole: 'distribution',
                nominalVoltageV: 380,
                phases: 3,
                installedPowerW: 12000,
                demandPowerW: 10000,
                circuitsCount: 4,
                revision: '1',
                currentA: 0,
                mainBreakerA: 0,
            },
        ];
        const results = calculateElectricalNetwork(network(), ports, [
            {
                id: 1,
                user_id: null,
                material: 'cobre',
                section_mm2: 10,
                insulation: 'N2XOH',
                ampacity_a: 60,
            },
            {
                id: 2,
                user_id: null,
                material: 'cobre',
                section_mm2: 16,
                insulation: 'N2XOH',
                ampacity_a: 85,
            },
        ]);
        expect(results).toHaveLength(2);
        expect(results[1].accumulatedVoltageDropPercent).toBeGreaterThan(
            results[1].ownVoltageDropPercent,
        );
        expect(results[1].currentA).toBeGreaterThan(0);
        expect(results[1].ampacityA).toBe(60);
        expect(results[1].breakerA).toBeGreaterThanOrEqual(
            results[1].designCurrentA,
        );
    });
});
