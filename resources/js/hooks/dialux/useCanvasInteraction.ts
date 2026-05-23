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
    LightSwitch,
} from './useEditorStore';
import { 
    clampOpeningOffsetToWallSegment,
    projectPointToWallProjection,
    useInteractionHelpers, 
    wallLength, 
    projectPointToWallOffset,
    resolveOffsetOnWall,
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
    onAddFixtureGrid?: (roomId: string) => void;
    onCalibrationMeasure: (
        cadDistance: number,
        p1: CanvasPoint,
        p2: CanvasPoint,
    ) => void;
    /** Llamado cuando el usuario cierra el polígono de medición de área */
    onMeasureAreaFinish: (vertices: CanvasPoint[]) => void;
    onSelectObject: (id: string | null, multi?: boolean) => void;
    onPanChange: (dx: number, dy: number) => void;
    onDoubleClick: () => void;
    screenToScene: (cx: number, cy: number) => CanvasPoint;
    sceneToScreen: (sx: number, sy: number) => CanvasPoint;
    selectedId: string | null;
    selectedFixtureIds: string[];
    fixtures: Fixture[];
    lightSwitches: LightSwitch[];
    rooms: Room[];
    canopies: Canopy[];
    windows: Window[];
    doors: Door[];
    onMoveFixture: (id: string, x: number, y: number) => void;
    onMoveFixtures: (ids: string[], dx: number, dy: number) => void;
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
    onAddLightSwitch: (x: number, y: number, wallId?: string) => void;
    onMoveLightSwitch: (id: string, x: number, y: number, wallId?: string) => void;
    onConnectWire?: (switchId: string, fixtureId: string) => void;
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
    /** Vértices acumulados para la herramienta measure-area (metros de escena). */
    measureAreaVertices: CanvasPoint[];
    wireStartNode: { type: 'switch' | 'fixture'; id: string } | null;
    isDragging: boolean;
    dragStartScene: CanvasPoint | null;
    dragObjectId: string | null;
    dragObjectType: 'fixture' | 'room' | 'canopy' | 'window' | 'door' | 'switch' | null;
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
        onAddFixtureGrid,
        onAddLightSwitch,
        onCalibrationMeasure,
        onMeasureAreaFinish,
        onSelectObject,
        onPanChange,
        onDoubleClick,
        screenToScene,
        sceneToScreen,
        fixtures,
        lightSwitches,
        rooms,
        canopies,
        windows,
        doors,
        selectedFixtureIds,
        onMoveFixture,
        onMoveFixtures,
        onMoveRoom,
        onMoveCanopy,
        onMoveWindow,
        onMoveDoor,
        onMoveLightSwitch,
        onConnectWire,
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
        measureAreaVertices: [],
        wireStartNode: null,
        isDragging: false,
        dragStartScene: null,
        dragObjectId: null,
        dragObjectType: null,
    });

    useEffect(() => {
        if (activeTool !== 'calibrate') {
            stateRef.current.calibrationStart = null;
        }
        if (activeTool !== 'measure-area') {
            stateRef.current.measureAreaVertices = [];
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

    const {
        findNearestWall,
        findNearestFixture,
        findNearestRoom,
        findNearestCanopy,
        findNearestWindow,
        findNearestDoor,
        findNearestLightSwitch,
    } = useInteractionHelpers({
        walls,
        fixtures,
        rooms,
        canopies,
        windows,
        doors,
        lightSwitches,
        sceneToCanvas,
    });

    // Helper local para determinar el punto previo para ortho snap
    const getPrevPointM = useCallback((tool: string, s: DrawState): CanvasPoint | null => {
        if ((tool === 'room' || tool === 'corridor' || tool === 'stair') && s.roomVertices.length > 0) return s.roomVertices[s.roomVertices.length - 1];
        if (isWallTool(tool) && s.wallVertices.length > 0) return s.wallVertices[s.wallVertices.length - 1];
        if (tool === 'canopy' && s.isDrawing && s.wallStart) return s.wallStart;
        if (tool === 'calibrate' && s.calibrationStart) return s.calibrationStart;
        if (tool === 'measure-area' && s.measureAreaVertices.length > 0) return s.measureAreaVertices[s.measureAreaVertices.length - 1];
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
            setMeasureAreaVertices: (v: CanvasPoint[]) => void,
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
            const noSnapTools = ['switch', 'wire', 'fixture', 'fixture-grid', 'select', 'pan'];
            const shouldSnap = !noSnapTools.includes(activeTool);

            const cadOsnapPoint = shouldSnap ? resolveCadOsnap?.(
                canvasToScene(rawX, rawY),
                prevPointM,
            ) : null;
            let cx = rawX;
            let cy = rawY;

            if (shouldSnap) {
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
                cx = finalPointCanvas.x;
                cy = finalPointCanvas.y;
            }

            if (activeTool === 'fixture') {
                const sc = canvasToScene(cx, cy);
                onAddFixture(sc.x, sc.y);
                return;
            }

            if (activeTool === 'fixture-grid') {
                const roomHit = findNearestRoom(cx, cy);
                if (roomHit && onAddFixtureGrid) {
                    onAddFixtureGrid(roomHit.id);
                }
                return;
            }

            if (activeTool === 'measure-area') {
                const scenePoint = canvasToScene(cx, cy);
                if (s.measureAreaVertices.length >= 2) {
                    const first = sceneToCanvas(s.measureAreaVertices[0].x, s.measureAreaVertices[0].y);
                    if (Math.hypot(first.x - cx, first.y - cy) < closeThresholdPx) {
                        // Cerrar polígono
                        if (s.measureAreaVertices.length >= 3) {
                            onMeasureAreaFinish([...s.measureAreaVertices]);
                        }
                        stateRef.current.measureAreaVertices = [];
                        setMeasureAreaVertices([]);
                        return;
                    }
                }
                s.measureAreaVertices.push(scenePoint);
                setMeasureAreaVertices([...s.measureAreaVertices]);
                return;
            }

            if (activeTool === 'calibrate') {
                if (!s.calibrationStart) {
                    // Primer clic: guardar en ESCENA
                    const scenePoint = canvasToScene(cx, cy);
                    s.calibrationStart = scenePoint;
                    setCalibrationPreview({ start: scenePoint, end: scenePoint });
                    setCalibrationSnapPoint(scenePoint);
                    return;
                }

                // Segundo clic.
                const endScene = canvasToScene(cx, cy);

                const sceneDistanceM = Math.hypot(
                    endScene.x - s.calibrationStart.x,
                    endScene.y - s.calibrationStart.y,
                );

                if (sceneDistanceM > 0) {
                    setCalibrationPreview({ start: s.calibrationStart, end: endScene });
                    setCalibrationSnapPoint(endScene);
                    // Pasamos coordenadas de escena (metros) al canvas para recuperar
                    // la distancia CAD nativa pura dividiendo por effectiveScale.
                    onCalibrationMeasure(
                        sceneDistanceM,
                        s.calibrationStart, // metros
                        endScene,           // metros
                    );
                } else {
                    setCalibrationPreview(null);
                    setCalibrationSnapPoint(null);
                }
                s.calibrationStart       = null;
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

            if (activeTool === 'switch') {
                // El switch se puede poner en la pared, o libre.
                // Intentamos anclarlo a la pared más cercana, si no, lo ponemos libre.
                const hit = findNearestWall(cx, cy);
                const scenePoint = canvasToScene(cx, cy);
                if (hit) {
                    const wallPos = resolveOffsetOnWall(hit.wall, hit.offset);
                    if (wallPos) {
                        onAddLightSwitch(wallPos.x, wallPos.y, hit.wall.id);
                    } else {
                        onAddLightSwitch(scenePoint.x, scenePoint.y);
                    }
                } else {
                    onAddLightSwitch(scenePoint.x, scenePoint.y);
                }
                return;
            }

            if (activeTool === 'wire') {
                const switchHit = findNearestLightSwitch(cx, cy);
                const fixtureHit = findNearestFixture(cx, cy);

                if (switchHit) {
                    if (s.wireStartNode?.type === 'fixture') {
                        onConnectWire?.(switchHit.id, s.wireStartNode.id);
                        // Convertir el switch en el nuevo punto de inicio para seguir cableando
                        s.wireStartNode = { type: 'switch', id: switchHit.id };
                    } else {
                        s.wireStartNode = { type: 'switch', id: switchHit.id };
                    }
                    return;
                }

                if (fixtureHit) {
                    if (s.wireStartNode?.type === 'switch') {
                        onConnectWire?.(s.wireStartNode.id, fixtureHit.id);
                        // No limpiar s.wireStartNode, mantener el switch seleccionado
                        // para que el usuario pueda seguir haciendo clic en más focos.
                    } else {
                        s.wireStartNode = { type: 'fixture', id: fixtureHit.id };
                    }
                    return;
                }
                
                // Si clicamos al vacio, cancelar
                s.wireStartNode = null;
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
                    if (e.ctrlKey) {
                        onSelectObject(fixtureHit.id, true);
                    } else {
                        onSelectObject(fixtureHit.id, false);
                    }
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(cx, cy);
                    s.dragObjectId = fixtureHit.id;
                    s.dragObjectType = 'fixture';
                    return;
                }

                const switchHit = findNearestLightSwitch(cx, cy);
                if (switchHit) {
                    if (e.ctrlKey) {
                        onSelectObject(switchHit.id, true);
                    } else {
                        onSelectObject(switchHit.id, false);
                    }
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(cx, cy);
                    s.dragObjectId = switchHit.id;
                    s.dragObjectType = 'switch';
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
            onAddFixture, onCalibrationMeasure, onMeasureAreaFinish, onAddRoom, onAddWall, onAddWindow, onAddDoor, onSelectObject,
            closeThresholdPx,
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
            const noSnapTools = ['switch', 'wire', 'fixture', 'fixture-grid', 'select', 'pan'];
            const shouldSnap = !noSnapTools.includes(activeTool);

            const cadOsnapPoint = shouldSnap ? resolveCadOsnap?.(
                canvasToScene(rawX, rawY),
                prevPointM,
            ) : null;
            let cx = rawX;
            let cy = rawY;

            if (shouldSnap) {
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
                cx = finalPointCanvas.x;
                cy = finalPointCanvas.y;
            }

            if ((activeTool === 'room' || activeTool === 'corridor' || activeTool === 'stair') && s.roomVertices.length > 0) {
                s.previewPoint = canvasToScene(cx, cy);
                setPreviewPoint(s.previewPoint);
                return;
            }

            if (activeTool === 'measure-area' && s.measureAreaVertices.length > 0) {
                setPreviewPoint(canvasToScene(cx, cy));
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
                    if (selectedFixtureIds.includes(s.dragObjectId)) {
                        // Mover múltiples luminarias
                        onMoveFixtures(selectedFixtureIds, dxM, dyM);
                    } else {
                        // Mover una sola (fallback o click en una no seleccionada que arrastró)
                        const fixture = fixtures.find((f) => f.id === s.dragObjectId);
                        if (fixture) onMoveFixture(s.dragObjectId, fixture.x + dxM, fixture.y + dyM);
                    }
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
                } else if (s.dragObjectType === 'switch') {
                    const lSwitch = lightSwitches.find((sw) => sw.id === s.dragObjectId);
                    if (lSwitch) {
                        // Movemos el switch. Si intentan anclarlo a otra pared, buscaremos la más cercana a currentScene
                        const newX = lSwitch.x + dxM;
                        const newY = lSwitch.y + dyM;
                        // Intentar anclar a la pared más cercana
                        const hit = findNearestWall(cx, cy);
                        if (hit) {
                            const wallPos = resolveOffsetOnWall(hit.wall, hit.offset);
                            if (wallPos) {
                                onMoveLightSwitch(s.dragObjectId, wallPos.x, wallPos.y, hit.wall.id);
                            } else {
                                onMoveLightSwitch(s.dragObjectId, newX, newY, hit.wall.id);
                            }
                        } else {
                            onMoveLightSwitch(s.dragObjectId, newX, newY, undefined); // sin pared
                        }
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
            return;
        }
        if (activeTool === 'measure-area' && s.measureAreaVertices.length >= 3) {
            onMeasureAreaFinish([...s.measureAreaVertices]);
            stateRef.current.measureAreaVertices = [];
            onDoubleClick();
        }
    }, [activeTool, onAddWall, onMeasureAreaFinish, onDoubleClick]);

    return {
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onDoubleClick: handleDoubleClick,
        isDragging: () => stateRef.current.isDragging,
    };
}
