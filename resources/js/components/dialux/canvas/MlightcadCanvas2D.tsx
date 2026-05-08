/**
 * MlightcadCanvas2D.tsx — Canvas 2D del editor DIAlux
 *
 * Compositor del overlay SVG sobre el motor mlightcad.
 * La geometría de escena se renderiza mediante sub-componentes
 * memoizados, cada uno re-renderiza solo cuando sus datos cambian.
 *
 * Capas (de menor a mayor z-index):
 *   [0] div#cad-engine-container   → canvas nativo mlightcad
 *   [10] svg#dialux-overlay        → geometría DIAlux + herramientas
 */

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
    resolveFixtureRenderHeight,
    resolveRoomCeilingHeight,
} from '@/editor/renderers/3d/engines/fixtureHeights';
import { findAmbientSpaceAtPoint } from '@/hooks/dialux/ambientSpaces';
import {
    useCanvasInteraction,
    type CanvasPoint,
} from '@/hooks/dialux/useCanvasInteraction';
import {
    normalizeScaleConfig,
    useEditorStore,
    useActiveScene,
    useViewport,
} from '@/hooks/dialux/useEditorStore';
import { useMlightcadEngine } from '@/hooks/dialux/useMlightcadEngine';
import { useWasmEngine } from '@/hooks/dialux/useWasmEngine';
import { shouldEnableOverlayPointerEvents } from '@/hooks/dialux/cadInteraction';

import { CalibrationDialog } from '../CalibrationDialog';
import { CalibrationOverlay } from './CalibrationOverlay';
import {
    cadToMeters,
    getCanvasScalePxPerMeter,
    getEffectiveScale,
    metersToCad,
    safeNum,
} from './canvasUtils';

import { GridLayer } from './GridLayer';
import { IsoluxLayer } from './IsoluxLayer';
import { OverlayCanopies } from './OverlayCanopies';
import { OverlayDoors } from './OverlayDoors';
import { OverlayFixtures } from './OverlayFixtures';
import { OverlayPreviews } from './OverlayPreviews';
import { OverlayRooms } from './OverlayRooms';
import { OverlayWalls } from './OverlayWalls';
import { OverlayWindows } from './OverlayWindows';

// ─── Helpers locales ──────────────────────────────────────────────────────────


const CURSOR_MAP: Record<string, string> = {
    select: 'default',
    room: 'crosshair',
    wall: 'crosshair',
    window: 'cell',
    door: 'cell',
    canopy: 'crosshair',
    corridor: 'crosshair',
    fixture: 'cell',
    measure: 'crosshair',
    calibrate: 'crosshair',
    pan: 'grab',
};

const DRAWING_TOOLS = new Set([
    'room',
    'wall',
    'window',
    'door',
    'canopy',
    'corridor',
    'fixture',
    'measure',
    'calibrate',
    'pan',
]);

const INTERACTIVE_TOOLS = new Set([...DRAWING_TOOLS, 'select']);

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
    /** Cuando pasa a true, la vista 2D acaba de hacerse visible → re-renderizar. */
    isVisible?: boolean;
}

