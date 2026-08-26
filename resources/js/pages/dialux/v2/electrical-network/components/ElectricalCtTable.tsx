import { AlertTriangle, Check, CheckCircle2, Link2Off } from 'lucide-react';
import { Fragment, useState } from 'react';
import { circuitCurrent } from '@/pages/dialux/electrical/engine/formulas';
import { calculatePanelTotalCurrentA } from '@/pages/dialux/hooks/wireLengthCalculations';
import { CONDUCTOR_SECTION_OPTIONS } from '@/pages/dialux/hooks/types';
import type { EdgeCalculation } from '../domain/calculations';
import {
    rowsForDistributionPanel,
    type ModuleCtCircuit,
} from '../domain/ctTableRows';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    GraphIssue,
} from '../domain/types';

interface Props {
    data: ElectricalNetworkData;
    calculations: EdgeCalculation[];
    moduleCtCircuits: ModuleCtCircuit[];
    issues: GraphIssue[];
    onUpdateEdge: (id: string, patch: Partial<ElectricalEdge>) => void;
    onUpdateSettings: (
        patch: Partial<ElectricalNetworkData['settings']>,
    ) => void;
    onUpdateCircuit: (
        circuit: ModuleCtCircuit,
        patch: Partial<ModuleCtCircuit>,
    ) => void;
    onRemove: (id: string) => void;
    onSelect: (id: string) => void;
}
const COLS = 36;
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
    onUpdateCircuit,
    onUpdateEdge,
    onRemove,
    onSelect,
}: Props) {
    const [verified, setVerified] = useState(false);
    const nodes = new Map(data.nodes.map((node) => [node.id, node]));
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
    const feederProblems = edges.filter((edge) =>
        ['incomplete', 'non_compliant'].includes(
            calcByEdge.get(edge.id)?.status ?? 'incomplete',
        ),
    ).length;
    // Verifica TODO el árbol del módulo, no solo las salidas finales: una
    // fila resumen (TD/TG) representa el alimentador que agrupa a sus
    // hijos, y puede incumplir caída de tensión/capacidad aunque ninguna
    // salida final propia lo haga (p.ej. un TD que solo alimenta Sub-TDs).
    const circuitProblems = moduleCtCircuits.filter(
        (item) =>
            !item.voltageDropOk ||
            !item.capacityConforms ||
            item.normativeViolation,
    ).length;
    const problems =
        topologyProblems +
        feederProblems +
        circuitProblems +
        disconnected.length;
    const moduleIds = Array.from(
        new Set(
            edges
                .map((edge) => nodes.get(edge.targetNodeId)?.moduleId)
                .filter((id): id is number => id !== undefined),
        ),
    );
    const rootEdges = edges.filter(
        (edge) => nodes.get(edge.sourceNodeId)?.type === 'main_panel',
    );
    const rootPanelIds = new Set(
        rootEdges
            .map((edge) => nodes.get(edge.targetNodeId)?.deviceId)
            .filter((panelId): panelId is string => Boolean(panelId)),
    );
    const rootDistributionSummaries = moduleCtCircuits.filter(
        (circuit) =>
            circuit.isPanelSummary &&
            circuit.panelType === 'sub_panel' &&
            rootPanelIds.has(circuit.panelId),
    );

    return (
        <section className="flex min-h-0 flex-1 flex-col bg-slate-50 dark:bg-[#090c14]">
            <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#101218]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Cálculo CT multimódulo — TG, TD, Sub‑TD y salidas
                </h2>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    Misma matriz de 36 columnas y mismas fórmulas del cálculo CT
                    por módulo.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setVerified(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-[10px] font-semibold text-white"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Verificar árbol multimódulo
                    </button>
                    <span
                        className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${problems === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}
                    >
                        {!verified
                            ? 'Verificación pendiente'
                            : problems === 0
                              ? 'Árbol completo y conforme'
                              : `${problems} incidencia(s): ${topologyProblems} topología · ${feederProblems} alimentadores · ${circuitProblems} circuitos · ${disconnected.length} desconectados`}
                    </span>
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[3500px] border-collapse text-left text-[10px] text-slate-700 dark:text-slate-200">
                    <FullHeader />
                    <tbody>
                        {moduleIds.map((moduleId) => {
                            const moduleEdges = edges
                                .filter(
                                    (edge) =>
                                        nodes.get(edge.targetNodeId)
                                            ?.moduleId === moduleId,
                                )
                                .sort((left, right) => {
                                    const depthOf = (edge: ElectricalEdge) => {
                                        let depth = 0;
                                        let sourceId = edge.sourceNodeId;
                                        const visited = new Set<string>();
                                        while (!visited.has(sourceId)) {
                                            visited.add(sourceId);
                                            const parent = edges.find(
                                                (candidate) =>
                                                    candidate.targetNodeId ===
                                                    sourceId,
                                            );
                                            if (!parent) break;
                                            depth += 1;
                                            sourceId = parent.sourceNodeId;
                                        }
                                        return depth;
                                    };
                                    const depthDifference =
                                        depthOf(left) - depthOf(right);
                                    if (depthDifference !== 0)
                                        return depthDifference;
                                    const leftDevice = nodes.get(
                                        left.targetNodeId,
                                    )?.deviceId;
                                    const rightDevice = nodes.get(
                                        right.targetNodeId,
                                    )?.deviceId;
                                    const levelOf = (deviceId?: string) =>
                                        moduleCtCircuits.find(
                                            (item) =>
                                                item.moduleId === moduleId &&
                                                item.panelId === deviceId,
                                        )?.levelIndex ?? 0;
                                    return (
                                        levelOf(leftDevice) -
                                        levelOf(rightDevice)
                                    );
                                });
                            const moduleName =
                                nodes.get(moduleEdges[0]?.targetNodeId ?? '')
                                    ?.moduleName ?? `Módulo ${moduleId}`;
                            const circuits = moduleCtCircuits.filter(
                                (item) => item.moduleId === moduleId,
                            );
                            const principalTdCount = moduleEdges.filter(
                                (edge) =>
                                    nodes.get(edge.sourceNodeId)?.type ===
                                    'main_panel',
                            ).length;
                            const subTdCount =
                                moduleEdges.length - principalTdCount;
                            return (
                                <Fragment key={moduleId}>
                                    <tr className="bg-slate-700 font-bold text-white dark:bg-[#263650]">
                                        <td
                                            colSpan={COLS}
                                            className="px-3 py-1.5"
                                        >
                                            {moduleName} · {principalTdCount} TD
                                            principal(es) · {subTdCount} Sub‑TD
                                            ·{' '}
                                            {
                                                circuits.filter(
                                                    (item) =>
                                                        !item.isPanelSummary,
                                                ).length
                                            }{' '}
                                            salida(s)
                                        </td>
                                    </tr>
                                    {moduleEdges.map((edge, edgeIndex) => {
                                        const target = nodes.get(
                                            edge.targetNodeId,
                                        );
                                        const source = nodes.get(
                                            edge.sourceNodeId,
                                        );
                                        const result = calcByEdge.get(edge.id);
                                        if (!target || !result) return null;
                                        const { outputRows, summaryRows } =
                                            rowsForDistributionPanel(
                                                circuits,
                                                moduleId,
                                                target.deviceId,
                                            );
                                        const rowCount =
                                            outputRows.length +
                                            summaryRows.length;
                                        if (rowCount === 0) return null;
                                        const panelKind =
                                            source?.type === 'main_panel'
                                                ? 'TD'
                                                : 'Sub-TD';
                                        const previousTarget = nodes.get(
                                            moduleEdges[edgeIndex - 1]
                                                ?.targetNodeId ?? '',
                                        );
                                        const startsLevel =
                                            edgeIndex === 0 ||
                                            previousTarget?.sceneId !==
                                                target.sceneId;
                                        return (
                                            <Fragment key={edge.id}>
                                                {startsLevel && (
                                                    <tr className="bg-slate-200 font-bold text-slate-800 dark:bg-[#344763] dark:text-white">
                                                        <td
                                                            colSpan={COLS}
                                                            className="px-3 py-1.5"
                                                        >
                                                            {target.sceneName ??
                                                                'Sin nivel'}
                                                        </td>
                                                    </tr>
                                                )}
                                                <FeederRow
                                                    edge={edge}
                                                    result={result}
                                                    moduleName={moduleName}
                                                    levelName={
                                                        target.sceneName ??
                                                        'Sin nivel'
                                                    }
                                                    panelLabel={target.label}
                                                    sourceLabel={
                                                        source?.label ?? 'TG'
                                                    }
                                                    panelKind={panelKind}
                                                    rowSpan={rowCount + 1}
                                                    phases={data.settings.phases}
                                                    onUpdate={onUpdateEdge}
                                                    onRemove={onRemove}
                                                    onSelect={onSelect}
                                                />
                                                {outputRows.map((circuit) => (
                                                    <CircuitRow
                                                        key={`${edge.id}:${circuit.rootConductorId}:${circuit.isPanelSummary ? 'CG' : 'C'}`}
                                                        circuit={circuit}
                                                        onUpdate={
                                                            onUpdateCircuit
                                                        }
                                                    />
                                                ))}
                                                {summaryRows.map((circuit) => (
                                                    <CircuitRow
                                                        key={`${edge.id}:${circuit.rootConductorId}:CG`}
                                                        circuit={circuit}
                                                        onUpdate={
                                                            onUpdateCircuit
                                                        }
                                                    />
                                                ))}
                                            </Fragment>
                                        );
                                    })}
                                </Fragment>
                            );
                        })}
                        {disconnected.map((node) => (
                            <tr
                                key={node.id}
                                className="bg-amber-50 dark:bg-amber-950/20"
                            >
                                <td className="px-3 py-2 font-semibold">
                                    {node.moduleName}
                                </td>
                                <td>—</td>
                                <td
                                    colSpan={COLS - 2}
                                    className="px-3 py-2 text-amber-700 dark:text-amber-300"
                                >
                                    {node.sceneName} · {node.label}: tablero
                                    desconectado del TG General.
                                </td>
                            </tr>
                        ))}
                        <tr className="bg-slate-800 font-semibold text-white">
                            <td
                                colSpan={COLS}
                                className="px-3 py-2 text-center"
                            >
                                RESUMEN GENERAL (TG) · {moduleIds.length}{' '}
                                módulo(s) · {rootEdges.length} TD principal(es)
                            </td>
                        </tr>
                        <GeneralRow
                            data={data}
                            distributionSummaries={rootDistributionSummaries}
                            onUpdate={onUpdateSettings}
                        />
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
    data,
    distributionSummaries,
    onUpdate,
}: {
    data: ElectricalNetworkData;
    distributionSummaries: ModuleCtCircuit[];
    onUpdate: Props['onUpdateSettings'];
}) {
    const installedPowerW = distributionSummaries.reduce(
        (sum, circuit) => sum + circuit.installedPowerW,
        0,
    );
    const demandPowerW = distributionSummaries.reduce(
        (sum, circuit) => sum + circuit.maximumDemandKw * 1000,
        0,
    );
    const phaseCurrentR = distributionSummaries.reduce(
        (sum, circuit) => sum + circuit.phaseCurrentR,
        0,
    );
    const phaseCurrentS = distributionSummaries.reduce(
        (sum, circuit) => sum + circuit.phaseCurrentS,
        0,
    );
    const phaseCurrentT = distributionSummaries.reduce(
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
    const ok = distributionSummaries.every(
        (circuit) => circuit.capacityConforms && circuit.voltageDropOk,
    );

    return (
        <tr className="border-b-4 border-violet-300 bg-violet-50/80 font-semibold dark:border-violet-900 dark:bg-violet-950/20">
            <Mono value="TG · General" accent />
            <Mono value="CG1" accent />
            <Description
                title="Resumen del TG General"
                detail="Carga acumulada de todos los módulos conectados"
            />
            <Mono value="0" />
            <Mono value="0" />
            <Mono value={installedPowerW.toFixed(0)} />
            <Edit
                value={data.settings.defaultPowerFactor}
                onChange={(value) =>
                    onUpdate({ defaultPowerFactor: Math.min(1, value) })
                }
            />
            <Mono value="1.00" />
            <Mono value={(installedPowerW / 1000).toFixed(2)} strong />
            <Mono value={(demandPowerW / 1000).toFixed(2)} strong />
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
            <Mono value={theoreticalDesignCurrentA.toFixed(2)} />
            <Mono value={currentA.toFixed(2)} />
            <Mono value={data.settings.phases === 3 ? 'RST' : 'R'} />
            <Mono value={phaseCurrentR.toFixed(2)} />
            <Mono value={phaseCurrentS.toFixed(2)} />
            <Mono value={phaseCurrentT.toFixed(2)} />
            <Mono value="—" />
            <Edit
                value={data.settings.workingTemperatureC}
                onChange={(value) => onUpdate({ workingTemperatureC: value })}
            />
            <Mono value="1" />
            <Mono value="1.00" />
            <Mono value="1.00" />
            <Mono value="—" />
            <Conform ok={ok} />
            <Mono value="—" />
            <Mono value="—" />
            <Mono value="0.00" />
            <Mono value="0.00" />
            <Mono value="0.00" />
            <Mono value="—" />
            <Mono value="0.00" />
            <Mono value="0.00%" strong />
            <Conform ok={ok} />
            <Mono value="—" />
            <Mono value="—" />
            <Mono value="—" />
        </tr>
    );
}

function FeederRow({
    edge,
    result,
    moduleName,
    levelName,
    panelLabel,
    sourceLabel,
    panelKind,
    rowSpan,
    phases,
    onUpdate,
    onRemove,
    onSelect,
}: {
    edge: ElectricalEdge;
    result: EdgeCalculation;
    moduleName: string;
    levelName: string;
    panelLabel: string;
    sourceLabel: string;
    panelKind: string;
    rowSpan: number;
    phases: 1 | 3;
    onUpdate: Props['onUpdateEdge'];
    onRemove: Props['onRemove'];
    onSelect: Props['onSelect'];
}) {
    return (
        <tr
            className="border-t border-slate-300 bg-violet-50/70 align-top dark:border-slate-700 dark:bg-violet-950/15"
            onClick={() => onSelect(edge.id)}
        >
            <td
                rowSpan={rowSpan}
                className="border-r border-slate-300 px-3 py-3 text-center align-middle dark:border-slate-700"
            >
                <span className="rounded bg-cyan-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {panelKind}
                </span>
                <p className="mt-1 font-semibold">{panelLabel}</p>
                <button
                    type="button"
                    title="Desconectar alimentador"
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemove(edge.id);
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded border border-rose-400 px-1.5 py-1 text-[8px] text-rose-500"
                >
                    <Link2Off className="h-3 w-3" /> Desconectar
                </button>
                <p className="text-[8px] text-slate-500">
                    {moduleName} · {levelName}
                </p>
                <p className="mt-1 text-[8px] text-cyan-600 dark:text-cyan-400">
                    Alimentado por {sourceLabel}
                </p>
            </td>
            <Mono value="AG" accent />
            <Description
                title={`${sourceLabel} → ${panelLabel}`}
                detail={`Alimentador · H ${edge.horizontalLengthM.toFixed(2)} m + V ${edge.verticalLengthM.toFixed(2)} m = ${(edge.horizontalLengthM + edge.verticalLengthM).toFixed(2)} m`}
            />
            <Mono value="0" />
            <Mono value="0" />
            <Mono value={result.installedPowerW.toFixed(0)} />
            <Mono value={(edge.powerFactor ?? 0.9).toFixed(2)} />
            <Mono value={(edge.demandFactor ?? 1).toFixed(2)} />
            <Mono value={(result.installedPowerW / 1000).toFixed(2)} strong />
            <Mono value={(result.demandPowerW / 1000).toFixed(2)} strong />
            <Mono value={phases === 3 ? '3Φ+N+T' : '1Φ+N+T'} />
            <Mono value={result.designCurrentA.toFixed(2)} />
            <Mono value={result.currentA.toFixed(2)} />
            <Mono value="—" />
            <Mono value="—" />
            <Mono value="—" />
            <Mono value="—" />
            <Mono value={result.ampacityA?.toFixed(2) ?? '—'} />
            <Mono value="20" />
            <Mono value="1" />
            <Mono value="1.00" />
            <Mono value="1.00" />
            <Mono value={result.ampacityA?.toFixed(2) ?? '—'} />
            <Conform ok={result.status !== 'non_compliant'} />
            <Mono value={`${result.breakerA} A`} />
            <Mono value="—" />
            <Edit
                value={edge.horizontalLengthM}
                onChange={(value) =>
                    onUpdate(edge.id, { horizontalLengthM: value })
                }
                suffix="m"
            />
            <Edit
                value={edge.verticalLengthM}
                onChange={(value) =>
                    onUpdate(edge.id, { verticalLengthM: value })
                }
                suffix="m"
            />
            <Mono value={result.lengthM.toFixed(2)} />
            <Edit
                value={edge.sectionMm2}
                onChange={(value) => onUpdate(edge.id, { sectionMm2: value })}
                suffix="mm²"
            />
            <Mono value={result.ownVoltageDropV.toFixed(2)} />
            <Mono
                value={`${result.accumulatedVoltageDropPercent.toFixed(2)}%`}
            />
            <Conform
                ok={result.status === 'complete' || result.status === 'warning'}
            />
            <Mono value="—" />
            <td className="px-2 py-2">
                <input
                    value={edge.conductorType}
                    onChange={(event) =>
                        onUpdate(edge.id, { conductorType: event.target.value })
                    }
                    className="h-8 w-24 rounded border border-slate-300 bg-white px-2 dark:border-white/15 dark:bg-[#182237]"
                />
            </td>
            <Mono value={edge.earthSectionMm2?.toFixed(1) ?? '—'} />
        </tr>
    );
}

function CircuitRow({
    circuit,
    onUpdate,
}: {
    circuit: ModuleCtCircuit;
    onUpdate: Props['onUpdateCircuit'];
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
            <Mono
                value={circuit.isPanelSummary ? 'CG1' : circuit.code}
                accent
            />
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
                    value={circuit.forcePowerW}
                    onChange={(value) =>
                        onUpdate(circuit, { forcePowerW: value })
                    }
                />
            )}
            <Edit
                value={circuit.powerFactor}
                onChange={(value) =>
                    onUpdate(circuit, { powerFactor: Math.min(1, value) })
                }
            />
            <Edit
                value={circuit.demandFactor}
                onChange={(value) =>
                    onUpdate(circuit, { demandFactor: Math.min(1, value) })
                }
            />
            <Mono value={circuit.installedPowerKw.toFixed(2)} strong />
            <Mono value={circuit.maximumDemandKw.toFixed(2)} strong />
            <SelectCell
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
                value={circuit.ambientTemperatureC}
                onChange={(value) =>
                    onUpdate(circuit, { ambientTemperatureC: value })
                }
            />
            <Edit
                value={circuit.groupedCircuitCount}
                onChange={(value) =>
                    onUpdate(circuit, {
                        groupedCircuitCount: Math.max(1, Math.round(value)),
                    })
                }
            />
            <Edit
                value={circuit.groupingFactor}
                onChange={(value) =>
                    onUpdate(circuit, { groupingFactor: value })
                }
            />
            <Edit
                value={circuit.temperatureFactor}
                onChange={(value) =>
                    onUpdate(circuit, { temperatureFactor: value })
                }
            />
            <Mono value={circuit.admissibleCableCurrentA.toFixed(2)} />
            <Conform ok={circuit.capacityConforms} />
            <SelectCell
                value={protectionValue(circuit.itm)}
                options={ITM_OPTIONS}
                onChange={(value) => onUpdate(circuit, { itm: value })}
            />
            <SelectCell
                value={protectionValue(circuit.dif)}
                options={DIF_OPTIONS}
                onChange={(value) => onUpdate(circuit, { dif: value })}
            />
            <Mono value={circuit.horizontalLengthM.toFixed(2)} />
            <Mono value={circuit.verticalLengthM.toFixed(2)} />
            <Mono value={circuit.lengthM.toFixed(2)} />
            <SelectCell
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
                value={circuit.conductorType}
                options={CONDUCTOR_TYPE_OPTIONS}
                onChange={(value) =>
                    onUpdate(circuit, { conductorType: value })
                }
            />
            <SelectCell
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
}: {
    value: number;
    onChange: (value: number) => void;
    suffix?: string;
}) {
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
}: {
    value: string;
    options: Array<[string, string]>;
    onChange: (value: string) => void;
}) {
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
