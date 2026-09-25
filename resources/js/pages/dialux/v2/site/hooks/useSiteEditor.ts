import { useEffect, useMemo, useState } from 'react';
import { computeLinearScaleFactor } from '@/pages/dialux/geometry/calibration';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { isBaseLockActive, isElementFrozen } from '../domain/baseLock';
import { appendCircuitContinuation } from '../domain/circuitContinuation';
import { compactCircuitTrace } from '../domain/circuitTrace';
import { defaultCableForKind } from '../domain/feederCables';
import { gateFrame, inwardNormal } from '../domain/gateLayout';
import { closestPointOnPolygon, pointInPolygon } from '../domain/geometry';
import {
    DEFAULT_SATELLITE_ZOOM,
    MAX_SATELLITE_ZOOM,
    MIN_SATELLITE_ZOOM,
} from '../domain/geoTiles';
import { elementBox } from '../domain/layoutFit';
import {
    applyAutoLinkToRamp,
    applyAutoLinkToStair,
    autoLinkLevels,
    autoLinkStairFromPolygon,
} from '../domain/levelAuto';
import {
    DEFAULT_SITE_NETWORK_SETTINGS,
    planAutoCircuits,
    type AutoCircuitPlan,
    type AutoCircuitRules,
} from '../domain/siteAutoCircuit';
import { PROJECTED_FOR_KEY } from '../domain/siteFixtureProjection';
import { deriveSiteNetworkLive } from '../domain/siteNetworkLive';
import {
    exclusiveSpacePolygons,
    isExclusiveSpace,
    overlappingSpaces,
    pushOutsideSpaces,
} from '../domain/spaceGuard';
import {
    sampleGroundElevation,
    terrainElevationPoints,
} from '../domain/terrainSurface';
import { normalizeTgOutputs, tgFootprintVertices } from '../domain/tgPanel';
import type {
    Point2D,
    PoleConfig,
    SiteElement,
    SiteElementType,
    SiteTool,
} from '../domain/types';
import { sitePlanImageUrl } from '../lib/planImport';
import { defaultConfigFor, SITE_ELEMENT_DEFAULTS } from '../lib/siteDefaults';
import { useNetworkSnapshotForSite } from './useNetworkSnapshotForSite';
import type { SitePlanImportResult } from './useSitePlanImport';

/** Tipos que se dibujan como polígono (clic a clic, cerrar con doble clic/Enter). */
const POLYGON_TYPES = new Set<SiteElementType>([
    'terrain',
    'street',
    'green_area',
    'fence',
    'pool',
    'ramp',
    'stair',
    'court',
    'parking',
    'building_block',
    'custom_zone',
    'terrace_platform',
    'canopy',
    'sidewalk',
]);

/** Portapapeles del emplazamiento (Ctrl+C / Ctrl+V): vive en el módulo para sobrevivir a re-montajes del editor. */
let siteClipboard: { elements: SiteElement[]; pastes: number } | null = null;

/** Tipos que se colocan con un solo clic (equipo puntual, tamaño fijo por defecto). */
const POINT_SIZE_M = 4;

/** Artefactos a los que un circuito de instalación (cableado) se puede anclar. */
const CIRCUIT_ANCHOR_TYPES = new Set<SiteElementType>([
    'pole',
    'outlet',
    'tg_location',
    'transformer',
    'gate',
    'canopy',
    'building_block',
    'sub_panel',
    'ats',
    'earth_pit',
    'mt_cell_arrival',
    'mt_cell_protection',
    'mt_cell_transformation',
    'cable_vault',
    'pull_box',
    'generator',
]);
/** Distancia máxima (m) para "enganchar" el PRIMER clic (dónde arranca el cable) a un artefacto — generosa porque ahí no hay nada que rodear todavía. */
const CIRCUIT_SNAP_M = 2.5;
/**
 * Distancia máxima (m) para que un clic DURANTE el trazado cierre la
 * conexión solo. Más chica que `CIRCUIT_SNAP_M`: con objetos apretados en
 * fila (ej. las 3 celdas MT) un radio de 2.5 m alcanza a un artefacto
 * vecino aunque el clic sea solo un punto de ruteo para PASAR de largo
 * hacia el destino real — eso cerraba el cable en el vecino equivocado.
 */
export const CIRCUIT_COMMIT_SNAP_M = 0.9;

