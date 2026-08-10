/**
 * OverlayFixtureGridGuides.tsx — Lineas guia arrastrables para la grilla de
 * luminarias (panel "Generar Grilla de Focos").
 *
 * No construye ninguna entidad de dominio: es un editor de UI puro sobre
 * `ui.fixtureGridGuideEditor` (ver uiSlice.ts). El usuario arrastra las
 * lineas para alinearlas con una viga/proyeccion real del DXF; cada celda
 * resultante muestra un marcador de vista previa en su centro. Al confirmar
 * con el boton "Generar" del panel, esas posiciones se usan para crear las
 * luminarias reales (`FixtureGridConfig.rowGuides/columnGuides`).
 */

import { memo, useCallback } from 'react';
import { calculateGuidedFixtureGridPositions, polygonBBox } from '@/pages/dialux/hooks/fixtureGrid';
import type { FixtureGridGuideEditorState } from '@/pages/dialux/hooks/useEditorStore';
import { safeNum } from './canvasUtils';

type ScreenFn = (p: { x: number; y: number }) => { x: number; y: number };

interface Props {
    editor: FixtureGridGuideEditorState;
    screenPoint: ScreenFn;
    worldPoint: (cx: number, cy: number) => { x: number; y: number };
    toLocalPoint: (clientX: number, clientY: number) => { x: number; y: number };
    onDragGuide: (axis: 'row' | 'column', index: number, value: number) => void;
}

const LINE_COLOR = '#22d3ee';
const LINE_COLOR_ACTIVE = '#67e8f9';

export const OverlayFixtureGridGuides = memo(function OverlayFixtureGridGuides({
    editor,
    screenPoint,
    worldPoint,
    toLocalPoint,
    onDragGuide,
}: Props) {
    const bbox = polygonBBox(editor.vertices);

    const makeDragHandler = useCallback(
        (axis: 'row' | 'column', index: number) =>
            (e: React.PointerEvent<SVGLineElement>) => {
                e.stopPropagation();
                e.preventDefault();
                const target = e.currentTarget;
                target.setPointerCapture(e.pointerId);

                const onMove = (ev: PointerEvent) => {
                    const local = toLocalPoint(ev.clientX, ev.clientY);
                    const scenePt = worldPoint(local.x, local.y);
                    const fraction =
                        axis === 'column'
                            ? bbox.width > 0
                                ? (scenePt.x - bbox.minX) / bbox.width
                                : 0.5
                            : bbox.height > 0
                              ? (scenePt.y - bbox.minY) / bbox.height
                              : 0.5;
                    onDragGuide(axis, index, fraction);
                };
                const onUp = (ev: PointerEvent) => {
                    target.releasePointerCapture(ev.pointerId);
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                };
                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp);
            },
        [bbox.minX, bbox.minY, bbox.width, bbox.height, toLocalPoint, worldPoint, onDragGuide],
    );

    if (bbox.width <= 0 || bbox.height <= 0) return null;

    const positions = calculateGuidedFixtureGridPositions(
        editor.vertices,
        editor.rows,
        editor.columns,
        editor.rowGuides,
        editor.columnGuides,
    );

    const topLeft = screenPoint({ x: bbox.minX, y: bbox.minY });
    const bottomRight = screenPoint({ x: bbox.minX + bbox.width, y: bbox.minY + bbox.height });

    return (
        <g className="overlay-fixture-grid-guides" style={{ pointerEvents: 'none' }}>
            {/* Lineas verticales (dividen columnas) */}
            {editor.columnGuides.map((fraction, index) => {
                const sceneX = bbox.minX + fraction * bbox.width;
                const p1 = screenPoint({ x: sceneX, y: bbox.minY });
                const p2 = screenPoint({ x: sceneX, y: bbox.minY + bbox.height });
                return (
                    <g key={`col-${index}`}>
                        <line
                            x1={safeNum(p1.x)} y1={safeNum(p1.y)}
                            x2={safeNum(p2.x)} y2={safeNum(p2.y)}
                            stroke={LINE_COLOR} strokeWidth={2} strokeDasharray="6,4" opacity={0.9}
                        />
                        {/* Hit-area ancha e invisible para agarrar la linea sin apuntar al pixel exacto */}
                        <line
                            x1={safeNum(p1.x)} y1={safeNum(p1.y)}
                            x2={safeNum(p2.x)} y2={safeNum(p2.y)}
                            stroke="transparent" strokeWidth={18}
                            style={{ pointerEvents: 'auto', cursor: 'ew-resize', touchAction: 'none' }}
                            onPointerDown={makeDragHandler('column', index)}
                        />
                    </g>
                );
            })}

            {/* Lineas horizontales (dividen filas) */}
            {editor.rowGuides.map((fraction, index) => {
                const sceneY = bbox.minY + fraction * bbox.height;
                const p1 = screenPoint({ x: bbox.minX, y: sceneY });
                const p2 = screenPoint({ x: bbox.minX + bbox.width, y: sceneY });
                return (
                    <g key={`row-${index}`}>
                        <line
                            x1={safeNum(p1.x)} y1={safeNum(p1.y)}
                            x2={safeNum(p2.x)} y2={safeNum(p2.y)}
                            stroke={LINE_COLOR} strokeWidth={2} strokeDasharray="6,4" opacity={0.9}
                        />
                        <line
                            x1={safeNum(p1.x)} y1={safeNum(p1.y)}
                            x2={safeNum(p2.x)} y2={safeNum(p2.y)}
                            stroke="transparent" strokeWidth={18}
                            style={{ pointerEvents: 'auto', cursor: 'ns-resize', touchAction: 'none' }}
                            onPointerDown={makeDragHandler('row', index)}
                        />
                    </g>
                );
            })}

            {/* Marco del area de calculo, para ubicar visualmente el bbox */}
            <rect
                x={safeNum(Math.min(topLeft.x, bottomRight.x))}
                y={safeNum(Math.min(topLeft.y, bottomRight.y))}
                width={safeNum(Math.abs(bottomRight.x - topLeft.x))}
                height={safeNum(Math.abs(bottomRight.y - topLeft.y))}
                fill="none" stroke={LINE_COLOR_ACTIVE} strokeWidth={1} strokeDasharray="2,3" opacity={0.5}
            />

            {/* Vista previa: centro de cada celda resultante */}
            {positions.map((pos, index) => {
                const p = screenPoint(pos);
                return (
                    <g key={`preview-${index}`}>
                        <circle cx={safeNum(p.x)} cy={safeNum(p.y)} r={9} fill="#0891b2" fillOpacity={0.25} stroke="#22d3ee" strokeWidth={1.5} />
                        <line x1={safeNum(p.x - 5)} y1={safeNum(p.y)} x2={safeNum(p.x + 5)} y2={safeNum(p.y)} stroke="#22d3ee" strokeWidth={1.5} />
                        <line x1={safeNum(p.x)} y1={safeNum(p.y - 5)} x2={safeNum(p.x)} y2={safeNum(p.y + 5)} stroke="#22d3ee" strokeWidth={1.5} />
                    </g>
                );
            })}
        </g>
    );
});
