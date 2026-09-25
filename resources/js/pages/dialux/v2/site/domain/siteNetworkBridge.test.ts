import { describe, expect, it } from 'vitest';
import { calculateElectricalNetwork } from '../../electrical-network/domain/calculations';
import { validateElectricalNetwork } from '../../electrical-network/domain/graph';
import type { ElectricalNetworkData } from '../../electrical-network/domain/types';
import {
    applySiteToNetwork,
    siteCircuitEdgeId,
    sitePanelNodeId,
} from './siteNetworkBridge';
import type { SiteCircuit, SiteData, SiteElement } from './types';

function baseNetwork(): ElectricalNetworkData {
    const edge = (id: string, source: string, target: string) => ({
        id,
        sourceNodeId: source,
        targetNodeId: target,
        lengthMode: 'manual' as const,
        horizontalLengthM: 10,
        verticalLengthM: 0,
        conductorType: 'N2XOH',
        conductorMaterial: 'copper' as const,
        sectionMm2: 16,
        wireConfiguration: '3F+N+T',
    });
    return {
        schemaVersion: 1,
        rootNodeId: 'svc',
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
            { id: 'svc', type: 'service', label: 'Suministro', position: { x: 80, y: 220 } },
            { id: 'mtr', type: 'meter', label: 'Medidor', position: { x: 320, y: 220 } },
            { id: 'tg', type: 'main_panel', label: 'TG', position: { x: 560, y: 220 } },
        ],
        edges: [edge('e1', 'svc', 'mtr'), edge('e2', 'mtr', 'tg')],
    };
}

function panel(id: string, type: 'tg_location' | 'sub_panel', x: number): SiteElement {
    return {
        id,
        type,
        label: id.toUpperCase(),
        vertices: [{ x, y: 0 }],
        style: { fillColor: '#000', strokeColor: '#000' },
    };
}

function cable(id: string, sourceId: string, targetId: string, toX: number): SiteCircuit {
    return {
        id,
        sourceId,
        targetId,
        waypoints: [
            { x: 0, y: 0 },
            { x: toX, y: 0 },
        ],
        calculatedLengthM: toX,
        wireCount: 4,
        wastePct: 0,
    };
}

function site(elements: SiteElement[], circuits: SiteCircuit[] = []): SiteData {
    return {
        schemaVersion: 1,
        terrainScaleM: 1,
        gridSizeM: 1,
        canvasWidth: 100,
        canvasHeight: 100,
        elements,
        feederPaths: [],
        circuits,
        layers: [],
    };
}

