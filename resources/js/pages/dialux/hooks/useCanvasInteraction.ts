import { useRef, useCallback, useEffect } from 'react';
import {
    cycleCandidate,
    hitTestAtPoint,
} from '@/pages/dialux/selection/hitTest';
import {
    acceptsWireNode,
    type WireFamily,
} from '@/pages/dialux/selection/wireNodeFamily';
import { getCanopyDraftStart } from './cadInteraction';
import { resolveWireNodePosition } from './wireNodePosition';
import { defaultWireCurveMidpoint } from './wireCurveGeometry';
import {
    insertPolygonEdgeMidpoint,
    movePolygonVertex,
} from '@/pages/dialux/geometry/editablePolyline';
import { resolveVertexAlignmentSnap } from '@/pages/dialux/geometry/vertexAlignmentSnap';
import {
    drawPerfEnabled,
    markRect,
    markSnap,
} from '@/pages/dialux/lib/drawPerfProbe';
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
    StructuralObstacle,
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

/**
 * Ronda 30: guía de alineación visible mientras se arrastra un vértice de
 * Room/Wall — `x`/`y` en metros de escena (no píxeles), cada uno `null`
 * cuando ese eje no encontró ningún otro vértice de la misma forma cerca.
 */
export interface AlignmentGuide {
    x: number | null;
    y: number | null;
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
    /** Cierra el trazo de un StructuralObstacle (columna/viga/zona restringida) -- mismo mecanismo de dibujo que room/corridor/stair */
    onAddStructuralObstacle?: (verticesM: CanvasPoint[]) => void;
    onAddWall: (vertices: CanvasPoint[]) => void;
    /** Ronda 28: intenta auto-detectar un contorno cerrado del plano DXF bajo `seedPoint` (metros de escena) y crear el recinto/pasadizo/escalera ahí mismo. Devuelve `true` si lo logró (el clic queda consumido, sin arrancar un trazo manual). */
    onAutoDetectRoom?: (seedPoint: CanvasPoint) => boolean;
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
    /**
     * Modo del area de proyeccion de la herramienta 'fixture-grid':
     *   'room' -> clic simple = usar el ambiente completo bajo el cursor (clasico).
     *   'draw' -> dibujar un poligono libre vertice a vertice (como Room), cierra
     *             cerca del primer vertice. NO crea nada al cerrar -- dispara
     *             `onCloseFixtureGridArea` para pedir la cantidad antes de generar.
     */
    fixtureGridAreaMode?: 'room' | 'draw';
    /**
     * Poligono de proyeccion cerrado (metros de escena). No dibuja ni persiste
     * nada por si mismo -- el llamador decide la cantidad y recien ahi crea
     * las luminarias reales.
     */
    onCloseFixtureGridArea?: (verticesM: CanvasPoint[]) => void;
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
    onUpdateRoomVertices?: (id: string, vertices: CanvasPoint[]) => void;
    /** Ronda 26: mismo mecanismo que `onUpdateRoomVertices`, para reformar muros (arrastrar vértices / insertar en el punto medio de un tramo) — así un ambiente delimitado por muros puede pasar de rectángulo a L/U sin depurar coordenadas a mano. */
    onUpdateWallVertices?: (id: string, vertices: CanvasPoint[]) => void;
    /** Ronda 27: trazo de 'partition' (comparte mecánica con 'wall', ver `isWallTool`) — entrega la polilínea terminada, igual que `onAddWall`. */
    onAddPartition?: (vertices: CanvasPoint[]) => void;
    /** Ronda 32: mismo mecanismo que `onUpdateWallVertices` (Ronda 26), para reformar un tabique/separador ya dibujado — antes solo se podía borrar y volver a trazar. */
    onUpdatePartitionVertices?: (id: string, vertices: CanvasPoint[]) => void;
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
        routeType?: Conductor['routeType'],
    ) => void;
    /** Reconecta un extremo de un cable ya existente a otro nodo (arrastrar handle) */
    onReconnectWireEndpoint?: (
        conductorId: string,
        endpoint: 'source' | 'target',
        newNodeId: string,
    ) => void;
    onMoveWireCurve?: (conductorId: string, midpoint: CanvasPoint) => void;
    onAddElectricalDevice?: (x: number, y: number, wallId?: string) => void;
    electricalDevices?: ElectricalDevice[];
    /** Cables y tabiques: solo participan del hit-testing de selección */
    conductors?: Conductor[];
    partitions?: Partition[];
    /** Columnas/vigas: hit-testing de selección + trazo con la herramienta 'structural-obstacle' */
    structuralObstacles?: StructuralObstacle[];
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
    wireFamily: WireFamily | null;
    wireRouteType: Conductor['routeType'];
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
        | 'conductor-curve'
        | 'room-vertex'
        | 'wall-vertex'
        | 'partition-vertex'
        | null;
    /** Extremo del conductor que se está arrastrando (solo cuando dragObjectType === 'conductor-endpoint') */
    dragConductorEndpoint: 'source' | 'target' | null;
    dragVertexIndex: number | null;
    dragRoomVertices: CanvasPoint[] | null;
    /**
     * Ronda 26: algunos muros guardan un anillo CERRADO con el primer y
     * último vértice literalmente duplicados (trazado de contorno completo
     * con jambas — ver `occlusionBoxes.ts`), a diferencia del muro simple de
     * 2+ puntos que traza la herramienta "wall". Si se arrastra ese
     * extremo, hay que mover AMBAS copias juntas o el anillo queda con una
     * grieta de 1 punto. `true` solo cuando el vértice arrastrado (índice 0
     * o el último) tenía su par duplicado exacto al iniciar el arrastre.
     */
    dragWallRingJoin: boolean;
}