export function useSiteEditor(projectId: number, generalModuleId: number) {
    const project = useEditorStore((state) => state.project);
    const ensureSiteData = useEditorStore((state) => state.ensureSiteData);
    const addSiteElement = useEditorStore((state) => state.addSiteElement);
    const updateSiteElement = useEditorStore(
        (state) => state.updateSiteElement,
    );
    const removeSiteElement = useEditorStore(
        (state) => state.removeSiteElement,
    );
    const removeSiteElementsByType = useEditorStore(
        (state) => state.removeSiteElementsByType,
    );
    const duplicateSiteElement = useEditorStore(
        (state) => state.duplicateSiteElement,
    );
    const addSiteElements = useEditorStore((state) => state.addSiteElements);
    const moveSiteElements = useEditorStore((state) => state.moveSiteElements);
    const removeSiteElements = useEditorStore(
        (state) => state.removeSiteElements,
    );
    const moveSiteVertex = useEditorStore((state) => state.moveSiteVertex);
    const insertSiteVertex = useEditorStore((state) => state.insertSiteVertex);
    const removeSiteVertex = useEditorStore((state) => state.removeSiteVertex);
    const addFeederPath = useEditorStore((state) => state.addFeederPath);
    const updateFeederPath = useEditorStore((state) => state.updateFeederPath);
    const removeFeederPath = useEditorStore((state) => state.removeFeederPath);
    const setFeederRoute = useEditorStore((state) => state.setFeederRoute);
    const addSiteCircuit = useEditorStore((state) => state.addSiteCircuit);
    const updateSiteCircuit = useEditorStore(
        (state) => state.updateSiteCircuit,
    );
    const removeSiteCircuit = useEditorStore(
        (state) => state.removeSiteCircuit,
    );
    const setSiteCircuitRoute = useEditorStore(
        (state) => state.setSiteCircuitRoute,
    );
    const setSiteLocation = useEditorStore((state) => state.setSiteLocation);
    const toggleSiteLayer = useEditorStore((state) => state.toggleSiteLayer);
    const lockSiteLayer = useEditorStore((state) => state.lockSiteLayer);
    const setImportedPlan = useEditorStore((state) => state.setImportedPlan);
    const updateImportedPlan = useEditorStore(
        (state) => state.updateImportedPlan,
    );
    const removeImportedPlan = useEditorStore(
        (state) => state.removeImportedPlan,
    );
    const setTerrainScale = useEditorStore((state) => state.setTerrainScale);

    useEffect(() => {
        if (project && !project.site) ensureSiteData();
    }, [project, ensureSiteData]);

    const siteData = project?.site;
    const network = useNetworkSnapshotForSite(projectId);
    // Red + planta ACTUAL: un cable recién dibujado a un bloque ya muestra a
    // qué tablero llega y su caída de tensión, sin recargar Red y CT.
    const liveNetwork = deriveSiteNetworkLive(
        network.network,
        siteData,
        network.ports,
        network.conductors,
    );

    const [activeTool, setActiveToolState] = useState<SiteTool>('select');
    const [pendingType, setPendingType] = useState<SiteElementType>('terrain');
    const [pendingNetworkEdgeId, setPendingNetworkEdgeId] = useState<
        string | null
    >(null);
    // Selección múltiple: `selectedElementId` es el ÚLTIMO seleccionado (el que muestra el panel de propiedades cuando hay uno solo).
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const selectedElementId =
        selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
    // Cable seleccionado (alimentador o cableado de instalaciones) — excluyente con
    // la selección de elementos: uno limpia al otro, para que "Propiedades" no
    // muestre dos cosas a la vez ni la tecla Supr sea ambigua.
    const [selectedWireId, setSelectedWireId] = useState<{
        kind: 'circuit' | 'feeder';
        id: string;
    } | null>(null);
    const selectWire = (
        wire: { kind: 'circuit' | 'feeder'; id: string } | null,
    ) => {
        setSelectedWireId(wire);
        if (wire) setSelectedIds([]);
    };
    const setSelectedElementId = (id: string | null) => {
        setSelectedIds(id ? [id] : []);
        setSelectedWireId(null);
    };
    const [pendingVertices, setPendingVertices] = useState<Point2D[]>([]);
    // Alimentador en trazado: modo de cada tramo (clic = aéreo, clic derecho = por el suelo).
    // Tipo con el que nace la próxima escalera dibujada: con descansos o recta continua.
    const [stairLandings, setStairLandings] = useState<'auto' | 'none'>('auto');
    const [pendingModes, setPendingModes] = useState<
        Array<'aerial' | 'underground'>
    >([]);
    // Cableado de instalaciones en trazado: id del artefacto donde arrancó (null = aún sin enganchar).
    const [pendingCircuitSourceId, setPendingCircuitSourceId] = useState<
        string | null
    >(null);
    const [pendingCircuitTgOutputId, setPendingCircuitTgOutputId] = useState<
        string | null
    >(null);
    // Circuitos existentes que compartirán el siguiente tramo. Vacío = se
    // está creando un circuito nuevo desde cero.
    const [pendingCircuitContinuationIds, setPendingCircuitContinuationIds] =
        useState<string[]>([]);
    const setSiteBaseLocked = useEditorStore(
        (state) => state.setSiteBaseLocked,
    );
    // "Respetar espacios": los objetos que ocupan área no se dibujan/arrastran encima de otros.
    const [respectSpaces, setRespectSpaces] = useState(true);
    const [spaceWarning, setSpaceWarning] = useState<string | null>(null);
    // Objetos con los que chocó el último trazo/movimiento rechazado: se resaltan en rojo en el plano.
    const [spaceConflictIds, setSpaceConflictIds] = useState<string[]>([]);
    const [calibrationPoints, setCalibrationPoints] = useState<Point2D[]>([]);
    const [planImportOpen, setPlanImportOpen] = useState(false);
    const [contourImportOpen, setContourImportOpen] = useState(false);
    const [surveyImportOpen, setSurveyImportOpen] = useState(false);
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [showSatellite, setShowSatellite] = useState(true);
    const [satelliteZoom, setSatelliteZoomState] = useState(
        DEFAULT_SATELLITE_ZOOM,
    );
    /** La resolución/cobertura real de Esri World Imagery varía por zona (confirmado en Huánuco) — se deja al usuario ajustar si el zoom por defecto no muestra imagen real ahí. */
    const setSatelliteZoom = (zoom: number) =>
        setSatelliteZoomState(
            Math.min(MAX_SATELLITE_ZOOM, Math.max(MIN_SATELLITE_ZOOM, zoom)),
        );
    const gridSizeM = siteData?.gridSizeM ?? 5;
    /** Metros por unidad de coordenada (1 = sin calibrar). Lo fija "Calibrar plano". */
    const terrainScaleM = siteData?.terrainScaleM || 1;

    // Superficie de terreno (curvas de nivel + puntos acotados). Memoizado:
    // con un levantamiento de cientos de puntos, recalcularlo en cada render
    // (y el `pointermove` re-renderiza) costaba >1 s.
    const terrainPoints = useMemo(
        () => terrainElevationPoints(siteData?.elements ?? []),
        [siteData?.elements],
    );
    const terrainModeled = terrainPoints.length >= 3;
    /** Cota del terreno natural en `(x, y)` (0 si no hay superficie modelada). */
    const groundElevationAt = (x: number, y: number): number =>
        terrainModeled ? sampleGroundElevation(terrainPoints, x, y) : 0;

    /** Cambia de herramienta y, si es una de dibujo, fija qué tipo va a crear. */
    const startTool = (tool: SiteTool, elementType?: SiteElementType) => {
        setPendingVertices([]);
        setPendingNetworkEdgeId(null);
        setPendingCircuitContinuationIds([]);
        setCalibrationPoints([]);
        setActiveToolState(tool);
        if (elementType) setPendingType(elementType);
    };

    /** Inicia el trazado de un alimentador (`draw_feeder`) ya vinculado a un edge concreto de la red. */
    const startFeederTool = (networkEdgeId: string) => {
        setPendingVertices([]);
        setPendingNetworkEdgeId(networkEdgeId);
        setActiveToolState('draw_feeder');
    };

    /** Arranca la calibración del plano importado (2 clics + distancia real). */
    const startCalibratePlan = () => {
        setCalibrationPoints([]);
        setActiveToolState('calibrate_plan');
    };

    /** Artefacto elegible más cercano a `point` (≤ `maxM`, por defecto `CIRCUIT_SNAP_M`), con su centro. */
    const nearestCircuitAnchor = (
        point: Point2D,
        maxM: number = CIRCUIT_SNAP_M,
    ): { id: string; point: Point2D } | null => {
        let best: { id: string; point: Point2D; d: number } | null = null;
        for (const el of siteData?.elements ?? []) {
            if (
                el.visible === false ||
                !CIRCUIT_ANCHOR_TYPES.has(el.type) ||
                el.vertices.length === 0
            ) {
                continue;
            }
            const c = elementBox(el, terrainScaleM).center;
            const d = Math.hypot(point.x - c.x, point.y - c.y) * terrainScaleM;
            if (d <= maxM && (!best || d < best.d)) {
                best = { id: el.id, point: c, d };
            }
        }
        return best ? { id: best.id, point: best.point } : null;
    };

    /** Arranca el cableado de instalaciones (`draw_circuit`) — el primer clic debe enganchar un artefacto. */
    const startCircuitTool = () => {
        setPendingVertices([]);
        setPendingModes([]);
        setPendingCircuitSourceId(null);
        setPendingCircuitTgOutputId(null);
        setPendingCircuitContinuationIds([]);
        setSpaceWarning(null);
        setActiveToolState('draw_circuit');
    };

    /**
     * Continúa uno o varios circuitos que terminan en el mismo artefacto.
     * Sólo se dibuja el tramo nuevo; al cerrar se anexa a cada recorrido.
     */
    const startCircuitContinuation = (circuitIds: string[]) => {
        const requested = new Set(circuitIds);
        const circuits = (siteData?.circuits ?? []).filter((circuit) =>
            requested.has(circuit.id),
        );
        const targetId = circuits[0]?.targetId;
        if (!targetId) return false;
        const compatible = circuits.filter(
            (circuit) => circuit.targetId === targetId,
        );
        const target = siteData?.elements.find(
            (element) => element.id === targetId,
        );
        if (!target || compatible.length === 0) return false;

        const start = elementBox(target, terrainScaleM).center;
        setPendingVertices([start]);
        setPendingModes([]);
        setPendingCircuitSourceId(targetId);
        setPendingCircuitTgOutputId(compatible[0].tgOutputId ?? null);
        setPendingCircuitContinuationIds(
            compatible.map((circuit) => circuit.id),
        );
        setSelectedWireId(null);
        setSelectedIds([]);
        setSpaceWarning(null);
        setActiveToolState('draw_circuit');
        return true;
    };

    /**
     * Crea el `SiteCircuit` con el recorrido completo hasta `targetAnchorId` y
     * reinicia el dibujo (la herramienta sigue activa para cablear otra salida).
     * Se ejecuta al cerrar con doble clic o Enter sobre el último artefacto.
     */
    const commitCircuit = (
        waypoints: Point2D[],
        modes: Array<'aerial' | 'underground'>,
        targetAnchorId: string,
    ) => {
        if (!pendingCircuitSourceId) return;
        const trace = compactCircuitTrace(waypoints, modes);
        if (trace.waypoints.length < 2) return;
        const hasModes = trace.modes.length === trace.waypoints.length - 1;
        const kind: 'aerial' | 'underground' = trace.modes.includes('aerial')
            ? 'aerial'
            : 'underground';
        const pure =
            hasModes && trace.modes.every((mode) => mode === trace.modes[0]);

        if (pendingCircuitContinuationIds.length > 0) {
            const history = useEditorStore.getState();
            history.beginHistoryGesture();
            try {
                for (const circuitId of pendingCircuitContinuationIds) {
                    const circuit = siteData?.circuits?.find(
                        (item) => item.id === circuitId,
                    );
                    if (!circuit) continue;
                    const patch = appendCircuitContinuation(
                        circuit,
                        trace.waypoints,
                        trace.modes,
                        targetAnchorId,
                    );
                    if (patch) updateSiteCircuit(circuit.id, patch);
                }
            } finally {
                history.endHistoryGesture();
            }
            const firstId = pendingCircuitContinuationIds[0];
            setSpaceWarning(null);
            setPendingModes([]);
            setPendingVertices([]);
            setPendingCircuitSourceId(null);
            setPendingCircuitTgOutputId(null);
            setPendingCircuitContinuationIds([]);
            setActiveToolState('select');
            if (firstId) selectWire({ kind: 'circuit', id: firstId });
            return;
        }

        const source = siteData?.elements.find(
            (element) => element.id === pendingCircuitSourceId,
        );
        const target = siteData?.elements.find(
            (element) => element.id === targetAnchorId,
        );
        const tg =
            source?.type === 'tg_location'
                ? source
                : target?.type === 'tg_location'
                  ? target
                  : undefined;
        const tgOutputs = normalizeTgOutputs(
            tg?.config?.kind === 'tg' ? tg.config.outputs : undefined,
        );
        const usedOutputs = new Set(
            (siteData?.circuits ?? [])
                .filter(
                    (circuit) =>
                        tg &&
                        (circuit.sourceId === tg.id ||
                            circuit.targetId === tg.id),
                )
                .map((circuit) => circuit.tgOutputId)
                .filter((id): id is string => Boolean(id)),
        );
        const tgOutputId =
            pendingCircuitTgOutputId ??
            (tg
                ? (
                      tgOutputs.find((output) => !usedOutputs.has(output.id)) ??
                      tgOutputs[0]
                  )?.id
                : undefined);
        addSiteCircuit({
            sourceId: pendingCircuitSourceId,
            targetId: targetAnchorId,
            waypoints: trace.waypoints,
            wireCount: 2,
            wastePct: 5,
            ...(tgOutputId ? { tgOutputId } : {}),
            ...(hasModes
                ? {
                      segmentModes: trace.modes,
                      route: {
                          kind,
                          // Instalación local: amarre y zanja más bajos que un alimentador troncal.
                          ...(kind === 'aerial'
                              ? { mountHeightM: 3 }
                              : { depthM: 0.4 }),
                          ...(pure ? defaultCableForKind(kind) : {}),
                      },
                  }
                : {}),
        });
        setSpaceWarning(null);
        setPendingModes([]);
        setPendingVertices([]);
        setPendingCircuitSourceId(null);
        setPendingCircuitTgOutputId(null);
        setPendingCircuitContinuationIds([]);
    };

    /**
     * Punto del cableado: clic = tramo aéreo, clic derecho = tramo por el suelo. El PRIMER punto
     * debe enganchar un artefacto elegible (si no, se avisa y no arranca nada). Los clics siguientes
     * pueden pasar por tantos objetos como necesite el usuario: cada objeto se agrega al MISMO
     * recorrido y conserva la salida/color del TG. Doble clic o Enter sobre el último artefacto
     * cierra el circuito completo.
     */
    const addCircuitVertex = (
        point: Point2D,
        mode: 'aerial' | 'underground',
    ) => {
        if (pendingVertices.length === 0) {
            const anchor = nearestCircuitAnchor(point);
            if (!anchor) {
                setSpaceWarning(
                    'Empieza el cable sobre un poste, tomacorriente, tablero, transformador, grupo electrógeno, portón, techado, celda MT, buzón o caja de pase.',
                );
                return;
            }
            setSpaceWarning(null);
            setPendingCircuitSourceId(anchor.id);
            const source = siteData?.elements.find(
                (element) => element.id === anchor.id,
            );
            if (source?.type === 'tg_location') {
                const outputs = normalizeTgOutputs(
                    source.config?.kind === 'tg'
                        ? source.config.outputs
                        : undefined,
                );
                const used = new Set(
                    (siteData?.circuits ?? [])
                        .filter(
                            (circuit) =>
                                circuit.sourceId === source.id ||
                                circuit.targetId === source.id,
                        )
                        .map((circuit) => circuit.tgOutputId)
                        .filter((id): id is string => Boolean(id)),
                );
                setPendingCircuitTgOutputId(
                    (
                        outputs.find((output) => !used.has(output.id)) ??
                        outputs[0]
                    )?.id ?? null,
                );
            } else {
                setPendingCircuitTgOutputId(null);
            }
            setPendingModes([]);
            setPendingVertices([anchor.point]);
            return;
        }
        const anchor = nearestCircuitAnchor(point, CIRCUIT_COMMIT_SNAP_M);
        if (anchor && anchor.id !== pendingCircuitSourceId) {
            setSpaceWarning(null);
            setPendingModes((current) => [
                ...(pendingVertices.length === 1 ? [] : current),
                mode,
            ]);
            setPendingVertices((current) => [...current, anchor.point]);
            return;
        }
        setSpaceWarning(null);
        setPendingModes((current) => [
            ...(pendingVertices.length === 1 ? [] : current),
            mode,
        ]);
        setPendingVertices((current) => [...current, point]);
    };

    /**
     * Portón dibujado como TRAMO: dos clics = extremos del vano. Se ajustan al
     * cerco más cercano (a ≤ 2 m), se vincula a él y, si el cerco es un
     * perímetro cerrado, se decide solo cuál es el lado interior.
     */
    const createGateSpan = (first: Point2D, second: Point2D) => {
        const scale = terrainScaleM;
        const fences = (siteData?.elements ?? []).filter(
            (el) =>
                el.type === 'fence' &&
                el.visible !== false &&
                el.vertices.length >= 2,
        );
        let a = first;
        let b = second;
        let fence: SiteElement | undefined;
        let bestDist = 3 / scale;
        const mid = {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
        };
        for (const candidate of fences) {
            const closed =
                candidate.config?.kind === 'fence'
                    ? (candidate.config.closed ?? true)
                    : true;
            const hit = closestPointOnPolygon(mid, candidate.vertices, closed);
            if (hit && hit.distance <= bestDist) {
                bestDist = hit.distance;
                fence = candidate;
            }
        }
        let inwardSide: 'left' | 'right' = 'left';
        if (fence) {
            const closed =
                fence.config?.kind === 'fence'
                    ? (fence.config.closed ?? true)
                    : true;
            const snap = (p: Point2D) => {
                const hit = closestPointOnPolygon(p, fence!.vertices, closed);
                return hit && hit.distance * scale <= 2 ? hit.point : p;
            };
            a = snap(first);
            b = snap(second);
            if (closed && fence.vertices.length >= 3) {
                const frame = gateFrame(a, b, scale);
                const probe = {
                    x:
                        frame.mid.x +
                        (inwardNormal(frame, 'left').x * 1.5) / scale,
                    y:
                        frame.mid.y +
                        (inwardNormal(frame, 'left').y * 1.5) / scale,
                };
                inwardSide = pointInPolygon(probe, fence.vertices)
                    ? 'left'
                    : 'right';
            }
        }
        const defaults = SITE_ELEMENT_DEFAULTS.gate;
        const base = defaultConfigFor('gate');
        const id = addSiteElement({
            type: 'gate',
            label: defaults.label,
            vertices: [a, b],
            style: defaults.style,
            heightM: defaults.heightM,
            config:
                base?.kind === 'gate'
                    ? {
                          ...base,
                          widthM: gateFrame(a, b, scale).lengthM,
                          fenceId: fence?.id,
                          inwardSide,
                          accessDepthM: 6,
                      }
                    : base,
            visible: true,
        });
        setPendingVertices([]);
        setSelectedElementId(id);
    };

    /** Saca `point` de cualquier espacio exclusivo ya dibujado (con 5 cm de margen), si aplica al tipo. */
    const guardSpacePoint = (
        point: Point2D,
        type: SiteElementType,
        exceptId?: string,
    ): Point2D => {
        if (!respectSpaces || !isExclusiveSpace(type)) return point;
        return pushOutsideSpaces(
            point,
            exclusiveSpacePolygons(
                siteData?.elements ?? [],
                exceptId ? [exceptId] : [],
                siteData?.layers,
            ),
            0.05 / terrainScaleM,
        );
    };

    /** ¿Con estos vértices el objeto se superpone con MÁS espacios de los que ya invadía? (los previos no bloquean). */
    const introducesOverlap = (
        element: SiteElement,
        next: Point2D[],
    ): boolean => {
        if (
            !respectSpaces ||
            !isExclusiveSpace(element.type) ||
            next.length < 3
        ) {
            return false;
        }
        const others = exclusiveSpacePolygons(
            siteData?.elements ?? [],
            [element.id],
            siteData?.layers,
        );
        const before = new Set(
            overlappingSpaces(element.vertices, others).map((o) => o.id),
        );
        return overlappingSpaces(next, others).some((o) => !before.has(o.id));
    };

    /** Mueve un vértice sin dejar que el objeto entre en el espacio de otro. */
    const moveSiteVertexGuarded = (
        elementId: string,
        vertexIndex: number,
        position: Point2D,
    ) => {
        const element = siteData?.elements.find((el) => el.id === elementId);
        if (!element) {
            moveSiteVertex(elementId, vertexIndex, position);
            return;
        }
        const guarded = guardSpacePoint(position, element.type, elementId);
        // El punto ya no está dentro de un vecino, pero una ARISTA todavía puede atravesarlo: ese movimiento se ignora.
        const next = element.vertices.map((v, i) =>
            i === vertexIndex ? guarded : v,
        );
        if (introducesOverlap(element, next)) return;
        moveSiteVertex(elementId, vertexIndex, guarded);
    };

    /**
     * Desplaza un grupo respetando los espacios: si algún objeto exclusivo del grupo
     * pasaría a invadir a un vecino (que no se mueve con él), el movimiento se ignora
     * — el objeto se "frena" contra el borde del vecino.
     */
    const moveSiteElementsGuarded = (
        origins: Record<string, Point2D[]>,
        dx: number,
        dy: number,
    ) => {
        if (respectSpaces && siteData) {
            const movedIds = Object.keys(origins);
            const others = exclusiveSpacePolygons(
                siteData.elements,
                movedIds,
                siteData.layers,
            );
            for (const id of movedIds) {
                const element = siteData.elements.find((el) => el.id === id);
                if (!element || !isExclusiveSpace(element.type)) continue;
                const start = origins[id];
                const next = start.map((v) => ({ x: v.x + dx, y: v.y + dy }));
                const before = new Set(
                    overlappingSpaces(start, others).map((o) => o.id),
                );
                if (
                    overlappingSpaces(next, others).some(
                        (o) => !before.has(o.id),
                    )
                )
                    return;
            }
        }
        moveSiteElements(origins, dx, dy);
    };

    /** Quita un vértice sin que la arista nueva invada el espacio de un vecino. */
    const removeSiteVertexGuarded = (
        elementId: string,
        vertexIndex: number,
    ) => {
        const element = siteData?.elements.find((el) => el.id === elementId);
        if (element) {
            const next = element.vertices.filter((_, i) => i !== vertexIndex);
            if (introducesOverlap(element, next)) {
                setSpaceWarning(
                    'Quitar ese punto haría que el objeto invada a otro: se conservó.',
                );
                return;
            }
        }
        removeSiteVertex(elementId, vertexIndex);
    };

    const addVertex = (rawPoint: Point2D) => {
        const point =
            activeTool === 'draw_polygon'
                ? guardSpacePoint(rawPoint, pendingType)
                : rawPoint;
        setSpaceWarning(null);
        setSpaceConflictIds([]);
        // Herramienta "Portón (trazar vano)": el segundo clic cierra el tramo.
        if (
            activeTool === 'draw_polygon' &&
            pendingType === 'gate' &&
            pendingVertices.length === 1
        ) {
            createGateSpan(pendingVertices[0], point);
            return;
        }
        setPendingVertices((current) => [...current, point]);
    };

    const cancelDrawing = () => {
        setSpaceWarning(null);
        setPendingVertices([]);
        setPendingNetworkEdgeId(null);
        setPendingCircuitSourceId(null);
        setPendingCircuitTgOutputId(null);
        setPendingCircuitContinuationIds([]);
        setPendingModes([]);
    };

    /** Quita el último punto ya colocado mientras se dibuja (Ctrl+Z / Retroceso durante el trazo). */
    const removeLastVertex = () => {
        setPendingVertices((current) => current.slice(0, -1));
        setPendingModes((current) => current.slice(0, -1));
    };

    /** Punto de un alimentador: clic izquierdo = tramo aéreo hasta él, clic derecho = tramo por el suelo. */
    const addFeederVertex = (
        point: Point2D,
        mode: 'aerial' | 'underground',
    ) => {
        if (pendingVertices.length === 0) {
            setPendingModes([]);
        } else {
            setPendingModes((current) => [
                ...(pendingVertices.length === 1 ? [] : current),
                mode,
            ]);
        }
        setPendingVertices((current) => [...current, point]);
    };

    const selectedElements = (): SiteElement[] =>
        (siteData?.elements ?? []).filter((item) =>
            selectedIds.includes(item.id),
        );

    /** Copia la selección (uno o varios objetos) al portapapeles. */
    const copySelectedElement = (): boolean => {
        const sources = selectedElements();
        if (sources.length === 0) return false;
        siteClipboard = { elements: structuredClone(sources), pastes: 0 };
        return true;
    };

    /**
     * Crea copias de `sources` desplazadas `dx, dy` (unidades de plano) en UN
     * paso de deshacer. Un portón copiado junto con su cerco queda vinculado
     * al cerco NUEVO, no al original.
     */
    const cloneElements = (
        sources: SiteElement[],
        dx: number,
        dy: number,
    ): string[] => {
        const history = useEditorStore.getState();
        history.beginHistoryGesture();
        const drafts = sources.map((source) => {
            const { id, ...rest } = structuredClone(source);
            void id;
            return {
                ...rest,
                label: `${rest.label} (copia)`,
                vertices: rest.vertices.map((vertex) => ({
                    x: vertex.x + dx,
                    y: vertex.y + dy,
                })),
                locked: false,
            };
        });
        const ids = addSiteElements(drafts);
        sources.forEach((source, index) => {
            const cfg = source.config;
            if (cfg?.kind !== 'gate' || !cfg.fenceId) return;
            const fenceIndex = sources.findIndex((s2) => s2.id === cfg.fenceId);
            if (fenceIndex < 0) return;
            updateSiteElement(ids[index], {
                config: { ...cfg, fenceId: ids[fenceIndex] },
            });
        });
        history.endHistoryGesture();
        return ids;
    };

    /**
     * Coloca los postes de "Proyectar luminarias" en un área (un solo paso de
     * deshacer). Reemplaza los que se proyectaron antes para ESA área
     * (`metadata.projectedFor`), nunca los colocados a mano.
     */
    /**
     * Auto-circuitado (E1): propone los circuitos del tablero con el sistema
     * de la red y la caída real hasta él (sin red: 380/220 V 3Φ, cos φ 0,9).
     */
    const planPanelAutoCircuits = (
        panelId: string,
        rules?: Partial<AutoCircuitRules>,
    ): AutoCircuitPlan | null =>
        siteData
            ? planAutoCircuits(siteData, panelId, liveNetwork.settings ?? DEFAULT_SITE_NETWORK_SETTINGS, {
                  rules,
                  upstreamPercent: liveNetwork.upstreamPercent,
              })
            : null;

    /** Crea los cables del plan en UN solo paso de deshacer (y las salidas del TG si faltaban). */
    const applyAutoCircuits = (plan: AutoCircuitPlan): number => {
        const history = useEditorStore.getState();
        history.beginHistoryGesture();
        if (plan.tgOutputs) {
            const panel = siteData?.elements.find((element) => element.id === plan.panelId);
            if (panel?.config?.kind === 'tg') {
                updateSiteElement(panel.id, {
                    config: { ...panel.config, outputs: plan.tgOutputs },
                });
            }
        }
        for (const circuit of plan.circuits) addSiteCircuit(circuit);
        history.endHistoryGesture();
        return plan.circuits.length;
    };

    const placeProjectedLuminaires = (
        areaId: string,
        positions: Point2D[],
        pole: PoleConfig,
        /** Configuración propia de cada poste (p.ej. brazo hacia la vía); si falta, `pole`. */
        configs?: PoleConfig[],
        /**
         * Cómo se proyectó (modo, cantidad, disposición, separación, ajuste
         * manual…): se guarda en el ESPACIO (`metadata.projection`) para el
         * informe por espacio.
         */
        projection?: Record<string, unknown>,
    ): number => {
        const area = siteData?.elements.find((element) => element.id === areaId);
        const previous = (siteData?.elements ?? [])
            .filter((element) => element.metadata?.[PROJECTED_FOR_KEY] === areaId)
            .map((element) => element.id);
        const defaults = SITE_ELEMENT_DEFAULTS.pole;
        const half = POINT_SIZE_M / 2;
        const history = useEditorStore.getState();
        history.beginHistoryGesture();
        if (previous.length > 0) removeSiteElements(previous);
        if (projection && area) {
            updateSiteElement(area.id, {
                metadata: {
                    ...(area.metadata ?? {}),
                    projection: {
                        ...projection,
                        placedAt: new Date().toISOString(),
                    },
                },
            });
        }
        addSiteElements(
            positions.map((point, index) => ({
                type: 'pole' as const,
                label: `${defaults.label} ${area?.label ?? ''} ${index + 1}`
                    .replace(/\s+/g, ' ')
                    .trim(),
                vertices: [
                    { x: point.x - half, y: point.y - half },
                    { x: point.x + half, y: point.y - half },
                    { x: point.x + half, y: point.y + half },
                    { x: point.x - half, y: point.y + half },
                ],
                style: defaults.style,
                heightM: defaults.heightM,
                config: configs?.[index] ?? pole,
                visible: true,
                metadata: { [PROJECTED_FOR_KEY]: areaId },
            })),
        );
        history.endHistoryGesture();
        return positions.length;
    };

    /** Pega el portapapeles desplazado 3 m por cada pegado seguido (para que no caiga encima). */
    const pasteElement = (): boolean => {
        if (!siteClipboard || siteClipboard.elements.length === 0) return false;
        siteClipboard.pastes += 1;
        const offset = (3 * siteClipboard.pastes) / terrainScaleM;
        setSelectedIds(cloneElements(siteClipboard.elements, offset, offset));
        return true;
    };

    /** Repite la selección `count` veces cada `spacingM` metros hacia el rumbo `bearingDeg` (0° = arriba en pantalla, horario) — p. ej. una hilera de postes. */
    const repeatSelected = (
        count: number,
        spacingM: number,
        bearingDeg: number,
    ): number => {
        const sources = selectedElements();
        if (sources.length === 0 || count < 1 || spacingM <= 0) return 0;
        const rad = (bearingDeg * Math.PI) / 180;
        const ux = Math.sin(rad);
        const uy = -Math.cos(rad);
        const history = useEditorStore.getState();
        history.beginHistoryGesture();
        const created: string[] = [];
        for (let k = 1; k <= Math.min(200, Math.floor(count)); k++) {
            const step = (spacingM * k) / terrainScaleM;
            created.push(...cloneElements(sources, ux * step, uy * step));
        }
        history.endHistoryGesture();
        setSelectedIds(created);
        return created.length;
    };

    const toggleElementSelection = (id: string) => {
        setSelectedWireId(null);
        setSelectedIds((current) =>
            current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id],
        );
    };
    const selectElements = (ids: string[]) => {
        setSelectedWireId(null);
        setSelectedIds(ids);
    };
    /** Selecciona todo lo visible y no bloqueado (respeta las capas ocultas). */
    const selectAllElements = () => {
        setSelectedWireId(null);
        const layers = siteData?.layers ?? [];
        setSelectedIds(
            (siteData?.elements ?? [])
                .filter((el) => {
                    if (el.visible === false || isElementFrozen(el, siteData))
                        return false;
                    const layer = layers.find((l) => l.types.includes(el.type));
                    return !layer || layer.visible;
                })
                .map((el) => el.id),
        );
    };
    const deleteSelected = (): number => {
        if (selectedWireId) {
            if (selectedWireId.kind === 'circuit')
                removeSiteCircuit(selectedWireId.id);
            else removeFeederPath(selectedWireId.id);
            setSelectedWireId(null);
            return 1;
        }
        if (selectedIds.length === 0) return 0;
        const count = selectedIds.length;
        removeSiteElements(selectedIds);
        setSelectedIds([]);
        return count;
    };
    /** Quita un punto INTERIOR del cableado (fusiona los dos tramos que tocaba) — "eliminar por tramo" sin borrar toda la conexión. */
    const removeSiteCircuitWaypoint = (id: string, vertexIndex: number) => {
        const circuit = siteData?.circuits?.find((c) => c.id === id);
        if (
            !circuit ||
            vertexIndex <= 0 ||
            vertexIndex >= circuit.waypoints.length - 1
        ) {
            return;
        }
        const waypoints = circuit.waypoints.filter((_, i) => i !== vertexIndex);
        const segmentModes = circuit.segmentModes
            ? circuit.segmentModes.filter((_, i) => i !== vertexIndex)
            : undefined;
        updateSiteCircuit(id, {
            waypoints,
            ...(segmentModes ? { segmentModes } : {}),
        });
    };
    /** Igual que `removeSiteCircuitWaypoint`, para un alimentador de la red. */
    const removeFeederPathWaypoint = (id: string, vertexIndex: number) => {
        const path = siteData?.feederPaths.find((p) => p.id === id);
        if (
            !path ||
            vertexIndex <= 0 ||
            vertexIndex >= path.waypoints.length - 1
        ) {
            return;
        }
        const waypoints = path.waypoints.filter((_, i) => i !== vertexIndex);
        updateFeederPath(id, waypoints);
        if (path.segmentModes) {
            const segmentModes = path.segmentModes.filter(
                (_, i) => i !== vertexIndex,
            );
            setFeederRoute(id, path.route, segmentModes);
        }
    };
    /** Borra TODO el cableado de instalaciones de una — "limpiar por bloque". */
    const clearAllCircuits = () => {
        (siteData?.circuits ?? []).forEach((c) => removeSiteCircuit(c.id));
        setSelectedWireId(null);
    };
    /** Borra TODOS los alimentadores trazados — "limpiar por bloque". */
    const clearAllFeederPaths = () => {
        (siteData?.feederPaths ?? []).forEach((p) => removeFeederPath(p.id));
        setSelectedWireId(null);
    };

    const finishDrawing = () => {
        if (activeTool === 'draw_contour') {
            if (pendingVertices.length < 2) {
                cancelDrawing();
                return;
            }
            const defaults = SITE_ELEMENT_DEFAULTS.contour;
            const id = addSiteElement({
                type: 'contour',
                label: defaults.label,
                vertices: pendingVertices,
                style: defaults.style,
                baseElevationM: 0,
                visible: true,
            });
            setPendingVertices([]);
            setSelectedElementId(id);
            // La herramienta sigue activa: se pueden crear más; Esc termina.
            return;
        }
        if (activeTool === 'draw_feeder') {
            if (pendingVertices.length < 2 || !pendingNetworkEdgeId) {
                cancelDrawing();
                return;
            }
            const label = network.edges.find(
                (edge) => edge.id === pendingNetworkEdgeId,
            )?.label;
            const modes = pendingModes.slice(0, pendingVertices.length - 1);
            const hasModes = modes.length === pendingVertices.length - 1;
            const kind: 'aerial' | 'underground' = modes.includes('aerial')
                ? 'aerial'
                : 'underground';
            const pure = hasModes && modes.every((m) => m === modes[0]);
            addFeederPath({
                networkEdgeId: pendingNetworkEdgeId,
                waypoints: pendingVertices,
                label,
                ...(hasModes
                    ? {
                          segmentModes: modes,
                          // Todo aéreo propone aluminio + CAAI; con tramos por el suelo se respeta el cable de la red.
                          route: {
                              kind,
                              ...(pure ? defaultCableForKind(kind) : {}),
                          },
                      }
                    : {}),
            });
            setPendingModes([]);
            setPendingVertices([]);
            setPendingNetworkEdgeId(null);
            setActiveToolState('select');
            return;
        }
        if (activeTool === 'draw_circuit') {
            if (pendingVertices.length < 2 || !pendingCircuitSourceId) {
                cancelDrawing();
                return;
            }
            const last = pendingVertices[pendingVertices.length - 1];
            const anchor = nearestCircuitAnchor(last);
            if (!anchor || anchor.id === pendingCircuitSourceId) {
                // No se crea: el trazo sigue abierto para seguir acercándolo a otro artefacto.
                setSpaceWarning(
                    'Termina el cable sobre otro artefacto (poste, tomacorriente, tablero, transformador, grupo electrógeno, portón, techado, celda MT, buzón o caja de pase) — distinto del de inicio.',
                );
                return;
            }
            const waypoints = [...pendingVertices.slice(0, -1), anchor.point];
            const modes = pendingModes.slice(0, waypoints.length - 1);
            commitCircuit(waypoints, modes, anchor.id);
            // La herramienta sigue activa: se puede iniciar otra salida del TG; Esc termina.
            return;
        }
        // Un cerco es un tramo: con 2 puntos ya es válido.
        if (pendingVertices.length < (pendingType === 'fence' ? 2 : 3)) {
            cancelDrawing();
            return;
        }
        if (respectSpaces && isExclusiveSpace(pendingType)) {
            const clash = overlappingSpaces(
                pendingVertices,
                exclusiveSpacePolygons(
                    siteData?.elements ?? [],
                    [],
                    siteData?.layers,
                ),
            );
            if (clash.length > 0) {
                setSpaceConflictIds(clash.map((c) => c.id));
                // No se crea: el trazo sigue abierto para corregir el último punto (Ctrl+Z / Retroceso).
                setSpaceWarning(
                    `El trazo se superpone con: ${clash.map((c) => c.label).join(', ')}. Ajusta los puntos para respetar su espacio.`,
                );
                return;
            }
        }
        setSpaceWarning(null);
        const defaults = SITE_ELEMENT_DEFAULTS[pendingType];
        // Una escalera/rampa dibujada entre plataformas toma solas sus cotas y su sentido (origen = la baja).
        let config = defaultConfigFor(pendingType);
        if (config?.kind === 'stair') {
            const b = elementBox({ vertices: pendingVertices }, terrainScaleM);
            config = {
                ...config,
                landings: stairLandings,
                // El sentido queda FIJO al dibujar: cambiar el ancho después no la hace girar.
                direction: b.widthM >= b.depthM ? 'east' : 'south',
            };
        }
        const platforms = siteData?.elements ?? [];
        if (config?.kind === 'stair') {
            const link = autoLinkStairFromPolygon(
                { vertices: pendingVertices },
                platforms,
                terrainScaleM,
                config.direction,
            );
            if (link) config = applyAutoLinkToStair(config, link);
        } else if (
            config?.kind === 'ramp' &&
            config.flights &&
            config.flights.length > 0
        ) {
            const link = autoLinkLevels(
                { vertices: pendingVertices },
                platforms,
                terrainScaleM,
                config,
            );
            if (link) config = applyAutoLinkToRamp(config, link);
        }
        const id = addSiteElement({
            type: pendingType,
            label: defaults.label,
            vertices: pendingVertices,
            style: defaults.style,
            heightM: defaults.heightM,
            config,
            visible: true,
        });
        setPendingVertices([]);
        setSelectedElementId(id);
        // La herramienta sigue activa: se pueden crear más; Esc termina.
    };

    /** Coloca un equipo puntual (TG, transformador, poste, portón) con un solo clic. */
    const placePoint = (point: Point2D, elementType: SiteElementType) => {
        const center = point;
        const half = POINT_SIZE_M / 2;
        const defaults = SITE_ELEMENT_DEFAULTS[elementType];
        const config = defaultConfigFor(elementType);
        const vertices =
            elementType === 'tg_location' && config?.kind === 'tg'
                ? tgFootprintVertices(center, config, terrainScaleM)
                : [
                      { x: center.x - half, y: center.y - half },
                      { x: center.x + half, y: center.y - half },
                      { x: center.x + half, y: center.y + half },
                      { x: center.x - half, y: center.y + half },
                  ];
        const id = addSiteElement({
            type: elementType,
            label: defaults.label,
            vertices,
            style: defaults.style,
            heightM: defaults.heightM,
            config,
            visible: true,
        });
        setSelectedElementId(id);
        // La herramienta sigue activa: se pueden colocar más; Esc termina.
    };

    // ── Curvas de nivel extraídas del plano CAD ──────────────────────────
    const openContourImport = () => setContourImportOpen(true);
    const closeContourImport = () => setContourImportOpen(false);

    /**
     * Crea un elemento `contour` por cada polilínea extraída de una capa del
     * DWG. El DXF 2D no trae la cota → se asigna `startElevationM` a la
     * primera y se suma `intervalM` en el orden en que vienen (útil si la
     * capa las tiene ordenadas; si no, el usuario ajusta cada cota).
     */
    const importCadContours = (
        polylines: Point2D[][],
        startElevationM: number,
        intervalM: number,
    ) => {
        const defaults = SITE_ELEMENT_DEFAULTS.contour;
        let lastId: string | null = null;
        polylines.forEach((waypoints, index) => {
            if (waypoints.length < 2) return;
            lastId = addSiteElement({
                type: 'contour',
                label: defaults.label,
                vertices: waypoints,
                style: defaults.style,
                baseElevationM: startElevationM + index * intervalM,
                visible: true,
            });
        });
        if (lastId) setSelectedElementId(lastId);
        setContourImportOpen(false);
    };

    // ── Puntos de un levantamiento topográfico (CSV Este/Norte/Cota) ─────
    const openSurveyImport = () => setSurveyImportOpen(true);
    const closeSurveyImport = () => setSurveyImportOpen(false);

    /**
     * Crea un `spot_elevation` por cada punto del levantamiento. El sitio
     * guarda Y hacia abajo → `y = -norte`. La cota va a `baseElevationM`.
     */
    const importSurveyPoints = (
        points: { este: number; norte: number; cota: number; desc: string }[],
    ) => {
        const defaults = SITE_ELEMENT_DEFAULTS.spot_elevation;
        const half = POINT_SIZE_M / 2;
        let lastId: string | null = null;
        for (const p of points) {
            const cx = p.este;
            const cy = -p.norte;
            lastId = addSiteElement({
                type: 'spot_elevation',
                label: p.desc || 'Cota',
                vertices: [
                    { x: cx - half, y: cy - half },
                    { x: cx + half, y: cy - half },
                    { x: cx + half, y: cy + half },
                    { x: cx - half, y: cy + half },
                ],
                style: defaults.style,
                baseElevationM: p.cota,
                visible: true,
            });
        }
        if (lastId) setSelectedElementId(lastId);
        setSurveyImportOpen(false);
    };

    /** Borra TODA la topografía (curvas de nivel + puntos acotados). */
    const clearTopography = () => {
        setSelectedElementId(null);
        removeSiteElementsByType(['contour', 'spot_elevation']);
    };

    const topographyCount =
        siteData?.elements.filter(
            (e) => e.type === 'contour' || e.type === 'spot_elevation',
        ).length ?? 0;

    // ── Plano importado (DXF/DWG) ────────────────────────────────────────
    const importedPlanUrl = siteData?.importedPlan
        ? sitePlanImageUrl(
              projectId,
              generalModuleId,
              siteData.importedPlan.updatedAt,
          )
        : undefined;

    const openPlanImport = () => setPlanImportOpen(true);
    const closePlanImport = () => setPlanImportOpen(false);

    /**
     * Registra el plano recién importado. El motor CAD lo renderiza en vivo y
     * sincroniza su cámara con el `viewBox`, así que `x/y/widthUnits/heightUnits`
     * ya no posicionan una imagen — se dejan neutros por compatibilidad del
     * tipo. `updatedAt` es lo que dispara la reapertura en `useSiteCadPlan`.
     */
    const handlePlanImported = (result: SitePlanImportResult) => {
        setImportedPlan({
            originalName: result.originalName,
            x: 0,
            y: 0,
            widthUnits: 1,
            heightUnits: 1,
            opacity: 0.85,
            visible: true,
            updatedAt: Date.now(),
        });
        setPlanImportOpen(false);
        startCalibratePlan();
    };

    /** Registra un clic de calibración (máximo 2 puntos — el tercero reinicia la medición). */
    const addCalibrationPoint = (point: Point2D) => {
        setCalibrationPoints((current) =>
            current.length >= 2 ? [point] : [...current, point],
        );
    };

    const cancelCalibration = () => {
        setCalibrationPoints([]);
        setActiveToolState('select');
    };

    /**
     * Fija la escala real del emplazamiento a partir de la distancia medida
     * (2 clics sobre el plano CAD, en unidades nativas) y su valor real en
     * metros. El resultado — `metros por unidad` — lo usa TODO el sistema
     * (áreas, perímetros, longitudes de alimentador, 3D). Es absoluto: medir
     * de nuevo sobrescribe la escala anterior, no la acumula.
     */
    const applyPlanCalibration = (realDistanceM: number) => {
        if (calibrationPoints.length !== 2) return;
        const [p1, p2] = calibrationPoints;
        const measured = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const metersPerUnit = computeLinearScaleFactor(measured, realDistanceM);
        if (metersPerUnit === null) return;
        setTerrainScale(metersPerUnit);
        setCalibrationPoints([]);
        setActiveToolState('select');
    };

    const isPolygonType = (type: SiteElementType) => POLYGON_TYPES.has(type);

    // Deep link desde "Ver trazado en emplazamiento" (diagrama de red): si
    // llega `?feederEdge=<id>` y ese alimentador todavía no tiene un trazado
    // dibujado, arranca directo la herramienta `draw_feeder` ya vinculada al
    // edge correcto — el usuario solo tiene que hacer clic en el plano. Si ya
    // existe un trazado para ese edge no hace nada (evita reabrir la
    // herramienta de dibujo sobre algo que ya está resuelto).
    useEffect(() => {
        if (!siteData) return;
        const params = new URLSearchParams(window.location.search);
        const feederEdgeId = params.get('feederEdge');
        if (!feederEdgeId) return;
        const alreadyLinked = siteData.feederPaths.some(
            (path) => path.networkEdgeId === feederEdgeId,
        );
        // Diferido al siguiente tick: activar la herramienta (setState) de
        // forma síncrona dentro del cuerpo del efecto dispara cascading
        // renders innecesarios.
        if (!alreadyLinked) queueMicrotask(() => startFeederTool(feederEdgeId));
        params.delete('feederEdge');
        const query = params.toString();
        window.history.replaceState(
            {},
            '',
            `${window.location.pathname}${query ? `?${query}` : ''}`,
        );
        // Debe correr una sola vez, apenas `siteData` está listo — no en
        // cada cambio posterior de herramienta o de trazados.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteData !== undefined]);

    return {
        // Contexto: lo usa `SiteCanvas2D` para abrir el plano CAD del
        // emplazamiento (`useSiteCadPlan`) sin cambiar su firma.
        projectId,
        generalModuleId,
        importedPlan: siteData?.importedPlan,
        siteData,
        terrainScaleM,
        terrainModeled,
        groundElevationAt,
        activeTool,
        startTool,
        startFeederTool,
        startCalibratePlan,
        pendingType,
        pendingNetworkEdgeId,
        selectedElementId,
        selectedElementIds: selectedIds,
        selectElement: setSelectedElementId,
        toggleElementSelection,
        selectElements,
        selectAllElements,
        selectedWireId,
        selectWire,
        removeSiteCircuitWaypoint,
        removeFeederPathWaypoint,
        clearAllCircuits,
        clearAllFeederPaths,
        deleteSelected,
        repeatSelected,
        moveSiteElements,
        drawing: pendingVertices.length > 0,
        pendingVertices,
        addVertex,
        finishDrawing,
        cancelDrawing,
        removeLastVertex,
        addFeederVertex,
        pendingModes,
        startCircuitTool,
        startCircuitContinuation,
        addCircuitVertex,
        pendingCircuitSourceId,
        pendingCircuitTgOutputId,
        pendingCircuitContinuationIds,
        nearestCircuitAnchor,
        addSiteCircuit,
        updateSiteCircuit,
        removeSiteCircuit,
        setSiteCircuitRoute,
        copySelectedElement,
        pasteElement,
        placePoint,
        isPolygonType,
        snapEnabled,
        setSnapEnabled,
        showSatellite,
        setShowSatellite,
        satelliteZoom,
        setSatelliteZoom,
        gridSizeM,
        addSiteElement,
        updateSiteElement,
        removeSiteElement,
        duplicateSiteElement,
        moveSiteVertex,
        moveSiteVertexGuarded,
        stairLandings,
        setStairLandings,
        baseLockActive: isBaseLockActive(siteData),
        setBaseLocked: setSiteBaseLocked,
        isFrozen: (element: SiteElement) => isElementFrozen(element, siteData),
        moveSiteElementsGuarded,
        removeSiteVertexGuarded,
        respectSpaces,
        setRespectSpaces,
        spaceWarning,
        spaceConflictIds,
        insertSiteVertex,
        removeSiteVertex,
        addFeederPath,
        updateFeederPath,
        removeFeederPath,
        setSiteLocation,
        toggleSiteLayer,
        lockSiteLayer,
        networkEdges: network.edges,
        networkEdgesLoading: network.loading,
        networkCalculations: network.network
            ? liveNetwork.calculations
            : network.calculations,
        placeProjectedLuminaires,
        planPanelAutoCircuits,
        applyAutoCircuits,
        /** Por cable de la planta: a qué tablero de la red alimenta y su ΔU. */
        circuitFeeds: liveNetwork.feeds,
        /** Por cable de la planta: la salida de tablero (motor CT V1) a la que pertenece. */
        circuitOutputs: Object.fromEntries(
            liveNetwork.outputRows.flatMap((row) =>
                row.circuitIds.map((circuitId) => [circuitId, row] as const),
            ),
        ),
        /** Tableros publicados por los módulos (para elegir a cuál llega un cable). */
        networkPorts: network.ports,
        importedPlanUrl,
        planImportOpen,
        openPlanImport,
        closePlanImport,
        contourImportOpen,
        openContourImport,
        closeContourImport,
        importCadContours,
        surveyImportOpen,
        openSurveyImport,
        closeSurveyImport,
        importSurveyPoints,
        clearTopography,
        topographyCount,
        handlePlanImported,
        updateImportedPlan,
        removeImportedPlan,
        calibrationPoints,
        addCalibrationPoint,
        applyPlanCalibration,
        cancelCalibration,
    };
}

export type UseSiteEditorReturn = ReturnType<typeof useSiteEditor>;
