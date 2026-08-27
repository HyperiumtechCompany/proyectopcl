import { describe, expect, it } from 'vitest';
import { calculateElectricalNetwork } from './calculations';
import type { ElectricalNetworkData, ModuleElectricalPort } from './types';

function buildNetwork(): ElectricalNetworkData {
    return {
        schemaVersion: 1,
        rootNodeId: 'service',
        settings: {
            // Sistema general: 380V trifásico (típico TG de un proyecto).
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
            { id: 'service', type: 'service', label: 'Suministro', position: { x: 0, y: 0 } },
            { id: 'meter', type: 'meter', label: 'Medidor', position: { x: 0, y: 0 } },
            { id: 'tg', type: 'main_panel', label: 'TG', position: { x: 0, y: 0 } },
            {
                id: 'td',
                type: 'module_panel_port',
                label: 'TD',
                moduleId: 1,
                sceneId: 'scene-1',
                deviceId: 'panel-td',
                position: { x: 0, y: 0 },
            },
        ],
        edges: [
            {
                id: 'e1',
                sourceNodeId: 'service',
                targetNodeId: 'meter',
                lengthMode: 'manual',
                horizontalLengthM: 10,
                verticalLengthM: 0,
                conductorType: 'THW-90',
                conductorMaterial: 'copper',
                sectionMm2: 25,
                wireConfiguration: '3F+N+T',
                powerFactor: 0.9,
            },
            {
                id: 'e2',
                sourceNodeId: 'meter',
                targetNodeId: 'tg',
                lengthMode: 'manual',
                horizontalLengthM: 5,
                verticalLengthM: 0,
                conductorType: 'THW-90',
                conductorMaterial: 'copper',
                sectionMm2: 25,
                wireConfiguration: '3F+N+T',
                powerFactor: 0.9,
            },
            {
                id: 'e3',
                sourceNodeId: 'tg',
                targetNodeId: 'td',
                lengthMode: 'manual',
                // Tramo largo con sección chica: a propósito, para que la
                // caída propia sea significativa y se note la diferencia de
                // base de voltaje en el % acumulado.
                horizontalLengthM: 200,
                verticalLengthM: 0,
                conductorType: 'THW-90',
                conductorMaterial: 'copper',
                sectionMm2: 4,
                wireConfiguration: '1F+N+T',
                powerFactor: 0.9,
            },
        ],
    };
}

function buildPorts(): ModuleElectricalPort[] {
    return [
        {
            key: '1:scene-1:panel-td',
            moduleId: 1,
            moduleName: 'Módulo 1',
            sceneId: 'scene-1',
            sceneName: 'Piso 1',
            panelId: 'panel-td',
            panelLabel: 'TD',
            panelRole: 'distribution',
            // El tablero TD real es monofásico 220V, colgado del sistema
            // trifásico 380V del TG — exactamente el caso que corrompía el
            // % acumulado antes del fix.
            nominalVoltageV: 220,
            phases: 1,
            installedPowerW: 2670,
            demandPowerW: 2670,
            currentA: 0,
            mainBreakerA: 0,
            circuitsCount: 1,
            revision: '1',
        },
    ];
}

describe('calculateElectricalNetwork — base de voltaje por tablero destino', () => {
    it('usa el voltaje real del tablero destino (220V) para el % acumulado, no el del sistema general (380V)', () => {
        const results = calculateElectricalNetwork(
            buildNetwork(),
            buildPorts(),
            [],
        );
        const tdEdge = results.find((item) => item.edgeId === 'e3')!;
        expect(tdEdge).toBeDefined();

        // Verificación cruzada: el % acumulado reportado debe coincidir con
        // recalcular manualmente accumulatedVoltageDropV / 220V (voltaje
        // real de TD), NUNCA / 380V (voltaje del sistema general).
        const expectedPercentAt220 =
            (tdEdge.accumulatedVoltageDropV / 220) * 100;
        const percentIfUsing380BySystemVoltage =
            (tdEdge.accumulatedVoltageDropV / 380) * 100;

        expect(tdEdge.accumulatedVoltageDropPercent).toBeCloseTo(
            expectedPercentAt220,
            6,
        );
        expect(tdEdge.accumulatedVoltageDropPercent).not.toBeCloseTo(
            percentIfUsing380BySystemVoltage,
            2,
        );
    });

    it('un tablero sin puerto propio (TG) sigue usando el voltaje general del sistema', () => {
        const results = calculateElectricalNetwork(
            buildNetwork(),
            buildPorts(),
            [],
        );
        const tgEdge = results.find((item) => item.edgeId === 'e2')!;
        expect(tgEdge).toBeDefined();
        const expectedPercentAt380 =
            (tgEdge.accumulatedVoltageDropV / 380) * 100;
        expect(tgEdge.accumulatedVoltageDropPercent).toBeCloseTo(
            expectedPercentAt380,
            6,
        );
    });
});
