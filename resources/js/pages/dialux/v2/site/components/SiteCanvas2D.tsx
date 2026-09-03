import {
    useEffect,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
} from 'react';
import { createCanvasTransforms } from '@/pages/dialux/geometry/coordinateTransform';
import { deriveFeederStatus, feederStatusColor } from '../domain/feederSync';
import { snapToGrid } from '../domain/geometry';
import type { Point2D, SiteData, SiteElement } from '../domain/types';
import { useSiteCadPlan } from '../hooks/useSiteCadPlan';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { POINT_ELEMENT_TYPES, SiteElementSymbol } from './SiteElementSymbol';

interface Props {
    editor: UseSiteEditorReturn;
    /** `false` cuando la pestaña 3D está al frente (el 2D sigue montado, oculto). */
    isActive?: boolean;
}

// Tamaños de marcadores/handles en píxeles de pantalla (el SVG ya no tiene
// viewBox: 1 unidad SVG = 1 px).
const HANDLE_R = 6;
const DOT_R = 5;
const LABEL_PX = 12;
/** Tolerancia del snap magnético a la cuadrícula, en px de pantalla. */
const SNAP_MAGNET_PX = 14;

const DUMMY_FALLBACK = { zoom: 1, panX: 0, panY: 0, pxPerMeter: 1 };

interface FallbackView {
    scale: number;
    tx: number;
    ty: number;
}

function isLayerVisible(site: SiteData, element: SiteElement): boolean {
    const layer = site.layers.find((candidate) =>
        candidate.types.includes(element.type),
    );
    return layer ? layer.visible : true;
}

/**
 * SiteCanvas2D — modelo de coordenadas del editor v1: el MOTOR CAD es el dueño
 * del pan/zoom y el overlay SVG lo sigue leyendo `worldToScreen`/`screenToWorld`
 * cada frame (`createCanvasTransforms`). Plano y geometría comparten UNA sola
 * transformación, así que un punto colocado sobre el plano se queda exactamente
 * ahí a cualquier zoom (antes el SVG mandaba un `viewBox` y el motor lo
 * perseguía con `flyTo` → las dos vistas derivaban y el punto no se quedaba).
 *
 * Las coordenadas del emplazamiento se guardan Y hacia ABAJO (como el SVG y
 * como los datos ya existentes); la conversión al mundo CAD (Y arriba) se hace
 * SOLO en la frontera (`toScreen`/`toWorld` niegan la Y).
 */
