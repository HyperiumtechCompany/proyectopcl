import React, { memo } from 'react';
import type { ElectricalDevice, ElectricalDeviceType } from '@/hooks/dialux/types';
import { safeNum } from './canvasUtils';

interface Props {
    devices: ElectricalDevice[];
    selectedId: string | null;
    zoom: number;
    onSelect: (id: string | null) => void;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    screenDistance: (dx: number, dy: number, origin?: { x: number; y: number }) => number;
}

/**
 * Physical half-dimensions in METERS per device type.
 * Values match real normative dimensions from CAD legend.
 * screenDistance() converts these to screen pixels at the current zoom/calibration.
 */
const PHYS: Record<ElectricalDeviceType, { hw: number; hh: number }> = {
    meter:             { hw: 0.30, hh: 0.20 },
    main_panel:        { hw: 0.40, hh: 0.25 },
    sub_panel:         { hw: 0.35, hh: 0.20 },
    transfer_switch:   { hw: 0.30, hh: 0.20 },
    arrival_panel:     { hw: 0.35, hh: 0.20 },
    junction_box:      { hw: 0.15, hh: 0.15 },
    earth_pit:         { hw: 0.20, hh: 0.20 },
    facp:              { hw: 0.35, hh: 0.20 },
    outlet_floor:      { hw: 0.15, hh: 0.15 },
    outlet_waterproof: { hw: 0.15, hh: 0.15 },
    outlet_ceiling:    { hw: 0.15, hh: 0.15 },
    outlet_rack:       { hw: 0.15, hh: 0.15 },
};
const MIN_PX = 8;

// ─── Symbol renderers ─────────────────────────────────────────────────────────

function MeterSymbol({ hw, hh, stroke }: { hw: number; hh: number; stroke: string }) {
    const fs = Math.max(4, hh * 0.55);
    return (
        <>
            <rect x={-hw} y={-hh} width={hw * 2} height={hh * 2}
                fill="none" stroke={stroke} strokeWidth={1.8} rx={1} />
            <text x={0} y={-hh * 0.2} textAnchor="middle" dominantBaseline="middle"
                fontSize={fs} fontWeight="bold" fill={stroke} fontFamily="monospace">kWh</text>
            <text x={0} y={hh * 0.5} textAnchor="middle" dominantBaseline="middle"
                fontSize={fs * 0.85} fill={stroke} fontFamily="monospace">3Ø</text>
        </>
    );
}

function PanelSymbol({ hw, hh, stroke, label }: { hw: number; hh: number; stroke: string; label: string }) {
    const termR = Math.max(2, hh * 0.18);
    const bodyHw = hw - termR * 2.5;
    const labelFs = Math.max(5, hh * 0.55);
    const tPos = [-hh * 0.35, 0, hh * 0.35];
    return (
        <>
            <text x={0} y={-hh - 2} textAnchor="middle" dominantBaseline="auto"
                fontSize={labelFs} fontWeight="bold" fill={stroke} fontFamily="monospace">{label}</text>
            {tPos.map((dy, i) => (
                <circle key={`l${i}`} cx={-bodyHw - termR * 1.5} cy={dy} r={termR}
                    fill="none" stroke={stroke} strokeWidth={1.2} />
            ))}
            {tPos.map((dy, i) => (
                <circle key={`r${i}`} cx={bodyHw + termR * 1.5} cy={dy} r={termR}
                    fill="none" stroke={stroke} strokeWidth={1.2} />
            ))}
            <rect x={-bodyHw} y={-hh} width={bodyHw * 2} height={hh * 2}
                fill={stroke} stroke={stroke} strokeWidth={1.5} />
            <polygon
                points={`${-bodyHw + 1},${-hh + 1} ${bodyHw - 1},${hh - 1} ${-bodyHw + 1},${hh - 1}`}
                fill="white" />
        </>
    );
}

function ATSSymbol({ hw, hh, stroke }: { hw: number; hh: number; stroke: string }) {
    const fs = Math.max(5, hh * 0.65);
    return (
        <>
            <rect x={-hw - 2} y={-hh - 2} width={(hw + 2) * 2} height={(hh + 2) * 2}
                fill="none" stroke={stroke} strokeWidth={2} rx={1} />
            <rect x={-hw} y={-hh} width={hw * 2} height={hh * 2}
                fill={stroke} stroke={stroke} strokeWidth={1} />
            <text x={0} y={0} textAnchor="middle" dominantBaseline="middle"
                fontSize={fs} fontWeight="bold" fill="white" fontFamily="monospace">ATS</text>
        </>
    );
}

