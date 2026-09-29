import { AlertTriangle, Check, Wrench } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import { circuitCurrent } from '@/pages/dialux/electrical/engine/formulas';
import { CONDUCTOR_SECTION_OPTIONS } from '@/pages/dialux/hooks/types';
import {
    calculatePanelTotalCurrentA,
    resolveConformingSectionMm2,
} from '@/pages/dialux/hooks/wireLengthCalculations';
import type { SiteOutputRow } from '../../site/domain/siteOutputs';
import type { EdgeCalculation } from '../domain/calculations';
import {
    ctTreeOrder,
    rowsForDistributionPanel,
    type ModuleCtCircuit,
} from '../domain/ctTableRows';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    ElectricalNode,
    GraphIssue,
} from '../domain/types';

interface Props {
    data: ElectricalNetworkData;
    calculations: EdgeCalculation[];
    moduleCtCircuits: ModuleCtCircuit[];
    issues: GraphIssue[];
    onUpdateSettings: (
        patch: Partial<ElectricalNetworkData['settings']>,
    ) => void;
    onUpdateEdge: (id: string, patch: Partial<ElectricalEdge>) => void;
    onUpdateCircuit: (
        circuit: ModuleCtCircuit,
        patch: Partial<ModuleCtCircuit>,
    ) => void;
    onSelect: (id: string) => void;
    /**
     * Salidas de la Planta General (motor CT V1, `siteOutputs.ts`): su carga
     * y corrientes por fase se suman a la fila resumen del TG del que salen.
     */
    siteOutputRows?: SiteOutputRow[];
}
const COLS = 36;
// Techo del alimentador de UN TD/Sub-TD específico al corregir el árbol
// automáticamente — pasado esto, la corrección escala al alimentador padre
// (el TG que corresponde) en vez de seguir engordando ese tablero.
const TD_FEEDER_SECTION_CAP_MM2 = 150;
const ITM_OPTIONS = [
    '1x10',
    '1x16',
    '1x20',
    '1x25',
    '1x32',
    '1x40',
    '1x50',
    '1x63',
    '2x10',
    '2x16',
    '2x20',
    '2x25',
    '2x32',
    '2x40',
    '2x50',
    '2x63',
    '3x10',
    '3x15',
    '3x16',
    '3x20',
    '3x25',
    '3x30',
    '3x32',
    '3x35',
    '3x40',
    '3x50',
    '3x60',
    '3x63',
    '3x70',
    '3x75',
    '3x80',
    '3x100',
    '3x125',
    '3x140',
    '3x150',
    '3x160',
    '3x175',
    '3x180',
    '3x200',
    '3x225',
    '3x250',
    '3x300',
    '3x320',
    '3x400',
    '3x500',
    '3x630',
    '4x16',
    '4x25',
    '4x40',
    '4x63',
    '4x80',
    '4x100',
    '4x125',
    '4x160',
    '4x200',
    '4x250',
    '4x320',
    '4x400',
    '4x500',
    '4x630',
].map((value) => [value, value] as [string, string]);
const DIF_OPTIONS = ['2x25', '2x40', '2x63', '4x25', '4x40', '4x63'].map(
    (value) => [value, value] as [string, string],
);
const EARTH_SECTION_OPTIONS = [2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120].map(
    (value) => [value.toString(), value.toString()] as [string, string],
);
const CONDUCTOR_TYPE_OPTIONS = [
    'TW',
    'THW',
    'NYY',
    'LSOH-80',
    'LSOH-90',
    'N2X0H',
].map((value) => [value, value] as [string, string]);

function protectionValue(value: string): string {
    return value.replace(/\s*A$/i, '');
}

