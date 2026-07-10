/**
 * OverlayFixtures.tsx
 *
 * Renders luminaire symbols in 2D using their REAL physical dimensions.
 *
 * Each fixture uses fx.dimensions.length / fx.dimensions.width (in metres)
 * converted to screen pixels via screenDistance() — the same function used
 * by OverlayElectricalDevices.  This ensures every element on the canvas
 * scales consistently with the drawing zoom and calibration.
 *
 * Minimum pixel clamp prevents symbols vanishing at low zoom levels.
 */

import React, { memo } from 'react';
import type { Fixture } from '@/pages/dialux/hooks/types';
import { safeNum } from './canvasUtils';

interface Props {
    fixtures: Fixture[];
    selectedFixtureIds: string[];
    zoom: number;
    onSelect: (id: string, multi: boolean) => void;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    screenDistance: (dx: number, dy: number, origin?: { x: number; y: number }) => number;
}

/** Minimum pixel half-dimension so symbols never disappear */
const MIN_HALF_PX = 8;

/**
 * Returns screen half-dimensions {hw, hh} for a fixture.
 * Priority: fx.dimensions (physical metres) → shape-based fallback.
 */
function getScreenHalfDims(
    fx: Fixture,
    screenDistance: Props['screenDistance'],
): { hw: number; hh: number } {
    const origin = { x: fx.x, y: fx.y };

    if (fx.dimensions) {
        // Use real physical size from catalog/user-defined dimensions.
        // length → along X axis (width on plan), width → along Y axis (depth on plan).
        const physHw = (fx.dimensions.length ?? fx.dimensions.width ?? 0.3) / 2;
        const physHh = (fx.dimensions.width ?? fx.dimensions.length ?? 0.3) / 2;
        return {
            hw: Math.max(MIN_HALF_PX, screenDistance(physHw, 0, origin)),
            hh: Math.max(MIN_HALF_PX, screenDistance(physHh, 0, origin)),
        };
    }

    // Fallback sizes when no physical dimensions are stored.
    const shape = fx.fixtureShape ?? 'round';
    const basePhys: Record<string, { hw: number; hh: number }> = {
        round:       { hw: 0.10, hh: 0.10 },
        square:      { hw: 0.15, hh: 0.15 },
        rectangular: { hw: 0.30, hh: 0.15 },
        cylindrical: { hw: 0.60, hh: 0.06 },
    };
    const p = basePhys[shape] ?? basePhys.round;
    return {
        hw: Math.max(MIN_HALF_PX, screenDistance(p.hw, 0, origin)),
        hh: Math.max(MIN_HALF_PX, screenDistance(p.hh, 0, origin)),
    };
}

/** Stroke colour per fixture type (matches CAD reference legend) */
function getStrokeColor(fx: Fixture, isSelected: boolean): string {
    if (isSelected) return '#f59e0b';
    // Use catalogSymbol colour when available
    if (fx.catalogSymbol) {
        if (fx.catalogSymbol.includes('red'))     return '#ef4444';
        if (fx.catalogSymbol.includes('green'))   return '#22c55e';
        if (fx.catalogSymbol.includes('magenta')) return '#d946ef';
        if (fx.catalogSymbol.includes('yellow') || fx.catalogSymbol.includes('spot')) return '#eab308';
        if (fx.catalogSymbol.includes('orange'))  return '#f97316';
        if (fx.catalogSymbol.includes('black'))   return '#374151';
        if (fx.catalogSymbol.includes('emergency')) return '#10b981';
        if (fx.catalogSymbol.includes('white'))   return '#e5e7eb';
    }
    // Generic colour by type
    switch (fx.fixtureType) {
        case 'spot':    return '#eab308';
        case 'panel':   return '#38bdf8';
        case 'tube':    return '#34d399';
        case 'strip':   return '#a78bfa';
        case 'pendant': return '#f87171';
        case 'surface': return '#f59e0b';
        default:        return '#fbbf24';
    }
}