function JunctionBoxSymbol({ hw, hh, stroke }: { hw: number; hh: number; stroke: string }) {
    const pad = Math.min(3, hw * 0.25);
    return (
        <>
            <rect x={-hw} y={-hh} width={hw * 2} height={hh * 2}
                fill="none" stroke={stroke} strokeWidth={1.8} />
            <rect x={-hw + pad} y={-hh + pad} width={(hw - pad) * 2} height={(hh - pad) * 2}
                fill="none" stroke={stroke} strokeWidth={1} />
            <line x1={-hw + pad} y1={-hh + pad} x2={hw - pad} y2={hh - pad}
                stroke={stroke} strokeWidth={1.2} />
            <line x1={hw - pad} y1={-hh + pad} x2={-hw + pad} y2={hh - pad}
                stroke={stroke} strokeWidth={1.2} />
        </>
    );
}

/**
 * Pozo de Puesta a Tierra (PAT) — yellow circle outline (no fill).
 * Matches CAD legend: simple circle.
 */
function EarthPitSymbol({ r, stroke }: { r: number; stroke: string }) {
    return (
        <circle r={r} fill="none" stroke={stroke} strokeWidth={2} />
    );
}

/**
 * F.A.C.P. — Central de Contraincendios.
 * Cyan/turquoise rectangle with "F.A.C.P." text badge, matching CAD legend.
 */
function FacpSymbol({ hw, hh, stroke }: { hw: number; hh: number; stroke: string }) {
    const fs = Math.max(4, Math.min(hh * 0.7, 10));
    return (
        <>
            <rect x={-hw} y={-hh} width={hw * 2} height={hh * 2}
                fill="none" stroke={stroke} strokeWidth={2} rx={2} />
            <text x={0} y={0} textAnchor="middle" dominantBaseline="middle"
                fontSize={fs} fontWeight="bold" fill={stroke} fontFamily="monospace"
                style={{ userSelect: 'none' }}>F.A.C.P.</text>
        </>
    );
}

/**
 * Tomacorriente Schuko + 3 en línea con PAT.
 * CAD symbol: two concentric circles with horizontal lines (outlet) + letter tag.
 * stroke color: green (floor/ceiling) | blue (waterproof) | red (rack)
 */
function WallOutletSymbol({
    r,
    stroke,
    waterproof = false,
}: {
    r: number;
    stroke: string;
    waterproof?: boolean;
}) {
    const fs = Math.max(5, r * 0.72);
    const textX = r + 4;

    return (
        <>
            <circle r={r} fill="none" stroke={stroke} strokeWidth={1.5} />
            <line x1={-r} y1={0} x2={r} y2={0} stroke={stroke} strokeWidth={1.4} />
            <text
                x={textX}
                y={2}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={fs}
                fontWeight="bold"
                fill="#facc15"
                fontFamily="monospace"
                style={{ userSelect: 'none' }}
            >
                T
            </text>
            {waterproof && (
                <>
                    <text
                        x={textX}
                        y={-fs * 0.72}
                        textAnchor="start"
                        dominantBaseline="middle"
                        fontSize={fs * 0.75}
                        fontWeight="bold"
                        fill="#ef4444"
                        fontFamily="monospace"
                        style={{ userSelect: 'none' }}
                    >
                        AP
                    </text>
                    <text
                        x={textX}
                        y={fs * 0.95}
                        textAnchor="start"
                        dominantBaseline="middle"
                        fontSize={fs * 0.62}
                        fontWeight="bold"
                        fill="#ef4444"
                        fontFamily="monospace"
                        style={{ userSelect: 'none' }}
                    >
                        1.20m
                    </text>
                </>
            )}
        </>
    );
}

function CeilingOutletSymbol({ r, stroke }: { r: number; stroke: string }) {
    return (
        <>
            <line x1={-r * 1.6} y1={-r * 0.7} x2={r * 1.25} y2={-r * 0.7} stroke={stroke} strokeWidth={1.4} />
            <line x1={-r * 0.95} y1={-r * 0.7} x2={-r * 0.95} y2={r * 1.8} stroke={stroke} strokeWidth={1.4} />
            <line x1={0} y1={-r * 0.7} x2={0} y2={r * 1.8} stroke={stroke} strokeWidth={1.4} />
            <line x1={r * 0.95} y1={-r * 0.7} x2={r * 0.95} y2={r * 1.8} stroke={stroke} strokeWidth={1.4} />
            <circle cx={r * 1.25} cy={-r * 0.7} r={r * 0.45} fill={stroke} stroke={stroke} strokeWidth={1} />
        </>
    );
}