export function ElectricalCtTable({
    data,
    calculations,
    moduleCtCircuits,
    issues,
    onUpdateSettings,
    onUpdateEdge,
    onUpdateCircuit,
    onSelect,
    siteOutputRows = [],
}: Props) {
    const [treeFixApplied, setTreeFixApplied] = useState(false);
    const nodes = new Map(data.nodes.map((node) => [node.id, node]));
    // Numeración de TG como en la planilla: con varios TG de nombre genérico → TG-1, TG-2…
    const mainPanels = data.nodes.filter((node) => node.type === 'main_panel');
    const labelOf = (node: ElectricalNode) =>
        node.type === 'main_panel' && mainPanels.length > 1 && /^TG$/i.test(node.label.trim())
            ? `TG-${mainPanels.indexOf(node) + 1}`
            : node.label;
    const calcByEdge = new Map(calculations.map((item) => [item.edgeId, item]));
    const portIds = new Set(
        data.nodes
            .filter((node) => node.type === 'module_panel_port')
            .map((node) => node.id),
    );
    const edges = data.edges.filter((edge) => portIds.has(edge.targetNodeId));
    const connectedIds = new Set(edges.map((edge) => edge.targetNodeId));
    const disconnected = data.nodes.filter(
        (node) =>
            node.type === 'module_panel_port' && !connectedIds.has(node.id),
    );
    const topologyProblems = issues.filter(
        (issue) => issue.code !== 'disconnected',
    ).length;
    // TODOS los alimentadores de la red, no solo los que llegan a tableros de
    // módulo: el tramo Medidor→TG (el único TG del proyecto) también debe
    // contarse, para que la verificación escale hasta el TG igual que el
    // resto del árbol.
    const feederProblems = data.edges.filter((edge) =>
        ['incomplete', 'non_compliant'].includes(
            calcByEdge.get(edge.id)?.status ?? 'incomplete',
        ),
    ).length;
    // La verificación del árbol es por TABLERO (fila resumen "CGx" de cada
    // TD/Sub-TD/TG), nunca por salida individual — mismo criterio que ya usa
    // la red v2 (`EdgeCalculation.status` en calculations.ts, que solo
    // conoce alimentadores entre tableros, no circuitos de un ambiente).
    // Con proyectos de hasta 25+ módulos, cada uno con una cantidad distinta
    // de TD/Sub-TD (uno solo, tres, seis...) y algunos con salidas directo
    // del TG, evaluar cada salida individualmente generaría ruido que no
    // escala. Si un tablero incumple, eso ya se refleja en su propia fila
    // resumen y se arrastra hacia arriba (TD → TG) por la cascada de ΔU.
    // Alimentadores SIN DATOS (sin longitud o sin demanda): "Corregir
    // automáticamente" no los puede resolver — falta un dato, no una sección.
    const missingDataEdges = data.edges.filter(
        (edge) => (calcByEdge.get(edge.id)?.status ?? 'incomplete') === 'incomplete',
    );
    const missingDataLabels = missingDataEdges.map((edge) => {
        const from = nodes.get(edge.sourceNodeId);
        const to = nodes.get(edge.targetNodeId);
        const why =
            (calcByEdge.get(edge.id)?.lengthM ?? 0) <= 0
                ? 'sin longitud'
                : 'sin demanda';
        return `${from ? labelOf(from) : '?'} → ${to ? labelOf(to) : '?'} (${why})`;
    });
    const circuitProblems = moduleCtCircuits.filter(
        (item) =>
            item.isPanelSummary &&
            (!item.voltageDropOk ||
                !item.capacityConforms ||
                item.normativeViolation),
    ).length;
    const problems =
        topologyProblems +
        feederProblems +
        circuitProblems +
        disconnected.length;
    // Corrige el árbol multimódulo en un solo paso, pero SOLO a nivel de
    // tablero (alimentadores TG→TD→Sub-TD de la red v2 y las filas resumen
    // "CGx" de cada módulo) — nunca las salidas individuales. La sección de
    // una salida (alumbrado 2.5 mm², tomacorriente 4 mm²) es un mínimo
    // normativo fijo, no una variable de ajuste: si algo no cumple, se
    // corrige subiendo el alimentador que lo alimenta (mismo criterio de
    // "por tablero, no por salida" que ya usa la verificación del árbol).
    //
    // El alimentador que llega a un TD/Sub-TD específico (un solo módulo)
    // nunca crece más allá de TD_FEEDER_SECTION_CAP_MM2 — pasado ese punto
    // el problema no es "ese cable", es que el TRONCAL (Suministro→Medidor→
    // TG) no está dejando suficiente margen de ΔU para sus hijos. En ese
    // caso se sube un paso el alimentador PADRE (el que llega al origen de
    // este tramo) en vez de seguir engordando el TD — mismo algoritmo
    // hijo→padre que `resolveProjectTreeConformingSections` ya usa dentro
    // de un módulo, aplicado ahora también al límite TG↔TD de la red v2.
    // Subir un alimentador cambia la caída heredada de sus hijos, por lo que
    // un segundo clic puede seguir destrabando tableros que dependían de esa
    // corrección — converge en unos pocos clics, no en uno solo.
    const runTreeFix = () => {
        const nextCatalogSection = (current: number): number | undefined =>
            CONDUCTOR_SECTION_OPTIONS.map((option) => option.value as number)
                .sort((a, b) => a - b)
                .find((section) => section > current);
        for (const edge of data.edges) {
            const calc = calcByEdge.get(edge.id);
            if (!calc?.suggestedSectionMm2) continue;
            if (calc.suggestedSectionMm2 <= edge.sectionMm2) continue;
            const targetsModulePanel =
                nodes.get(edge.targetNodeId)?.type === 'module_panel_port';
            if (!targetsModulePanel) {
                // Tramo troncal (Suministro→Medidor→TG): sin techo.
                onUpdateEdge(edge.id, {
                    sectionMm2: calc.suggestedSectionMm2,
                });
                continue;
            }
            const cappedSection = Math.min(
                calc.suggestedSectionMm2,
                TD_FEEDER_SECTION_CAP_MM2,
            );
            if (cappedSection > edge.sectionMm2) {
                onUpdateEdge(edge.id, { sectionMm2: cappedSection });
            }
            if (calc.suggestedSectionMm2 > TD_FEEDER_SECTION_CAP_MM2) {
                const parentEdge = data.edges.find(
                    (candidate) => candidate.targetNodeId === edge.sourceNodeId,
                );
                const bumped =
                    parentEdge && nextCatalogSection(parentEdge.sectionMm2);
                if (parentEdge && bumped) {
                    onUpdateEdge(parentEdge.id, { sectionMm2: bumped });
                }
            }
        }
        moduleCtCircuits.forEach((circuit) => {
            if (!circuit.isPanelSummary) return;
            if (circuit.voltageDropOk && circuit.capacityConforms) return;
            const nextSection = resolveConformingSectionMm2(circuit);
            if (nextSection === null) return;
            const cappedSection = Math.min(
                nextSection,
                TD_FEEDER_SECTION_CAP_MM2,
            );
            if (cappedSection > circuit.sectionMm2) {
                onUpdateCircuit(circuit, { sectionMm2: cappedSection });
            }
        });
        setTreeFixApplied(true);
    };

    // ── Tabla en el ORDEN DEL ÁRBOL, como la planilla de CT: TG con sus
    // salidas (las de la planta) y su resumen, luego cada TD que cuelga de él
    // con sus salidas y su CG, luego sus Sub‑TD… Las salidas de la planta van
    // dentro de su tablero, no en una tabla aparte.
    const tree = ctTreeOrder(data);
    const unreachablePanels = tree.unreachable
        .map((id) => nodes.get(id))
        .filter((node): node is ElectricalNode => Boolean(node));
    const siteRowsOf = (node: ElectricalNode | undefined) =>
        node?.siteElementId
            ? siteOutputRows.filter(
                  (row) => row.panelElementId === node.siteElementId,
              )
            : [];
    const moduleRowsOf = (node: ElectricalNode | undefined) =>
        node?.type === 'module_panel_port' && node.moduleId !== undefined
            ? rowsForDistributionPanel(
                  moduleCtCircuits,
                  node.moduleId,
                  node.deviceId,
              )
            : { outputRows: [], summaryRows: [] };
    /**
     * Carga que cuelga de un tablero de la planta (TG / sub tablero): los CG
     * de los TD hijos (ya acumulan su subárbol) + sus salidas de la planta +
     * lo de sus sub tableros de planta hijos.
     */
    const loadsBelow = (
        nodeId: string,
    ): { summaries: ModuleCtCircuit[]; siteRows: SiteOutputRow[] } => {
        const own = nodes.get(nodeId);
        const result = {
            summaries: [] as ModuleCtCircuit[],
            siteRows: siteRowsOf(own),
        };
        for (const child of tree.blocks) {
            if (child.parentPanelId !== nodeId) continue;
            const childNode = nodes.get(child.nodeId);
            if (childNode?.type === 'module_panel_port') {
                result.summaries.push(...moduleRowsOf(childNode).summaryRows);
            } else if (childNode?.type === 'site_panel') {
                const nested = loadsBelow(child.nodeId);
                result.summaries.push(...nested.summaries);
                result.siteRows.push(...nested.siteRows);
            }
        }
        return result;
    };
    const indent = (depth: number) => `${'↳ '.repeat(Math.min(depth, 4))}`;
    /** Salidas de la planta de un tablero (TG / sub tablero de planta), filas C-1… */
    const renderSiteOutputs = (node: ElectricalNode, kind: string, select: () => void) => {
        const ownRows = siteRowsOf(node);
        return ownRows.map((row, index) => (
            <CircuitRow
                key={`${node.id}:${row.rootConductorId}:site`}
                circuit={{ ...row, moduleId: 0, moduleName: 'Planta general' }}
                onUpdate={onUpdateCircuit}
                readOnly
                description={{
                    title: row.outputLabel,
                    detail: `${row.loadsDetail}${row.firstTargetLabel ? ` · → ${row.firstTargetLabel}` : ''} (se edita en la planta general)`,
                }}
                panelHeader={
                    index === 0
                        ? { rowSpan: ownRows.length, panelKind: kind, panelLabel: labelOf(node), onSelect: select }
                        : undefined
                }
            />
        ));
    };
    /**
     * Pie de un TG (como la planilla: el TG va AL FINAL de su árbol): sus
     * salidas propias de la planta y la fila del alimentador general.
     */
    const renderTgFooter = (block: (typeof tree.blocks)[number]) => {
        const node = nodes.get(block.nodeId);
        if (!node) return null;
        const loads = loadsBelow(node.id);
        return (
            <Fragment key={`${node.id}:footer`}>
                <tr className="bg-violet-100 font-bold text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                    <td colSpan={COLS} className="px-3 py-1.5">
                        {labelOf(node)} · salidas propias y alimentador general (caída aguas arriba desde el suministro)
                    </td>
                </tr>
                {renderSiteOutputs(node, 'TG', () => onSelect(block.edgeId ?? node.id))}
                <GeneralRow
                    tgNodeId={node.id}
                    displayLabel={labelOf(node)}
                    data={data}
                    calculations={calculations}
                    distributionSummaries={loads.summaries}
                    siteRows={loads.siteRows}
                    editableSettings
                    onUpdate={onUpdateSettings}
                    onUpdateEdge={onUpdateEdge}
                />
            </Fragment>
        );
    };
    const renderBlock = (block: (typeof tree.blocks)[number]) => {
        const node = nodes.get(block.nodeId);
        if (!node) return null;
        const parent = block.parentPanelId
            ? nodes.get(block.parentPanelId)
            : undefined;
        const parentLabel = parent ? labelOf(parent) : undefined;
        const select = () => onSelect(block.edgeId ?? node.id);
        if (node.type === 'main_panel') {
            // Cabecera del árbol del TG; su pie (salidas + alimentador general) va al final.
            return (
                <tr key={node.id} className="bg-slate-800 font-bold text-white dark:bg-[#1c2740]">
                    <td colSpan={COLS} className="px-3 py-2">
                        ÁRBOL {labelOf(node)}
                        {parentLabel ? ` · alimentado desde ${parentLabel}` : ''} · caída de tensión propia de este árbol
                    </td>
                </tr>
            );
        }
        if (node.type === 'site_panel') {
            const loads = loadsBelow(node.id);
            return (
                <Fragment key={node.id}>
                    <tr className="bg-slate-200 font-bold text-slate-800 dark:bg-[#344763] dark:text-white">
                        <td colSpan={COLS} className="px-3 py-1.5">
                            {indent(block.depth)}TD (planta) {node.label}
                            {parentLabel ? ` · alimentado desde ${parentLabel}` : ''}
                        </td>
                    </tr>
                    {renderSiteOutputs(node, 'TD', select)}
                    <GeneralRow
                        tgNodeId={node.id}
                        displayLabel={node.label}
                        data={data}
                        calculations={calculations}
                        distributionSummaries={loads.summaries}
                        siteRows={loads.siteRows}
                        editableSettings={false}
                        onUpdate={onUpdateSettings}
                        onUpdateEdge={onUpdateEdge}
                    />
                </Fragment>
            );
        }
        // Tablero de un módulo (TD / Sub‑TD): salidas C-1… y luego SU fila de
        // alimentador (caída aguas arriba), como la planilla.
        const { outputRows, summaryRows } = moduleRowsOf(node);
        const panelKind = parent?.type === 'main_panel' ? 'TD' : 'Sub-TD';
        const entersModule = parent?.moduleId !== node.moduleId;
        const panelHeader = (rowSpan: number) => ({
            rowSpan,
            panelKind,
            panelLabel: `${indent(block.depth)}${node.label}`,
            onSelect: select,
        });
        return (
            <Fragment key={node.id}>
                <tr
                    className={
                        entersModule
                            ? 'bg-slate-600 font-bold text-white dark:bg-[#2c3d58]'
                            : 'bg-slate-200 font-bold text-slate-800 dark:bg-[#344763] dark:text-white'
                    }
                >
                    <td colSpan={COLS} className="px-3 py-1.5">
                        {indent(block.depth)}
                        {panelKind} {node.label} · {node.moduleName ?? 'Módulo'}
                        {node.sceneName ? ` · ${node.sceneName}` : ''}
                        {parentLabel ? ` · alimentado desde ${parentLabel}` : ''}
                        {' · '}
                        {outputRows.length} salida(s)
                    </td>
                </tr>
                {outputRows.map((circuit, circuitIndex) => (
                    <CircuitRow
                        key={`${node.id}:${circuit.rootConductorId}:C`}
                        circuit={circuit}
                        onUpdate={onUpdateCircuit}
                        panelHeader={
                            circuitIndex === 0
                                ? panelHeader(outputRows.length)
                                : undefined
                        }
                    />
                ))}
                {summaryRows.length > 0
                    ? summaryRows.map((circuit) => (
                          <CircuitRow
                              key={`${node.id}:${circuit.rootConductorId}:CG`}
                              circuit={circuit}
                              onUpdate={onUpdateCircuit}
                              panelHeader={panelHeader(1)}
                          />
                      ))
                    : (
                          // El módulo no publica fila resumen de su tablero raíz
                          // (en la V1 solo existe si otro tablero del módulo lo
                          // alimenta): se arma desde el alimentador de la red.
                          <GeneralRow
                              tgNodeId={node.id}
                              displayLabel={`${panelKind} ${node.label}`}
                              data={data}
                              calculations={calculations}
                              distributionSummaries={outputRows}
                              siteRows={[]}
                              editableSettings={false}
                              onUpdate={onUpdateSettings}
                              onUpdateEdge={onUpdateEdge}
                          />
                      )}
            </Fragment>
        );
    };
    /** Filas en el orden de la planilla: por cada TG, sus TD/Sub-TD y al final el TG. */
    const renderTree = () => {
        const rows: ReactNode[] = [];
        let openTg: (typeof tree.blocks)[number] | null = null;
        for (const block of tree.blocks) {
            const node = nodes.get(block.nodeId);
            if (node?.type === 'main_panel') {
                if (openTg) rows.push(renderTgFooter(openTg));
                openTg = block;
            }
            rows.push(renderBlock(block));
        }
        if (openTg) rows.push(renderTgFooter(openTg));
        return rows;
    };

    return (
        <section className="flex min-h-0 flex-1 flex-col bg-slate-50 dark:bg-[#090c14]">
            <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#101218]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Cálculo CT — árbol TG → TD → Sub‑TD → salidas (módulos y
                    planta general)
                </h2>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    Misma matriz de 36 columnas y mismas fórmulas del cálculo CT
                    por módulo; cada tablero con sus salidas en el orden del
                    árbol. Las salidas de la planta se editan en la planta
                    general (cable, sección y recorrido dibujados).
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={runTreeFix}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-emerald-500"
                    >
                        <Wrench className="h-3.5 w-3.5" />
                        Corregir automáticamente
                    </button>
                    <span
                        className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${problems === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}
                    >
                        {problems === 0
                            ? 'Árbol completo dentro de los límites configurados'
                            : `${problems} incidencia(s): ${topologyProblems} topología · ${feederProblems} alimentadores · ${circuitProblems} circuitos · ${disconnected.length} desconectados`}
                    </span>
                    {treeFixApplied && (
                        <p
                            className={
                                problems === 0
                                    ? 'text-[10px] font-semibold text-emerald-600 dark:text-emerald-400'
                                    : 'text-[10px] font-semibold text-amber-600 dark:text-amber-400'
                            }
                        >
                            {problems === 0
                                ? 'Todo el árbol multimódulo está dentro de los límites configurados.'
                                : problems > missingDataEdges.length
                                  ? `${problems - missingDataEdges.length} incidencia(s) siguen sin cumplir — vuelve a pulsar "Corregir automáticamente" (subir un alimentador cambia la caída heredada de sus hijos) o revisa el calibre máximo disponible.`
                                  : 'Las secciones ya cumplen; lo que queda son datos faltantes (ver abajo).'}
                        </p>
                    )}
                    {missingDataEdges.length > 0 && (
                        <p className="w-full text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            {`Faltan datos para calcular (el botón no los puede corregir): ${missingDataLabels.join(' · ')}. Define la longitud del alimentador en la planta general (TG → Config. → Acometida y cálculo, o dibujando el cable) o en el diagrama de red.`}
                        </p>
                    )}
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[3500px] border-collapse text-left text-[10px] text-slate-700 dark:text-slate-200">
                    <FullHeader />
                    <tbody>
                        {renderTree()}
                        {unreachablePanels.map((node) => (
                            <tr
                                key={node.id}
                                className="bg-amber-50 dark:bg-amber-950/20"
                            >
                                <td className="px-3 py-2 font-semibold">
                                    {node.moduleName ?? 'Planta general'}
                                </td>
                                <td>—</td>
                                <td
                                    colSpan={COLS - 2}
                                    className="px-3 py-2 text-amber-700 dark:text-amber-300"
                                >
                                    {node.sceneName
                                        ? `${node.sceneName} · `
                                        : ''}
                                    {node.label}: tablero desconectado del árbol
                                    (no cuelga de ningún TG).
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function FullHeader() {
    return (
        <thead className="sticky top-0 z-30 bg-sky-700 text-[9px] font-semibold tracking-wide text-white uppercase dark:bg-sky-900">
            <tr className="divide-x divide-sky-500 border-b border-sky-400 text-center">
                <Th rowSpan={2}>Datos del tablero eléctrico</Th>
                <Th rowSpan={2}>N.º circuito</Th>
                <Th rowSpan={2} wide>
                    Descripción del circuito eléctrico
                </Th>
                <Th rowSpan={2}>PI (W) alum.</Th>
                <Th rowSpan={2}>PI (W) tomas</Th>
                <Th rowSpan={2}>PI (W) fuerza</Th>
                <Th rowSpan={2}>Factor de potencia</Th>
                <Th rowSpan={2}>FS tomac</Th>
                <Th rowSpan={2}>P.I total (kW)</Th>
                <Th rowSpan={2}>M.D (kW)</Th>
                <Th rowSpan={2}>Sistema</Th>
                <Th rowSpan={2}>Id teórica</Th>
                <Th rowSpan={2}>In total</Th>
                <Th colSpan={4}>Id total balanceada</Th>
                <Th rowSpan={2}>Inom cable</Th>
                <Th rowSpan={2}>T. amb. (°C)</Th>
                <Th rowSpan={2}>N.º circuitos agrup.</Th>
                <Th rowSpan={2}>Factor agrup. K1</Th>
                <Th rowSpan={2}>Factor temp. K2</Th>
                <Th rowSpan={2}>Iadm cable</Th>
                <Th rowSpan={2}>Conformidad por capacidad</Th>
                <Th colSpan={2}>Capacidad de las protecciones eléctricas</Th>
                <Th rowSpan={2} length>
                    Longitud horizontal (m)
                </Th>
                <Th rowSpan={2} length>
                    Longitud vertical (m)
                </Th>
                <Th rowSpan={2} length>
                    Longitud total (m)
                </Th>
                <Th rowSpan={2}>Sección del conductor</Th>
                <Th rowSpan={2}>Delta V (V)</Th>
                <Th rowSpan={2}>Delta V (%)</Th>
                <Th rowSpan={2}>&lt;4% final / &lt;2.5% aliment.</Th>
                <Th rowSpan={2}>Diámetro del tubo</Th>
                <Th rowSpan={2}>Tipo de conductor</Th>
                <Th rowSpan={2}>Sección conductor a tierra</Th>
            </tr>
            <tr className="divide-x divide-sky-500 border-b border-sky-400 text-center">
                <Th>Balanceo</Th>
                <Th>R</Th>
                <Th>S</Th>
                <Th>T</Th>
                <Th>ITM</Th>
                <Th>DIF</Th>
            </tr>
        </thead>
    );
}

function GeneralRow({
    tgNodeId,
    data,
    calculations,
    distributionSummaries,
    siteRows = [],
    editableSettings = true,
    displayLabel,
    onUpdate,
    onUpdateEdge,
}: {
    tgNodeId?: string;
    /** Etiqueta en la planilla (TG-1, TD-01…); por defecto la del nodo. */
    displayLabel?: string;
    /** Solo el TG edita los ajustes generales de la red (fp, sistema, T). */
    editableSettings?: boolean;
    data: ElectricalNetworkData;
    calculations: EdgeCalculation[];
    distributionSummaries: ModuleCtCircuit[];
    /** Salidas de la planta que salen de ESTE TG (motor CT V1). */
    siteRows?: SiteOutputRow[];
    onUpdate: Props['onUpdateSettings'];
    onUpdateEdge: Props['onUpdateEdge'];
}) {
    // Alimentador real Medidor → TG (el único TG del proyecto) — sin esto la
    // fila resumen del TG mostraba longitud/sección/ΔU fijos en 0, aunque el
    // usuario ya lo hubiera configurado en el diagrama de red.
    const tgNode =
        data.nodes.find((node) => node.id === tgNodeId) ??
        data.nodes.find((node) => node.type === 'main_panel');
    const tgEdge = data.edges.find((edge) => edge.targetNodeId === tgNode?.id);
    const tgResult = calculations.find((item) => item.edgeId === tgEdge?.id);
    // Carga del TG = sus tableros de módulo + sus salidas de la planta (ambas
    // salen del mismo motor CT V1, mismas columnas de fase).
    const loadRows: Array<
        Pick<
            ModuleCtCircuit,
            | 'installedPowerW'
            | 'maximumDemandKw'
            | 'phaseCurrentR'
            | 'phaseCurrentS'
            | 'phaseCurrentT'
        >
    > = [...distributionSummaries, ...siteRows];
    const installedPowerW = loadRows.reduce(
        (sum, circuit) => sum + circuit.installedPowerW,
        0,
    );
    const demandPowerW = loadRows.reduce(
        (sum, circuit) => sum + circuit.maximumDemandKw * 1000,
        0,
    );
    const phaseCurrentR = loadRows.reduce(
        (sum, circuit) => sum + circuit.phaseCurrentR,
        0,
    );
    const phaseCurrentS = loadRows.reduce(
        (sum, circuit) => sum + circuit.phaseCurrentS,
        0,
    );
    const phaseCurrentT = loadRows.reduce(
        (sum, circuit) => sum + circuit.phaseCurrentT,
        0,
    );
    const designFactor = data.settings.designFactor ?? 1.25;
    const currentA = calculatePanelTotalCurrentA(
        phaseCurrentR,
        phaseCurrentS,
        phaseCurrentT,
        designFactor,
    );
    const theoreticalDesignCurrentA =
        circuitCurrent(
            demandPowerW,
            data.settings.phases === 1 ? 220 : data.settings.nominalVoltageV,
            data.settings.phases,
            data.settings.defaultPowerFactor,
        ) * designFactor;
    const ok =
        distributionSummaries.every(
            (circuit) => circuit.capacityConforms && circuit.voltageDropOk,
        ) && (tgResult ? tgResult.status !== 'non_compliant' : true);

    return (
        <tr className="border-b-4 border-violet-300 bg-violet-50/80 font-semibold dark:border-violet-900 dark:bg-violet-950/20">
            <Mono
                value={`${displayLabel ?? tgNode?.label ?? 'TG'} · ${tgNode?.type === 'main_panel' ? 'Alim. general' : 'Alimentador'}`}
                accent
            />
            <Mono value="CG1" accent />
            <Description
                title={`${displayLabel ?? tgNode?.label ?? 'TG'} · caída aguas arriba`}
                detail={
                    tgNode?.type === 'module_panel_port'
                        ? `${distributionSummaries.length} salida(s) del tablero; alimentador desde su tablero padre (longitud horizontal + vertical de la red)`
                        : `${distributionSummaries.length} tablero(s) + ${siteRows.length} salida(s) de la planta general; alimentador que llega a este tablero`
                }
            />
            <Mono value="0" />
            <Mono value="0" />
            <Mono value={installedPowerW.toFixed(0)} />
            <Edit
                readOnly={!editableSettings}
                value={data.settings.defaultPowerFactor}
                onChange={(value) =>
                    onUpdate({ defaultPowerFactor: Math.min(1, value) })
                }
            />
            <Mono value="1.00" />
            <Mono value={(installedPowerW / 1000).toFixed(2)} strong />
            <Mono value={(demandPowerW / 1000).toFixed(2)} strong />
            {editableSettings ? (
                <td className="px-2 py-2">
                    <select
                        value={data.settings.phases}
                        onChange={(event) =>
                            onUpdate({
                                phases: Number(event.target.value) as 1 | 3,
                            })
                        }
                        className="h-8 rounded border border-slate-300 bg-white px-2 dark:border-white/15 dark:bg-[#182237]"
                    >
                        <option value={1}>1Φ+N+T</option>
                        <option value={3}>3Φ+N+T</option>
                    </select>
                </td>
            ) : (
                <Mono value={`${tgNode?.phases ?? data.settings.phases}Φ`} />
            )}
            <Mono value={theoreticalDesignCurrentA.toFixed(2)} />
            <Mono value={currentA.toFixed(2)} />
            <Mono value={data.settings.phases === 3 ? 'RST' : 'R'} />
            <Mono value={phaseCurrentR.toFixed(2)} />
            <Mono value={phaseCurrentS.toFixed(2)} />
            <Mono value={phaseCurrentT.toFixed(2)} />
            <Mono value={tgResult?.ampacityA?.toFixed(2) ?? '—'} />
            <Edit
                readOnly={!editableSettings}
                value={data.settings.workingTemperatureC}
                onChange={(value) => onUpdate({ workingTemperatureC: value })}
            />
            <Mono value="1" />
            <Mono value="1.00" />
            <Mono value="1.00" />
            <Mono value={tgResult?.ampacityA?.toFixed(2) ?? '—'} />
            <Conform ok={ok} />
            <Mono value={tgResult ? `${tgResult.breakerA} A` : '—'} />
            <Mono value="—" />
            <Mono
                value={tgEdge ? tgEdge.horizontalLengthM.toFixed(2) : '0.00'}
            />
            <Mono value={tgEdge ? tgEdge.verticalLengthM.toFixed(2) : '0.00'} />
            <Mono value={tgResult ? tgResult.lengthM.toFixed(2) : '0.00'} />
            {tgEdge ? (
                <SelectCell
                    value={tgEdge.sectionMm2.toString()}
                    options={CONDUCTOR_SECTION_OPTIONS.map((option) => [
                        option.value.toString(),
                        option.label,
                    ])}
                    onChange={(value) =>
                        onUpdateEdge(tgEdge.id, {
                            sectionMm2: Number(value),
                        })
                    }
                />
            ) : (
                <Mono value="—" />
            )}
            <Mono
                value={tgResult ? tgResult.ownVoltageDropV.toFixed(2) : '0.00'}
            />
            <Mono
                value={`${tgResult ? tgResult.accumulatedVoltageDropPercent.toFixed(2) : '0.00'}%`}
                strong
            />
            <Conform
                ok={
                    tgResult
                        ? tgResult.status === 'complete' ||
                          tgResult.status === 'warning'
                        : ok
                }
            />
            <Mono value="—" />
            {tgEdge ? (
                <td className="px-2 py-2">
                    <input
                        value={tgEdge.conductorType}
                        onChange={(event) =>
                            onUpdateEdge(tgEdge.id, {
                                conductorType: event.target.value,
                            })
                        }
                        className="h-8 w-24 rounded border border-slate-300 bg-white px-2 dark:border-white/15 dark:bg-[#182237]"
                    />
                </td>
            ) : (
                <Mono value="—" />
            )}
            {tgEdge ? (
                <SelectCell
                    value={(tgEdge.earthSectionMm2 ?? 2.5).toString()}
                    options={EARTH_SECTION_OPTIONS}
                    onChange={(value) =>
                        onUpdateEdge(tgEdge.id, {
                            earthSectionMm2: Number(value),
                        })
                    }
                />
            ) : (
                <Mono value="—" />
            )}
        </tr>
    );
}

interface PanelHeader {
    rowSpan: number;
    panelKind: string;
    panelLabel: string;
    onSelect?: () => void;
}

function PanelHeaderCell({
    header,
    summary,
}: {
    header: PanelHeader;
    summary?: boolean;
}) {
    return (
        <td
            rowSpan={header.rowSpan}
            onClick={header.onSelect}
            className={`border-r border-slate-300 px-3 py-3 text-center align-middle dark:border-slate-700 ${summary ? 'cursor-pointer bg-blue-100 dark:bg-blue-950/40' : 'cursor-pointer bg-violet-50/80 dark:bg-violet-950/20'}`}
        >
            <span className="rounded bg-cyan-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {header.panelKind}
            </span>
            <p className="mt-1 font-semibold">{header.panelLabel}</p>
        </td>
    );
}

function CircuitRow({
    circuit,
    onUpdate,
    panelHeader,
    readOnly = false,
    description,
}: {
    circuit: ModuleCtCircuit;
    onUpdate: Props['onUpdateCircuit'];
    panelHeader?: PanelHeader;
    /** Salidas de la planta: se editan en la planta general (dibujo). */
    readOnly?: boolean;
    description?: { title: string; detail: string };
}) {
    const dropPct = circuit.voltageDropPct;
    const dropV = circuit.voltageDropV;
    const ok =
        circuit.voltageDropOk &&
        circuit.capacityConforms &&
        !circuit.normativeViolation;
    return (
        <tr
            className={`border-t border-slate-200 align-top dark:border-slate-800 ${circuit.isPanelSummary ? 'bg-blue-50/70 font-semibold dark:bg-blue-950/20' : 'bg-white dark:bg-[#090d13]'}`}
        >
            {panelHeader && (
                <PanelHeaderCell
                    header={panelHeader}
                    summary={circuit.isPanelSummary}
                />
            )}
            <Mono
                value={circuit.isPanelSummary ? 'CG1' : circuit.code}
                accent
            />
            {description ? (
                <Description
                    title={description.title}
                    detail={description.detail}
                />
            ) : (
                <Description
                    title={
                        circuit.isPanelSummary
                            ? `Resumen del tablero ${circuit.panelLabel}`
                            : circuit.rooms
                                  .map((room) => room.roomName)
                                  .join(', ') || circuit.code
                    }
                    detail={
                        circuit.isPanelSummary
                            ? 'Resumen de las salidas y del alimentador del tablero'
                            : circuit.fedPanelLabels.length
                              ? `Alimenta: ${circuit.fedPanelLabels.join(', ')}`
                              : circuit.traversedRoomNames.join(' → ')
                    }
                />
            )}
            <Mono
                value={
                    circuit.isPanelSummary
                        ? circuit.upstreamVoltageDropV.toFixed(2)
                        : circuit.lightingPowerW.toFixed(0)
                }
            />
            <Mono value={circuit.outletPowerW.toFixed(0)} />
            {circuit.isPanelSummary ? (
                <Mono value={circuit.forcePowerW.toFixed(0)} />
            ) : (
                <Edit
                    readOnly={readOnly}
                    value={circuit.forcePowerW}
                    onChange={(value) =>
                        onUpdate(circuit, { forcePowerW: value })
                    }
                />
            )}
            <Edit
                readOnly={readOnly}
                value={circuit.powerFactor}
                onChange={(value) =>
                    onUpdate(circuit, { powerFactor: Math.min(1, value) })
                }
            />
            <Edit
                readOnly={readOnly}
                value={circuit.demandFactor}
                onChange={(value) =>
                    onUpdate(circuit, { demandFactor: Math.min(1, value) })
                }
            />
            <Mono value={circuit.installedPowerKw.toFixed(2)} strong />
            <Mono value={circuit.maximumDemandKw.toFixed(2)} strong />
            <SelectCell
                readOnly={readOnly}
                value={circuit.phases.toString()}
                options={[
                    ['1', '1Φ+N+T'],
                    ['3', '3Φ+N+T'],
                ]}
                onChange={(value) =>
                    onUpdate(circuit, { phases: Number(value) as 1 | 3 })
                }
            />
            <Mono value={circuit.theoreticalDesignCurrentA.toFixed(2)} />
            <Mono value={circuit.currentA.toFixed(2)} />
            <SelectCell
                readOnly={readOnly}
                value={circuit.phaseBalance}
                options={['R', 'S', 'T', 'RS', 'ST', 'TR', 'RST'].map(
                    (value) => [value, value] as [string, string],
                )}
                onChange={(value) =>
                    onUpdate(circuit, {
                        phaseBalance: value as ModuleCtCircuit['phaseBalance'],
                    })
                }
            />
            <Mono value={circuit.phaseCurrentR.toFixed(2)} />
            <Mono value={circuit.phaseCurrentS.toFixed(2)} />
            <Mono value={circuit.phaseCurrentT.toFixed(2)} />
            <Mono value={circuit.nominalCableCurrentA.toFixed(2)} />
            <Edit
                readOnly={readOnly}
                value={circuit.ambientTemperatureC}
                onChange={(value) =>
                    onUpdate(circuit, { ambientTemperatureC: value })
                }
            />
            <Edit
                readOnly={readOnly}
                value={circuit.groupedCircuitCount}
                onChange={(value) =>
                    onUpdate(circuit, {
                        groupedCircuitCount: Math.max(1, Math.round(value)),
                    })
                }
            />
            <Edit
                readOnly={readOnly}
                value={circuit.groupingFactor}
                onChange={(value) =>
                    onUpdate(circuit, { groupingFactor: value })
                }
            />
            <Edit
                readOnly={readOnly}
                value={circuit.temperatureFactor}
                onChange={(value) =>
                    onUpdate(circuit, { temperatureFactor: value })
                }
            />
            <Mono value={circuit.admissibleCableCurrentA.toFixed(2)} />
            <Conform ok={circuit.capacityConforms} />
            <SelectCell
                readOnly={readOnly}
                value={protectionValue(circuit.itm)}
                options={ITM_OPTIONS}
                onChange={(value) => onUpdate(circuit, { itm: value })}
            />
            <SelectCell
                readOnly={readOnly}
                value={protectionValue(circuit.dif)}
                options={DIF_OPTIONS}
                onChange={(value) => onUpdate(circuit, { dif: value })}
            />
            <Mono value={circuit.horizontalLengthM.toFixed(2)} />
            <Mono value={circuit.verticalLengthM.toFixed(2)} />
            <Mono value={circuit.lengthM.toFixed(2)} />
            <SelectCell
                readOnly={readOnly}
                value={circuit.sectionMm2.toString()}
                options={CONDUCTOR_SECTION_OPTIONS.map((option) => [
                    option.value.toString(),
                    option.label,
                ])}
                onChange={(value) =>
                    onUpdate(circuit, { sectionMm2: Number(value) })
                }
            />
            <Mono value={dropV.toFixed(2)} />
            <Mono value={`${dropPct.toFixed(2)}%`} strong />
            <Conform
                ok={
                    ok &&
                    dropPct < (circuit.circuitLoadType === 'feeder' ? 2.5 : 4)
                }
            />
            <Mono value={`${circuit.tubeDiameterMm} mm`} />
            <SelectCell
                readOnly={readOnly}
                value={circuit.conductorType}
                options={CONDUCTOR_TYPE_OPTIONS}
                onChange={(value) =>
                    onUpdate(circuit, { conductorType: value })
                }
            />
            <SelectCell
                readOnly={readOnly}
                value={circuit.earthSectionMm2.toString()}
                options={EARTH_SECTION_OPTIONS}
                onChange={(value) =>
                    onUpdate(circuit, { earthSectionMm2: Number(value) })
                }
            />
        </tr>
    );
}

function Th({
    children,
    rowSpan,
    colSpan,
    wide,
    length,
}: {
    children: React.ReactNode;
    rowSpan?: number;
    colSpan?: number;
    wide?: boolean;
    length?: boolean;
}) {
    return (
        <th
            rowSpan={rowSpan}
            colSpan={colSpan}
            className={`${wide ? 'min-w-72' : 'min-w-20'} ${length ? 'bg-lime-400 text-slate-950' : ''} px-3 py-2`}
        >
            {children}
        </th>
    );
}
function Mono({
    value,
    strong,
    accent,
}: {
    value: string;
    strong?: boolean;
    accent?: boolean;
}) {
    return (
        <td
            className={`border-r border-slate-200 px-3 py-3 font-mono tabular-nums dark:border-slate-800 ${strong || accent ? 'font-bold text-emerald-600' : ''}`}
        >
            {value}
        </td>
    );
}
function Description({ title, detail }: { title: string; detail: string }) {
    return (
        <td className="min-w-72 px-3 py-3">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-[9px] text-slate-500">
                {detail || 'Sin ruta'}
            </p>
        </td>
    );
}
function Conform({ ok }: { ok: boolean }) {
    return (
        <td className="px-3 py-3 text-center">
            {ok ? (
                <Check className="mx-auto h-3.5 w-3.5 text-emerald-500" />
            ) : (
                <AlertTriangle className="mx-auto h-3.5 w-3.5 text-amber-500" />
            )}
        </td>
    );
}
function Edit({
    value,
    onChange,
    suffix,
    readOnly = false,
}: {
    value: number;
    onChange: (value: number) => void;
    suffix?: string;
    readOnly?: boolean;
}) {
    if (readOnly) return <Mono value={`${value}${suffix ?? ''}`} />;
    return (
        <td className="bg-lime-50 px-2 py-2 dark:bg-lime-950/10">
            <label className="flex h-8 w-24 items-center rounded border border-lime-500 bg-white dark:bg-[#182237]">
                <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={value}
                    onChange={(event) =>
                        onChange(Math.max(0, Number(event.target.value) || 0))
                    }
                    className="min-w-0 flex-1 bg-transparent px-2 font-mono outline-none"
                />
                <span className="pr-1 text-[8px] text-slate-400">{suffix}</span>
            </label>
        </td>
    );
}

function SelectCell({
    value,
    options,
    onChange,
    readOnly = false,
}: {
    value: string;
    options: Array<[string, string]>;
    onChange: (value: string) => void;
    readOnly?: boolean;
}) {
    if (readOnly) {
        return (
            <Mono
                value={
                    options.find(
                        ([optionValue]) => optionValue === value,
                    )?.[1] ?? value
                }
            />
        );
    }
    return (
        <td className="px-2 py-2">
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-8 w-24 rounded border border-slate-300 bg-white px-2 font-mono outline-none dark:border-white/15 dark:bg-[#182237]"
            >
                {options.map(([optionValue, label]) => (
                    <option key={optionValue} value={optionValue}>
                        {label}
                    </option>
                ))}
            </select>
        </td>
    );
}