describe('applySiteToNetwork', () => {
    it('sin planta no toca la red', () => {
        const network = baseNetwork();
        const result = applySiteToNetwork(network, null);
        expect(result.changed).toBe(false);
        expect(result.data).toBe(network);
    });

    it('un solo suministro: el primer TG reclama el TG existente y el segundo cuelga del medidor principal', () => {
        const result = applySiteToNetwork(
            baseNetwork(),
            site([panel('tg1', 'tg_location', 0), panel('tg2', 'tg_location', 50)]),
        );

        const mains = result.data.nodes.filter((node) => node.type === 'main_panel');
        expect(mains).toHaveLength(2);
        expect(mains.find((node) => node.id === 'tg')?.siteElementId).toBe('tg1');
        expect(result.data.nodes.filter((node) => node.type === 'service')).toHaveLength(1);
        expect(result.data.nodes.filter((node) => node.type === 'meter')).toHaveLength(1);
        expect(
            result.data.edges.find((edge) => edge.targetNodeId === sitePanelNodeId('tg2'))
                ?.sourceNodeId,
        ).toBe('mtr');
        expect(validateElectricalNetwork(result.data)).toEqual([]);
    });

    it('"Suministro propio" (supplyMode own) crea la cadena Suministro → Medidor del TG', () => {
        const once = applySiteToNetwork(
            baseNetwork(),
            site([panel('tg1', 'tg_location', 0), panel('tg2', 'tg_location', 50)]),
        ).data;
        const tg2 = sitePanelNodeId('tg2');
        const own: ElectricalNetworkData = {
            ...once,
            nodes: once.nodes.map((node) =>
                node.id === tg2 ? { ...node, supplyMode: 'own' as const } : node,
            ),
            edges: once.edges.filter((edge) => edge.targetNodeId !== tg2),
        };
        const result = applySiteToNetwork(
            own,
            site([panel('tg1', 'tg_location', 0), panel('tg2', 'tg_location', 50)]),
        );
        expect(result.data.nodes.filter((node) => node.type === 'service')).toHaveLength(2);
        expect(validateElectricalNetwork(result.data)).toEqual([]);
    });

    it('migra la cadena propia automática de la versión previa al medidor principal', () => {
        const legacy: ElectricalNetworkData = {
            ...baseNetwork(),
            nodes: [
                ...baseNetwork().nodes,
                { id: 'site-supply-tg2', type: 'service', label: 'Suministro TG-2', origin: 'site', siteElementId: 'tg2', position: { x: 0, y: 400 } },
                { id: 'site-meter-tg2', type: 'meter', label: 'Medidor TG-2', origin: 'site', siteElementId: 'tg2', position: { x: 0, y: 400 } },
                { id: 'site-tg2', type: 'main_panel', label: 'TG-2', origin: 'site', siteElementId: 'tg2', position: { x: 0, y: 400 } },
            ],
            edges: [
                ...baseNetwork().edges,
                { ...baseNetwork().edges[0], id: 'site-supply-edge-tg2', sourceNodeId: 'site-supply-tg2', targetNodeId: 'site-meter-tg2' },
                { ...baseNetwork().edges[0], id: 'site-meter-edge-tg2', sourceNodeId: 'site-meter-tg2', targetNodeId: 'site-tg2' },
            ],
        };
        const result = applySiteToNetwork(
            legacy,
            site([panel('tg1', 'tg_location', 0), panel('tg2', 'tg_location', 50)]),
        );
        expect(result.data.nodes.filter((node) => node.type === 'service')).toHaveLength(1);
        expect(
            result.data.edges.find((edge) => edge.targetNodeId === 'site-tg2')?.sourceNodeId,
        ).toBe('mtr');
    });

    it('un transformador dibujado es el suministro y sus cables alimentan a los dos TG', () => {
        const trafo = { ...panel('tr', 'tg_location', -30), type: 'transformer' as const, label: 'Subestación' };
        const result = applySiteToNetwork(
            baseNetwork(),
            site(
                [trafo, panel('tg1', 'tg_location', 0), panel('tg2', 'tg_location', 50)],
                [cable('c1', 'tr', 'tg1', 30), cable('c2', 'tr', 'tg2', 80)],
            ),
        );
        expect(result.data.nodes.find((node) => node.id === 'svc')?.siteElementId).toBe('tr');
        expect(result.data.nodes.filter((node) => node.type === 'service')).toHaveLength(1);
        const toTg1 = result.data.edges.find((edge) => edge.targetNodeId === 'tg');
        const toTg2 = result.data.edges.find((edge) => edge.targetNodeId === sitePanelNodeId('tg2'));
        // Un solo suministro → medidor → ambos TG, cada uno con la longitud de SU cable.
        expect(toTg1).toMatchObject({ id: 'e2', sourceNodeId: 'mtr', siteCircuitId: 'c1', lengthMode: 'site', sectionMm2: 16 });
        expect(toTg1?.horizontalLengthM).toBeCloseTo(30, 6);
        expect(toTg2).toMatchObject({ sourceNodeId: 'mtr', siteCircuitId: 'c2' });
        expect(toTg2?.horizontalLengthM).toBeCloseTo(80, 6);
        expect(validateElectricalNetwork(result.data)).toEqual([]);
    });

    it('es idempotente: re-aplicarlo no duplica nada', () => {
        const plant = site(
            [panel('tg1', 'tg_location', 0), panel('td1', 'sub_panel', 30), panel('tg2', 'tg_location', 50)],
            [cable('c1', 'tg1', 'td1', 30)],
        );
        const once = applySiteToNetwork(baseNetwork(), plant);
        const twice = applySiteToNetwork(once.data, plant);
        expect(twice.changed).toBe(false);
        expect(twice.data.nodes).toHaveLength(once.data.nodes.length);
        expect(twice.data.edges).toHaveLength(once.data.edges.length);
    });

    it('un cable TG → sub tablero es un alimentador con la longitud dibujada', () => {
        const result = applySiteToNetwork(
            baseNetwork(),
            site(
                [panel('tg1', 'tg_location', 0), panel('td1', 'sub_panel', 30)],
                // Dibujado al revés (del TD al TG): se orienta aguas abajo igual.
                [cable('c1', 'td1', 'tg1', 30)],
            ),
        );
        const edge = result.data.edges.find((item) => item.id === siteCircuitEdgeId('c1'));
        expect(edge).toMatchObject({
            sourceNodeId: 'tg',
            targetNodeId: sitePanelNodeId('td1'),
            lengthMode: 'site',
            siteCircuitId: 'c1',
        });
        expect(edge?.horizontalLengthM).toBeCloseTo(30, 6);
        expect(validateElectricalNetwork(result.data)).toEqual([]);
    });

    it('un cable TG1 → TG2 alimenta TG2 desde TG1', () => {
        const result = applySiteToNetwork(
            baseNetwork(),
            site(
                [panel('tg1', 'tg_location', 0), panel('tg2', 'tg_location', 40)],
                [cable('c1', 'tg1', 'tg2', 40)],
            ),
        );
        expect(
            result.data.edges.filter((edge) => edge.targetNodeId === sitePanelNodeId('tg2')),
        ).toHaveLength(1);
        expect(
            result.data.edges.find((edge) => edge.targetNodeId === sitePanelNodeId('tg2'))
                ?.sourceNodeId,
        ).toBe('tg');
    });

    it('el cable dibujado manda: reutiliza el alimentador puesto a mano (conserva su sección)', () => {
        const withTd = applySiteToNetwork(
            baseNetwork(),
            site([panel('tg1', 'tg_location', 0), panel('td1', 'sub_panel', 30)]),
        ).data;
        const manual: ElectricalNetworkData = {
            ...withTd,
            edges: [
                ...withTd.edges,
                { ...withTd.edges[0], id: 'hand', sourceNodeId: 'mtr', targetNodeId: sitePanelNodeId('td1'), sectionMm2: 25 },
            ],
        };
        const result = applySiteToNetwork(
            manual,
            site(
                [panel('tg1', 'tg_location', 0), panel('td1', 'sub_panel', 30)],
                [cable('c1', 'tg1', 'td1', 30)],
            ),
        );
        expect(result.data.edges.find((edge) => edge.id === 'hand')).toMatchObject({
            sourceNodeId: 'tg',
            siteCircuitId: 'c1',
            sectionMm2: 25,
        });
        expect(result.conflicts).toEqual([]);
    });

    it('la sección definida en el cable pasa a la red', () => {
        const plant = (sectionMm2?: number) =>
            site(
                [panel('tg1', 'tg_location', 0), panel('td1', 'sub_panel', 30)],
                [{ ...cable('c1', 'tg1', 'td1', 30), sectionMm2 }],
            );
        const first = applySiteToNetwork(baseNetwork(), plant()).data;
        const updated = applySiteToNetwork(first, plant(35)).data;
        expect(updated.edges.find((edge) => edge.siteCircuitId === 'c1')?.sectionMm2).toBe(35);
    });

    it('dos cables al mismo tablero: el segundo se reporta', () => {
        const result = applySiteToNetwork(
            baseNetwork(),
            site(
                [panel('tg1', 'tg_location', 0), panel('tg2', 'tg_location', 20), panel('td1', 'sub_panel', 30)],
                [cable('c1', 'tg1', 'td1', 30), cable('c2', 'tg2', 'td1', 10)],
            ),
        );
        expect(result.conflicts.map((conflict) => conflict.code)).toContain('feeder-taken');
    });

    it('borrar el objeto en la planta no borra el nodo: queda como huérfano', () => {
        const withTd = applySiteToNetwork(
            baseNetwork(),
            site([panel('tg1', 'tg_location', 0), panel('td1', 'sub_panel', 30)]),
        ).data;
        const result = applySiteToNetwork(withTd, site([panel('tg1', 'tg_location', 0)]));
        expect(result.data.nodes.some((node) => node.id === sitePanelNodeId('td1'))).toBe(true);
        expect(result.conflicts.map((conflict) => conflict.code)).toContain('orphan-node');
    });

    it('la caída de tensión se calcula en las dos ramas del mismo suministro', () => {
        const result = applySiteToNetwork(
            baseNetwork(),
            site([panel('tg1', 'tg_location', 0), panel('tg2', 'tg_location', 50)]),
        );
        const calculations = calculateElectricalNetwork(result.data, []);
        // Suministro → Medidor, Medidor → TG y Medidor → TG-2.
        expect(calculations).toHaveLength(3);
    });
});