function RackOutletSymbol({ r, stroke }: { r: number; stroke: string }) {
    const fs = Math.max(5, r * 0.7);

    return (
        <>
            <rect
                x={-r * 1.35}
                y={-r * 0.8}
                width={r * 2.7}
                height={r * 1.6}
                fill="none"
                stroke={stroke}
                strokeWidth={1.5}
                rx={2}
            />
            <text
                x={0}
                y={2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fs}
                fontWeight="bold"
                fill={stroke}
                fontFamily="monospace"
                style={{ userSelect: 'none' }}
            >
                TR
            </text>
        </>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const OverlayElectricalDevices = memo(function OverlayElectricalDevices({
    devices,
    selectedId,
    zoom,
    onSelect,
    screenPoint,
    screenDistance,
}: Props) {
    if (!devices.length) return null;

    return (
        <g className="overlay-electrical-devices">
            {devices.map((dev) => {
                const fp = screenPoint({ x: dev.x, y: dev.y });
                const isSelected = selectedId === dev.id;
                const phys = PHYS[dev.type as ElectricalDeviceType] || { hw: 0.15, hh: 0.15 };
                const origin = { x: dev.x, y: dev.y };

                // Convert physical metres → screen pixels (same as luminaires).
                const hw = Math.max(MIN_PX, screenDistance(phys.hw, 0, origin));
                const hh = Math.max(MIN_PX * (phys.hh / phys.hw), screenDistance(0, phys.hh, origin));

                // Palette per device type
                const colorMap: Record<string, string> = {
                    meter:             '#22c55e',
                    main_panel:        '#ef4444',
                    sub_panel:         '#ef4444',
                    transfer_switch:   '#ef4444',
                    arrival_panel:     '#ef4444',
                    junction_box:      '#22c55e',
                    earth_pit:         '#eab308', // yellow circle
                    facp:              '#06b6d4', // cyan
                    outlet_floor:      '#22c55e',
                    outlet_waterproof: '#3b82f6', // blue
                    outlet_ceiling:    '#22c55e',
                    outlet_rack:       '#ef4444',
                };
                const baseColor = isSelected ? '#f59e0b' : (colorMap[dev.type] || '#22c55e');
                return (
                    <g
                        key={dev.id}
                        transform={`translate(${safeNum(fp.x)}, ${safeNum(fp.y)})`}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); onSelect(dev.id); }}
                    >
                        {/* Selection indicator */}
                        {isSelected && (
                            <rect x={-hw - 5} y={-hh - 5} width={(hw + 5) * 2} height={(hh + 5) * 2}
                                fill="none" stroke="#f59e0b" strokeWidth={1.5}
                                strokeDasharray="3 2" rx={3} />
                        )}

                        {/* Symbol body */}
                        {dev.type === 'meter' && <MeterSymbol hw={hw} hh={hh} stroke={baseColor} />}
                        {dev.type === 'main_panel' && <PanelSymbol hw={hw} hh={hh} stroke={baseColor} label="TG" />}
                        {dev.type === 'sub_panel' && <PanelSymbol hw={hw} hh={hh} stroke={baseColor} label="TD" />}
                        {dev.type === 'transfer_switch' && <ATSSymbol hw={hw} hh={hh} stroke={baseColor} />}
                        {dev.type === 'arrival_panel' && <PanelSymbol hw={hw} hh={hh} stroke={baseColor} label="TL" />}
                        {dev.type === 'junction_box' && <JunctionBoxSymbol hw={hw} hh={hh} stroke={baseColor} />}
                        {dev.type === 'earth_pit' && <EarthPitSymbol r={hw} stroke={baseColor} />}
                        {dev.type === 'facp' && <FacpSymbol hw={hw} hh={hh} stroke={baseColor} />}
                        
                        {dev.type === 'outlet_floor' && (
                            <WallOutletSymbol r={hw} stroke={baseColor} />
                        )}
                        {dev.type === 'outlet_waterproof' && (
                            <WallOutletSymbol r={hw} stroke={baseColor} waterproof />
                        )}
                        {dev.type === 'outlet_ceiling' && (
                            <CeilingOutletSymbol r={hw} stroke="#f8fafc" />
                        )}
                        {dev.type === 'outlet_rack' && (
                            <RackOutletSymbol r={hw} stroke={baseColor} />
                        )}

                        {/* Label below (ocultado por solicitud del usuario por ahora)
                        <text
                            x={0} y={hh + labelFs + 2}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={labelFs}
                            fontWeight={isSelected ? 'bold' : 'normal'}
                            fill={isSelected ? '#f59e0b' : baseColor}
                            fontFamily="'Courier New', monospace"
                            pointerEvents="none"
                        >
                            {dev.label}
                        </text> */}

                        {/* Center anchor dot */}
                        <circle cx={0} cy={0} r={1.5} fill={baseColor} opacity={0.6} pointerEvents="none" />
                    </g>
                );
            })}
        </g>
    );
});