/** Glow fill colour */
function getGlowColor(fx: Fixture): string {
    return fx.lightColor ?? '#fff5e1';
}

/** CAD-accurate symbol for fixtures that have a catalogSymbol */
function CadFixtureBody({
    fx, hw, hh, stroke, isSelected,
}: {
    fx: Fixture;
    hw: number; hh: number;
    stroke: string;
    isSelected: boolean;
}) {
    const sw = isSelected ? 2.0 : 1.5;
    const sym = fx.catalogSymbol ?? '';
    const shape = fx.fixtureShape ?? 'round';

    // ── Circle-based symbols ─────────────────────────────────────────────────
    if (sym === 'circle_black') {
        return <circle r={safeNum(hw)} fill="#1f2937" stroke="#374151" strokeWidth={sw} pointerEvents="none" />;
    }
    if (sym === 'circle_magenta') {
        return <circle r={safeNum(hw)} fill="none" stroke={stroke} strokeWidth={sw} pointerEvents="none" />;
    }
    /** Downlight adosado — black solid circle */
    if (sym === 'circle_filled') {
        return <circle r={safeNum(hw)} fill="#111827" stroke="#374151" strokeWidth={sw} pointerEvents="none" />;
    }
    /** Downlight empotrado — circle with center cross (D=190mm) */
    if (sym === 'circle_cross') {
        return (
            <g pointerEvents="none">
                <circle r={safeNum(hw)} fill="none" stroke={stroke} strokeWidth={sw} />
                <circle r={safeNum(hw * 0.15)} fill={stroke} />
                <line x1={safeNum(-hw)} y1={0} x2={safeNum(hw)} y2={0} stroke={stroke} strokeWidth={0.8} />
                <line x1={0} y1={safeNum(-hw)} x2={0} y2={safeNum(hw)} stroke={stroke} strokeWidth={0.8} />
            </g>
        );
    }

    // ── Spot symbols ─────────────────────────────────────────────────────────
    if (sym === 'spot_yellow' || sym === 'spot_orange') {
        return (
            <g pointerEvents="none">
                <circle r={safeNum(hw)} fill="none" stroke={stroke} strokeWidth={sw} />
                <line x1={safeNum(-hw)} y1={0} x2={safeNum(hw)} y2={0} stroke={stroke} strokeWidth={0.8} />
                <line x1={0} y1={safeNum(-hw)} x2={0} y2={safeNum(hw)} stroke={stroke} strokeWidth={0.8} />
            </g>
        );
    }

    // ── Emergency symbols (yellow rectangle + X) ─────────────────────────────
    if (sym === 'emergency' || sym === 'emergency_perm') {
        return (
            <g pointerEvents="none">
                <rect x={safeNum(-hw)} y={safeNum(-hh)} width={safeNum(hw * 2)} height={safeNum(hh * 2)}
                    fill="none" stroke={stroke} strokeWidth={sw} rx={1} />
                <line x1={safeNum(-hw + 2)} y1={safeNum(-hh + 2)} x2={safeNum(hw - 2)} y2={safeNum(hh - 2)} stroke={stroke} strokeWidth={sw} />
                <line x1={safeNum(hw - 2)} y1={safeNum(-hh + 2)} x2={safeNum(-hw + 2)} y2={safeNum(hh - 2)} stroke={stroke} strokeWidth={sw} />
                {sym === 'emergency_perm' && (
                    <text x={safeNum(hw + 3)} y={1} textAnchor="start" dominantBaseline="middle"
                        fill="#ef4444" fontSize={Math.min(hh * 0.9, 12)} fontWeight="bold"
                        style={{ userSelect: 'none' }}>S</text>
                )}
            </g>
        );
    }

    // All rect-based symbols (rect_red, rect_green, rect_white, generic)
    if (shape === 'round') {
        return <circle r={safeNum(hw)} fill="none" stroke={stroke} strokeWidth={sw} pointerEvents="none" />;
    }
    return (
        <rect x={safeNum(-hw)} y={safeNum(-hh)} width={safeNum(hw * 2)} height={safeNum(hh * 2)}
            fill="none" stroke={stroke} strokeWidth={sw}
            rx={shape === 'cylindrical' ? safeNum(hh) : 1}
            pointerEvents="none" />
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const OverlayFixtures = memo(function OverlayFixtures({
    fixtures,
    selectedFixtureIds,
    zoom,
    onSelect,
    screenPoint,
    screenDistance,
}: Props) {
    if (!fixtures.length) return null;

    return (
        <g className="overlay-fixtures">
            <defs>
                <filter id="glow-fix-r" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-fix-p" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {fixtures.map((fx) => {
                const fp        = screenPoint({ x: fx.x, y: fx.y });
                const isSelected = selectedFixtureIds.includes(fx.id);
                const { hw, hh } = getScreenHalfDims(fx, screenDistance);
                const stroke    = getStrokeColor(fx, isSelected);
                const glowColor = getGlowColor(fx);
                const shape     = fx.fixtureShape ?? 'round';
                const isRound   = shape === 'round';
                const filterId  = isRound ? 'glow-fix-r' : 'glow-fix-p';
                const labelY    = safeNum(fp.y + hh + Math.max(10, 10 * zoom));

                return (
                    <g
                        key={fx.id}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { onSelect(fx.id, e.ctrlKey); }}
                    >
                        {/* Outer glow halo */}
                        {isRound ? (
                            <ellipse cx={safeNum(fp.x)} cy={safeNum(fp.y)}
                                rx={safeNum(hw * 3)} ry={safeNum(hh * 3)}
                                fill={glowColor} opacity={0.07} style={{ pointerEvents: 'none' }} />
                        ) : (
                            <ellipse cx={safeNum(fp.x)} cy={safeNum(fp.y)}
                                rx={safeNum(hw * 2)} ry={safeNum(hh * 2.5)}
                                fill={glowColor} opacity={0.06} style={{ pointerEvents: 'none' }} />
                        )}

                        {/* Inner glow */}
                        <ellipse cx={safeNum(fp.x)} cy={safeNum(fp.y)}
                            rx={safeNum(hw * 1.3)} ry={safeNum(hh * 1.3)}
                            fill={glowColor} opacity={0.10} style={{ pointerEvents: 'none' }} />

                        {/* Symbol body — translated to fixture position */}
                        <g
                            transform={`translate(${safeNum(fp.x)}, ${safeNum(fp.y)})`}
                            filter={`url(#${filterId})`}
                        >
                            <CadFixtureBody fx={fx} hw={hw} hh={hh} stroke={stroke} isSelected={isSelected} />
                        </g>

                        {/* Selection ring */}
                        {isSelected && (
                            <rect
                                x={safeNum(fp.x - hw - 4)} y={safeNum(fp.y - hh - 4)}
                                width={safeNum((hw + 4) * 2)} height={safeNum((hh + 4) * 2)}
                                rx={4} fill="none"
                                stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.85}
                                style={{ pointerEvents: 'none' }}
                            />
                        )}

                        {/* Lumen label (ocultado temporalmente por solicitud)
                        <text
                            x={safeNum(fp.x)} y={labelY}
                            textAnchor="middle" fill={stroke}
                            fontSize={safeNum(Math.max(7, 8 * zoom))}
                            fontFamily="monospace"
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                            {fx.lumens}lm
                        </text> */}

                        {/* Name label when selected */}
                        {isSelected && (
                            <text
                                x={safeNum(fp.x)} y={safeNum(fp.y - hh - 10)}
                                textAnchor="middle" fill={stroke}
                                fontSize={safeNum(Math.max(8, 9 * zoom))}
                                fontFamily="sans-serif" fontWeight={600}
                                style={{ pointerEvents: 'none', userSelect: 'none' }}
                            >
                                {`${fx.name} · ${fx.lumens} lm`}
                            </text>
                        )}
                    </g>
                );
            })}
        </g>
    );
});