describe('applySiteToNetwork · nombres', () => {
    it('numera el segundo TG si la planta repite el nombre', () => {
        const same = (id: string, x: number): SiteElement => ({
            ...panel(id, 'tg_location', x),
            label: 'TG',
        });
        const result = applySiteToNetwork(baseNetwork(), site([same('a', 0), same('b', 50)]));
        const labels = result.data.nodes.map((node) => node.label);
        expect(labels).toContain('TG');
        expect(labels).toContain('TG-2');
    });
});

describe('applySiteToNetwork · cable a un bloque de módulo (Fase 3)', () => {
    const port = (panelId: string, parentPanelId: string | null = null) => ({
        key: `7:s1:${panelId}`,
        moduleId: 7,
        moduleName: 'Módulo 7',
        sceneId: 's1',
        sceneName: 'Piso 1',
        panelId,
        panelLabel: panelId.toUpperCase(),
        parentPanelId,
        panelRole: parentPanelId ? ('sub_distribution' as const) : ('distribution' as const),
        nominalVoltageV: 380,
        phases: 3 as const,
        installedPowerW: 5000,
        demandPowerW: 4000,
        currentA: 7,
        mainBreakerA: 16,
        circuitsCount: 2,
        revision: 'r1',
    });
    const block = (moduleId?: number): SiteElement => ({
        id: 'blk',
        type: 'building_block',
        label: 'Bloque 7',
        vertices: [
            { x: 40, y: -5 },
            { x: 60, y: -5 },
            { x: 60, y: 5 },
            { x: 40, y: 5 },
        ],
        moduleId,
        moduleName: 'Módulo 7',
        style: { fillColor: '#000', strokeColor: '#000' },
    });

    it('importa los tableros del módulo y alimenta su raíz desde el TG del cable', () => {
        const result = applySiteToNetwork(
            baseNetwork(),
            site([panel('tg1', 'tg_location', 0), block(7)], [cable('c1', 'tg1', 'blk', 50)]),
            { ports: [port('td'), port('td-01', 'td')], panelVerticalM: () => 2 },
        );
        const td = result.data.nodes.find((node) => node.deviceId === 'td');
        const td01 = result.data.nodes.find((node) => node.deviceId === 'td-01');
        expect(td?.type).toBe('module_panel_port');
        const feeder = result.data.edges.find((edge) => edge.siteCircuitId === 'c1');
        expect(feeder).toMatchObject({
            sourceNodeId: 'tg',
            targetNodeId: td?.id,
            lengthMode: 'site',
            verticalLengthM: 2,
        });
        expect(
            result.data.edges.find((edge) => edge.targetNodeId === td01?.id)?.sourceNodeId,
        ).toBe(td?.id);
        expect(validateElectricalNetwork(result.data)).toEqual([]);
        // La carga del módulo sube por el cable de la planta.
        const calc = calculateElectricalNetwork(result.data, [port('td'), port('td-01', 'td')]);
        expect(calc.find((item) => item.edgeId === feeder?.id)?.demandPowerW).toBe(8000);
    });

    it('reutiliza el alimentador que ya tenía el módulo (conserva su sección) y cambia su origen', () => {
        const imported: ElectricalNetworkData = {
            ...baseNetwork(),
            nodes: [
                ...baseNetwork().nodes,
                { id: 'p-td', type: 'module_panel_port', label: 'TD', moduleId: 7, sceneId: 's1', deviceId: 'td', position: { x: 820, y: 220 } },
            ],
            edges: [
                ...baseNetwork().edges,
                { ...baseNetwork().edges[0], id: 'old', sourceNodeId: 'tg', targetNodeId: 'p-td', sectionMm2: 35 },
            ],
        };
        const result = applySiteToNetwork(
            imported,
            site(
                [panel('tg1', 'tg_location', 0), panel('tg2', 'tg_location', 20), block(7)],
                [cable('c1', 'tg2', 'blk', 50)],
            ),
            { ports: [port('td')] },
        );
        const feeder = result.data.edges.find((edge) => edge.id === 'old');
        expect(feeder).toMatchObject({
            sourceNodeId: sitePanelNodeId('tg2'),
            siteCircuitId: 'c1',
            sectionMm2: 35,
            lengthMode: 'site',
        });
        expect(result.data.edges.filter((edge) => edge.targetNodeId === 'p-td')).toHaveLength(1);
    });

    it('avisa si el bloque no tiene módulo, si el módulo no tiene tablero o si hay varios raíz', () => {
        const codes = (moduleId: number | undefined, ports: ReturnType<typeof port>[]) =>
            applySiteToNetwork(
                baseNetwork(),
                site([panel('tg1', 'tg_location', 0), block(moduleId)], [cable('c1', 'tg1', 'blk', 50)]),
                { ports },
            ).conflicts.map((conflict) => conflict.code);

        expect(codes(undefined, [])).toContain('block-unlinked');
        expect(codes(7, [])).toContain('module-no-panel');
        expect(codes(7, [port('td-a'), port('td-b')])).toContain('module-panel-ambiguous');
    });
});

