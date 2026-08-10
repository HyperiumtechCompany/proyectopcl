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

import React, {
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo,
    memo,
} from 'react';
import {
    resolveFixtureRenderHeight,
    resolveRoomCeilingHeight,
} from '@/pages/dialux/engine/fixtureHeights';
import { findAmbientSpaceAtPoint } from '@/pages/dialux/hooks/ambientSpaces';
import { shouldEnableOverlayPointerEvents } from '@/pages/dialux/hooks/cadInteraction';
import {
    connectedCircuitConductorIds,
    panelBoundaryIds,
} from '@/pages/dialux/hooks/conductorCircuitGroups';
import {
    ELECTRICAL_DEVICE_DEFAULTS,
    isOutletDeviceType,
    type ElectricalDeviceType,
} from '@/pages/dialux/hooks/types';
import {
    useCanvasInteraction,
    type CanvasPoint,
} from '@/pages/dialux/hooks/useCanvasInteraction';
import {
    normalizeScaleConfig,
    useEditorStore,
    useActiveScene,
    useViewport,
} from '@/pages/dialux/hooks/useEditorStore';
import {
    loadDialuxPlan,
    loadDialuxPlanFromServer,
    saveDialuxPlanFile,
    storedDialuxPlanToFile,
    uploadLocalDialuxPlanIfMissing,
} from '@/pages/dialux/hooks/dialuxPlanStorage';
import {
    markDialuxPlanSyncFailed,
    markDialuxPlanSyncOk,
} from '@/pages/dialux/hooks/useDialuxPlanSyncStatus';
import {
    clampOpeningOffsetToWallSegment,
    wallLength,
} from '@/pages/dialux/hooks/useInteractionHelpers';
import { useMlightcadEngine } from '@/pages/dialux/hooks/useMlightcadEngine';
import { useWasmEngine } from '@/pages/dialux/hooks/useWasmEngine';
import { getPeruWallPreset } from '@/pages/dialux/hooks/wallNorms';
import {
    applyLegacyLinkUpdate,
    computeLegacyLinkUpdate,
} from '@/pages/dialux/hooks/wireLegacySync';

