import React from 'react';
import { Check, AlertTriangle, ChevronDown, ChevronRight, LoaderCircle } from 'lucide-react';
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

const ITM_OPTIONS = [
    '1x10', '1x16', '1x20', '1x25', '1x32', '1x40', '1x50', '1x63',
    '2x10', '2x16', '2x20', '2x25', '2x32', '2x40', '2x50', '2x63',
    '3x10', '3x15', '3x16', '3x20', '3x25', '3x30', '3x32', '3x35', '3x40', '3x50', '3x60', '3x63', '3x70', '3x75', '3x80', '3x100', '3x125', '3x140', '3x150', '3x160', '3x175', '3x180', '3x200', '3x225', '3x250', '3x300', '3x320', '3x400', '3x500', '3x630',
    '4x16', '4x25', '4x40', '4x63', '4x80', '4x100', '4x125', '4x160', '4x200', '4x250', '4x320', '4x400', '4x500', '4x630',
].map((value) => [value, value] as [string, string]);
const DIF_OPTIONS = ['2x25', '2x40', '2x63', '4x25', '4x40', '4x63'].map((value) => [value, value] as [string, string]);
const EARTH_SECTION_OPTIONS = [2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120].map((value) => [value.toString(), value.toString()] as [string, string]);

function protectionValue(value: string): string {
    return value.replace(/\s*A$/i, '');
}

interface SelectedRoomSummary {
    name: string;
    wire: RoomWireSummary;
}

