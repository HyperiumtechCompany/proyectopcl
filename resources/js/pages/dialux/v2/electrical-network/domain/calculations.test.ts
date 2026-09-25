import { describe, expect, it } from 'vitest';
import {
    calculateElectricalNetwork,
    suggestedSimultaneityFactor,
} from './calculations';
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

describe('calculateElectricalNetwork — simultaneidad por tablero (R1)', () => {
    /** TG con 3 módulos de 10 kW cada uno (1Φ 220 V, a 50 m del TG). */
    function threeModules(fs?: number) {
        const base = buildNetwork();
        const network: ElectricalNetworkData = {
            ...base,
            nodes: [
                ...base.nodes.filter((node) => node.id !== 'td'),
                ...[1, 2, 3].map((i) => ({
                    id: `m${i}`,
                    type: 'module_panel_port' as const,
                    label: `TD-${i}`,
                    moduleId: i,
                    sceneId: 'scene-1',
                    deviceId: 'panel-td',
                    position: { x: 0, y: 0 },
                })),
            ].map((node) =>
                node.id === 'tg' && fs !== undefined
                    ? { ...node, simultaneityFactor: fs }
                    : node,
            ),
            edges: [
                ...base.edges.filter((edge) => edge.id !== 'e3'),
                ...[1, 2, 3].map((i) => ({
                    ...base.edges[2],
                    id: `f${i}`,
                    targetNodeId: `m${i}`,
                    horizontalLengthM: 50,
                    sectionMm2: 16,
                })),
            ],
        };
        const ports: ModuleElectricalPort[] = [1, 2, 3].map((i) => ({
            ...buildPorts()[0],
            key: `${i}:scene-1:panel-td`,
            moduleId: i,
            installedPowerW: 10000,
            demandPowerW: 10000,
        }));
        return calculateElectricalNetwork(network, ports, []);
    }

    it('sin factor el TG suma simple (resultado anterior intacto)', () => {
        const tgFeeder = threeModules().find((item) => item.edgeId === 'e2')!;
        expect(tgFeeder.demandPowerW).toBe(30000);
        expect(tgFeeder.outgoingDemandPowerW).toBe(30000);
        expect(tgFeeder.simultaneityFactor).toBe(1);
    });

    it('fs 0,9 en el TG: 27 kW, y corriente/ΔU del alimentador y aguas arriba proporcionales (caso a mano)', () => {
        const plain = threeModules();
        const reduced = threeModules(0.9);
        const tgPlain = plain.find((item) => item.edgeId === 'e2')!;
        const tgReduced = reduced.find((item) => item.edgeId === 'e2')!;
        expect(tgReduced.demandPowerW).toBeCloseTo(27000, 9);
        expect(tgReduced.installedPowerW).toBe(30000);
        // I = P / (√3 · 380 · 0,9) = 27000 / 592,34 ≈ 45,58 A
        expect(tgReduced.currentA).toBeCloseTo(27000 / (Math.sqrt(3) * 380 * 0.9), 6);
        expect(tgReduced.ownVoltageDropPercent).toBeCloseTo(
            tgPlain.ownVoltageDropPercent * 0.9,
            9,
        );
        // El suministro (aguas arriba) también ve la demanda reducida.
        const servicePlain = plain.find((item) => item.edgeId === 'e1')!;
        const serviceReduced = reduced.find((item) => item.edgeId === 'e1')!;
        expect(serviceReduced.demandPowerW).toBeCloseTo(servicePlain.demandPowerW * 0.9, 9);
        // Cada módulo conserva su propia demanda (el fs es del TG, no de sus hijos).
        expect(reduced.find((item) => item.edgeId === 'f1')!.demandPowerW).toBe(10000);
    });

    it('el factor se aplica también a las salidas de la planta (extraLoads) del TG', () => {
        const base = buildNetwork();
        const network: ElectricalNetworkData = {
            ...base,
            nodes: base.nodes.map((node) =>
                node.id === 'tg' ? { ...node, simultaneityFactor: 0.8 } : node,
            ),
            edges: base.edges.filter((edge) => edge.id !== 'e3'),
        };
        const results = calculateElectricalNetwork(
            network,
            [],
            [],
            new Map([['tg', { installed: 5000, demand: 5000 }]]),
        );
        expect(results.find((item) => item.edgeId === 'e2')!.demandPowerW).toBeCloseTo(4000, 9);
    });

    it('un factor fuera de rango (0, >1) se ignora', () => {
        expect(threeModules(0).find((item) => item.edgeId === 'e2')!.demandPowerW).toBe(30000);
        expect(threeModules(1.5).find((item) => item.edgeId === 'e2')!.demandPowerW).toBe(30000);
    });

    it('sugerencia de referencia IEC 61439-1 por número de salidas', () => {
        expect([1, 2, 3, 4, 5, 6, 9, 10, 15].map(suggestedSimultaneityFactor)).toEqual([
            1, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7, 0.6, 0.6,
        ]);
    });
});
