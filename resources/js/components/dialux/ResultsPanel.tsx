import {
    AlertTriangle,
    CheckCircle,
    Lightbulb,
    TableProperties,
    XCircle,
} from 'lucide-react';
import React from 'react';
import { buildRoomLightingInputs } from '@/hooks/dialux/roomLighting';
import type { Fixture, LightingResult, Room } from '@/hooks/dialux/useEditorStore';

export interface RoomResultSummary {
    room: Room;
    fixtures: Fixture[];
    result: LightingResult;
    sourceRoomName?: string;
}

interface ResultsPanelProps {
    rooms: RoomResultSummary[];
}

interface RoomTableRow {
    id: string;
    sourceRoomName: string | null;
    roomName: string;
    activityName: string | null;
    normativeSection: string | null;
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

function buildTableRows(rooms: RoomResultSummary[]): RoomTableRow[] {
    return rooms.map(({ room, fixtures, result, sourceRoomName }) => {
        const inputs = buildRoomLightingInputs(room, fixtures);

        return {
            id: room.id,
            sourceRoomName: sourceRoomName ?? null,
            roomName: room.name,
            activityName: room.normativeActivity ?? null,
            normativeSection: room.normativeSection ?? null,
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

    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-center">
                <p className="text-base text-slate-400">
                    No hay resultados disponibles para mostrar.
                </p>
            </div>
        );
    }

    const compliantRooms = rows.filter(
        (row) => row.avgLux >= row.illuminanceLux && row.uniformity >= 0.4,
    ).length;

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Ambientes
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                        {rows.length}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Luminarias
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-amber-300">
                        {rows.reduce((sum, row) => sum + row.fixtureCount, 0)}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Lux Promedio
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-cyan-300">
                        {(
                            rows.reduce((sum, row) => sum + row.avgLux, 0) / rows.length
                        ).toFixed(0)}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Cumplen
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-300">
                        {compliantRooms}/{rows.length}
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
                            y la jerarquia provienen del recinto.
                        </p>
                    </div>
                </div>

                <div className="max-h-[65vh] overflow-auto">
                    <table className="min-w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-950/95 text-center backdrop-blur">
                            <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.18em] text-slate-500">
                                <th className="px-2 py-2">Ambiente</th>
                                <th className="px-2 py-2">Area</th>
                                <th className="px-2 py-2">Jerarquia</th>
                                <th className="px-2 py-2">Tipo</th>
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
                            {rows.map((row) => {
                                const luxOk = row.avgLux >= row.illuminanceLux;
                                const uniformityOk = row.uniformity >= 0.4;
                                const ugrOk = row.ugr <= 22;
                                const warn = luxOk && (!uniformityOk || !ugrOk);

                                return (
                                    <tr
                                        key={row.id}
                                        className="border-b border-slate-900/80 text-center text-slate-200">
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
                                                            ? `Recinto: ${row.sourceRoomName}`
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
                                            {row.normativeSection ?? '-'}
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
                                            <p className="mt-2 text-xs text-slate-500">
                                                {luxOk ? 'Lux OK' : 'Lux bajo'} ·{' '}
                                                {uniformityOk ? 'Uo OK' : 'Uo bajo'} ·{' '}
                                                {ugrOk ? 'UGR OK' : 'UGR alto'}
                                            </p>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
