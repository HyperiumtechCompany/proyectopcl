import { v4 as uuidv4 } from 'uuid';
import type {
    FeederPath,
    FeederRoute,
    GeoLocation,
    ImportedSitePlan,
    Point2D,
    SiteCircuit,
    SiteData,
    SiteElement,
    SiteElementType,
    SiteNormRegion,
} from '../../v2/site/domain/types';
import { followMovedElements } from '../../v2/site/domain/wireFollow';
import { createDefaultSiteLayers } from '../../v2/site/lib/siteDefaults';
import type { EditorSlice } from './sliceTypes';

export interface SiteSlice {
    /** Crea `project.site` con valores por defecto si todavía no existe. */
    ensureSiteData: () => void;
    addSiteElement: (element: Omit<SiteElement, 'id'>) => string;
    updateSiteElement: (id: string, patch: Partial<SiteElement>) => void;
    removeSiteElement: (id: string) => void;
    removeSiteElementsByType: (types: SiteElementType[]) => void;
    duplicateSiteElement: (id: string) => string | null;
    moveSiteVertex: (
        elementId: string,
        vertexIndex: number,
        position: Point2D,
    ) => void;
    /** Inserta un vértice nuevo en `afterIndex + 1` (para partir un tramo/lado en dos). */
    insertSiteVertex: (
        elementId: string,
        afterIndex: number,
        position: Point2D,
    ) => void;
    /** Quita un vértice — no baja de 3 (mínimo para que siga siendo un polígono válido). */
    removeSiteVertex: (elementId: string, vertexIndex: number) => void;
    /** Agrega varios elementos en UN solo cambio (un paso de deshacer). Devuelve sus ids, en orden. */
    addSiteElements: (elements: Array<Omit<SiteElement, 'id'>>) => string[];
    /** Desplaza varios elementos: `origins` = vértices de partida por id; `dx, dy` en unidades de plano. */
    moveSiteElements: (
        origins: Record<string, Point2D[]>,
        dx: number,
        dy: number,
    ) => void;
    removeSiteElements: (ids: string[]) => void;
    addFeederPath: (
        path: Omit<FeederPath, 'id' | 'calculatedLengthM'> & {
            calculatedLengthM?: number;
        },
    ) => string;
    updateFeederPath: (id: string, waypoints: Point2D[]) => void;
    removeFeederPath: (id: string) => void;
    /** Tendido aéreo/subterráneo de un alimentador (`undefined` = plano). */
    setFeederRoute: (
        id: string,
        route: FeederRoute | undefined,
        segmentModes?: Array<'aerial' | 'underground'>,
    ) => void;
    /** Cableado de instalaciones (postes, tomacorrientes, tableros…) — no es un alimentador de la red troncal. */
    addSiteCircuit: (
        circuit: Omit<SiteCircuit, 'id' | 'calculatedLengthM'> & {
            calculatedLengthM?: number;
        },
    ) => string;
    updateSiteCircuit: (id: string, patch: Partial<SiteCircuit>) => void;
    removeSiteCircuit: (id: string) => void;
    setSiteCircuitRoute: (
        id: string,
        route: FeederRoute | undefined,
        segmentModes?: Array<'aerial' | 'underground'>,
    ) => void;
    setSiteLocation: (location: GeoLocation) => void;
    toggleSiteLayer: (layerId: string) => void;
    lockSiteLayer: (layerId: string, locked: boolean) => void;
    setImportedPlan: (plan: ImportedSitePlan) => void;
    updateImportedPlan: (patch: Partial<ImportedSitePlan>) => void;
    removeImportedPlan: () => void;
    /** Fija la escala real del emplazamiento: metros por unidad de coordenada. */
    setTerrainScale: (metersPerUnit: number) => void;
    /** Regiones normativas activas para verificar iluminación exterior. */
    setSiteNormRegions: (regions: SiteNormRegion[]) => void;
    /** Fija el bloqueo de la base (terreno, cerco, plataformas). */
    setSiteBaseLocked: (locked: boolean) => void;
}

function defaultSiteData(): SiteData {
    return {
        schemaVersion: 1,
        terrainScaleM: 1,
        gridSizeM: 5,
        canvasWidth: 2000,
        canvasHeight: 1200,
        elements: [],
        feederPaths: [],
        circuits: [],
        layers: createDefaultSiteLayers(),
    };
}

function polylineLength(points: Point2D[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += Math.hypot(
            points[i].x - points[i - 1].x,
            points[i].y - points[i - 1].y,
        );
    }
    return total;
}

