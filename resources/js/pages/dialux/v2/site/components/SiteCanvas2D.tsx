import { useEffect, useRef, useState } from 'react';
import { deriveFeederStatus, feederStatusColor } from '../domain/feederSync';
import { computeSatelliteTiles } from '../domain/geoTiles';
import type { Point2D, SiteData, SiteElement } from '../domain/types';
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

    const toSvgPoint = (clientX: number, clientY: number): Point2D => {
        const svg = svgRef.current;
        if (!svg) return { x: clientX, y: clientY };
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const matrix = svg.getScreenCTM();
        const transformed = matrix ? point.matrixTransform(matrix.inverse()) : point;
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

    const handleCanvasClick = (point: Point2D) => {
        if (isDrawTool) {
            editor.addVertex(point);
            return;
        }
        if (isPointTool) {
            editor.placePoint(point, editor.pendingType);
            return;
        }
        editor.selectElement(null);
    };

    return (
        <div className="relative h-full min-h-105 w-full">
        <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className="h-full min-h-[420px] w-full touch-none bg-[radial-gradient(circle,#94a3b833_1px,transparent_1px)] bg-size-[20px_20px] select-none dark:bg-[radial-gradient(circle,#47556955_1px,transparent_1px)]"
            onPointerDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (isDrawTool || isPointTool) {
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
                    const current = toSvgPoint(event.clientX, event.clientY);
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
                const pan = panRef.current;
                if (!pan || pan.pointerId !== event.pointerId) return;
                const dxClient = event.clientX - pan.lastClientX;
                const dyClient = event.clientY - pan.lastClientY;
                if (!pan.moved && Math.hypot(dxClient, dyClient) < 4) return;
                pan.moved = true;
                const previous = toSvgPoint(pan.lastClientX, pan.lastClientY);
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
                const pan = panRef.current;
                if (!pan || pan.pointerId !== event.pointerId) return;
                event.currentTarget.releasePointerCapture(event.pointerId);
                if (!pan.moved) editor.selectElement(null);
                panRef.current = undefined;
            }}
            onPointerCancel={() => {
                dragRef.current = undefined;
                vertexDragRef.current = undefined;
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
            {siteData.elements
                .filter(
                    (element) =>
                        element.visible !== false &&
                        isLayerVisible(siteData, element),
                )
                .map((element) => {
                    const selected = editor.selectedElementId === element.id;
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
                                    if (editor.activeTool !== 'select') return;
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
                        stroke={path.style?.color ?? feederStatusColor(status)}
                        strokeWidth={3}
                        strokeDasharray={path.style?.dashArray}
                        strokeLinecap="round"
                    />
                );
            })}
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
        </div>
    );
}
