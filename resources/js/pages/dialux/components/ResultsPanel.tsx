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
        <div className="space-y-4">
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Layers3 size={15} className="text-cyan-300" />
                    Resultados por nivel
                </div>
                <div
                    role="tablist"
                    aria-label="Niveles del proyecto"
                    className="flex gap-2 overflow-x-auto pb-1">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeLevelId === 'all'}
                        onClick={() => {
                            setSelectedLevelId('all');
                            setSelectedRoomName('all');
                        }}
                        className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                            activeLevelId === 'all'
                                ? 'border-cyan-500/60 bg-cyan-950/60 text-cyan-200'
                                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}>
                        Todos los pisos
                    </button>
                    {levels.map((level) => (
                        <button
                            key={level.id}
                            type="button"
                            role="tab"
                            aria-selected={activeLevelId === level.id}
                            onClick={() => {
                                setSelectedLevelId(level.id);
                                setSelectedRoomName('all');
                            }}
                            className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition ${
                                activeLevelId === level.id
                                    ? 'border-cyan-500/60 bg-cyan-950/60 text-cyan-200'
                                    : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}>
                            <span className="block font-semibold">{level.name}</span>
                            <span className="text-[10px] opacity-70">
                                {rows.filter((row) => row.levelId === level.id).length}{' '}
                                ambiente(s)
                            </span>
                        </button>
                    ))}
                </div>

                <div
                    role="tablist"
                    aria-label="Recintos del nivel seleccionado"
                    className="flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 p-2">
                    <Building2 size={14} className="ml-1 shrink-0 text-amber-300" />
                    {['all', ...roomNames].map((roomName) => {
                        const isAll = roomName === 'all';
                        return (
                            <button
                                key={roomName}
                                type="button"
                                role="tab"
                                aria-selected={activeRoomName === roomName}
                                onClick={() => setSelectedRoomName(roomName)}
                                className={`shrink-0 rounded-md px-3 py-1.5 text-xs transition ${
                                    activeRoomName === roomName
                                        ? 'bg-slate-700 text-white'
                                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                                }`}>
                                {isAll ? 'Todos los recintos' : roomName}
                            </button>
                        );
                    })}
                </div>
            </div>

            {activeLevelId === 'all' && levels.length > 1 && (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {levels.map((level) => {
                        const rowsForLevel = filteredRows.filter(
                            (row) => row.levelId === level.id,
                        );
                        const compliantForLevel = rowsForLevel.filter(
                            (row) =>
                                row.avgLux >= row.illuminanceLux &&
                                row.uniformity >= 0.4,
                        ).length;

                        return (
                            <button
                                key={level.id}
                                type="button"
                                onClick={() => {
                                    setSelectedLevelId(level.id);
                                    setSelectedRoomName('all');
                                }}
                                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-left transition hover:border-cyan-800/70 hover:bg-cyan-950/20">
                                <p className="font-semibold text-white">{level.name}</p>
                                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                    <span>Ambientes: {rowsForLevel.length}</span>
                                    <span>
                                        Luminarias:{' '}
                                        {rowsForLevel.reduce(
                                            (sum, row) => sum + row.fixtureCount,
                                            0,
                                        )}
                                    </span>
                                    <span>
                                        Lux prom.:{' '}
                                        {(
                                            rowsForLevel.reduce(
                                                (sum, row) => sum + row.avgLux,
                                                0,
                                            ) / rowsForLevel.length
                                        ).toFixed(0)}
                                    </span>
                                    <span className="text-emerald-300">
                                        Cumplen: {compliantForLevel}/{rowsForLevel.length}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Ambientes
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                        {filteredRows.length}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Luminarias
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-amber-300">
                        {filteredRows.reduce((sum, row) => sum + row.fixtureCount, 0)}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Lux Promedio
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-cyan-300">
                        {(
                            filteredRows.reduce((sum, row) => sum + row.avgLux, 0) /
                            filteredRows.length
                        ).toFixed(0)}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Cumplen
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-300">
                        {compliantRooms}/{filteredRows.length}
                    </p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 shadow-2xl">
                <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
                    <TableProperties size={16} className="text-cyan-300" />
                    <div>
                        <h3 className="text-sm font-semibold text-white">
                            Resultado por ambiente
                        </h3>
                        <p className="text-xs text-slate-400">
                            El calculo de luminarias y el isolux se resuelven con
                            el area del ambiente derivado, mientras que la normativa
                            aplicada proviene del recinto.
                        </p>
                    </div>
                </div>

                <div className="max-h-[65vh] overflow-auto">
                    <table className="min-w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-950/95 text-center backdrop-blur">
                            <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.18em] text-slate-500">
                                <th className="px-2 py-2">Ambiente</th>
                                <th className="px-2 py-2">Area</th>
                                <th className="px-2 py-2">Aplicación</th>
                                <th className="px-2 py-2">Norma</th>
                                <th className="px-2 py-2">Luminarias</th>
                                <th className="px-2 py-2">Lm/Foco</th>
                                <th className="px-2 py-2">Lm Req.</th>
                                <th className="px-2 py-2">Cant.</th>
                                <th className="px-2 py-2">E avg</th>
                                <th className="px-2 py-2">E min</th>
                                <th className="px-2 py-2">E max</th>
                                <th className="px-2 py-2">Uo</th>
                                <th className="px-2 py-2">UGR</th>
                                <th className="px-2 py-2">Estado</th>
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
                                        <tr className="border-b border-slate-900/80 text-center text-slate-200">
                                        <td className="px-4 py-4">
                                            <div className="flex min-w-[190px] items-start gap-2">
                                                <Lightbulb
                                                    size={15}
                                                    className="mt-0.5 text-amber-300"
                                                />
                                                <div>
                                                    <p className="font-semibold text-white">
                                                        {row.roomName}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                         {row.sourceRoomName
                                                            ? `${row.levelName} · Recinto: ${row.sourceRoomName}`
                                                            : row.normativeLabel ??
                                                              `Uniformidad est.: ${(row.estimatedUniformity * 100).toFixed(0)}%`}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            {row.area.toFixed(2)} m²
                                        </td>
                                        <td className="px-4 py-4 text-xs">
                                            {row.activityName ?? '-'}
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            {row.illuminanceLux} lux
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            {row.fixtureCount}
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            <div>
                                                {row.fixtureLumens.toLocaleString('es-PE')}
                                            </div>
                                            <div className="text-slate-500">
                                                {row.fixtureLumensSource === 'detected'
                                                    ? 'Detectado'
                                                    : 'Respaldo'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            {row.lumensRequired.toFixed(0)}
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            <div>{row.fixtureCount} inst.</div>
                                            <div className="text-slate-500">
                                                {row.exactQuantity.toFixed(2)} calc. /{' '}
                                                {row.roundedQuantity} red.
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            {row.avgLux.toFixed(0)}
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            {row.minLux.toFixed(0)}
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            {row.maxLux.toFixed(0)}
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            {row.uniformity.toFixed(3)}
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            {row.ugr.toFixed(1)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                {statusIcon(
                                                    luxOk && uniformityOk && ugrOk,
                                                    warn,
                                                )}
                                                <span
                                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                                        coverageStyles[row.coverage]
                                                    }`}>
                                                    {coverageLabels[row.coverage]}
                                                </span>
                                            </div>
                                            {row.fixtureCount < row.roundedQuantity && (
                                                <p className="mt-2 text-xs font-semibold text-amber-400">
                                                    Faltan {row.roundedQuantity - row.fixtureCount}{' '}
                                                    luminaria(s) según normativa
                                                </p>
                                            )}
                                            <p className="mt-2 text-xs text-slate-500">
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
            </div>
        </div>
    );
};
