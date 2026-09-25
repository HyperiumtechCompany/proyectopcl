import {
    canopyLightPoints,
    gateLightPoints,
} from '../domain/siteLightPlacement';
import type { Point2D, SiteElement } from '../domain/types';
import { useSiteLightingStore } from '../hooks/useSiteLightingCalculation';

/**
 * Símbolo de las luminarias de techados y portones en la planta 2D, en la
 * MISMA posición que usan el cálculo (motor V1) y el 3D
 * (`siteLightPlacement.ts`). Solo visual: no captura clics.
 */
export function SiteAttachedLightsLayer({
    elements,
    scaleM,
    toScreen,
}: {
    elements: SiteElement[];
    scaleM: number;
    toScreen: (point: Point2D) => Point2D;
}) {
    const points = elements.flatMap((element) => {
        if (element.visible === false) return [];
        const placed =
            element.type === 'canopy'
                ? canopyLightPoints(element, scaleM)
                : element.type === 'gate'
                  ? gateLightPoints(element, scaleM)
                  : [];
        return placed.map((point, index) => ({
            key: `${element.id}:${index}`,
            screen: toScreen({ x: point.x / scaleM, y: point.y / scaleM }),
        }));
    });
    if (points.length === 0) return null;
    return (
        <g className="pointer-events-none" aria-hidden>
            {points.map(({ key, screen }) => (
                <g key={key} transform={`translate(${screen.x} ${screen.y})`}>
                    <circle r={4.5} fill="#fde68a" stroke="#b45309" strokeWidth={1} />
                    <line x1={-3} y1={-3} x2={3} y2={3} stroke="#b45309" strokeWidth={1} />
                    <line x1={3} y1={-3} x2={-3} y2={3} stroke="#b45309" strokeWidth={1} />
                </g>
            ))}
        </g>
    );
}

/**
 * Luminarias "fantasma" de la proyección en curso (Iluminación → Proyectar):
 * se ven sobre el plano mientras se ajustan filas × columnas, antes de
 * colocarlas. Solo visual.
 */
export function ProjectionPreviewLayer({
    positions,
    toScreen,
    toWorld,
}: {
    positions: Point2D[];
    toScreen: (point: Point2D) => Point2D;
    /** Pantalla (clientX/Y) → plano: habilita arrastrar los postes fantasma. */
    toWorld?: (clientX: number, clientY: number) => Point2D;
}) {
    const setStore = useSiteLightingStore((state) => state.set);
    if (positions.length === 0) return null;

    /**
     * Arrastrar un poste fantasma lo mueve solo a él; con Mayús se mueve TODO
     * el conjunto (p.ej. correr la fila de postes al borde de la vereda).
     * Escuchas en `window`, sin capturar el puntero (capturarlo silencia el
     * clic del lienzo).
     */
    const startDrag = (index: number, event: React.PointerEvent) => {
        if (!toWorld || event.button !== 0) return;
        event.stopPropagation();
        event.preventDefault();
        const start = toWorld(event.clientX, event.clientY);
        const initial = useSiteLightingStore.getState().projectionAdjust;
        const moveAll = event.shiftKey;
        const origin = positions[index];
        const onMove = (move: PointerEvent) => {
            const now = toWorld(move.clientX, move.clientY);
            const dx = now.x - start.x;
            const dy = now.y - start.y;
            setStore({
                projectionAdjust: moveAll
                    ? {
                          offset: { x: initial.offset.x + dx, y: initial.offset.y + dy },
                          overrides: Object.fromEntries(
                              Object.entries(initial.overrides).map(([key, point]) => [
                                  key,
                                  { x: point.x + dx, y: point.y + dy },
                              ]),
                          ),
                      }
                    : {
                          offset: initial.offset,
                          overrides: {
                              ...initial.overrides,
                              [index]: { x: origin.x + dx, y: origin.y + dy },
                          },
                      },
            });
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    return (
        <g aria-hidden>
            {positions.map((point, index) => {
                const screen = toScreen(point);
                return (
                    <g
                        key={index}
                        transform={`translate(${screen.x} ${screen.y})`}
                        style={{ cursor: toWorld ? 'move' : undefined }}
                        onPointerDown={(event) => startDrag(index, event)}
                    >
                        <title>Arrastra para mover este poste; Mayús + arrastrar mueve todos</title>
                        <circle
                            r={9}
                            fill="rgba(250, 204, 21, 0.25)"
                            stroke="#d97706"
                            strokeWidth={1.5}
                            strokeDasharray="3 2"
                        />
                        <circle r={3} fill="#d97706" />
                    </g>
                );
            })}
        </g>
    );
}
