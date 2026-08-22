import {
    AlertTriangle,
    BadgeCheck,
    Building2,
    CheckCircle,
    Gauge,
    Layers3,
    Lightbulb,
    RotateCcw,
    TableProperties,
    XCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import { calculateAnnualConsumption } from '@/pages/dialux/domain/calculation/consumptionCalibration';
import type { CalculationRun } from '@/pages/dialux/domain/calculation/types';
import { determineCoverage } from '@/pages/dialux/hooks/lightingCalculations';
import {
    buildRoomLightingInputs,
    getRoomManualUgr,
} from '@/pages/dialux/hooks/roomLighting';
import {
    useEditorStore,
    type Fixture,
    type LightingResult,
    type Room,
} from '@/pages/dialux/hooks/useEditorStore';

export interface RoomResultSummary {
    room: Room;
    fixtures: Fixture[];
    result: LightingResult;
    sourceRoomName?: string;
    levelId: string;
    levelName: string;
    levelIndex: number;
    sourceRoomId?: string;
    ambientConfigKey?: string;
}

interface ResultsPanelProps {
    rooms: RoomResultSummary[];
    /**
     * Trazabilidad del cálculo (Fase 13: "mostrar engineVersion, modo y
     * warnings"). Opcional — sin él, el panel se ve exactamente igual que
     * antes de esta fase (mismo patrón no disruptivo de cada fase anterior).
     */
    calculationRun?: CalculationRun | null;
}

interface RoomTableRow {
    id: string;
    sourceRoomName: string | null;
    levelId: string;
    levelName: string;
    levelIndex: number;
    roomName: string;
    activityName: string | null;
    area: number;
    illuminanceLux: number;
    normativeLabel: string | null;
    fixtureCount: number;
    fixtureLumens: number;
    fixtureLumensSource: 'detected' | 'fallback';
    lumensRequired: number;
    exactQuantity: number;
    roundedQuantity: number;
    avgLux: number;
    minLux: number;
    maxLux: number;
    uniformity: number;
    /** `null` = la actividad normativa seleccionada no regula este parámetro (ej. UGR en estacionamientos, Uo en baños) — nunca se interpreta como "sin dato" para caer a un límite genérico inventado. */
    uniformityTarget: number | null;
    estimatedUniformity: number;
    ugr: number;
    ugrLimit: number | null;
    /** `true` cuando TODAS las luminarias del ambiente quedaron excluidas del cálculo de UGR — `ugr: 0` en ese caso no es un resultado físico real (ver `LightingResult.ugr_not_evaluated`). Siempre `false` cuando `ugrIsManual` es `true` (el dato manual reemplaza la evaluación, no depende de ella). */
    ugrNotEvaluated: boolean;
    /** `true` cuando `ugr` viene de `Room.manualUgr`/`AmbientConfig.manualUgr` (cargado a mano por el usuario) en vez del motor de posición de Guth — ver doc-comment de `Room.manualUgr`. */
    ugrIsManual: boolean;
    hasNormativeSource: boolean;
    coverage: 'optimal' | 'insufficient' | 'excessive';
    installedPowerWatts: number;
    hasCompletePowerData: boolean;
    dailyOperatingHours: number;
    minimumDailyOperatingHours: number;
    maximumDailyOperatingHours: number;
    sourceRoomId: string;
    ambientConfigKey: string;
}

type ComplianceValues = Pick<
    RoomTableRow,
    | 'avgLux'
    | 'illuminanceLux'
    | 'uniformity'
    | 'uniformityTarget'
    | 'ugr'
    | 'ugrLimit'
    | 'ugrNotEvaluated'
    | 'hasNormativeSource'
>;

/**
 * Misma regla de conformidad que usa el PDF: norma + lux + Uo + UGR.
 * `uniformityTarget`/`ugrLimit` en `null` significa que la actividad
 * normativa seleccionada NO regula ese parámetro (ej. UGR en
 * estacionamientos, Uo en baños — ver `normativaData.ts`) — se trata como
 * automáticamente satisfecho, nunca como "sin dato" contra un límite
 * genérico inventado. `ugrNotEvaluated` es distinto: SÍ hay límite, pero
 * el cálculo no produjo un UGR real (todas las luminarias quedaron
 * excluidas de la suma) — no puede tratarse como conforme.
 */
export function isRoomCompliant(row: ComplianceValues): boolean {
    return (
        row.hasNormativeSource &&
        row.avgLux >= row.illuminanceLux &&
        (row.uniformityTarget === null ||
            row.uniformity >= row.uniformityTarget) &&
        (row.ugrLimit === null ||
            (!row.ugrNotEvaluated && row.ugr <= row.ugrLimit))
    );
}

const coverageStyles = {
    optimal:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    insufficient:
        'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/70',
    excessive:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70',
};

const coverageLabels = {
    optimal: 'Optimo',
    insufficient: 'Insuficiente',
    excessive: 'Excesivo',
};

export function buildTableRows(rooms: RoomResultSummary[]): RoomTableRow[] {
    return rooms.map(
        ({
            room,
            fixtures,
            result,
            sourceRoomName,
            levelId,
            levelName,
            levelIndex,
            sourceRoomId,
            ambientConfigKey,
        }) => {
            const inputs = buildRoomLightingInputs(room, fixtures);

            return {
                id: room.id,
                sourceRoomName: sourceRoomName ?? null,
                levelId,
                levelName,
                levelIndex,
                roomName: room.name,
                activityName: room.normativeActivity ?? null,
                area: inputs.area,
                illuminanceLux: inputs.illuminanceLux,
                normativeLabel:
                    inputs.normative?.label ?? room.normativeLabel ?? null,
                fixtureCount: inputs.fixtureCount,
                fixtureLumens: inputs.fixtureLumens,
                fixtureLumensSource: inputs.detectedFixtureLumens
                    ? 'detected'
                    : 'fallback',
                lumensRequired: inputs.lumensRequired,
                exactQuantity: inputs.exactQuantity,
                roundedQuantity: inputs.roundedQuantity,
                avgLux: result.avg_lux,
                minLux: result.min_lux,
                maxLux: result.max_lux,
                uniformity: result.uniformity,
                uniformityTarget: room.uniformityTarget ?? null,
                estimatedUniformity: inputs.estimatedUniformity,
                ugr: getRoomManualUgr(room) ?? result.ugr,
                ugrLimit: room.ugrLimit ?? null,
                ugrNotEvaluated:
                    getRoomManualUgr(room) === null &&
                    (result.ugr_not_evaluated ?? false),
                ugrIsManual: getRoomManualUgr(room) !== null,
                hasNormativeSource: Boolean(
                    room.normativeStandard ||
                    room.normativeLabel ||
                    room.normativeCategory,
                ),
                coverage: determineCoverage(
                    inputs.exactQuantity,
                    inputs.fixtureCount || inputs.roundedQuantity,
                ),
                installedPowerWatts: fixtures.reduce(
                    (sum, fixture) => sum + (fixture.power ?? 0),
                    0,
                ),
                hasCompletePowerData: fixtures.every(
                    (fixture) =>
                        typeof fixture.power === 'number' && fixture.power >= 0,
                ),
                dailyOperatingHours: room.dailyOperatingHours ?? 8,
                minimumDailyOperatingHours:
                    room.minimumDailyOperatingHours ?? Math.max(0, (room.dailyOperatingHours ?? 8) - 2),
                maximumDailyOperatingHours:
                    room.maximumDailyOperatingHours ?? Math.min(24, (room.dailyOperatingHours ?? 8) + 2),
                sourceRoomId: sourceRoomId ?? room.id.split('::')[0],
                ambientConfigKey: ambientConfigKey ?? room.id.split('::')[1] ?? 'ambient-1',
            };
        },
    );
}

function statusIcon(ok: boolean, warn = false) {
    if (ok) return <CheckCircle size={14} className="text-emerald-400" />;
    if (warn) return <AlertTriangle size={14} className="text-amber-400" />;
    return <XCircle size={14} className="text-red-400" />;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
    rooms,
    calculationRun,
}) => {
    const project = useEditorStore((state) => state.project);
    const updateRoom = useEditorStore((state) => state.updateRoom);
    const rows = buildTableRows(rooms);
    const levels = Array.from(
        new Map(
            rows
                .sort((a, b) => a.levelIndex - b.levelIndex)
                .map((row) => [
                    row.levelId,
                    {
                        id: row.levelId,
                        name: row.levelName,
                        index: row.levelIndex,
                    },
                ]),
        ).values(),
    );
    const [selectedLevelId, setSelectedLevelId] = useState('all');
    const [selectedRoomName, setSelectedRoomName] = useState('all');
    const [showWarnings, setShowWarnings] = useState(false);
    const [ambientHourOverrides, setAmbientHourOverrides] = useState<Record<string, number>>({});
    const [ambientMinimumHourOverrides, setAmbientMinimumHourOverrides] = useState<Record<string, number>>({});
    const [ambientMaximumHourOverrides, setAmbientMaximumHourOverrides] = useState<Record<string, number>>({});

    const activeLevelId =
        selectedLevelId === 'all' ||
        levels.some((level) => level.id === selectedLevelId)
            ? selectedLevelId
            : 'all';
    const levelRows =
        activeLevelId === 'all'
            ? rows
            : rows.filter((row) => row.levelId === activeLevelId);
    const roomNames = Array.from(
        new Set(levelRows.map((row) => row.sourceRoomName ?? 'Sin recinto')),
    ).sort((a, b) => a.localeCompare(b, 'es'));
    const activeRoomName =
        selectedRoomName === 'all' || roomNames.includes(selectedRoomName)
            ? selectedRoomName
            : 'all';
    const filteredRows =
        activeRoomName === 'all'
            ? levelRows
            : levelRows.filter(
                  (row) =>
                      (row.sourceRoomName ?? 'Sin recinto') === activeRoomName,
              );

    const updateAmbientOperatingHours = (
        row: RoomTableRow,
        field: 'minimumDailyOperatingHours' | 'dailyOperatingHours' | 'maximumDailyOperatingHours',
        hours: number,
    ) => {
        const currentMinimum = ambientMinimumHourOverrides[row.id] ?? row.minimumDailyOperatingHours;
        const currentUsage = ambientHourOverrides[row.id] ?? row.dailyOperatingHours;
        const currentMaximum = ambientMaximumHourOverrides[row.id] ?? row.maximumDailyOperatingHours;
        let normalizedHours = Math.min(24, Math.max(0, hours));
        if (field === 'minimumDailyOperatingHours') {
            normalizedHours = Math.min(normalizedHours, currentUsage);
        } else if (field === 'maximumDailyOperatingHours') {
            normalizedHours = Math.max(normalizedHours, currentUsage);
        } else {
            normalizedHours = Math.min(currentMaximum, Math.max(currentMinimum, normalizedHours));
        }
        if (field === 'minimumDailyOperatingHours') {
            setAmbientMinimumHourOverrides((current) => ({ ...current, [row.id]: normalizedHours }));
        } else if (field === 'maximumDailyOperatingHours') {
            setAmbientMaximumHourOverrides((current) => ({ ...current, [row.id]: normalizedHours }));
        } else {
            setAmbientHourOverrides((current) => ({ ...current, [row.id]: normalizedHours }));
        }

        const sourceRoom = project?.scenes
            .flatMap((scene) => scene.rooms)
            .find((room) => room.id === row.sourceRoomId);
        if (!sourceRoom) return;

        updateRoom(row.sourceRoomId, {
            ambientConfigs: {
                ...sourceRoom.ambientConfigs,
                [row.ambientConfigKey]: {
                    ...sourceRoom.ambientConfigs?.[row.ambientConfigKey],
                    [field]: normalizedHours,
                },
            },
        });
    };

    if (filteredRows.length === 0) {
        return (
            <div className="rounded-xl border border-slate-300 bg-slate-300 p-6 text-center dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-base text-slate-600 dark:text-slate-400">
                    No hay resultados disponibles para mostrar.
                </p>
            </div>
        );
    }

    const compliantRooms = filteredRows.filter(isRoomCompliant).length;

    return (
        <div className="space-y-5 text-xs">
            <section
                aria-label="Filtros e indicadores generales"
                className="rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/50"
            >
                <div className="grid gap-2 lg:grid-cols-4 xl:grid-cols-[1fr_1.25fr_auto_repeat(4,0.8fr)] xl:items-center">
                    {/* Piso */}
                    <label className="flex h-14 flex-col justify-center rounded-lg border border-slate-300 bg-slate-200 px-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                            <Layers3 size={13} className="text-cyan-400" />
                            Piso
                        </span>

                        <select
                            value={activeLevelId}
                            onChange={(event) =>
                                setSelectedLevelId(event.target.value)
                            }
                            className="h-6 border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none focus:ring-0 dark:text-slate-100"
                        >
                            <option value="all">Todos los pisos</option>

                            {levels.map((level) => (
                                <option key={level.id} value={level.id}>
                                    {level.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    {/* Recinto */}
                    <label className="flex h-14 flex-col justify-center rounded-lg border border-slate-300 bg-slate-200 px-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                            <Building2 size={13} className="text-amber-400" />
                            Recinto
                        </span>

                        <select
                            value={activeRoomName}
                            onChange={(event) =>
                                setSelectedRoomName(event.target.value)
                            }
                            className="h-6 border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none focus:ring-0 dark:text-slate-100"
                        >
                            <option value="all">Todos los recintos</option>

                            {roomNames.map((roomName) => (
                                <option key={roomName} value={roomName}>
                                    {roomName}
                                </option>
                            ))}
                        </select>
                    </label>

                    {/* Limpiar */}
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedLevelId('all');
                            setSelectedRoomName('all');
                        }}
                        disabled={
                            activeLevelId === 'all' && activeRoomName === 'all'
                        }
                        className="flex h-14 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-200 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-800 dark:bg-slate-800 dark:bg-slate-900/70 dark:text-slate-300"
                    >
                        <RotateCcw size={14} />
                        Limpiar
                    </button>

                    {/* Ambientes */}
                    <div className="flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950/70">
                        <Building2
                            size={16}
                            className="text-slate-500 dark:text-slate-400"
                        />

                        <div>
                            <p className="text-[10px] tracking-wider text-slate-400 uppercase dark:text-slate-500">
                                Ambientes
                            </p>

                            <p className="text-xl font-bold text-slate-800 tabular-nums dark:text-white">
                                {filteredRows.length}
                            </p>
                        </div>
                    </div>

                    {/* Luminarias */}
                    <div className="flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950/70">
                        <Lightbulb
                            size={16}
                            className="text-amber-500 dark:text-amber-400"
                        />

                        <div>
                            <p className="text-[10px] tracking-wider text-slate-400 uppercase dark:text-slate-500">
                                Luminarias
                            </p>

                            <p className="text-xl font-bold text-amber-600 tabular-nums dark:text-amber-300">
                                {filteredRows.reduce(
                                    (sum, row) => sum + row.fixtureCount,
                                    0,
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Lux promedio */}
                    <div className="flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950/70">
                        <Gauge
                            size={16}
                            className="text-cyan-500 dark:text-cyan-400"
                        />

                        <div>
                            <p className="text-[10px] tracking-wider text-slate-400 uppercase dark:text-slate-500">
                                Lux promedio
                            </p>

                            <p className="text-xl font-bold text-cyan-700 tabular-nums dark:text-cyan-300">
                                {filteredRows.length
                                    ? Math.round(
                                          filteredRows.reduce(
                                              (sum, row) => sum + row.avgLux,
                                              0,
                                          ) / filteredRows.length,
                                      )
                                    : 0}
                            </p>
                        </div>
                    </div>

                    {/* Cumplen */}
                    <div className="flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950/70">
                        <BadgeCheck
                            size={16}
                            className="text-emerald-500 dark:text-emerald-400"
                        />

                        <div>
                            <p className="text-[10px] tracking-wider text-slate-400 uppercase dark:text-slate-500">
                                Cumplen
                            </p>

                            <p className="text-xl font-bold text-emerald-700 tabular-nums dark:text-emerald-300">
                                {compliantRooms}/{filteredRows.length}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-2xl">
                <div className="flex items-start gap-3 border-b border-slate-300 px-4 py-3 sm:px-5 sm:py-4 dark:border-slate-800">
                    <TableProperties
                        size={17}
                        className="mt-0.5 shrink-0 text-cyan-500 dark:text-cyan-300"
                    />
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Resultado por ambiente
                        </h3>
                        <p className="mt-0.5 max-w-4xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            El calculo de luminarias y el isolux se resuelven
                            con el area del ambiente derivado, mientras que la
                            normativa aplicada proviene del recinto.
                        </p>
                        {calculationRun && (
                            <>
                                <p className="mt-1.5 text-[11px] text-slate-500">
                                    Motor {calculationRun.engineVersion} ·
                                    calculado{' '}
                                    {calculationRun.completedAt
                                        ? new Date(
                                              calculationRun.completedAt,
                                          ).toLocaleString('es-PE')
                                        : '—'}
                                    {calculationRun.warnings.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowWarnings((v) => !v)
                                            }
                                            className="ml-1.5 text-amber-400 underline decoration-dotted underline-offset-2 hover:text-amber-300"
                                        >
                                            · {calculationRun.warnings.length}{' '}
                                            advertencia
                                            {calculationRun.warnings.length ===
                                            1
                                                ? ''
                                                : 's'}{' '}
                                            ({showWarnings ? 'ocultar' : 'ver'})
                                        </button>
                                    )}
                                </p>
                                {showWarnings &&
                                    calculationRun.warnings.length > 0 && (
                                        <ul className="mt-2 max-w-4xl space-y-1 rounded-lg border border-amber-900/40 bg-amber-950/10 p-2.5">
                                            {calculationRun.warnings.map(
                                                (warning, index) => (
                                                    <li
                                                        key={`${warning.code}-${warning.objectId ?? index}`}
                                                        className="flex items-start gap-1.5 text-[11px] text-amber-200"
                                                    >
                                                        <AlertTriangle
                                                            size={12}
                                                            className="mt-0.5 shrink-0 text-amber-400"
                                                        />
                                                        <span>
                                                            {warning.message}
                                                        </span>
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    )}
                            </>
                        )}
                    </div>
                </div>

                <div className="max-h-[66vh] overflow-auto overscroll-contain">
                    <table className="w-full min-w-[1240px] table-fixed text-left text-[10px] leading-snug">
                        <thead className="sticky top-0 bg-slate-100 text-center backdrop-blur dark:bg-slate-950/95">
                            <tr className="border-b border-slate-300 text-[9px] font-semibold tracking-[0.06em] text-slate-600 uppercase dark:border-slate-800 dark:text-slate-500">
                                <th className="w-44 px-2 py-2.5">Ambiente</th>
                                <th className="w-14 px-1 py-2.5">Área</th>
                                <th className="w-20 px-1 py-2.5">Aplicación</th>
                                <th className="w-16 px-1 py-2.5">Norma</th>
                                <th className="w-14 px-1 py-2.5">Lum.</th>
                                <th className="w-28 px-1 py-2.5">Horas min/uso/máx</th>
                                <th className="w-32 px-1 py-2.5">Consumo min/uso/máx</th>
                                <th className="w-20 px-1 py-2.5">Lm/Foco</th>
                                <th className="w-20 px-1 py-2.5">Lm Req.</th>
                                <th className="w-20 px-1 py-2.5">Cantidad</th>
                                <th className="w-14 px-1 py-2.5">E avg</th>
                                <th className="w-14 px-1 py-2.5">E min</th>
                                <th className="w-14 px-1 py-2.5">E max</th>
                                <th
                                    className="w-14 px-1 py-2.5"
                                    title="Uniformidad calculada del grid real (Emin/Eavg del motor de cálculo)"
                                >
                                    Uo
                                </th>
                                <th className="w-14 px-1 py-2.5">UGR</th>
                                <th className="w-40 px-2 py-2.5">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((row, index) => {
                                const luxOk = row.avgLux >= row.illuminanceLux;
                                const uniformityOk =
                                    row.uniformityTarget === null ||
                                    row.uniformity >= row.uniformityTarget;
                                const ugrOk =
                                    row.ugrLimit === null ||
                                    (!row.ugrNotEvaluated &&
                                        row.ugr <= row.ugrLimit);
                                const compliant = isRoomCompliant(row);
                                const minimumOperatingHours = ambientMinimumHourOverrides[row.id] ?? row.minimumDailyOperatingHours;
                                const operatingHours = ambientHourOverrides[row.id] ?? row.dailyOperatingHours;
                                const maximumOperatingHours = ambientMaximumHourOverrides[row.id] ?? row.maximumDailyOperatingHours;
                                const consumptionValues = [minimumOperatingHours, operatingHours, maximumOperatingHours].map(
                                    (hours) => calculateAnnualConsumption(row.installedPowerWatts, hours),
                                );
                                const warn = luxOk && (!uniformityOk || !ugrOk);
                                const showLevelHeader =
                                    activeLevelId === 'all' &&
                                    (index === 0 ||
                                        filteredRows[index - 1]?.levelId !==
                                            row.levelId);

                                return (
                                    <React.Fragment
                                        key={`${row.levelId}-${row.id}`}
                                    >
                                        {showLevelHeader && (
                                            <tr className="border-y border-cyan-200 bg-cyan-50 dark:border-cyan-900/50 dark:bg-cyan-950/30">
                                                <td
                                                    colSpan={16}
                                                    className="px-4 py-2 text-left text-[10px] font-semibold tracking-wide text-cyan-800 dark:text-cyan-200"
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <Layers3 size={13} />
                                                        {row.levelName}
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                        <tr className="border-b border-slate-200 text-center text-[10px] leading-snug text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-900/60">
                                            <td className="px-3 py-3">
                                                <div className="flex items-start gap-2 text-left">
                                                    <Lightbulb
                                                        size={15}
                                                        className="mt-0.5 text-amber-500 dark:text-amber-300"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="leading-snug font-semibold text-slate-900 dark:text-white">
                                                            {row.roomName}
                                                        </p>
                                                        <p
                                                            className="mt-0.5 leading-snug text-slate-500"
                                                            title={
                                                                row.sourceRoomName ||
                                                                row.normativeLabel
                                                                    ? undefined
                                                                    : 'Estimación previa al cálculo (heurística por cantidad de luminarias), no el resultado real del motor — ver columna Uo'
                                                            }
                                                        >
                                                            {row.sourceRoomName
                                                                ? `${row.levelName} · Recinto: ${row.sourceRoomName}`
                                                                : (row.normativeLabel ??
                                                                  `Uniformidad est.: ${(row.estimatedUniformity * 100).toFixed(0)}%`)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-2 py-3 font-mono tabular-nums">
                                                {row.area.toFixed(2)} m²
                                            </td>
                                            <td className="px-2 py-3">
                                                {row.activityName ?? '-'}
                                            </td>
                                            <td className="px-2 py-3 font-mono tabular-nums">
                                                {row.illuminanceLux} lux
                                            </td>
                                            <td className="px-2 py-3 font-mono tabular-nums">
                                                {row.fixtureCount}
                                            </td>
                                            <td className="px-2 py-3">
                                                <div className="grid grid-cols-3 gap-1">
                                                    {[
                                                        ['minimumDailyOperatingHours', 'Mín.', minimumOperatingHours],
                                                        ['dailyOperatingHours', 'Uso', operatingHours],
                                                        ['maximumDailyOperatingHours', 'Máx.', maximumOperatingHours],
                                                    ].map(([field, label, value]) => (
                                                        <label key={field} className="min-w-0">
                                                            <span className="block text-[8px] text-slate-500">{label}</span>
                                                            <input
                                                                aria-label={`${label} horas diarias de ${row.roomName}`}
                                                                type="number"
                                                                min={0}
                                                                max={24}
                                                                step={0.5}
                                                                value={value}
                                                                onChange={(event) =>
                                                                    updateAmbientOperatingHours(
                                                                        row,
                                                                        field as 'minimumDailyOperatingHours' | 'dailyOperatingHours' | 'maximumDailyOperatingHours',
                                                                        Number(event.target.value),
                                                                    )
                                                                }
                                                                className="h-8 w-full rounded-md border border-slate-300 bg-white px-1 text-center font-mono text-[10px] font-semibold text-slate-900 tabular-nums outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-2 py-3">
                                                <div className="grid gap-0.5 font-mono text-[10px] tabular-nums">
                                                    {consumptionValues.map((value, consumptionIndex) => (
                                                        <div
                                                            key={consumptionIndex}
                                                            className={consumptionIndex === 1 ? 'font-bold text-cyan-700 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}
                                                        >
                                                            {['Mín.', 'Uso', 'Máx.'][consumptionIndex]}{' '}
                                                            {value.toLocaleString('es-PE', { maximumFractionDigits: 1 })} kWh/a
                                                        </div>
                                                    ))}
                                                </div>
                                                {!row.hasCompletePowerData && (
                                                    <span className="mt-1 block text-[8px] text-amber-600 dark:text-amber-400">Potencia parcial</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-3 font-mono tabular-nums">
                                                <div>
                                                    {row.fixtureLumens.toLocaleString(
                                                        'es-PE',
                                                    )}
                                                </div>
                                                <div className="text-slate-500">
                                                    {row.fixtureLumensSource ===
                                                    'detected'
                                                        ? 'Detectado'
                                                        : 'Respaldo'}
                                                </div>
                                            </td>
                                            <td className="px-2 py-3 font-mono tabular-nums">
                                                {row.lumensRequired.toFixed(0)}
                                            </td>
                                            <td className="px-2 py-3 font-mono tabular-nums">
                                                <div>
                                                    {row.fixtureCount} inst.
                                                </div>
                                                <div className="text-slate-500">
                                                    {row.exactQuantity.toFixed(
                                                        2,
                                                    )}{' '}
                                                    calc. /{' '}
                                                    {row.roundedQuantity} red.
                                                </div>
                                            </td>
                                            <td className="px-2 py-3 font-mono tabular-nums">
                                                {row.avgLux.toFixed(0)}
                                            </td>
                                            <td className="px-2 py-3 font-mono tabular-nums">
                                                {row.minLux.toFixed(0)}
                                            </td>
                                            <td className="px-2 py-3 font-mono tabular-nums">
                                                {row.maxLux.toFixed(0)}
                                            </td>
                                            <td
                                                className="px-2 py-3 font-mono tabular-nums"
                                                title="Uniformidad calculada del grid real (Emin/Eavg del motor de cálculo)"
                                            >
                                                {row.uniformity.toFixed(3)}
                                            </td>
                                            <td className="px-2 py-3 font-mono tabular-nums">
                                                {row.ugr.toFixed(1)}
                                                {row.ugrIsManual && (
                                                    <span
                                                        title="UGR cargado a mano — el método calculado no evaluó ninguna luminaria en este ambiente (H/R fuera de rango de validez)."
                                                        className="ml-1 text-[9px] font-semibold text-amber-400"
                                                    >
                                                        manual
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    {statusIcon(
                                                        compliant,
                                                        warn,
                                                    )}
                                                    <span
                                                        className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                                                            compliant
                                                                ? coverageStyles.optimal
                                                                : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300'
                                                        }`}
                                                    >
                                                        {compliant
                                                            ? 'Conforme'
                                                            : row.hasNormativeSource
                                                              ? 'No conforme'
                                                              : 'Sin norma'}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-[10px] text-slate-500">
                                                    Cobertura:{' '}
                                                    {
                                                        coverageLabels[
                                                            row.coverage
                                                        ]
                                                    }
                                                </p>
                                                {row.fixtureCount <
                                                    row.roundedQuantity && (
                                                    <p className="mt-1.5 leading-snug font-semibold text-amber-600 dark:text-amber-400">
                                                        ≈
                                                        {row.roundedQuantity -
                                                            row.fixtureCount}{' '}
                                                        luminaria(s) más
                                                        (estimación método de
                                                        lúmenes) — no es el
                                                        resultado del cálculo
                                                        punto a punto de arriba
                                                    </p>
                                                )}
                                                <p className="mt-1.5 leading-snug text-slate-500">
                                                    {luxOk
                                                        ? 'Lux OK'
                                                        : 'Lux bajo'}{' '}
                                                    ·{' '}
                                                    {row.uniformityTarget ===
                                                    null
                                                        ? 'Uo no regulado'
                                                        : uniformityOk
                                                          ? 'Uo OK'
                                                          : 'Uo bajo'}{' '}
                                                    ·{' '}
                                                    {row.ugrLimit === null
                                                        ? 'UGR no regulado'
                                                        : row.ugrNotEvaluated
                                                          ? 'UGR no evaluado'
                                                          : ugrOk
                                                            ? row.ugrIsManual
                                                                ? 'UGR OK (manual)'
                                                                : 'UGR OK'
                                                            : row.ugrIsManual
                                                              ? 'UGR alto (manual)'
                                                              : 'UGR alto'}
                                                </p>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};
