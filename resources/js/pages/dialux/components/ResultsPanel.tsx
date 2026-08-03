import {
    AlertTriangle,
    Building2,
    CheckCircle,
    Layers3,
    Lightbulb,
    TableProperties,
    XCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import { buildRoomLightingInputs } from '@/pages/dialux/hooks/roomLighting';
import type { Fixture, LightingResult, Room } from '@/pages/dialux/hooks/useEditorStore';

export interface RoomResultSummary {
    room: Room;
    fixtures: Fixture[];
    result: LightingResult;
    sourceRoomName?: string;
    levelId: string;
    levelName: string;
    levelIndex: number;
}

interface ResultsPanelProps {
    rooms: RoomResultSummary[];
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
    estimatedUniformity: number;
    ugr: number;
    coverage: 'optimal' | 'insufficient' | 'excessive';
}

const coverageStyles = {
    optimal: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70',
    insufficient: 'bg-red-950/60 text-red-300 border-red-800/70',
    excessive: 'bg-amber-950/60 text-amber-300 border-amber-800/70',
};

const coverageLabels = {
    optimal: 'Optimo',
    insufficient: 'Insuficiente',
    excessive: 'Excesivo',
};

export function buildTableRows(rooms: RoomResultSummary[]): RoomTableRow[] {
    return rooms.map(({ room, fixtures, result, sourceRoomName, levelId, levelName, levelIndex }) => {
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
            normativeLabel: inputs.normative?.label ?? room.normativeLabel ?? null,
            fixtureCount: inputs.fixtureCount,
            fixtureLumens: inputs.fixtureLumens,
            fixtureLumensSource: inputs.detectedFixtureLumens ? 'detected' : 'fallback',
            lumensRequired: inputs.lumensRequired,
            exactQuantity: inputs.exactQuantity,
            roundedQuantity: inputs.roundedQuantity,
            avgLux: result.avg_lux,
            minLux: result.min_lux,
            maxLux: result.max_lux,
            uniformity: result.uniformity,
            estimatedUniformity: inputs.estimatedUniformity,
            ugr: result.ugr,
            coverage: inputs.coverage,
        };
    });
}