import { createCanvasTransforms } from '@/pages/dialux/geometry/coordinateTransform';
import { CalibrationDialog } from '../CalibrationDialog';
import { CadStatusOverlays } from './CadStatusOverlays';
import { CalibrationOverlay } from './CalibrationOverlay';
import { CanvasSvgDefs } from './CanvasSvgDefs';
import {
    CAD_OSNAP_TOOLS,
    CURSOR_MAP,
    INTERACTIVE_TOOLS,
} from './canvasToolConstants';
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
import { OverlayElectricalDevices } from './OverlayElectricalDevices';
import { OverlayFixtureGridGuides } from './OverlayFixtureGridGuides';
import { OverlayFixtures } from './OverlayFixtures';
import { DynamicInputOverlay } from './DynamicInputOverlay';
import { OverlayLightSwitches } from './OverlayLightSwitches';
import { OverlayMeasureArea } from './OverlayMeasureArea';
import { OverlayMeasureDistance } from './OverlayMeasureDistance';
import { OverlayPartitions } from './OverlayPartitions';
import { OverlayPreviews } from './OverlayPreviews';
import { OverlayRooms } from './OverlayRooms';
import {
    OverlayRotateHandle,
    type RotatableTarget,
} from './OverlayRotateHandle';
import { OverlayStructuralObstacles } from './OverlayStructuralObstacles';
import { OverlayWalls } from './OverlayWalls';
import { OverlayWindows } from './OverlayWindows';
import { OverlayWires } from './OverlayWires';
import {
    classifyConductorLayer,
    isElectricalItemVisible,
} from '@/pages/dialux/electrical/electricalLayerVisibility';

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
        const selectedCircuitConductorIds = useMemo(() => {
            if (
                !scene ||
                !ui.selectedId ||
                !(scene.conductors ?? []).some(
                    (conductor) => conductor.id === ui.selectedId,
                )
            ) {
                return [];
            }

            return connectedCircuitConductorIds(
                scene.conductors ?? [],
                ui.selectedId,
                panelBoundaryIds(scene.electricalDevices),
            );
        }, [scene, ui.selectedId]);
        const resultsByRoom = useEditorStore((state) => state.resultsByRoom);
        const showAllFloors = useEditorStore((s) => s.ui.showAllFloors);
        const allScenes = useEditorStore((s) => s.project?.scenes) ?? [];
        const projectId = useEditorStore((s) => s.project?.id ?? null);
        const activeSceneId = useEditorStore((s) => s.activeSceneId);
        const engine = useMlightcadEngine();
        const { parseDxf } = useWasmEngine();

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
        /** Extremo de cable en arrastre, mientras se reconecta a otro nodo */
        const [wireReconnectPreview, setWireReconnectPreview] = useState<{
            conductorId: string;
            endpoint: 'source' | 'target';
            point: CanvasPoint;
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
        /** Vértices en progreso para la herramienta measure-area */
        const [measureAreaVertices, setMeasureAreaVertices] = useState<
            CanvasPoint[]
        >([]);
        /** Punto de preview dinámico del cursor para measure-area */
        const [measureAreaPreviewPt, setMeasureAreaPreviewPt] =
            useState<CanvasPoint | null>(null);
        /** Medición congelada al cerrar el polígono (para mantenerla visible) */
        const [measureAreaFrozen, setMeasureAreaFrozen] = useState<
            CanvasPoint[] | null
        >(null);
        const [distanceMeasurement, setDistanceMeasurement] = useState<{
            start: CanvasPoint;
            end: CanvasPoint;
        } | null>(null);
        const [isDistanceMeasurementFinal, setIsDistanceMeasurementFinal] =
            useState(false);
        const [tempElectricalDevice, setTempElectricalDevice] = useState<{
            x: number;
            y: number;
            type: ElectricalDeviceType;
            label: string;
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
        // Par único de transformaciones pantalla ↔ mundo (metros). La ruta nativa
        // usa la cámara del motor CAD (píxeles CSS); el fallback aplica una afín
        // propia con inversión de Y coherente con el convenio CAD.
        // `viewTick` fuerza la re-creación cuando la cámara nativa cambia.
        const transforms = useMemo(
            () =>
                createCanvasTransforms(
                    hasCadView ? cadView : null,
                    scaleConfig,
                    {
                        zoom,
                        panX,
                        panY,
                        pxPerMeter: getCanvasScalePxPerMeter(scaleConfig),
                    },
                    size.h,
                ),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [
                hasCadView,
                cadView,
                scaleConfig.factor,
                scaleConfig.calibrationFactor,
                zoom,
                panX,
                panY,
                size.h,
                viewTick,
            ],
        );

        const screenPoint = useCallback(
            (point: { x: number; y: number }) =>
                transforms.sceneToScreen(point),
            [transforms],
        );

        const screenDistance = useCallback(
            (
                dx: number,
                dy: number,
                origin: { x: number; y: number } = { x: 0, y: 0 },
            ) => transforms.screenDistance(dx, dy, origin),
            [transforms],
        );

        const worldPoint = useCallback(
            (px: number, py: number) =>
                transforms.screenToScene({ x: px, y: py }),
            [transforms],
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

        // ── Interacción ───────────────────────────────────────────────────────────
        // IMPORTANT: useCanvasInteraction MUST be declared before the RAF useEffect
        // below, because the RAF loop calls isDraggingFn(). Having the useEffect
        // reference isDraggingFn before the const declaration causes a TDZ crash
        const {
            onMouseDown,
            onMouseMove,
            onMouseUp,
            onDoubleClick,
            isDragging: isDraggingFn,
            undoLastDraftVertex,
            commitDrawVertex,
            getDraftPrevPoint,
        } = useCanvasInteraction({
            activeTool: ui.activeTool,
            angleSnapMode: ui.angleSnapMode,
            fixtureGridAreaMode: ui.fixtureGridAreaMode,
            zoom,
            resolveCadOsnap: CAD_OSNAP_TOOLS.has(ui.activeTool)
                ? (scenePoint, lastPoint) => {
                      // scenePoint llega en metros (ya convertido por worldPoint).
                      // getOsnapPoint/view.pick operan en coordenadas CAD nativas.
                      // Debemos convertir en la frontera para evitar desfases
                      // proporcionales al effectiveScale (hasta 1000x en planos mm).
                      const cadPoint = {
                          x: metersToCad(scenePoint.x, scaleConfig),
                          y: metersToCad(scenePoint.y, scaleConfig),
                      };
                      const cadLast = lastPoint
                          ? {
                                x: metersToCad(lastPoint.x, scaleConfig),
                                y: metersToCad(lastPoint.y, scaleConfig),
                            }
                          : null;
                      let osnapCad = null;
                      try {
                          osnapCad = engine.getOsnapPoint(cadPoint, {
                              lastPoint: cadLast,
                          });
                      } catch (err) {
                          console.warn(
                              '[DIAlux] engine.getOsnapPoint threw an error (malformed DXF entity?):',
                              err,
                          );
                      }
                      if (!osnapCad) return null;
                      // Retornar en metros para que el pipeline de snap sea consistente.
                      return {
                          x: cadToMeters(osnapCad.x, scaleConfig),
                          y: cadToMeters(osnapCad.y, scaleConfig),
                      };
                  }
                : undefined,
            dxfEntities: store.dxfEntities,
            walls: scene?.walls ?? [],
            screenToScene: (cx, cy) => worldPoint(cx, cy),
            sceneToScreen: (sx, sy) => screenPoint({ x: sx, y: sy }),
            electricalDeviceTemplate: ui.electricalDeviceTemplate,
            selectedId: ui.selectedId,
            fixtures: scene?.fixtures ?? [],
            selectedFixtureIds: ui.selectedFixtureIds ?? [],
            lightSwitches: scene?.lightSwitches ?? [],
            electricalDevices: scene?.electricalDevices ?? [],
            rooms: scene?.rooms ?? [],
            canopies: scene?.canopies ?? [],
            windows: scene?.windows ?? [],
            doors: scene?.doors ?? [],
            conductors: scene?.conductors ?? [],
            partitions: scene?.partitions ?? [],
            structuralObstacles: scene?.structuralObstacles ?? [],
            isObjectSelectable: (id) =>
                scene
                    ? isElectricalItemVisible(
                          scene,
                          ui.electricalLayerVisibility,
                          ui.hiddenElectricalIds,
                          id,
                      )
                    : true,
            onDragGesture: (phase) => {
                if (phase === 'start') store.beginHistoryGesture();
                else store.endHistoryGesture();
            },
            onMoveFixture: (id, x, y) => store.updateFixture(id, { x, y }),
            onMoveFixtures: (ids, dx, dy) => {
                const fixtures = scene?.fixtures ?? [];
                ids.forEach((id) => {
                    const fixture = fixtures.find((f) => f.id === id);
                    if (fixture) {
                        store.updateFixture(id, {
                            x: fixture.x + dx,
                            y: fixture.y + dy,
                        });
                    }
                });
            },
            onMoveLightSwitch: (id, x, y, wallId) => {
                store.updateLightSwitch(id, { x, y, wallId });
            },
            onMoveElectricalDevice: (id, x, y, wallId) => {
                store.updateElectricalDevice(id, { x, y, wallId });
            },
            onConnectWire: (sourceId, targetId, waypoints) => {
                // If it already exists, remove it (toggle connection)
                const existingWire = scene?.conductors?.find(
                    (c) =>
                        (c.sourceId === sourceId && c.targetId === targetId) ||
                        (c.sourceId === targetId && c.targetId === sourceId),
                );

                if (existingWire) {
                    store.removeObject(existingWire.id);
                } else {
                    // CNE-Utilización / RNE EM.010: los tomacorrientes van en
                    // circuito propio, con calibre mayor (4 mm² / AWG 12) al
                    // de alumbrado (2.5 mm²) — nunca comparten tubería ni
                    // circuito. Si cualquiera de los dos extremos es un
                    // tomacorriente, el cable nuevo parte ya con ese calibre.
                    const endpointDevices = scene?.electricalDevices ?? [];
                    const connectsOutlet = [sourceId, targetId].some((id) =>
                        endpointDevices.some(
                            (device) =>
                                device.id === id &&
                                isOutletDeviceType(device.type),
                        ),
                    );
                    store.addConductor({
                        sourceId,
                        targetId,
                        wireCount: ui.wireTemplate.wireCount,
                        wireLabel: ui.wireTemplate.wireLabel,
                        routeType: 'wall_ceiling',
                        tubeSize: 20,
                        conductorType: 'THW-90',
                        sectionMm2: connectsOutlet ? 4 : 2.5,
                        waypoints: waypoints ?? [],
                    });
                }

                applyLegacyLinkUpdate(
                    computeLegacyLinkUpdate(
                        sourceId,
                        targetId,
                        {
                            lightSwitches: scene?.lightSwitches ?? [],
                            fixtures: scene?.fixtures ?? [],
                            electricalDevices: scene?.electricalDevices ?? [],
                        },
                        !existingWire,
                    ),
                    store,
                );
            },
            // Arrastrar el extremo de un cable ya seleccionado hasta otro nodo
            // (luminaria/interruptor/equipo), para corregir una conexión mal
            // hecha sin tener que borrar el cable y volver a trazarlo.
            onReconnectWireEndpoint: (conductorId, endpoint, newNodeId) => {
                const conductor = scene?.conductors?.find(
                    (c) => c.id === conductorId,
                );
                if (!conductor) return;

                const otherId =
                    endpoint === 'source'
                        ? conductor.targetId
                        : conductor.sourceId;
                const currentId =
                    endpoint === 'source'
                        ? conductor.sourceId
                        : conductor.targetId;
                if (newNodeId === otherId || newNodeId === currentId) return; // loop o sin cambios

                const wouldDuplicate = scene?.conductors?.some(
                    (c) =>
                        c.id !== conductorId &&
                        ((c.sourceId === otherId && c.targetId === newNodeId) ||
                            (c.sourceId === newNodeId &&
                                c.targetId === otherId)),
                );
                if (wouldDuplicate) return;

                const ctx = {
                    lightSwitches: scene?.lightSwitches ?? [],
                    fixtures: scene?.fixtures ?? [],
                    electricalDevices: scene?.electricalDevices ?? [],
                };

                // Romper el vínculo legacy de la conexión anterior...
                applyLegacyLinkUpdate(
                    computeLegacyLinkUpdate(
                        conductor.sourceId,
                        conductor.targetId,
                        ctx,
                        false,
                    ),
                    store,
                );

                const newSourceId =
                    endpoint === 'source' ? newNodeId : conductor.sourceId;
                const newTargetId =
                    endpoint === 'target' ? newNodeId : conductor.targetId;
                store.updateConductor(
                    conductorId,
                    endpoint === 'source'
                        ? { sourceId: newNodeId }
                        : { targetId: newNodeId },
                );

                // ...y crear el de la nueva.
                applyLegacyLinkUpdate(
                    computeLegacyLinkUpdate(
                        newSourceId,
                        newTargetId,
                        ctx,
                        true,
                    ),
                    store,
                );
            },
            onAddRoom: (verticesM) => {
                const isCorridor = ui.activeTool === 'corridor';
                const isStair = ui.activeTool === 'stair';
                // Fase 16 (panel de Emergencia): 'evacuation-route'/'antipanic-area'
                // se dibujan como un polígono único, igual que un pasadizo —
                // ver `hooks/ambientSpaces.ts` (tratados como un solo espacio,
                // sin subdivisión por muros).
                const isEvacuationRoute = ui.activeTool === 'evacuation-route';
                const isAntipanicArea = ui.activeTool === 'antipanic-area';
                const effectiveRoomType = isStair
                    ? 'stair'
                    : isCorridor
                      ? 'corridor'
                      : isEvacuationRoute
                        ? 'evacuation-route'
                        : isAntipanicArea
                          ? 'antipanic-area'
                          : (ui.roomTypeTemplate ?? 'room');
                const stairCount =
                    scene?.rooms.filter((r) => r.roomType === 'stair').length ??
                    0;
                const corridorCount =
                    scene?.rooms.filter((r) => r.roomType === 'corridor')
                        .length ?? 0;
                const ambientCount =
                    scene?.rooms.filter((r) => r.roomType === 'ambient')
                        .length ?? 0;
                const roomCount =
                    scene?.rooms.filter(
                        (r) => !r.roomType || r.roomType === 'room',
                    ).length ?? 0;
                const evacuationRouteCount =
                    scene?.rooms.filter((r) => r.roomType === 'evacuation-route')
                        .length ?? 0;
                const antipanicAreaCount =
                    scene?.rooms.filter((r) => r.roomType === 'antipanic-area')
                        .length ?? 0;
                const id = store.addRoom({
                    name: isStair
                        ? `Escalera ${stairCount + 1}`
                        : isCorridor
                          ? `Pasadizo ${corridorCount + 1}`
                          : isEvacuationRoute
                            ? `Ruta de evacuación ${evacuationRouteCount + 1}`
                            : isAntipanicArea
                              ? `Área antipánico ${antipanicAreaCount + 1}`
                              : effectiveRoomType === 'ambient'
                                ? `Ambiente ${ambientCount + 1}`
                                : `Recinto ${roomCount + 1}`,
                    vertices: verticesM,
                    height: 2.7,
                    roomType: effectiveRoomType,
                    color: isStair
                        ? 'rgba(251, 146, 60, 0.35)'
                        : isCorridor
                          ? 'rgba(59, 130, 246, 0.4)'
                          : isEvacuationRoute || isAntipanicArea
                            ? 'rgba(220, 38, 38, 0.3)'
                            : effectiveRoomType === 'ambient'
                              ? 'rgba(34, 197, 94, 0.25)'
                              : 'rgba(56,189,248,0.25)',
                    stairConfig: isStair
                        ? {
                              normativeUse: 'generic',
                              orientation: 'north',
                              riserHeight: 0.175,
                              treadDepth: 0.28,
                              stairWidth: 1.2,
                              flightGap: 0.4,
                              showRailings: false,
                              stepCount: 20,
                              flights: [
                                  {
                                      id: `flight-${Date.now()}-1`,
                                      stepCount: 10,
                                      direction: 'north',
                                      hasLanding: true,
                                      landingDepth: 1.2,
                                  },
                                  {
                                      id: `flight-${Date.now()}-2`,
                                      stepCount: 10,
                                      direction: 'south',
                                      hasLanding: false,
                                      landingDepth: 0,
                                  },
                              ],
                          }
                        : undefined,
                    corridorConfig: isCorridor
                        ? {
                              ...(ui.corridorTemplate || {}),
                              type: ui.corridorTemplate?.type ?? 'roof_only',
                              slabThickness:
                                  ui.corridorTemplate?.slabThickness ?? 0.2,
                              railingHeight:
                                  ui.corridorTemplate?.railingHeight ?? 1.05,
                          }
                        : undefined,
                });
                store.setSelectedId(id);
                setRoomVertices([]);
                setRoomPreviewPt(null);
            },
            onAddStructuralObstacle: (verticesM) => {
                const obstacleCount = scene?.structuralObstacles?.length ?? 0;
                const floorHeight = scene?.floorHeight ?? 3.0;
                const id = store.addStructuralObstacle({
                    name: `Columna ${obstacleCount + 1}`,
                    obstacleType: 'column',
                    vertices: verticesM,
                    // Piso a techo por defecto (caso mas comun: columna estructural);
                    // el usuario ajusta elevation/height en el panel de propiedades
                    // para vigas suspendidas o zonas restringidas puntuales.
                    height: floorHeight,
                    elevation: 0,
                });
                store.setSelectedId(id);
                setRoomVertices([]);
                setRoomPreviewPt(null);
            },
            onAddWall: (vertices) => {
                const isEducationWall = ui.activeTool === 'education-wall';
                const wallType = isEducationWall
                    ? 'interior'
                    : (ui.wallTypeTemplate ?? 'interior');
                const preset = getPeruWallPreset(
                    'brick',
                    isEducationWall ? 'education' : 'housing',
                );
                const id = store.addWall({
                    vertices,
                    wallType,
                    material: preset.material,
                    normativeUse: preset.use,
                    thickness: preset.recommendedThickness,
                    height: preset.recommendedHeight,
                    mortarJointMin: preset.mortarJointMin,
                    mortarJointMax: preset.mortarJointMax,
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
            onAddDoor: (wallId, offsetAlongWall, placement) => {
                const t = ui.doorTemplate;
                const wall = scene?.walls.find(
                    (candidate) => candidate.id === wallId,
                );
                const width = t.width ?? 0.9;
                const openingOffset = wall
                    ? clampOpeningOffsetToWallSegment(
                          {
                              offsetAlongWall,
                              segmentStartOffset:
                                  placement?.segmentStartOffset ?? 0,
                              segmentEndOffset:
                                  placement?.segmentEndOffset ??
                                  wallLength(wall.vertices),
                          },
                          width,
                          wallLength(wall.vertices),
                          'center',
                      )
                    : offsetAlongWall;
                store.addDoor({
                    wallId,
                    offsetAlongWall: openingOffset,
                    width,
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
            onAddFixture: (xM: number, yM: number) => {
                if (!scene) return;
                const ambient = findAmbientSpaceAtPoint(scene, {
                    x: xM,
                    y: yM,
                });

                const t = ui.fixtureTemplate;
                const fixtureType = t.fixtureType ?? 'surface';
                const ceilingHeight = ambient
                    ? resolveRoomCeilingHeight(ambient.room, scene.walls)
                    : undefined;
                const fixtureHeight = resolveFixtureRenderHeight(
                    {
                        z: t.z ?? (ceilingHeight ? ceilingHeight - 0.08 : 2.4),
                        fixtureType,
                        emergencyType: t.emergencyType,
                    },
                    ceilingHeight,
                );
                const id = store.addFixture({
                    // Conserva todos los campos del catálogo (dimensiones, IP/IK,
                    // catalogSymbol, emergencyType, etc.) — antes se perdían al
                    // colocar la luminaria, dejándola sin su identidad de catálogo.
                    ...t,
                    name: t.name ?? `Luminaria ${ambient?.name ?? 'exterior'}`,
                    x: xM,
                    y: yM,
                    z: fixtureHeight,
                    lumens: t.lumens ?? 4000,
                    power: t.power,
                    efficiency: t.efficiency ?? 0.8,
                    fixtureType,
                    fixtureShape: t.fixtureShape ?? 'rectangular',
                    brand: t.brand,
                    articleNumber: t.articleNumber,
                    productId: t.productId,
                    productSourceFormat: t.productSourceFormat,
                    lightColor: t.lightColor ?? '#fff5e1',
                    roomId: ambient?.sourceRoom.id,
                });
                store.setSelectedId(id);
            },
            onAddFixtureGrid: (roomId) => {
                const newIds = store.addFixtureGrid({
                    roomId,
                    rows: ui.fixtureGridRows,
                    columns: ui.fixtureGridCols,
                    fixtureTemplate: ui.fixtureTemplate,
                });
                if (newIds.length > 0) {
                    store.setSelectedId(null);
                    store.setSelectedFixtureIds(newIds);
                    store.setTool('select');
                }
            },
            // "Proyectar luminarias en un area especifica" (estilo DIALux evo):
            // el poligono libre dibujado por el usuario (vertice a vertice,
            // cierra cerca del primero, igual que Room) NUNCA se persiste como
            // geometria -- primero queda "pendiente" (ui.pendingFixtureGridArea)
            // para que el usuario confirme la cantidad de luminarias en el
            // panel Luz, y solo ENTONCES se usa como `ambientVertices` para
            // calcular el centro de cada luminaria dentro de ESA area puntual.
            onCloseFixtureGridArea: (verticesM) => {
                store.setPendingFixtureGridArea(verticesM);
            },
            onAddLightSwitch: (x, y, wallId) => {
                const id = store.addLightSwitch({
                    x,
                    y,
                    wallId,
                    type: ui.switchTemplate.type,
                    mountingHeight: ui.switchTemplate.mountingHeight,
                    label: ui.switchTemplate.label,
                });
                store.setSelectedId(id);
            },
            onAddElectricalDevice: (x, y, wallId) => {
                const template = ui.electricalDeviceTemplate;
                if (!template) return;
                const defaults = ELECTRICAL_DEVICE_DEFAULTS[template.type];
                // Incrementar el número del label si ya existen dispositivos del mismo tipo
                const existingOfType = (scene?.electricalDevices ?? []).filter(
                    (d) => d.type === template.type,
                );
                let label = template.label ?? defaults.label;
                if (existingOfType.length > 0) {
                    // Para junction_box: C-01, C-02...
                    // Para sub_panel: TD-01, TD-02...
                    const base = defaults.label.replace(/-\d+$/, '');
                    label = `${base}-${String(existingOfType.length + 1).padStart(2, '0')}`;
                }
                const ambient = scene
                    ? findAmbientSpaceAtPoint(scene, { x, y })
                    : null;
                const mountingHeight =
                    template.type === 'outlet_ceiling' && ambient
                        ? resolveRoomCeilingHeight(
                              ambient.room,
                              scene?.walls ?? [],
                          )
                        : defaults.mountingHeight;
                const id = store.addElectricalDevice({
                    type: template.type,
                    x,
                    y,
                    label,
                    mountingHeight,
                    wallId,
                    connectedDeviceIds: [],
                    properties: {
                        ...defaults.properties,
                        ...template.properties,
                    },
                    // Antes no se asignaba (a diferencia de `onAddFixture`,
                    // arriba, que sí lo hace) — el dispositivo quedaba con
                    // `roomId: undefined` para siempre, obligando a cada
                    // consumidor (conteo de tomacorrientes por normativa,
                    // agrupación para cálculo CT/longitud de cable) a inventar
                    // su propio criterio de a qué ambiente pertenece, con
                    // resultados inconsistentes entre pantallas.
                    roomId: ambient?.sourceRoom.id,
                });
                store.setSelectedId(id);
            },
            onCalibrationMeasure: (sceneDistM, p1Scene, p2Scene) => {
                // Recuperar la distancia CAD exacta usando el factor actual.
                // sceneDistM ya contiene la distancia exacta en metros, derivada del OSNAP CAD si se activó.
                // Dividir por effectiveScale nos devuelve la distancia CAD nativa pura sin pasar por píxeles de pantalla.
                const scale = effectiveScale > 0 ? effectiveScale : 1;
                const cadDistance = sceneDistM / scale;

                setCalibrationLine({ start: p1Scene, end: p2Scene });
                setPendingCalibration({
                    cadDistance,
                    start: p1Scene,
                    end: p2Scene,
                });
            },

            onMeasureDistanceChange: (measurement, isFinal) => {
                setDistanceMeasurement(measurement);
                setIsDistanceMeasurementFinal(isFinal);
            },

            /**
             * onMeasureAreaFinish: el usuario cerró el polígono de medición.
             * Los vértices ya están en metros calibrados (pasaron por worldPoint)
             * → el área calculada aquí es idéntica a la de los recintos DIAlux.
             */
            onMeasureAreaFinish: (verticesM) => {
                setMeasureAreaFrozen(verticesM);
                setMeasureAreaVertices([]);
                setMeasureAreaPreviewPt(null);
            },

            onSelectObject: (id, multi) => {
                if (multi && id) {
                    store.toggleFixtureSelection(id);
                } else {
                    store.setSelectedId(id);
                }
            },
            onPanChange: (dx, dy) => store.setPan(panX + dx, panY + dy),
            onDoubleClick: () => {
                setRoomPreviewPt(null);
                setWallPreview(null);
                setCanopyPreview(null);
                setMeasureAreaPreviewPt(null);
            },
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

        // Ctrl+Z mientras se está dibujando un recinto/muro/medición de área
        // quita solo el último punto colocado, en vez de disparar el undo
        // global (que actuaría sobre el último objeto ya confirmado). Sin
        // esto, un clic de más en un polígono grande obligaba a cancelar todo
        // el trazo y volver a empezar. Se escucha en fase de captura para
        // interceptar el evento antes que el atajo global de EditorLayout.
        useEffect(() => {
            const handler = (e: KeyboardEvent) => {
                if (
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement
                ) {
                    return;
                }
                if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return;
                if (e.key.toLowerCase() !== 'z') return;

                const handled = undoLastDraftVertex(
                    setRoomVertices,
                    setWallPreview,
                    setMeasureAreaVertices,
                );
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };

            window.addEventListener('keydown', handler, true);
            return () => window.removeEventListener('keydown', handler, true);
        }, [undoLastDraftVertex]);

        // Espejo en React state del trazo abandonado al cambiar de herramienta.
        // useCanvasInteraction ya limpia su ref interno (stateRef) al cambiar
        // activeTool, pero lo que se ve en pantalla es este state — sin esto,
        // el dibujo a medias quedaba visible aunque internamente ya no
        // existiera, confundiendo al usuario (y potencialmente al cliente).
        useEffect(() => {
            setRoomVertices([]);
            setRoomPreviewPt(null);
            setWallPreview(null);
            setCanopyPreview(null);
            // Area de proyeccion pendiente sin confirmar: se descarta si el
            // usuario cambia de herramienta antes de decidir la cantidad
            // (ver panel Luz) -- es un borrador de UI, no debe sobrevivir.
            if (ui.activeTool !== 'fixture-grid') {
                store.setPendingFixtureGridArea(null);
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [ui.activeTool]);

        // ── Input dinámico (distancia + ángulo tecleados) ───────────────────────
        // Solo aplica a recinto/muro con al menos un vértice ya colocado: son
        // las herramientas de polígono donde el snap angular puede no alcanzar
        // para trazar un ángulo irregular (terreno con forma peculiar). El
        // valor tecleado se aplica tal cual, sin pasar por el snap.
        const isDynInputTool =
            ui.activeTool === 'room' ||
            ui.activeTool === 'corridor' ||
            ui.activeTool === 'stair' ||
            ui.activeTool === 'wall' ||
            ui.activeTool === 'education-wall';
        const dynInputPrevScene = isDynInputTool ? getDraftPrevPoint() : null;
        const dynInputPreviewScene = isDynInputTool
            ? ui.activeTool === 'wall' || ui.activeTool === 'education-wall'
                ? (wallPreview?.length ? wallPreview[wallPreview.length - 1] : null)
                : roomPreviewPt
            : null;
        const dynInputVisible = Boolean(
            dynInputPrevScene && dynInputPreviewScene,
        );
        const dynInputPrevScreen = dynInputPrevScene
            ? screenPoint(dynInputPrevScene)
            : null;
        const dynInputPreviewScreen = dynInputPreviewScene
            ? screenPoint(dynInputPreviewScene)
            : null;
        let dynInputLiveDistanceM = 0;
        let dynInputLiveAngleDeg = 0;
        if (dynInputPrevScreen && dynInputPreviewScreen) {
            dynInputLiveDistanceM = measureCadDistanceFromScreen(
                dynInputPrevScreen,
                dynInputPreviewScreen,
            );
            const dx = dynInputPreviewScreen.x - dynInputPrevScreen.x;
            const dy = dynInputPreviewScreen.y - dynInputPrevScreen.y;
            dynInputLiveAngleDeg =
                (((Math.atan2(dy, dx) * 180) / Math.PI) + 360) % 360;
        }
        const handleDynamicInputCommit = useCallback(
            (distanceM: number, angleDeg: number) => {
                const prevScene = getDraftPrevPoint();
                if (!prevScene) return;
                const prevScreen = screenPoint(prevScene);
                const refScreen = screenPoint({
                    x: prevScene.x + 1,
                    y: prevScene.y,
                });
                const pxPerMeter =
                    Math.hypot(
                        refScreen.x - prevScreen.x,
                        refScreen.y - prevScreen.y,
                    ) || 1;
                const angleRad = (angleDeg * Math.PI) / 180;
                const distancePx = distanceM * pxPerMeter;
                const targetScreen = {
                    x: prevScreen.x + distancePx * Math.cos(angleRad),
                    y: prevScreen.y + distancePx * Math.sin(angleRad),
                };
                commitDrawVertex(
                    targetScreen.x,
                    targetScreen.y,
                    setRoomVertices,
                    setWallPreview,
                );
            },
            [getDraftPrevPoint, screenPoint, commitDrawVertex],
        );

        // ── Manija de rotación (luminaria / interruptor / dispositivo único) ────
        const rotateKind: 'fixture' | 'switch' | 'device' | null =
            useMemo(() => {
                if (!scene || ui.activeTool !== 'select') return null;
                if ((ui.selectedFixtureIds?.length ?? 0) === 1)
                    return 'fixture';
                if (
                    ui.selectedId &&
                    scene.lightSwitches.some((s) => s.id === ui.selectedId)
                )
                    return 'switch';
                if (
                    ui.selectedId &&
                    (scene.electricalDevices ?? []).some(
                        (d) => d.id === ui.selectedId,
                    )
                )
                    return 'device';
                return null;
            }, [scene, ui.activeTool, ui.selectedFixtureIds, ui.selectedId]);

        const rotateTarget: RotatableTarget | null = useMemo(() => {
            if (!scene || !rotateKind) return null;
            if (rotateKind === 'fixture') {
                const fx = scene.fixtures.find(
                    (f) => f.id === ui.selectedFixtureIds![0],
                );
                return fx
                    ? {
                          id: fx.id,
                          x: fx.x,
                          y: fx.y,
                          rotation: fx.rotation ?? 0,
                      }
                    : null;
            }
            if (rotateKind === 'switch') {
                const sw = scene.lightSwitches.find(
                    (s) => s.id === ui.selectedId,
                );
                return sw
                    ? {
                          id: sw.id,
                          x: sw.x,
                          y: sw.y,
                          rotation: sw.rotation ?? 0,
                      }
                    : null;
            }
            const dev = (scene.electricalDevices ?? []).find(
                (d) => d.id === ui.selectedId,
            );
            return dev
                ? {
                      id: dev.id,
                      x: dev.x,
                      y: dev.y,
                      rotation: dev.rotation ?? 0,
                  }
                : null;
        }, [scene, rotateKind, ui.selectedFixtureIds, ui.selectedId]);

        const rotateObjectRadiusPx = useMemo(() => {
            if (!rotateTarget) return 12;
            const origin = { x: rotateTarget.x, y: rotateTarget.y };
            if (rotateKind === 'fixture') {
                const fx = scene?.fixtures.find(
                    (f) => f.id === rotateTarget.id,
                );
                const half = fx?.dimensions
                    ? Math.max(
                          fx.dimensions.length ?? 0.3,
                          fx.dimensions.width ?? 0.3,
                      ) / 2
                    : 0.15;
                return Math.max(8, screenDistance(half, 0, origin));
            }
            return Math.max(8, screenDistance(0.15, 0, origin));
        }, [rotateTarget, rotateKind, scene, screenDistance]);

        /**
         * Guias de alineacion (estilo Figma/DIALux evo) mientras se arrastra UNA
         * luminaria sola: si su x o y coincide (tras el snap de
         * useCanvasInteraction.ts) con la de OTRA luminaria de la escena, se
         * dibuja una linea punteada a lo largo de ese eje compartido. Puramente
         * derivado de `scene.fixtures` + `ui.selectedId` -- no requiere estado
         * imperativo nuevo, el snap ya deja las coordenadas exactamente iguales.
         */
        const fixtureAlignmentGuides = useMemo(() => {
            if (!isDragging || !scene || !ui.selectedId) return null;
            if (ui.selectedFixtureIds.length > 1) return null;
            const dragged = scene.fixtures.find((f) => f.id === ui.selectedId);
            if (!dragged) return null;

            const EPS = 0.005;
            let sameX: number | null = null;
            let sameY: number | null = null;
            for (const other of scene.fixtures) {
                if (other.id === dragged.id) continue;
                if (sameX === null && Math.abs(other.x - dragged.x) < EPS) sameX = other.x;
                if (sameY === null && Math.abs(other.y - dragged.y) < EPS) sameY = other.y;
                if (sameX !== null && sameY !== null) break;
            }
            if (sameX === null && sameY === null) return null;
            return { x: sameX, y: sameY };
        }, [isDragging, scene, ui.selectedId, ui.selectedFixtureIds]);

        const handleRotate = useCallback(
            (id: string, rotationDeg: number) => {
                if (rotateKind === 'fixture')
                    store.updateFixture(id, { rotation: rotationDeg });
                else if (rotateKind === 'switch')
                    store.updateLightSwitch(id, { rotation: rotationDeg });
                else if (rotateKind === 'device')
                    store.updateElectricalDevice(id, { rotation: rotationDeg });
            },
            [rotateKind, store],
        );

        const toLocalPoint = useCallback((clientX: number, clientY: number) => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return { x: clientX, y: clientY };
            return { x: clientX - rect.left, y: clientY - rect.top };
        }, []);

        /**
         * Selección desde los overlays SVG. En modo 'select' el hit-testing
         * determinista del mousedown del canvas decide la selección; el onClick
         * del elemento SVG hijo dispararía DESPUÉS y la sobreescribiría con el
         * contenedor (ej. clic en luminaria → el polígono del recinto la pisaba).
         * Por eso en 'select' los overlays no seleccionan.
         */
        const overlaySelect = useCallback(
            (id: string | null) => {
                if (useEditorStore.getState().ui.activeTool === 'select')
                    return;
                store.setSelectedId(id);
            },
            [store],
        );

        const overlaySelectFixture = useCallback(
            (id: string, multi?: boolean) => {
                if (useEditorStore.getState().ui.activeTool === 'select')
                    return;
                if (multi) store.toggleFixtureSelection(id);
                else store.setSelectedId(id);
            },
            [store],
        );

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

        const restoredSceneRef = useRef<string | null>(null);
        // Identidad del último plano efectivamente cargado en el motor CAD
        // (archivo + escala). Cuando dos pisos comparten el mismo plano, saltar
        // el re-parseo (engine.openFile + parseDxf) es lo que hace que cambiar
        // de piso sea instantáneo en vez de repetir un parseo DXF completo.
        const lastLoadedPlanKeyRef = useRef<string | null>(null);
        useEffect(() => {
            if (!engine.isReady || !projectId || !activeSceneId) return;
            // planReloadTick fuerza a releer el plano aunque el piso activo no
            // haya cambiado (ej. se reutilizó el plano de otro piso para éste).
            const restoreKey = `${projectId}::${activeSceneId}::${ui.planReloadTick}`;
            if (restoredSceneRef.current === restoreKey) return;
            restoredSceneRef.current = restoreKey;

            void (async () => {
                let storedPlan = await loadDialuxPlan(projectId, activeSceneId);
                if (storedPlan) {
                    try {
                        await uploadLocalDialuxPlanIfMissing(
                            projectId,
                            activeSceneId,
                            storedPlan,
                        );
                        markDialuxPlanSyncOk(activeSceneId);
                    } catch (error) {
                        console.warn(
                            'No se pudo migrar el plano local al servidor.',
                            error,
                        );
                        markDialuxPlanSyncFailed(activeSceneId);
                    }
                }
                if (!storedPlan) {
                    try {
                        storedPlan = await loadDialuxPlanFromServer(
                            projectId,
                            activeSceneId,
                        );
                        if (storedPlan) {
                            await saveDialuxPlanFile(
                                projectId,
                                activeSceneId,
                                storedDialuxPlanToFile(storedPlan),
                            );
                        }
                    } catch (error) {
                        console.warn(
                            'No se pudo descargar el plano DIAlux.',
                            error,
                        );
                    }
                }

                if (!storedPlan) {
                    lastLoadedPlanKeyRef.current = null;
                    await engine.newDocument();
                    return;
                }

                const effectiveScale = getEffectiveScale(scene?.scaleConfig);
                const planKey = `${projectId}::${storedPlan.fileName}::${storedPlan.blob.size}::${storedPlan.lastModified}::${effectiveScale}`;
                if (lastLoadedPlanKeyRef.current === planKey) {
                    // Mismo plano (y misma escala) que ya está abierto en el motor
                    // — típicamente al volver a un piso que comparte plano con el
                    // anterior. Evita repetir el parseo DXF completo.
                    return;
                }

                try {
                    const file = storedDialuxPlanToFile(storedPlan);
                    const opened = await engine.openFile(file);
                    if (opened && file.name.toLowerCase().endsWith('.dxf')) {
                        await parseDxf?.(file, effectiveScale);
                    }
                    lastLoadedPlanKeyRef.current = planKey;
                } catch (error) {
                    console.warn(
                        'No se pudo restaurar el plano DIAlux.',
                        error,
                    );
                    lastLoadedPlanKeyRef.current = null;
                }
            })();
        }, [
            activeSceneId,
            engine,
            engine.isReady,
            parseDxf,
            projectId,
            scene?.scaleConfig,
            ui.planReloadTick,
        ]);

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
                className="relative h-full w-full flex-1 overflow-hidden bg-gray-50 dark:bg-[#0d0f14]"
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
                    style={{
                        zIndex: 0,
                        background: '#0d0f14',
                        visibility: ui.electricalLayerVisibility.cad
                            ? 'visible'
                            : 'hidden',
                    }}
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
                        if (isInteractiveMode) {
                            if (ui.activeTool !== 'measure-area')
                                setMeasureAreaFrozen(null);
                            onMouseDown(
                                e,
                                setRoomVertices,
                                setWallPreview,
                                setCanopyPreview,
                                setCalibrationLine,
                                setCalibrationSnapPoint,
                                setMeasureAreaVertices,
                            );
                        }
                    }}
                    onMouseMove={(e) => {
                        if (isInteractiveMode)
                            onMouseMove(
                                e,
                                (pt) => {
                                    if (ui.activeTool === 'measure-area')
                                        setMeasureAreaPreviewPt(pt);
                                    else setRoomPreviewPt(pt);
                                },
                                setWallPreview,
                                setCanopyPreview,
                                setCalibrationLine,
                                setCalibrationSnapPoint,
                                setTempElectricalDevice,
                                setWireReconnectPreview,
                            );
                    }}
                    onMouseUp={(e) => {
                        if (isInteractiveMode)
                            onMouseUp(
                                e,
                                setCanopyPreview,
                                setWireReconnectPreview,
                            );
                    }}
                    onDoubleClick={onDoubleClick}
                >
                    <CanvasSvgDefs />

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

                    {/* ── Pisos fantasma (multi-floor ghost view) ── */}
                    {showAllFloors &&
                        allScenes
                            .filter(
                                (s) =>
                                    s.id !== activeSceneId &&
                                    (s.visible ?? true),
                            )
                            .map((ghostScene) => (
                                <g
                                    key={`ghost-${ghostScene.id}`}
                                    opacity={0.18}
                                >
                                    <OverlayRooms
                                        rooms={ghostScene.rooms ?? []}
                                        selectedId={null}
                                        zoom={zoom}
                                        onSelect={() => undefined}
                                        screenPoint={screenPoint}
                                        screenDistance={screenDistance}
                                    />
                                    <OverlayWalls
                                        walls={ghostScene.walls ?? []}
                                        selectedId={null}
                                        zoom={zoom}
                                        onSelect={() => undefined}
                                        screenPoint={screenPoint}
                                        screenDistance={screenDistance}
                                    />
                                    <OverlayStructuralObstacles
                                        obstacles={ghostScene.structuralObstacles ?? []}
                                        selectedId={null}
                                        zoom={zoom}
                                        onSelect={() => undefined}
                                        screenPoint={screenPoint}
                                    />
                                </g>
                            ))}

                    {/* ── Geometría de la escena activa ── */}
                    <OverlayCanopies
                        canopies={scene?.canopies ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={overlaySelect}
                        screenPoint={screenPoint}
                        screenDistance={screenDistance}
                    />
                    <OverlayPreviews
                        roomVertices={roomVertices}
                        roomPreviewPoint={roomPreviewPt}
                        wallPreview={wallPreview}
                        canopyPreview={canopyPreview}
                        pendingFixtureGridArea={ui.pendingFixtureGridArea}
                        fixtureGridAreaRows={ui.fixtureGridRows}
                        fixtureGridAreaColumns={ui.fixtureGridCols}
                        screenPoint={screenPoint}
                        measureCadDistanceFromScreen={
                            measureCadDistanceFromScreen
                        }
                        angleSnapMode={ui.angleSnapMode}
                        hideLabel={dynInputVisible}
                    />
                    <OverlayRooms
                        rooms={scene?.rooms ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={overlaySelect}
                        screenPoint={screenPoint}
                        screenDistance={screenDistance}
                    />
                    <OverlayWalls
                        walls={scene?.walls ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={overlaySelect}
                        screenPoint={screenPoint}
                        screenDistance={screenDistance}
                    />
                    <OverlayStructuralObstacles
                        obstacles={scene?.structuralObstacles ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={overlaySelect}
                        screenPoint={screenPoint}
                    />
                    <OverlayWindows
                        windows={scene?.windows ?? []}
                        walls={scene?.walls ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={overlaySelect}
                        screenPoint={screenPoint}
                    />
                    <OverlayDoors
                        doors={scene?.doors ?? []}
                        walls={scene?.walls ?? []}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={overlaySelect}
                        screenPoint={screenPoint}
                    />
                    <OverlayPartitions
                        partitions={scene?.partitions ?? []}
                        scaleX={(x) => screenPoint({ x, y: 0 }).x}
                        scaleY={(y) => screenPoint({ x: 0, y }).y}
                        selectedId={ui.selectedId}
                        onSelect={overlaySelect}
                        opacity={1}
                    />
                    <OverlayFixtures
                        fixtures={
                            ui.electricalLayerVisibility.fixtures
                                ? (scene?.fixtures ?? []).filter(
                                      (item) =>
                                          !ui.hiddenElectricalIds.includes(
                                              item.id,
                                          ),
                                  )
                                : []
                        }
                        selectedFixtureIds={ui.selectedFixtureIds ?? []}
                        zoom={zoom}
                        onSelect={overlaySelectFixture}
                        screenPoint={screenPoint}
                        screenDistance={screenDistance}
                    />
                    <OverlayWires
                        conductors={(scene?.conductors ?? []).filter((item) => {
                            if (ui.hiddenElectricalIds.includes(item.id))
                                return false;
                            const layer = classifyConductorLayer(
                                item,
                                scene?.fixtures ?? [],
                                scene?.lightSwitches ?? [],
                                scene?.electricalDevices ?? [],
                            );
                            return ui.electricalLayerVisibility[layer];
                        })}
                        lightSwitches={scene?.lightSwitches ?? []}
                        fixtures={scene?.fixtures ?? []}
                        electricalDevices={scene?.electricalDevices ?? []}
                        zoom={zoom}
                        screenPoint={screenPoint}
                        selectedId={ui.selectedId}
                        selectedConductorIds={selectedCircuitConductorIds}
                        onSelect={overlaySelect}
                        activeTool={ui.activeTool}
                        showLegacyLightingWires={
                            ui.electricalLayerVisibility.fixtures
                        }
                        reconnectPreview={wireReconnectPreview}
                    />
                    <OverlayLightSwitches
                        lightSwitches={
                            ui.electricalLayerVisibility.switches
                                ? (scene?.lightSwitches ?? []).filter(
                                      (item) =>
                                          !ui.hiddenElectricalIds.includes(
                                              item.id,
                                          ),
                                  )
                                : []
                        }
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={overlaySelect}
                        screenPoint={screenPoint}
                        screenDistance={screenDistance}
                    />
                    <OverlayElectricalDevices
                        devices={(tempElectricalDevice
                            ? [
                                  ...(scene?.electricalDevices ?? []),
                                  {
                                      ...tempElectricalDevice,
                                      id: 'temp-preview',
                                  } as any,
                              ]
                            : (scene?.electricalDevices ?? [])
                        ).filter((item) => {
                            if (ui.hiddenElectricalIds.includes(item.id))
                                return false;
                            const isOutlet = item.type.startsWith('outlet_');
                            return isOutlet
                                ? ui.electricalLayerVisibility.outlets
                                : ui.electricalLayerVisibility.panels;
                        })}
                        selectedId={ui.selectedId}
                        zoom={zoom}
                        onSelect={overlaySelect}
                        screenPoint={screenPoint}
                        screenDistance={screenDistance}
                    />
                    <CalibrationOverlay
                        line={visibleCalibrationLine}
                        snapPoint={visibleCalibrationSnapPoint}
                        screenPoint={screenPoint}
                        label={
                            pendingCalibration
                                ? // Mostrar distancia CAD nativa + ayuda para el usuario
                                  `${pendingCalibration.cadDistance.toFixed(4)} ud CAD → ingresa la medida real`
                                : ui.activeTool === 'calibrate' &&
                                    visibleCalibrationLine
                                  ? 'Selecciona el segundo punto (Shift = ortogonal)'
                                  : null
                        }
                    />
                    <OverlayMeasureArea
                        vertices={
                            measureAreaVertices.length > 0
                                ? measureAreaVertices
                                : (measureAreaFrozen ?? [])
                        }
                        previewPoint={measureAreaPreviewPt}
                        isClosed={
                            measureAreaFrozen !== null &&
                            measureAreaVertices.length === 0
                        }
                        screenPoint={screenPoint}
                        zoom={zoom}
                    />
                    <OverlayMeasureDistance
                        measurement={distanceMeasurement}
                        isFinal={isDistanceMeasurementFinal}
                        isCalibrated={scaleConfig.isCalibrated}
                        screenPoint={screenPoint}
                    />
                    <OverlayRotateHandle
                        target={rotateTarget}
                        objectRadiusPx={rotateObjectRadiusPx}
                        screenPoint={screenPoint}
                        toLocalPoint={toLocalPoint}
                        onRotate={handleRotate}
                    />
                    {ui.fixtureGridGuideEditor &&
                        scene?.rooms.some((r) => r.id === ui.fixtureGridGuideEditor?.roomId) && (
                            <OverlayFixtureGridGuides
                                editor={ui.fixtureGridGuideEditor}
                                screenPoint={screenPoint}
                                worldPoint={worldPoint}
                                toLocalPoint={toLocalPoint}
                                onDragGuide={(axis, index, value) =>
                                    store.setFixtureGridGuide(axis, index, value)
                                }
                            />
                        )}
                    {fixtureAlignmentGuides && (
                        <g className="overlay-fixture-alignment-guides" style={{ pointerEvents: 'none' }}>
                            {fixtureAlignmentGuides.x !== null && (() => {
                                const p1 = screenPoint({ x: fixtureAlignmentGuides.x, y: -500 });
                                const p2 = screenPoint({ x: fixtureAlignmentGuides.x, y: 500 });
                                return (
                                    <line
                                        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                        stroke="#ec4899" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.9}
                                    />
                                );
                            })()}
                            {fixtureAlignmentGuides.y !== null && (() => {
                                const p1 = screenPoint({ x: -500, y: fixtureAlignmentGuides.y });
                                const p2 = screenPoint({ x: 500, y: fixtureAlignmentGuides.y });
                                return (
                                    <line
                                        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                        stroke="#ec4899" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.9}
                                    />
                                );
                            })()}
                        </g>
                    )}
                </svg>

                <DynamicInputOverlay
                    visible={dynInputVisible}
                    anchorScreen={dynInputPreviewScreen}
                    liveDistanceM={dynInputLiveDistanceM}
                    liveAngleDeg={dynInputLiveAngleDeg}
                    onCommit={handleDynamicInputCommit}
                />

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
                        store.applyCalibration(
                            pendingCalibration?.cadDistance ?? 0,
                            realDistanceMeters,
                        );

                        setPendingCalibration(null);
                        setCalibrationLine(null);
                        setCalibrationSnapPoint(null);
                        store.setTool('select');
                    }}
                />

                <CadStatusOverlays
                    isLoading={engine.isLoading}
                    loadProgress={engine.loadProgress}
                    fileName={engine.fileName}
                    error={engine.error}
                    activeDoc={engine.activeDoc}
                    onFitToView={() => engine.fitToView()}
                    isCalibrated={scaleConfig.isCalibrated}
                    calibrationFactor={scaleConfig.calibrationFactor}
                />
            </div>
        );
    },
);