describe('applySiteToNetwork · ATS y grupo electrógeno', () => {
    it('transformador → ATS → TG: el ATS queda en el camino; el GE se informa como respaldo', () => {
        const trafo = { ...panel('tr', 'tg_location', -60), type: 'transformer' as const, label: 'Subestación' };
        const ats = { ...panel('ats1', 'tg_location', -30), type: 'ats' as const, label: 'ATS' };
        const ge = { ...panel('ge', 'tg_location', -30), type: 'generator' as const, label: 'GE' };
        const result = applySiteToNetwork(
            baseNetwork(),
            site(
                [trafo, ats, ge, panel('tg1', 'tg_location', 0)],
                [cable('c1', 'tr', 'ats1', 30), cable('c2', 'ats1', 'tg1', 30), cable('c3', 'ge', 'ats1', 5)],
            ),
        );
        const atsNode = result.data.nodes.find((node) => node.siteElementId === 'ats1');
        expect(atsNode?.type).toBe('ats');
        expect(result.data.edges.find((edge) => edge.targetNodeId === atsNode?.id)?.sourceNodeId).toBe('mtr');
        expect(result.data.edges.find((edge) => edge.targetNodeId === 'tg')?.sourceNodeId).toBe(atsNode?.id);
        expect(result.conflicts.map((conflict) => conflict.code)).toEqual(['backup-source']);
        expect(validateElectricalNetwork(result.data)).toEqual([]);
    });
});
