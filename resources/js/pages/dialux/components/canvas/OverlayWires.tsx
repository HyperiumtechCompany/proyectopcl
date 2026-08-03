import React, { memo } from 'react';
import {
    type Conductor,
    type LightSwitch,
    type Fixture,
    type ElectricalDevice,
} from '@/pages/dialux/hooks/types';
import { safeNum } from './canvasUtils';

interface Props {
    conductors: Conductor[];
    lightSwitches: LightSwitch[];
    fixtures: Fixture[];
    electricalDevices?: ElectricalDevice[];
    zoom: number;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    selectedId?: string | null;
    selectedConductorIds?: string[];
    onSelect?: (id: string) => void;
    activeTool?: string;
    showLegacyLightingWires?: boolean;
    /** Extremo del conductor seleccionado que se está arrastrando para reconectarlo */
    reconnectPreview?: {
        conductorId: string;
        endpoint: 'source' | 'target';
        point: { x: number; y: number };
    } | null;
}

const WIRE_COLOR = '#ef4444';
const WIRE_SELECTED = '#facc15';
const LEGACY_COLOR = '#94a3b8';
const DEVICE_WIRE_COLOR = '#f97316';
const HANDLE_COLOR = '#facc15';
const HANDLE_RADIUS = 5;

/**
 * Draw conductor-count marks at the midpoint of the Bezier curve.
 * The marks are drawn in screen-pixel coordinates but scaled with zoom
 * so they remain readable at any zoom level.
 *
 * Assignment (matching standard electrical CAD notation):
 *   count ≥ 3  → [0]=T(tierra)  [1]=N(neutro)  [2..]=F(fase)
 *   count = 2  → [0]=N           [1]=F
 *   count = 1  → [0]=F
 */
function tickMarks(
    a: { x: number; y: number },
    b: { x: number; y: number },
    cpx: number,
    cpy: number,
    count: number,
    color: string,
    keyPrefix: string,
    zoom: number,
): React.ReactElement[] {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 2) return [];

    // Unit tangent along segment (used for spacing along wire)
    const ux = dx / len;
    const uy = dy / len;
    // Unit normal (perpendicular to wire, pointing "up")
    const nx = -uy;
    const ny = ux;

    // Point on Bezier at t=0.5 (exact curve position)
    const midX = 0.25 * a.x + 0.5 * cpx + 0.25 * b.x;
    const midY = 0.25 * a.y + 0.5 * cpy + 0.25 * b.y;

    const scale = Math.min(Math.max(zoom, 0.4), 2.0);
    const halfTick = Math.min(Math.max(4.5 * scale, 3.5), 9);
    const tBarHalf = halfTick * 0.6;
    const circleR  = Math.min(Math.max(1.8 * scale, 1.5), 3.5);
    const spacing  = Math.min(Math.max(3.5 * scale, 2.5), 8);
    const sw       = Math.min(Math.max(1.5 * scale, 1), 2.5);

    return Array.from({ length: count }, (_, i) => {
        const off = (i - (count - 1) / 2) * spacing;
        const tx = midX + ux * off;
        const ty = midY + uy * off;

        let type = 'F';
        if (count >= 3) {
            if (i === 0) type = 'T';
            else if (i === 1) type = 'N';
            // rest are 'F'
        } else if (count === 2) {
            if (i === 0) type = 'N';
        }

        // The vertical tick (common to all types)
        const x1 = safeNum(tx - nx * halfTick);
        const y1 = safeNum(ty - ny * halfTick);
        const x2 = safeNum(tx + nx * halfTick);
        const y2 = safeNum(ty + ny * halfTick);

        const elems: React.ReactNode[] = [
            <line
                key={`${keyPrefix}-tk${i}-line`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color}
                strokeWidth={sw}
                strokeLinecap="round"
                style={{ pointerEvents: 'none' }}
            />
        ];

        if (type === 'T') {
            // Horizontal crossbar at the TOP of the vertical tick → "T"
            elems.push(
                <line
                    key={`${keyPrefix}-tk${i}-t`}
                    x1={safeNum(tx + nx * halfTick - ux * tBarHalf)}
                    y1={safeNum(ty + ny * halfTick - uy * tBarHalf)}
                    x2={safeNum(tx + nx * halfTick + ux * tBarHalf)}
                    y2={safeNum(ty + ny * halfTick + uy * tBarHalf)}
                    stroke={color}
                    strokeWidth={sw}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                />
            );
        } else if (type === 'N') {
            // Filled circle at the top of the vertical tick → "●"
            elems.push(
                <circle
                    key={`${keyPrefix}-tk${i}-n`}
                    cx={safeNum(tx + nx * (halfTick + circleR))}
                    cy={safeNum(ty + ny * (halfTick + circleR))}
                    r={safeNum(circleR)}
                    fill={color}
                    style={{ pointerEvents: 'none' }}
                />
            );
        }
        // 'F' is just the plain vertical tick — no extra decoration

        return <g key={`${keyPrefix}-tk${i}`}>{elems}</g>;
    });
}

