/**
 * OverlayFixtureArrangementAreas.tsx — Marca en el plano 2D el área en la que
 * se proyectó cada grilla de luminarias (herramienta "Luminarias" → modo
 * "Dibujar área"). Dibuja el polígono que el usuario cerró y una etiqueta con
 * la cantidad de luminarias realmente colocadas dentro — feedback pedido por
 * el usuario: "si hice una proyección de un cuadrado, decirme mediante el
 * dibujo cuántas luminarias proyecté en esa área".
 *
 * Puramente informativo: `pointerEvents="none"`, nunca roba clics a la
 * selección de luminarias ni a nada más. Solo aplica a arreglos con
 * `config.ambientVertices` (los de modo "Dibujar área"); un arreglo hecho
 * sobre un recinto completo no dibuja nada aquí.
 */

import { memo } from 'react';
import { calculatePolygonArea } from '@/pages/dialux/hooks/lightingCalculations';
import type { Fixture, FixtureArrangement } from '@/pages/dialux/hooks/types';
import { centroid, safeNum } from './canvasUtils';

type ScreenFn = (p: { x: number; y: number }) => { x: number; y: number };

interface Props {
    arrangements: FixtureArrangement[];
    fixtures: Fixture[];
    zoom: number;
    screenPoint: ScreenFn;
}

const AreaLabel = memo(function AreaLabel({
    arrangement,
    count,
    pts,
    ctr,
    areaM2,
    zoom,
}: {
    arrangement: FixtureArrangement;
    count: number;
    pts: string;
    ctr: { x: number; y: number };
    areaM2: number;
    zoom: number;
}) {
    const showLabel = zoom >= 0.35;
    const fontSize = safeNum(Math.max(9, 11 * zoom));
    const subFontSize = safeNum(Math.max(7, 8.5 * zoom));
    const rows = arrangement.config.rows;
    const cols = arrangement.config.columns;
    // `rows×cols` es la disposición PEDIDA; solo se muestra cuando coincide con
    // la cantidad realmente colocada. Si el reparto consciente de obstáculos,
    // un borrado parcial o una reorganización cambiaron el total, mostrar
    // `3×4` junto a `9 luminarias` sería contradictorio — en ese caso se omite.
    const gridText =
        rows > 0 && cols > 0 && rows * cols === count ? `${rows}×${cols}` : null;

    return (
        <g pointerEvents="none">
            <polygon
                points={pts}
                fill="#22d3ee"
                fillOpacity={0.06}
                stroke="#22d3ee"
                strokeOpacity={0.7}
                strokeWidth={1.4}
                strokeDasharray="6 4"
            />
            {showLabel && count > 0 && (
                <>
                    <text
                        x={safeNum(ctr.x)}
                        y={safeNum(ctr.y - subFontSize * 0.7)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#a5f3fc"
                        fontSize={fontSize}
                        fontFamily="sans-serif"
                        fontWeight={700}
                        stroke="#083344"
                        strokeWidth={3}
                        paintOrder="stroke"
                    >
                        {count === 1 ? '1 luminaria' : `${count} luminarias`}
                    </text>
                    <text
                        x={safeNum(ctr.x)}
                        y={safeNum(ctr.y + fontSize * 0.7)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#67e8f9"
                        fontSize={subFontSize}
                        fontFamily="monospace"
                        fontWeight={400}
                        stroke="#083344"
                        strokeWidth={2.5}
                        paintOrder="stroke"
                    >
                        {[gridText, areaM2 > 0 ? `${areaM2.toFixed(1)} m²` : null]
                            .filter(Boolean)
                            .join(' · ')}
                    </text>
                </>
            )}
        </g>
    );
});

export const OverlayFixtureArrangementAreas = memo(function OverlayFixtureArrangementAreas({
    arrangements,
    fixtures,
    zoom,
    screenPoint,
}: Props) {
    if (!arrangements.length) return null;

    return (
        <g className="overlay-fixture-arrangement-areas">
            {arrangements.map((arrangement) => {
                const verts = arrangement.config.ambientVertices;
                if (!verts || verts.length < 3) return null;

                // Cantidad real colocada (la distribución consciente de
                // obstáculos puede no coincidir con rows×columns); si el grupo
                // ya no tiene luminarias vivas, no se dibuja nada.
                const count = fixtures.filter(
                    (f) => f.gridGroupId === arrangement.id,
                ).length;
                if (count === 0) return null;

                const sv = verts.map((v) => screenPoint(v));
                const pts = sv
                    .map((p) => `${safeNum(p.x)},${safeNum(p.y)}`)
                    .join(' ');

                return (
                    <AreaLabel
                        key={arrangement.id}
                        arrangement={arrangement}
                        count={count}
                        pts={pts}
                        ctr={centroid(sv)}
                        areaM2={calculatePolygonArea(verts)}
                        zoom={zoom}
                    />
                );
            })}
        </g>
    );
});