function statusIcon(ok: boolean, warn = false) {
    if (ok) return <CheckCircle size={14} className="text-emerald-400" />;
    if (warn) return <AlertTriangle size={14} className="text-amber-400" />;
    return <XCircle size={14} className="text-red-400" />;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ rooms }) => {
    const rows = buildTableRows(rooms);
    const levels = Array.from(
        new Map(
            rows
                .sort((a, b) => a.levelIndex - b.levelIndex)
                .map((row) => [
                    row.levelId,
                    { id: row.levelId, name: row.levelName, index: row.levelIndex },
                ]),
        ).values(),
    );
    const [selectedLevelId, setSelectedLevelId] = useState('all');
    const [selectedRoomName, setSelectedRoomName] = useState('all');
    const activeLevelId =
        selectedLevelId === 'all' || levels.some((level) => level.id === selectedLevelId)
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
                  (row) => (row.sourceRoomName ?? 'Sin recinto') === activeRoomName,
              );

    if (filteredRows.length === 0) {
        return (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-center">
                <p className="text-base text-slate-400">
                    No hay resultados disponibles para mostrar.
                </p>
            </div>
        );
    }

    const compliantRooms = filteredRows.filter(
        (row) => row.avgLux >= row.illuminanceLux && row.uniformity >= 0.4,
    ).length;

    return (
        <div className="space-y-5 text-xs">
            <section
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/60 sm:p-4"
                aria-label="Filtros de resultados">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                    <label className="space-y-1.5">
                        <span className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                            <Layers3 size={14} className="text-cyan-500 dark:text-cyan-300" />
                            Piso
                        </span>
                        <select
                            value={activeLevelId}
                            onChange={(event) => {
                                setSelectedLevelId(event.target.value);
                                setSelectedRoomName('all');
                            }}
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                            <option value="all">Todos los pisos</option>
                            {levels.map((level) => (
                                <option key={level.id} value={level.id}>
                                    {level.name} ({rows.filter((row) => row.levelId === level.id).length})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="space-y-1.5">
                        <span className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                            <Building2 size={14} className="text-amber-500 dark:text-amber-300" />
                            Recinto
                        </span>
                        <select
                            value={activeRoomName}
                            onChange={(event) => setSelectedRoomName(event.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                            <option value="all">Todos los recintos</option>
                            {roomNames.map((roomName) => (
                                <option key={roomName} value={roomName}>
                                    {roomName}
                                </option>
                            ))}
                        </select>
                    </label>

                    <button
                        type="button"
                        onClick={() => {
                            setSelectedLevelId('all');
                            setSelectedRoomName('all');
                        }}
                        disabled={activeLevelId === 'all' && activeRoomName === 'all'}
                        className="h-10 rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        Limpiar
                    </button>
                </div>
            </section>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Indicadores generales">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                        Ambientes
                    </p>
                    <p className="mt-2 text-xl font-semibold tabular-nums text-white sm:text-2xl">
                        {filteredRows.length}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                        Luminarias
                    </p>
                    <p className="mt-2 text-xl font-semibold tabular-nums text-amber-300 sm:text-2xl">
                        {filteredRows.reduce((sum, row) => sum + row.fixtureCount, 0)}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                        Lux Promedio
                    </p>
                    <p className="mt-2 text-xl font-semibold tabular-nums text-cyan-300 sm:text-2xl">
                        {(
                            filteredRows.reduce((sum, row) => sum + row.avgLux, 0) /
                            filteredRows.length
                        ).toFixed(0)}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                        Cumplen
                    </p>
                    <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-300 sm:text-2xl">
                        {compliantRooms}/{filteredRows.length}
                    </p>
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 shadow-2xl">
                <div className="flex items-start gap-3 border-b border-slate-800 px-4 py-3 sm:px-5 sm:py-4">
                    <TableProperties size={17} className="mt-0.5 shrink-0 text-cyan-300" />
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white">
                            Resultado por ambiente
                        </h3>
                        <p className="mt-0.5 max-w-4xl text-xs leading-relaxed text-slate-400">
                            El calculo de luminarias y el isolux se resuelven con
                            el area del ambiente derivado, mientras que la normativa
                            aplicada proviene del recinto.
                        </p>
                    </div>
                </div>

                <div className="max-h-[58vh] overflow-auto overscroll-contain">
                    <table className="w-full min-w-[1280px] table-fixed text-left text-xs">
                        <thead className="sticky top-0 bg-slate-950/95 text-center backdrop-blur">
                            <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                                <th className="w-56 px-3 py-3">Ambiente</th>
                                <th className="w-20 px-2 py-3">Área</th>
                                <th className="w-28 px-2 py-3">Aplicación</th>
                                <th className="w-20 px-2 py-3">Norma</th>
                                <th className="w-20 px-2 py-3">Luminarias</th>
                                <th className="w-24 px-2 py-3">Lm/Foco</th>
                                <th className="w-24 px-2 py-3">Lm Req.</th>
                                <th className="w-24 px-2 py-3">Cantidad</th>
                                <th className="w-16 px-2 py-3">E avg</th>
                                <th className="w-16 px-2 py-3">E min</th>
                                <th className="w-16 px-2 py-3">E max</th>
                                <th className="w-16 px-2 py-3">Uo</th>
                                <th className="w-16 px-2 py-3">UGR</th>
                                <th className="w-48 px-3 py-3">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((row, index) => {
                                const luxOk = row.avgLux >= row.illuminanceLux;
                                const uniformityOk = row.uniformity >= 0.4;
                                const ugrOk = row.ugr <= 22;
                                const warn = luxOk && (!uniformityOk || !ugrOk);
                                const showLevelHeader =
                                    activeLevelId === 'all' &&
                                    (index === 0 ||
                                        filteredRows[index - 1]?.levelId !== row.levelId);

                                return (
                                    <React.Fragment key={`${row.levelId}-${row.id}`}>
                                        {showLevelHeader && (
                                            <tr className="border-y border-cyan-900/50 bg-cyan-950/30">
                                                <td
                                                    colSpan={14}
                                                    className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-cyan-200">
                                                    <span className="inline-flex items-center gap-2">
                                                        <Layers3 size={13} />
                                                        {row.levelName}
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                        <tr className="border-b border-slate-800/70 text-center text-xs text-slate-200 transition-colors hover:bg-slate-900/60">
                                        <td className="px-3 py-3">
                                            <div className="flex items-start gap-2 text-left">
                                                <Lightbulb
                                                    size={15}
                                                    className="mt-0.5 text-amber-300"
                                                />
                                                <div className="min-w-0">
                                                    <p className="leading-snug font-semibold text-white">
                                                        {row.roomName}
                                                    </p>
                                                    <p className="mt-0.5 leading-snug text-slate-500">
                                                         {row.sourceRoomName
                                                            ? `${row.levelName} · Recinto: ${row.sourceRoomName}`
                                                            : row.normativeLabel ??
                                                              `Uniformidad est.: ${(row.estimatedUniformity * 100).toFixed(0)}%`}
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
                                        <td className="px-2 py-3 font-mono tabular-nums">
                                            <div>
                                                {row.fixtureLumens.toLocaleString('es-PE')}
                                            </div>
                                            <div className="text-slate-500">
                                                {row.fixtureLumensSource === 'detected'
                                                    ? 'Detectado'
                                                    : 'Respaldo'}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 font-mono tabular-nums">
                                            {row.lumensRequired.toFixed(0)}
                                        </td>
                                        <td className="px-2 py-3 font-mono tabular-nums">
                                            <div>{row.fixtureCount} inst.</div>
                                            <div className="text-slate-500">
                                                {row.exactQuantity.toFixed(2)} calc. /{' '}
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
                                        <td className="px-2 py-3 font-mono tabular-nums">
                                            {row.uniformity.toFixed(3)}
                                        </td>
                                        <td className="px-2 py-3 font-mono tabular-nums">
                                            {row.ugr.toFixed(1)}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                {statusIcon(
                                                    luxOk && uniformityOk && ugrOk,
                                                    warn,
                                                )}
                                                <span
                                                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                        coverageStyles[row.coverage]
                                                    }`}>
                                                    {coverageLabels[row.coverage]}
                                                </span>
                                            </div>
                                            {row.fixtureCount < row.roundedQuantity && (
                                                <p className="mt-1.5 leading-snug font-semibold text-amber-400">
                                                    Faltan {row.roundedQuantity - row.fixtureCount}{' '}
                                                    luminaria(s) según normativa
                                                </p>
                                            )}
                                            <p className="mt-1.5 leading-snug text-slate-500">
                                                {luxOk ? 'Lux OK' : 'Lux bajo'} ·{' '}
                                                {uniformityOk ? 'Uo OK' : 'Uo bajo'} ·{' '}
                                                {ugrOk ? 'UGR OK' : 'UGR alto'}
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