export const MlightcadCanvas2D: React.FC<Props> = memo(
    function MlightcadCanvas2D({ isVisible }: Props) {
        const store = useEditorStore();
        const scene = useActiveScene();
        const { zoom, panX, panY } = useViewport();
        const ui = store.ui;
        const resultsByRoom = useEditorStore((state) => state.resultsByRoom);
        const engine = useMlightcadEngine();
        const { rescaleDxfEntities } = useWasmEngine();

        const wrapperRef = useRef<HTMLDivElement>(null);
        const cadRef = useRef<HTMLDivElement>(null);

        const [size, setSize] = useState({ w: 800, h: 600 });
        const initAttemptedRef = useRef(false);
        const [roomVertices, setRoomVertices] = useState<CanvasPoint[]>([]);
        const [roomPreviewPt, setRoomPreviewPt] = useState<CanvasPoint | null>(
            null,
        );
        const [wallPreview, setWallPreview] = useState<CanvasPoint[] | null>(
            null,
        );
        const [canopyPreview, setCanopyPreview] = useState<{
            start: CanvasPoint;
            end: CanvasPoint;
        } | null>(null);
        const [calibrationLine, setCalibrationLine] = useState<{
            start: CanvasPoint;
            end: CanvasPoint;
        } | null>(null);
        const [calibrationSnapPoint, setCalibrationSnapPoint] =
            useState<CanvasPoint | null>(null);
        const [pendingCalibration, setPendingCalibration] = useState<{
            cadDistance: number;
            start: CanvasPoint;
            end: CanvasPoint;
        } | null>(null);
        const [isDragging, setIsDragging] = useState(false);
        const [viewTick, setViewTick] = useState(0);
        const scaleConfig = normalizeScaleConfig(scene?.scaleConfig);
        const effectiveScale = getEffectiveScale(scaleConfig);
        const visibleCalibrationLine =
            ui.activeTool === 'calibrate' || pendingCalibration
                ? calibrationLine
                : null;
        const visibleCalibrationSnapPoint =
            ui.activeTool === 'calibrate' || pendingCalibration
                ? calibrationSnapPoint
                : null;

        const isInteractiveMode = shouldEnableOverlayPointerEvents(
            ui.activeTool,
            engine.isCadCommandActive,
            INTERACTIVE_TOOLS,
        );
        const cursor = isDragging
            ? 'grabbing'
            : (CURSOR_MAP[ui.activeTool] ?? 'default');

        // ── Sincronización de vista (seguimiento del pan/zoom de mlightcad) ────────
        const cadView = engine.docManager?.curView as
            | {
                  worldToScreen?: (p: { x: number; y: number }) => {
                      x?: number;
                      y?: number;
                  };
                  screenToWorld?: (p: { x: number; y: number }) => {
                      x?: number;
                      y?: number;
                  };
              }
            | null
            | undefined;
        const hasCadView = Boolean(
            cadView?.worldToScreen && cadView?.screenToWorld,
        );

        // ── Conversión de coordenadas ──────────────────────────────────────────────
        const screenPoint = useCallback(
            (point: { x: number; y: number }) => {
                const cadPoint = {
                    x: metersToCad(point.x, scaleConfig),
                    y: metersToCad(point.y, scaleConfig),
                };
                if (hasCadView && cadView?.worldToScreen) {
                    const s = cadView.worldToScreen(cadPoint);
                    return { x: safeNum(s?.x), y: safeNum(s?.y) };
                }
                // Fallback minimalista si el motor está cargando
                return { x: 0, y: 0 };
            },
            [hasCadView, cadView, scaleConfig],
        );

        const screenDistance = useCallback(
            (dx: number, dy: number, origin: { x: number; y: number }) => {
                if (hasCadView && cadView?.worldToScreen) {
                    // Convertir origin de metros (escena) a unidades CAD nativas
                    const cadOrigin = {
                        x: metersToCad(origin.x, scaleConfig),
                        y: metersToCad(origin.y, scaleConfig),
                    };
                    const a = cadView.worldToScreen(cadOrigin);
                    const b = cadView.worldToScreen({
                        x: cadOrigin.x + metersToCad(dx, scaleConfig),
                        y: cadOrigin.y + metersToCad(dy, scaleConfig),
                    });
                    return Math.hypot(
                        safeNum(b?.x) - safeNum(a?.x),
                        safeNum(b?.y) - safeNum(a?.y),
                    );
                }
                const scale = getCanvasScalePxPerMeter(scaleConfig);
                return Math.hypot(dx * scale * zoom, dy * scale * zoom);
            },
            [hasCadView, cadView, scaleConfig, zoom],
        );

        const worldPoint = useCallback(
            (px: number, py: number) => {
                if (hasCadView && cadView?.screenToWorld) {
                    const w = cadView.screenToWorld({ x: px, y: py });
                    return {
                        x: cadToMeters(safeNum(w?.x), scaleConfig),
                        y: cadToMeters(safeNum(w?.y), scaleConfig),
                    };
                }
                return { x: 0, y: 0 };
            },
            [hasCadView, cadView, scaleConfig],
        );

        /**
         * Devuelve la distancia entre dos puntos de pantalla en **unidades CAD nativas**
         * (sin escalar), que es el valor que `applyCalibration` espera como `cadDistance`.
         *
         * Ruta prioritaria: usa el motor nativo (cadView.screenToWorld → unidades CAD puras).
         * Fallback:        convierte coordenadas de escena (metros) a unidades CAD dividiendo
         *                  por effectiveScale. Si effectiveScale === 0 (escala no inicializada)
         *                  usa 1 como neutro para evitar NaN / ∞.
         */
        const measureCadDistanceFromScreen = useCallback(
            (p1: CanvasPoint, p2: CanvasPoint) => {
                if (hasCadView && cadView?.screenToWorld) {
                    const cadP1 = cadView.screenToWorld({ x: p1.x, y: p1.y });
                    const cadP2 = cadView.screenToWorld({ x: p2.x, y: p2.y });
                    return engine.measureCadDistance(
                        { x: safeNum(cadP1?.x), y: safeNum(cadP1?.y) },
                        { x: safeNum(cadP2?.x), y: safeNum(cadP2?.y) },
                    );
                }

                // Fallback: las coordenadas de worldPoint ya están en metros;
                // dividir por effectiveScale convierte metros → unidades CAD nativas.
                const sceneP1 = worldPoint(p1.x, p1.y);
                const sceneP2 = worldPoint(p2.x, p2.y);
                const sceneDistance = Math.hypot(
                    sceneP2.x - sceneP1.x,
                    sceneP2.y - sceneP1.y,
                );
                // Guard: effectiveScale nunca debe ser 0; si lo es, usar 1 como neutro.
                const scale = effectiveScale > 0 ? effectiveScale : 1;
                return sceneDistance / scale;
            },
            [cadView, effectiveScale, engine, hasCadView, worldPoint],
        );

        // Herramientas que realmente necesitan OSNAP CAD (view.pick es costoso)
        const CAD_OSNAP_TOOLS = new Set([
            'room', 'wall', 'corridor', 'calibrate', 'canopy',
        ]);

        // ── Interacción ───────────────────────────────────────────────────────────
        // IMPORTANT: useCanvasInteraction MUST be declared before the RAF useEffect
        // below, because the RAF loop calls isDraggingFn(). Having the useEffect
        // reference isDraggingFn before the const declaration causes a TDZ crash
        // when the React Compiler inlines the closure.
        const {
            onMouseDown,
            onMouseMove,
            onMouseUp,
            onDoubleClick,
            isDragging: isDraggingFn,
        } = useCanvasInteraction({
            activeTool: ui.activeTool,
            angleSnapMode: ui.angleSnapMode,
            resolveCadOsnap: CAD_OSNAP_TOOLS.has(ui.activeTool)
                ? (scenePoint, lastPoint) =>
                      engine.getOsnapPoint(scenePoint, { lastPoint })
                : undefined,
            dxfEntities: store.dxfEntities,
            walls: scene?.walls ?? [],
            screenToScene: (cx, cy) => worldPoint(cx, cy),
            sceneToScreen: (sx, sy) => screenPoint({ x: sx, y: sy }),
            selectedId: ui.selectedId,
            fixtures: scene?.fixtures ?? [],
            rooms: scene?.rooms ?? [],
            canopies: scene?.canopies ?? [],
            windows: scene?.windows ?? [],
            doors: scene?.doors ?? [],
            onAddRoom: (verticesM) => {
                const isCorridor = ui.activeTool === 'corridor';
                const id = store.addRoom({
                    name: isCorridor ? `Pasadizo ${(scene?.rooms.filter(r => r.roomType === 'corridor').length ?? 0) + 1}` : `Recinto ${(scene?.rooms.filter(r => r.roomType !== 'corridor').length ?? 0) + 1}`,
                    vertices: verticesM,
                    height: 2.7,
                    roomType: isCorridor ? 'corridor' : 'room',
                    color: isCorridor ? 'rgba(59, 130, 246, 0.4)' : 'rgba(56,189,248,0.25)', // Blue color for corridor
                });
                store.setSelectedId(id);
                setRoomVertices([]);
                setRoomPreviewPt(null);
            },
            onAddWall: (vertices) => {
                const id = store.addWall({
                    vertices,
                    material: 'brick',
                    normativeUse: 'housing',
                    thickness: 0.13,
                    height: 2.4,
                    mortarJointMin: 0.01,
                    mortarJointMax: 0.015,
                });
                store.setSelectedId(id);
                setWallPreview(null);
            },
            onAddWindow: (wallId, offsetAlongWall) => {
                const t = ui.windowTemplate;
                store.addWindow({
                    wallId,
                    offsetAlongWall,
                    width: t.width ?? 1.2,
                    height: t.height ?? 1.1,
                    sillHeight: t.sillHeight ?? 0.9,
                    windowType: t.windowType ?? 'fixed',
                    windowShape: t.windowShape ?? 'rectangular',
                    centered: false,
                });
            },
            onAddDoor: (wallId, offsetAlongWall) => {
                const t = ui.doorTemplate;
                store.addDoor({
                    wallId,
                    offsetAlongWall,
                    width: t.width ?? 0.9,
                    height: t.height ?? 2.1,
                    doorType: t.doorType ?? 'single',
                    openingDirection: t.openingDirection ?? 'inward',
                    openingAngle: t.openingAngle ?? 90,
                    centered: false,
                });
            },
            onAddCanopy: (x1, y1, x2, y2) => {
                const id = store.addCanopy({
                    x1,
                    y1,
                    x2,
                    y2,
                    width: 1.0,
                    slabThickness: 0.15,
                    height: 2.4,
                });
                store.setSelectedId(id);
                setCanopyPreview(null);
            },
            onAddFixture: (xM, yM) => {
                if (!scene) return;
                const ambient = findAmbientSpaceAtPoint(scene, { x: xM, y: yM });

                const t = ui.fixtureTemplate;
                const fixtureType = t.fixtureType ?? 'surface';
                const ceilingHeight = ambient
                    ? resolveRoomCeilingHeight(ambient.room, scene.walls)
                    : undefined;
                const fixtureHeight = resolveFixtureRenderHeight(
                    {
                        z: t.z ?? (ceilingHeight ? ceilingHeight - 0.08 : 2.4),
                        fixtureType,
                    },
                    ceilingHeight,
                );
                const id = store.addFixture({
                    name: t.name ?? `Luminaria ${ambient?.name ?? 'exterior'}`,
                    x: ambient?.centroid.x ?? xM,
                    y: ambient?.centroid.y ?? yM,
                    z: fixtureHeight,
                    lumens: t.lumens ?? 4000,
                    power: t.power,
                    efficiency: t.efficiency ?? 0.8,
                    fixtureType,
                    fixtureShape: t.fixtureShape ?? 'round',
                    brand: t.brand,
                    articleNumber: t.articleNumber,
                    productId: t.productId,
                    productSourceFormat: t.productSourceFormat,
                    lightColor: t.lightColor ?? '#fff5e1',
                    roomId: ambient?.room.id,
                });
                store.setSelectedId(id);
            },
            onCalibrationMeasure: (_sceneDistM, p1Screen, p2Screen) => {
                // p1Screen, p2Screen son px en el SVG — measureCadDistanceFromScreen
                // llama cadView.screenToWorld(px) para la distancia CAD nativa.
                const cadDistance = measureCadDistanceFromScreen(p1Screen, p2Screen);

                // Convertir px → metros para los overlays visuales.
                const p1Scene = worldPoint(p1Screen.x, p1Screen.y);
                const p2Scene = worldPoint(p2Screen.x, p2Screen.y);

                setCalibrationLine({ start: p1Scene, end: p2Scene });
                setPendingCalibration({
                    cadDistance,
                    start: p1Scene,
                    end: p2Scene,
                });
            },

            onSelectObject: (id) => store.setSelectedId(id),
            onPanChange: (dx, dy) => store.setPan(panX + dx, panY + dy),
            onDoubleClick: () => {
                setRoomPreviewPt(null);
                setWallPreview(null);
                setCanopyPreview(null);
            },
            onMoveFixture: (id, x, y) => store.updateFixture(id, { x, y }),
            onMoveRoom: (id, dx, dy) => {
                const room = scene?.rooms.find((r) => r.id === id);
                if (room) {
                    const newVertices = room.vertices.map((v) => ({
                        x: v.x + dx,
                        y: v.y + dy,
                    }));
                    store.updateRoom(id, { vertices: newVertices });
                }
            },
            onMoveCanopy: (id, x1, y1, x2, y2) =>
                store.updateCanopy(id, { x1, y1, x2, y2 }),
            onMoveWindow: (id, wallId, offsetAlongWall) =>
                store.updateWindow(id, { wallId, offsetAlongWall }),
            onMoveDoor: (id, wallId, offsetAlongWall) =>
                store.updateDoor(id, { wallId, offsetAlongWall }),
        });

        // ── Ref estable para isDraggingFn — evita que el RAF tenga isDraggingFn
        // en su lista de dependencias (lo que causaría el bucle de re-creación)
        // y elimina el riesgo de TDZ si el compilador reordena declaraciones.
        const isDraggingFnRef = useRef(isDraggingFn);
        isDraggingFnRef.current = isDraggingFn;

        // ── RAF único: sincroniza viewTick Y cursor isDragging en un solo loop ──
        // Antes había dos loops RAF independientes (uno para viewTick, otro para
        // isDragging) lo que duplicaba callbacks por frame sin necesidad.
        useEffect(() => {
            let lastState = '';
            let rafId: number;

            const tick = () => {
                // 1. Sincronizar vista CAD
                if (hasCadView) {
                    const st = engine.getViewState?.();
                    if (st) {
                        const key = `${st.zoom},${st.panX},${st.panY}`;
                        if (key !== lastState) {
                            lastState = key;
                            setViewTick((t) => t + 1);
                        }
                    }
                }

                // 2. Cursor dragging — accessed via ref to avoid TDZ and stale closures
                const dragging = isDraggingFnRef.current();
                if (dragging !== isDragging) {
                    setIsDragging(dragging);
                }

                rafId = requestAnimationFrame(tick);
            };

            rafId = requestAnimationFrame(tick);
            return () => cancelAnimationFrame(rafId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [hasCadView, engine]);

        // ── Inicialización del motor ───────────────────────────────────────────────
        useEffect(() => {
            if (!cadRef.current || initAttemptedRef.current) return;
            initAttemptedRef.current = true;
            engine.initViewer(cadRef.current).then(() => {
                // Forzar resize + posicionar origen en primer cuadrante
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                    engine.setViewOrigin?.();
                    engine.fitToView?.();
                }, 100);
            });
        }, []); // eslint-disable-line react-hooks/exhaustive-deps

        // ── Re-activación de la vista 2D (volviendo de 3D) ────────────────────────
        // Cuando el canvas 2D estaba oculto (display:none) mlightcad no actualiza
        // su viewport. Al hacerse visible necesitamos:
        //   1. Despachar resize para que three.js recalcule dimensiones
        //   2. Llamar fitToView / zoom para re-dibujar la escena CAD correctamente
        useEffect(() => {
            if (!isVisible || !engine.isReady) return;
            let raf: number;
            const activate = () => {
                window.dispatchEvent(new Event('resize'));
                // Pequeño delay para que el resize se asiente antes del zoom
                raf = requestAnimationFrame(() => {
                    engine.fitToView?.();
                    setViewTick((t) => t + 1); // Forzar re-cálculo del overlay SVG
                });
            };
            // Pequeño delay inicial para asegurar que la visibilidad está completamente aplicada
            const timeoutId = setTimeout(activate, 50);
            return () => {
                clearTimeout(timeoutId);
                cancelAnimationFrame(raf);
            };
        }, [isVisible, engine.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

        // ── ResizeObserver con debounce ────────────────────────────────────────────
        // Sin debounce, un resize animado (ej. apertura del sidebar) dispara
        // docenas de fitToView en < 200ms, lo que provoca parpadeo en el canvas.
        useEffect(() => {
            const el = wrapperRef.current;
            if (!el) return;

            let debounceTimer: ReturnType<typeof setTimeout> | null = null;

            const obs = new ResizeObserver(([entry]) => {
                const newSize = {
                    w: entry.contentRect.width,
                    h: entry.contentRect.height,
                };
                // Solo actualizar si el tamaño cambió significativamente (>5px)
                if (
                    Math.abs(newSize.w - size.w) > 5 ||
                    Math.abs(newSize.h - size.h) > 5
                ) {
                    setSize(newSize);

                    // Debounce: esperar 120 ms desde el último evento antes de
                    // despachar resize + fitToView para evitar llamadas en ráfaga.
                    if (debounceTimer !== null) clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                        setTimeout(() => {
                            engine.fitToView?.();
                            setViewTick((t) => t + 1);
                        }, 50);
                        debounceTimer = null;
                    }, 120);
                }
            });
            obs.observe(el);
            return () => {
                obs.disconnect();
                if (debounceTimer !== null) clearTimeout(debounceTimer);
            };
        }, [engine, size]);

        // ── Wheel (zoom overlay) ───────────────────────────────────────────────────
        useEffect(() => {
            const el = wrapperRef.current;
            if (!el) return;
            const onWheel = (e: WheelEvent) => {
                e.preventDefault();

                if (hasCadView) {
                    const rect = el.getBoundingClientRect();
                    const screenPoint = {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                    };
                    if (e.deltaY > 0) {
                        engine.zoomAt(screenPoint, 1 / 1.2);
                    } else {
                        engine.zoomAt(screenPoint, 1.2);
                    }
                    setViewTick((tick) => tick + 1);
                    return;
                }

                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                store.setZoom(Math.min(4, Math.max(0.1, zoom + delta)));
            };
            el.addEventListener('wheel', onWheel, { passive: false });
            return () => el.removeEventListener('wheel', onWheel);
        }, [engine, hasCadView, zoom, store]);

        // ─────────────────────────────────────────────────────────────────────────
        return (
            <div
                ref={wrapperRef}
                className="relative h-full w-full flex-1 overflow-hidden bg-[#0d0f14]"
            >
                <style>{`
                #cad-engine-container { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; }
                #cad-engine-container canvas { width: 100% !important; height: 100% !important; display: block !important; }
            `}</style>

                {/* Motor CAD nativo (z=0) */}
                <div
                    ref={cadRef}
                    id="cad-engine-container"
                    className="absolute inset-0"
                    style={{ zIndex: 0, background: '#0d0f14' }}
                />

                {/* Overlay SVG con geometría DIAlux (z=10) */}
                <svg
                    id="dialux-overlay"
                    width={size.w}
                    height={size.h}
                    viewBox={`0 0 ${size.w} ${size.h}`}
                    className="absolute inset-0"
                    preserveAspectRatio="none"
                    style={{
                        zIndex: 10,
                        cursor: cursor,
                        pointerEvents: isInteractiveMode ? 'auto' : 'none',
                        overflow: 'visible',
                    }}
                    onMouseDown={(e) => {
                        if (isInteractiveMode)
                            onMouseDown(
                                e,
                                setRoomVertices,
                                setWallPreview,
                                setCanopyPreview,
                                setCalibrationLine,
                                setCalibrationSnapPoint,
                            );
                    }}
                    onMouseMove={(e) => {
                        if (isInteractiveMode)
                            onMouseMove(
                                e,
                                setRoomPreviewPt,
                                setWallPreview,
                                setCanopyPreview,
                                setCalibrationLine,
                                setCalibrationSnapPoint,
                            );
                    }}
                    onMouseUp={(e) => {
                        if (isInteractiveMode) onMouseUp(e, setCanopyPreview);
                    }}
                    onDoubleClick={onDoubleClick}
                >
                    {/* ── Defs reutilizados por los overlays ── */}
                    <defs>
                        <pattern
                            id="hatch-canopy-svg"
                            patternUnits="userSpaceOnUse"
                            width={8}
                            height={8}
                            patternTransform="rotate(45)"
                        >
                            <line
                                x1={0}
                                y1={0}
                                x2={0}
                                y2={8}
                                stroke="#f59e0b"
                                strokeWidth={1.5}
                                strokeOpacity={0.5}
                            />
                        </pattern>
                        <filter id="glow-fixture">
                            <feGaussianBlur stdDeviation={3} result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* ── Grilla ── */}
                    {ui.showGrid && (
                        <GridLayer 
                            width={size.w} 
                            height={size.h} 
                            screenPoint={screenPoint} 
                            worldPoint={worldPoint} 
                            viewTick={viewTick} 
                        />
                    )}

                    {/* ── Mapa isolux ── */}
                    {ui.showIsolux &&
                        Object.entries(resultsByRoom).map(
                            ([roomId, roomResult]) =>
                                roomResult && (
                                    <IsoluxLayer
                                        key={`isolux-${roomId}`}
                                        layerId={roomId}
                                        result={roomResult}
                                        mode={ui.isoluxMode}
                                        screenPoint={screenPoint}
                                    />
                                ),
                        )}

                    {/* ── Geometría de la escena ── */}
                    <OverlayCanopies
                        canopies={scene?.canopies ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={store.setSelectedId}
                        screenPoint={screenPoint}
                        screenDistance={screenDistance}
                    />
                    <OverlayPreviews
                        roomVertices={roomVertices}
                        roomPreviewPoint={roomPreviewPt}
                        wallPreview={wallPreview}
                        canopyPreview={canopyPreview}
                        screenPoint={screenPoint}
                        measureCadDistanceFromScreen={measureCadDistanceFromScreen}
                        angleSnapMode={ui.angleSnapMode}
                    />
                    <OverlayRooms
                        rooms={scene?.rooms ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={store.setSelectedId}
                        screenPoint={screenPoint}
                    />
                    <OverlayWalls
                        walls={scene?.walls ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={store.setSelectedId}
                        screenPoint={screenPoint}
                        screenDistance={screenDistance}
                    />
                    <OverlayWindows
                        windows={scene?.windows ?? []}
                        walls={scene?.walls ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={store.setSelectedId}
                        screenPoint={screenPoint}
                    />
                    <OverlayDoors
                        doors={scene?.doors ?? []}
                        walls={scene?.walls ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={store.setSelectedId}
                        screenPoint={screenPoint}
                    />
                    <OverlayFixtures
                        fixtures={scene?.fixtures ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={store.setSelectedId}
                        screenPoint={screenPoint}
                        screenDistance={screenDistance}
                    />
                    <CalibrationOverlay
                        line={visibleCalibrationLine}
                        snapPoint={visibleCalibrationSnapPoint}
                        screenPoint={screenPoint}
                        label={
                            pendingCalibration
                                // Mostrar distancia CAD nativa + ayuda para el usuario
                                ? `${pendingCalibration.cadDistance.toFixed(4)} ud CAD → ingresa la medida real`
                                : ui.activeTool === 'calibrate' &&
                                    visibleCalibrationLine
                                  ? 'Selecciona el segundo punto (Shift = ortogonal)'
                                  : null
                        }
                    />
                </svg>

                <CalibrationDialog
                    key={
                        pendingCalibration
                            ? `${pendingCalibration.start.x}:${pendingCalibration.start.y}:${pendingCalibration.end.x}:${pendingCalibration.end.y}`
                            : 'calibration-closed'
                    }
                    open={Boolean(pendingCalibration)}
                    cadDistance={pendingCalibration?.cadDistance ?? 0}
                    onCancel={() => {
                        setPendingCalibration(null);
                        setCalibrationLine(null);
                        setCalibrationSnapPoint(null);
                        store.setTool('select');
                    }}
                    onApply={(realDistanceMeters) => {
                        const previousEffective = effectiveScale;
                        const nextScale = store.applyCalibration(
                            pendingCalibration?.cadDistance ?? 0,
                            realDistanceMeters,
                        );

                        if (
                            nextScale &&
                            store.dxfEntities &&
                            previousEffective > 0
                        ) {
                            const nextEffective = getEffectiveScale(nextScale);
                            if (nextEffective > 0) {
                                rescaleDxfEntities(
                                    previousEffective,
                                    nextEffective,
                                );
                            }
                        }

                        setPendingCalibration(null);
                        setCalibrationLine(null);
                        setCalibrationSnapPoint(null);
                        store.setTool('select');
                    }}
                />

                {/* ── Overlay de carga ── */}
                {engine.isLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="flex min-w-65 flex-col items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
                            <div className="relative h-12 w-12">
                                <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
                                <div className="absolute inset-0 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-slate-200">
                                    Procesando archivo CAD
                                </p>
                                <p className="mt-1 font-mono text-xs text-slate-400">
                                    {engine.fileName}
                                </p>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-700">
                                <div
                                    className="h-1.5 rounded-full bg-cyan-500 transition-all"
                                    style={{ width: `${engine.loadProgress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Error banner ── */}
                {engine.error && !engine.isLoading && (
                    <div className="absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-red-700/70 bg-red-900/90 px-4 py-2 text-xs text-red-200 shadow-lg backdrop-blur-sm">
                        <span>⚠</span>
                        <span>{engine.error}</span>
                    </div>
                )}

                {/* ── Badge de documento activo ── */}
                {engine.activeDoc && !engine.isLoading && (
                    <div className="absolute top-3 right-3 z-30 flex items-center gap-2 rounded-lg border border-cyan-900/60 bg-slate-900/85 px-3 py-1.5 text-xs shadow-xl backdrop-blur">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                        <span className="font-mono text-cyan-300">
                            {engine.fileName}
                        </span>
                        <button
                            onClick={() => engine.fitToView()}
                            className="ml-1 rounded border border-cyan-700/40 bg-cyan-800/40 px-2 py-0.5 text-[10px] text-cyan-200 hover:bg-cyan-700/50"
                        >
                            Fit
                        </button>
                    </div>
                )}

                {/* ── Label del motor ── */}
                <div className="pointer-events-none absolute right-3 bottom-3 z-20 font-mono text-[9px] text-cyan-900/60 select-none">
                    mlightcad engine
                </div>
            </div>
        );
    },
);
