/**
 * OverlayMeasureArea.tsx
 *
 * Overlay SVG para la herramienta "Medir Área" de DIAlux.
 *
 * A diferencia de los comandos CAD nativos (measurearea / measureangle),
 * este overlay opera sobre vértices en metros de escena ya calibrados,
 * por lo que el área resultante coincide exactamente con el área que
 * calcularán los objetos DIAlux (recintos, paredes, escaleras).
 *
 * Flujo:
 *   1. El usuario hace clic → se acumulan vértices en metros de escena.
 *   2. Al cerrar el polígono (clic sobre el primer vértice) o doble-clic
 *      → se llama onFinish y el área queda "congelada" en pantalla.
 *   3. El usuario puede limpiar con el botón de la herramienta.
 */

import { memo, useMemo } from 'react';
import { calculatePolygonArea } from '@/hooks/dialux/lightingCalculations';
import type { CanvasPoint } from '@/hooks/dialux/useCanvasInteraction';
import { safeNum, pointsToSvgString, centroid } from './canvasUtils';

type ScreenFn = (p: { x: number; y: number }) => { x: number; y: number };

interface Props {
    /** Vértices acumulados en metros de escena (en progreso o finales). */
    vertices: CanvasPoint[];
    /** Punto de preview dinámico (donde está el cursor). Nulo si no hay preview. */
    previewPoint: CanvasPoint | null;
    /** Si true, el polígono está cerrado (medición finalizada). */
    isClosed: boolean;
    screenPoint: ScreenFn;
    zoom: number;
}

export const OverlayMeasureArea = memo(function OverlayMeasureArea({
    vertices,
    previewPoint,
    isClosed,
    screenPoint,
    zoom,
}: Props) {
    if (vertices.length === 0) return null;

    const screenVerts = vertices.map(screenPoint);

    /** Vértices de pantalla incluyendo el punto de preview dinámico */
    const displayVerts = previewPoint && !isClosed
        ? [...screenVerts, screenPoint(previewPoint)]
        : screenVerts;

    const pts = pointsToSvgString(displayVerts);

    /**
     * Área calculada sobre los vértices en metros de escena.
     * Usa la misma fórmula Shoelace que usan los recintos DIAlux →
     * garantiza consistencia total con el área mostrada en propiedades.
     */
    const areaShoelace = useMemo(
        () => calculatePolygonArea(vertices),
        [vertices],
    );

    /** Área del polígono completo incluyendo preview (visual feedback) */
    const areaWithPreview = useMemo(() => {
        if (!previewPoint || isClosed || vertices.length < 2) return areaShoelace;
        return calculatePolygonArea([...vertices, previewPoint]);
    }, [vertices, previewPoint, isClosed, areaShoelace]);

    const displayArea = isClosed ? areaShoelace : areaWithPreview;

    const ctr = useMemo(
        () => centroid(displayVerts.length > 0 ? displayVerts : screenVerts),
        [displayVerts, screenVerts],
    );

    const firstSv = screenVerts[0];
    const fontSize = Math.max(10, 12 * zoom);

    return (
        <g className="overlay-measure-area" pointerEvents="none">
            {/* Relleno semitransparente */}
            <polygon
                points={pts}
                fill="#10b981"
                fillOpacity={isClosed ? 0.18 : 0.1}
                stroke="#10b981"
                strokeWidth={isClosed ? 2 : 1.5}
                strokeDasharray={isClosed ? '0' : '6 3'}
                strokeLinejoin="round"
            />

            {/* Vértices marcados */}
            {screenVerts.map((sv, i) => (
                <circle
                    key={i}
                    cx={safeNum(sv.x)}
                    cy={safeNum(sv.y)}
                    r={i === 0 ? 6 : 4}
                    fill={i === 0 ? '#10b981' : '#d1fae5'}
                    stroke="#059669"
                    strokeWidth={1.5}
                />
            ))}

            {/* Línea de preview hacia cursor */}
            {!isClosed && previewPoint && screenVerts.length > 0 && (() => {
                const lastSv = screenVerts[screenVerts.length - 1];
                const previewSv = screenPoint(previewPoint);
                return (
                    <line
                        x1={safeNum(lastSv.x)} y1={safeNum(lastSv.y)}
                        x2={safeNum(previewSv.x)} y2={safeNum(previewSv.y)}
                        stroke="#34d399"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        opacity={0.7}
                    />
                );
            })()}

            {/* Indicador de cierre en el primer vértice */}
            {!isClosed && vertices.length >= 2 && firstSv && (
                <circle
                    cx={safeNum(firstSv.x)}
                    cy={safeNum(firstSv.y)}
                    r={9}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="3 2"
                    opacity={0.6}
                />
            )}

            {/* Badge de área */}
            {displayArea > 0 && (
                <g transform={`translate(${safeNum(ctr.x)}, ${safeNum(ctr.y)})`}>
                    <rect
                        x={-52}
                        y={-15}
                        width={104}
                        height={22}
                        fill="#064e3b"
                        fillOpacity={0.92}
                        rx={5}
                        stroke="#10b981"
                        strokeWidth={1}
                    />
                    <text
                        x={0}
                        y={3}
                        fill="#6ee7b7"
                        fontSize={safeNum(fontSize)}
                        fontFamily="monospace"
                        textAnchor="middle"
                        fontWeight="bold"
                    >
                        {displayArea.toFixed(3)} m²
                    </text>
                </g>
            )}

            {/* Label instrucción cuando está en progreso */}
            {!isClosed && vertices.length > 0 && vertices.length < 3 && (
                <g transform={`translate(${safeNum(ctr.x)}, ${safeNum(ctr.y + 22)})`}>
                    <rect x={-72} y={-10} width={144} height={16} fill="#1e293b" fillOpacity={0.8} rx={3} />
                    <text x={0} y={2} fill="#94a3b8" fontSize={9} fontFamily="sans-serif" textAnchor="middle">
                        Clic para añadir punto · Doble-clic para cerrar
                    </text>
                </g>
            )}
        </g>
    );
});
