import { v4 as uuidv4 } from 'uuid';
import type {
    FeederPath,
    GeoLocation,
    ImportedSitePlan,
    Point2D,
    SiteData,
    SiteElement,
} from '../../v2/site/domain/types';
import { createDefaultSiteLayers } from '../../v2/site/lib/siteDefaults';
import type { EditorSlice } from './sliceTypes';

export interface SiteSlice {
    /** Crea `project.site` con valores por defecto si todavía no existe. */
    ensureSiteData: () => void;
    addSiteElement: (element: Omit<SiteElement, 'id'>) => string;
    updateSiteElement: (id: string, patch: Partial<SiteElement>) => void;
    removeSiteElement: (id: string) => void;
    duplicateSiteElement: (id: string) => string | null;
    moveSiteVertex: (
        elementId: string,
        vertexIndex: number,
        position: Point2D,
    ) => void;
    addFeederPath: (
        path: Omit<FeederPath, 'id' | 'calculatedLengthM'> & {
            calculatedLengthM?: number;
        },
    ) => string;
    updateFeederPath: (id: string, waypoints: Point2D[]) => void;
    removeFeederPath: (id: string) => void;
    setSiteLocation: (location: GeoLocation) => void;
    toggleSiteLayer: (layerId: string) => void;
    lockSiteLayer: (layerId: string, locked: boolean) => void;
    setImportedPlan: (plan: ImportedSitePlan) => void;
    updateImportedPlan: (patch: Partial<ImportedSitePlan>) => void;
    removeImportedPlan: () => void;
    /** Fija la escala real del emplazamiento: metros por unidad de coordenada. */
    setTerrainScale: (metersPerUnit: number) => void;
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
            return {
                project: {
                    ...state.project,
                    site: {
                        ...state.project.site,
                        elements: state.project.site.elements.map((item) =>
                            item.id === id ? { ...item, ...patch } : item,
                        ),
                    },
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
