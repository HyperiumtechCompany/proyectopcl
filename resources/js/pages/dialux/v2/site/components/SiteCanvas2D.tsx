import {
    useEffect,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
} from 'react';
import { createCanvasTransforms } from '@/pages/dialux/geometry/coordinateTransform';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { ModuleLoadingOverlay } from '../../components/ModuleLoadingOverlay';
import { bowedPoint, bowedSegmentPoints } from '../domain/cableBow';
import { cableWaypointElevations } from '../domain/cableElevation';
import { courtLines } from '../domain/courtLayout';
import { deriveFeederStatus, feederStatusColor } from '../domain/feederSync';
import {
    accessLaneRect,
    boothRect,
    gateAccess,
    gateEntrance,
    gateSpanM,
    isSpanGate,
} from '../domain/gateLayout';
import { snapToGrid } from '../domain/geometry';
import {
    elementBox,
    fitRampToElement,
    stairRunDirection,
} from '../domain/layoutFit';
import { checkLevelLink } from '../domain/levelLink';
import {
    pointElementMinimumPx,
    pointElementPlanDimensions,
    pointElementVisibilityFactor,
} from '../domain/pointElementDimensions';
import {
    buildStraightRampLayout,
    stairAsRampConfig,
} from '../domain/rampLayout';
import { stairStepCount } from '../domain/siteNorms';
import {
    elementElevationRange,
    elevationColor,
} from '../domain/terrainSurface';
import {
    tgDimensions,
    tgFootprintVertices,
    tgOutputAnchorLocal,
} from '../domain/tgPanel';
import type { Point2D, SiteData, SiteElement } from '../domain/types';
import { resolveWireEndpoints } from '../domain/wireAnchors';
import { useSiteCadPlan } from '../hooks/useSiteCadPlan';
import { CIRCUIT_COMMIT_SNAP_M } from '../hooks/useSiteEditor';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import {
    useSiteLightingStore,
    type SiteLightingCalculationState,
} from '../hooks/useSiteLightingCalculation';
import { SITE_ELEMENT_DEFAULTS } from '../lib/siteDefaults';
import { buildSiteLoadingStages } from '../lib/siteLoadingStages';
import {
    ProjectionPreviewLayer,
    SiteAttachedLightsLayer,
} from './SiteAttachedLightsLayer';
import { AutoCircuitPreviewLayer } from './SiteAutoCircuitPanel';
import {
    POINT_ELEMENT_TYPES,
    pointSymbolIntrinsicSize,
    SiteElementSymbol,
} from './SiteElementSymbol';
import { IsoluxLayer } from './SiteIsoluxLayer';