export type CtCircuitPatch = Partial<NonNullable<Conductor['ct']>> & {
    conductorType?: string;
    loadType?: PanelCircuitSummary['circuitLoadType'];
    designFactor?: number;
};

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
        patch: CtCircuitPatch,
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
    return Array.from(groups.entries());
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
                                            <tr key={validation.roomId} className="hover:bg-slate-50/50 dark:hover:bg-slate-200 dark:bg-slate-900/20">
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

                    <section className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="overflow-x-auto [content-visibility:auto]">
                            <table className="w-full min-w-[3500px] table-auto border-collapse text-left">
                                <thead className="bg-sky-700 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-sky-900">
                                    <tr className="divide-x divide-sky-500 border-b border-sky-400 text-center">
                                        <th rowSpan={2} className="min-w-28 px-3 py-2">Datos del tablero eléctrico</th>
                                        <th rowSpan={2} className="min-w-20 px-3 py-2">N.º circuito</th>
                                        <th rowSpan={2} className="min-w-72 px-3 py-2">Descripción del circuito eléctrico</th>
                                        <th rowSpan={2} className="px-3 py-2">PI (W) alum.</th>
                                        <th rowSpan={2} className="px-3 py-2">PI (W) tomas</th>
                                        <th rowSpan={2} className="px-3 py-2">PI (W) fuerza</th>
                                        <th rowSpan={2} className="px-3 py-2">Factor de potencia</th>
                                        <th rowSpan={2} className="px-3 py-2">FS tomac</th>
                                        <th rowSpan={2} className="px-3 py-2">P.I total (kW)</th>
                                        <th rowSpan={2} className="px-3 py-2">M.D (kW)</th>
                                        <th rowSpan={2} className="px-3 py-2">Sistema</th>
                                        <th rowSpan={2} className="px-3 py-2">Id teórica</th>
                                        <th rowSpan={2} className="px-3 py-2">In total</th>
                                        <th colSpan={4} className="px-3 py-2">Id total balanceada</th>
                                        <th rowSpan={2} className="px-3 py-2">Inom cable</th>
                                        <th rowSpan={2} className="px-3 py-2">T. amb. (°C)</th>
                                        <th rowSpan={2} className="px-3 py-2">N.º circuitos agrup.</th>
                                        <th rowSpan={2} className="px-3 py-2">Factor agrup. K1</th>
                                        <th rowSpan={2} className="px-3 py-2">Factor temp. K2</th>
                                        <th rowSpan={2} className="px-3 py-2">Iadm cable</th>
                                        <th rowSpan={2} className="px-3 py-2">Conformidad por capacidad</th>
                                        <th colSpan={2} className="px-3 py-2">Capacidad de las protecciones eléctricas</th>
                                        <th rowSpan={2} className="bg-lime-400 px-3 py-2 text-slate-950">Longitud horizontal (m)</th>
                                        <th rowSpan={2} className="bg-lime-400 px-3 py-2 text-slate-950">Longitud vertical (m)</th>
                                        <th rowSpan={2} className="bg-lime-400 px-3 py-2 text-slate-950">Longitud total (m)</th>
                                        <th rowSpan={2} className="px-3 py-2">Sección del conductor</th>
                                        <th rowSpan={2} className="px-3 py-2">Delta V (V)</th>
                                        <th rowSpan={2} className="px-3 py-2">Delta V (%)</th>
                                        <th rowSpan={2} className="px-3 py-2">&lt;4% final / &lt;2.5% aliment.</th>
                                        <th rowSpan={2} className="px-3 py-2">Diámetro del tubo</th>
                                        <th rowSpan={2} className="px-3 py-2">Tipo de conductor</th>
                                        <th rowSpan={2} className="px-3 py-2">Sección conductor a tierra</th>
                                    </tr>
                                    <tr className="divide-x divide-sky-500 border-b border-sky-400 text-center">
                                        <th className="px-3 py-1.5">Balanceo</th>
                                        <th className="px-3 py-1.5">R</th>
                                        <th className="px-3 py-1.5">S</th>
                                        <th className="px-3 py-1.5">T</th>
                                        <th className="px-3 py-1.5">ITM</th>
                                        <th className="px-3 py-1.5">DIF</th>
                                    </tr>
                                </thead>
                                
                                
                                
                                <tbody>
                                    {/* 1. SECCIONES POR PISO (Tableros de Distribución) */}
                                    {levels.map(([levelId, levelCircuits]) => {
                                        // Filtramos los que NO son main_panel
                                        const levelName = levelCircuits[0]?.levelName ?? levelId;
                                        const distributionCircuits = levelCircuits.filter(c => c.panelType !== 'main_panel');
                                        if (distributionCircuits.length === 0) return null;

                                        // Agrupar por panelId
                                        const panelsInLevel = groupByKey(distributionCircuits, c => c.panelId)
                                            .sort((a, b) => a[1][0]!.panelLabel.localeCompare(b[1][0]!.panelLabel));

                                        return (
                                            <React.Fragment key={levelId}>
                                                <tr className="bg-slate-700 text-white">
                                                        <td colSpan={36} className="px-3 py-1 font-bold">
                                                        {levelName}
                                                    </td>
                                                </tr>
                                                {panelsInLevel.flatMap(([, panelCircuits]) => {
                                                    const summaryCircuit = panelCircuits.find(c => c.isPanelSummary);
                                                    const normalCircuits = panelCircuits.filter(c => !c.isPanelSummary);
                                                    
                                                    const rows: React.ReactNode[] = [];
                                                    
                                                    // 1. Filas C normales (Circuitos primero)
                                                    if (normalCircuits.length > 0) {
                                                        normalCircuits.forEach((circuit, circuitIndex) => {
                                                            rows.push(
                                                                <tr key={`circuit-${circuit.rootConductorId}`} className="border-t border-slate-200 align-top dark:border-slate-800">
                                                                    {circuitIndex === 0 && (
                                                                        <td rowSpan={normalCircuits.length} className="border-r border-slate-200 bg-violet-50/80 px-3 py-3 align-middle text-center dark:border-slate-800 dark:bg-violet-950/20">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                                                                TD
                                                                            </span>
                                                                            <span className="font-semibold text-slate-700 dark:text-slate-300">{circuit.panelLabel}</span>
                                                                        </div>
                                                                        </td>
                                                                    )}
                                                                    <td className="border-r border-slate-200 bg-emerald-50/80 px-3 py-3 font-mono font-bold text-emerald-700 dark:border-slate-800 dark:bg-emerald-950/20 dark:text-emerald-300">
                                                                        {circuit.code}
                                                                    </td>
                                                                    <td className="min-w-72 px-3 py-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <CircuitTypeBadge type={circuit.circuitLoadType} />
                                                                            <SelectCellContent value={circuit.circuitLoadType} options={[['lighting', 'Alumbrado'], ['outlet', 'Tomacorriente'], ['mixed', 'Mixto']]} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { loadType: value as CtCircuitPatch['loadType'] })} />
                                                                        </div>
                                                                        {circuit.fedPanelLabels.length > 0 && <p className="mt-1 font-semibold text-violet-600 dark:text-violet-300">Alimenta: {circuit.fedPanelLabels.join(', ')}</p>}
                                                                        {circuit.rooms.map((room) => <p key={room.roomId} className="mt-1"><span className="font-medium">{room.roomName}</span><span className="text-slate-500"> · {room.detail || 'Sin potencia'}</span></p>)}
                                                                        <p className="mt-1 text-[9px] text-slate-500">{circuit.lightingOutletCount} lumin. · {circuit.outletOutletCount} tomas · {circuit.traversedRoomNames.join(' → ') || 'Sin ruta'}</p>
                                                                    </td>
                                                                    <MonoCell value={circuit.lightingPowerW.toFixed(0)} />
                                                                    <MonoCell value={circuit.outletPowerW.toFixed(0)} />
                                                                    <EditNumberCell value={circuit.forcePowerW} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { forcePowerW: value })} />
                                                                    <EditNumberCell value={circuit.powerFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { powerFactor: value })} />
                                                                    <EditNumberCell value={circuit.demandFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { demandFactor: value })} />
                                                                    <MonoCell value={circuit.installedPowerKw.toFixed(2)} strong />
                                                                    <MonoCell value={circuit.maximumDemandKw.toFixed(2)} strong />
                                                                    <SelectCell value={circuit.phases.toString()} options={[['1', '1Φ+N+T'], ['3', '3Φ+N+T']]} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { system: Number(value) as 1 | 3 })} />
                                                                    <MonoCell value={circuit.theoreticalDesignCurrentA.toFixed(2)} />
                                                                    <MonoCell value={circuit.currentA.toFixed(2)} />
                                                                    <SelectCell value={circuit.phaseBalance} options={[['R', 'R'], ['S', 'S'], ['T', 'T'], ['RS', 'RS'], ['ST', 'ST'], ['TR', 'TR'], ['RST', 'RST']]} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { phaseBalance: value as PanelCircuitSummary['phaseBalance'] })} />
                                                                    <MonoCell value={circuit.phaseCurrentR.toFixed(2)} />
                                                                    <MonoCell value={circuit.phaseCurrentS.toFixed(2)} />
                                                                    <MonoCell value={circuit.phaseCurrentT.toFixed(2)} />
                                                                    <MonoCell value={circuit.nominalCableCurrentA.toFixed(2)} />
                                                                    <EditNumberCell value={circuit.ambientTemperatureC} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { ambientTemperatureC: value })} />
                                                                    <EditNumberCell value={circuit.groupedCircuitCount} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { groupedCircuitCount: value })} />
                                                                    <EditNumberCell value={circuit.groupingFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { groupingFactor: value })} />
                                                                    <EditNumberCell value={circuit.temperatureFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { temperatureFactor: value })} />
                                                                    <MonoCell value={circuit.admissibleCableCurrentA.toFixed(2)} />
                                                                    <td className="px-3 py-3 text-center">{circuit.capacityConforms ? <Check size={14} className="mx-auto text-emerald-500" /> : <AlertTriangle size={14} className="mx-auto text-amber-500" />}</td>
                                                                    <SelectCell value={protectionValue(circuit.itm)} options={ITM_OPTIONS} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { itm: value })} />
                                                                    <SelectCell value={protectionValue(circuit.dif)} options={DIF_OPTIONS} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { dif: value })} />
                                                                    <LengthCells circuit={circuit} />
                                                                    <SelectCell value={circuit.sectionMm2.toString()} options={CONDUCTOR_SECTION_OPTIONS.map(opt => [opt.value.toString(), opt.label])} onChange={(val) => onFixSection?.(circuit.levelId, circuit.rootConductorId, Number(val))} />
                                                                    <MonoCell value={circuit.voltageDropV?.toFixed(2) ?? '0.00'} />
                                                                    <td className="px-3 py-3"><span className={circuit.voltageDropOk ? 'text-emerald-600 font-semibold' : 'text-red-600 font-bold'}>{circuit.voltageDropPct?.toFixed(2) ?? '0.00'}%</span></td>
                                                                    <td className="px-3 py-3">{circuit.voltageDropOk && circuit.capacityConforms ? <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><Check size={10} /> OK</span> : <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Revisar</span>}</td>
                                                                    <MonoCell value={`${circuit.tubeDiameterMm} mm`} />
                                                                    <SelectCell value={circuit.conductorType} options={[['TW', 'TW'], ['THW', 'THW'], ['NYY', 'NYY'], ['LSOH-80', 'LSOH-80'], ['LSOH-90', 'LSOH-90'], ['N2X0H', 'N2X0H']]} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { conductorType: value })} />
                                                                    <SelectCell value={circuit.earthSectionMm2.toString()} options={EARTH_SECTION_OPTIONS} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { earthSectionMm2: Number(value) })} />
                                                                </tr>
                                                            );
                                                        });
                                                    }
                                                    
                                                    // 2. Fila resumen del TD (al final)
                                                    if (summaryCircuit) {
                                                        const circuit = summaryCircuit;
                                                        rows.push(
                                                            <tr key={`td-summary-${circuit.rootConductorId}`} className="border-b-4 border-t-2 border-slate-300 align-top dark:border-slate-700 bg-blue-50/50 font-bold dark:bg-blue-900/20">
                                                                 <td className="border-r border-slate-200 bg-blue-100 px-3 py-3 text-center dark:border-slate-800 dark:bg-blue-900/30">
                                                                    <div className="min-w-44 space-y-2">
                                                                        <div className="flex items-center gap-2">
                                                                             <span className="font-mono text-xs font-bold text-blue-900 dark:text-blue-100">
                                                                                 TD
                                                                            </span>
                                                                        </div>
                                                                     </div>
                                                                 </td>
                                                                <td className="border-r border-slate-200 bg-emerald-50/80 px-3 py-3 font-mono font-bold text-emerald-700 dark:border-slate-800 dark:bg-emerald-950/20 dark:text-emerald-300">CG1</td>
                                                                <td className="min-w-72 px-3 py-3">
                                                                    <p className="font-semibold text-slate-700 dark:text-slate-200">Resumen del tablero {circuit.panelLabel}</p>
                                                                    <p className="mt-1 text-[9px] text-slate-500">Alimentador · {circuit.traversedRoomNames.join(' → ') || 'Sin ruta'}</p>
                                                                </td>
                                                                <MonoCell value={circuit.upstreamVoltageDropV.toFixed(2)} />
                                                                <MonoCell value={circuit.outletPowerW.toFixed(0)} />
                                                                <MonoCell value={circuit.forcePowerW.toFixed(0)} />
                                                                <EditNumberCell value={circuit.powerFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, `synthetic-feeder-${circuit.panelId}`, { powerFactor: value })} />
                                                                <EditNumberCell value={circuit.demandFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, `synthetic-feeder-${circuit.panelId}`, { demandFactor: value })} />
                                                                <MonoCell value={circuit.installedPowerKw.toFixed(2)} strong />
                                                                <MonoCell value={circuit.maximumDemandKw.toFixed(2)} strong />
                                                                <SelectCell value={circuit.phases.toString()} options={[['1', '1Φ+N+T'], ['3', '3Φ+N+T']]} onChange={(value) => onUpdateCircuit?.(circuit.levelId, `synthetic-feeder-${circuit.panelId}`, { system: Number(value) as 1 | 3 })} />
                                                                <MonoCell value={circuit.theoreticalDesignCurrentA.toFixed(2)} />
                                                                <MonoCell value={circuit.currentA.toFixed(2)} />
                                                                <SelectCell value={circuit.phaseBalance} options={[['R', 'R'], ['S', 'S'], ['T', 'T'], ['RS', 'RS'], ['ST', 'ST'], ['TR', 'TR'], ['RST', 'RST']]} onChange={(value) => onUpdateCircuit?.(circuit.levelId, `synthetic-feeder-${circuit.panelId}`, { phaseBalance: value as PanelCircuitSummary['phaseBalance'] })} />
                                                                <MonoCell value={circuit.phaseCurrentR.toFixed(2)} />
                                                                <MonoCell value={circuit.phaseCurrentS.toFixed(2)} />
                                                                <MonoCell value={circuit.phaseCurrentT.toFixed(2)} />
                                                                <MonoCell value={circuit.nominalCableCurrentA.toFixed(2)} />
                                                                <EditNumberCell value={circuit.ambientTemperatureC} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { ambientTemperatureC: value })} />
                                                                <EditNumberCell value={circuit.groupedCircuitCount} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { groupedCircuitCount: value })} />
                                                                <EditNumberCell value={circuit.groupingFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { groupingFactor: value })} />
                                                                <EditNumberCell value={circuit.temperatureFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { temperatureFactor: value })} />
                                                                <MonoCell value={circuit.admissibleCableCurrentA.toFixed(2)} />
                                                                <td className="px-3 py-3 text-center">{circuit.capacityConforms ? <Check size={14} className="mx-auto text-emerald-500" /> : <AlertTriangle size={14} className="mx-auto text-amber-500" />}</td>
                                                                <SelectCell value={protectionValue(circuit.itm)} options={ITM_OPTIONS} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { itm: value })} />
                                                                <SelectCell value={protectionValue(circuit.dif)} options={DIF_OPTIONS} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { dif: value })} />
                                                                <LengthCells circuit={circuit} />
                                                                <SelectCell value={circuit.sectionMm2.toString()} options={CONDUCTOR_SECTION_OPTIONS.map(opt => [opt.value.toString(), opt.label])} onChange={(val) => onFixSection?.(circuit.levelId, circuit.rootConductorId, Number(val))} />
                                                                <MonoCell value={circuit.voltageDropV.toFixed(2)} />
                                                                <td className="px-3 py-3"><span className={circuit.voltageDropOk ? 'text-emerald-600 font-semibold' : 'text-red-600 font-bold'}>{circuit.voltageDropPct.toFixed(2)}%</span></td>
                                                                <td className="px-3 py-3">{circuit.voltageDropOk && circuit.capacityConforms ? <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><Check size={10} /> OK</span> : <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Revisar</span>}</td>
                                                                <MonoCell value={`${circuit.tubeDiameterMm} mm`} />
                                                                <SelectCell value={circuit.conductorType} options={[['TW', 'TW'], ['THW', 'THW'], ['NYY', 'NYY'], ['LSOH-80', 'LSOH-80'], ['LSOH-90', 'LSOH-90'], ['N2X0H', 'N2X0H']]} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { conductorType: value })} />
                                                                <SelectCell value={circuit.earthSectionMm2.toString()} options={EARTH_SECTION_OPTIONS} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { earthSectionMm2: Number(value) })} />
                                                            </tr>
                                                        );
                                                    }
                                                    
                                                    return rows;
                                                })}
                                            </React.Fragment>
                                        );
                                    })}

                                    {/* 2. SECCIÓN GLOBAL (Tableros Generales al final) */}
                                    {circuits.some(c => c.panelType === 'main_panel' && c.isPanelSummary) && (
                                        <>
                                            <tr className="bg-slate-800 text-white">
                                                <td colSpan={36} className="px-3 py-1 font-bold text-center">
                                                    RESUMEN GENERAL (TG)
                                                </td>
                                            </tr>
                                            {groupByKey(
                                                circuits.filter(c => c.panelType === 'main_panel'),
                                                c => c.panelId
                                            ).flatMap(([, panelCircuits]) => {
                                                const summaryCircuit = panelCircuits.find(c => c.isPanelSummary);
                                                
                                                const rows: React.ReactNode[] = [];
                                                
                                                // 2. Fila resumen final del TG (al final)
                                                if (summaryCircuit) {
                                                    const circuit = summaryCircuit;
                                                    rows.push(
                                                        <tr key={`global-summary-${circuit.rootConductorId}`} className="border-t-4 border-slate-400 align-top dark:border-slate-600 bg-orange-50 font-bold dark:bg-orange-900/30">
                                                            <td className="border-r border-slate-200 px-3 py-4 dark:border-slate-800">
                                                                <div className="min-w-44 space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="rounded px-2 py-1 text-[11px] font-bold bg-orange-500 text-white">
                                                                            RESUMEN {circuit.panelLabel}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-500">Longitud asignada: <span className="font-mono">{circuit.panelLengthM?.toFixed(2)} m</span></p>
                                                                    <p className="text-[10px] text-slate-500">{circuit.voltageV} V · {circuit.phases}Φ · {circuit.connectionType === 'star' ? 'Estrella' : 'Delta'}</p>
                                                                    <p className="text-[10px] text-slate-500">fdis {circuit.designFactor?.toFixed(2)} · ρCuT {circuit.copperResistivity?.toFixed(4)}</p>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 font-mono text-cyan-700 dark:text-cyan-300">TTA</td>
                                                            <td className="min-w-72 px-3 py-3">
                                                                <p className="font-semibold text-slate-700 dark:text-slate-200">Alimentador General {circuit.panelLabel}</p>
                                                                <p className="mt-1 text-[9px] text-slate-500">Resumen de todos los TD · {circuit.traversedRoomNames.join(' → ') || 'Sin ruta'}</p>
                                                            </td>
                                                            <MonoCell value={circuit.lightingPowerW.toFixed(0)} />
                                                            <MonoCell value={circuit.outletPowerW.toFixed(0)} />
                                                            <MonoCell value={circuit.installedPowerKw.toFixed(2)} />
                                                            <EditNumberCell value={circuit.powerFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, `synthetic-feeder-${circuit.panelId}`, { powerFactor: value })} />
                                                            <EditNumberCell value={circuit.demandFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, `synthetic-feeder-${circuit.panelId}`, { demandFactor: value })} />
                                                            <MonoCell value={circuit.installedPowerKw.toFixed(2)} strong />
                                                            <MonoCell value={circuit.maximumDemandKw.toFixed(2)} strong />
                                                            <SelectCell value={circuit.phases.toString()} options={[['1', '1Φ+N+T'], ['3', '3Φ+N+T']]} onChange={(value) => onUpdateCircuit?.(circuit.levelId, `synthetic-feeder-${circuit.panelId}`, { system: Number(value) as 1 | 3 })} />
                                                            <MonoCell value={circuit.theoreticalDesignCurrentA.toFixed(2)} />
                                                            <MonoCell value={circuit.currentA.toFixed(2)} />
                                                            <SelectCell value={circuit.phaseBalance} options={[['R', 'R'], ['S', 'S'], ['T', 'T'], ['RS', 'RS'], ['ST', 'ST'], ['TR', 'TR'], ['RST', 'RST']]} onChange={(value) => onUpdateCircuit?.(circuit.levelId, `synthetic-feeder-${circuit.panelId}`, { phaseBalance: value as PanelCircuitSummary['phaseBalance'] })} />
                                                            <MonoCell value={circuit.phaseCurrentR.toFixed(2)} />
                                                            <MonoCell value={circuit.phaseCurrentS.toFixed(2)} />
                                                            <MonoCell value={circuit.phaseCurrentT.toFixed(2)} />
                                                            <MonoCell value={circuit.nominalCableCurrentA.toFixed(2)} />
                                                            <EditNumberCell value={circuit.ambientTemperatureC} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { ambientTemperatureC: value })} />
                                                            <EditNumberCell value={circuit.groupedCircuitCount} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { groupedCircuitCount: value })} />
                                                            <EditNumberCell value={circuit.groupingFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { groupingFactor: value })} />
                                                            <EditNumberCell value={circuit.temperatureFactor} step={0.01} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { temperatureFactor: value })} />
                                                            <MonoCell value={circuit.admissibleCableCurrentA.toFixed(2)} />
                                                            <td className="px-3 py-3 text-center">{circuit.capacityConforms ? <Check size={14} className="mx-auto text-emerald-500" /> : <AlertTriangle size={14} className="mx-auto text-amber-500" />}</td>
                                                            <SelectCell value={protectionValue(circuit.itm)} options={ITM_OPTIONS} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { itm: value })} />
                                                            <SelectCell value={protectionValue(circuit.dif)} options={DIF_OPTIONS} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { dif: value })} />
                                                            <LengthCells circuit={circuit} />
                                                            <SelectCell value={circuit.sectionMm2.toString()} options={CONDUCTOR_SECTION_OPTIONS.map(opt => [opt.value.toString(), opt.label])} onChange={(val) => onFixSection?.(circuit.levelId, circuit.rootConductorId, Number(val))} />
                                                            <MonoCell value={circuit.voltageDropV.toFixed(2)} />
                                                            <td className="px-3 py-3"><span className={circuit.voltageDropOk ? 'text-emerald-600 font-semibold' : 'text-red-600 font-bold'}>{circuit.voltageDropPct.toFixed(2)}%</span></td>
                                                            <td className="px-3 py-3">{circuit.voltageDropOk && circuit.capacityConforms ? <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><Check size={10} /> OK</span> : <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Revisar</span>}</td>
                                                            <MonoCell value={`${circuit.tubeDiameterMm} mm`} />
                                                            <SelectCell value={circuit.conductorType} options={[['TW', 'TW'], ['THW', 'THW'], ['NYY', 'NYY'], ['LSOH-80', 'LSOH-80'], ['LSOH-90', 'LSOH-90'], ['N2X0H', 'N2X0H']]} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { conductorType: value })} />
                                                            <SelectCell value={circuit.earthSectionMm2.toString()} options={EARTH_SECTION_OPTIONS} onChange={(value) => onUpdateCircuit?.(circuit.levelId, circuit.rootConductorId, { earthSectionMm2: Number(value) })} />
                                                        </tr>
                                                    );
                                                }
                                                
                                                return rows;
                                            })}
                                        </>
                                    )}
                                </tbody>



                            </table>
                        </div>
                    </section>

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

function LengthCells({ circuit }: { circuit: PanelCircuitSummary }) {
    return (
        <>
            <MonoCell value={circuit.horizontalLengthM.toFixed(2)} />
            <MonoCell value={circuit.verticalLengthM.toFixed(2)} />
            <td className="bg-lime-50 px-3 py-3 font-mono font-semibold text-slate-800 dark:bg-lime-950/20 dark:text-lime-200">
                {circuit.lengthM.toFixed(2)}
            </td>
        </>
    );
}

function SelectCellContent({
    value,
    options,
    onChange,
}: {
    value: string;
    options: Array<[string, string]>;
    onChange: (value: string) => void;
}) {
    return (
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
            {options.map(([optionValue, label]) => (
                <option key={optionValue} value={optionValue}>{label}</option>
            ))}
        </select>
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
