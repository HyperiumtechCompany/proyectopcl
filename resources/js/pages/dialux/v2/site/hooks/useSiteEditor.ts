import { useEffect, useState } from 'react';
import { computeLinearScaleFactor } from '@/pages/dialux/geometry/calibration';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    DEFAULT_SATELLITE_ZOOM,
    MAX_SATELLITE_ZOOM,
    MIN_SATELLITE_ZOOM,
} from '../domain/geoTiles';
import type { Point2D, SiteElementType, SiteTool } from '../domain/types';
import { sitePlanImageUrl } from '../lib/planImport';
import { SITE_ELEMENT_DEFAULTS } from '../lib/siteDefaults';
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
    'court',
    'parking',
    'building_block',
    'custom_zone',
]);

/** Tipos que se colocan con un solo clic (equipo puntual, tamaño fijo por defecto). */
const POINT_SIZE_M = 4;

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
    const duplicateSiteElement = useEditorStore(
        (state) => state.duplicateSiteElement,
    );
    const moveSiteVertex = useEditorStore((state) => state.moveSiteVertex);
    const addFeederPath = useEditorStore((state) => state.addFeederPath);
    const updateFeederPath = useEditorStore((state) => state.updateFeederPath);
    const removeFeederPath = useEditorStore((state) => state.removeFeederPath);
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

    const [activeTool, setActiveToolState] = useState<SiteTool>('select');
    const [pendingType, setPendingType] = useState<SiteElementType>('terrain');
    const [pendingNetworkEdgeId, setPendingNetworkEdgeId] = useState<
        string | null
    >(null);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(
        null,
    );
    const [pendingVertices, setPendingVertices] = useState<Point2D[]>([]);
    const [calibrationPoints, setCalibrationPoints] = useState<Point2D[]>([]);
    const [planImportOpen, setPlanImportOpen] = useState(false);
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

    /** Cambia de herramienta y, si es una de dibujo, fija qué tipo va a crear. */
    const startTool = (tool: SiteTool, elementType?: SiteElementType) => {
        setPendingVertices([]);
        setPendingNetworkEdgeId(null);
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

    const addVertex = (point: Point2D) => {
        setPendingVertices((current) => [...current, point]);
    };

    const cancelDrawing = () => {
        setPendingVertices([]);
        setPendingNetworkEdgeId(null);
    };

    const finishDrawing = () => {
        if (activeTool === 'draw_feeder') {
            if (pendingVertices.length < 2 || !pendingNetworkEdgeId) {
                cancelDrawing();
                return;
            }
            const label = network.edges.find(
                (edge) => edge.id === pendingNetworkEdgeId,
            )?.label;
            addFeederPath({
                networkEdgeId: pendingNetworkEdgeId,
                waypoints: pendingVertices,
                label,
            });
            setPendingVertices([]);
            setPendingNetworkEdgeId(null);
            setActiveToolState('select');
            return;
        }
        if (pendingVertices.length < 3) {
            cancelDrawing();
            return;
        }
        const defaults = SITE_ELEMENT_DEFAULTS[pendingType];
        const id = addSiteElement({
            type: pendingType,
            label: defaults.label,
            vertices: pendingVertices,
            style: defaults.style,
            heightM: defaults.heightM,
            visible: true,
        });
        setPendingVertices([]);
        setSelectedElementId(id);
        setActiveToolState('select');
    };

    /** Coloca un equipo puntual (TG, transformador, poste, portón) con un solo clic. */
    const placePoint = (point: Point2D, elementType: SiteElementType) => {
        const center = point;
        const half = POINT_SIZE_M / 2;
        const defaults = SITE_ELEMENT_DEFAULTS[elementType];
        const id = addSiteElement({
            type: elementType,
            label: defaults.label,
            vertices: [
                { x: center.x - half, y: center.y - half },
                { x: center.x + half, y: center.y - half },
                { x: center.x + half, y: center.y + half },
                { x: center.x - half, y: center.y + half },
            ],
            style: defaults.style,
            heightM: defaults.heightM,
            visible: true,
        });
        setSelectedElementId(id);
        setActiveToolState('select');
    };

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
        activeTool,
        startTool,
        startFeederTool,
        startCalibratePlan,
        pendingType,
        pendingNetworkEdgeId,
        selectedElementId,
        selectElement: setSelectedElementId,
        drawing: pendingVertices.length > 0,
        pendingVertices,
        addVertex,
        finishDrawing,
        cancelDrawing,
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
        addFeederPath,
        updateFeederPath,
        removeFeederPath,
        setSiteLocation,
        toggleSiteLayer,
        lockSiteLayer,
        networkEdges: network.edges,
        networkEdgesLoading: network.loading,
        networkCalculations: network.calculations,
        importedPlanUrl,
        planImportOpen,
        openPlanImport,
        closePlanImport,
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
