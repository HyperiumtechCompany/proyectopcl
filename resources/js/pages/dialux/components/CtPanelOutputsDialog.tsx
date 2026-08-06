import { Check, ChevronDown, ChevronRight, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    resolveConformingSectionMm2,
    type PanelCircuitSummary,
    type RoomWireSummary,
    type RoomOutletValidation,
} from '@/pages/dialux/hooks/wireLengthCalculations';
import { CONDUCTOR_SECTION_OPTIONS, type Conductor } from '@/pages/dialux/hooks/types';

interface SelectedRoomSummary {
    name: string;
    wire: RoomWireSummary;
}

interface CtPanelOutputsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    circuits: PanelCircuitSummary[];
    outletValidations?: RoomOutletValidation[];
    loading?: boolean;
    selectedRoom?: SelectedRoomSummary | null;
    onUpdateCircuit?: (
        levelId: string,
        conductorId: string,
        patch: Partial<NonNullable<Conductor['ct']>>,
    ) => void;
    /** Cambia la sección (mm²) del conductor raíz de una salida. */
    onFixSection?: (
        levelId: string,
        conductorId: string,
        sectionMm2: number,
    ) => void;
    /**
     * Corrige TODO el árbol de tableros (todos los pisos): sube en cascada
     * la sección de cada salida no conforme, respetando que arreglar un
     * alimentador cambia el ΔV heredado de sus tableros hijos.
     */
    onFixTree?: () => void;
}