export const OverlayWires = memo(function OverlayWires({
    conductors,
    lightSwitches,
    fixtures,
    electricalDevices = [],
    zoom,
    screenPoint,
    selectedId,
    selectedConductorIds = [],
    onSelect,
    activeTool,
    showLegacyLightingWires = true,
    reconnectPreview = null,
}: Props) {
    const switchesWithConductors = new Set(
        conductors.flatMap(c => [c.sourceId, c.targetId])
    );
    const legacySwitches = showLegacyLightingWires ? lightSwitches.filter(
        (sw) =>
            !switchesWithConductors.has(sw.id) &&
            (sw.connectedFixtureIds?.length ?? 0) > 0,
    ) : [];

    if (conductors.length === 0 && legacySwitches.length === 0) return null;

    const interactive = activeTool === 'select' && Boolean(onSelect);

    return (
        <g className="overlay-wires">
            <defs>
                <marker id="arrow-device" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={DEVICE_WIRE_COLOR} />
                </marker>
                <marker id="arrow-cond" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={WIRE_COLOR} />
                </marker>
                <marker id="arrow-cond-sel" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={WIRE_SELECTED} />
                </marker>
            </defs>

            {/* ── Conductores ──────────────────────────────────────────────── */}
            {conductors.map((cond) => {
                const sourceNode =
                    lightSwitches.find(s => s.id === cond.sourceId) ||
                    fixtures.find(f => f.id === cond.sourceId) ||
                    electricalDevices.find(d => d.id === cond.sourceId);
                const targetNode =
                    lightSwitches.find(s => s.id === cond.targetId) ||
                    fixtures.find(f => f.id === cond.targetId) ||
                    electricalDevices.find(d => d.id === cond.targetId);

                if (!sourceNode || !targetNode) return null;

                const nodes = [
                    screenPoint({ x: sourceNode.x, y: sourceNode.y }),
                    ...(cond.waypoints || []).map(w => screenPoint(w)),
                    screenPoint({ x: targetNode.x, y: targetNode.y }),
                ];
                if (nodes.length < 2) return null;

                const isSelected =
                    cond.id === selectedId ||
                    selectedConductorIds.includes(cond.id);
                const isDeviceSource = electricalDevices.some(d => d.id === cond.sourceId);
                const wireColor = isSelected ? WIRE_SELECTED : (isDeviceSource ? DEVICE_WIRE_COLOR : WIRE_COLOR);
                const markerId  = isSelected ? 'arrow-cond-sel' : (isDeviceSource ? 'arrow-device' : 'arrow-cond');
                const isFloorRoute = cond.routeType === 'floor';
                const curveDir = isFloorRoute ? 1 : -1;
                const wireWidth = isSelected ? 2.5 : 1.8;

                const segPaths: string[] = [];
                const visElems: React.ReactNode[] = [];

                for (let i = 0; i < nodes.length - 1; i++) {
                    const a = nodes[i];
                    const b = nodes[i + 1];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const len = Math.hypot(dx, dy);
                    if (len < 0.5) continue;

                    const cpx = (a.x + b.x) / 2 + (-dy / len) * len * 0.18 * curveDir;
                    const cpy = (a.y + b.y) / 2 + ( dx / len) * len * 0.18 * curveDir;
                    const segKey = `${cond.id}-s${i}`;
                    const d = `M ${safeNum(a.x)} ${safeNum(a.y)} Q ${safeNum(cpx)} ${safeNum(cpy)} ${safeNum(b.x)} ${safeNum(b.y)}`;
                    segPaths.push(d);

                    visElems.push(
                        <path
                            key={segKey}
                            d={d}
                            fill="none"
                            stroke={wireColor}
                            strokeWidth={wireWidth}
                            strokeLinecap="round"
                            strokeDasharray={isFloorRoute ? '7,5' : undefined}
                            opacity={0.95}
                            markerEnd={i === nodes.length - 2 ? `url(#${markerId})` : undefined}
                            style={{ pointerEvents: 'none' }}
                        />,
                        ...tickMarks(a, b, cpx, cpy, cond.wireCount, wireColor, segKey, zoom),
                    );
                }

                if (visElems.length === 0) return null;

                // Handles de extremo: solo en el cable exactamente seleccionado
                // (no en todo el circuito agrupado), para arrastrarlos y
                // reconectar el cable a otro nodo sin borrarlo y re-trazarlo.
                const showHandles = interactive && cond.id === selectedId;
                const isBeingReconnected = reconnectPreview?.conductorId === cond.id;
                const endpointScreen = { source: nodes[0], target: nodes[nodes.length - 1] };

                return (
                    <g key={cond.id}>
                        {/* Selection glow */}
                        {isSelected && segPaths.map((d, i) => (
                            <path
                                key={`glow-${cond.id}-${i}`}
                                d={d}
                                fill="none"
                                stroke={WIRE_SELECTED}
                                strokeWidth={8}
                                strokeOpacity={0.25}
                                strokeDasharray={isFloorRoute ? '7,5' : undefined}
                                style={{ pointerEvents: 'none' }}
                            />
                        ))}
                        {/* Transparent hit area — only visible in select mode */}
                        {interactive && segPaths.map((d, i) => (
                            <path
                                key={`hit-${cond.id}-${i}`}
                                d={d}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={16}
                                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect!(cond.id);
                                }}
                            />
                        ))}
                        {visElems}
                        {/* Handles de extremo (arrastrables desde el SVG raíz) */}
                        {showHandles && (
                            <>
                                <circle
                                    cx={safeNum(endpointScreen.source.x)}
                                    cy={safeNum(endpointScreen.source.y)}
                                    r={HANDLE_RADIUS}
                                    fill={HANDLE_COLOR}
                                    stroke="#1e293b"
                                    strokeWidth={1.5}
                                    style={{ cursor: 'grab', pointerEvents: 'none' }}
                                />
                                <circle
                                    cx={safeNum(endpointScreen.target.x)}
                                    cy={safeNum(endpointScreen.target.y)}
                                    r={HANDLE_RADIUS}
                                    fill={HANDLE_COLOR}
                                    stroke="#1e293b"
                                    strokeWidth={1.5}
                                    style={{ cursor: 'grab', pointerEvents: 'none' }}
                                />
                            </>
                        )}
                        {/* Línea elástica mientras se arrastra un extremo para reconectar */}
                        {isBeingReconnected && (() => {
                            const fixedPoint =
                                reconnectPreview!.endpoint === 'source'
                                    ? endpointScreen.target
                                    : endpointScreen.source;
                            const movingPoint = screenPoint(reconnectPreview!.point);
                            return (
                                <line
                                    x1={safeNum(fixedPoint.x)}
                                    y1={safeNum(fixedPoint.y)}
                                    x2={safeNum(movingPoint.x)}
                                    y2={safeNum(movingPoint.y)}
                                    stroke={WIRE_SELECTED}
                                    strokeWidth={2}
                                    strokeDasharray="4,4"
                                    style={{ pointerEvents: 'none' }}
                                />
                            );
                        })()}
                    </g>
                );
            })}

            {/* ── Legado: connectedFixtureIds sin Conductor (gris punteado) ─ */}
            {legacySwitches.map((sw) => {
                const fixtureNodes = sw.connectedFixtureIds
                    .map((id) => fixtures.find((f) => f.id === id))
                    .filter((f): f is Fixture => f !== undefined)
                    .map((f) => screenPoint({ x: f.x, y: f.y }));

                const nodes = [screenPoint({ x: sw.x, y: sw.y }), ...fixtureNodes];
                if (nodes.length < 2) return null;

                return (
                    <g key={`leg-${sw.id}`} style={{ pointerEvents: 'none' }}>
                        {nodes.slice(0, -1).map((a, i) => {
                            const b = nodes[i + 1];
                            const cx = (a.x + b.x) / 2;
                            const cy = (a.y + b.y) / 2;
                            const dx = b.x - a.x;
                            const dy = b.y - a.y;
                            return (
                                <path
                                    key={`leg-${sw.id}-${i}`}
                                    d={`M ${safeNum(a.x)} ${safeNum(a.y)} Q ${safeNum(cx - dy * 0.15)} ${safeNum(cy + dx * 0.15)} ${safeNum(b.x)} ${safeNum(b.y)}`}
                                    fill="none"
                                    stroke={LEGACY_COLOR}
                                    strokeWidth={1.5}
                                    strokeLinecap="round"
                                    strokeDasharray="4,3"
                                    opacity={0.5}
                                />
                            );
                        })}
                    </g>
                );
            })}
        </g>
    );
});
