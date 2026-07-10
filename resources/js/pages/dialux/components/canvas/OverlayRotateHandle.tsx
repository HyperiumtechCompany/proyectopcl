/**
 * OverlayRotateHandle.tsx
 *
 * Manija de rotación para el objeto único seleccionado (luminaria,
 * interruptor o dispositivo eléctrico). Aparece como un pequeño círculo
 * sobre el objeto, conectado por una línea guía. Arrastrarlo calcula el
 * ángulo (en grados, sentido horario, 0° = arriba) entre el centro del
 * objeto y el puntero, y lo aplica como rotación en planta.
 */

import React, { memo, useCallback, useRef, useState } from 'react';
import { safeNum } from './canvasUtils';

export interface RotatableTarget {
    id: string;
    x: number;
    y: number;
    rotation: number;
}

interface Props {
    target: RotatableTarget | null;
    /** Radio en píxeles del objeto (para separar la manija del cuerpo) */
    objectRadiusPx: number;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    /** Convierte coordenadas de cliente (clientX/clientY) al espacio local del SVG overlay */
    toLocalPoint: (clientX: number, clientY: number) => { x: number; y: number };
    onRotate: (id: string, rotationDeg: number) => void;
}

const HANDLE_OFFSET_PX = 28;

function normalizeAngle(deg: number): number {
    let a = deg % 360;
    if (a < 0) a += 360;
    return a;
}

export const OverlayRotateHandle = memo(function OverlayRotateHandle({
    target,
    objectRadiusPx,
    screenPoint,
    toLocalPoint,
    onRotate,
}: Props) {
    const [dragging, setDragging] = useState(false);
    const liveRotationRef = useRef<number>(0);
    const [, forceRender] = useState(0);

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<SVGCircleElement>) => {
            if (!target) return;
            e.stopPropagation();
            e.preventDefault();
            (e.target as Element).setPointerCapture(e.pointerId);
            liveRotationRef.current = target.rotation;
            setDragging(true);
        },
        [target],
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<SVGCircleElement>) => {
            if (!dragging || !target) return;
            const local = toLocalPoint(e.clientX, e.clientY);
            const center = screenPoint({ x: target.x, y: target.y });
            const dx = local.x - center.x;
            const dy = local.y - center.y;
            if (Math.hypot(dx, dy) < 2) return;
            // atan2 mide desde el eje +X; sumamos 90° porque el ángulo 0° de
            // rotación coloca la manija arriba del objeto (dirección -Y).
            const angle = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI + 90);
            liveRotationRef.current = angle;
            forceRender((n) => n + 1);
        },
        [dragging, target, screenPoint, toLocalPoint],
    );

    const endDrag = useCallback(
        (e: React.PointerEvent<SVGCircleElement>) => {
            if (!dragging || !target) return;
            (e.target as Element).releasePointerCapture(e.pointerId);
            setDragging(false);
            onRotate(target.id, liveRotationRef.current);
        },
        [dragging, target, onRotate],
    );

    if (!target) return null;

    const center = screenPoint({ x: target.x, y: target.y });
    const rotation = dragging ? liveRotationRef.current : target.rotation;
    const dist = objectRadiusPx + HANDLE_OFFSET_PX;
    const rad = ((rotation - 90) * Math.PI) / 180;
    const handleX = center.x + dist * Math.cos(rad);
    const handleY = center.y + dist * Math.sin(rad);

    return (
        <g className="overlay-rotate-handle" style={{ pointerEvents: 'none' }}>
            <line
                x1={safeNum(center.x)}
                y1={safeNum(center.y)}
                x2={safeNum(handleX)}
                y2={safeNum(handleY)}
                stroke="#f59e0b"
                strokeWidth={1.25}
                strokeDasharray="3,2"
                opacity={0.85}
            />
            <circle
                cx={safeNum(handleX)}
                cy={safeNum(handleY)}
                r={8}
                fill={dragging ? '#fbbf24' : '#f59e0b'}
                stroke="#78350f"
                strokeWidth={1.5}
                style={{ pointerEvents: 'auto', cursor: 'grab', touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            />
            {dragging && (
                <text
                    x={safeNum(handleX)}
                    y={safeNum(handleY - 14)}
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize={11}
                    fontFamily="monospace"
                    fontWeight={700}
                    style={{ userSelect: 'none' }}
                >
                    {`${Math.round(rotation)}°`}
                </text>
            )}
        </g>
    );
});
