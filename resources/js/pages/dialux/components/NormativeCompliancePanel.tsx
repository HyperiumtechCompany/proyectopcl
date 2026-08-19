/**
 * NormativeCompliancePanel.tsx
 *
 * Dashboard de cumplimiento normativo global.
 * Muestra un semÃ¡foro visual por ambiente comparando resultados calculados
 * vs umbrales normativos (Em, Uo, UGR, Ra).
 */

import {
    AlertTriangle,
    CheckCircle2,
    Info,
    Scale,
    XCircle,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
    type ComplianceResult,
    type ComplianceStatus,
    computeOverallStatus,
    evaluateCompliance,
    findBestMatchActivity,
    NORMATIVE_STANDARDS_META,
} from '@/pages/dialux/hooks/normativeEngine';
import type { LightingResult, Room } from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { NormativeComparisonModal } from './NormativeComparisonModal';

// â”€â”€â”€ Tipos locales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type FilterStatus = 'all' | ComplianceStatus;

interface RoomComplianceRow {
    room: Room;
    result: LightingResult | null;
    overallStatus: ComplianceStatus;
    params: ComplianceResult[];
    normativeName: string | null;
    activityLabel: string | null;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function statusIcon(status: ComplianceStatus, size = 13) {
    switch (status) {
        case 'compliant':    return <CheckCircle2 size={size} className="text-emerald-400" />;
        case 'warning':      return <AlertTriangle size={size} className="text-amber-400" />;
        case 'non_compliant': return <XCircle size={size} className="text-red-400" />;
        case 'needs_review': return <Info size={size} className="text-slate-600 dark:text-slate-400" />;
    }
}

function statusLabel(status: ComplianceStatus): string {
    switch (status) {
        case 'compliant':    return 'Cumple';
        case 'warning':      return 'Advertencia';
        case 'non_compliant': return 'No cumple';
        case 'needs_review': return 'Revisar';
    }
}

function statusBadgeCls(status: ComplianceStatus): string {
    switch (status) {
        case 'compliant':    return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50';
        case 'warning':      return 'bg-amber-950/60 text-amber-300 border-amber-800/50';
        case 'non_compliant': return 'bg-red-950/60 text-red-300 border-red-800/50';
        case 'needs_review': return 'bg-slate-200 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700/50';
    }
}

function paramValueCell(param: ComplianceResult) {
    const calc = param.calculatedValue !== null ? param.calculatedValue.toFixed(param.unit === 'lux' ? 0 : 3) : 'â€”';
    const req  = param.requiredValue !== null ? param.requiredValue.toFixed(param.unit === 'lux' ? 0 : 3) : 'â€”';
    const colorCls = {
        compliant:    'text-emerald-400',
        warning:      'text-amber-400',
        non_compliant: 'text-red-400',
        needs_review: 'text-slate-500',
    }[param.status];
    return (
        <td key={param.parameterId} className="px-2 py-2 text-center font-mono text-[10px]">
            <span className={colorCls}>{calc}</span>
            {param.unit === 'lux' && <span className="text-slate-700"> lx</span>}
            <span className="mx-0.5 text-slate-700">/</span>
            <span className="text-slate-600">{req}{param.unit === 'lux' ? ' lx' : ''}</span>
        </td>
    );
}

// â”€â”€â”€ KPI Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KpiCards({ rows }: { rows: RoomComplianceRow[] }) {
    const total        = rows.length;
    const compliant    = rows.filter((r) => r.overallStatus === 'compliant').length;
    const warnings     = rows.filter((r) => r.overallStatus === 'warning').length;
    const nonCompliant = rows.filter((r) => r.overallStatus === 'non_compliant').length;
    const needsReview  = rows.filter((r) => r.overallStatus === 'needs_review').length;

    const cards = [
        { label: 'Ambientes', value: total,        cls: 'text-white' },
        { label: 'Cumplen',   value: compliant,    cls: 'text-emerald-400' },
        { label: 'Aviso',     value: warnings,     cls: 'text-amber-400' },
        { label: 'No cumplen',value: nonCompliant, cls: 'text-red-400' },
        { label: 'Revisar',   value: needsReview,  cls: 'text-slate-600 dark:text-slate-400' },
    ];

    return (
        <div className="grid grid-cols-5 gap-1.5">
            {cards.map((c) => (
                <div key={c.label} className="rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-900/50 p-2 text-center">
                    <p className={`text-base font-bold ${c.cls}`}>{c.value}</p>
                    <p className="text-[8px] text-slate-600 leading-tight">{c.label}</p>
                </div>
            ))}
        </div>
    );
}

// â”€â”€â”€ Expanded Room Detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RoomParamDetails({ params }: { params: ComplianceResult[] }) {
    return (
        <div className="mt-2 space-y-1 rounded-lg bg-slate-300 dark:bg-slate-950/50 p-2">
            {params.map((p) => (
                <div key={p.parameterId} className="flex items-center gap-2">
                    {statusIcon(p.status, 11)}
                    <span className="w-36 text-[9px] text-slate-500">{p.parameterName}</span>
                    <span className="font-mono text-[9px] text-slate-700 dark:text-slate-300">
                        {p.calculatedValue !== null ? p.calculatedValue.toFixed(p.unit === 'lux' ? 0 : 3) : 'â€”'}
                        {p.unit === 'lux' ? ' lx' : ''}
                        {p.requiredValue !== null ? (
                            <span className="text-slate-600">
                                {' '}/ {p.requiredValue.toFixed(p.unit === 'lux' ? 0 : 3)}{p.unit === 'lux' ? ' lx' : ''} requerido
                            </span>
                        ) : null}
                    </span>
                </div>
            ))}
        </div>
    );
}

