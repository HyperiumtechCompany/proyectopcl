import React, { memo } from 'react';
import type { LightSwitch, Fixture } from '@/hooks/dialux/types';
import { safeNum } from './canvasUtils';

interface Props {
    lightSwitches: LightSwitch[];
    fixtures: Fixture[];
    zoom: number;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
}

export const OverlayWires = memo(function OverlayWires({
    lightSwitches,
    fixtures,
    zoom,
    screenPoint,
}: Props) {
    if (!lightSwitches.length) return null;

    return (
        <g className="overlay-wires">
            {lightSwitches.map((sw) => {
                if (!sw.connectedFixtureIds || sw.connectedFixtureIds.length === 0) return null;

                const nodes: { x: number, y: number }[] = [];
                // Nodo 0: el interruptor
                nodes.push(screenPoint({ x: sw.x, y: sw.y }));

                // Siguientes nodos: las luminarias en orden
                sw.connectedFixtureIds.forEach((fId) => {
                    const fixture = fixtures.find(f => f.id === fId);
                    if (fixture) {
                        nodes.push(screenPoint({ x: fixture.x, y: fixture.y }));
                    }
                });

                const paths = [];
                for (let i = 0; i < nodes.length - 1; i++) {
                    const p1 = nodes[i];
                    const p2 = nodes[i + 1];

                    // Curva bezier para que no sea una línea recta aburrida
                    const cx = (p1.x + p2.x) / 2;
                    const cy = (p1.y + p2.y) / 2;
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    
                    // Vector perpendicular
                    const px = -dy * 0.2;
                    const py = dx * 0.2;

                    const d = `M ${safeNum(p1.x)} ${safeNum(p1.y)} Q ${safeNum(cx + px)} ${safeNum(cy + py)} ${safeNum(p2.x)} ${safeNum(p2.y)}`;

                    paths.push(
                        <path
                            key={`${sw.id}-seg-${i}`}
                            d={d}
                            fill="none"
                            stroke="#ef4444" // Rojo como en la imagen de referencia (era #3b82f6)
                            strokeWidth={2}
                            strokeLinecap="round"
                            opacity={0.8}
                            style={{ pointerEvents: 'none' }}
                        />
                    );
                }

                return <g key={`wire-group-${sw.id}`}>{paths}</g>;
            })}
        </g>
    );
});
