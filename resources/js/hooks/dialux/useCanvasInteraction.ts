import { useRef, useCallback, useEffect } from 'react';
import type {
    AngleSnapMode,
    DrawTool,
    DxfEntity,
    Wall,
    Fixture,
    Window,
    Door,
    Canopy,
    Room,
} from './useEditorStore';
import { 
    clampOpeningOffsetToWallSegment,
    projectPointToWallProjection,
    useInteractionHelpers, 
    wallLength, 
    projectPointToWallOffset,
} from './useInteractionHelpers';
import { useSnap } from './useSnap';
import { getCanopyDraftStart } from './cadInteraction';

export interface CanvasPoint {
    x: number;
    y: number;
}

interface InteractionOptions {
    activeTool: DrawTool;
    angleSnapMode: AngleSnapMode;
    resolveCadOsnap?: (
        scenePoint: CanvasPoint,
        lastPoint?: CanvasPoint | null,
    ) => CanvasPoint | null;
    dxfEntities: DxfEntity[] | null;
    walls: Wall[];
    /** Zoom actual del canvas (≥1) para calcular el umbral de cierre adaptativo */
    zoom?: number;
    onAddRoom: (verticesM: CanvasPoint[]) => void;
    onAddWall: (vertices: CanvasPoint[]) => void;
    onAddWindow: (wallId: string, offsetAlongWall: number) => void;
    onAddDoor: (
        wallId: string,
        offsetAlongWall: number,
        placement?: {
            segmentStartOffset: number;
            segmentEndOffset: number;
        },
    ) => void;
    onAddCanopy: (x1: number, y1: number, x2: number, y2: number) => void;
    onAddFixture: (xM: number, yM: number) => void;
    onCalibrationMeasure: (
        cadDistance: number,
        p1: CanvasPoint,
        p2: CanvasPoint,
    ) => void;
    onSelectObject: (id: string | null) => void;
    onPanChange: (dx: number, dy: number) => void;
    onDoubleClick: () => void;
    screenToScene: (cx: number, cy: number) => CanvasPoint;
    sceneToScreen: (sx: number, sy: number) => CanvasPoint;
    selectedId: string | null;
    fixtures: Fixture[];
    rooms: Room[];
    canopies: Canopy[];
    windows: Window[];
    doors: Door[];
    onMoveFixture: (id: string, x: number, y: number) => void;
    onMoveRoom: (id: string, dx: number, dy: number) => void;
    onMoveCanopy: (
        id: string,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
    ) => void;
    onMoveWindow: (id: string, wallId: string, offsetAlongWall: number) => void;
    onMoveDoor:   (id: string, wallId: string, offsetAlongWall: number) => void;
}

interface DrawState {
    isDrawing: boolean;
    startX: number;
    startY: number;
    roomVertices: CanvasPoint[];
    previewPoint: CanvasPoint | null;
    wallVertices: CanvasPoint[];
    wallStart: CanvasPoint | null;
    wallPreview: CanvasPoint[] | null;
    canopyPreview: { start: CanvasPoint; end: CanvasPoint } | null;
    /** Punto inicial de calibración en coordenadas de ESCENA (metros) — para preview/snap. */
    calibrationStart: CanvasPoint | null;
    /** Punto inicial de calibración en coordenadas de PANTALLA (px) — para screenToWorld nativo. */
    calibrationStartScreen: CanvasPoint | null;
    isDragging: boolean;
    dragStartScene: CanvasPoint | null;
    dragObjectId: string | null;
    dragObjectType: 'fixture' | 'room' | 'canopy' | 'window' | 'door' | null;
}

function isWallTool(tool: string): boolean {
    return tool === 'wall' || tool === 'education-wall';
}

