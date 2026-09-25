import { describe, expect, it } from 'vitest';
import { calculateElectricalNetwork } from './calculations';
import { calculateShortCircuits } from './shortCircuit';
import { buildSingleLineDiagram, SLD_COLUMN_MM } from './singleLineDiagram';
import { edgePath, renderSingleLineDxf, renderSingleLineSvg } from './singleLineRender';
import type { ElectricalEdge, ElectricalNetworkData, ModuleElectricalPort } from './types';

const edge = (id: string, source: string, target: string, lengthM: number, sectionMm2 = 16): ElectricalEdge => ({
    id,
    sourceNodeId: source,
    targetNodeId: target,
    lengthMode: 'manual',
    horizontalLengthM: lengthM,
    verticalLengthM: 0,
    conductorType: 'N2XOH',
    conductorMaterial: 'copper',
    sectionMm2,
    wireConfiguration: '3F+N+T',
});

const port = (moduleId: number): ModuleElectricalPort => ({
    key: `${moduleId}`,
    moduleId,
    moduleName: `Módulo ${moduleId}`,
    sceneId: 's',
    sceneName: 'Piso 1',
    panelId: 'td',
    panelLabel: 'TD',
    panelRole: 'distribution',
    nominalVoltageV: 220,
    phases: 1,
    installedPowerW: 8000,
    demandPowerW: 8000,
    currentA: 0,
    mainBreakerA: 0,
    circuitsCount: 6,
    revision: '1',
});

function network(): ElectricalNetworkData {
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
            { id: 'service', type: 'service', label: 'Suministro', position: { x: 0, y: 0 }, transformerKva: 160 },
            { id: 'meter', type: 'meter', label: 'Medidor', position: { x: 0, y: 0 } },
            { id: 'tg', type: 'main_panel', label: 'TG', position: { x: 0, y: 0 } },
            ...[1, 2, 3].map((i) => ({
                id: `m${i}`,
                type: 'module_panel_port' as const,
                label: 'TD',
                moduleId: i,
                moduleName: `Módulo ${i}`,
                sceneId: 's',
                deviceId: 'td',
                position: { x: 0, y: 0 },
            })),
        ],
        edges: [
            edge('e1', 'service', 'meter', 5, 35),
            edge('e2', 'meter', 'tg', 10, 35),
            ...[1, 2, 3].map((i) => edge(`f${i}`, 'tg', `m${i}`, 30 * i, 10)),
        ],
    };
}

function diagram() {
    const data = network();
    const ports = [1, 2, 3].map(port);
    const calculations = calculateElectricalNetwork(data, ports, []);
    return buildSingleLineDiagram({
        network: data,
        calculations,
        ports,
        shortCircuits: calculateShortCircuits(data, ports, calculations),
        projectName: 'Colegio',
    });
}

describe('diagrama unifilar (E2)', () => {
    it('un nodo por equipo y un tramo por alimentador, con los datos de Red y CT', () => {
        const d = diagram();
        expect(d.nodes).toHaveLength(6);
        expect(d.edges).toHaveLength(5);
        const f2 = d.edges.find((e) => e.to === 'm2')!;
        expect(f2.lines.join(' ')).toContain('10,0 mm2');
        expect(f2.lines.join(' ')).toContain('L = 60,0 m');
        expect(f2.breaker).toMatch(/^ITM \d+ A$/);
        const tg = d.nodes.find((n) => n.id === 'tg')!;
        expect(tg.lines.join(' ')).toMatch(/Pd 24,00 kW/);
        expect(tg.lines.join(' ')).toMatch(/I"k3 \d/);
        expect(d.nodes.find((n) => n.id === 'service')!.lines).toContain('160 kVA');
    });

    it('árbol ordenado: hojas en columnas, cada padre centrado sobre sus hijos y un nivel por fila', () => {
        const d = diagram();
        const at = (id: string) => d.nodes.find((n) => n.id === id)!;
        expect(at('m2').x - at('m1').x).toBeCloseTo(SLD_COLUMN_MM, 9);
        expect(at('tg').x).toBeCloseTo((at('m1').x + at('m3').x) / 2, 9);
        expect(at('meter').x).toBeCloseTo(at('tg').x, 9);
        expect(at('tg').y).toBeGreaterThan(at('meter').y);
        expect(at('m1').y).toBeGreaterThan(at('tg').y);
        // Recorrido ortogonal: termina sobre la caja del hijo.
        const path = edgePath(at('tg'), at('m1'));
        expect(path[3].x).toBe(at('m1').x);
        expect(path[1].y).toBe(path[2].y);
    });

    it('DXF R12 bien formado, con capas propias y textos ASCII', () => {
        const dxf = renderSingleLineDxf(diagram());
        const lines = dxf.split('\n');
        const count = (value: string) => lines.filter((line) => line === value).length;
        expect(count('SECTION')).toBe(count('ENDSEC'));
        expect(lines.at(-2)).toBe('EOF');
        expect(dxf).toContain('UNIF-CONDUCTORES');
        expect(dxf).toContain('DIAGRAMA UNIFILAR - Colegio');
        expect(dxf).toMatch(/ITM \d+ A/);
        expect([...dxf].every((ch) => ch === '\n' || (ch >= ' ' && ch <= '~'))).toBe(true);
    });

    it('SVG con tamaño de papel en mm y título', () => {
        const svg = renderSingleLineSvg(diagram());
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toMatch(/width="\d+(\.\d+)?mm"/);
        expect(svg).toContain('DIAGRAMA UNIFILAR - Colegio');
    });
});
