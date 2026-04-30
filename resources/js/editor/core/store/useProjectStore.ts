import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import type { ProjectData, SceneNode, Storey, Building, UUID } from '../models/types';
import { PointNode, WallNode } from '../models/types';

interface ProjectState {
    project: ProjectData | null;
    
    // Actions
    initEmptyProject: (name: string) => void;
    addNode: (node: SceneNode) => void;
    updateNode: (id: UUID, data: Partial<SceneNode>) => void;
    removeNode: (id: UUID) => void;
    
    // Helper accessors
    getActiveStorey: () => Storey | null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    project: null,

    initEmptyProject: (name: string) => {
        const defaultStoreyId = uuidv4();
        const defaultBuildingId = uuidv4();

        const defaultStorey: Storey = {
            id: defaultStoreyId,
            name: 'Piso 1',
            elevation: 0,
            height: 2.8,
            nodes: {},
        };

        const defaultBuilding: Building = {
            id: defaultBuildingId,
            name: 'Edificio Principal',
            storeys: { [defaultStoreyId]: defaultStorey },
            activeStoreyId: defaultStoreyId,
        };

        set({
            project: {
                id: uuidv4(),
                name,
                buildings: { [defaultBuildingId]: defaultBuilding },
                activeBuildingId: defaultBuildingId,
            },
        });
    },

    getActiveStorey: () => {
        const { project } = get();
        if (!project || !project.activeBuildingId) return null;
        const b = project.buildings[project.activeBuildingId];
        if (!b || !b.activeStoreyId) return null;
        return b.storeys[b.activeStoreyId] || null;
    },

    addNode: (node: SceneNode) => {
        set((state) => {
            if (!state.project || !state.project.activeBuildingId) return state;
            
            const bId = state.project.activeBuildingId;
            const b = state.project.buildings[bId];
            if (!b.activeStoreyId) return state;
            const sId = b.activeStoreyId;

            return {
                project: {
                    ...state.project,
                    buildings: {
                        ...state.project.buildings,
                        [bId]: {
                            ...b,
                            storeys: {
                                ...b.storeys,
                                [sId]: {
                                    ...b.storeys[sId],
                                    nodes: {
                                        ...b.storeys[sId].nodes,
                                        [node.id]: node,
                                    },
                                },
                            },
                        },
                    },
                },
            };
        });
    },

    updateNode: (id: UUID, data: Partial<SceneNode>) => {
        set((state) => {
             if (!state.project || !state.project.activeBuildingId) return state;
            
            const bId = state.project.activeBuildingId;
            const b = state.project.buildings[bId];
            if (!b.activeStoreyId) return state;
            const sId = b.activeStoreyId;

            const existingNode = b.storeys[sId].nodes[id];
            if (!existingNode) return state;

            return {
                project: {
                    ...state.project,
                    buildings: {
                        ...state.project.buildings,
                        [bId]: {
                            ...b,
                            storeys: {
                                ...b.storeys,
                                [sId]: {
                                    ...b.storeys[sId],
                                    nodes: {
                                        ...b.storeys[sId].nodes,
                                        [id]: { ...existingNode, ...data } as SceneNode,
                                    },
                                },
                            },
                        },
                    },
                },
            };
        });
    },

    removeNode: (id: UUID) => {
        set((state) => {
             if (!state.project || !state.project.activeBuildingId) return state;
            
            const bId = state.project.activeBuildingId;
            const b = state.project.buildings[bId];
            if (!b.activeStoreyId) return state;
            const sId = b.activeStoreyId;

            const newNodes = { ...b.storeys[sId].nodes };
            delete newNodes[id];

            return {
                project: {
                    ...state.project,
                    buildings: {
                        ...state.project.buildings,
                        [bId]: {
                            ...b,
                            storeys: {
                                ...b.storeys,
                                [sId]: {
                                    ...b.storeys[sId],
                                    nodes: newNodes,
                                },
                            },
                        },
                    },
                },
            };
        });
    }
}));
