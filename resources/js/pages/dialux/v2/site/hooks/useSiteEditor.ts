import { useEffect, useMemo, useState } from 'react';
import { computeLinearScaleFactor } from '@/pages/dialux/geometry/calibration';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    DEFAULT_SATELLITE_ZOOM,
    MAX_SATELLITE_ZOOM,
    MIN_SATELLITE_ZOOM,
} from '../domain/geoTiles';
import {
    sampleGroundElevation,
    terrainElevationPoints,
} from '../domain/terrainSurface';
import type {
    Point2D,
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
]);

/** Portapapeles del emplazamiento (Ctrl+C / Ctrl+V): vive en el módulo para sobrevivir a re-montajes del editor. */
let siteClipboard: { elements: SiteElement[]; pastes: number } | null = null;

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
    // Selección múltiple: `selectedElementId` es el ÚLTIMO seleccionado (el que muestra el panel de propiedades cuando hay uno solo).
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const selectedElementId =
        selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
    const setSelectedElementId = (id: string | null) =>
        setSelectedIds(id ? [id] : []);
    const [pendingVertices, setPendingVertices] = useState<Point2D[]>([]);
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

    /** Quita el último punto ya colocado mientras se dibuja (Ctrl+Z / Retroceso durante el trazo). */
    const removeLastVertex = () => {
        setPendingVertices((current) => current.slice(0, -1));
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

    const toggleElementSelection = (id: string) =>
        setSelectedIds((current) =>
            current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id],
        );
    const selectElements = (ids: string[]) => setSelectedIds(ids);
    /** Selecciona todo lo visible y no bloqueado (respeta las capas ocultas). */
    const selectAllElements = () => {
        const layers = siteData?.layers ?? [];
        setSelectedIds(
            (siteData?.elements ?? [])
                .filter((el) => {
                    if (el.visible === false || el.locked) return false;
                    const layer = layers.find((l) => l.types.includes(el.type));
                    return !layer || layer.visible;
                })
                .map((el) => el.id),
        );
    };
    const deleteSelected = (): number => {
        if (selectedIds.length === 0) return 0;
        const count = selectedIds.length;
        removeSiteElements(selectedIds);
        setSelectedIds([]);
        return count;
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
        // Un cerco es un tramo: con 2 puntos ya es válido.
        if (pendingVertices.length < (pendingType === 'fence' ? 2 : 3)) {
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
            config: defaultConfigFor(pendingType),
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
            config: defaultConfigFor(elementType),
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
        deleteSelected,
        repeatSelected,
        moveSiteElements,
        drawing: pendingVertices.length > 0,
        pendingVertices,
        addVertex,
        finishDrawing,
        cancelDrawing,
        removeLastVertex,
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
        networkCalculations: network.calculations,
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