interface Props {
    /** Resultado del botón "Calcular alumbrado" (falsos colores sobre la planta). */
    lighting?: SiteLightingCalculationState;
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
export function SiteCanvas2D({ editor, isActive = true, lighting }: Props) {
    const { siteData } = editor;
    const {
        containerRef: cadContainerRef,
        status: cadStatus,
        phase: cadPhase,
        fileBytes: cadFileBytes,
        deferredBytes,
        loadVector,
        abandonVector,
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
    const projectionPreview = useSiteLightingStore(
        (state) => state.projectionPreview,
    );
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
              groupOrigins: Record<string, Point2D[]>;
              /** Posición en pantalla al pulsar: no se mueve nada hasta pasar el umbral (evita moverlo por un clic tembloroso). */
              startClient: { x: number; y: number };
              started: boolean;
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
    /**
     * Arrastre directo de un cable YA seleccionado, desde su propio dibujo:
     * 'arc' = tira del asa a la mitad de un tramo arqueado para ajustar lado
     * y separación del arco; 'endpoint' = tira de un extremo para engancharlo
     * a OTRO artefacto (cambia `sourceId`/`targetId` del circuito).
     */
    const wireDragRef = useRef<
        | {
              pointerId: number;
              kind: 'circuit' | 'feeder';
              id: string;
              mode: 'arc';
              segA: Point2D;
              segB: Point2D;
              bowMode: 'aerial' | 'underground';
          }
        | {
              pointerId: number;
              kind: 'circuit';
              id: string;
              mode: 'endpoint';
              endpoint: 'source' | 'target';
              otherId: string;
          }
        | undefined
    >(undefined);
    /** Posición en vivo (y artefacto bajo el cursor) mientras se arrastra un extremo de cable — solo para pintar, se confirma al soltar. */
    const [wireEndpointDrag, setWireEndpointDrag] = useState<{
        id: string;
        endpoint: 'source' | 'target';
        point: Point2D;
        hoverId: string | null;
    } | null>(null);
    const refitStampRef = useRef<number | null>(null);
    /** Selección por recuadro (Mayús/Ctrl + arrastrar sobre el fondo). Coordenadas en px del contenedor. */
    const marqueeRef = useRef<
        { pointerId: number; x0: number; y0: number } | undefined
    >(undefined);
    const [marquee, setMarquee] = useState<{
        x0: number;
        y0: number;
        x1: number;
        y1: number;
    } | null>(null);
    /** Un arrastre (vértice, objeto, giro, plano) = UN paso de Ctrl+Z, no uno por cada movimiento del puntero. */
    const gestureOpenRef = useRef(false);
    const beginDragGesture = () => {
        if (gestureOpenRef.current) return;
        gestureOpenRef.current = true;
        useEditorStore.getState().beginHistoryGesture();
    };
    const endDragGesture = () => {
        if (!gestureOpenRef.current) return;
        gestureOpenRef.current = false;
        useEditorStore.getState().endHistoryGesture();
    };
    useEffect(
        () => () => {
            // Si el editor se desmonta a mitad de un arrastre, no dejar el gesto abierto (bloquearía el historial).

            if (gestureOpenRef.current) {
                gestureOpenRef.current = false;
                useEditorStore.getState().endHistoryGesture();
            }
        },
        [],
    );

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
    // El encuadre inicial ajusta al plano importado (si hay): sus coordenadas
    // no tienen por qué caber en el lienzo por defecto de 2000×1200 — sin
    // esto el emplazamiento salía diminuto en una esquina (sin plano CAD
    // vivo, p. ej. mientras se abre o si es demasiado pesado).
    const plan = editor.importedPlan;
    const fitW = plan ? plan.widthUnits : baseWidth;
    const fitH = plan ? plan.heightUnits : baseHeight;
    const fitX = plan ? plan.x : 0;
    const fitY = plan ? plan.y : 0;
    const fb: FallbackView =
        fallbackView ??
        (size.w > 0 && fitW > 0 && fitH > 0
            ? (() => {
                  const s =
                      Math.min(
                          size.w / fitW,
                          size.h / fitH,
                          plan ? Infinity : 1,
                      ) * 0.9 || 0.5;
                  return {
                      scale: s,
                      tx: (size.w - fitW * s) / 2 - fitX * s,
                      ty: (size.h - fitH * s) / 2 - fitY * s,
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
    const screenToWorld = (screen: Point2D): Point2D => {
        if (baseT) {
            const world = baseT.screenToScene(screen);
            return { x: world.x, y: -world.y };
        }
        return {
            x: (screen.x - fb.tx) / fb.scale,
            y: (screen.y - fb.ty) / fb.scale,
        };
    };
    const scaleReference = toScreen({ x: 0, y: 0 });
    const oneMeterPlan = 1 / Math.max(editor.terrainScaleM, 1e-9);
    const pixelsPerMeterX = Math.hypot(
        toScreen({ x: oneMeterPlan, y: 0 }).x - scaleReference.x,
        toScreen({ x: oneMeterPlan, y: 0 }).y - scaleReference.y,
    );
    const pixelsPerMeterY = Math.hypot(
        toScreen({ x: 0, y: oneMeterPlan }).x - scaleReference.x,
        toScreen({ x: 0, y: oneMeterPlan }).y - scaleReference.y,
    );

    const pointSymbolScale = (element: SiteElement) => {
        const dimensions = pointElementPlanDimensions(element);
        const intrinsic = pointSymbolIntrinsicSize(
            element.type,
            element.config,
        );
        const widthPx = dimensions.widthM * pixelsPerMeterX;
        const depthPx = dimensions.depthM * pixelsPerMeterY;
        return {
            scaleX: widthPx / intrinsic.width,
            scaleY: depthPx / intrinsic.height,
            widthPx,
            depthPx,
        };
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
            <div className="relative h-full">
                <ModuleLoadingOverlay
                    title="Cargando emplazamiento"
                    stages={[
                        {
                            id: 'site',
                            label: 'Objetos del emplazamiento',
                            status: 'active',
                        },
                    ]}
                />
            </div>
        );
    }

    // Solo si hay plano importado: sin plano, la búsqueda del archivo es
    // instantánea y el overlay solo parpadearía.
    const cadLoadingStages =
        cadPhase && editor.importedPlan
            ? buildSiteLoadingStages({
                  elementCount: siteData.elements.length,
                  networkLoading: editor.networkEdgesLoading,
                  cadPhase,
                  cadFileBytes,
              })
            : null;

    const isDrawTool =
        editor.activeTool === 'draw_polygon' ||
        editor.activeTool === 'draw_feeder' ||
        editor.activeTool === 'draw_circuit' ||
        editor.activeTool === 'draw_contour';
    // `place_tg` es la herramienta genérica de "colocar equipo puntual con un
    // clic" — el tipo exacto lo decide `pendingType`.
    const isPointTool =
        editor.activeTool === 'place_tg' || editor.activeTool === 'place_spot';
    const isCalibrateTool = editor.activeTool === 'calibrate_plan';
    const drawingFeeder = editor.activeTool === 'draw_feeder';
    const drawingCircuit = editor.activeTool === 'draw_circuit';
    const toolPlaces = isDrawTool || isPointTool || isCalibrateTool;

    // Para que un cable "siga" al artefacto anclado cuando se mueve
    // (resolveWireEndpoints necesita poder buscar el objeto vivo por id).
    const elementById = new Map(siteData.elements.map((el) => [el.id, el]));

    /** Punto exacto del círculo del borne del símbolo TG, convertido de px a mundo solo para el dibujo 2D. */
    const tgOutputVisualWorld = (
        element: SiteElement,
        outputId: string | undefined,
    ): Point2D => {
        const center = toScreen(
            elementBox(element, editor.terrainScaleM).center,
        );
        const anchor = tgOutputAnchorLocal(
            element.config?.kind === 'tg' ? element.config.outputs : undefined,
            outputId,
        );
        const symbolScale = pointSymbolScale(element);
        const radians = ((element.rotation ?? 0) * Math.PI) / 180;
        return screenToWorld({
            x:
                center.x +
                anchor.x * symbolScale.scaleX * Math.cos(radians) -
                anchor.y * symbolScale.scaleY * Math.sin(radians),
            y:
                center.y +
                anchor.x * symbolScale.scaleX * Math.sin(radians) +
                anchor.y * symbolScale.scaleY * Math.cos(radians),
        });
    };

    const pendingSource = editor.pendingCircuitSourceId
        ? elementById.get(editor.pendingCircuitSourceId)
        : undefined;
    const pendingRenderVertices =
        drawingCircuit &&
        pendingSource?.type === 'tg_location' &&
        editor.pendingVertices.length > 0
            ? [
                  tgOutputVisualWorld(
                      pendingSource,
                      editor.pendingCircuitTgOutputId ?? undefined,
                  ),
                  ...editor.pendingVertices.slice(1),
              ]
            : editor.pendingVertices;
    const pendingContinuationCircuit = editor.pendingCircuitContinuationIds[0]
        ? (siteData.circuits ?? []).find(
              (circuit) =>
                  circuit.id === editor.pendingCircuitContinuationIds[0],
          )
        : undefined;
    const pendingContinuationTg = pendingContinuationCircuit
        ? [
              elementById.get(pendingContinuationCircuit.sourceId),
              elementById.get(pendingContinuationCircuit.targetId),
          ].find((element) => element?.type === 'tg_location')
        : undefined;
    const pendingCircuitColor = pendingContinuationTg
        ? tgOutputAnchorLocal(
              pendingContinuationTg.config?.kind === 'tg'
                  ? pendingContinuationTg.config.outputs
                  : undefined,
              pendingContinuationCircuit?.tgOutputId,
          ).output.color
        : pendingSource?.type === 'tg_location'
          ? tgOutputAnchorLocal(
                pendingSource.config?.kind === 'tg'
                    ? pendingSource.config.outputs
                    : undefined,
                editor.pendingCircuitTgOutputId ?? undefined,
            ).output.color
          : '#10b981';

    const lastPending =
        editor.pendingVertices[editor.pendingVertices.length - 1];
    // Guía del cableado: mientras se traza, si el cursor está cerca de OTRO
    // artefacto elegible (distinto del de inicio), el hilo de arrastre se
    // ancla YA a su centro exacto. El clic lo agrega al mismo recorrido; el
    // circuito solo se cierra con doble clic o Enter sobre el último objeto.
    const circuitAnchorHover =
        drawingCircuit && drawCursor
            ? editor.nearestCircuitAnchor(drawCursor, CIRCUIT_COMMIT_SNAP_M)
            : null;
    const circuitAnchorHoverValid =
        circuitAnchorHover &&
        circuitAnchorHover.id !== editor.pendingCircuitSourceId
            ? circuitAnchorHover
            : null;
    const rubberTarget =
        isDrawTool && drawCursor && lastPending
            ? circuitAnchorHoverValid
                ? circuitAnchorHoverValid.point
                : snapWorld(drawCursor)
            : null;

    const handleWorldClick = (world: Point2D, rightClick = false) => {
        if (drawingFeeder) {
            // Cableado: clic = por el AIRE (postes), clic derecho = por el SUELO (zanja).
            editor.addFeederVertex(
                snapWorld(world),
                rightClick ? 'underground' : 'aerial',
            );
            return;
        }
        if (drawingCircuit) {
            // Instalación local: mismo clic = aéreo / clic derecho = subterráneo, pero engancha
            // extremos a artefactos en vez de trazar unidades sueltas.
            editor.addCircuitVertex(
                snapWorld(world),
                rightClick ? 'underground' : 'aerial',
            );
            return;
        }
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

    /**
     * `d` de un tramo A→B para dibujarlo: con modo (aéreo/subterráneo) sale
     * arqueado según la convención de `cableBow` (subterráneo a la derecha,
     * aéreo a la izquierda del sentido de avance); sin modo (tendido "plano",
     * sin definir) sale recto, como antes.
     */
    const wireSegmentPath = (
        a: Point2D,
        b: Point2D,
        mode: 'aerial' | 'underground' | undefined,
        curveSide?: 'auto' | 'left' | 'right' | 'straight',
        curveOffsetM?: number,
    ): string => {
        const plan = mode
            ? bowedSegmentPoints(
                  a,
                  b,
                  editor.terrainScaleM,
                  mode,
                  10,
                  curveSide,
                  curveOffsetM,
              )
            : [a, b];
        return plan
            .map((p, i) => {
                const s = toScreen(p);
                return `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
            })
            .join(' ');
    };

    /**
     * Zona de clic del tramo, RECORTADA cerca de los extremos que tocan un
     * artefacto real (`trimStart`/`trimEnd` — no los puntos de ruteo
     * intermedios entre dos artefactos). Sin esto, el clic para arrastrar el
     * TG/TD/celda con un cable enganchado caía sobre esta franja invisible
     * del cable en vez de sobre el propio símbolo (el cable se dibuja
     * DESPUÉS de los elementos, así que gana el hit-test) — así el símbolo
     * sigue siendo agarrable justo donde el cable lo toca.
     */
    const wireHitPath = (
        a: Point2D,
        b: Point2D,
        mode: 'aerial' | 'underground' | undefined,
        curveSide: 'auto' | 'left' | 'right' | 'straight' | undefined,
        curveOffsetM: number | undefined,
        trimStart: boolean,
        trimEnd: boolean,
    ): string => {
        const lenM = Math.hypot(b.x - a.x, b.y - a.y) * editor.terrainScaleM;
        const marginT = lenM > 0 ? Math.min(0.4, 0.6 / lenM) : 0;
        const t0 = trimStart ? marginT : 0;
        const t1 = trimEnd ? 1 - marginT : 1;
        if (t1 <= t0) return '';
        const steps = 8;
        const pts: Point2D[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = t0 + ((t1 - t0) * i) / steps;
            pts.push(
                mode
                    ? bowedPoint(
                          a,
                          b,
                          editor.terrainScaleM,
                          mode,
                          t,
                          curveSide,
                          curveOffsetM,
                      )
                    : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
            );
        }
        return pts
            .map((p, i) => {
                const s = toScreen(p);
                return `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
            })
            .join(' ');
    };

    // Con un levantamiento grande, ocultar las etiquetas de cota de los puntos
    // (se ven al seleccionar) para no repintar cientos de <text> por frame.
    const manySpots =
        siteData.elements.reduce(
            (n, e) => (e.type === 'spot_elevation' ? n + 1 : n),
            0,
        ) > 120;

    // Rango de cotas de todos los elementos — colorea las "Plataformas de
    // terreno" según su cota, ya que su color de relleno es fijo por
    // defecto y de otro modo se ven todas iguales sin importar la cota.
    const platformElevationRange = elementElevationRange(siteData.elements);

    const legacyPlan =
        !cadPlanActive && siteData.importedPlan?.visible
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
                    if (
                        event.button === 0 &&
                        !toolPlaces &&
                        (event.shiftKey || event.ctrlKey || event.metaKey)
                    ) {
                        const r = wrapRef.current?.getBoundingClientRect();
                        const x = event.clientX - (r?.left ?? 0);
                        const y = event.clientY - (r?.top ?? 0);
                        event.currentTarget.setPointerCapture(event.pointerId);
                        marqueeRef.current = {
                            pointerId: event.pointerId,
                            x0: x,
                            y0: y,
                        };
                        setMarquee({ x0: x, y0: y, x1: x, y1: y });
                        return;
                    }
                    if (event.button === 0 && toolPlaces) {
                        handleWorldClick(toWorld(event.clientX, event.clientY));
                        return;
                    }
                    if (
                        event.button === 2 &&
                        (drawingFeeder || drawingCircuit)
                    ) {
                        handleWorldClick(
                            toWorld(event.clientX, event.clientY),
                            true,
                        );
                        return;
                    }
                    if (event.button === 0 || panButton) startPan(event);
                }}
                onDoubleClick={() => {
                    if (isDrawTool) editor.finishDrawing();
                }}
                onPointerMove={(event) => {
                    const mq = marqueeRef.current;
                    if (mq && mq.pointerId === event.pointerId) {
                        const r = wrapRef.current?.getBoundingClientRect();
                        setMarquee({
                            x0: mq.x0,
                            y0: mq.y0,
                            x1: event.clientX - (r?.left ?? 0),
                            y1: event.clientY - (r?.top ?? 0),
                        });
                        return;
                    }
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

                    const wDrag = wireDragRef.current;
                    if (wDrag && wDrag.pointerId === event.pointerId) {
                        const world = toWorld(event.clientX, event.clientY);
                        if (wDrag.mode === 'arc') {
                            const { segA, segB } = wDrag;
                            const dx = segB.x - segA.x;
                            const dy = segB.y - segA.y;
                            const lenPlan = Math.hypot(dx, dy);
                            if (lenPlan > 1e-6) {
                                const px = -(dy / lenPlan);
                                const py = dx / lenPlan;
                                const midX = (segA.x + segB.x) / 2;
                                const midY = (segA.y + segB.y) / 2;
                                const perpDistPlan =
                                    (world.x - midX) * px +
                                    (world.y - midY) * py;
                                const offsetM = Math.min(
                                    10,
                                    Math.max(
                                        0.05,
                                        Math.abs(perpDistPlan) *
                                            editor.terrainScaleM,
                                    ),
                                );
                                const side: 'left' | 'right' =
                                    perpDistPlan >= 0 ? 'right' : 'left';
                                if (wDrag.kind === 'circuit') {
                                    const circuit = siteData.circuits?.find(
                                        (c) => c.id === wDrag.id,
                                    );
                                    if (circuit?.route) {
                                        editor.setSiteCircuitRoute(
                                            wDrag.id,
                                            {
                                                ...circuit.route,
                                                curveSide: side,
                                                curveOffsetM: offsetM,
                                            },
                                            circuit.segmentModes,
                                        );
                                    }
                                } else {
                                    const path = siteData.feederPaths.find(
                                        (p) => p.id === wDrag.id,
                                    );
                                    if (path?.route) {
                                        useEditorStore
                                            .getState()
                                            .setFeederRoute(
                                                wDrag.id,
                                                {
                                                    ...path.route,
                                                    curveSide: side,
                                                    curveOffsetM: offsetM,
                                                },
                                                path.segmentModes,
                                            );
                                    }
                                }
                            }
                            return;
                        }
                        // 'endpoint': solo se previsualiza mientras se
                        // arrastra — el cambio de artefacto se confirma al
                        // soltar (onPointerUp), no en cada movimiento.
                        const hover = editor.nearestCircuitAnchor(
                            world,
                            CIRCUIT_COMMIT_SNAP_M,
                        );
                        const hoverId =
                            hover && hover.id !== wDrag.otherId
                                ? hover.id
                                : null;
                        setWireEndpointDrag({
                            id: wDrag.id,
                            endpoint: wDrag.endpoint,
                            point: hoverId && hover ? hover.point : world,
                            hoverId,
                        });
                        return;
                    }

                    const vDrag = vertexDragRef.current;
                    if (vDrag && vDrag.pointerId === event.pointerId) {
                        editor.moveSiteVertexGuarded(
                            vDrag.elementId,
                            vDrag.vertexIndex,
                            snapWorld(toWorld(event.clientX, event.clientY)),
                        );
                        return;
                    }

                    const eDrag = dragRef.current;
                    if (eDrag && eDrag.pointerId === event.pointerId) {
                        if (!eDrag.started) {
                            const moved = Math.hypot(
                                event.clientX - eDrag.startClient.x,
                                event.clientY - eDrag.startClient.y,
                            );
                            if (moved < 5) return;
                            eDrag.started = true;
                        }
                        const now = toWorld(event.clientX, event.clientY);
                        const dx = now.x - eDrag.startWorld.x;
                        const dy = now.y - eDrag.startWorld.y;
                        editor.moveSiteElementsGuarded(
                            eDrag.groupOrigins,
                            dx,
                            dy,
                        );
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
                    endDragGesture();
                    const mqUp = marqueeRef.current;
                    if (mqUp && mqUp.pointerId === event.pointerId) {
                        const r = wrapRef.current?.getBoundingClientRect();
                        const x = event.clientX - (r?.left ?? 0);
                        const y = event.clientY - (r?.top ?? 0);
                        const c1 = toWorld(
                            (r?.left ?? 0) + Math.min(mqUp.x0, x),
                            (r?.top ?? 0) + Math.min(mqUp.y0, y),
                        );
                        const c2 = toWorld(
                            (r?.left ?? 0) + Math.max(mqUp.x0, x),
                            (r?.top ?? 0) + Math.max(mqUp.y0, y),
                        );
                        const minX = Math.min(c1.x, c2.x);
                        const maxX = Math.max(c1.x, c2.x);
                        const minY = Math.min(c1.y, c2.y);
                        const maxY = Math.max(c1.y, c2.y);
                        const tiny =
                            Math.abs(x - mqUp.x0) < 4 &&
                            Math.abs(y - mqUp.y0) < 4;
                        if (!tiny) {
                            editor.selectElements(
                                siteData.elements
                                    .filter((el) => {
                                        if (
                                            el.visible === false ||
                                            editor.isFrozen(el) ||
                                            !isLayerVisible(siteData, el)
                                        ) {
                                            return false;
                                        }
                                        const xs = el.vertices.map((v) => v.x);
                                        const ys = el.vertices.map((v) => v.y);
                                        return (
                                            Math.min(...xs) <= maxX &&
                                            Math.max(...xs) >= minX &&
                                            Math.min(...ys) <= maxY &&
                                            Math.max(...ys) >= minY
                                        );
                                    })
                                    .map((el) => el.id),
                            );
                        }
                        try {
                            event.currentTarget.releasePointerCapture(
                                event.pointerId,
                            );
                        } catch {
                            /* noop */
                        }
                        marqueeRef.current = undefined;
                        setMarquee(null);
                        return;
                    }
                    if (rotateDragRef.current?.pointerId === event.pointerId) {
                        rotateDragRef.current = undefined;
                        return;
                    }
                    if (wireDragRef.current?.pointerId === event.pointerId) {
                        const w = wireDragRef.current;
                        wireDragRef.current = undefined;
                        if (w.mode === 'endpoint') {
                            const drag = wireEndpointDrag;
                            setWireEndpointDrag(null);
                            if (drag?.hoverId) {
                                if (w.endpoint === 'source') {
                                    editor.updateSiteCircuit(w.id, {
                                        sourceId: drag.hoverId,
                                    });
                                } else {
                                    editor.updateSiteCircuit(w.id, {
                                        targetId: drag.hoverId,
                                    });
                                }
                            }
                        }
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
                    endDragGesture();
                    marqueeRef.current = undefined;
                    setMarquee(null);
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
                            beginDragGesture();
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
                    // El SVG dibuja en orden de array (lo último dibujado
                    // queda arriba) — sin esto, un objeto seleccionado creado
                    // temprano podía quedar tapado por otros dibujados
                    // después. El seleccionado siempre va al final, sin tocar
                    // el orden relativo del resto.
                    .sort((a, b) => {
                        const sa = editor.selectedElementIds.includes(a.id);
                        const sb = editor.selectedElementIds.includes(b.id);
                        return sa === sb ? 0 : sa ? 1 : -1;
                    })
                    .map((element) => {
                        const selected = editor.selectedElementIds.includes(
                            element.id,
                        );
                        // Con varios seleccionados no hay vértices ni giro (se mueven en bloque).
                        const selectedSingle =
                            selected && editor.selectedElementIds.length === 1;
                        const centroid = element.vertices.reduce(
                            (acc, v) => ({
                                x: acc.x + v.x / element.vertices.length,
                                y: acc.y + v.y / element.vertices.length,
                            }),
                            { x: 0, y: 0 },
                        );
                        const labelPos = toScreen(centroid);
                        const screenVertices = element.vertices.map(toScreen);
                        const screenWidth =
                            Math.max(
                                ...screenVertices.map((point) => point.x),
                            ) -
                            Math.min(...screenVertices.map((point) => point.x));
                        const screenHeight =
                            Math.max(
                                ...screenVertices.map((point) => point.y),
                            ) -
                            Math.min(...screenVertices.map((point) => point.y));
                        const showShapeLabel =
                            selected ||
                            Math.max(screenWidth, screenHeight) >= 45;
                        const canDrag =
                            editor.activeTool === 'select' &&
                            !editor.isFrozen(element);
                        const startElementDrag = (
                            event: ReactPointerEvent<SVGElement>,
                        ) => {
                            if (!canDrag) return;
                            event.stopPropagation();
                            // Mayús / Ctrl + clic: agrega o quita del grupo, sin arrastrar.
                            if (
                                event.shiftKey ||
                                event.ctrlKey ||
                                event.metaKey
                            ) {
                                editor.toggleElementSelection(element.id);
                                return;
                            }
                            // Si ya forma parte de un grupo, se arrastra TODO el grupo.
                            const inGroup =
                                selected &&
                                editor.selectedElementIds.length > 1;
                            if (!inGroup) editor.selectElement(element.id);
                            event.currentTarget.ownerSVGElement?.setPointerCapture(
                                event.pointerId,
                            );
                            beginDragGesture();
                            const movingIds = inGroup
                                ? editor.selectedElementIds
                                : [element.id];
                            const groupOrigins: Record<string, Point2D[]> = {};
                            for (const item of siteData.elements) {
                                if (
                                    movingIds.includes(item.id) &&
                                    !editor.isFrozen(item)
                                ) {
                                    groupOrigins[item.id] = item.vertices;
                                }
                            }
                            dragRef.current = {
                                elementId: element.id,
                                pointerId: event.pointerId,
                                startWorld: toWorld(
                                    event.clientX,
                                    event.clientY,
                                ),
                                originVertices: element.vertices,
                                groupOrigins,
                                startClient: {
                                    x: event.clientX,
                                    y: event.clientY,
                                },
                                started: false,
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

                        if (
                            POINT_ELEMENT_TYPES.has(element.type) &&
                            !isSpanGate(element)
                        ) {
                            const rot = element.rotation ?? 0;
                            const showRotate = selectedSingle && canDrag;
                            const tgConfig =
                                element.type === 'tg_location' &&
                                element.config?.kind === 'tg'
                                    ? element.config
                                    : undefined;
                            const tgFootprint =
                                element.type === 'tg_location'
                                    ? tgFootprintVertices(
                                          centroid,
                                          tgConfig,
                                          editor.terrainScaleM,
                                          rot,
                                      )
                                    : undefined;
                            const tgSize =
                                element.type === 'tg_location'
                                    ? tgDimensions(tgConfig)
                                    : undefined;
                            const symbolScale = pointSymbolScale(element);
                            const visibilityFactor =
                                element.type === 'tg_location'
                                    ? 1
                                    : pointElementVisibilityFactor(
                                          symbolScale.widthPx,
                                          symbolScale.depthPx,
                                          selected,
                                          pointElementMinimumPx(element.type),
                                      );
                            const displaySymbolScale = {
                                scaleX: symbolScale.scaleX * visibilityFactor,
                                scaleY: symbolScale.scaleY * visibilityFactor,
                                widthPx: symbolScale.widthPx * visibilityFactor,
                                depthPx: symbolScale.depthPx * visibilityFactor,
                            };
                            const showPointLabel =
                                selected ||
                                Math.max(
                                    symbolScale.widthPx,
                                    symbolScale.depthPx,
                                ) >= 10;
                            const rotateHandleDistance = Math.max(
                                18,
                                Math.max(
                                    displaySymbolScale.widthPx,
                                    displaySymbolScale.depthPx,
                                ) /
                                    2 +
                                    14,
                            );
                            return (
                                <g key={element.id}>
                                    {tgFootprint && (
                                        <polygon
                                            points={points(tgFootprint)}
                                            fill={element.style.fillColor}
                                            fillOpacity={0.12}
                                            stroke={
                                                selected
                                                    ? '#f59e0b'
                                                    : element.style.strokeColor
                                            }
                                            strokeWidth={selected ? 2 : 1.2}
                                            strokeDasharray="4 2"
                                            style={{ pointerEvents: 'none' }}
                                        />
                                    )}
                                    <SiteElementSymbol
                                        type={element.type}
                                        cx={labelPos.x}
                                        cy={labelPos.y}
                                        rotationDeg={rot}
                                        scaleX={displaySymbolScale.scaleX}
                                        scaleY={displaySymbolScale.scaleY}
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
                                                    rotateHandleDistance *
                                                        Math.sin(
                                                            (rot * Math.PI) /
                                                                180,
                                                        )
                                                }
                                                y2={
                                                    labelPos.y -
                                                    rotateHandleDistance *
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
                                                    rotateHandleDistance *
                                                        Math.sin(
                                                            (rot * Math.PI) /
                                                                180,
                                                        )
                                                }
                                                cy={
                                                    labelPos.y -
                                                    rotateHandleDistance *
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
                                                    beginDragGesture();
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
                                    {showPointLabel && (
                                        <text
                                            x={labelPos.x}
                                            y={
                                                labelPos.y +
                                                displaySymbolScale.depthPx / 2 +
                                                12
                                            }
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
                                            {tgSize &&
                                                ` · ${tgSize.widthM.toFixed(2)}×${tgSize.depthM.toFixed(2)}×${tgSize.heightM.toFixed(2)} m`}
                                        </text>
                                    )}
                                </g>
                            );
                        }

                        const fillColor =
                            element.type === 'terrace_platform'
                                ? elevationColor(
                                      element.baseElevationM ?? 0,
                                      platformElevationRange,
                                  )
                                : element.style.fillColor;

                        const openPath =
                            isSpanGate(element) ||
                            (element.type === 'fence' &&
                                element.config?.kind === 'fence' &&
                                element.config.closed === false);
                        // Portón trazado como tramo: zona de acceso hacia adentro + puesto de ingreso.
                        const gateCfgNow =
                            element.config?.kind === 'gate'
                                ? element.config
                                : undefined;
                        const spanGate = isSpanGate(element);
                        const access = gateAccess(gateCfgNow);
                        const lanePts =
                            spanGate && access.depthM > 0
                                ? accessLaneRect(
                                      element.vertices[0],
                                      element.vertices[1],
                                      editor.terrainScaleM,
                                      access.side,
                                      access.depthM,
                                  )
                                : null;
                        // Huellas del ingreso en planta: cubierta (punteada), muros laterales y luminarias.
                        const entrance = gateEntrance(gateCfgNow);
                        const entranceRect = (
                            latFrom: number,
                            latTo: number,
                            inFrom: number,
                            inTo: number,
                        ): Point2D[] | null => {
                            if (!spanGate) return null;
                            const [p, q] = element.vertices;
                            const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
                            const ux = (q.x - p.x) / len;
                            const uy = (q.y - p.y) / len;
                            const sign = access.side === 'left' ? 1 : -1;
                            const nx = sign * uy;
                            const ny = -sign * ux;
                            const scale = editor.terrainScaleM;
                            const m = {
                                x: (p.x + q.x) / 2,
                                y: (p.y + q.y) / 2,
                            };
                            const pt = (lat: number, inw: number): Point2D => ({
                                x: m.x + (ux * lat + nx * inw) / scale,
                                y: m.y + (uy * lat + ny * inw) / scale,
                            });
                            return [
                                pt(latFrom, inFrom),
                                pt(latTo, inFrom),
                                pt(latTo, inTo),
                                pt(latFrom, inTo),
                            ];
                        };
                        const spanLen = spanGate
                            ? gateSpanM(element, editor.terrainScaleM)
                            : 0;
                        const canopyPts = entrance.canopy.enabled
                            ? entranceRect(
                                  -(spanLen / 2 + entrance.canopy.overhangM),
                                  spanLen / 2 + entrance.canopy.overhangM,
                                  0,
                                  entrance.canopy.depthM,
                              )
                            : null;
                        const wallPts = entrance.sideWalls.enabled
                            ? [-1, 1]
                                  .map((s) =>
                                      entranceRect(
                                          s * (spanLen / 2),
                                          s *
                                              (spanLen / 2 +
                                                  entrance.sideWalls
                                                      .thicknessM),
                                          0,
                                          entrance.sideWalls.depthM,
                                      ),
                                  )
                                  .filter((r): r is Point2D[] => r !== null)
                            : [];
                        const lightPts: Point2D[] = [];
                        if (spanGate && entrance.lights.enabled) {
                            const inw = entrance.canopy.enabled
                                ? entrance.canopy.depthM / 2
                                : 0.6;
                            for (let i = 0; i < entrance.lights.count; i++) {
                                const lat =
                                    ((i + 0.5) / entrance.lights.count - 0.5) *
                                    spanLen;
                                const r = entranceRect(lat, lat, inw, inw);
                                if (r) lightPts.push(r[0]);
                            }
                        }
                        const boothPts =
                            spanGate && access.booth.enabled
                                ? boothRect(
                                      element.vertices[0],
                                      element.vertices[1],
                                      editor.terrainScaleM,
                                      access.side,
                                      access.booth,
                                  )
                                : null;
                        const Shape = openPath ? 'polyline' : 'polygon';

                        // Rampa con tramos: dibuja en planta cada tramo y cada
                        // descanso (la vuelta en U con su descanso ancho), no
                        // solo el polígono de referencia.
                        const rampCfg =
                            element.type === 'ramp' &&
                            element.config?.kind === 'ramp'
                                ? element.config
                                : undefined;
                        // El layout de tramos se centra en la CAJA del polígono (igual que en 3D).
                        const layoutCenter = elementBox(
                            element,
                            editor.terrainScaleM,
                        ).center;
                        const planOf = (lx: number, lz: number): Point2D => ({
                            x: layoutCenter.x + lx / editor.terrainScaleM,
                            y: layoutCenter.y - lz / editor.terrainScaleM,
                        });
                        const stairCfgNow =
                            element.type === 'stair' &&
                            element.config?.kind === 'stair'
                                ? element.config
                                : undefined;
                        const stairDirection: 'east' | 'south' =
                            stairCfgNow && element.vertices.length >= 3
                                ? stairRunDirection(
                                      stairCfgNow,
                                      element,
                                      editor.terrainScaleM,
                                  )
                                : 'east';
                        const stairLike = stairCfgNow
                            ? stairAsRampConfig(stairCfgNow, stairDirection)
                            : undefined;
                        const pathRaw = rampCfg ?? stairLike;
                        // Ajustado al espacio dibujado: no se sale del polígono ni pisa al vecino.
                        const pathCfg =
                            pathRaw && pathRaw.shape !== 'spiral'
                                ? fitRampToElement(
                                      pathRaw,
                                      element,
                                      editor.terrainScaleM,
                                      { lockLengths: stairLike !== undefined },
                                  ).config
                                : pathRaw;
                        const isStairPath = stairLike !== undefined;
                        const stairTotal = stairCfgNow
                            ? stairCfgNow.toElevationM -
                              stairCfgNow.fromElevationM
                            : 0;
                        const stairRiserM =
                            Math.abs(stairTotal) > 1e-6
                                ? Math.abs(stairTotal) /
                                  stairStepCount(stairTotal)
                                : 0.175;
                        const rampSegs =
                            pathCfg &&
                            pathCfg.shape !== 'spiral' &&
                            (pathCfg.flights?.length ?? 0) > 0
                                ? buildStraightRampLayout(pathCfg)
                                : [];
                        const rampParts = rampSegs.map((seg) => {
                            const dx = seg.endLocal.x - seg.startLocal.x;
                            const dz = seg.endLocal.z - seg.startLocal.z;
                            const len = Math.hypot(dx, dz) || 1;
                            const ux = dx / len;
                            const uz = dz / len;
                            const mx = (seg.startLocal.x + seg.endLocal.x) / 2;
                            const mz = (seg.startLocal.z + seg.endLocal.z) / 2;
                            const hw = seg.widthM / 2;
                            const corners = [
                                [-1, -1],
                                [1, -1],
                                [1, 1],
                                [-1, 1],
                            ].map(([p, q]) =>
                                planOf(
                                    mx + ux * (len / 2) * p + -uz * hw * q,
                                    mz + uz * (len / 2) * p + ux * hw * q,
                                ),
                            );
                            // Flecha en el sentido de avance (de INICIO a FIN)
                            // + desnivel y pendiente del tramo.
                            const s0 = toScreen(
                                planOf(seg.startLocal.x, seg.startLocal.z),
                            );
                            const s1 = toScreen(
                                planOf(seg.endLocal.x, seg.endLocal.z),
                            );
                            const sd =
                                Math.hypot(s1.x - s0.x, s1.y - s0.y) || 1;
                            const dxs = (s1.x - s0.x) / sd;
                            const dys = (s1.y - s0.y) / sd;
                            const head = {
                                x: s0.x + (s1.x - s0.x) * 0.62,
                                y: s0.y + (s1.y - s0.y) * 0.62,
                            };
                            const rise = seg.endY - seg.startY;
                            return {
                                id: seg.id,
                                kind: seg.kind,
                                role: seg.role,
                                points: points(corners),
                                s0,
                                s1,
                                arrow: `${head.x + dxs * 7},${head.y + dys * 7} ${head.x - dxs * 4 - dys * 5},${head.y - dys * 4 + dxs * 5} ${head.x - dxs * 4 + dys * 5},${head.y - dys * 4 - dxs * 5}`,
                                label:
                                    seg.kind === 'flight'
                                        ? `${rise >= 0 ? '▲ sube' : '▼ baja'} ${Math.abs(rise).toFixed(2)} m · ${isStairPath ? Math.round(Math.abs(rise) / stairRiserM) + ' peldaños' : ((Math.abs(rise) / len) * 100).toFixed(1) + '%'}`
                                        : seg.role === 'arrival'
                                          ? 'descanso de llegada'
                                          : 'descanso',
                                mid: {
                                    x: (s0.x + s1.x) / 2,
                                    y: (s0.y + s1.y) / 2,
                                },
                                startCota:
                                    (pathCfg?.fromElevationM ?? 0) + seg.startY,
                                endCota:
                                    (pathCfg?.fromElevationM ?? 0) + seg.endY,
                            };
                        });
                        // ¿Une de verdad dos plataformas? (✔ / ⚠ junto a INICIO y FIN)
                        const levelLink =
                            pathCfg && rampParts.length > 0
                                ? checkLevelLink(
                                      element,
                                      siteData.elements,
                                      editor.terrainScaleM,
                                      pathCfg,
                                  )
                                : null;
                        const rampFlightsOnly = rampParts.filter(
                            (part) => part.kind === 'flight',
                        );
                        const rampStart = rampFlightsOnly[0];
                        // El FIN es el extremo del último elemento (incluido el descanso de llegada).
                        const rampEnd = rampParts[rampParts.length - 1];

                        // Detalle esquemático en planta: marcas de cancha, cubierta de techado, gradas del jardín.
                        const detailLines: Point2D[][] = [];
                        const detailDashed: Point2D[][] = [];
                        if (
                            (element.type === 'court' ||
                                element.type === 'canopy' ||
                                (element.type === 'green_area' &&
                                    element.config?.kind === 'green_area' &&
                                    element.config.form === 'terraced')) &&
                            element.vertices.length >= 3
                        ) {
                            const xsD = element.vertices.map((v) => v.x);
                            const ysD = element.vertices.map((v) => v.y);
                            const minXD = Math.min(...xsD);
                            const maxXD = Math.max(...xsD);
                            const minYD = Math.min(...ysD);
                            const maxYD = Math.max(...ysD);
                            const cxD = (minXD + maxXD) / 2;
                            const cyD = (minYD + maxYD) / 2;
                            const alongXD = maxXD - minXD >= maxYD - minYD;
                            const scaleD = editor.terrainScaleM || 1;
                            const lengthM =
                                Math.max(maxXD - minXD, maxYD - minYD) * scaleD;
                            const widthM =
                                Math.min(maxXD - minXD, maxYD - minYD) * scaleD;
                            const at = (a: number, c: number): Point2D =>
                                alongXD
                                    ? {
                                          x: cxD + a / scaleD,
                                          y: cyD + c / scaleD,
                                      }
                                    : {
                                          x: cxD + c / scaleD,
                                          y: cyD + a / scaleD,
                                      };
                            if (
                                element.type === 'court' &&
                                element.config?.kind === 'court'
                            ) {
                                for (const line of courtLines(
                                    element.config.sport,
                                    lengthM,
                                    widthM,
                                )) {
                                    detailLines.push(
                                        line.map(([a, c]) => at(a, c)),
                                    );
                                }
                            } else if (
                                element.type === 'canopy' &&
                                element.config?.kind === 'canopy'
                            ) {
                                detailDashed.push([
                                    at(-lengthM / 2, -widthM / 2),
                                    at(lengthM / 2, widthM / 2),
                                ]);
                                detailDashed.push([
                                    at(-lengthM / 2, widthM / 2),
                                    at(lengthM / 2, -widthM / 2),
                                ]);
                                if (element.config.roof !== 'flat') {
                                    detailLines.push([
                                        at(-lengthM / 2, 0),
                                        at(lengthM / 2, 0),
                                    ]);
                                }
                            } else if (element.config?.kind === 'green_area') {
                                const n = Math.max(
                                    2,
                                    Math.round(element.config.terraces),
                                );
                                for (let i = 1; i < n; i++) {
                                    const a = -lengthM / 2 + (lengthM * i) / n;
                                    detailLines.push([
                                        at(a, -widthM / 2),
                                        at(a, widthM / 2),
                                    ]);
                                }
                            }
                        }

                        return (
                            <g key={element.id}>
                                {lanePts && (
                                    <polygon
                                        points={points(lanePts)}
                                        fill="#64748b"
                                        fillOpacity={0.25}
                                        stroke="#475569"
                                        strokeWidth={1}
                                        strokeDasharray="6 4"
                                        style={{ pointerEvents: 'none' }}
                                    />
                                )}
                                {canopyPts && (
                                    <polygon
                                        points={points(canopyPts)}
                                        fill={
                                            entrance.canopy.material === 'tile'
                                                ? '#c2410c'
                                                : '#94a3b8'
                                        }
                                        fillOpacity={0.22}
                                        stroke="#9a3412"
                                        strokeWidth={1}
                                        strokeDasharray="3 3"
                                        style={{ pointerEvents: 'none' }}
                                    />
                                )}
                                {wallPts.map((rect, i) => (
                                    <polygon
                                        key={`gw${i}`}
                                        points={points(rect)}
                                        fill="#e5e7eb"
                                        stroke="#334155"
                                        strokeWidth={1.2}
                                        style={{ pointerEvents: 'none' }}
                                    />
                                ))}
                                {lightPts.map((p, i) => {
                                    const s = toScreen(p);
                                    return (
                                        <circle
                                            key={`gl${i}`}
                                            cx={s.x}
                                            cy={s.y}
                                            r={3.5}
                                            fill="#fde047"
                                            stroke="#a16207"
                                            strokeWidth={1}
                                            style={{ pointerEvents: 'none' }}
                                        />
                                    );
                                })}
                                {boothPts && (
                                    <g style={{ pointerEvents: 'none' }}>
                                        <polygon
                                            points={points(boothPts)}
                                            fill="#fde68a"
                                            fillOpacity={0.85}
                                            stroke="#b45309"
                                            strokeWidth={1.5}
                                        />
                                        <text
                                            x={
                                                toScreen({
                                                    x:
                                                        boothPts.reduce(
                                                            (s, p) => s + p.x,
                                                            0,
                                                        ) / 4,
                                                    y:
                                                        boothPts.reduce(
                                                            (s, p) => s + p.y,
                                                            0,
                                                        ) / 4,
                                                }).x
                                            }
                                            y={
                                                toScreen({
                                                    x:
                                                        boothPts.reduce(
                                                            (s, p) => s + p.x,
                                                            0,
                                                        ) / 4,
                                                    y:
                                                        boothPts.reduce(
                                                            (s, p) => s + p.y,
                                                            0,
                                                        ) / 4,
                                                }).y
                                            }
                                            textAnchor="middle"
                                            fontSize={LABEL_PX - 3}
                                            className="fill-amber-900 font-semibold"
                                        >
                                            Puesto de ingreso
                                        </text>
                                    </g>
                                )}
                                <Shape
                                    points={points(element.vertices)}
                                    fill={openPath ? 'none' : fillColor}
                                    fillOpacity={element.style.opacity ?? 1}
                                    stroke={
                                        editor.spaceConflictIds.includes(
                                            element.id,
                                        )
                                            ? '#e11d48'
                                            : selected
                                              ? '#f59e0b'
                                              : element.style.strokeColor
                                    }
                                    strokeWidth={
                                        editor.spaceConflictIds.includes(
                                            element.id,
                                        )
                                            ? 5
                                            : selected
                                              ? 3
                                              : (element.style.strokeWidth ??
                                                1.5)
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
                                {(detailLines.length > 0 ||
                                    detailDashed.length > 0) && (
                                    <g
                                        style={{ pointerEvents: 'none' }}
                                        fill="none"
                                    >
                                        {detailLines.map((line, i) => (
                                            <polyline
                                                key={`l${i}`}
                                                points={points(line)}
                                                stroke={
                                                    element.type === 'court'
                                                        ? '#f8fafc'
                                                        : element.style
                                                              .strokeColor
                                                }
                                                strokeWidth={
                                                    element.type === 'court'
                                                        ? 1
                                                        : 1.2
                                                }
                                                strokeOpacity={0.9}
                                            />
                                        ))}
                                        {detailDashed.map((line, i) => (
                                            <polyline
                                                key={`d${i}`}
                                                points={points(line)}
                                                stroke={
                                                    element.style.strokeColor
                                                }
                                                strokeWidth={0.8}
                                                strokeDasharray="5 4"
                                            />
                                        ))}
                                    </g>
                                )}
                                {rampParts.map((part) => (
                                    <g
                                        key={part.id}
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        <polygon
                                            points={part.points}
                                            fill={
                                                part.kind === 'landing'
                                                    ? '#57534e'
                                                    : '#a8a29e'
                                            }
                                            fillOpacity={0.65}
                                            stroke="#292524"
                                            strokeWidth={1}
                                        />
                                        {part.kind === 'flight' && (
                                            <>
                                                <line
                                                    x1={part.s0.x}
                                                    y1={part.s0.y}
                                                    x2={part.s1.x}
                                                    y2={part.s1.y}
                                                    stroke="#fef3c7"
                                                    strokeWidth={1.2}
                                                    strokeDasharray="4 3"
                                                />
                                                <polygon
                                                    points={part.arrow}
                                                    fill="#fef3c7"
                                                    stroke="#292524"
                                                    strokeWidth={0.6}
                                                />
                                            </>
                                        )}
                                        <text
                                            x={part.mid.x}
                                            y={part.mid.y - 3}
                                            textAnchor="middle"
                                            fontSize={LABEL_PX - 3}
                                            className="fill-slate-900 font-semibold"
                                        >
                                            {part.label}
                                        </text>
                                    </g>
                                ))}
                                {rampStart && rampEnd && (
                                    <g style={{ pointerEvents: 'none' }}>
                                        <circle
                                            cx={rampStart.s0.x}
                                            cy={rampStart.s0.y}
                                            r={5}
                                            fill="#16a34a"
                                            stroke="white"
                                            strokeWidth={1.5}
                                        />
                                        <text
                                            x={rampStart.s0.x + 8}
                                            y={rampStart.s0.y - 6}
                                            fontSize={LABEL_PX - 2}
                                            className="fill-green-800 font-bold"
                                        >
                                            INICIO{' '}
                                            {rampStart.startCota.toFixed(2)} m
                                            {levelLink
                                                ? levelLink.start.ok
                                                    ? ' ✔'
                                                    : ' ⚠'
                                                : ''}
                                        </text>
                                        <circle
                                            cx={rampEnd.s1.x}
                                            cy={rampEnd.s1.y}
                                            r={5}
                                            fill="#dc2626"
                                            stroke="white"
                                            strokeWidth={1.5}
                                        />
                                        <text
                                            x={rampEnd.s1.x + 8}
                                            y={rampEnd.s1.y + 14}
                                            fontSize={LABEL_PX - 2}
                                            className="fill-red-800 font-bold"
                                        >
                                            FIN {rampEnd.endCota.toFixed(2)} m
                                            {levelLink
                                                ? levelLink.end.ok
                                                    ? ' ✔'
                                                    : ' ⚠'
                                                : ''}
                                        </text>
                                    </g>
                                )}
                                {showShapeLabel && (
                                    <text
                                        x={labelPos.x}
                                        y={labelPos.y}
                                        textAnchor="middle"
                                        fontSize={LABEL_PX}
                                        className="pointer-events-none fill-slate-800 font-semibold dark:fill-white"
                                    >
                                        {element.label}
                                        {element.type === 'terrace_platform' &&
                                            `  ▲ ${(element.baseElevationM ?? 0).toFixed(2)} m`}
                                        {spanGate &&
                                            `  ${gateSpanM(element, editor.terrainScaleM).toFixed(1)} m`}
                                    </text>
                                )}
                                {showShapeLabel &&
                                    element.type === 'building_block' &&
                                    (siteData.circuits ?? [])
                                        .filter(
                                            (circuit) =>
                                                circuit.sourceId ===
                                                    element.id ||
                                                circuit.targetId === element.id,
                                        )
                                        .flatMap((circuit) => {
                                            const feed =
                                                editor.circuitFeeds[circuit.id];
                                            return feed ? [feed] : [];
                                        })
                                        .map((feed, index) => {
                                            const status =
                                                feed.calculation?.status ??
                                                'incomplete';
                                            return (
                                                <text
                                                    key={feed.edgeId}
                                                    x={labelPos.x}
                                                    y={
                                                        labelPos.y +
                                                        (index + 1) *
                                                            (LABEL_PX + 3)
                                                    }
                                                    textAnchor="middle"
                                                    fontSize={LABEL_PX - 2}
                                                    fill={feederStatusColor(
                                                        status,
                                                    )}
                                                    className="pointer-events-none font-bold"
                                                >
                                                    {`${feed.toLabel} · desde ${feed.fromLabel}`}
                                                    {status !== 'incomplete' &&
                                                    feed.calculation
                                                        ? ` · ΔU ${feed.calculation.accumulatedVoltageDropPercent.toFixed(1)} %`
                                                        : ' · sin carga/longitud'}
                                                </text>
                                            );
                                        })}
                                {selectedSingle &&
                                    editor.activeTool === 'select' &&
                                    !editor.isFrozen(element) &&
                                    element.vertices.length > 1 &&
                                    element.vertices.map((vertex, index) => {
                                        if (
                                            openPath &&
                                            index ===
                                                element.vertices.length - 1
                                        ) {
                                            return null;
                                        }
                                        // Punto medio con el SIGUIENTE vértice
                                        // (el polígono se dibuja cerrado, así
                                        // que el último también forma lado con
                                        // el primero) — clic para insertar un
                                        // vértice nuevo ahí y poder darle más
                                        // forma al objeto ya dibujado.
                                        const next =
                                            element.vertices[
                                                (index + 1) %
                                                    element.vertices.length
                                            ];
                                        const midWorld = {
                                            x: (vertex.x + next.x) / 2,
                                            y: (vertex.y + next.y) / 2,
                                        };
                                        const m = toScreen(midWorld);
                                        return (
                                            <circle
                                                key={`mid-${index}`}
                                                cx={m.x}
                                                cy={m.y}
                                                r={DOT_R}
                                                className="cursor-copy fill-white stroke-amber-500 stroke-2 opacity-70 hover:opacity-100 dark:fill-slate-900"
                                                onPointerDown={(event) => {
                                                    event.stopPropagation();
                                                    event.currentTarget.ownerSVGElement?.setPointerCapture(
                                                        event.pointerId,
                                                    );
                                                    const newIndex = index + 1;
                                                    editor.insertSiteVertex(
                                                        element.id,
                                                        index,
                                                        midWorld,
                                                    );
                                                    beginDragGesture();
                                                    vertexDragRef.current = {
                                                        elementId: element.id,
                                                        vertexIndex: newIndex,
                                                        pointerId:
                                                            event.pointerId,
                                                    };
                                                }}
                                            />
                                        );
                                    })}
                                {selectedSingle &&
                                    editor.activeTool === 'select' &&
                                    !editor.isFrozen(element) &&
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
                                                    beginDragGesture();
                                                    vertexDragRef.current = {
                                                        elementId: element.id,
                                                        vertexIndex: index,
                                                        pointerId:
                                                            event.pointerId,
                                                    };
                                                }}
                                                onDoubleClick={(event) => {
                                                    event.stopPropagation();
                                                    if (
                                                        element.vertices
                                                            .length <= 3
                                                    ) {
                                                        return;
                                                    }
                                                    editor.removeSiteVertexGuarded(
                                                        element.id,
                                                        index,
                                                    );
                                                }}
                                            />
                                        );
                                    })}
                            </g>
                        );
                    })}

                <SiteAttachedLightsLayer
                    elements={siteData.elements}
                    scaleM={editor.terrainScaleM || 1}
                    toScreen={toScreen}
                />
                <AutoCircuitPreviewLayer toScreen={toScreen} />
                {projectionPreview && (
                    <ProjectionPreviewLayer
                        positions={projectionPreview.positions}
                        toScreen={toScreen}
                        toWorld={toWorld}
                    />
                )}
                {lighting?.calculation && lighting.showIsolux && (
                    <IsoluxLayer
                        calculation={lighting.calculation}
                        focusedAreaId={lighting.focusedAreaId}
                        scaleM={editor.terrainScaleM || 1}
                        toScreen={toScreen}
                    />
                )}
                {marquee && (
                    <rect
                        x={Math.min(marquee.x0, marquee.x1)}
                        y={Math.min(marquee.y0, marquee.y1)}
                        width={Math.abs(marquee.x1 - marquee.x0)}
                        height={Math.abs(marquee.y1 - marquee.y0)}
                        className="fill-cyan-400/15 stroke-cyan-500"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        style={{ pointerEvents: 'none' }}
                    />
                )}
                {siteData.feederPaths.map((path) => {
                    const status = deriveFeederStatus(
                        path.networkEdgeId,
                        editor.networkCalculations,
                    );
                    const wireSelected =
                        editor.selectedWireId?.kind === 'feeder' &&
                        editor.selectedWireId.id === path.id;
                    const selectable = editor.activeTool === 'select';
                    const selectThisWire = (
                        event: ReactPointerEvent<SVGElement>,
                    ) => {
                        if (!selectable) return;
                        event.stopPropagation();
                        editor.selectWire({ kind: 'feeder', id: path.id });
                    };
                    const color = wireSelected
                        ? '#f59e0b'
                        : (path.style?.color ?? feederStatusColor(status));
                    const width = wireSelected ? 4 : 3;
                    // Cada tramo se dibuja aparte: arqueado a la derecha y con
                    // rayas si es subterráneo, arqueado a la izquierda y
                    // sólido si es aéreo (domain/cableBow) — recto y sólido
                    // si el tramo no tiene modo definido (tendido "plano").
                    return (
                        <g
                            key={path.id}
                            onPointerDown={selectThisWire}
                            className={selectable ? 'cursor-pointer' : ''}
                            style={{
                                pointerEvents: selectable
                                    ? 'visiblePainted'
                                    : 'none',
                            }}
                        >
                            {path.waypoints.slice(1).map((wp, i) => {
                                const mode =
                                    path.segmentModes?.[i] ??
                                    path.segmentModes?.[0] ??
                                    path.route?.kind;
                                const bowMode =
                                    mode === 'aerial' || mode === 'underground'
                                        ? mode
                                        : undefined;
                                const d = wireSegmentPath(
                                    path.waypoints[i],
                                    wp,
                                    bowMode,
                                    path.route?.curveSide,
                                    path.route?.curveOffsetM,
                                );
                                const hitD = wireHitPath(
                                    path.waypoints[i],
                                    wp,
                                    bowMode,
                                    path.route?.curveSide,
                                    path.route?.curveOffsetM,
                                    i === 0,
                                    i === path.waypoints.length - 2,
                                );
                                const arcHandle =
                                    wireSelected && bowMode
                                        ? toScreen(
                                              bowedPoint(
                                                  path.waypoints[i],
                                                  wp,
                                                  editor.terrainScaleM,
                                                  bowMode,
                                                  0.5,
                                                  path.route?.curveSide,
                                                  path.route?.curveOffsetM,
                                              ),
                                          )
                                        : null;
                                return (
                                    <g key={i}>
                                        {hitD && (
                                            <path
                                                d={hitD}
                                                fill="none"
                                                stroke="transparent"
                                                strokeWidth={14}
                                            />
                                        )}
                                        <path
                                            d={d}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth={width}
                                            strokeDasharray={
                                                path.style?.dashArray ??
                                                (bowMode === 'underground'
                                                    ? '12 4'
                                                    : undefined)
                                            }
                                            strokeLinecap="round"
                                            style={{ pointerEvents: 'none' }}
                                        />
                                        {arcHandle && bowMode && (
                                            <circle
                                                cx={arcHandle.x}
                                                cy={arcHandle.y}
                                                r={6}
                                                className="cursor-grab fill-amber-400 stroke-white active:cursor-grabbing dark:stroke-slate-900"
                                                strokeWidth={1.5}
                                                style={{
                                                    pointerEvents:
                                                        'visiblePainted',
                                                }}
                                                onPointerDown={(event) => {
                                                    event.stopPropagation();
                                                    event.currentTarget.setPointerCapture(
                                                        event.pointerId,
                                                    );
                                                    beginDragGesture();
                                                    wireDragRef.current = {
                                                        pointerId:
                                                            event.pointerId,
                                                        kind: 'feeder',
                                                        id: path.id,
                                                        mode: 'arc',
                                                        segA: path.waypoints[i],
                                                        segB: wp,
                                                        bowMode,
                                                    };
                                                }}
                                            />
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}

                {(siteData.circuits ?? []).map((circuit) => {
                    const wireSelected =
                        editor.selectedWireId?.kind === 'circuit' &&
                        editor.selectedWireId.id === circuit.id;
                    const selectable = editor.activeTool === 'select';
                    const selectThisWire = (
                        event: ReactPointerEvent<SVGElement>,
                    ) => {
                        if (!selectable) return;
                        event.stopPropagation();
                        editor.selectWire({ kind: 'circuit', id: circuit.id });
                    };
                    const tg = [
                        elementById.get(circuit.sourceId),
                        elementById.get(circuit.targetId),
                    ].find((element) => element?.type === 'tg_location');
                    const tgAnchor = tg
                        ? tgOutputAnchorLocal(
                              tg.config?.kind === 'tg'
                                  ? tg.config.outputs
                                  : undefined,
                              circuit.tgOutputId,
                          )
                        : undefined;
                    const color = wireSelected
                        ? '#f59e0b'
                        : (tgAnchor?.output.color ??
                          circuit.style?.color ??
                          '#0891b2');
                    const width = wireSelected ? 3.5 : 2;
                    // El extremo se sigue leyendo del punto ACTUAL del
                    // artefacto anclado (no del guardado al dibujar) — así el
                    // cable sigue al objeto cuando se arrastra o gira. Si un
                    // extremo es un TG, se corre a la salida elegida
                    // (`tgOutputId`) en vez del centro del gabinete — mismo
                    // cálculo en metros reales que usa el constructor 3D, ya
                    // no depende del zoom ni de convertir ida y vuelta por
                    // pantalla.
                    const liveWaypoints = resolveWireEndpoints(
                        circuit.waypoints,
                        circuit.sourceId,
                        circuit.targetId,
                        (id) => elementById.get(id),
                        editor.terrainScaleM,
                        circuit.tgOutputId,
                    );
                    const visualWaypoints = [...liveWaypoints];
                    const circuitElevations = cableWaypointElevations(
                        liveWaypoints,
                        siteData.elements,
                        editor.terrainScaleM,
                    );
                    const sourceElement = elementById.get(circuit.sourceId);
                    const targetElement = elementById.get(circuit.targetId);
                    if (sourceElement?.type === 'tg_location') {
                        visualWaypoints[0] = tgOutputVisualWorld(
                            sourceElement,
                            circuit.tgOutputId,
                        );
                    }
                    if (targetElement?.type === 'tg_location') {
                        visualWaypoints[visualWaypoints.length - 1] =
                            tgOutputVisualWorld(
                                targetElement,
                                circuit.tgOutputId,
                            );
                    }
                    // Mientras se arrastra un extremo de ESTE cable, el
                    // dibujo sigue al cursor (o al artefacto bajo el cursor,
                    // ya enganchado) — el cambio real recién se guarda al
                    // soltar. Copia aparte: `liveWaypoints` puede ser el
                    // mismo array que `circuit.waypoints` (si nada se movió),
                    // mutarlo directo corrompería el store.
                    const renderWaypoints =
                        wireEndpointDrag?.id === circuit.id
                            ? (() => {
                                  const copy = [...visualWaypoints];
                                  if (wireEndpointDrag.endpoint === 'source') {
                                      copy[0] = wireEndpointDrag.point;
                                  } else {
                                      copy[copy.length - 1] =
                                          wireEndpointDrag.point;
                                  }
                                  return copy;
                              })()
                            : visualWaypoints;
                    return (
                        <g
                            key={circuit.id}
                            onPointerDown={selectThisWire}
                            className={selectable ? 'cursor-pointer' : ''}
                            style={{
                                pointerEvents: selectable
                                    ? 'visiblePainted'
                                    : 'none',
                            }}
                        >
                            {renderWaypoints.slice(1).map((wp, i) => {
                                const mode =
                                    circuit.segmentModes?.[i] ??
                                    circuit.segmentModes?.[0] ??
                                    circuit.route?.kind;
                                const bowMode =
                                    mode === 'aerial' || mode === 'underground'
                                        ? mode
                                        : undefined;
                                const d = wireSegmentPath(
                                    renderWaypoints[i],
                                    wp,
                                    bowMode,
                                    circuit.route?.curveSide,
                                    circuit.route?.curveOffsetM,
                                );
                                const hitD = wireHitPath(
                                    renderWaypoints[i],
                                    wp,
                                    bowMode,
                                    circuit.route?.curveSide,
                                    circuit.route?.curveOffsetM,
                                    i === 0,
                                    i === renderWaypoints.length - 2,
                                );
                                const arcHandle =
                                    wireSelected && bowMode
                                        ? toScreen(
                                              bowedPoint(
                                                  renderWaypoints[i],
                                                  wp,
                                                  editor.terrainScaleM,
                                                  bowMode,
                                                  0.5,
                                                  circuit.route?.curveSide,
                                                  circuit.route?.curveOffsetM,
                                              ),
                                          )
                                        : null;
                                const levelDelta =
                                    (circuitElevations[i + 1] ?? 0) -
                                    (circuitElevations[i] ?? 0);
                                const levelLabelPoint =
                                    Math.abs(levelDelta) > 0.01
                                        ? toScreen(
                                              bowMode
                                                  ? bowedPoint(
                                                        renderWaypoints[i],
                                                        wp,
                                                        editor.terrainScaleM,
                                                        bowMode,
                                                        0.5,
                                                        circuit.route
                                                            ?.curveSide,
                                                        circuit.route
                                                            ?.curveOffsetM,
                                                    )
                                                  : {
                                                        x:
                                                            (renderWaypoints[i]
                                                                .x +
                                                                wp.x) /
                                                            2,
                                                        y:
                                                            (renderWaypoints[i]
                                                                .y +
                                                                wp.y) /
                                                            2,
                                                    },
                                          )
                                        : null;
                                return (
                                    <g key={i}>
                                        {hitD && (
                                            <path
                                                d={hitD}
                                                fill="none"
                                                stroke="transparent"
                                                strokeWidth={12}
                                            />
                                        )}
                                        <path
                                            d={d}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth={width}
                                            strokeDasharray={
                                                circuit.style?.dashArray ??
                                                (bowMode === 'underground'
                                                    ? '9 3'
                                                    : undefined)
                                            }
                                            strokeLinecap="round"
                                            style={{ pointerEvents: 'none' }}
                                        />
                                        {levelLabelPoint && (
                                            <text
                                                x={levelLabelPoint.x}
                                                y={levelLabelPoint.y - 7}
                                                textAnchor="middle"
                                                fontSize={9}
                                                fontWeight="bold"
                                                fill={color}
                                                stroke="#0f172a"
                                                strokeWidth={2.5}
                                                paintOrder="stroke"
                                            >
                                                {levelDelta > 0 ? '↑' : '↓'}{' '}
                                                {Math.abs(levelDelta).toFixed(
                                                    2,
                                                )}{' '}
                                                m
                                            </text>
                                        )}
                                        {arcHandle && bowMode && (
                                            <circle
                                                cx={arcHandle.x}
                                                cy={arcHandle.y}
                                                r={6}
                                                className="cursor-grab fill-amber-400 stroke-white active:cursor-grabbing dark:stroke-slate-900"
                                                strokeWidth={1.5}
                                                style={{
                                                    pointerEvents:
                                                        'visiblePainted',
                                                }}
                                                onPointerDown={(event) => {
                                                    event.stopPropagation();
                                                    event.currentTarget.setPointerCapture(
                                                        event.pointerId,
                                                    );
                                                    beginDragGesture();
                                                    wireDragRef.current = {
                                                        pointerId:
                                                            event.pointerId,
                                                        kind: 'circuit',
                                                        id: circuit.id,
                                                        mode: 'arc',
                                                        segA: renderWaypoints[
                                                            i
                                                        ],
                                                        segB: wp,
                                                        bowMode,
                                                    };
                                                }}
                                            />
                                        )}
                                    </g>
                                );
                            })}
                            {wireSelected && (
                                <>
                                    <circle
                                        cx={toScreen(renderWaypoints[0]).x}
                                        cy={toScreen(renderWaypoints[0]).y}
                                        r={7}
                                        className="cursor-grab fill-emerald-500 stroke-white active:cursor-grabbing dark:stroke-slate-900"
                                        strokeWidth={2}
                                        style={{
                                            pointerEvents: 'visiblePainted',
                                        }}
                                        onPointerDown={(event) => {
                                            event.stopPropagation();
                                            event.currentTarget.setPointerCapture(
                                                event.pointerId,
                                            );
                                            beginDragGesture();
                                            wireDragRef.current = {
                                                pointerId: event.pointerId,
                                                kind: 'circuit',
                                                id: circuit.id,
                                                mode: 'endpoint',
                                                endpoint: 'source',
                                                otherId: circuit.targetId,
                                            };
                                        }}
                                    >
                                        <title>
                                            Arrastra a otro artefacto para
                                            cambiar el inicio del cable
                                        </title>
                                    </circle>
                                    <circle
                                        cx={
                                            toScreen(
                                                renderWaypoints[
                                                    renderWaypoints.length - 1
                                                ],
                                            ).x
                                        }
                                        cy={
                                            toScreen(
                                                renderWaypoints[
                                                    renderWaypoints.length - 1
                                                ],
                                            ).y
                                        }
                                        r={7}
                                        className="cursor-grab fill-rose-500 stroke-white active:cursor-grabbing dark:stroke-slate-900"
                                        strokeWidth={2}
                                        style={{
                                            pointerEvents: 'visiblePainted',
                                        }}
                                        onPointerDown={(event) => {
                                            event.stopPropagation();
                                            event.currentTarget.setPointerCapture(
                                                event.pointerId,
                                            );
                                            beginDragGesture();
                                            wireDragRef.current = {
                                                pointerId: event.pointerId,
                                                kind: 'circuit',
                                                id: circuit.id,
                                                mode: 'endpoint',
                                                endpoint: 'target',
                                                otherId: circuit.sourceId,
                                            };
                                        }}
                                    >
                                        <title>
                                            Arrastra a otro artefacto para
                                            cambiar el destino del cable
                                        </title>
                                    </circle>
                                </>
                            )}
                        </g>
                    );
                })}
                {wireEndpointDrag?.hoverId &&
                    (() => {
                        const hoverElement = elementById.get(
                            wireEndpointDrag.hoverId,
                        );
                        if (!hoverElement) return null;
                        const s = toScreen(wireEndpointDrag.point);
                        return (
                            <g style={{ pointerEvents: 'none' }}>
                                <circle
                                    cx={s.x}
                                    cy={s.y}
                                    r={13}
                                    fill="none"
                                    className="stroke-emerald-400"
                                    strokeWidth={2}
                                    strokeDasharray="3 2"
                                />
                                <text
                                    x={s.x}
                                    y={s.y - 19}
                                    textAnchor="middle"
                                    className="fill-emerald-600 dark:fill-emerald-300"
                                    fontSize={11}
                                    fontWeight="bold"
                                >
                                    {'→ conecta con '}
                                    {hoverElement.label}
                                </text>
                            </g>
                        );
                    })()}

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

                {pendingRenderVertices.length > 0 && (
                    <g style={{ pointerEvents: 'none' }}>
                        <polyline
                            points={points(pendingRenderVertices)}
                            fill="none"
                            className={
                                drawingFeeder
                                    ? 'stroke-cyan-500'
                                    : drawingCircuit
                                      ? undefined
                                      : 'stroke-amber-500'
                            }
                            stroke={
                                drawingCircuit ? pendingCircuitColor : undefined
                            }
                            strokeWidth={2}
                            strokeDasharray="6 4"
                        />
                        {pendingRenderVertices.map((vertex, index) => {
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
                                            : drawingCircuit
                                              ? 'fill-emerald-500'
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
                                    : drawingCircuit
                                      ? undefined
                                      : 'stroke-amber-400/70'
                            }
                            stroke={
                                drawingCircuit ? pendingCircuitColor : undefined
                            }
                            opacity={drawingCircuit ? 0.7 : undefined}
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
                                    : drawingCircuit
                                      ? 'stroke-emerald-400'
                                      : 'stroke-amber-400'
                            }
                            strokeWidth={1.5}
                        />
                    </g>
                )}

                {circuitAnchorHoverValid && rubberTo && (
                    <g style={{ pointerEvents: 'none' }}>
                        <circle
                            cx={rubberTo.x}
                            cy={rubberTo.y}
                            r={DOT_R + 6}
                            fill="none"
                            className="stroke-emerald-400"
                            strokeWidth={2}
                            strokeDasharray="3 2"
                        />
                        <text
                            x={rubberTo.x}
                            y={rubberTo.y - DOT_R - 10}
                            textAnchor="middle"
                            className="fill-emerald-600 dark:fill-emerald-300"
                            fontSize={11}
                            fontWeight="bold"
                        >
                            {'→ conecta con '}
                            {siteData.elements.find(
                                (el) => el.id === circuitAnchorHoverValid.id,
                            )?.label ?? 'artefacto'}
                        </text>
                    </g>
                )}
            </svg>

            {editor.spaceWarning && (
                <div className="pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded bg-rose-600/95 px-3 py-1.5 text-[11px] font-semibold text-white shadow">
                    {editor.spaceWarning}
                </div>
            )}
            {editor.activeTool === 'select' && editor.selectedWireId && (
                <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-slate-900/85 px-2 py-1 text-[10px] font-medium text-white">
                    Cable seleccionado — arrastra el punto{' '}
                    <span className="text-amber-400">ámbar</span> a la mitad de
                    un tramo arqueado para ajustar su arco; arrastra el punto{' '}
                    <span className="text-emerald-400">verde</span> o{' '}
                    <span className="text-rose-400">rojo</span> de un extremo a
                    OTRO artefacto para recablearlo.
                </div>
            )}
            {editor.activeTool !== 'select' && editor.activeTool !== 'pan' && (
                <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-slate-900/85 px-2 py-1 text-[10px] font-medium text-white">
                    Herramienta activa:{' '}
                    {editor.activeTool === 'calibrate_plan'
                        ? 'Calibrar plano'
                        : editor.activeTool === 'draw_feeder'
                          ? 'Trazar alimentador'
                          : editor.activeTool === 'draw_circuit'
                            ? 'Cablear instalación'
                            : editor.activeTool === 'measure'
                              ? 'Medir'
                              : (SITE_ELEMENT_DEFAULTS[editor.pendingType]
                                    ?.label ?? editor.activeTool)}{' '}
                    {drawingFeeder
                        ? '— clic = por el AIRE · clic derecho = por el SUELO · doble clic o Enter para terminar · Esc cancela'
                        : drawingCircuit
                          ? editor.pendingCircuitSourceId
                              ? editor.pendingCircuitContinuationIds.length > 0
                                  ? `— continuando ${editor.pendingCircuitContinuationIds.length} circuito${editor.pendingCircuitContinuationIds.length === 1 ? '' : 's'} · recorre cajas con clics · doble clic o Enter en la última · Esc cancela`
                                  : '— recorre objetos con clics · clic derecho = tramo por el SUELO · doble clic o Enter sobre el último para terminar · Esc cancela'
                              : '— clic sobre un poste, tomacorriente, tablero, transformador, grupo electrógeno, portón, techado, celda MT, buzón o caja de pase para empezar'
                          : '— clic para crear varios · Esc para terminar'}
                </div>
            )}
            {cadStatus === 'deferred' && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[10px] text-slate-600 shadow dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-300">
                    <span>
                        Plano CAD pesado (
                        {(deferredBytes / 1_000_000).toFixed(1)} MB): se muestra
                        la imagen.
                    </span>
                    <button
                        type="button"
                        onClick={loadVector}
                        className="rounded bg-amber-500 px-2 py-0.5 font-semibold text-white hover:bg-amber-600"
                    >
                        Cargar vectorial
                    </button>
                </div>
            )}
            {cadLoadingStages && (
                <ModuleLoadingOverlay
                    variant="overlay"
                    title="Cargando plano del emplazamiento"
                    stages={cadLoadingStages}
                    slowHint="El plano CAD es pesado y sigue abriéndose. Puedes minimizar y seguir trabajando, o usar la imagen."
                    actions={
                        cadPhase !== 'reading' ? (
                            <button
                                type="button"
                                onClick={abandonVector}
                                className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10"
                            >
                                Usar imagen
                            </button>
                        ) : undefined
                    }
                />
            )}
            {cadStatus === 'error' && (
                <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded bg-red-950/80 px-2 py-1 text-[10px] text-red-200">
                    No se pudo abrir el plano CAD — reimporta el DXF/DWG.
                </div>
            )}
        </div>
    );
}