function groupByKey<T>(
    items: T[],
    keyFor: (item: T) => string,
): Array<[string, T[]]> {
    const groups = new Map<string, T[]>();
    items.forEach((item) => {
        const key = keyFor(item);
        groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    return [...groups.entries()];
}

function panelIsConforming(circuits: PanelCircuitSummary[]): boolean {
    return (
        circuits.length > 0 &&
        circuits.every(
            (circuit) =>
                circuit.voltageDropOk &&
                circuit.sectionMm2 > 0 &&
                circuit.installedPowerW > 0 &&
                !circuit.normativeViolation,
        )
    );
}

const CIRCUIT_TYPE_LABELS: Record<PanelCircuitSummary['circuitLoadType'], { label: string; className: string }> = {
    lighting: { label: 'Alumbrado', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    outlet: { label: 'Tomacorriente', className: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
    feeder: { label: 'Alimentador', className: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
    mixed: { label: 'Mixto (no cumple)', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
    unclassified: { label: 'Sin carga', className: 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400' },
};

function CircuitTypeBadge({ type }: { type: PanelCircuitSummary['circuitLoadType'] }) {
    const meta = CIRCUIT_TYPE_LABELS[type];
    return (
        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap ${meta.className}`}>
            {meta.label}
        </span>
    );
}

export function CtPanelOutputsDialog({
    open,
    onOpenChange,
    circuits,
    outletValidations,
    loading = false,
    selectedRoom,
    onUpdateCircuit,
    onFixSection,
    onFixTree,
}: CtPanelOutputsDialogProps) {
    const [verifiedPanelKey, setVerifiedPanelKey] = useState<string | null>(null);
    const [autoFixedCount, setAutoFixedCount] = useState<number | null>(null);
    const [treeFixApplied, setTreeFixApplied] = useState(false);

    const nonCompliantCount = circuits.filter(
        (circuit) => circuit.normativeViolation || !circuit.voltageDropOk || !circuit.capacityConforms,
    ).length;

    const runTreeFix = () => {
        onFixTree?.();
        setTreeFixApplied(true);
    };

    const verifyAndFixPanel = (
        levelId: string,
        panelKey: string,
        panelCircuits: PanelCircuitSummary[],
    ) => {
        setVerifiedPanelKey(panelKey);
        let fixedCount = 0;
        panelCircuits.forEach((circuit) => {
            if (circuit.voltageDropOk && circuit.capacityConforms) return;
            const nextSection = resolveConformingSectionMm2(circuit);
            if (nextSection > circuit.sectionMm2) {
                fixedCount += 1;
                onFixSection?.(levelId, circuit.rootConductorId, nextSection);
            }
        });
        setAutoFixedCount(fixedCount > 0 ? fixedCount : null);
    };
    const [expandedLevelIds, setExpandedLevelIds] = useState<Set<string>>(
        new Set(),
    );
    const levels = useMemo(
        () => groupByKey(circuits, (circuit) => circuit.levelId),
        [circuits],
    );
    const mainPanelCount = new Set(
        circuits
            .filter((circuit) => circuit.panelType === 'main_panel')
            .map((circuit) => `${circuit.levelId}-${circuit.panelId}`),
    ).size;
    const distributionPanelCount = new Set(
        circuits
            .filter((circuit) => circuit.panelType === 'sub_panel')
            .map((circuit) => `${circuit.levelId}-${circuit.panelId}`),
    ).size;
    useEffect(() => {
        const firstLevelId = levels[0]?.[0];
        if (!open || !firstLevelId) return;
        setExpandedLevelIds((current) =>
            current.size > 0 ? current : new Set([firstLevelId]),
        );
    }, [levels, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[96dvh] w-[calc(100vw-0.75rem)] max-w-[1900px] flex-col overflow-hidden p-0 text-slate-900 dark:text-slate-100 sm:h-[94dvh] sm:w-[98vw] sm:max-w-[1900px]">
                <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-4 pr-12 text-left dark:border-slate-800 sm:px-6">
                    <DialogTitle>Cálculo CT — salidas de tableros</DialogTitle>
                    <DialogDescription>
                        Estructura eléctrica TG → TD → circuitos, con carga acumulada y longitud real de cada alimentador o salida.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 text-xs sm:p-5">
                    {loading && (
                        <div className="flex items-center gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-200">
                            <LoaderCircle size={18} className="animate-spin" />
                            <div>
                                <p className="font-semibold">Calculando salidas CT…</p>
                                <p className="text-[10px] opacity-75">
                                    Procesando los pisos sin bloquear el modal.
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <SummaryCard label="Tableros generales" value={mainPanelCount} />
                        <SummaryCard label="Tableros de distribución" value={distributionPanelCount} />
                        <SummaryCard label="Salidas calculadas" value={circuits.length} />
                        <SummaryCard
                            label="Carga acumulada"
                            value={`${(
                                circuits
                                    .filter((circuit) => circuit.panelType === 'main_panel')
                                    .reduce((total, circuit) => total + circuit.installedPowerW, 0) /
                                1000
                            ).toFixed(2)} kW`}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-900/50 dark:bg-cyan-950/30">
                        <button
                            type="button"
                            onClick={runTreeFix}
                            className="inline-flex items-center gap-1.5 rounded bg-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-cyan-500"
                        >
                            <Check size={13} />
                            Verificar y corregir todo el árbol
                        </button>
                        <p className="text-[10px] text-cyan-800 dark:text-cyan-200">
                            Sube en cascada la sección de cada salida no conforme en todos los
                            pisos (TG→TD→circuitos) — arreglar un alimentador puede hacer que sus
                            tableros hijos pasen a cumplir sin tocarlos.
                        </p>
                        {treeFixApplied && (
                            <p
                                className={
                                    nonCompliantCount === 0
                                        ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                                        : 'font-semibold text-amber-600 dark:text-amber-400'
                                }
                            >
                                {nonCompliantCount === 0
                                    ? 'Todo el árbol cumple.'
                                    : `${nonCompliantCount} salida(s) siguen sin cumplir (revisa mezclas alumbrado/tomacorriente o el calibre máximo disponible).`}
                            </p>
                        )}
                    </div>

                    {selectedRoom && (
                        <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50 sm:grid-cols-3">
                            <DataItem label="Ambiente seleccionado" value={selectedRoom.name} />
                            <DataItem
                                label="Puntos / conductores"
                                value={`${selectedRoom.wire.pointCount} / ${selectedRoom.wire.conductorCount}`}
                                mono
                            />
                            <DataItem
                                label="Cable asociado"
                                value={`${selectedRoom.wire.totalLength.toFixed(2)} m`}
                                mono
                                accent
                            />
                        </div>
                    )}

                    {outletValidations && outletValidations.length > 0 && (
                        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                            <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-200">
                                Validación de Tomacorrientes por Normativa
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-[11px] whitespace-nowrap">
                                    <thead className="bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider dark:bg-slate-900/50 dark:text-slate-400">
                                        <tr>
                                            <th className="px-3 py-2">Ambiente</th>
                                            <th className="px-3 py-2">Área / Perím.</th>
                                            <th className="px-3 py-2">Uso</th>
                                            <th className="px-3 py-2 text-center">Req. (CNE)</th>
                                            <th className="px-3 py-2 text-center">Instalados</th>
                                            <th className="px-3 py-2">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {outletValidations.map(validation => (
                                            <tr key={validation.roomId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                                                <td className="px-3 py-2 font-medium">{validation.roomName}</td>
                                                <td className="px-3 py-2 font-mono text-slate-500">{validation.outletUse === 'exterior' ? `${validation.perimeter.toFixed(2)} m` : `${validation.area.toFixed(2)} m²`}</td>
                                                <td className="px-3 py-2 capitalize">{validation.outletUse}</td>
                                                <td className="px-3 py-2 text-center font-mono">{validation.requiredOutlets}</td>
                                                <td className="px-3 py-2 text-center font-mono">{validation.installedOutlets}</td>
                                                <td className="px-3 py-2">
                                                    {validation.installedOutlets >= validation.requiredOutlets ? (
                                                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                                            <Check size={10} /> OK
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                                                            Faltan {validation.requiredOutlets - validation.installedOutlets}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {levels.map(([levelId, levelCircuits]) => (
                        <section
                            key={levelId}
                            className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() =>
                                    setExpandedLevelIds((current) => {
                                        const next = new Set(current);
                                        if (next.has(levelId)) next.delete(levelId);
                                        else next.add(levelId);
                                        return next;
                                    })
                                }
                                className="flex w-full items-center justify-between gap-3 border-b border-cyan-200 bg-cyan-50 px-3 py-2 text-left dark:border-cyan-900/50 dark:bg-cyan-950/30">
                                <span>
                                    <span className="block font-semibold text-cyan-800 dark:text-cyan-200">
                                        {levelCircuits[0]?.levelName}
                                    </span>
                                    <span className="block text-[10px] text-slate-500">
                                        {levelCircuits.length} salida(s) en este nivel
                                    </span>
                                </span>
                                {expandedLevelIds.has(levelId) ? (
                                    <ChevronDown size={16} />
                                ) : (
                                    <ChevronRight size={16} />
                                )}
                            </button>

                            {expandedLevelIds.has(levelId) && (
                            <div className="overflow-x-auto [content-visibility:auto]">
                                <table className="w-full min-w-[3600px] text-left">
                                    <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2">Jerarquía / tablero</th>
                                            <th className="px-3 py-2">CT</th>
                                            <th className="px-3 py-2">Tipo</th>
                                            <th className="px-3 py-2">Carga atendida</th>
                                            <th className="px-3 py-2">Ruta por ambientes</th>
                                            <th className="px-3 py-2">PI alum. (W)</th>
                                            <th className="px-3 py-2">PI tomas (W)</th>
                                            <th className="px-3 py-2"># Lumin.</th>
                                            <th className="px-3 py-2"># Tomas</th>
                                            <th className="px-3 py-2">Cable rec.</th>
                                            <th className="px-3 py-2">PI fuerza (W)</th>
                                            <th className="px-3 py-2">F. potencia</th>
                                            <th className="px-3 py-2">PI total (kW)</th>
                                            <th className="px-3 py-2">FS</th>
                                            <th className="px-3 py-2">MD (kW)</th>
                                            <th className="px-3 py-2">Sistema</th>
                                            <th className="px-3 py-2">Id teórica</th>
                                            <th className="px-3 py-2">In total</th>
                                            <th className="px-3 py-2">Balanceo</th>
                                            <th className="px-3 py-2">R (A)</th>
                                            <th className="px-3 py-2">S (A)</th>
                                            <th className="px-3 py-2">T (A)</th>
                                            <th className="px-3 py-2">Inom cable</th>
                                            <th className="px-3 py-2">T. amb.</th>
                                            <th className="px-3 py-2">N.º agrup.</th>
                                            <th className="px-3 py-2">K agrup.</th>
                                            <th className="px-3 py-2">K2 temp.</th>
                                            <th className="px-3 py-2">Iadm</th>
                                            <th className="px-3 py-2">Capacidad</th>
                                            <th className="px-3 py-2">ITM</th>
                                            <th className="px-3 py-2">DIF</th>
                                            <th className="px-3 py-2">L. horizontal</th>
                                            <th className="px-3 py-2">L. vertical</th>
                                            <th className="px-3 py-2">L. total</th>
                                            <th className="px-3 py-2">Sección</th>
                                            <th className="px-3 py-2">ΔV (V)</th>
                                            <th className="px-3 py-2">ΔV (%)</th>
                                            <th className="px-3 py-2">Estado</th>
                                            <th className="px-3 py-2">Ø tubo</th>
                                            <th className="px-3 py-2">Conductor</th>
                                            <th className="px-3 py-2">Tierra</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupByKey(
                                            levelCircuits,
                                            (circuit) => circuit.panelId,
                                        ).flatMap(([panelId, panelCircuits]) => {
                                            const panel = panelCircuits[0]!;
                                            const panelKey = `${levelId}-${panelId}`;
                                            const conforming = panelIsConforming(panelCircuits);

                                            return panelCircuits.map((circuit, index) => (
                                                <tr
                                                    key={`${panelId}-${circuit.rootConductorId}`}
                                                    className="border-t border-slate-200 align-top dark:border-slate-800">
                                                    {index === 0 && (
                                                        <td
                                                            rowSpan={panelCircuits.length}
                                                            className="border-r border-slate-200 px-3 py-3 dark:border-slate-800">
                                                            <div className="min-w-44 space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                                                        panel.panelType === 'main_panel'
                                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                                                            : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                                                                    }`}>
                                                                        {panel.panelType === 'main_panel' ? 'TG' : 'TD'}
                                                                    </span>
                                                                    <span className="font-semibold">{panel.panelLabel}</span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-500">
                                                                    Longitud asignada: <span className="font-mono">{panel.panelLengthM.toFixed(2)} m</span>
                                                                </p>
                                                                <p className="text-[10px] text-slate-500">
                                                                    {panel.voltageV} V · {panel.phases}Φ · {panel.connectionType === 'star' ? 'Estrella' : 'Delta'}
                                                                </p>
                                                                <p className="text-[10px] text-slate-500">
                                                                    fdis {panel.designFactor.toFixed(2)} · ρCuT {panel.copperResistivity.toFixed(4)}
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => verifyAndFixPanel(levelId, panelKey, panelCircuits)}
                                                                    className="inline-flex items-center gap-1.5 rounded border border-cyan-600 px-2 py-1 text-[10px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-200 dark:hover:bg-cyan-950/50">
                                                                    <Check size={11} />
                                                                    {panel.panelType === 'main_panel' ? 'Verificar TG' : 'Verificar TD'}
                                                                </button>
                                                                {verifiedPanelKey === panelKey && (
                                                                    <>
                                                                        <p className={conforming ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                                                                            {conforming
                                                                                ? `${panelCircuits.length} salida(s) conformes${autoFixedCount ? ` (sección aumentada en ${autoFixedCount})` : ''}`
                                                                                : `Sección aumentada al máximo disponible; aún hay ${panelCircuits.filter((c) => !c.voltageDropOk || !c.capacityConforms).length} salida(s) sin cumplir`}
                                                                        </p>
                                                                        {panelCircuits.some((c) => c.normativeViolation) && (
                                                                            <p className="text-red-600 dark:text-red-400">
                                                                                {panelCircuits.filter((c) => c.normativeViolation).length} salida(s) mezclan alumbrado y
                                                                                tomacorriente — la sección no arregla eso, hay que separar el cableado.
                                                                            </p>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-3 font-mono text-cyan-700 dark:text-cyan-300">
                                                        {circuit.code}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <CircuitTypeBadge type={circuit.circuitLoadType} />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        {circuit.fedPanelLabels.length > 0 && (
                                                            <p className="mb-1 font-semibold text-violet-600 dark:text-violet-300">
                                                                Alimenta: {circuit.fedPanelLabels.join(', ')}
                                                            </p>
                                                        )}
                                                        {circuit.normativeViolation && (
                                                            <p className="mb-1 max-w-64 rounded border border-red-300 bg-red-50 px-1.5 py-1 text-[10px] font-semibold leading-relaxed text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                                                                Mezcla alumbrado y tomacorriente en la misma
                                                                salida. Sepáralos en circuitos y tuberías
                                                                distintas (CNE-Utilización / RNE EM.010).
                                                            </p>
                                                        )}
                                                        {circuit.rooms.map((room) => (
                                                            <p key={room.roomId}>
                                                                <span className="font-medium">{room.roomName}</span>
                                                                <span className="text-slate-500"> · {room.detail || 'Sin potencia'}</span>
                                                            </p>
                                                        ))}
                                                        {circuit.rooms.length === 0 && 'Sin cargas finales'}
                                                    </td>
                                                    <MonoCell value={circuit.traversedRoomNames.join(' → ') || '—'} />
                                                    <MonoCell value={circuit.lightingPowerW.toFixed(0)} />
                                                    <MonoCell value={circuit.outletPowerW.toFixed(0)} />
                                                    <MonoCell value={circuit.lightingOutletCount.toString()} />
                                                    <MonoCell value={circuit.outletOutletCount.toString()} />
                                                    <MonoCell value={circuit.circuitLoadType === 'lighting' ? '2.5mm² (Nro.14)' : circuit.circuitLoadType === 'outlet' ? '4mm² (Nro.12)' : circuit.circuitLoadType === 'feeder' ? 'Alimentador' : 'Mixto'} />
                                                    <EditNumberCell
                                                        value={circuit.forcePowerW}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { forcePowerW: value })}
                                                    />
                                                    <EditNumberCell
                                                        value={circuit.powerFactor}
                                                        step={0.01}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { powerFactor: value })}
                                                    />
                                                    <MonoCell value={circuit.installedPowerKw.toFixed(2)} strong />
                                                    <EditNumberCell
                                                        value={circuit.demandFactor}
                                                        step={0.01}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { demandFactor: value })}
                                                    />
                                                    <MonoCell value={circuit.maximumDemandKw.toFixed(2)} />
                                                    <SelectCell
                                                        value={`${circuit.phases}`}
                                                        options={[['1', '1'], ['3', '3']]}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { system: Number(value) as 1 | 3 })}
                                                    />
                                                    <MonoCell value={`${circuit.theoreticalDesignCurrentA.toFixed(2)} A`} />
                                                    <MonoCell value={`${circuit.currentA.toFixed(2)} A`} />
                                                    <SelectCell
                                                        value={circuit.phaseBalance}
                                                        options={circuit.phases === 3 ? [['RST', 'RST']] : [['R', 'R'], ['S', 'S'], ['T', 'T']]}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { phaseBalance: value as 'R' | 'S' | 'T' | 'RST' })}
                                                    />
                                                    <MonoCell value={circuit.phaseCurrentR.toFixed(2)} />
                                                    <MonoCell value={circuit.phaseCurrentS.toFixed(2)} />
                                                    <MonoCell value={circuit.phaseCurrentT.toFixed(2)} />
                                                    <EditNumberCell
                                                        value={circuit.nominalCableCurrentA}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { nominalCableCurrentA: value })}
                                                    />
                                                    <EditNumberCell
                                                        value={circuit.ambientTemperatureC}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { ambientTemperatureC: value })}
                                                    />
                                                    <EditNumberCell
                                                        value={circuit.groupedCircuitCount}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { groupedCircuitCount: value })}
                                                    />
                                                    <EditNumberCell
                                                        value={circuit.groupingFactor}
                                                        step={0.01}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { groupingFactor: value })}
                                                    />
                                                    <EditNumberCell
                                                        value={circuit.temperatureFactor}
                                                        step={0.01}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { temperatureFactor: value })}
                                                    />
                                                    <MonoCell value={`${circuit.admissibleCableCurrentA.toFixed(2)} A`} />
                                                    <StatusCell ok={circuit.capacityConforms} okText="Conforme" failText="No conforme" />
                                                    <SelectCell
                                                        value={circuit.itm}
                                                        options={[['1x16 A', '1x16 A'], ['1x20 A', '1x20 A'], ['2x25 A', '2x25 A'], ['3x32 A', '3x32 A']]}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { itm: value })}
                                                    />
                                                    <SelectCell
                                                        value={circuit.dif}
                                                        options={[['2x25 A', '2x25 A'], ['2x40 A', '2x40 A'], ['2x63 A', '2x63 A']]}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { dif: value })}
                                                    />
                                                    <MonoCell value={`${circuit.horizontalLengthM.toFixed(2)} m`} />
                                                    <MonoCell value={`${circuit.verticalLengthM.toFixed(2)} m`} />
                                                    <td className="px-3 py-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                                        {circuit.lengthM.toFixed(2)} m
                                                        {circuit.lengthOverridden && (
                                                            <p className="text-[9px] font-normal text-cyan-600 dark:text-cyan-300">
                                                                Longitud manual del tablero
                                                            </p>
                                                        )}
                                                    </td>
                                                    <SelectCell
                                                        value={String(circuit.sectionMm2)}
                                                        options={CONDUCTOR_SECTION_OPTIONS.map(({ value, label }) => [String(value), label] as [string, string])}
                                                        onChange={(value) => onFixSection?.(levelId, circuit.rootConductorId, Number.parseFloat(value))}
                                                    />
                                                    <MonoCell value={`${circuit.voltageDropV.toFixed(2)} V`} />
                                                    <td className="px-3 py-3">
                                                        <p className={circuit.voltageDropOk ? 'font-mono font-semibold text-emerald-600 dark:text-emerald-400' : 'font-mono font-semibold text-red-600 dark:text-red-400'}>
                                                            {circuit.voltageDropPct.toFixed(2)} %
                                                        </p>
                                                        <p className="text-[10px] text-slate-500">
                                                            Máx. {circuit.maxVoltageDropPct.toFixed(1)} %
                                                        </p>
                                                    </td>
                                                    <StatusCell ok={circuit.voltageDropOk} okText="Cumple" failText="No cumple" />
                                                    <MonoCell value={`${circuit.tubeDiameterMm} mm`} />
                                                    <MonoCell value={circuit.conductorType || '—'} />
                                                    <EditNumberCell
                                                        value={circuit.earthSectionMm2}
                                                        onChange={(value) => onUpdateCircuit?.(levelId, circuit.rootConductorId, { earthSectionMm2: value })}
                                                    />
                                                </tr>
                                            ));
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            )}
                        </section>
                    ))}

                    {!loading && circuits.length === 0 && (
                        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
                            No hay salidas conectadas a un tablero general o tablero de distribución.
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
    );
}

