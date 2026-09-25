import type { SiteOutputRow } from '../../site/domain/siteOutputs';
import type { EdgeCalculation } from './calculations';
import { networkRootIds } from './graph';
import type { ShortCircuitResult } from './shortCircuit';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    ElectricalNode,
    ModuleElectricalPort,
} from './types';

/**
 * Diagrama UNIFILAR de la red (fase E2 de
 * `plan_pendientes_exterior_electrico_documentos.md`): un modelo puro, en
 * milímetros de papel, que dibujan igual el SVG (vista previa / PDF por
 * impresión) y el DXF. Sale de los MISMOS datos que Red y CT — nada se
 * re-digita:
 *  - árbol suministro → medidor → TG → sub tableros / tableros de módulo;
 *  - por alimentador: conductor, sección, longitud, ITM, ΔU propia y acumulada;
 *  - por tablero: demanda (con fs), I″k (R3) y sistema;
 *  - salidas de los tableros de la planta (motor CT de la V1) como ramas finales.
 * Disposición en árbol ordenado: hojas en columnas, cada padre centrado sobre
 * sus hijos, un nivel por fila.
 */

export const SLD_COLUMN_MM = 62;
export const SLD_ROW_MM = 58;
export const SLD_BOX_W_MM = 44;
export const SLD_BOX_H_MM = 14;
export const SLD_MARGIN_MM = 20;
export const SLD_TITLE_H_MM = 26;

export type SldNodeKind = 'service' | 'meter' | 'panel' | 'module' | 'output' | 'other';

export interface SldNode {
    id: string;
    kind: SldNodeKind;
    /** Centro de la caja (mm, Y hacia abajo). */
    x: number;
    y: number;
    title: string;
    lines: string[];
    warning: boolean;
}

export interface SldEdge {
    from: string;
    to: string;
    /** Rótulo del alimentador / circuito (junto al tramo vertical que llega al hijo). */
    lines: string[];
    breaker?: string;
    warning: boolean;
}

export interface SingleLineDiagram {
    widthMm: number;
    heightMm: number;
    nodes: SldNode[];
    edges: SldEdge[];
    title: string;
    notes: string[];
}

const fmt = (value: number, digits = 1) =>
    Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '-';

function kindOf(node: ElectricalNode): SldNodeKind {
    if (node.type === 'service') return 'service';
    if (node.type === 'meter') return 'meter';
    if (node.type === 'module_panel_port') return 'module';
    if (node.type === 'main_panel' || node.type === 'site_panel') return 'panel';
    return 'other';
}

function cableText(edge: ElectricalEdge): string {
    const earth = edge.earthSectionMm2 ? ` + T ${fmt(edge.earthSectionMm2, 1)}` : '';
    return `${edge.wireConfiguration || ''} ${fmt(edge.sectionMm2, 1)} mm2${earth} ${edge.conductorType || ''}`
        .replace(/\s+/g, ' ')
        .trim();
}

