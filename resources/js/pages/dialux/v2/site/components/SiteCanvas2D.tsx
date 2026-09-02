import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject,
} from 'react';
import { deriveFeederStatus, feederStatusColor } from '../domain/feederSync';
import { computeSatelliteTiles } from '../domain/geoTiles';
import { useSiteCadPlan } from '../hooks/useSiteCadPlan';
import type {
    ImportedSitePlan,
    Point2D,
    SiteData,
    SiteElement,
} from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';

interface Props {
    editor: UseSiteEditorReturn;
}

interface ViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function polygonPoints(vertices: Point2D[]): string {
    return vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(' ');
}

function isLayerVisible(site: SiteData, element: SiteElement): boolean {
    const layer = site.layers.find((candidate) =>
        candidate.types.includes(element.type),
    );
    return layer ? layer.visible : true;
}

export function SiteCanvas2D({ editor }: Props) {
    const { siteData } = editor;
    const cadPlan = useSiteCadPlan(
        editor.projectId,
        editor.generalModuleId,
        editor.importedPlan?.updatedAt,
    );
    /** Con el plano CAD vectorial vivo debajo, la imagen PNG sobra (y lo taparía). */
    const cadPlanActive = cadPlan.status === 'ready';
    const baseWidth = siteData?.canvasWidth ?? 2000;
    const baseHeight = siteData?.canvasHeight ?? 1200;
    const minViewWidth = baseWidth / MAX_SCALE;
    const maxViewWidth = baseWidth / MIN_SCALE;

    const [viewBox, setViewBox] = useState<ViewBox>({
        x: 0,
        y: 0,
        width: baseWidth,
        height: baseHeight,
    });
    const svgRef = useRef<SVGSVGElement>(null);
    const panRef = useRef<
        | {
              pointerId: number;
              lastClientX: number;
              lastClientY: number;
              moved: boolean;
          }
        | undefined
    >(undefined);
    const dragRef = useRef<
        | {
              elementId: string;
              pointerId: number;
              start: Point2D;
              originVertices: Point2D[];
          }
        | undefined
    >(undefined);
    const vertexDragRef = useRef<
        | { elementId: string; vertexIndex: number; pointerId: number }
        | undefined
    >(undefined);
    const planDragRef = useRef<
        { pointerId: number; start: Point2D; origin: Point2D } | undefined
    >(undefined);

    const toSvgPoint = (clientX: number, clientY: number): Point2D => {
        const svg = svgRef.current;
        if (!svg) return { x: clientX, y: clientY };
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const matrix = svg.getScreenCTM();
        const transformed = matrix
            ? point.matrixTransform(matrix.inverse())
            : point;
        // `transformed` es un DOMPoint/SVGPoint nativo — sus x/y son
        // accessors heredados del prototipo, no propiedades propias
        // enumerables, así que `JSON.stringify` (el autoguardado) lo
        // serializa como `{}` y se pierden en silencio. Se reconstruye
        // como objeto plano ANTES de que llegue a cualquier estado que
        // se vaya a guardar — bug real confirmado en producción (vértices
        // de terreno/calle/área verde guardados como `{}`).
        return { x: transformed.x, y: transformed.y };
    };

    const zoomAt = (clientX: number, clientY: number, factor: number) => {
        const point = toSvgPoint(clientX, clientY);
        setViewBox((current) => {
            const newWidth = clamp(
                current.width / factor,
                minViewWidth,
                maxViewWidth,
            );
            const ratio = newWidth / current.width;
            return {
                x: point.x - (point.x - current.x) * ratio,
                y: point.y - (point.y - current.y) * ratio,
                width: newWidth,
                height: current.height * ratio,
            };
        });
    };

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            zoomAt(
                event.clientX,
                event.clientY,
                event.deltaY < 0 ? 1.15 : 1 / 1.15,
            );
        };
        svg.addEventListener('wheel', handleWheel, { passive: false });
        return () => svg.removeEventListener('wheel', handleWheel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Mantiene la cámara del motor CAD alineada con el viewBox del SVG.
    // `useLayoutEffect` para que el plano se reubique en el MISMO commit en que
    // el SVG se repinta — con `useEffect` (post-paint) quedaba un frame atrás y
    // se veía "nadar" respecto de la grilla.
    const syncCadCamera = cadPlan.syncCamera;
    useLayoutEffect(() => {
        if (!cadPlanActive) return;
        const width = svgRef.current?.clientWidth ?? 0;
        if (width > 0) syncCadCamera(viewBox, width);
    }, [cadPlanActive, viewBox, syncCadCamera]);

    const satelliteTiles =
        siteData?.location && editor.showSatellite
            ? computeSatelliteTiles(
                  siteData.location,
                  siteData.terrainScaleM || 1,
                  editor.satelliteZoom,
              )
            : [];

    if (!siteData) {
        return (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Cargando emplazamiento…
            </div>
        );
    }

    const isDrawTool =
        editor.activeTool === 'draw_polygon' ||
        editor.activeTool === 'draw_feeder';
    // `place_tg` se usa como la herramienta genérica de "colocar equipo
    // puntual con un clic" — qué tipo exacto crea lo decide `pendingType`
    // (TG, transformador, poste, portón). `place_block` queda reservado
    // para vincular un módulo existente, que se hace desde el panel de
    // propiedades después de dibujar el bloque (no con un clic aislado).
    const isPointTool = editor.activeTool === 'place_tg';
    const isCalibrateTool = editor.activeTool === 'calibrate_plan';

    const handleCanvasClick = (point: Point2D) => {
        if (isDrawTool) {
            editor.addVertex(point);
            return;
        }
        if (isPointTool) {
            editor.placePoint(point, editor.pendingType);
            return;
        }
        if (isCalibrateTool) {
            editor.addCalibrationPoint(point);
            return;
        }
        editor.selectElement(null);
    };

    return (
        <div className="relative h-full min-h-105 w-full bg-[radial-gradient(circle,#94a3b833_1px,transparent_1px)] bg-size-[20px_20px] dark:bg-[radial-gradient(circle,#47556955_1px,transparent_1px)]">
            {/* Motor CAD: dibuja el plano vectorial DEBAJO del overlay SVG. Su
                cámara la alinea `syncCamera` con el viewBox, así que el SVG
                sigue mandando el pan/zoom. `pointer-events-none`: todos los
                gestos los maneja el SVG de arriba. */}
            <div
                ref={cadPlan.containerRef}
                className="pointer-events-none absolute inset-0"
                style={{ visibility: cadPlanActive ? 'visible' : 'hidden' }}
            />
            <svg
                ref={svgRef}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                className="relative h-full min-h-105 w-full touch-none select-none"
                onPointerDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (isDrawTool || isPointTool || isCalibrateTool) {
                        handleCanvasClick(
                            toSvgPoint(event.clientX, event.clientY),
                        );
                        return;
                    }
                    event.currentTarget.setPointerCapture(event.pointerId);
                    panRef.current = {
                        pointerId: event.pointerId,
                        lastClientX: event.clientX,
                        lastClientY: event.clientY,
                        moved: false,
                    };
                }}
                onDoubleClick={() => {
                    if (isDrawTool) editor.finishDrawing();
                }}
                onPointerMove={(event) => {
                    if (
                        vertexDragRef.current &&
                        vertexDragRef.current.pointerId === event.pointerId
                    ) {
                        const point = toSvgPoint(event.clientX, event.clientY);
                        editor.moveSiteVertex(
                            vertexDragRef.current.elementId,
                            vertexDragRef.current.vertexIndex,
                            point,
                        );
                        return;
                    }
                    const drag = dragRef.current;
                    if (drag && drag.pointerId === event.pointerId) {
                        const current = toSvgPoint(
                            event.clientX,
                            event.clientY,
                        );
                        const dx = current.x - drag.start.x;
                        const dy = current.y - drag.start.y;
                        editor.updateSiteElement(drag.elementId, {
                            vertices: drag.originVertices.map((vertex) => ({
                                x: vertex.x + dx,
                                y: vertex.y + dy,
                            })),
                        });
                        return;
                    }
                    const planDrag = planDragRef.current;
                    if (planDrag && planDrag.pointerId === event.pointerId) {
                        const current = toSvgPoint(
                            event.clientX,
                            event.clientY,
                        );
                        editor.updateImportedPlan({
                            x:
                                planDrag.origin.x +
                                (current.x - planDrag.start.x),
                            y:
                                planDrag.origin.y +
                                (current.y - planDrag.start.y),
                        });
                        return;
                    }
                    const pan = panRef.current;
                    if (!pan || pan.pointerId !== event.pointerId) return;
                    const dxClient = event.clientX - pan.lastClientX;
                    const dyClient = event.clientY - pan.lastClientY;
                    if (!pan.moved && Math.hypot(dxClient, dyClient) < 4)
                        return;
                    pan.moved = true;
                    const previous = toSvgPoint(
                        pan.lastClientX,
                        pan.lastClientY,
                    );
                    const current = toSvgPoint(event.clientX, event.clientY);
                    pan.lastClientX = event.clientX;
                    pan.lastClientY = event.clientY;
                    setViewBox((currentViewBox) => ({
                        ...currentViewBox,
                        x: currentViewBox.x + previous.x - current.x,
                        y: currentViewBox.y + previous.y - current.y,
                    }));
                }}
                onPointerUp={(event) => {
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
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    if (!pan.moved) editor.selectElement(null);
                    panRef.current = undefined;
                }}
                onPointerCancel={() => {
                    dragRef.current = undefined;
                    vertexDragRef.current = undefined;
                    planDragRef.current = undefined;
                    panRef.current = undefined;
                }}
            >
                {satelliteTiles.map((tile) => (
                    <image
                        key={tile.key}
                        href={tile.url}
                        x={tile.x}
                        y={tile.y}
                        width={tile.size}
                        height={tile.size}
                        preserveAspectRatio="none"
                        className="pointer-events-none"
                    />
                ))}
                {/* Imagen PNG: solo para proyectos importados antes del render CAD
                en vivo (no tienen archivo fuente guardado). Los nuevos usan el
                motor y `cadPlanActive` la oculta. */}
                {siteData.importedPlan?.visible &&
                    !cadPlanActive &&
                    cadPlan.status !== 'loading' && (
                        <ImportedPlanImage
                            plan={siteData.importedPlan}
                            imageUrl={editor.importedPlanUrl}
                            canSelect={editor.activeTool === 'select'}
                            toSvgPoint={toSvgPoint}
                            planDragRef={planDragRef}
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
                        return (
                            <g key={element.id}>
                                <polygon
                                    points={polygonPoints(element.vertices)}
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
                                    className={
                                        editor.activeTool === 'select'
                                            ? 'cursor-move'
                                            : ''
                                    }
                                    onPointerDown={(event) => {
                                        if (editor.activeTool !== 'select')
                                            return;
                                        if (element.locked) return;
                                        event.stopPropagation();
                                        editor.selectElement(element.id);
                                        event.currentTarget.ownerSVGElement?.setPointerCapture(
                                            event.pointerId,
                                        );
                                        dragRef.current = {
                                            elementId: element.id,
                                            pointerId: event.pointerId,
                                            start: toSvgPoint(
                                                event.clientX,
                                                event.clientY,
                                            ),
                                            originVertices: element.vertices,
                                        };
                                    }}
                                />
                                <text
                                    x={
                                        element.vertices.reduce(
                                            (sum, v) => sum + v.x,
                                            0,
                                        ) / element.vertices.length
                                    }
                                    y={
                                        element.vertices.reduce(
                                            (sum, v) => sum + v.y,
                                            0,
                                        ) / element.vertices.length
                                    }
                                    textAnchor="middle"
                                    className="pointer-events-none fill-slate-800 text-[11px] font-semibold dark:fill-white"
                                >
                                    {element.label}
                                </text>
                                {selected &&
                                    editor.activeTool === 'select' &&
                                    !element.locked &&
                                    element.vertices.map((vertex, index) => (
                                        <circle
                                            key={index}
                                            cx={vertex.x}
                                            cy={vertex.y}
                                            r={6}
                                            className="cursor-crosshair fill-amber-500 stroke-white stroke-2 dark:stroke-slate-900"
                                            onPointerDown={(event) => {
                                                event.stopPropagation();
                                                event.currentTarget.ownerSVGElement?.setPointerCapture(
                                                    event.pointerId,
                                                );
                                                vertexDragRef.current = {
                                                    elementId: element.id,
                                                    vertexIndex: index,
                                                    pointerId: event.pointerId,
                                                };
                                            }}
                                        />
                                    ))}
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
                            points={polygonPoints(path.waypoints)}
                            fill="none"
                            stroke={
                                path.style?.color ?? feederStatusColor(status)
                            }
                            strokeWidth={3}
                            strokeDasharray={path.style?.dashArray}
                            strokeLinecap="round"
                        />
                    );
                })}
                {editor.calibrationPoints.length > 0 && (
                    <>
                        {editor.calibrationPoints.length === 2 && (
                            <line
                                x1={editor.calibrationPoints[0].x}
                                y1={editor.calibrationPoints[0].y}
                                x2={editor.calibrationPoints[1].x}
                                y2={editor.calibrationPoints[1].y}
                                className="stroke-fuchsia-500"
                                strokeWidth={2}
                                strokeDasharray="4 3"
                            />
                        )}
                        {editor.calibrationPoints.map((vertex, index) => (
                            <circle
                                key={index}
                                cx={vertex.x}
                                cy={vertex.y}
                                r={6}
                                className="fill-fuchsia-500 stroke-white stroke-2 dark:stroke-slate-900"
                            />
                        ))}
                    </>
                )}
                {editor.pendingVertices.length > 0 && (
                    <>
                        <polyline
                            points={polygonPoints(editor.pendingVertices)}
                            fill="none"
                            className={
                                editor.activeTool === 'draw_feeder'
                                    ? 'stroke-cyan-500'
                                    : 'stroke-amber-500'
                            }
                            strokeWidth={2}
                            strokeDasharray="6 4"
                        />
                        {editor.pendingVertices.map((vertex, index) => (
                            <circle
                                key={index}
                                cx={vertex.x}
                                cy={vertex.y}
                                r={5}
                                className={
                                    editor.activeTool === 'draw_feeder'
                                        ? 'fill-cyan-500'
                                        : 'fill-amber-500'
                                }
                            />
                        ))}
                    </>
                )}
            </svg>
            {satelliteTiles.length > 0 && (
                <div className="pointer-events-none absolute right-1.5 bottom-1 rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-white/80">
                    Imágenes: Esri World Imagery
                </div>
            )}
            {cadPlan.status === 'loading' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                    Abriendo plano CAD…
                </div>
            )}
            {cadPlan.status === 'error' && (
                <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded bg-red-950/80 px-2 py-1 text-[10px] text-red-200">
                    No se pudo abrir el plano CAD — reimporta el DXF/DWG.
                </div>
            )}
        </div>
    );
}