export const createSiteSlice: EditorSlice<SiteSlice> = (set, get) => ({
    ensureSiteData: () =>
        set((state) => {
            if (!state.project || state.project.site) return state;
            return {
                project: { ...state.project, site: defaultSiteData() },
            };
        }),
    addSiteElement: (element) => {
        const id = uuidv4();
        set((state) => {
            if (!state.project) return state;
            const site = state.project.site ?? defaultSiteData();
            return {
                project: {
                    ...state.project,
                    site: {
                        ...site,
                        elements: [...site.elements, { ...element, id }],
                    },
                },
            };
        });
        return id;
    },
    updateSiteElement: (id, patch) =>
        set((state) => {
            if (!state.project?.site) return state;
            const site = {
                ...state.project.site,
                elements: state.project.site.elements.map((item) =>
                    item.id === id ? { ...item, ...patch } : item,
                ),
            };
            return {
                project: {
                    ...state.project,
                    // Los cables que pasan por el objeto lo siguen al moverlo.
                    site: patch.vertices
                        ? followMovedElements(
                              state.project.site.elements,
                              site,
                              [id],
                          )
                        : site,
                },
            };
        }),
    removeSiteElement: (id) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        elements: state.project.site.elements.filter(
                            (item) => item.id !== id,
                        ),
                    },
                },
            };
        }),
    removeSiteElementsByType: (types) =>
        set((state) => {
            if (!state.project?.site) return state;
            const drop = new Set(types);
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        elements: state.project.site.elements.filter(
                            (item) => !drop.has(item.type),
                        ),
                    },
                },
            };
        }),
    duplicateSiteElement: (id) => {
        const site = get().project?.site;
        const source = site?.elements.find((item) => item.id === id);
        if (!source) return null;
        const newId = uuidv4();
        const offset = 20;
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        elements: [
                            ...state.project.site.elements,
                            {
                                ...source,
                                id: newId,
                                label: `${source.label} (copia)`,
                                vertices: source.vertices.map((vertex) => ({
                                    x: vertex.x + offset,
                                    y: vertex.y + offset,
                                })),
                            },
                        ],
                    },
                },
            };
        });
        return newId;
    },
    moveSiteVertex: (elementId, vertexIndex, position) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        elements: state.project.site.elements.map((item) => {
                            if (item.id !== elementId) return item;
                            const vertices = [...item.vertices];
                            if (
                                vertexIndex < 0 ||
                                vertexIndex >= vertices.length
                            ) {
                                return item;
                            }
                            vertices[vertexIndex] = position;
                            return { ...item, vertices };
                        }),
                    },
                },
            };
        }),
    insertSiteVertex: (elementId, afterIndex, position) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        elements: state.project.site.elements.map((item) => {
                            if (item.id !== elementId) return item;
                            const vertices = [...item.vertices];
                            const index = Math.min(
                                Math.max(afterIndex + 1, 0),
                                vertices.length,
                            );
                            vertices.splice(index, 0, position);
                            return { ...item, vertices };
                        }),
                    },
                },
            };
        }),
    removeSiteVertex: (elementId, vertexIndex) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        elements: state.project.site.elements.map((item) => {
                            if (item.id !== elementId) return item;
                            if (item.vertices.length <= 3) return item;
                            if (
                                vertexIndex < 0 ||
                                vertexIndex >= item.vertices.length
                            ) {
                                return item;
                            }
                            return {
                                ...item,
                                vertices: item.vertices.filter(
                                    (_, i) => i !== vertexIndex,
                                ),
                            };
                        }),
                    },
                },
            };
        }),
    addSiteElements: (elements) => {
        const ids = elements.map(() => uuidv4());
        set((state) => {
            if (!state.project) return state;
            const site = state.project.site ?? defaultSiteData();
            return {
                project: {
                    ...state.project,
                    site: {
                        ...site,
                        elements: [
                            ...site.elements,
                            ...elements.map((element, index) => ({
                                ...element,
                                id: ids[index],
                            })),
                        ],
                    },
                },
            };
        });
        return ids;
    },
    moveSiteElements: (origins, dx, dy) =>
        set((state) => {
            if (!state.project?.site) return state;
            const site = {
                ...state.project.site,
                elements: state.project.site.elements.map((item) => {
                    const origin = origins[item.id];
                    if (!origin) return item;
                    return {
                        ...item,
                        vertices: origin.map((vertex) => ({
                            x: vertex.x + dx,
                            y: vertex.y + dy,
                        })),
                    };
                }),
            };
            return {
                project: {
                    ...state.project,
                    // Los cables que pasan por los objetos arrastrados los siguen.
                    site: followMovedElements(
                        state.project.site.elements,
                        site,
                        Object.keys(origins),
                    ),
                },
            };
        }),
    removeSiteElements: (ids) =>
        set((state) => {
            if (!state.project?.site) return state;
            const drop = new Set(ids);
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        elements: state.project.site.elements.filter(
                            (item) => !drop.has(item.id),
                        ),
                    },
                },
            };
        }),
    addFeederPath: (path) => {
        const id = uuidv4();
        set((state) => {
            if (!state.project) return state;
            const site = state.project.site ?? defaultSiteData();
            return {
                project: {
                    ...state.project,
                    site: {
                        ...site,
                        feederPaths: [
                            ...site.feederPaths,
                            {
                                ...path,
                                id,
                                calculatedLengthM:
                                    path.calculatedLengthM ??
                                    polylineLength(path.waypoints),
                            },
                        ],
                    },
                },
            };
        });
        return id;
    },
    updateFeederPath: (id, waypoints) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        feederPaths: state.project.site.feederPaths.map(
                            (path) =>
                                path.id === id
                                    ? {
                                          ...path,
                                          waypoints,
                                          calculatedLengthM:
                                              polylineLength(waypoints),
                                      }
                                    : path,
                        ),
                    },
                },
            };
        }),
    setFeederRoute: (id, route, segmentModes) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        feederPaths: state.project.site.feederPaths.map((path) =>
                            path.id === id ? { ...path, route, segmentModes } : path,
                        ),
                    },
                },
            };
        }),
    removeFeederPath: (id) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        feederPaths: state.project.site.feederPaths.filter(
                            (path) => path.id !== id,
                        ),
                    },
                },
            };
        }),
    addSiteCircuit: (circuit) => {
        const id = uuidv4();
        set((state) => {
            if (!state.project) return state;
            const site = state.project.site ?? defaultSiteData();
            return {
                project: {
                    ...state.project,
                    site: {
                        ...site,
                        circuits: [
                            ...(site.circuits ?? []),
                            {
                                ...circuit,
                                id,
                                calculatedLengthM:
                                    circuit.calculatedLengthM ??
                                    polylineLength(circuit.waypoints),
                            },
                        ],
                    },
                },
            };
        });
        return id;
    },
    updateSiteCircuit: (id, patch) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        circuits: (state.project.site.circuits ?? []).map(
                            (circuit) =>
                                circuit.id === id
                                    ? {
                                          ...circuit,
                                          ...patch,
                                          calculatedLengthM: patch.waypoints
                                              ? polylineLength(patch.waypoints)
                                              : (patch.calculatedLengthM ??
                                                circuit.calculatedLengthM),
                                      }
                                    : circuit,
                        ),
                    },
                },
            };
        }),
    removeSiteCircuit: (id) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        circuits: (state.project.site.circuits ?? []).filter(
                            (circuit) => circuit.id !== id,
                        ),
                    },
                },
            };
        }),
    setSiteCircuitRoute: (id, route, segmentModes) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        circuits: (state.project.site.circuits ?? []).map(
                            (circuit) =>
                                circuit.id === id
                                    ? { ...circuit, route, segmentModes }
                                    : circuit,
                        ),
                    },
                },
            };
        }),
    setSiteLocation: (location) =>
        set((state) => {
            if (!state.project) return state;
            const site = state.project.site ?? defaultSiteData();
            return {
                project: { ...state.project, site: { ...site, location } },
            };
        }),
    toggleSiteLayer: (layerId) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        layers: state.project.site.layers.map((layer) =>
                            layer.id === layerId
                                ? { ...layer, visible: !layer.visible }
                                : layer,
                        ),
                    },
                },
            };
        }),
    lockSiteLayer: (layerId, locked) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        layers: state.project.site.layers.map((layer) =>
                            layer.id === layerId ? { ...layer, locked } : layer,
                        ),
                    },
                },
            };
        }),
    setImportedPlan: (plan) =>
        set((state) => {
            if (!state.project) return state;
            const site = state.project.site ?? defaultSiteData();
            return {
                project: {
                    ...state.project,
                    site: { ...site, importedPlan: plan },
                },
            };
        }),
    updateImportedPlan: (patch) =>
        set((state) => {
            if (!state.project?.site?.importedPlan) return state;
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        importedPlan: {
                            ...state.project.site.importedPlan,
                            ...patch,
                        },
                    },
                },
            };
        }),
    removeImportedPlan: () =>
        set((state) => {
            if (!state.project?.site?.importedPlan) return state;
            const site = { ...state.project.site };
            delete site.importedPlan;
            return {
                project: { ...state.project, site },
            };
        }),
    setSiteBaseLocked: (locked) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: { ...state.project.site, baseLocked: locked },
                },
            };
        }),
    setSiteNormRegions: (regions) =>
        set((state) => {
            if (!state.project?.site) return state;
            return {
                project: {
                    ...state.project,
                    site: { ...state.project.site, normRegions: regions },
                },
            };
        }),
    setTerrainScale: (metersPerUnit) =>
        set((state) => {
            if (!state.project?.site) return state;
            if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) {
                return state;
            }
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        terrainScaleM: metersPerUnit,
                    },
                },
            };
        }),
});
