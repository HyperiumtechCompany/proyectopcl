/**
 * OverlayFixtures.tsx — Renderiza las luminarias en 2D con formas reales
 *
 * Shapes por fixtureShape:
 *   round       → círculo (empotrado redondo, spot, plafón)
 *   square      → cuadrado (empotrado cuadrado)
 *   rectangular → rectángulo (panel LED, tira, aplique)
 *   cylindrical → barra alargada (tubo T8/T5)
 *
 * Cada luminaria tiene:
 *   - Halo difuso adaptado a la forma
 *   - Cuerpo SVG según fixtureShape
 *   - Ícono simbólico tipo DIAlux
 *   - Etiqueta con lúmenes
 */

import React, { memo } from 'react';
import type { Fixture } from '@/hooks/dialux/types';
import { safeNum } from './canvasUtils';

interface Props {
    fixtures: Fixture[];
    selectedFixtureIds: string[];
    zoom: number;
    onSelect: (id: string, multi: boolean) => void;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    screenDistance: (
        dx: number,
        dy: number,
        origin: { x: number; y: number },
    ) => number;
}

/** Devuelve dimensiones de pantalla del fixture según su forma */
function getFixtureDimensions(
    fx: Fixture,
    baseR: number,
): { w: number; h: number } {
    const shape = fx.fixtureShape ?? 'round';
    switch (shape) {
        case 'square':
            return { w: baseR * 2.2, h: baseR * 2.2 };
        case 'rectangular':
            return { w: baseR * 3.5, h: baseR * 1.4 };
        case 'cylindrical':
            return { w: baseR * 5, h: baseR * 1 };
        default: // round
            return { w: baseR * 2, h: baseR * 2 };
    }
}

/** Colores por tipo de luminaria */
function getFixtureColors(
    fx: Fixture,
    isSelected: boolean,
): {
    fill: string;
    stroke: string;
    glow: string;
    label: string;
} {
    if (isSelected) {
        return {
            fill: '#fde68a',
            stroke: '#f59e0b',
            glow: '#f59e0b',
            label: '#fde68a',
        };
    }
    switch (fx.fixtureType) {
        case 'spot':
            return {
                fill: '#fcd34d',
                stroke: '#d97706',
                glow: '#d97706',
                label: '#fbbf24',
            };
        case 'panel':
            return {
                fill: '#e0f2fe',
                stroke: '#38bdf8',
                glow: '#38bdf8',
                label: '#7dd3fc',
            };
        case 'tube':
            return {
                fill: '#d1fae5',
                stroke: '#34d399',
                glow: '#10b981',
                label: '#6ee7b7',
            };
        case 'strip':
            return {
                fill: '#ede9fe',
                stroke: '#a78bfa',
                glow: '#8b5cf6',
                label: '#c4b5fd',
            };
        case 'pendant':
            return {
                fill: '#fee2e2',
                stroke: '#f87171',
                glow: '#ef4444',
                label: '#fca5a5',
            };
        case 'surface':
            return {
                fill: '#fef3c7',
                stroke: '#f59e0b',
                glow: '#d97706',
                label: '#fde68a',
            };
        default: // recessed
            return {
                fill: '#fbbf24',
                stroke: '#d97706',
                glow: '#d97706',
                label: '#fbbf24',
            };
    }
}