export function useCanvasInteraction(opts: InteractionOptions) {
    const {
        activeTool,
        angleSnapMode,
        resolveCadOsnap,
        dxfEntities,
        walls,
        zoom = 1,
        onAddRoom,
        onAddWall,
        onAddWindow,
        onAddDoor,
        onAddCanopy,
        onAddFixture,
        onCalibrationMeasure,
        onSelectObject,
        onPanChange,
        onDoubleClick,
        screenToScene,
        sceneToScreen,
        fixtures,
        rooms,
        canopies,
        windows,
        doors,
        onMoveFixture,
        onMoveRoom,
        onMoveCanopy,
        onMoveWindow,
        onMoveDoor,
    } = opts;

    /**
     * Umbral de cierre de polígono adaptativo al zoom.
     * A zoom 1x → 20px. A zoom 2x → 10px. A zoom 4x → 8px (mínimo).
     * Esto evita que muros cortos se autocierren prematuramente.
     */
    const closeThresholdPx = Math.max(8, 20 / zoom);

    /**
     * En modo libre, desactivar el snap a entidades DXF.
     * El snap a muros propios y vértices de rooms sigue activo.
     * Esto resuelve el problema de "dibujás 5m pero el snap te lleva a 7m".
     */
    const disableDxfSnap = angleSnapMode === 'free';

    const stateRef = useRef<DrawState>({
        isDrawing: false,
        startX: 0,
        startY: 0,
        roomVertices: [],
        previewPoint: null,
        wallVertices: [],
        wallStart: null,
        wallPreview: null,
        canopyPreview: null,
        calibrationStart: null,
        calibrationStartScreen: null,
        isDragging: false,
        dragStartScene: null,
        dragObjectId: null,
        dragObjectType: null,
    });

    useEffect(() => {
        if (activeTool !== 'calibrate') {
            stateRef.current.calibrationStart = null;
            stateRef.current.calibrationStartScreen = null;
        }
    }, [activeTool]);

    // ── Conversión coordenadas ────────────────────────────────────────────────
    const canvasToScene = useCallback(
        (cx: number, cy: number): CanvasPoint => screenToScene(cx, cy),
        [screenToScene],
    );

    const sceneToCanvas = useCallback(
        (sx: number, sy: number): CanvasPoint => sceneToScreen(sx, sy),
        [sceneToScreen],
    );

    // ── Snapping Hook ──────────────────────────────────────────────────────────
    // Extraer todos los vértices de rooms existentes para snap de alineación
    const roomVerticesScene = rooms.flatMap((r) => r.vertices);

    const { resolveSnap, getGuideAngles, applyAngleSnap } = useSnap({
        dxfEntities,
        walls,
        sceneToCanvas,
        extraVerticesScene: roomVerticesScene,
        zoom,
    });

    // ── Interaction Helpers Hook ───────────────────────────────────────────────
    const {
        findNearestWall,
        findNearestFixture,
        findNearestRoom,
        findNearestCanopy,
        findNearestWindow,
        findNearestDoor,
    } = useInteractionHelpers({
        walls,
        fixtures,
        rooms,
        canopies,
        windows,
        doors,
        sceneToCanvas,
    });

    // Helper local para determinar el punto previo para ortho snap
    const getPrevPointM = useCallback((tool: string, s: DrawState): CanvasPoint | null => {
        if ((tool === 'room' || tool === 'corridor' || tool === 'stair') && s.roomVertices.length > 0) return s.roomVertices[s.roomVertices.length - 1];
        if (isWallTool(tool) && s.wallVertices.length > 0) return s.wallVertices[s.wallVertices.length - 1];
        if (tool === 'canopy' && s.isDrawing && s.wallStart) return s.wallStart;
        if (tool === 'calibrate' && s.calibrationStart) return s.calibrationStart;
        return null;
    }, []);

    const getReferenceAngles = useCallback(
        (tool: string, s: DrawState, cx: number, cy: number): number[] => {
            const inferred = getGuideAngles(cx, cy);
            const vertices =
                (tool === 'room' || tool === 'corridor' || tool === 'stair')
                    ? s.roomVertices
                    : isWallTool(tool)
                      ? s.wallVertices
                      : [];

            if (vertices.length < 2) return inferred;

            const prev = vertices[vertices.length - 2];
            const last = vertices[vertices.length - 1];
            const dx = last.x - prev.x;
            const dy = last.y - prev.y;
            if (Math.hypot(dx, dy) < 0.001) return inferred;

            const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
            return [
                ...inferred,
                angle,
                angle + 90,
                angle + 180,
                angle + 270,
            ];
        },
        [getGuideAngles],
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Mouse Down
    // ─────────────────────────────────────────────────────────────────────────
    const onMouseDown = useCallback(
        (
            e: React.MouseEvent<SVGSVGElement>,
            setRoomVertices: (v: CanvasPoint[]) => void,
            setWallPreview: (p: CanvasPoint[] | null) => void,
            setCanopyPreview: (
                p: { start: CanvasPoint; end: CanvasPoint } | null,
            ) => void,
            setCalibrationPreview: (
                p: { start: CanvasPoint; end: CanvasPoint } | null,
            ) => void,
            setCalibrationSnapPoint: (p: CanvasPoint | null) => void,
        ) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            if (isNaN(rect.left) || isNaN(rect.top)) return;
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;

            const s = stateRef.current;
            const activeVerticesCanvas = (
                (activeTool === 'room' || activeTool === 'corridor' || activeTool === 'stair') ? s.roomVertices : (isWallTool(activeTool) ? s.wallVertices : [])
            ).map((v) => sceneToCanvas(v.x, v.y));

            const prevPointM = getPrevPointM(activeTool, s);
            const cadOsnapPoint = resolveCadOsnap?.(
                canvasToScene(rawX, rawY),
                prevPointM,
            );
            const snapped = cadOsnapPoint
                ? sceneToCanvas(cadOsnapPoint.x, cadOsnapPoint.y)
                : resolveSnap(rawX, rawY, activeVerticesCanvas, disableDxfSnap);
            const referenceAngles = getReferenceAngles(
                activeTool,
                s,
                snapped.x,
                snapped.y,
            );
            const finalPointCanvas = applyAngleSnap(
                snapped.x,
                snapped.y,
                prevPointM,
                angleSnapMode,
                e.shiftKey,
                referenceAngles,
            );
            const cx = finalPointCanvas.x;
            const cy = finalPointCanvas.y;

            if (activeTool === 'fixture') {
                const sc = canvasToScene(cx, cy);
                onAddFixture(sc.x, sc.y);
                return;
            }

            if (activeTool === 'calibrate') {
                if (!s.calibrationStart) {
                    // Primer clic: guardar en ESCENA (para preview/snap visual)
                    // y en PANTALLA (para screenToWorld nativo del motor CAD).
                    const scenePoint = canvasToScene(cx, cy);
                    s.calibrationStart       = scenePoint;
                    s.calibrationStartScreen = { x: cx, y: cy };  // ← píxeles reales SVG
                    setCalibrationPreview({ start: scenePoint, end: scenePoint });
                    setCalibrationSnapPoint(scenePoint);
                    return;
                }

                // Segundo clic.
                const endScene  = canvasToScene(cx, cy);
                const endScreen = { x: cx, y: cy };  // ← píxeles reales SVG

                const sceneDistanceM = Math.hypot(
                    endScene.x - s.calibrationStart.x,
                    endScene.y - s.calibrationStart.y,
                );

                if (sceneDistanceM > 0) {
                    setCalibrationPreview({ start: s.calibrationStart, end: endScene });
                    setCalibrationSnapPoint(endScene);
                    // ✅ SE PASAN COORDENADAS DE PANTALLA (px) — NO de escena (metros).
                    // measureCadDistanceFromScreen llama cadView.screenToWorld(px) para
                    // obtener la distancia en unidades CAD nativas (mm, cm, m según DXF).
                    // Si se pasan metros como si fueran px → 1.8 m interpretado como 1.8 px
                    // → coordenada CAD absurda → cadDistance erróneo → 26,742 m².
                    onCalibrationMeasure(
                        sceneDistanceM,
                        s.calibrationStartScreen!,  // px
                        endScreen,                   // px
                    );
                } else {
                    setCalibrationPreview(null);
                    setCalibrationSnapPoint(null);
                }
                s.calibrationStart       = null;
                s.calibrationStartScreen = null;
                s.isDrawing = false;
                return;
            }


            if (activeTool === 'room' || activeTool === 'corridor' || activeTool === 'stair') {
                if (s.roomVertices.length > 2) {
                    const first = sceneToCanvas(s.roomVertices[0].x, s.roomVertices[0].y);
                    // Umbral adaptativo al zoom: evita cierre prematuro en muros cortos
                    if (Math.hypot(first.x - cx, first.y - cy) < closeThresholdPx) {
                        onAddRoom(s.roomVertices);
                        stateRef.current = { ...s, isDrawing: false, roomVertices: [], previewPoint: null };
                        setRoomVertices([]);
                        return;
                    }
                }
                s.isDrawing = true;
                const scenePoint = canvasToScene(cx, cy);
                s.roomVertices.push(scenePoint);
                s.previewPoint = scenePoint;
                setRoomVertices([...s.roomVertices]);
                return;
            }

            if (isWallTool(activeTool)) {
                if (!s.wallVertices) s.wallVertices = [];
                const newPoint = canvasToScene(cx, cy);
                if (s.wallVertices.length > 0) {
                    const first = sceneToCanvas(s.wallVertices[0].x, s.wallVertices[0].y);
                    const newPointScreen = sceneToCanvas(newPoint.x, newPoint.y);
                    const dist = Math.hypot(newPointScreen.x - first.x, newPointScreen.y - first.y);
                    // Umbral adaptativo al zoom igual que para rooms
                    if (dist < closeThresholdPx) {
                        onAddWall([...s.wallVertices, s.wallVertices[0]]);
                        s.wallVertices = [];
                        s.isDrawing = false;
                        setWallPreview(null);
                        return;
                    }
                }
                s.wallVertices.push(newPoint);
                s.isDrawing = true;
                return;
            }

            if (activeTool === 'window') {
                const hit = findNearestWall(cx, cy);
                if (hit) onAddWindow(hit.wall.id, hit.offset);
                return;
            }

            if (activeTool === 'door') {
                const hit = findNearestWall(cx, cy);
                if (hit) onAddDoor(hit.wall.id, hit.offset, hit);
                return;
            }

            if (activeTool === 'canopy') {
                s.wallStart = getCanopyDraftStart({ x: cx, y: cy }, canvasToScene);
                s.isDrawing = true;
                return;
            }

            if (activeTool === 'pan') {
                stateRef.current = { ...s, isDrawing: true, startX: cx, startY: cy };
                return;
            }

            if (activeTool === 'select') {
                const fixtureHit = findNearestFixture(cx, cy);
                if (fixtureHit) {
                    onSelectObject(fixtureHit.id);
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(cx, cy);
                    s.dragObjectId = fixtureHit.id;
                    s.dragObjectType = 'fixture';
                    return;
                }

                const roomHit = findNearestRoom(cx, cy);
                if (roomHit) {
                    onSelectObject(roomHit.id);
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(cx, cy);
                    s.dragObjectId = roomHit.id;
                    s.dragObjectType = 'room';
                    return;
                }

                const canopyHit = findNearestCanopy(cx, cy);
                if (canopyHit) {
                    onSelectObject(canopyHit.id);
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(cx, cy);
                    s.dragObjectId = canopyHit.id;
                    s.dragObjectType = 'canopy';
                    return;
                }

                const windowHit = findNearestWindow(cx, cy);
                if (windowHit) {
                    onSelectObject(windowHit.id);
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(cx, cy);
                    s.dragObjectId = windowHit.id;
                    s.dragObjectType = 'window';
                    return;
                }

                const doorHit = findNearestDoor(cx, cy);
                if (doorHit) {
                    onSelectObject(doorHit.id);
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(cx, cy);
                    s.dragObjectId = doorHit.id;
                    s.dragObjectType = 'door';
                    return;
                }

                onSelectObject(null);
            }
        },
        [
            activeTool, angleSnapMode, canvasToScene, sceneToCanvas, resolveCadOsnap, resolveSnap, getReferenceAngles, applyAngleSnap, getPrevPointM,
            findNearestWall, findNearestFixture, findNearestRoom, findNearestCanopy, findNearestWindow, findNearestDoor,
            onAddFixture, onCalibrationMeasure, onAddRoom, onAddWall, onAddWindow, onAddDoor, onSelectObject,
        ],
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Mouse Move
    // ─────────────────────────────────────────────────────────────────────────
    const onMouseMove = useCallback(
        (
            e: React.MouseEvent<SVGSVGElement>,
            setPreviewPoint: (pt: CanvasPoint | null) => void,
            setWallPreview: (p: CanvasPoint[] | null) => void,
            setCanopyPreview: (
                p: { start: CanvasPoint; end: CanvasPoint } | null,
            ) => void,
            setCalibrationPreview: (
                p: { start: CanvasPoint; end: CanvasPoint } | null,
            ) => void,
            setCalibrationSnapPoint: (p: CanvasPoint | null) => void,
        ) => {
            const s = stateRef.current;
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            if (isNaN(rect.left) || isNaN(rect.top)) return;
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;

            const activeVerticesCanvas = (
                (activeTool === 'room' || activeTool === 'corridor' || activeTool === 'stair') ? s.roomVertices : (isWallTool(activeTool) ? s.wallVertices : [])
            ).map((v) => sceneToCanvas(v.x, v.y));

            const prevPointM = getPrevPointM(activeTool, s);
            const cadOsnapPoint = resolveCadOsnap?.(
                canvasToScene(rawX, rawY),
                prevPointM,
            );
            const snapped = cadOsnapPoint
                ? sceneToCanvas(cadOsnapPoint.x, cadOsnapPoint.y)
                : resolveSnap(rawX, rawY, activeVerticesCanvas, disableDxfSnap);
            const referenceAngles = getReferenceAngles(
                activeTool,
                s,
                snapped.x,
                snapped.y,
            );
            const finalPointCanvas = applyAngleSnap(
                snapped.x,
                snapped.y,
                prevPointM,
                angleSnapMode,
                e.shiftKey,
                referenceAngles,
            );
            const cx = finalPointCanvas.x;
            const cy = finalPointCanvas.y;

            if ((activeTool === 'room' || activeTool === 'corridor' || activeTool === 'stair') && s.roomVertices.length > 0) {
                s.previewPoint = canvasToScene(cx, cy);
                setPreviewPoint(s.previewPoint);
                return;
            }

            if (activeTool === 'calibrate') {
                setCalibrationSnapPoint(canvasToScene(cx, cy));
            }

            if (isWallTool(activeTool) && s.wallVertices && s.wallVertices.length > 0) {
                setWallPreview([...s.wallVertices, canvasToScene(cx, cy)]);
                return;
            }

            if (activeTool === 'canopy' && s.isDrawing && s.wallStart) {
                setCanopyPreview({ start: s.wallStart, end: canvasToScene(cx, cy) });
                return;
            }

            if (activeTool === 'calibrate' && s.calibrationStart) {
                setCalibrationPreview({ start: s.calibrationStart, end: canvasToScene(cx, cy) });
                return;
            }

            if (activeTool === 'pan' && s.isDrawing) {
                const dx = cx - s.startX;
                const dy = cy - s.startY;
                s.startX = cx;
                s.startY = cy;
                onPanChange(dx, dy);
            }

            if (s.isDragging && s.dragObjectId && s.dragStartScene) {
                const currentScene = canvasToScene(cx, cy);
                const dxM = currentScene.x - s.dragStartScene.x;
                const dyM = currentScene.y - s.dragStartScene.y;

                if (s.dragObjectType === 'fixture') {
                    const fixture = fixtures.find((f) => f.id === s.dragObjectId);
                    if (fixture) onMoveFixture(s.dragObjectId, fixture.x + dxM, fixture.y + dyM);
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'room') {
                    const room = rooms.find((r) => r.id === s.dragObjectId);
                    if (room) onMoveRoom(s.dragObjectId, dxM, dyM);
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'canopy') {
                    const canopy = canopies.find((c) => c.id === s.dragObjectId);
                    if (canopy) {
                        onMoveCanopy(s.dragObjectId, canopy.x1 + dxM, canopy.y1 + dyM, canopy.x2 + dxM, canopy.y2 + dyM);
                    }
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'window') {
                    const win = windows.find((w) => w.id === s.dragObjectId);
                    const wall = win ? walls.find((w) => w.id === win.wallId) : null;
                    if (win && wall) {
                        const wallLen = wallLength(wall.vertices);
                        let newOffset = projectPointToWallOffset(currentScene, wall);
                        newOffset = Math.max(0.1, Math.min(wallLen - 0.1, newOffset));
                        onMoveWindow(s.dragObjectId, win.wallId, newOffset);
                    }
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'door') {
                    const door = doors.find((d) => d.id === s.dragObjectId);
                    const wall = door ? walls.find((w) => w.id === door.wallId) : null;
                    if (door && wall) {
                        const wallLen = wallLength(wall.vertices);
                        const projection = projectPointToWallProjection(currentScene, wall);
                        const newOffset = projection
                            ? clampOpeningOffsetToWallSegment(
                                  projection,
                                  door.width,
                                  wallLen,
                                  'center',
                              )
                            : Math.max(
                                  0,
                                  Math.min(wallLen - door.width, door.offsetAlongWall),
                              );
                        onMoveDoor(s.dragObjectId, door.wallId, newOffset);
                    }
                    s.dragStartScene = currentScene;
                }
            }
        },
        [
            activeTool, angleSnapMode, sceneToCanvas, resolveCadOsnap, resolveSnap, getReferenceAngles, applyAngleSnap, getPrevPointM, canvasToScene,
            onPanChange, fixtures, rooms, canopies, windows, doors, walls, onMoveFixture, onMoveRoom, onMoveCanopy, onMoveWindow, onMoveDoor,
        ],
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Mouse Up
    // ─────────────────────────────────────────────────────────────────────────
    const onMouseUp = useCallback(
        (
            e: React.MouseEvent<SVGSVGElement>,
            setCanopyPreview: (
                p: { start: CanvasPoint; end: CanvasPoint } | null,
            ) => void,
        ) => {
            const s = stateRef.current;
            if (activeTool === 'canopy' && s.isDrawing && s.wallStart) {
                const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                if (isNaN(rect.left) || isNaN(rect.top)) return;
                const rawX = e.clientX - rect.left;
                const rawY = e.clientY - rect.top;
                const snapped = resolveSnap(rawX, rawY);
                const sc1 = s.wallStart;
                const sc2 = canvasToScene(snapped.x, snapped.y);
                if (Math.hypot(sc2.x - sc1.x, sc2.y - sc1.y) > 0.1) {
                    onAddCanopy(sc1.x, sc1.y, sc2.x, sc2.y);
                }
                s.wallStart = null;
                s.isDrawing = false;
                setCanopyPreview(null);
                return;
            }

            if (activeTool === 'pan') s.isDrawing = false;

            if (s.isDragging) {
                s.isDragging = false;
                s.dragStartScene = null;
                s.dragObjectId = null;
                s.dragObjectType = null;
            }
        },
        [activeTool, canvasToScene, resolveSnap, onAddCanopy],
    );

    const handleDoubleClick = useCallback(() => {
        const s = stateRef.current;
        if (isWallTool(activeTool) && s.wallVertices && s.wallVertices.length >= 2) {
            onAddWall(s.wallVertices);
            s.wallVertices = [];
            s.isDrawing = false;
            onDoubleClick();
        }
    }, [activeTool, onAddWall, onDoubleClick]);

    return {
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onDoubleClick: handleDoubleClick,
        isDragging: () => stateRef.current.isDragging,
    };
}