function DataItem({
    label,
    value,
    mono = false,
    accent = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
    accent?: boolean;
}) {
    return (
        <div>
            <p className="text-slate-500">{label}</p>
            <p className={`${mono ? 'font-mono' : 'font-medium'} ${accent ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                {value}
            </p>
        </div>
    );
}

function MonoCell({
    value,
    strong = false,
}: {
    value: string;
    strong?: boolean;
}) {
    return (
        <td className={`px-3 py-3 font-mono ${strong ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
            {value}
        </td>
    );
}

function EditNumberCell({
    value,
    onChange,
    step = 1,
}: {
    value: number;
    onChange: (value: number) => void;
    step?: number;
}) {
    return (
        <td className="px-2 py-2">
            <input
                type="number"
                value={Number.isFinite(value) ? value : 0}
                min={0}
                step={step}
                onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) onChange(next);
                }}
                className="w-20 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
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
                className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                {options.map(([optionValue, label]) => (
                    <option key={optionValue} value={optionValue}>
                        {label}
                    </option>
                ))}
            </select>
        </td>
    );
}

function StatusCell({
    ok,
    okText,
    failText,
}: {
    ok: boolean;
    okText: string;
    failText: string;
}) {
    return (
        <td className={ok ? 'px-3 py-3 font-semibold text-emerald-600 dark:text-emerald-400' : 'px-3 py-3 font-semibold text-red-600 dark:text-red-400'}>
            {ok ? okText : failText}
        </td>
    );
}