/**
 * Extraído como componente propio (no un IIFE inline) — el compilador de
 * React no logra analizar correctamente los refs (`planDragRef`) leídos
 * dentro de un `onPointerDown` cuando el JSX que lo contiene se arma con un
 * IIFE en vez de un componente real (error de build
 * `react-hooks/refs`, confirmado al intentarlo).
 */
function ImportedPlanImage({
    plan,
    imageUrl,
    canSelect,
    toSvgPoint,
    planDragRef,
}: {
    plan: ImportedSitePlan;
    imageUrl: string | undefined;
    canSelect: boolean;
    toSvgPoint: (clientX: number, clientY: number) => Point2D;
    planDragRef: RefObject<
        { pointerId: number; start: Point2D; origin: Point2D } | undefined
    >;
}) {
    return (
        <image
            href={imageUrl}
            x={plan.x}
            y={plan.y}
            width={plan.widthUnits}
            height={plan.heightUnits}
            opacity={plan.opacity}
            preserveAspectRatio="none"
            className={canSelect ? 'cursor-move' : ''}
            onPointerDown={(event) => {
                if (!canSelect) return;
                event.stopPropagation();
                event.currentTarget.ownerSVGElement?.setPointerCapture(
                    event.pointerId,
                );
                planDragRef.current = {
                    pointerId: event.pointerId,
                    start: toSvgPoint(event.clientX, event.clientY),
                    origin: { x: plan.x, y: plan.y },
                };
            }}
        />
    );
}