export function SiteCanvas2D({ editor, isActive = true }: Props) {
    const { siteData } = editor;
    const {
        containerRef: cadContainerRef,
        status: cadStatus,
        getView,
        getViewState,
        zoomAtScreen,
        panByScreen,
        refit,
    } = useSiteCadPlan(
        editor.projectId,
        editor.generalModuleId,
        editor.importedPlan?.updatedAt,
    );
    const cadPlanActive = cadStatus === 'ready';
    const baseWidth = siteData?.canvasWidth ?? 2000;
    const baseHeight = siteData?.canvasHeight ?? 1200;

    const wrapRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const [size, setSize] = useState({ w: 0, h: 0 });
    /** Sube cada vez que el motor mueve la cámara → fuerza recomputar la transformación. */
    const [camTick, setCamTick] = useState(0);
    const [fallbackView, setFallbackView] = useState<FallbackView | null>(null);
    /** Cursor mientras se dibuja (coords del emplazamiento) — línea guía elástica. */
    const [drawCursor, setDrawCursor] = useState<Point2D | null>(null);

    const panRef = useRef<
        | { pointerId: number; lastX: number; lastY: number; moved: boolean }
        | undefined
    >(undefined);
    const dragRef = useRef<
        | {
              elementId: string;
              pointerId: number;
              startWorld: Point2D;
              originVertices: Point2D[];
          }
        | undefined
    >(undefined);
    const vertexDragRef = useRef<
        | { elementId: string; vertexIndex: number; pointerId: number }
        | undefined
    >(undefined);
    const planDragRef = useRef<
        { pointerId: number; startWorld: Point2D; origin: Point2D } | undefined
    >(undefined);
    const rotateDragRef = useRef<
        | { elementId: string; pointerId: number; centerScreen: Point2D }
        | undefined
    >(undefined);
    const refitStampRef = useRef<number | null>(null);

    // ── Tamaño del contenedor (y avisar al motor para que ajuste su canvas) ──
    useEffect(() => {
        const el = wrapRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const update = () => {
            if (el.clientWidth > 0) {
                setSize({ w: el.clientWidth, h: el.clientHeight });
                window.dispatchEvent(new Event('resize'));
            }
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // ── Loop rAF: detecta cuando el motor mueve la cámara y re-renderiza ────
    useEffect(() => {
        if (!cadPlanActive || !isActive) return;
        let raf = 0;
        let last = '';
        const tick = () => {
            const st = getViewState();
            if (st) {
                const key = `${st.zoom},${st.panX},${st.panY}`;
                if (key !== last) {
                    last = key;
                    setCamTick((t) => t + 1);
                }
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [cadPlanActive, isActive, getViewState]);

    // ── Encuadre inicial del plano + al volver de la pestaña 3D ─────────────

    useEffect(() => {
        if (!cadPlanActive || !isActive) return;
        window.dispatchEvent(new Event('resize'));
        const stamp = editor.importedPlan?.updatedAt ?? 0;
        if (refitStampRef.current === stamp) return;
        const id = window.setTimeout(() => {
            refitStampRef.current = stamp;
            refit();
        }, 80);
        return () => window.clearTimeout(id);
    }, [cadPlanActive, isActive, editor.importedPlan, refit]);

    // ── Transformación emplazamiento (Y abajo) ↔ pantalla (px) ─────────────
    // `camTick` sube en cada frame en que el motor mueve la cámara → este cuerpo
    // se re-ejecuta y `createCanvasTransforms` vuelve a muestrear la cámara viva.
    const cadView = cadPlanActive ? getView() : null;
    const baseT = cadView
        ? createCanvasTransforms(cadView, null, DUMMY_FALLBACK, size.h)
        : null;
    // Sin plano CAD: transformación afín propia. El `fallbackView` (estado) solo
    // acumula el pan/zoom del usuario; el encuadre inicial se deriva del tamaño.
    const fb: FallbackView =
        fallbackView ??
        (size.w > 0
            ? (() => {
                  const s =
                      Math.min(size.w / baseWidth, size.h / baseHeight, 1) *
                          0.9 || 0.5;
                  return {
                      scale: s,
                      tx: (size.w - baseWidth * s) / 2,
                      ty: (size.h - baseHeight * s) / 2,
                  };
              })()
            : { scale: 0.5, tx: 0, ty: 0 });

    const toScreen = (v: Point2D): Point2D => {
        if (baseT) {
            const s = baseT.sceneToScreen({ x: v.x, y: -v.y });
            return { x: s.x, y: s.y };
        }
        return { x: v.x * fb.scale + fb.tx, y: v.y * fb.scale + fb.ty };
    };
    const toWorld = (clientX: number, clientY: number): Point2D => {
        const r = wrapRef.current?.getBoundingClientRect();
        const lx = clientX - (r?.left ?? 0);
        const ly = clientY - (r?.top ?? 0);
        if (baseT) {
            const w = baseT.screenToScene({ x: lx, y: ly });
            return { x: w.x, y: -w.y };
        }
        return { x: (lx - fb.tx) / fb.scale, y: (ly - fb.ty) / fb.scale };
    };

    // Ref con el `fb` vigente — el handler nativo de la rueda (en un efecto) lo
    // necesita fresco. Se sincroniza en un efecto (1 frame de retraso, imperceptible).
    const fbRef = useRef(fb);
    useEffect(() => {
        fbRef.current = fb;
    });

    // ¿El punto de pantalla está dentro del viewport (con margen)? Para no
    // renderizar los cientos de puntos acotados de un levantamiento fuera de vista.
    const inView = (s: Point2D): boolean => {
        const w = size.w || 1200;
        const h = size.h || 800;
        return s.x > -80 && s.x < w + 80 && s.y > -80 && s.y < h + 80;
    };

    // ── Snap magnético: imanta a la cuadrícula solo si el clic cae a menos de
    // SNAP_MAGNET_PX px del cruce; acercado para calcar el plano, el punto
    // queda exactamente donde se hace clic.
    const snapWorld = (world: Point2D): Point2D => {
        if (!editor.snapEnabled) return world;
        const step = editor.gridSizeM / editor.terrainScaleM;
        if (!(step > 0)) return world;
        const snapped = snapToGrid(world, step);
        const a = toScreen(world);
        const b = toScreen(snapped);
        return Math.hypot(a.x - b.x, a.y - b.y) <= SNAP_MAGNET_PX
            ? snapped
            : world;
    };

    // ── Zoom con la rueda ─────────────────────────────────────────────────

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
            const r = el.getBoundingClientRect();
            const lx = event.clientX - r.left;
            const ly = event.clientY - r.top;
            if (cadPlanActive) {
                zoomAtScreen(lx, ly, factor);
                return;
            }
            const base = fbRef.current;
            const next = base.scale * factor;
            const wx = (lx - base.tx) / base.scale;
            const wy = (ly - base.ty) / base.scale;
            setFallbackView({
                scale: next,
                tx: lx - wx * next,
                ty: ly - wy * next,
            });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [cadPlanActive, zoomAtScreen]);

    if (!siteData) {
        return (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Cargando emplazamiento…
            </div>
        );
    }

    const isDrawTool =
        editor.activeTool === 'draw_polygon' ||
        editor.activeTool === 'draw_feeder' ||
        editor.activeTool === 'draw_contour';
    // `place_tg` es la herramienta genérica de "colocar equipo puntual con un
    // clic" — el tipo exacto lo decide `pendingType`.
    const isPointTool =
        editor.activeTool === 'place_tg' || editor.activeTool === 'place_spot';
    const isCalibrateTool = editor.activeTool === 'calibrate_plan';
    const drawingFeeder = editor.activeTool === 'draw_feeder';
    const toolPlaces = isDrawTool || isPointTool || isCalibrateTool;

    const lastPending =
        editor.pendingVertices[editor.pendingVertices.length - 1];
    const rubberTarget =
        isDrawTool && drawCursor && lastPending ? snapWorld(drawCursor) : null;

    const handleWorldClick = (world: Point2D) => {
        if (isDrawTool) {
            editor.addVertex(snapWorld(world));
            return;
        }
        if (isPointTool) {
            editor.placePoint(snapWorld(world), editor.pendingType);
            return;
        }
        if (isCalibrateTool) {
            editor.addCalibrationPoint(world); // exacto, sin snap
        }
    };

    const startPan = (event: ReactPointerEvent<SVGSVGElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        panRef.current = {
            pointerId: event.pointerId,
            lastX: event.clientX,
            lastY: event.clientY,
            moved: false,
        };
    };

    const points = (verts: Point2D[]): string =>
        verts
            .map((v) => {
                const s = toScreen(v);
                return `${s.x},${s.y}`;
            })
            .join(' ');

    // Con un levantamiento grande, ocultar las etiquetas de cota de los puntos
    // (se ven al seleccionar) para no repintar cientos de <text> por frame.
    const manySpots =
        siteData.elements.reduce(
            (n, e) => (e.type === 'spot_elevation' ? n + 1 : n),
            0,
        ) > 120;

    const legacyPlan =
        !cadPlanActive &&
        cadStatus !== 'loading' &&
        siteData.importedPlan?.visible
            ? siteData.importedPlan
            : null;
    let planImageRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null = null;
    if (legacyPlan) {
        const a = toScreen({ x: legacyPlan.x, y: legacyPlan.y });
        const b = toScreen({
            x: legacyPlan.x + legacyPlan.widthUnits,
            y: legacyPlan.y + legacyPlan.heightUnits,
        });
        planImageRect = {
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            width: Math.abs(b.x - a.x),
            height: Math.abs(b.y - a.y),
        };
    }

    const calibScreen = editor.calibrationPoints.map(toScreen);
    const rubberFrom =
        rubberTarget && lastPending ? toScreen(lastPending) : null;
    const rubberTo = rubberTarget ? toScreen(rubberTarget) : null;

    return (
        <div
            ref={wrapRef}
            className="relative h-full min-h-105 w-full touch-none overflow-hidden bg-[radial-gradient(circle,#94a3b833_1px,transparent_1px)] bg-size-[20px_20px] select-none dark:bg-[radial-gradient(circle,#47556955_1px,transparent_1px)]"
        >
            {/* Motor CAD: dibuja el plano vectorial DEBAJO del overlay. El motor
                es el dueño del pan/zoom; el overlay lo sigue. `pointer-events`
                los maneja el SVG de arriba y se reenvían al motor. */}
            <div
                ref={cadContainerRef}
                className="pointer-events-none absolute inset-0"
                style={{ visibility: cadPlanActive ? 'visible' : 'hidden' }}
            />
            <svg
                ref={svgRef}
                data-cam-tick={camTick}
                className="absolute inset-0 h-full w-full"
                style={{ cursor: toolPlaces ? 'crosshair' : 'grab' }}
                onContextMenu={(event) => event.preventDefault()}
                onPointerDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    const panButton = event.button === 1 || event.button === 2;
                    if (event.button === 0 && toolPlaces) {
                        handleWorldClick(toWorld(event.clientX, event.clientY));
                        return;
                    }
                    if (event.button === 0 || panButton) startPan(event);
                }}
                onDoubleClick={() => {
                    if (isDrawTool) editor.finishDrawing();
                }}
                onPointerMove={(event) => {
                    if (isDrawTool && editor.pendingVertices.length > 0) {
                        setDrawCursor(toWorld(event.clientX, event.clientY));
                    }

                    const rDrag = rotateDragRef.current;
                    if (rDrag && rDrag.pointerId === event.pointerId) {
                        const r = wrapRef.current?.getBoundingClientRect();
                        const lx = event.clientX - (r?.left ?? 0);
                        const ly = event.clientY - (r?.top ?? 0);
                        // 0° = hacia arriba en pantalla, horario positivo.
                        let deg =
                            (Math.atan2(
                                lx - rDrag.centerScreen.x,
                                rDrag.centerScreen.y - ly,
                            ) *
                                180) /
                            Math.PI;
                        if (editor.snapEnabled) deg = Math.round(deg / 15) * 15;
                        editor.updateSiteElement(rDrag.elementId, {
                            rotation: Math.round(deg),
                        });
                        return;
                    }

                    const vDrag = vertexDragRef.current;
                    if (vDrag && vDrag.pointerId === event.pointerId) {
                        editor.moveSiteVertex(
                            vDrag.elementId,
                            vDrag.vertexIndex,
                            snapWorld(toWorld(event.clientX, event.clientY)),
                        );
                        return;
                    }

                    const eDrag = dragRef.current;
                    if (eDrag && eDrag.pointerId === event.pointerId) {
                        const now = toWorld(event.clientX, event.clientY);
                        const dx = now.x - eDrag.startWorld.x;
                        const dy = now.y - eDrag.startWorld.y;
                        editor.updateSiteElement(eDrag.elementId, {
                            vertices: eDrag.originVertices.map((vertex) => ({
                                x: vertex.x + dx,
                                y: vertex.y + dy,
                            })),
                        });
                        return;
                    }

                    const pDrag = planDragRef.current;
                    if (pDrag && pDrag.pointerId === event.pointerId) {
                        const now = toWorld(event.clientX, event.clientY);
                        editor.updateImportedPlan({
                            x: pDrag.origin.x + (now.x - pDrag.startWorld.x),
                            y: pDrag.origin.y + (now.y - pDrag.startWorld.y),
                        });
                        return;
                    }

                    const pan = panRef.current;
                    if (!pan || pan.pointerId !== event.pointerId) return;
                    const dx = event.clientX - pan.lastX;
                    const dy = event.clientY - pan.lastY;
                    if (!pan.moved && Math.hypot(dx, dy) < 4) return;
                    pan.moved = true;
                    pan.lastX = event.clientX;
                    pan.lastY = event.clientY;
                    if (cadPlanActive) {
                        panByScreen(dx, dy);
                    } else {
                        const base = fbRef.current;
                        setFallbackView({
                            ...base,
                            tx: base.tx + dx,
                            ty: base.ty + dy,
                        });
                    }
                }}
                onPointerUp={(event) => {
                    if (rotateDragRef.current?.pointerId === event.pointerId) {
                        rotateDragRef.current = undefined;
                        return;
                    }
                    if (vertexDragRef.current?.pointerId === event.pointerId) {
                        vertexDragRef.current = undefined;
                        return;
                    }
                    if (dragRef.current?.pointerId === event.pointerId) {
                        dragRef.current = undefined;
                        return;
                    }
                    if (planDragRef.current?.pointerId === event.pointerId) {
                        planDragRef.current = undefined;
                        return;
                    }
                    const pan = panRef.current;
                    if (!pan || pan.pointerId !== event.pointerId) return;
                    try {
                        event.currentTarget.releasePointerCapture(
                            event.pointerId,
                        );
                    } catch {
                        /* noop */
                    }
                    if (!pan.moved && !toolPlaces) editor.selectElement(null);
                    panRef.current = undefined;
                }}
                onPointerCancel={() => {
                    dragRef.current = undefined;
                    vertexDragRef.current = undefined;
                    planDragRef.current = undefined;
                    rotateDragRef.current = undefined;
                    panRef.current = undefined;
                }}
                onPointerLeave={() => setDrawCursor(null)}
            >
                {/* Imagen PNG: solo proyectos importados antes del render CAD en
                    vivo (sin archivo fuente guardado). */}
                {planImageRect && legacyPlan && (
                    <image
                        href={editor.importedPlanUrl}
                        x={planImageRect.x}
                        y={planImageRect.y}
                        width={planImageRect.width}
                        height={planImageRect.height}
                        opacity={legacyPlan.opacity}
                        preserveAspectRatio="none"
                        style={{
                            pointerEvents:
                                editor.activeTool === 'select'
                                    ? 'visiblePainted'
                                    : 'none',
                        }}
                        className={
                            editor.activeTool === 'select' ? 'cursor-move' : ''
                        }
                        onPointerDown={(event) => {
                            if (editor.activeTool !== 'select') return;
                            event.stopPropagation();
                            event.currentTarget.ownerSVGElement?.setPointerCapture(
                                event.pointerId,
                            );
                            planDragRef.current = {
                                pointerId: event.pointerId,
                                startWorld: toWorld(
                                    event.clientX,
                                    event.clientY,
                                ),
                                origin: {
                                    x: legacyPlan.x,
                                    y: legacyPlan.y,
                                },
                            };
                        }}
                    />
                )}

                {siteData.elements
                    .filter(
                        (element) =>
                            element.visible !== false &&
                            isLayerVisible(siteData, element),
                    )
                    .map((element) => {
                        const selected =
                            editor.selectedElementId === element.id;
                        const centroid = element.vertices.reduce(
                            (acc, v) => ({
                                x: acc.x + v.x / element.vertices.length,
                                y: acc.y + v.y / element.vertices.length,
                            }),
                            { x: 0, y: 0 },
                        );
                        const labelPos = toScreen(centroid);
                        const canDrag =
                            editor.activeTool === 'select' && !element.locked;
                        const startElementDrag = (
                            event: ReactPointerEvent<SVGElement>,
                        ) => {
                            if (!canDrag) return;
                            event.stopPropagation();
                            editor.selectElement(element.id);
                            event.currentTarget.ownerSVGElement?.setPointerCapture(
                                event.pointerId,
                            );
                            dragRef.current = {
                                elementId: element.id,
                                pointerId: event.pointerId,
                                startWorld: toWorld(
                                    event.clientX,
                                    event.clientY,
                                ),
                                originVertices: element.vertices,
                            };
                        };

                        if (element.type === 'contour') {
                            const z = element.baseElevationM ?? 0;
                            const anyIn = element.vertices.some((v) =>
                                inView(toScreen(v)),
                            );
                            if (!anyIn) return null;
                            return (
                                <g key={element.id}>
                                    <polyline
                                        points={points(element.vertices)}
                                        fill="none"
                                        stroke={
                                            selected
                                                ? '#f59e0b'
                                                : element.style.strokeColor
                                        }
                                        strokeWidth={selected ? 2 : 1}
                                        strokeOpacity={0.9}
                                        style={{
                                            pointerEvents: canDrag
                                                ? 'stroke'
                                                : 'none',
                                        }}
                                        onPointerDown={startElementDrag}
                                    />
                                    <text
                                        x={labelPos.x}
                                        y={labelPos.y}
                                        textAnchor="middle"
                                        fontSize={LABEL_PX - 2}
                                        className="pointer-events-none fill-amber-700 font-semibold dark:fill-amber-500"
                                    >
                                        {z.toFixed(2)}
                                    </text>
                                </g>
                            );
                        }

                        if (element.type === 'spot_elevation') {
                            if (!inView(labelPos)) return null;
                            const z = element.baseElevationM ?? 0;
                            const showLabel = selected || !manySpots;
                            return (
                                <g key={element.id}>
                                    <path
                                        d={`M ${labelPos.x - 5} ${labelPos.y} h 10 M ${labelPos.x} ${labelPos.y - 5} v 10`}
                                        className="stroke-orange-600"
                                        strokeWidth={selected ? 2.2 : 1.3}
                                        style={{
                                            pointerEvents: canDrag
                                                ? 'stroke'
                                                : 'none',
                                            cursor: canDrag
                                                ? 'move'
                                                : undefined,
                                        }}
                                        onPointerDown={startElementDrag}
                                    />
                                    {showLabel && (
                                        <text
                                            x={labelPos.x + 7}
                                            y={labelPos.y - 5}
                                            fontSize={LABEL_PX - 3}
                                            className="pointer-events-none fill-orange-700 font-semibold dark:fill-orange-400"
                                        >
                                            {z.toFixed(2)}
                                        </text>
                                    )}
                                </g>
                            );
                        }

                        if (POINT_ELEMENT_TYPES.has(element.type)) {
                            const rot = element.rotation ?? 0;
                            const showRotate = selected && canDrag;
                            return (
                                <g key={element.id}>
                                    <SiteElementSymbol
                                        type={element.type}
                                        cx={labelPos.x}
                                        cy={labelPos.y}
                                        rotationDeg={rot}
                                        config={element.config}
                                        color={element.style.strokeColor}
                                        selected={selected}
                                        interactive={canDrag}
                                        onPointerDown={startElementDrag}
                                    />
                                    {showRotate && (
                                        <>
                                            <line
                                                x1={labelPos.x}
                                                y1={labelPos.y}
                                                x2={
                                                    labelPos.x +
                                                    30 *
                                                        Math.sin(
                                                            (rot * Math.PI) /
                                                                180,
                                                        )
                                                }
                                                y2={
                                                    labelPos.y -
                                                    30 *
                                                        Math.cos(
                                                            (rot * Math.PI) /
                                                                180,
                                                        )
                                                }
                                                className="stroke-amber-500"
                                                strokeWidth={1}
                                                style={{
                                                    pointerEvents: 'none',
                                                }}
                                            />
                                            <circle
                                                cx={
                                                    labelPos.x +
                                                    30 *
                                                        Math.sin(
                                                            (rot * Math.PI) /
                                                                180,
                                                        )
                                                }
                                                cy={
                                                    labelPos.y -
                                                    30 *
                                                        Math.cos(
                                                            (rot * Math.PI) /
                                                                180,
                                                        )
                                                }
                                                r={HANDLE_R}
                                                className="cursor-grab fill-amber-500 stroke-white stroke-2 dark:stroke-slate-900"
                                                onPointerDown={(event) => {
                                                    event.stopPropagation();
                                                    event.currentTarget.ownerSVGElement?.setPointerCapture(
                                                        event.pointerId,
                                                    );
                                                    rotateDragRef.current = {
                                                        elementId: element.id,
                                                        pointerId:
                                                            event.pointerId,
                                                        centerScreen: labelPos,
                                                    };
                                                }}
                                            />
                                        </>
                                    )}
                                    <text
                                        x={labelPos.x}
                                        y={labelPos.y + 26}
                                        textAnchor="middle"
                                        fontSize={LABEL_PX - 1}
                                        className="pointer-events-none fill-slate-800 font-semibold dark:fill-white"
                                    >
                                        {element.label}
                                        {(() => {
                                            const off =
                                                element.baseElevationM ?? 0;
                                            if (editor.terrainModeled) {
                                                const abs =
                                                    editor.groundElevationAt(
                                                        centroid.x,
                                                        centroid.y,
                                                    ) + off;
                                                return `  ▲ ${abs.toFixed(1)} m`;
                                            }
                                            return off
                                                ? `  ▲ ${off > 0 ? '+' : ''}${off.toFixed(1)}`
                                                : '';
                                        })()}
                                    </text>
                                </g>
                            );
                        }

                        return (
                            <g key={element.id}>
                                <polygon
                                    points={points(element.vertices)}
                                    fill={element.style.fillColor}
                                    fillOpacity={element.style.opacity ?? 1}
                                    stroke={
                                        selected
                                            ? '#f59e0b'
                                            : element.style.strokeColor
                                    }
                                    strokeWidth={
                                        selected
                                            ? 3
                                            : (element.style.strokeWidth ?? 1.5)
                                    }
                                    style={{
                                        pointerEvents: canDrag
                                            ? 'visiblePainted'
                                            : 'none',
                                    }}
                                    className={
                                        editor.activeTool === 'select'
                                            ? 'cursor-move'
                                            : ''
                                    }
                                    onPointerDown={startElementDrag}
                                />
                                <text
                                    x={labelPos.x}
                                    y={labelPos.y}
                                    textAnchor="middle"
                                    fontSize={LABEL_PX}
                                    className="pointer-events-none fill-slate-800 font-semibold dark:fill-white"
                                >
                                    {element.label}
                                </text>
                                {selected &&
                                    editor.activeTool === 'select' &&
                                    !element.locked &&
                                    element.vertices.map((vertex, index) => {
                                        const s = toScreen(vertex);
                                        return (
                                            <circle
                                                key={index}
                                                cx={s.x}
                                                cy={s.y}
                                                r={HANDLE_R}
                                                className="cursor-crosshair fill-amber-500 stroke-white stroke-2 dark:stroke-slate-900"
                                                onPointerDown={(event) => {
                                                    event.stopPropagation();
                                                    event.currentTarget.ownerSVGElement?.setPointerCapture(
                                                        event.pointerId,
                                                    );
                                                    vertexDragRef.current = {
                                                        elementId: element.id,
                                                        vertexIndex: index,
                                                        pointerId:
                                                            event.pointerId,
                                                    };
                                                }}
                                            />
                                        );
                                    })}
                            </g>
                        );
                    })}

                {siteData.feederPaths.map((path) => {
                    const status = deriveFeederStatus(
                        path.networkEdgeId,
                        editor.networkCalculations,
                    );
                    return (
                        <polyline
                            key={path.id}
                            points={points(path.waypoints)}
                            fill="none"
                            stroke={
                                path.style?.color ?? feederStatusColor(status)
                            }
                            strokeWidth={3}
                            strokeDasharray={path.style?.dashArray}
                            strokeLinecap="round"
                            style={{ pointerEvents: 'none' }}
                        />
                    );
                })}

                <g style={{ pointerEvents: 'none' }}>
                    {calibScreen.length === 2 && (
                        <line
                            x1={calibScreen[0].x}
                            y1={calibScreen[0].y}
                            x2={calibScreen[1].x}
                            y2={calibScreen[1].y}
                            className="stroke-fuchsia-500"
                            strokeWidth={2}
                            strokeDasharray="4 3"
                        />
                    )}
                    {calibScreen.map((s, index) => (
                        <circle
                            key={index}
                            cx={s.x}
                            cy={s.y}
                            r={HANDLE_R}
                            className="fill-fuchsia-500 stroke-white stroke-2 dark:stroke-slate-900"
                        />
                    ))}
                </g>

                {editor.pendingVertices.length > 0 && (
                    <g style={{ pointerEvents: 'none' }}>
                        <polyline
                            points={points(editor.pendingVertices)}
                            fill="none"
                            className={
                                drawingFeeder
                                    ? 'stroke-cyan-500'
                                    : 'stroke-amber-500'
                            }
                            strokeWidth={2}
                            strokeDasharray="6 4"
                        />
                        {editor.pendingVertices.map((vertex, index) => {
                            const s = toScreen(vertex);
                            return (
                                <circle
                                    key={index}
                                    cx={s.x}
                                    cy={s.y}
                                    r={DOT_R}
                                    className={
                                        drawingFeeder
                                            ? 'fill-cyan-500'
                                            : 'fill-amber-500'
                                    }
                                />
                            );
                        })}
                    </g>
                )}

                {rubberFrom && rubberTo && (
                    <g style={{ pointerEvents: 'none' }}>
                        <line
                            x1={rubberFrom.x}
                            y1={rubberFrom.y}
                            x2={rubberTo.x}
                            y2={rubberTo.y}
                            className={
                                drawingFeeder
                                    ? 'stroke-cyan-400/70'
                                    : 'stroke-amber-400/70'
                            }
                            strokeWidth={1.5}
                            strokeDasharray="5 4"
                        />
                        <circle
                            cx={rubberTo.x}
                            cy={rubberTo.y}
                            r={DOT_R}
                            fill="none"
                            className={
                                drawingFeeder
                                    ? 'stroke-cyan-400'
                                    : 'stroke-amber-400'
                            }
                            strokeWidth={1.5}
                        />
                    </g>
                )}
            </svg>

            {cadStatus === 'loading' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                    Abriendo plano CAD…
                </div>
            )}
            {cadStatus === 'error' && (
                <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded bg-red-950/80 px-2 py-1 text-[10px] text-red-200">
                    No se pudo abrir el plano CAD — reimporta el DXF/DWG.
                </div>
            )}
        </div>
    );
}