/**
 * Herramientas que comparten el mismo trazo de polilínea abierta (clic a
 * clic, cierre automático si se vuelve cerca del primer punto, doble-clic
 * para terminar) y por lo tanto el mismo estado de arrastre (`s.wallVertices`
 * etc.). Ronda 27 (2026-08-20): `'partition'` (tabique/separador de SS.HH —
 * melamina, drywall, vidrio, ladrillo, PRFV) se agregó aquí en vez de
 * duplicar todo el mecanismo de trazo, porque geométricamente es idéntico a
 * un muro (polilínea + grosor + altura) — solo cambia a qué callback
 * (`onAddWall` vs `onAddPartition`) se entrega el resultado al confirmar.
 */
function isWallTool(tool: string): boolean {
    return tool === 'wall' || tool === 'education-wall' || tool === 'partition';
}

/** Ronda 26: `true` cuando `vertices[index]` es un extremo (0 o el último) Y coincide exactamente con el otro extremo — ver doc de `dragWallRingJoin`. */
function isWallRingJoinVertex(vertices: CanvasPoint[], index: number): boolean {
    if (vertices.length < 2) return false;
    const last = vertices.length - 1;
    if (index !== 0 && index !== last) return false;
    return vertices[0]!.x === vertices[last]!.x && vertices[0]!.y === vertices[last]!.y;
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
        onAddStructuralObstacle,
        onAddWall,
        onAddPartition,
        onAutoDetectRoom,
        onAddWindow,
        onAddDoor,
        onAddCanopy,
        onAddFixture,
        onAddFixtureGrid,
        fixtureGridAreaMode = 'room',
        onCloseFixtureGridArea,
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
        onUpdateRoomVertices,
        onUpdateWallVertices,
        onUpdatePartitionVertices,
        onMoveCanopy,
        onMoveWindow,
        onMoveDoor,
        onMoveLightSwitch,
        onMoveElectricalDevice,
        onConnectWire,
        onReconnectWireEndpoint,
        onMoveWireCurve,
        onAddElectricalDevice,
        electricalDevices = [],
        conductors = [],
        partitions = [],
        structuralObstacles = [],
        onDragGesture,
        isObjectSelectable,
    } = opts;

    /**
     * Umbral de cierre de polígono adaptativo al zoom.
     * A zoom 1x → 26px. A zoom 2x → 13px. A zoom 4x → 12px (mínimo).
     * Radio generoso para que cerrar un recinto/área de proyección sobre el
     * primer vértice no exija pulso fino (también se puede cerrar con doble
     * clic o Enter, ver `finishDrawPolygon`). El cierre de recinto está
     * protegido por `roomVertices.length > 2`, así que este radio grande solo
     * actúa a partir del 4º clic.
     */
    const closeThresholdPx = Math.max(12, 26 / zoom);

    /**
     * Umbral de cierre para MUROS/tabiques (polilínea): más chico que el de
     * recinto. El bloque de muro solo exige 1 vértice previo para cerrar, así
     * que un radio grande hacía que un muro corto se descartara como bucle
     * degenerado `[v1, v1]` al colocar el 2º punto cerca del 1º. Se mantiene
     * el valor histórico.
     */
    const wallCloseThresholdPx = Math.max(8, 20 / zoom);

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
        wireFamily: null,
        wireRouteType: 'wall_ceiling',
        wireWaypoints: [],
        isDragging: false,
        dragStartScene: null,
        dragObjectId: null,
        dragObjectType: null,
        dragConductorEndpoint: null,
        dragVertexIndex: null,
        dragRoomVertices: null,
        dragWallRingJoin: false,
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
        if (activeTool !== 'wire') {
            stateRef.current.wireStartNode = null;
            stateRef.current.wireWaypoints = [];
            stateRef.current.wireFamily = null;
        }
        // Trazo de room/corridor/stair (polígono) inconcluso al cambiar de
        // herramienta: sin esto, el usuario que se confunde y cambia de
        // herramienta a mitad de un trazo se queda con vértices "fantasma"
        // en el estado interno — el próximo trazo con esa misma herramienta
        // arrastra esos vértices viejos, y el dibujo abandonado seguía
        // visible en el canvas hasta recargar.
        if (
            activeTool !== 'room' &&
            activeTool !== 'corridor' &&
            activeTool !== 'stair' &&
            activeTool !== 'structural-obstacle' && activeTool !== 'ramp' &&
            activeTool !== 'fixture-grid'
        ) {
            stateRef.current.roomVertices = [];
            stateRef.current.previewPoint = null;
        }
        if (!isWallTool(activeTool)) {
            stateRef.current.wallVertices = [];
        }
        if (activeTool !== 'canopy') {
            stateRef.current.wallStart = null;
        }
        if (
            activeTool !== 'room' &&
            activeTool !== 'corridor' &&
            activeTool !== 'stair' &&
            activeTool !== 'structural-obstacle' && activeTool !== 'ramp' &&
            activeTool !== 'fixture-grid' &&
            !isWallTool(activeTool) &&
            activeTool !== 'canopy'
        ) {
            stateRef.current.isDrawing = false;
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
        (
            cx: number,
            cy: number,
            family: DrawState['wireFamily'] = null,
        ): WireNodeCandidate | null => {
            // Reutilizar el mismo hit-test que la herramienta de selección hace
            // que el área cableable siga el tamaño visible del símbolo al hacer
            // zoom. Antes, una segunda validación fija de 15–18 px descartaba el
            // nodo que los helpers ya habían reconocido correctamente.
            const winner = hitTestAtPoint(
                { fixtures, lightSwitches, electricalDevices },
                { x: cx, y: cy },
                canvasToScene(cx, cy),
                sceneToCanvas,
            ).find((candidate) =>
                acceptsWireNode(
                    family,
                    candidate.kind,
                    candidate.kind === 'electrical-device'
                        ? electricalDevices.find(
                              (device) => device.id === candidate.id,
                          )?.type
                        : undefined,
                ),
            );

            if (!winner) return null;

            if (winner.kind === 'fixture') {
                const fixture = fixtures.find((item) => item.id === winner.id);
                return fixture
                    ? {
                          kind: 'fixture',
                          id: fixture.id,
                          x: fixture.x,
                          y: fixture.y,
                      }
                    : null;
            }

            if (winner.kind === 'switch') {
                const lightSwitch = lightSwitches.find(
                    (item) => item.id === winner.id,
                );
                return lightSwitch
                    ? {
                          kind: 'switch',
                          id: lightSwitch.id,
                          x: lightSwitch.x,
                          y: lightSwitch.y,
                      }
                    : null;
            }

            const device = electricalDevices.find(
                (item) => item.id === winner.id,
            );
            return device
                ? { kind: 'device', id: device.id, x: device.x, y: device.y }
                : null;
        },
        [
            canvasToScene,
            electricalDevices,
            fixtures,
            lightSwitches,
            sceneToCanvas,
        ],
    );

    // Helper local para determinar el punto previo para ortho snap
    const getPrevPointM = useCallback(
        (tool: string, s: DrawState): CanvasPoint | null => {
            if (
                (tool === 'room' ||
                    tool === 'corridor' ||
                    tool === 'stair' ||
                    tool === 'structural-obstacle' || tool === 'ramp' ||
                    tool === 'fixture-grid') &&
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
                tool === 'room' ||
                tool === 'corridor' ||
                tool === 'stair' ||
                tool === 'structural-obstacle' || tool === 'ramp' ||
                tool === 'fixture-grid'
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
    /** True para las herramientas que dibujan un polígono cerrado vértice a vértice. */
    const isPolygonDrawTool = useCallback(
        (): boolean =>
            activeTool === 'room' ||
            activeTool === 'corridor' ||
            activeTool === 'stair' ||
            activeTool === 'structural-obstacle' || activeTool === 'ramp' ||
            (activeTool === 'fixture-grid' && fixtureGridAreaMode === 'draw'),
        [activeTool, fixtureGridAreaMode],
    );

    /** Dispara la acción de cierre correcta según la herramienta de polígono activa. */
    const emitPolygonClose = useCallback(
        (vertices: CanvasPoint[]) => {
            if (activeTool === 'structural-obstacle' || activeTool === 'ramp') {
                onAddStructuralObstacle?.(vertices);
            } else if (activeTool === 'fixture-grid') {
                onCloseFixtureGridArea?.(vertices);
            } else {
                onAddRoom(vertices);
            }
        },
        [activeTool, onAddStructuralObstacle, onCloseFixtureGridArea, onAddRoom],
    );

    /**
     * Cierra el polígono en curso SIN exigir que el último clic caiga sobre el
     * primer vértice — para atarlo a doble clic / Enter / clic derecho.
     *
     * `fromDoubleClick`: el 2º `mousedown` de un doble clic ya insertó un
     * vértice extra (casi sobre el anterior) ANTES de que llegue este
     * handler; con `true` se descarta ese último vértice incondicionalmente
     * (igual que el camino de clic-sobre-el-primero descarta el clic de
     * cierre). Con Enter no hay vértice espurio, así que es `false`. En ambos
     * casos se hace además una pasada de dedupe por si quedaran vértices
     * finales colineales/duplicados. Devuelve true si cerró algo.
     */
    const finishDrawPolygon = useCallback(
        (
            setRoomVertices: (v: CanvasPoint[]) => void,
            fromDoubleClick = false,
        ): boolean => {
            if (!isPolygonDrawTool()) return false;
            const s = stateRef.current;
            let verts = [...s.roomVertices];
            if (fromDoubleClick && verts.length > 0) {
                verts = verts.slice(0, -1);
            }
            while (
                verts.length >= 2 &&
                Math.hypot(
                    verts[verts.length - 1].x - verts[verts.length - 2].x,
                    verts[verts.length - 1].y - verts[verts.length - 2].y,
                ) < 1e-3
            ) {
                verts = verts.slice(0, -1);
            }
            if (verts.length < 3) return false;
            emitPolygonClose(verts);
            stateRef.current = {
                ...s,
                isDrawing: false,
                roomVertices: [],
                previewPoint: null,
            };
            setRoomVertices([]);
            return true;
        },
        [isPolygonDrawTool, emitPolygonClose],
    );

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
                activeTool === 'stair' ||
                activeTool === 'structural-obstacle' || activeTool === 'ramp' ||
                (activeTool === 'fixture-grid' &&
                    fixtureGridAreaMode === 'draw')
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
                        emitPolygonClose(s.roomVertices);
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

                // Ronda 28/29: la auto-detección corre ANTES, en `onMouseDown`,
                // con el punto crudo del clic (ver ese comentario ahí) — aquí
                // ya no hace falta (y usar `cx,cy` ya-snapeado repetiría el
                // bug de la Ronda 28: casi siempre cae justo sobre la pared).

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
                // Se exigen ≥2 vértices previos antes de permitir el cierre en
                // bucle: con 1 solo, `[...wallVertices, wallVertices[0]]` daba
                // un muro degenerado `[v1, v1]`.
                if (s.wallVertices.length >= 2) {
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
                    if (dist < wallCloseThresholdPx) {
                        const closed = [...s.wallVertices, s.wallVertices[0]];
                        if (activeTool === 'partition') {
                            onAddPartition?.(closed);
                        } else {
                            onAddWall(closed);
                        }
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
            wallCloseThresholdPx,
            sceneToCanvas,
            canvasToScene,
            emitPolygonClose,
            onAddRoom,
            onAddWall,
            onAddPartition,
            onAutoDetectRoom,
            fixtureGridAreaMode,
            onCloseFixtureGridArea,
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
            const eventElement = e.target as SVGElement;
            const curveHandle = eventElement.closest<SVGElement>(
                '[data-wire-curve-id]',
            );
            const curveConductorId = curveHandle?.dataset.wireCurveId;
            if (activeTool === 'select' && curveConductorId) {
                const conductor = conductors.find(
                    (item) => item.id === curveConductorId,
                );
                if (conductor) {
                    onSelectObject(curveConductorId);
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(rawX, rawY);
                    s.dragObjectId = curveConductorId;
                    s.dragObjectType = 'conductor-curve';
                    onDragGesture?.('start');
                    return;
                }
            }

            const vertexHandle = eventElement.closest<SVGElement>(
                '[data-room-vertex-id]',
            );
            const edgeHandle = eventElement.closest<SVGElement>(
                '[data-room-edge-id]',
            );
            const handledRoomId =
                vertexHandle?.dataset.roomVertexId ??
                edgeHandle?.dataset.roomEdgeId;
            if (activeTool === 'select' && handledRoomId) {
                const room = rooms.find((item) => item.id === handledRoomId);
                const rawIndex =
                    vertexHandle?.dataset.roomVertexIndex ??
                    edgeHandle?.dataset.roomEdgeIndex;
                const handleIndex = Number(rawIndex);
                if (room && Number.isInteger(handleIndex)) {
                    let vertices = room.vertices.map((vertex) => ({
                        ...vertex,
                    }));
                    let dragIndex = handleIndex;
                    if (edgeHandle) {
                        const inserted = insertPolygonEdgeMidpoint(
                            vertices,
                            handleIndex,
                        );
                        vertices = inserted.vertices;
                        dragIndex = inserted.insertedIndex;
                        onUpdateRoomVertices?.(room.id, vertices);
                    }
                    onSelectObject(room.id);
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(rawX, rawY);
                    s.dragObjectId = room.id;
                    s.dragObjectType = 'room-vertex';
                    s.dragVertexIndex = dragIndex;
                    s.dragRoomVertices = vertices;
                    onDragGesture?.('start');
                    return;
                }
            }

            const wallVertexHandle = eventElement.closest<SVGElement>(
                '[data-wall-vertex-id]',
            );
            const wallEdgeHandle = eventElement.closest<SVGElement>(
                '[data-wall-edge-id]',
            );
            const handledWallId =
                wallVertexHandle?.dataset.wallVertexId ??
                wallEdgeHandle?.dataset.wallEdgeId;
            if (activeTool === 'select' && handledWallId) {
                const wall = walls.find((item) => item.id === handledWallId);
                const rawIndex =
                    wallVertexHandle?.dataset.wallVertexIndex ??
                    wallEdgeHandle?.dataset.wallEdgeIndex;
                const handleIndex = Number(rawIndex);
                if (wall && Number.isInteger(handleIndex)) {
                    let vertices = wall.vertices.map((vertex) => ({
                        ...vertex,
                    }));
                    let dragIndex = handleIndex;
                    if (wallEdgeHandle) {
                        // Seguro sin envolver: el handle de punto medio solo
                        // se renderiza para `index < length - 1` (ver
                        // `OverlayWalls.tsx`), así que `insertPolygonEdgeMidpoint`
                        // nunca ve el índice final de un muro abierto.
                        const inserted = insertPolygonEdgeMidpoint(
                            vertices,
                            handleIndex,
                        );
                        vertices = inserted.vertices;
                        dragIndex = inserted.insertedIndex;
                        onUpdateWallVertices?.(wall.id, vertices);
                    }
                    onSelectObject(wall.id);
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(rawX, rawY);
                    s.dragObjectId = wall.id;
                    s.dragObjectType = 'wall-vertex';
                    s.dragVertexIndex = dragIndex;
                    s.dragRoomVertices = vertices;
                    s.dragWallRingJoin = isWallRingJoinVertex(vertices, dragIndex);
                    onDragGesture?.('start');
                    return;
                }
            }

            const partitionVertexHandle = eventElement.closest<SVGElement>(
                '[data-partition-vertex-id]',
            );
            const partitionEdgeHandle = eventElement.closest<SVGElement>(
                '[data-partition-edge-id]',
            );
            const handledPartitionId =
                partitionVertexHandle?.dataset.partitionVertexId ??
                partitionEdgeHandle?.dataset.partitionEdgeId;
            if (activeTool === 'select' && handledPartitionId) {
                const partition = partitions.find((item) => item.id === handledPartitionId);
                const rawIndex =
                    partitionVertexHandle?.dataset.partitionVertexIndex ??
                    partitionEdgeHandle?.dataset.partitionEdgeIndex;
                const handleIndex = Number(rawIndex);
                if (partition && Number.isInteger(handleIndex)) {
                    let vertices = partition.vertices.map((vertex) => ({
                        ...vertex,
                    }));
                    let dragIndex = handleIndex;
                    if (partitionEdgeHandle) {
                        // Mismo patrón que un muro abierto (Ronda 26): el
                        // handle de punto medio solo se renderiza para
                        // `index < length - 1`, nunca ve el índice final.
                        const inserted = insertPolygonEdgeMidpoint(
                            vertices,
                            handleIndex,
                        );
                        vertices = inserted.vertices;
                        dragIndex = inserted.insertedIndex;
                        onUpdatePartitionVertices?.(partition.id, vertices);
                    }
                    onSelectObject(partition.id);
                    s.isDragging = true;
                    s.dragStartScene = canvasToScene(rawX, rawY);
                    s.dragObjectId = partition.id;
                    s.dragObjectType = 'partition-vertex';
                    s.dragVertexIndex = dragIndex;
                    s.dragRoomVertices = vertices;
                    onDragGesture?.('start');
                    return;
                }
            }
            const activeVerticesCanvas = (
                activeTool === 'room' ||
                activeTool === 'corridor' ||
                activeTool === 'stair' ||
                activeTool === 'structural-obstacle' || activeTool === 'ramp' ||
                activeTool === 'fixture-grid'
                    ? s.roomVertices
                    : isWallTool(activeTool)
                      ? s.wallVertices
                      : []
            ).map((v) => sceneToCanvas(v.x, v.y));

            // Ronda 29: auto-detección con el punto CRUDO del clic, ANTES de
            // aplicar snap — corrige el bug de la Ronda 28: `commitDrawVertex`
            // recibía `cx,cy` YA ajustado por `resolveSnap`/`applyAngleSnap`
            // (más abajo), así que cualquier clic cerca de una pared o línea
            // DXF —el caso más común: el usuario apunta a una esquina para
            // empezar a trazar con precisión— quedaba enganchado EXACTAMENTE
            // sobre esa línea antes de que la auto-detección lo viera, y el
            // punto de partida (`seedPoint`) caía sobre la barrera en vez de
            // adentro del área → "seed-blocked" en el caso de uso más común,
            // no en el caso raro. Con el punto crudo, el snap nunca interviene.
            if (
                s.roomVertices.length === 0 &&
                (activeTool === 'room' || activeTool === 'corridor' || activeTool === 'stair') &&
                onAutoDetectRoom?.(canvasToScene(rawX, rawY))
            ) {
                return;
            }

            const prevPointM = getPrevPointM(activeTool, s);
            const noSnapTools = ['switch', 'wire', 'fixture', 'select', 'pan'];
            // fixture-grid en modo 'room' es un clic simple sobre el ambiente
            // completo bajo el cursor (el snap de posicion/angulo no aplica).
            // En modo 'draw' es un poligono libre vertice a vertice, igual
            // que room/corridor/stair, y necesita el mismo asistido (antes
            // quedaba excluido siempre, sin importar el modo).
            const isFixtureGridRoomMode =
                activeTool === 'fixture-grid' && fixtureGridAreaMode !== 'draw';
            // Alt mantenido = override temporal que desactiva TODO snap (posición
            // y ángulo), igual que Shift fuerza ortogonal. Es la salida rápida
            // para cuando el asistido "no deja" avanzar hacia donde el usuario
            // realmente apunta — sin necesidad de cambiar de modo angular.
            const shouldSnap =
                !noSnapTools.includes(activeTool) &&
                !isFixtureGridRoomMode &&
                !e.altKey;

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

            if (
                activeTool === 'fixture-grid' &&
                fixtureGridAreaMode === 'room'
            ) {
                // Modo clasico: un clic toma el room bajo el cursor y proyecta
                // sobre el room completo.
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
                const winner = pickWireNodeCandidate(cx, cy, s.wireFamily);

                if (winner) {
                    const start = s.wireStartNode;

                    if (start && start.id !== winner.id) {
                        onConnectWire?.(
                            start.id,
                            winner.id,
                            s.wireWaypoints.length
                                ? s.wireWaypoints
                                : undefined,
                            s.wireRouteType,
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
                s.wireFamily = null;
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
                        if (srcPos && tgtPos) {
                            const curveMidpoint =
                                selectedConductor.curveMidpoint ??
                                defaultWireCurveMidpoint(
                                    srcPos,
                                    tgtPos,
                                    selectedConductor.routeType,
                                );
                            const curveCanvas = sceneToCanvas(
                                curveMidpoint.x,
                                curveMidpoint.y,
                            );
                            const dCurve2 =
                                (curveCanvas.x - cx) ** 2 +
                                (curveCanvas.y - cy) ** 2;
                            if (dCurve2 <= HANDLE_TOL2) {
                                s.isDragging = true;
                                s.dragStartScene = canvasToScene(cx, cy);
                                s.dragObjectId = selectedConductor.id;
                                s.dragObjectType = 'conductor-curve';
                                onDragGesture?.('start');
                                return;
                            }
                        }
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

                    const selectedRoom = rooms.find(
                        (room) => room.id === opts.selectedId,
                    );
                    if (selectedRoom && selectedRoom.vertices.length >= 3) {
                        const vertexTolerance2 = 11 * 11;
                        const midpointTolerance2 = 9 * 9;
                        const screenVertices = selectedRoom.vertices.map(
                            (vertex) => sceneToCanvas(vertex.x, vertex.y),
                        );
                        const vertexIndex = screenVertices.findIndex(
                            (vertex) =>
                                (vertex.x - cx) ** 2 + (vertex.y - cy) ** 2 <=
                                vertexTolerance2,
                        );

                        let vertices = selectedRoom.vertices.map((vertex) => ({
                            ...vertex,
                        }));
                        let dragIndex = vertexIndex;
                        if (dragIndex < 0) {
                            const edgeIndex = screenVertices.findIndex(
                                (vertex, index) => {
                                    const next =
                                        screenVertices[
                                            (index + 1) % screenVertices.length
                                        ];
                                    const midpoint = {
                                        x: (vertex.x + next.x) / 2,
                                        y: (vertex.y + next.y) / 2,
                                    };
                                    return (
                                        (midpoint.x - cx) ** 2 +
                                            (midpoint.y - cy) ** 2 <=
                                        midpointTolerance2
                                    );
                                },
                            );
                            if (edgeIndex >= 0) {
                                const inserted = insertPolygonEdgeMidpoint(
                                    vertices,
                                    edgeIndex,
                                );
                                vertices = inserted.vertices;
                                dragIndex = inserted.insertedIndex;
                                onUpdateRoomVertices?.(
                                    selectedRoom.id,
                                    vertices,
                                );
                            }
                        }

                        if (dragIndex >= 0) {
                            s.isDragging = true;
                            s.dragStartScene = canvasToScene(cx, cy);
                            s.dragObjectId = selectedRoom.id;
                            s.dragObjectType = 'room-vertex';
                            s.dragVertexIndex = dragIndex;
                            s.dragRoomVertices = vertices;
                            onDragGesture?.('start');
                            return;
                        }
                    }

                    // Ronda 26: mismo respaldo por tolerancia que arriba, para
                    // muros — un muro es una polilínea ABIERTA (sin envolver
                    // el último tramo con el primero como sí hace un Room).
                    const selectedWall = walls.find(
                        (wall) => wall.id === opts.selectedId,
                    );
                    if (selectedWall && selectedWall.vertices.length >= 2) {
                        const vertexTolerance2 = 11 * 11;
                        const midpointTolerance2 = 9 * 9;
                        const screenVertices = selectedWall.vertices.map(
                            (vertex) => sceneToCanvas(vertex.x, vertex.y),
                        );
                        const vertexIndex = screenVertices.findIndex(
                            (vertex) =>
                                (vertex.x - cx) ** 2 + (vertex.y - cy) ** 2 <=
                                vertexTolerance2,
                        );

                        let vertices = selectedWall.vertices.map((vertex) => ({
                            ...vertex,
                        }));
                        let dragIndex = vertexIndex;
                        if (dragIndex < 0) {
                            const edgeIndex = screenVertices.findIndex(
                                (vertex, index) => {
                                    if (index >= screenVertices.length - 1) {
                                        return false;
                                    }
                                    const next = screenVertices[index + 1]!;
                                    const midpoint = {
                                        x: (vertex.x + next.x) / 2,
                                        y: (vertex.y + next.y) / 2,
                                    };
                                    return (
                                        (midpoint.x - cx) ** 2 +
                                            (midpoint.y - cy) ** 2 <=
                                        midpointTolerance2
                                    );
                                },
                            );
                            if (edgeIndex >= 0) {
                                const inserted = insertPolygonEdgeMidpoint(
                                    vertices,
                                    edgeIndex,
                                );
                                vertices = inserted.vertices;
                                dragIndex = inserted.insertedIndex;
                                onUpdateWallVertices?.(
                                    selectedWall.id,
                                    vertices,
                                );
                            }
                        }

                        if (dragIndex >= 0) {
                            s.isDragging = true;
                            s.dragStartScene = canvasToScene(cx, cy);
                            s.dragObjectId = selectedWall.id;
                            s.dragObjectType = 'wall-vertex';
                            s.dragVertexIndex = dragIndex;
                            s.dragRoomVertices = vertices;
                            s.dragWallRingJoin = isWallRingJoinVertex(vertices, dragIndex);
                            onDragGesture?.('start');
                            return;
                        }
                    }

                    // Ronda 32: mismo respaldo por tolerancia para tabiques/separadores.
                    const selectedPartition = partitions.find(
                        (partition) => partition.id === opts.selectedId,
                    );
                    if (selectedPartition && selectedPartition.vertices.length >= 2) {
                        const vertexTolerance2 = 11 * 11;
                        const midpointTolerance2 = 9 * 9;
                        const screenVertices = selectedPartition.vertices.map(
                            (vertex) => sceneToCanvas(vertex.x, vertex.y),
                        );
                        const vertexIndex = screenVertices.findIndex(
                            (vertex) =>
                                (vertex.x - cx) ** 2 + (vertex.y - cy) ** 2 <=
                                vertexTolerance2,
                        );

                        let vertices = selectedPartition.vertices.map((vertex) => ({
                            ...vertex,
                        }));
                        let dragIndex = vertexIndex;
                        if (dragIndex < 0) {
                            const edgeIndex = screenVertices.findIndex(
                                (vertex, index) => {
                                    if (index >= screenVertices.length - 1) {
                                        return false;
                                    }
                                    const next = screenVertices[index + 1]!;
                                    const midpoint = {
                                        x: (vertex.x + next.x) / 2,
                                        y: (vertex.y + next.y) / 2,
                                    };
                                    return (
                                        (midpoint.x - cx) ** 2 +
                                            (midpoint.y - cy) ** 2 <=
                                        midpointTolerance2
                                    );
                                },
                            );
                            if (edgeIndex >= 0) {
                                const inserted = insertPolygonEdgeMidpoint(
                                    vertices,
                                    edgeIndex,
                                );
                                vertices = inserted.vertices;
                                dragIndex = inserted.insertedIndex;
                                onUpdatePartitionVertices?.(
                                    selectedPartition.id,
                                    vertices,
                                );
                            }
                        }

                        if (dragIndex >= 0) {
                            s.isDragging = true;
                            s.dragStartScene = canvasToScene(cx, cy);
                            s.dragObjectId = selectedPartition.id;
                            s.dragObjectType = 'partition-vertex';
                            s.dragVertexIndex = dragIndex;
                            s.dragRoomVertices = vertices;
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
                        structuralObstacles,
                        rooms,
                    },
                    { x: cx, y: cy },
                    scenePt,
                    (sx, sy) => sceneToCanvas(sx, sy),
                    {
                        isSelectable: (id) => isObjectSelectable?.(id) ?? true,
                        includeEnclosureInterior: e.altKey,
                    },
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
            onAddFixtureGrid,
            fixtureGridAreaMode,
            onCalibrationMeasure,
            onMeasureDistanceChange,
            onMeasureAreaFinish,
            onAddRoom,
            onAddWall,
        onAddPartition,
            onAddWindow,
            onAddDoor,
            onSelectObject,
            onAddLightSwitch,
            onAddElectricalDevice,
            onConnectWire,
            onUpdateRoomVertices,
            onUpdateWallVertices,
            onUpdatePartitionVertices,
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
            setAlignmentGuide?: (g: AlignmentGuide | null) => void,
            setWireReconnectPreview?: (
                p: {
                    conductorId: string;
                    endpoint: 'source' | 'target';
                    point: CanvasPoint;
                } | null,
            ) => void,
        ) => {
            const s = stateRef.current;
            const __probe = drawPerfEnabled();
            const __tRect = __probe ? performance.now() : 0;
            const rect = (
                e.currentTarget as SVGSVGElement
            ).getBoundingClientRect();
            if (__probe) markRect(performance.now() - __tRect);
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
                activeTool === 'stair' ||
                activeTool === 'structural-obstacle' || activeTool === 'ramp' ||
                activeTool === 'fixture-grid'
                    ? s.roomVertices
                    : isWallTool(activeTool)
                      ? s.wallVertices
                      : []
            ).map((v) => sceneToCanvas(v.x, v.y));

            const prevPointM = getPrevPointM(activeTool, s);
            const noSnapTools = ['switch', 'wire', 'fixture', 'select', 'pan'];
            // fixture-grid en modo 'room' es un clic simple sobre el ambiente
            // completo bajo el cursor (el snap de posicion/angulo no aplica).
            // En modo 'draw' es un poligono libre vertice a vertice, igual
            // que room/corridor/stair, y necesita el mismo asistido (antes
            // quedaba excluido siempre, sin importar el modo).
            const isFixtureGridRoomMode =
                activeTool === 'fixture-grid' && fixtureGridAreaMode !== 'draw';
            // Alt mantenido = override temporal que desactiva TODO snap (posición
            // y ángulo), igual que Shift fuerza ortogonal. Es la salida rápida
            // para cuando el asistido "no deja" avanzar hacia donde el usuario
            // realmente apunta — sin necesidad de cambiar de modo angular.
            const shouldSnap =
                !noSnapTools.includes(activeTool) &&
                !isFixtureGridRoomMode &&
                !e.altKey;

            // El OSNAP CAD (`view.pick` de mlightcad) NO se llama en cada
            // `mousemove`: en un DWG grande cuesta segundos por evento y el
            // trazo se "congela". El preview en vivo usa solo `resolveSnap`
            // (rápido); el OSNAP CAD preciso se aplica al confirmar el vértice
            // en `onMouseDown`.
            let cx = rawX;
            let cy = rawY;

            if (shouldSnap) {
                const __tSnap = __probe ? performance.now() : 0;
                const snapped = resolveSnap(
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
                if (__probe) markSnap(performance.now() - __tSnap);
            }

            if (
                (activeTool === 'room' ||
                    activeTool === 'corridor' ||
                    activeTool === 'stair' ||
                    activeTool === 'structural-obstacle' || activeTool === 'ramp' ||
                    activeTool === 'fixture-grid') &&
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
                // Guarda única para TODO arrastre (vértice, luminaria, room,
                // canopy, dispositivo...): si el motor CAD devuelve un punto no
                // finito (cámara degenerada, división por cero interna), un
                // solo frame corrupto puede quedar escrito en la geometría
                // persistida (ej. un vértice de ambiente en Infinity/NaN) y
                // reventar tanto el motor 3D como el fitToView del 2D al
                // volver. Ignorar el frame en vez de propagarlo.
                if (
                    !Number.isFinite(currentScene.x) ||
                    !Number.isFinite(currentScene.y)
                ) {
                    return;
                }
                const dxM = currentScene.x - s.dragStartScene.x;
                const dyM = currentScene.y - s.dragStartScene.y;

                /**
                 * Ronda 30: mientras se arrastra un vértice de Room/Wall,
                 * ajusta (snap) su posición a la misma columna/fila de
                 * OTRO vértice de la MISMA forma cuando cae cerca (en
                 * píxeles de pantalla — consistente con el resto del
                 * sistema de snap), y reporta la guía visible al llamador.
                 * `excludeIndices` deja fuera al propio vértice arrastrado
                 * (y, para un muro con anillo unido, su copia del otro
                 * extremo — ver el llamador).
                 */
                const ALIGNMENT_SNAP_PX = 8;
                const alignVertexDrag = (
                    siblingVertices: CanvasPoint[],
                    excludeIndices: number[],
                ): CanvasPoint => {
                    const candidatesScreen = siblingVertices
                        .filter((_, idx) => !excludeIndices.includes(idx))
                        .map((v) => sceneToCanvas(v.x, v.y));
                    const snap = resolveVertexAlignmentSnap(
                        { x: cx, y: cy },
                        candidatesScreen,
                        ALIGNMENT_SNAP_PX,
                    );
                    if (snap.guideX === null && snap.guideY === null) {
                        setAlignmentGuide?.(null);
                    } else {
                        setAlignmentGuide?.({
                            x: snap.guideX !== null ? canvasToScene(snap.guideX, cy).x : null,
                            y: snap.guideY !== null ? canvasToScene(cx, snap.guideY).y : null,
                        });
                    }
                    return canvasToScene(snap.point.x, snap.point.y);
                };

                if (s.dragObjectType === 'fixture') {
                    if (selectedFixtureIds.includes(s.dragObjectId)) {
                        // Mover múltiples luminarias
                        onMoveFixtures(selectedFixtureIds, dxM, dyM);
                    } else {
                        // Mover una sola (fallback o click en una no seleccionada que arrastró)
                        const fixture = fixtures.find(
                            (f) => f.id === s.dragObjectId,
                        );
                        if (fixture) {
                            let targetX = fixture.x + dxM;
                            let targetY = fixture.y + dyM;

                            // Alineación inteligente (guías tipo Figma/DIALux evo):
                            // si el centro cae a pocos px en pantalla del eje X o Y
                            // de OTRA luminaria, se ajusta exactamente a ese eje —
                            // permite alinear dos luminarias moviendo la segunda
                            // cerca de la primera, sin coordenadas manuales.
                            const ALIGN_SNAP_PX = 6;
                            const draggedCanvas = sceneToCanvas(
                                targetX,
                                targetY,
                            );
                            let bestX: {
                                value: number;
                                distPx: number;
                            } | null = null;
                            let bestY: {
                                value: number;
                                distPx: number;
                            } | null = null;
                            for (const other of fixtures) {
                                if (other.id === s.dragObjectId) continue;
                                const otherCanvas = sceneToCanvas(
                                    other.x,
                                    other.y,
                                );
                                const distXPx = Math.abs(
                                    otherCanvas.x - draggedCanvas.x,
                                );
                                if (
                                    distXPx <= ALIGN_SNAP_PX &&
                                    (!bestX || distXPx < bestX.distPx)
                                ) {
                                    bestX = { value: other.x, distPx: distXPx };
                                }
                                const distYPx = Math.abs(
                                    otherCanvas.y - draggedCanvas.y,
                                );
                                if (
                                    distYPx <= ALIGN_SNAP_PX &&
                                    (!bestY || distYPx < bestY.distPx)
                                ) {
                                    bestY = { value: other.y, distPx: distYPx };
                                }
                            }
                            if (bestX) targetX = bestX.value;
                            if (bestY) targetY = bestY.value;

                            onMoveFixture(s.dragObjectId, targetX, targetY);
                        }
                    }
                    s.dragStartScene = currentScene;
                } else if (s.dragObjectType === 'conductor-curve') {
                    onMoveWireCurve?.(s.dragObjectId, currentScene);
                    s.dragStartScene = currentScene;
                } else if (
                    s.dragObjectType === 'room-vertex' &&
                    s.dragVertexIndex !== null &&
                    s.dragRoomVertices
                ) {
                    const alignedScene = alignVertexDrag(
                        s.dragRoomVertices,
                        [s.dragVertexIndex],
                    );
                    s.dragRoomVertices = movePolygonVertex(
                        s.dragRoomVertices,
                        s.dragVertexIndex,
                        alignedScene,
                    );
                    onUpdateRoomVertices?.(s.dragObjectId, s.dragRoomVertices);
                    s.dragStartScene = currentScene;
                } else if (
                    s.dragObjectType === 'wall-vertex' &&
                    s.dragVertexIndex !== null &&
                    s.dragRoomVertices
                ) {
                    // `movePolygonVertex` no envuelve — reemplaza un solo
                    // índice, válido tanto para el anillo cerrado de un Room
                    // como para la polilínea abierta de un muro.
                    // `dragWallRingJoin` cubre el caso especial: un muro de
                    // contorno completo (jambas) con el primer y último
                    // vértice duplicados a propósito — ahí hay que mover
                    // ambas copias juntas o el anillo queda con una grieta
                    // de 1 punto en esa esquina. Se excluye del candidato de
                    // alineación (todavía está en su posición vieja, igual
                    // a la del vértice arrastrado — no es una guía útil).
                    const excludeIndices = [s.dragVertexIndex];
                    if (s.dragWallRingJoin) {
                        excludeIndices.push(
                            s.dragVertexIndex === 0 ? s.dragRoomVertices.length - 1 : 0,
                        );
                    }
                    const alignedScene = alignVertexDrag(s.dragRoomVertices, excludeIndices);
                    let next = movePolygonVertex(s.dragRoomVertices, s.dragVertexIndex, alignedScene);
                    if (s.dragWallRingJoin) {
                        const otherEnd = s.dragVertexIndex === 0 ? next.length - 1 : 0;
                        next = movePolygonVertex(next, otherEnd, alignedScene);
                    }
                    s.dragRoomVertices = next;
                    onUpdateWallVertices?.(s.dragObjectId, s.dragRoomVertices);
                    s.dragStartScene = currentScene;
                } else if (
                    s.dragObjectType === 'partition-vertex' &&
                    s.dragVertexIndex !== null &&
                    s.dragRoomVertices
                ) {
                    // Ronda 32: mismo mecanismo que 'wall-vertex' (sin el
                    // caso especial de anillo unido — un tabique siempre es
                    // polilínea abierta, nunca se cierra sobre sí mismo).
                    const alignedScene = alignVertexDrag(
                        s.dragRoomVertices,
                        [s.dragVertexIndex],
                    );
                    s.dragRoomVertices = movePolygonVertex(
                        s.dragRoomVertices,
                        s.dragVertexIndex,
                        alignedScene,
                    );
                    onUpdatePartitionVertices?.(s.dragObjectId, s.dragRoomVertices);
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
            onUpdateRoomVertices,
            onUpdateWallVertices,
            onUpdatePartitionVertices,
            onMoveCanopy,
            onMoveWindow,
            onMoveDoor,
            onMoveLightSwitch,
            onMoveElectricalDevice,
            onMoveWireCurve,
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
            setAlignmentGuide?: (g: AlignmentGuide | null) => void,
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
                s.dragVertexIndex = null;
                s.dragRoomVertices = null;
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
                setAlignmentGuide?.(null);
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
            if (activeTool === 'partition') {
                onAddPartition?.(s.wallVertices);
            } else {
                onAddWall(s.wallVertices);
            }
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
    }, [activeTool, onAddWall, onAddPartition, onMeasureAreaFinish, onDoubleClick]);

    const beginWireFromNode = useCallback(
        (
            id: string,
            type: 'switch' | 'fixture' | 'device',
            family: DrawState['wireFamily'] = null,
            routeType: Conductor['routeType'] = 'wall_ceiling',
        ) => {
            stateRef.current.wireStartNode = { id, type };
            stateRef.current.wireWaypoints = [];
            stateRef.current.wireFamily = family;
            stateRef.current.wireRouteType = routeType;
        },
        [],
    );

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
                    activeTool === 'stair' ||
                    activeTool === 'structural-obstacle' || activeTool === 'ramp' ||
                    activeTool === 'fixture-grid') &&
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

    /**
     * Descarta por completo el trazo en curso (polígono, muro o medición de
     * área) sin confirmarlo — para atarlo a Escape. Devuelve true si había
     * algo que descartar.
     */
    const cancelDraft = useCallback(
        (
            setRoomVertices: (v: CanvasPoint[]) => void,
            setWallPreview: (p: CanvasPoint[] | null) => void,
            setMeasureAreaVertices: (v: CanvasPoint[]) => void,
        ): boolean => {
            const s = stateRef.current;
            let had = false;
            if (s.roomVertices.length > 0) {
                s.roomVertices = [];
                s.previewPoint = null;
                setRoomVertices([]);
                had = true;
            }
            if ((s.wallVertices?.length ?? 0) > 0) {
                s.wallVertices = [];
                setWallPreview(null);
                had = true;
            }
            if (s.measureAreaVertices.length > 0) {
                s.measureAreaVertices = [];
                setMeasureAreaVertices([]);
                had = true;
            }
            if (had) s.isDrawing = false;
            return had;
        },
        [],
    );

    return {
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onDoubleClick: handleDoubleClick,
        isDragging: () => stateRef.current.isDragging,
        undoLastDraftVertex,
        cancelDraft,
        commitDrawVertex,
        finishDrawPolygon,
        /** True si la herramienta activa dibuja un polígono cerrado (recinto, área de proyección…). */
        isPolygonDrawTool,
        /** Radio de cierre de polígono en px de canvas (para la ayuda visual sobre el primer vértice). */
        closeThresholdPx,
        getDraftPrevPoint,
        beginWireFromNode,
    };
}
