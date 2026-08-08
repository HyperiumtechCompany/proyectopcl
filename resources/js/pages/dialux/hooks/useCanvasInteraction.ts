import { useRef, useCallback, useEffect } from 'react';
import {
    cycleCandidate,
    hitTestAtPoint,
} from '@/pages/dialux/selection/hitTest';
import { getCanopyDraftStart } from './cadInteraction';
import { resolveWireNodePosition } from './wireNodePosition';
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
    Conductor,
    Partition,
    ElectricalDevice,
    ElectricalDeviceType,
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
    onMeasureDistanceChange: (
        measurement: { start: CanvasPoint; end: CanvasPoint } | null,
        isFinal: boolean,
    ) => void;
    electricalDeviceTemplate?: {
        type: ElectricalDeviceType;
        label?: string;
    } | null;
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
    onMoveDoor: (id: string, wallId: string, offsetAlongWall: number) => void;
    onAddLightSwitch: (x: number, y: number, wallId?: string) => void;
    onMoveLightSwitch: (
        id: string,
        x: number,
        y: number,
        wallId?: string,
    ) => void;
    onMoveElectricalDevice?: (
        id: string,
        x: number,
        y: number,
        wallId?: string,
    ) => void;
    onConnectWire?: (
        sourceId: string,
        targetId: string,
        waypoints?: { x: number; y: number }[],
    ) => void;
    /** Reconecta un extremo de un cable ya existente a otro nodo (arrastrar handle) */
    onReconnectWireEndpoint?: (
        conductorId: string,
        endpoint: 'source' | 'target',
        newNodeId: string,
    ) => void;
    onAddElectricalDevice?: (x: number, y: number, wallId?: string) => void;
    electricalDevices?: ElectricalDevice[];
    /** Cables y tabiques: solo participan del hit-testing de selección */
    conductors?: Conductor[];
    partitions?: Partition[];
    /** Notifica el inicio/fin de un arrastre de objeto (para agrupar el historial) */
    onDragGesture?: (phase: 'start' | 'end') => void;
    /** Regla compartida con la leyenda para excluir objetos ocultos de la selección. */
    isObjectSelectable?: (id: string) => boolean;
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
    measurementStart: CanvasPoint | null;
    /** Vértices acumulados para la herramienta measure-area (metros de escena). */
    measureAreaVertices: CanvasPoint[];
    wireStartNode: { type: 'switch' | 'fixture' | 'device'; id: string } | null;
    /** Puntos intermedios acumulados mientras se traza un cable (clics en vacío entre nodos). */
    wireWaypoints: CanvasPoint[];
    isDragging: boolean;
    dragStartScene: CanvasPoint | null;
    dragObjectId: string | null;
    dragObjectType:
        | 'fixture'
        | 'room'
        | 'canopy'
        | 'window'
        | 'door'
        | 'switch'
        | 'electrical-device'
        | 'conductor-endpoint'
        | null;
    /** Extremo del conductor que se está arrastrando (solo cuando dragObjectType === 'conductor-endpoint') */
    dragConductorEndpoint: 'source' | 'target' | null;
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
        onMeasureDistanceChange,
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
        electricalDeviceTemplate,
        selectedFixtureIds,
        onMoveFixture,
        onMoveFixtures,
        onMoveRoom,
        onMoveCanopy,
        onMoveWindow,
        onMoveDoor,
        onMoveLightSwitch,
        onMoveElectricalDevice,
        onConnectWire,
        onReconnectWireEndpoint,
        onAddElectricalDevice,
        electricalDevices = [],
        conductors = [],
        partitions = [],
        onDragGesture,
        isObjectSelectable,
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
        measurementStart: null,
        measureAreaVertices: [],
        wireStartNode: null,
        wireWaypoints: [],
        isDragging: false,
        dragStartScene: null,
        dragObjectId: null,
        dragObjectType: null,
        dragConductorEndpoint: null,
    });

    useEffect(() => {
        if (activeTool !== 'calibrate') {
            stateRef.current.calibrationStart = null;
        }
        if (activeTool !== 'measure') {
            stateRef.current.measurementStart = null;
            onMeasureDistanceChange(null, false);
        }
        if (activeTool !== 'measure-area') {
            stateRef.current.measureAreaVertices = [];
        }
        // La limpieza solo debe ejecutarse al cambiar de herramienta; el callback
        // llega inline desde el canvas y cambia de identidad en cada render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        findNearestElectricalDevice,
    } = useInteractionHelpers({
        walls,
        fixtures,
        rooms,
        canopies,
        windows,
        doors,
        lightSwitches,
        electricalDevices,
        sceneToCanvas,
    });

    // Candidato de nodo (switch/fixture/device) más cercano al cursor, para
    // trazar o reconectar cables. Compartido entre la herramienta "wire" y el
    // arrastre de un handle de extremo de un cable ya seleccionado.
    type WireNodeCandidate = {
        kind: 'switch' | 'fixture' | 'device';
        id: string;
        x: number;
        y: number;
    };
    const pickWireNodeCandidate = useCallback(
        (cx: number, cy: number): WireNodeCandidate | null => {
            const switchHit = findNearestLightSwitch(cx, cy);
            const fixtureHit = findNearestFixture(cx, cy);
            const deviceHit = findNearestElectricalDevice(cx, cy);

            const dist2 = (p: { x: number; y: number } | null): number => {
                if (!p) return Infinity;
                const s = sceneToCanvas(p.x, p.y);
                return (s.x - cx) ** 2 + (s.y - cy) ** 2;
            };
            const dist2Switch = dist2(switchHit);
            const dist2Fixture = dist2(fixtureHit);
            const dist2Device = dist2(deviceHit);

            // El candidato más cercano gana (switch 15px, fixture 18px, device 18px — reducido para no solapar)
            const SNAP_SW = 15 * 15;
            const SNAP_FIX = 18 * 18;
            const SNAP_DEV = 18 * 18;

            const candidates: (WireNodeCandidate & { dist2: number })[] = [];
            if (switchHit && dist2Switch <= SNAP_SW)
                candidates.push({
                    kind: 'switch',
                    id: switchHit.id,
                    x: switchHit.x,
                    y: switchHit.y,
                    dist2: dist2Switch,
                });
            if (fixtureHit && dist2Fixture <= SNAP_FIX)
                candidates.push({
                    kind: 'fixture',
                    id: fixtureHit.id,
                    x: fixtureHit.x,
                    y: fixtureHit.y,
                    dist2: dist2Fixture,
                });
            if (deviceHit && dist2Device <= SNAP_DEV)
                candidates.push({
                    kind: 'device',
                    id: deviceHit.id,
                    x: deviceHit.x,
                    y: deviceHit.y,
                    dist2: dist2Device,
                });
            candidates.sort((a, b) => a.dist2 - b.dist2);
            return candidates[0] ?? null;
        },
        [
            findNearestLightSwitch,
            findNearestFixture,
            findNearestElectricalDevice,
            sceneToCanvas,
        ],
    );

    // Helper local para determinar el punto previo para ortho snap
    const getPrevPointM = useCallback(
        (tool: string, s: DrawState): CanvasPoint | null => {
            if (
                (tool === 'room' || tool === 'corridor' || tool === 'stair') &&
                s.roomVertices.length > 0
            )
                return s.roomVertices[s.roomVertices.length - 1];
            if (isWallTool(tool) && s.wallVertices.length > 0)
                return s.wallVertices[s.wallVertices.length - 1];
            if (tool === 'canopy' && s.isDrawing && s.wallStart)
                return s.wallStart;
            if (tool === 'calibrate' && s.calibrationStart)
                return s.calibrationStart;
            if (tool === 'measure' && s.measurementStart)
                return s.measurementStart;
            if (tool === 'measure-area' && s.measureAreaVertices.length > 0)
                return s.measureAreaVertices[s.measureAreaVertices.length - 1];
            return null;
        },
        [],
    );

    const getReferenceAngles = useCallback(
        (tool: string, s: DrawState, cx: number, cy: number): number[] => {
            const inferred = getGuideAngles(cx, cy);
            const vertices =
                tool === 'room' || tool === 'corridor' || tool === 'stair'
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
            return [...inferred, angle, angle + 90, angle + 180, angle + 270];
        },
        [getGuideAngles],
    );

    /**
     * Confirma un vértice de recinto/muro en un punto ya resuelto (screen px).
     * Extraído de onMouseDown para poder reutilizarlo desde el input dinámico
     * (distancia+ángulo tecleados) sin duplicar el cierre de polígono ni el
     * umbral adaptativo al zoom. Devuelve true si la herramienta activa era
     * room/corridor/stair/wall (el punto fue consumido).
     */
    const commitDrawVertex = useCallback(
        (
            cx: number,
            cy: number,
            setRoomVertices: (v: CanvasPoint[]) => void,
            setWallPreview: (p: CanvasPoint[] | null) => void,
        ): boolean => {
            const s = stateRef.current;

            if (
                activeTool === 'room' ||
                activeTool === 'corridor' ||
                activeTool === 'stair'
            ) {
                if (s.roomVertices.length > 2) {
                    const first = sceneToCanvas(
                        s.roomVertices[0].x,
                        s.roomVertices[0].y,
                    );
                    if (
                        Math.hypot(first.x - cx, first.y - cy) <
                        closeThresholdPx
                    ) {
                        onAddRoom(s.roomVertices);
                        stateRef.current = {
                            ...s,
                            isDrawing: false,
                            roomVertices: [],
                            previewPoint: null,
                        };
                        setRoomVertices([]);
                        return true;
                    }
                }
                s.isDrawing = true;
                const scenePoint = canvasToScene(cx, cy);
                s.roomVertices.push(scenePoint);
                s.previewPoint = scenePoint;
                setRoomVertices([...s.roomVertices]);
                return true;
            }

            if (isWallTool(activeTool)) {
                if (!s.wallVertices) s.wallVertices = [];
                const newPoint = canvasToScene(cx, cy);
                if (s.wallVertices.length > 0) {
                    const first = sceneToCanvas(
                        s.wallVertices[0].x,
                        s.wallVertices[0].y,
                    );
                    const newPointScreen = sceneToCanvas(
                        newPoint.x,
                        newPoint.y,
                    );
                    const dist = Math.hypot(
                        newPointScreen.x - first.x,
                        newPointScreen.y - first.y,
                    );
                    if (dist < closeThresholdPx) {
                        onAddWall([...s.wallVertices, s.wallVertices[0]]);
                        s.wallVertices = [];
                        s.isDrawing = false;
                        setWallPreview(null);
                        return true;
                    }
                }
                s.wallVertices.push(newPoint);
                s.isDrawing = true;
                return true;
            }

            return false;
        },
        [
            activeTool,
            closeThresholdPx,
            sceneToCanvas,
            canvasToScene,
            onAddRoom,
            onAddWall,
        ],
    );

    /**
     * Último punto confirmado del trazo en curso (metros de escena), para el
     * input dinámico (distancia+ángulo). null si no hay trazo activo para la
     * herramienta actual.
     */
    const getDraftPrevPoint = useCallback(
        (): CanvasPoint | null => getPrevPointM(activeTool, stateRef.current),
        [activeTool],
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
            const rect = (
                e.currentTarget as SVGSVGElement
            ).getBoundingClientRect();
            if (isNaN(rect.left) || isNaN(rect.top)) return;
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;

            const s = stateRef.current;
            const activeVerticesCanvas = (
                activeTool === 'room' ||
                activeTool === 'corridor' ||
                activeTool === 'stair'
                    ? s.roomVertices
                    : isWallTool(activeTool)
                      ? s.wallVertices
                      : []
            ).map((v) => sceneToCanvas(v.x, v.y));

            const prevPointM = getPrevPointM(activeTool, s);
            const noSnapTools = [
                'switch',
                'wire',
                'fixture',
                'fixture-grid',
                'select',
                'pan',
            ];
            const shouldSnap = !noSnapTools.includes(activeTool);

            const cadOsnapPoint = shouldSnap
                ? resolveCadOsnap?.(canvasToScene(rawX, rawY), prevPointM)
                : null;
            let cx = rawX;
            let cy = rawY;

            if (shouldSnap) {
                const snapped = cadOsnapPoint
                    ? sceneToCanvas(cadOsnapPoint.x, cadOsnapPoint.y)
                    : resolveSnap(
                          rawX,
                          rawY,
                          activeVerticesCanvas,
                          disableDxfSnap,
                      );
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
                    { x: rawX, y: rawY },
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
                    const first = sceneToCanvas(
                        s.measureAreaVertices[0].x,
                        s.measureAreaVertices[0].y,
                    );
                    if (
                        Math.hypot(first.x - cx, first.y - cy) <
                        closeThresholdPx
                    ) {
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

            if (activeTool === 'measure') {
                const scenePoint = canvasToScene(cx, cy);
                if (!s.measurementStart) {
                    s.measurementStart = scenePoint;
                    onMeasureDistanceChange(
                        { start: scenePoint, end: scenePoint },
                        false,
                    );
                    return;
                }

                onMeasureDistanceChange(
                    { start: s.measurementStart, end: scenePoint },
                    true,
                );
                s.measurementStart = null;
                return;
            }

            if (activeTool === 'calibrate') {
                if (!s.calibrationStart) {
                    // Primer clic: guardar en ESCENA
                    const scenePoint = canvasToScene(cx, cy);
                    s.calibrationStart = scenePoint;
                    setCalibrationPreview({
                        start: scenePoint,
                        end: scenePoint,
                    });
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
                    setCalibrationPreview({
                        start: s.calibrationStart,
                        end: endScene,
                    });
                    setCalibrationSnapPoint(endScene);
                    // Pasamos coordenadas de escena (metros) al canvas para recuperar
                    // la distancia CAD nativa pura dividiendo por effectiveScale.
                    onCalibrationMeasure(
                        sceneDistanceM,
                        s.calibrationStart, // metros
                        endScene, // metros
                    );
                } else {
                    setCalibrationPreview(null);
                    setCalibrationSnapPoint(null);
                }
                s.calibrationStart = null;
                s.isDrawing = false;
                return;
            }

            if (commitDrawVertex(cx, cy, setRoomVertices, setWallPreview)) {
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

            // ── Herramientas de dispositivos eléctricos ──────────────────────
            if (activeTool.startsWith('elec-')) {
                const hit = findNearestWall(cx, cy);
                const scenePoint = canvasToScene(cx, cy);
                if (hit) {
                    const wallPos = resolveOffsetOnWall(hit.wall, hit.offset);
                    if (wallPos) {
                        onAddElectricalDevice?.(
                            wallPos.x,
                            wallPos.y,
                            hit.wall.id,
                        );
                    } else {
                        onAddElectricalDevice?.(scenePoint.x, scenePoint.y);
                    }
                } else {
                    onAddElectricalDevice?.(scenePoint.x, scenePoint.y);
                }
                return;
            }

            if (activeTool === 'wire') {
                const scPt = canvasToScene(cx, cy);
                const winner = pickWireNodeCandidate(cx, cy);

                if (winner) {
                    const start = s.wireStartNode;

                    if (start && start.id !== winner.id) {
                        onConnectWire?.(
                            start.id,
                            winner.id,
                            s.wireWaypoints.length
                                ? s.wireWaypoints
                                : undefined,
                        );
                    }
                    s.wireStartNode = { type: winner.kind, id: winner.id };
                    s.wireWaypoints = [];
                    return;
                }

                // Clic en vacío mientras se traza un cable: acumular el punto como
                // waypoint intermedio; se aplicará al conductor al conectar con el
                // siguiente nodo (fixture, switch o dispositivo).
                if (s.wireStartNode) {
                    s.wireWaypoints = [...s.wireWaypoints, scPt];
                    return;
                }

                // Clic en vacío sin nada → cancelar
                s.wireStartNode = null;
                s.wireWaypoints = [];
                return;
            }

            if (activeTool === 'canopy') {
                s.wallStart = getCanopyDraftStart(
                    { x: cx, y: cy },
                    canvasToScene,
                );
                s.isDrawing = true;
                return;
            }

            if (activeTool === 'pan') {
                stateRef.current = {
                    ...s,
                    isDrawing: true,
                    startX: cx,
                    startY: cy,
                };
                return;
            }

            if (activeTool === 'select') {
                // Si ya hay un cable seleccionado, un clic cerca de uno de sus
                // extremos agarra ese handle para reconectarlo a otro nodo en
                // vez de reseleccionar/arrastrar el objeto completo.
                if (opts.selectedId) {
                    const selectedConductor = conductors.find(
                        (c) => c.id === opts.selectedId,
                    );
                    if (selectedConductor) {
                        const nodeCtx = {
                            fixtures,
                            lightSwitches,
                            electricalDevices,
                        };
                        const srcPos = resolveWireNodePosition(
                            selectedConductor.sourceId,
                            nodeCtx,
                        );
                        const tgtPos = resolveWireNodePosition(
                            selectedConductor.targetId,
                            nodeCtx,
                        );
                        const HANDLE_TOL2 = 12 * 12;
                        const srcCanvas = srcPos
                            ? sceneToCanvas(srcPos.x, srcPos.y)
                            : null;
                        const tgtCanvas = tgtPos
                            ? sceneToCanvas(tgtPos.x, tgtPos.y)
                            : null;
                        const dSrc2 = srcCanvas
                            ? (srcCanvas.x - cx) ** 2 + (srcCanvas.y - cy) ** 2
                            : Infinity;
                        const dTgt2 = tgtCanvas
                            ? (tgtCanvas.x - cx) ** 2 + (tgtCanvas.y - cy) ** 2
                            : Infinity;
                        if (dSrc2 <= HANDLE_TOL2 || dTgt2 <= HANDLE_TOL2) {
                            s.isDragging = true;
                            s.dragObjectId = selectedConductor.id;
                            s.dragObjectType = 'conductor-endpoint';
                            s.dragConductorEndpoint =
                                dSrc2 <= dTgt2 ? 'source' : 'target';
                            onDragGesture?.('start');
                            return;
                        }
                    }
                }

                // Hit-testing determinista: se evalúan TODOS los candidatos bajo
                // el puntero y gana el mejor rankeado (objeto pequeño antes que
                // su contenedor). Alt+clic recorre cíclicamente los superpuestos.
                const scenePt = canvasToScene(cx, cy);
                const ranked = hitTestAtPoint(
                    {
                        fixtures,
                        lightSwitches,
                        electricalDevices,
                        windows,
                        doors,
                        conductors,
                        canopies,
                        walls,
                        partitions,
                        rooms,
                    },
                    { x: cx, y: cy },
                    scenePt,
                    (sx, sy) => sceneToCanvas(sx, sy),
                    { isSelectable: (id) => isObjectSelectable?.(id) ?? true },
                );

                const winner = e.altKey
                    ? cycleCandidate(ranked, opts.selectedId)
                    : (ranked[0] ?? null);

                if (!winner) {
                    onSelectObject(null);
                    return;
                }

                if (winner.kind === 'fixture') {
                    onSelectObject(winner.id, e.ctrlKey);
                } else {
                    onSelectObject(winner.id);
                }

                // Solo los tipos con movimiento soportado inician un arrastre;
                // muros, tabiques y cables se seleccionan sin arrastrarse.
                const DRAGGABLE: Partial<
                    Record<typeof winner.kind, DrawState['dragObjectType']>
                > = {
                    fixture: 'fixture',
                    switch: 'switch',
                    'electrical-device': 'electrical-device',
                    room: 'room',
                    canopy: 'canopy',
                    window: 'window',
                    door: 'door',
                };
                const dragType = DRAGGABLE[winner.kind] ?? null;
                if (dragType) {
                    s.isDragging = true;
                    s.dragStartScene = scenePt;
                    s.dragObjectId = winner.id;
                    s.dragObjectType = dragType;
                    onDragGesture?.('start');
                }
            }
        },
        [
            activeTool,
            angleSnapMode,
            canvasToScene,
            sceneToCanvas,
            resolveCadOsnap,
            resolveSnap,
            getReferenceAngles,
            applyAngleSnap,
            getPrevPointM,
            findNearestWall,
            findNearestFixture,
            findNearestRoom,
            findNearestLightSwitch,
            findNearestElectricalDevice,
            pickWireNodeCandidate,
            onAddFixture,
            onCalibrationMeasure,
            onMeasureDistanceChange,
            onMeasureAreaFinish,
            onAddRoom,
            onAddWall,
            onAddWindow,
            onAddDoor,
            onSelectObject,
            onAddLightSwitch,
            onAddElectricalDevice,
            onConnectWire,
            onDragGesture,
            fixtures,
            lightSwitches,
            electricalDevices,
            windows,
            doors,
            conductors,
            canopies,
            walls,
            partitions,
            rooms,
            opts.selectedId,
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
            setTempElectricalDevice: (
                p: {
                    x: number;
                    y: number;
                    type: ElectricalDeviceType;
                    label: string;
                } | null,
            ) => void,
            setWireReconnectPreview?: (
                p: {
                    conductorId: string;
                    endpoint: 'source' | 'target';
                    point: CanvasPoint;
                } | null,
            ) => void,
        ) => {
            const s = stateRef.current;
            const rect = (
                e.currentTarget as SVGSVGElement
            ).getBoundingClientRect();
            if (isNaN(rect.left) || isNaN(rect.top)) return;
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;

            if (
                s.isDragging &&
                s.dragObjectType === 'conductor-endpoint' &&
                s.dragObjectId &&
                s.dragConductorEndpoint
            ) {
                setWireReconnectPreview?.({
                    conductorId: s.dragObjectId,
                    endpoint: s.dragConductorEndpoint,
                    point: canvasToScene(rawX, rawY),
                });
                return;
            }

            const activeVerticesCanvas = (
                activeTool === 'room' ||
                activeTool === 'corridor' ||
                activeTool === 'stair'
                    ? s.roomVertices
                    : isWallTool(activeTool)
                      ? s.wallVertices
                      : []
            ).map((v) => sceneToCanvas(v.x, v.y));

            const prevPointM = getPrevPointM(activeTool, s);
            const noSnapTools = [
                'switch',
                'wire',
                'fixture',
                'fixture-grid',
                'select',
                'pan',
            ];
            const shouldSnap = !noSnapTools.includes(activeTool);

            const cadOsnapPoint = shouldSnap
                ? resolveCadOsnap?.(canvasToScene(rawX, rawY), prevPointM)
                : null;
            let cx = rawX;
            let cy = rawY;

            if (shouldSnap) {
                const snapped = cadOsnapPoint
                    ? sceneToCanvas(cadOsnapPoint.x, cadOsnapPoint.y)
                    : resolveSnap(
                          rawX,
                          rawY,
                          activeVerticesCanvas,
                          disableDxfSnap,
                      );
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
                    { x: rawX, y: rawY },
                );
                cx = finalPointCanvas.x;
                cy = finalPointCanvas.y;
            }

            if (
                (activeTool === 'room' ||
                    activeTool === 'corridor' ||
                    activeTool === 'stair') &&
                s.roomVertices.length > 0
            ) {
                s.previewPoint = canvasToScene(cx, cy);
                setPreviewPoint(s.previewPoint);
                return;
            }

            if (
                activeTool === 'measure-area' &&
                s.measureAreaVertices.length > 0
            ) {
                setPreviewPoint(canvasToScene(cx, cy));
                return;
            }

            if (activeTool === 'measure' && s.measurementStart) {
                onMeasureDistanceChange(
                    { start: s.measurementStart, end: canvasToScene(cx, cy) },
                    false,
                );
                return;
            }

            if (activeTool === 'calibrate') {
                setCalibrationSnapPoint(canvasToScene(cx, cy));
            }

            if (activeTool.startsWith('elec-') && electricalDeviceTemplate) {
                const hit = findNearestWall(cx, cy);
                let finalX = canvasToScene(cx, cy).x;
                let finalY = canvasToScene(cx, cy).y;
                if (hit) {
                    const wallPos = resolveOffsetOnWall(hit.wall, hit.offset);
                    if (wallPos) {
                        finalX = wallPos.x;
                        finalY = wallPos.y;
                    }
                }
                setTempElectricalDevice({
                    x: finalX,
                    y: finalY,
                    type: electricalDeviceTemplate.type,
                    label: electricalDeviceTemplate.label ?? '?',
                });
            } else {
                setTempElectricalDevice(null);
            }

            if (
                isWallTool(activeTool) &&
                s.wallVertices &&
                s.wallVertices.length > 0
            ) {
                setWallPreview([...s.wallVertices, canvasToScene(cx, cy)]);
                return;
            }

            if (activeTool === 'canopy' && s.isDrawing && s.wallStart) {
                setCanopyPreview({
                    start: s.wallStart,
                    end: canvasToScene(cx, cy),
                });
                return;
            }

            if (activeTool === 'calibrate' && s.calibrationStart) {
                setCalibrationPreview({
                    start: s.calibrationStart,
                    end: canvasToScene(cx, cy),
                });
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
                        const fixture = fixtures.find(
                            (f) => f.id === s.dragObjectId,
                        );
                        if (fixture)
                            onMoveFixture(
                                s.dragObjectId,
                                fixture.x + dxM,
                                fixture.y + dyM,
                            );
                    }
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'room') {
                    const room = rooms.find((r) => r.id === s.dragObjectId);
                    if (room) onMoveRoom(s.dragObjectId, dxM, dyM);
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'canopy') {
                    const canopy = canopies.find(
                        (c) => c.id === s.dragObjectId,
                    );
                    if (canopy) {
                        onMoveCanopy(
                            s.dragObjectId,
                            canopy.x1 + dxM,
                            canopy.y1 + dyM,
                            canopy.x2 + dxM,
                            canopy.y2 + dyM,
                        );
                    }
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'electrical-device') {
                    const dev = electricalDevices.find(
                        (d) => d.id === s.dragObjectId,
                    );
                    if (dev) {
                        const newX = dev.x + dxM;
                        const newY = dev.y + dyM;
                        // Intentar anclar a la pared más cercana
                        const hit = findNearestWall(cx, cy);
                        if (hit) {
                            const wallPos = resolveOffsetOnWall(
                                hit.wall,
                                hit.offset,
                            );
                            if (wallPos) {
                                onMoveElectricalDevice?.(
                                    s.dragObjectId,
                                    wallPos.x,
                                    wallPos.y,
                                    hit.wall.id,
                                );
                            } else {
                                onMoveElectricalDevice?.(
                                    s.dragObjectId,
                                    newX,
                                    newY,
                                    hit.wall.id,
                                );
                            }
                        } else {
                            onMoveElectricalDevice?.(
                                s.dragObjectId,
                                newX,
                                newY,
                                undefined,
                            );
                        }
                    }
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'switch') {
                    const lSwitch = lightSwitches.find(
                        (sw) => sw.id === s.dragObjectId,
                    );
                    if (lSwitch) {
                        // Movemos el switch. Si intentan anclarlo a otra pared, buscaremos la más cercana a currentScene
                        const newX = lSwitch.x + dxM;
                        const newY = lSwitch.y + dyM;
                        // Intentar anclar a la pared más cercana
                        const hit = findNearestWall(cx, cy);
                        if (hit) {
                            const wallPos = resolveOffsetOnWall(
                                hit.wall,
                                hit.offset,
                            );
                            if (wallPos) {
                                onMoveLightSwitch(
                                    s.dragObjectId,
                                    wallPos.x,
                                    wallPos.y,
                                    hit.wall.id,
                                );
                            } else {
                                onMoveLightSwitch(
                                    s.dragObjectId,
                                    newX,
                                    newY,
                                    hit.wall.id,
                                );
                            }
                        } else {
                            onMoveLightSwitch(
                                s.dragObjectId,
                                newX,
                                newY,
                                undefined,
                            ); // sin pared
                        }
                    }
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'window') {
                    const win = windows.find((w) => w.id === s.dragObjectId);
                    const wall = win
                        ? walls.find((w) => w.id === win.wallId)
                        : null;
                    if (win && wall) {
                        const wallLen = wallLength(wall.vertices);
                        let newOffset = projectPointToWallOffset(
                            currentScene,
                            wall,
                        );
                        newOffset = Math.max(
                            0.1,
                            Math.min(wallLen - 0.1, newOffset),
                        );
                        onMoveWindow(s.dragObjectId, win.wallId, newOffset);
                    }
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'door') {
                    const door = doors.find((d) => d.id === s.dragObjectId);
                    const wall = door
                        ? walls.find((w) => w.id === door.wallId)
                        : null;
                    if (door && wall) {
                        const wallLen = wallLength(wall.vertices);
                        const projection = projectPointToWallProjection(
                            currentScene,
                            wall,
                        );
                        const newOffset = projection
                            ? clampOpeningOffsetToWallSegment(
                                  projection,
                                  door.width,
                                  wallLen,
                                  'center',
                              )
                            : Math.max(
                                  0,
                                  Math.min(
                                      wallLen - door.width,
                                      door.offsetAlongWall,
                                  ),
                              );
                        onMoveDoor(s.dragObjectId, door.wallId, newOffset);
                    }
                    s.dragStartScene = currentScene;
                }
            }
        },
        [
            activeTool,
            angleSnapMode,
            sceneToCanvas,
            resolveCadOsnap,
            resolveSnap,
            getReferenceAngles,
            applyAngleSnap,
            getPrevPointM,
            canvasToScene,
            onMeasureDistanceChange,
            onPanChange,
            fixtures,
            rooms,
            canopies,
            windows,
            doors,
            walls,
            lightSwitches,
            electricalDevices,
            onMoveFixture,
            onMoveFixtures,
            onMoveRoom,
            onMoveCanopy,
            onMoveWindow,
            onMoveDoor,
            onMoveLightSwitch,
            onMoveElectricalDevice,
            findNearestWall,
            selectedFixtureIds,
            conductors,
            partitions,
            isObjectSelectable,
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
            setWireReconnectPreview?: (
                p: {
                    conductorId: string;
                    endpoint: 'source' | 'target';
                    point: CanvasPoint;
                } | null,
            ) => void,
        ) => {
            const s = stateRef.current;

            if (
                s.isDragging &&
                s.dragObjectType === 'conductor-endpoint' &&
                s.dragObjectId &&
                s.dragConductorEndpoint
            ) {
                const rect = (
                    e.currentTarget as SVGSVGElement
                ).getBoundingClientRect();
                if (!isNaN(rect.left) && !isNaN(rect.top)) {
                    const cx = e.clientX - rect.left;
                    const cy = e.clientY - rect.top;
                    const target = pickWireNodeCandidate(cx, cy);
                    if (target) {
                        onReconnectWireEndpoint?.(
                            s.dragObjectId,
                            s.dragConductorEndpoint,
                            target.id,
                        );
                    }
                }
                setWireReconnectPreview?.(null);
                s.isDragging = false;
                s.dragStartScene = null;
                s.dragObjectId = null;
                s.dragObjectType = null;
                s.dragConductorEndpoint = null;
                onDragGesture?.('end');
                return;
            }

            if (activeTool === 'canopy' && s.isDrawing && s.wallStart) {
                const rect = (
                    e.currentTarget as SVGSVGElement
                ).getBoundingClientRect();
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
                s.dragConductorEndpoint = null;
                onDragGesture?.('end');
            }
        },
        [
            activeTool,
            canvasToScene,
            resolveSnap,
            onAddCanopy,
            onDragGesture,
            pickWireNodeCandidate,
            onReconnectWireEndpoint,
        ],
    );

    const handleDoubleClick = useCallback(() => {
        const s = stateRef.current;
        if (
            isWallTool(activeTool) &&
            s.wallVertices &&
            s.wallVertices.length >= 2
        ) {
            onAddWall(s.wallVertices);
            s.wallVertices = [];
            s.isDrawing = false;
            onDoubleClick();
            return;
        }
        if (
            activeTool === 'measure-area' &&
            s.measureAreaVertices.length >= 3
        ) {
            onMeasureAreaFinish([...s.measureAreaVertices]);
            stateRef.current.measureAreaVertices = [];
            onDoubleClick();
        }
    }, [activeTool, onAddWall, onMeasureAreaFinish, onDoubleClick]);

    /**
     * Quita el último vértice colocado de la figura que se está dibujando
     * (recinto/pasadizo/escalera, muro o medición de área), sin cancelar el
     * trazo completo. Pensado para atarse a Ctrl+Z mientras hay un dibujo en
     * curso: antes, un clic de más en un polígono grande obligaba a cancelar
     * todo y volver a empezar. Devuelve `true` si quitó algo (para que el
     * caller sepa que no debe además disparar el undo/redo global).
     */
    const undoLastDraftVertex = useCallback(
        (
            setRoomVertices: (v: CanvasPoint[]) => void,
            setWallPreview: (p: CanvasPoint[] | null) => void,
            setMeasureAreaVertices: (v: CanvasPoint[]) => void,
        ): boolean => {
            const s = stateRef.current;

            if (
                (activeTool === 'room' ||
                    activeTool === 'corridor' ||
                    activeTool === 'stair') &&
                s.roomVertices.length > 0
            ) {
                s.roomVertices = s.roomVertices.slice(0, -1);
                s.previewPoint =
                    s.roomVertices[s.roomVertices.length - 1] ?? null;
                s.isDrawing = s.roomVertices.length > 0;
                setRoomVertices([...s.roomVertices]);
                return true;
            }

            if (isWallTool(activeTool) && (s.wallVertices?.length ?? 0) > 0) {
                s.wallVertices = s.wallVertices.slice(0, -1);
                s.isDrawing = s.wallVertices.length > 0;
                setWallPreview(
                    s.wallVertices.length > 0 ? [...s.wallVertices] : null,
                );
                return true;
            }

            if (
                activeTool === 'measure-area' &&
                s.measureAreaVertices.length > 0
            ) {
                s.measureAreaVertices = s.measureAreaVertices.slice(0, -1);
                setMeasureAreaVertices([...s.measureAreaVertices]);
                return true;
            }

            return false;
        },
        [activeTool],
    );

    return {
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onDoubleClick: handleDoubleClick,
        isDragging: () => stateRef.current.isDragging,
        undoLastDraftVertex,
        commitDrawVertex,
        getDraftPrevPoint,
    };
}