// â”€â”€â”€ Panel principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const NormativeCompliancePanel: React.FC = () => {
    const scene = useEditorStore((s) => s.activeScene());
    const resultsByRoom = useEditorStore((s) => s.resultsByRoom);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
    const [comparisonActivity, setComparisonActivity] = useState<string | null>(null);

    const rows = useMemo<RoomComplianceRow[]>(() => {
        if (!scene) return [];

        return scene.rooms.map((room) => {
            const result = resultsByRoom[room.id] ?? null;
            const normLeaf = room.normativeActivity && room.normativeStandard
                ? findBestMatchActivity(room.normativeStandard, room.normativeActivity, room.normativeCategory)
                : null;

            let overallStatus: ComplianceStatus = 'needs_review';
            let params: ComplianceResult[] = [];

            if (result && normLeaf) {
                const standard = room.normativeStandard ?? 'en_12464_1';
                const meta = NORMATIVE_STANDARDS_META[standard] ?? undefined;
                const roomFixtures = scene.fixtures.filter(
                    (fixture) => fixture.roomId === room.id,
                );
                params = evaluateCompliance(room, result, normLeaf, meta, roomFixtures);
                overallStatus = computeOverallStatus(params);
            }

            return {
                room,
                result,
                overallStatus,
                params,
                normativeName: room.normativeStandard
                    ? (NORMATIVE_STANDARDS_META[room.normativeStandard]?.name ?? null)
                    : null,
                activityLabel: room.normativeActivity ?? room.normativeSection ?? null,
            };
        });
    }, [scene, resultsByRoom]);

    const filteredRows = useMemo(() =>
        filterStatus === 'all' ? rows : rows.filter((r) => r.overallStatus === filterStatus),
    [rows, filterStatus]);

    if (!scene || scene.rooms.length === 0) {
        return (
            <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-900/40 p-5 text-center">
                <Scale size={24} className="mx-auto mb-2 text-slate-700" />
                <p className="text-xs text-slate-500">
                    No hay recintos para validar.<br />
                    Dibuja recintos en el plano 2D para comenzar.
                </p>
            </div>
        );
    }

    const filterOptions: Array<{ key: FilterStatus; label: string }> = [
        { key: 'all',          label: 'Todos' },
        { key: 'compliant',    label: 'Cumplen' },
        { key: 'warning',      label: 'Aviso' },
        { key: 'non_compliant', label: 'No cumplen' },
        { key: 'needs_review', label: 'Revisar' },
    ];

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Scale size={13} className="text-blue-400" />
                <h3 className="text-xs font-semibold text-white">Cumplimiento Normativo</h3>
            </div>

            {/* KPI */}
            <KpiCards rows={rows} />

            {/* Filtros */}
            <div className="flex flex-wrap gap-1">
                {filterOptions.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilterStatus(f.key)}
                        className={[
                            'rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-colors',
                            filterStatus === f.key
                                ? 'border-blue-600/50 bg-blue-950/60 text-blue-300'
                                : 'border-slate-300 dark:border-slate-800 text-slate-500 hover:text-slate-600 dark:text-slate-400',
                        ].join(' ')}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Sin resultados del filtro */}
            {filteredRows.length === 0 && (
                <p className="py-4 text-center text-[10px] text-slate-600">
                    Sin ambientes con estado "{filterStatus}".
                </p>
            )}

            {/* Lista de ambientes */}
            <div className="space-y-1.5">
                {filteredRows.map(({ room, overallStatus, params, normativeName, activityLabel }) => {
                    const isExpanded = expandedRoomId === room.id;
                    return (
                        <div
                            key={room.id}
                            className="rounded-lg border border-slate-300 dark:border-slate-800/70 bg-slate-200 dark:bg-slate-900/40 overflow-hidden"
                        >
                            <button
                                onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-200 dark:bg-slate-800/30 transition-colors"
                            >
                                {statusIcon(overallStatus)}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                                        {room.name}
                                    </p>
                                    <p className="text-[9px] text-slate-600">
                                        {activityLabel ?? 'Sin actividad'}
                                        {normativeName && <span className="text-slate-700"> Â· {normativeName}</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${statusBadgeCls(overallStatus)}`}>
                                        {statusLabel(overallStatus)}
                                    </span>
                                    {activityLabel && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setComparisonActivity(activityLabel);
                                            }}
                                            title="Comparar entre normas"
                                            className="rounded p-0.5 text-slate-600 hover:text-slate-600 dark:text-slate-400"
                                        >
                                            <Scale size={11} />
                                        </button>
                                    )}
                                </div>
                            </button>

                            {isExpanded && params.length > 0 && (
                                <div className="px-3 pb-3">
                                    <RoomParamDetails params={params} />
                                </div>
                            )}

                            {isExpanded && params.length === 0 && (
                                <div className="px-3 pb-3">
                                    <p className="text-[9px] text-slate-600">
                                        Ejecuta el cÃ¡lculo lumÃ­nico y asigna una actividad normativa para ver el detalle.
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal de comparaciÃ³n */}
            {comparisonActivity && (
                <NormativeComparisonModal
                    activitySearchText={comparisonActivity}
                    onClose={() => setComparisonActivity(null)}
                />
            )}

            {/* Nota de trazabilidad */}
            <div className="rounded-lg border border-slate-300 dark:border-slate-800/50 bg-slate-200 dark:bg-slate-900/30 p-2.5">
                <p className="text-[9px] leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-500">Nota: </span>
                    Los valores de cumplimiento se calculan comparando los resultados del motor lumÃ­nico
                    (Em calculado, Uo, UGR) con los umbrales normativos de la actividad asignada a cada recinto.
                    La validaciÃ³n de Ra requiere especificar el IRC de la luminaria seleccionada.
                </p>
            </div>
        </div>
    );
};