export function buildSingleLineDiagram(input: {
    network: ElectricalNetworkData;
    calculations: EdgeCalculation[];
    ports: ModuleElectricalPort[];
    shortCircuits?: ShortCircuitResult;
    siteOutputRows?: SiteOutputRow[];
    projectName?: string;
}): SingleLineDiagram {
    const { network, calculations } = input;
    const calcByEdge = new Map(calculations.map((item) => [item.edgeId, item]));
    const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
    const children = new Map<string, ElectricalEdge[]>();
    for (const edge of network.edges) {
        children.set(edge.sourceNodeId, [...(children.get(edge.sourceNodeId) ?? []), edge]);
    }
    const incoming = new Map(network.edges.map((edge) => [edge.targetNodeId, edge]));
    const outputsByNode = new Map<string, SiteOutputRow[]>();
    for (const row of input.siteOutputRows ?? []) {
        const node = network.nodes.find(
            (item) =>
                item.siteElementId === row.panelElementId &&
                item.type !== 'service' &&
                item.type !== 'meter',
        );
        if (node) outputsByNode.set(node.id, [...(outputsByNode.get(node.id) ?? []), row]);
    }
    const portOf = (node: ElectricalNode) =>
        input.ports.find(
            (port) =>
                port.moduleId === node.moduleId &&
                port.sceneId === node.sceneId &&
                port.panelId === node.deviceId,
        );

    const nodes: SldNode[] = [];
    const edges: SldEdge[] = [];
    let nextColumn = 0;
    const visited = new Set<string>();

    /** Devuelve la X (columna) del nodo colocado. */
    const place = (nodeId: string, depth: number): number => {
        visited.add(nodeId);
        const node = nodeById.get(nodeId)!;
        const childXs: number[] = [];
        for (const edge of children.get(nodeId) ?? []) {
            if (visited.has(edge.targetNodeId) || !nodeById.has(edge.targetNodeId)) continue;
            childXs.push(place(edge.targetNodeId, depth + 1));
            const calc = calcByEdge.get(edge.id);
            const thermal = input.shortCircuits?.edges.get(edge.id);
            edges.push({
                from: nodeId,
                to: edge.targetNodeId,
                breaker: calc ? `ITM ${calc.breakerA} A` : undefined,
                lines: [
                    cableText(edge),
                    `L = ${fmt(edge.horizontalLengthM + edge.verticalLengthM, 1)} m`,
                    calc
                        ? `dU ${fmt(calc.ownVoltageDropPercent, 2)} % (acum. ${fmt(calc.accumulatedVoltageDropPercent, 2)} %)`
                        : 'dU -',
                ],
                warning:
                    (calc?.status === 'non_compliant') || thermal?.ok === false,
            });
        }
        // Salidas de los tableros de la planta (ramas finales).
        for (const row of outputsByNode.get(nodeId) ?? []) {
            const id = `${nodeId}::${row.rootConductorId}`;
            const x = SLD_MARGIN_MM + SLD_COLUMN_MM / 2 + nextColumn++ * SLD_COLUMN_MM;
            childXs.push(x);
            nodes.push({
                id,
                kind: 'output',
                x,
                y: SLD_MARGIN_MM + SLD_TITLE_H_MM + (depth + 1) * SLD_ROW_MM,
                title: `${row.outputLabel} (${row.phaseBalance})`,
                lines: [row.loadsDetail.slice(0, 34), `${fmt(row.installedPowerW / 1000, 2)} kW`],
                warning: !row.voltageDropOk || !row.capacityConforms,
            });
            edges.push({
                from: nodeId,
                to: id,
                breaker: row.itm ? `ITM ${row.itm}` : undefined,
                lines: [
                    `${row.phases === 3 ? '3F+N+T' : 'F+N+T'} ${fmt(row.sectionMm2, 1)} mm2 ${row.conductorType}`,
                    `L = ${fmt(row.lengthM, 1)} m`,
                    `dU acum. ${fmt(row.voltageDropPct, 2)} %`,
                ],
                warning: !row.voltageDropOk || !row.capacityConforms,
            });
        }
        const x =
            childXs.length > 0
                ? (Math.min(...childXs) + Math.max(...childXs)) / 2
                : SLD_MARGIN_MM + SLD_COLUMN_MM / 2 + nextColumn++ * SLD_COLUMN_MM;
        const inEdge = incoming.get(nodeId);
        const calc = inEdge ? calcByEdge.get(inEdge.id) : undefined;
        const sc = input.shortCircuits?.nodes.get(nodeId);
        const port = node.type === 'module_panel_port' ? portOf(node) : undefined;
        const lines: string[] = [];
        if (node.moduleName) lines.push(node.moduleName.slice(0, 30));
        if (port) lines.push(`${port.phases === 3 ? '3F' : '1F'} ${port.nominalVoltageV} V · ${port.circuitsCount} circ.`);
        if (calc && calc.demandPowerW > 0) {
            lines.push(
                `Pd ${fmt(calc.demandPowerW / 1000, 2)} kW${calc.simultaneityFactor < 1 ? ` (fs ${fmt(calc.simultaneityFactor, 2)})` : ''}`,
            );
        }
        if (sc && Number.isFinite(sc.ikKa)) lines.push(`I"k${sc.kind === '3F' ? '3' : '1'} ${fmt(sc.ikKa, 2)} kA`);
        if (node.type === 'service' && node.transformerKva) lines.push(`${node.transformerKva} kVA`);
        nodes.push({
            id: nodeId,
            kind: kindOf(node),
            x,
            y: SLD_MARGIN_MM + SLD_TITLE_H_MM + depth * SLD_ROW_MM,
            title: node.label,
            lines,
            warning: sc?.breakingCapacityOk === false,
        });
        return x;
    };
    for (const root of networkRootIds(network)) {
        if (!visited.has(root) && nodeById.has(root)) place(root, 0);
    }

    const maxY = nodes.reduce((max, node) => Math.max(max, node.y), 0);
    const widthMm = Math.max(297, SLD_MARGIN_MM * 2 + Math.max(1, nextColumn) * SLD_COLUMN_MM);
    const heightMm = Math.max(210, maxY + SLD_BOX_H_MM + 45 + SLD_MARGIN_MM);
    const { settings } = network;
    return {
        widthMm,
        heightMm,
        nodes,
        edges,
        title: `DIAGRAMA UNIFILAR${input.projectName ? ` - ${input.projectName}` : ''}`,
        notes: [
            `Sistema ${settings.phases === 3 ? '3F' : '1F'} ${settings.nominalVoltageV} V ${settings.connectionType === 'star' ? 'estrella' : 'delta'} ${settings.frequencyHz} Hz · cos phi ${fmt(settings.defaultPowerFactor, 2)} · ${settings.workingTemperatureC} C`,
            `dU de alimentadores: IEC 60364-5-52 Anexo G (acumulada en %); salidas de la planta: motor CT de la V1. Limites configurados: ${fmt(settings.feederDropLimitPercent, 1)} % alimentador / ${fmt(settings.totalDropLimitPercent, 1)} % total (referencia CNE-U 050-102, sin confirmar).`,
            'I"k: IEC 60909-0 (c = 1,05). En rojo: fuera del limite configurado, Icu < I"k o seccion que no soporta la falla.',
        ],
    };
}