/** Ícono textual por tipo */
function getFixtureIcon(fx: Fixture): string {
    switch (fx.fixtureType) {
        case 'spot':
            return '⊙';
        case 'panel':
            return '▣';
        case 'tube':
            return '≡';
        case 'strip':
            return '▬';
        case 'pendant':
            return '◎';
        case 'surface':
            return '◼';
        default:
            return '●';
    }
}

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
                {/* Filtro glow para luminarias redondas/spot */}
                <filter
                    id="glow-fixture-round"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                >
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                {/* Filtro glow suave para paneles */}
                <filter
                    id="glow-fixture-panel"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                >
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {fixtures.map((fx) => {
                const fp = screenPoint({ x: fx.x, y: fx.y });
                const isSelected = selectedFixtureIds.includes(fx.id);
                const baseR = Math.max(
                    6,
                    screenDistance(0.12, 0, { x: fx.x, y: fx.y }),
                );
                const dims = getFixtureDimensions(fx, baseR);
                const colors = getFixtureColors(fx, isSelected);
                const shape = fx.fixtureShape ?? 'round';
                const icon = getFixtureIcon(fx);
                const haloScale = 3.5;
                const filterId =
                    shape === 'round' || shape === 'square'
                        ? 'glow-fixture-round'
                        : 'glow-fixture-panel';

                const labelY = safeNum(fp.y + dims.h / 2 + 11);

                return (
                    <g
                        key={fx.id}
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onClick={(e) => {
                            if (e.ctrlKey) {
                                e.stopPropagation();
                            }
                            onSelect(fx.id, e.ctrlKey);
                        }}
                    >
                        {/* ── Halo exterior difuso ── */}
                        {shape === 'round' || shape === 'square' ? (
                            <ellipse
                                cx={safeNum(fp.x)}
                                cy={safeNum(fp.y)}
                                rx={safeNum(dims.w * haloScale * 0.5)}
                                ry={safeNum(dims.h * haloScale * 0.5)}
                                fill={fx.lightColor ?? '#fff5e1'}
                                opacity={0.07}
                            />
                        ) : (
                            <ellipse
                                cx={safeNum(fp.x)}
                                cy={safeNum(fp.y)}
                                rx={safeNum(dims.w * 0.8)}
                                ry={safeNum(dims.h * haloScale)}
                                fill={fx.lightColor ?? '#fff5e1'}
                                opacity={0.06}
                            />
                        )}

                        {/* ── Halo interior ── */}
                        <ellipse
                            cx={safeNum(fp.x)}
                            cy={safeNum(fp.y)}
                            rx={safeNum(dims.w * haloScale * 0.3)}
                            ry={safeNum(dims.h * haloScale * 0.3)}
                            fill={fx.lightColor ?? '#fff5e1'}
                            opacity={0.08}
                        />

                        {/* ── Cuerpo según forma ── */}
                        {shape === 'round' ? (
                            <circle
                                cx={safeNum(fp.x)}
                                cy={safeNum(fp.y)}
                                r={safeNum(dims.w / 2)}
                                fill={colors.fill}
                                stroke={colors.stroke}
                                strokeWidth={isSelected ? 2 : 1.5}
                                filter={`url(#${filterId})`}
                                opacity={0.95}
                            />
                        ) : (
                            <rect
                                x={safeNum(fp.x - dims.w / 2)}
                                y={safeNum(fp.y - dims.h / 2)}
                                width={safeNum(dims.w)}
                                height={safeNum(dims.h)}
                                rx={
                                    shape === 'cylindrical'
                                        ? safeNum(dims.h / 2)
                                        : safeNum(Math.min(3, dims.w * 0.1))
                                }
                                ry={
                                    shape === 'cylindrical'
                                        ? safeNum(dims.h / 2)
                                        : safeNum(Math.min(3, dims.h * 0.1))
                                }
                                fill={colors.fill}
                                stroke={colors.stroke}
                                strokeWidth={isSelected ? 2 : 1.5}
                                filter={`url(#${filterId})`}
                                opacity={0.95}
                            />
                        )}

                        {/* Línea central para tubos */}
                        {shape === 'cylindrical' && (
                            <line
                                x1={safeNum(fp.x - dims.w / 2 + 4)}
                                y1={safeNum(fp.y)}
                                x2={safeNum(fp.x + dims.w / 2 - 4)}
                                y2={safeNum(fp.y)}
                                stroke={colors.stroke}
                                strokeWidth={safeNum(
                                    Math.max(1, dims.h * 0.25),
                                )}
                                strokeLinecap="round"
                                opacity={0.6}
                            />
                        )}

                        {/* Cruz de centrado para paneles y cuadrados */}
                        {(shape === 'square' || shape === 'rectangular') &&
                            zoom > 0.6 && (
                                <>
                                    <line
                                        x1={safeNum(fp.x - dims.w / 2 + 3)}
                                        y1={safeNum(fp.y)}
                                        x2={safeNum(fp.x + dims.w / 2 - 3)}
                                        y2={safeNum(fp.y)}
                                        stroke={colors.stroke}
                                        strokeWidth={0.7}
                                        opacity={0.4}
                                    />
                                    <line
                                        x1={safeNum(fp.x)}
                                        y1={safeNum(fp.y - dims.h / 2 + 2)}
                                        x2={safeNum(fp.x)}
                                        y2={safeNum(fp.y + dims.h / 2 - 2)}
                                        stroke={colors.stroke}
                                        strokeWidth={0.7}
                                        opacity={0.4}
                                    />
                                </>
                            )}

                        {/* ── Ícono simbólico ── */}
                        <text
                            x={safeNum(fp.x)}
                            y={safeNum(fp.y + 1)}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#0d0f14"
                            fontSize={safeNum(
                                Math.min(dims.w * 0.55, dims.h * 0.85, 14),
                            )}
                            fontWeight="bold"
                            pointerEvents="none"
                            style={{ userSelect: 'none' }}
                        >
                            {icon}
                        </text>

                        {/* ── Etiqueta lúmenes ── */}
                        <text
                            x={safeNum(fp.x)}
                            y={labelY}
                            textAnchor="middle"
                            fill={colors.label}
                            fontSize={safeNum(Math.max(7, 8 * zoom))}
                            fontFamily="monospace"
                            pointerEvents="none"
                            style={{ userSelect: 'none' }}
                        >
                            {fx.lumens}lm
                        </text>

                        {/* ── Etiqueta nombre al seleccionar ── */}
                        {isSelected && (
                            <text
                                x={safeNum(fp.x)}
                                y={safeNum(fp.y - dims.h / 2 - 10)}
                                textAnchor="middle"
                                fill={colors.label}
                                fontSize={safeNum(Math.max(8, 9 * zoom))}
                                fontFamily="sans-serif"
                                fontWeight={600}
                                pointerEvents="none"
                                style={{ userSelect: 'none' }}
                            >
                                {`${fx.name} · ${fx.lumens} lm`}
                            </text>
                        )}

                        {/* ── Indicador de selección ── */}
                        {isSelected && (
                            <rect
                                x={safeNum(fp.x - dims.w / 2 - 3)}
                                y={safeNum(fp.y - dims.h / 2 - 3)}
                                width={safeNum(dims.w + 6)}
                                height={safeNum(dims.h + 6)}
                                rx={4}
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth={1.5}
                                strokeDasharray="4,3"
                                opacity={0.8}
                            />
                        )}
                    </g>
                );
            })}
        </g>
    );
});
