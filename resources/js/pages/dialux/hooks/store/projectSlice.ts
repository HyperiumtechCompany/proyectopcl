import type { NormativeStandard } from '../roomLighting';
import type { Project, ProjectNormativeConfig } from '../types';
import type { EditorSlice } from './sliceTypes';

export interface ProjectSlice {
    setProject: (project: Project) => void;
    setActiveScene: (sceneId: string) => void;
    setDefaultRoomNormativeStandard: (standard: NormativeStandard) => void;
    applyDefaultNormativeStandardToRooms: () => void;
    applyNormativeProfileToRooms: (opts: {
        standard: NormativeStandard;
        normaLux: number;
        ugrLimit?: number;
        uniformityTarget?: number;
        colorRenderingRa?: number;
        /** Si se especifica, el perfil solo se aplica a estos ambientes (por id), no a todo el proyecto. */
        roomIds?: string[];
    }) => void;
    setProjectNormativeConfig: (config: ProjectNormativeConfig | null) => void;
    updateComplianceSummary: (summary: ProjectNormativeConfig['complianceSummary']) => void;
}

export const createProjectSlice: EditorSlice<ProjectSlice> = (set) => ({
    setProject: (project) => set({ project }),
    setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),
    setDefaultRoomNormativeStandard: (standard) =>
        set({ defaultRoomNormativeStandard: standard }),
    setProjectNormativeConfig: (config) => set({ projectNormativeConfig: config }),
    updateComplianceSummary: (summary) =>
        set((state) => {
            if (!state.projectNormativeConfig) return state;
            return {
                projectNormativeConfig: {
                    ...state.projectNormativeConfig,
                    complianceSummary: summary,
                },
            };
        }),
    applyDefaultNormativeStandardToRooms: () =>
        set((state) => {
            if (!state.project) return state;

            const defaultStandard =
                state.defaultRoomNormativeStandard ?? 'en_12464';

            return {
                ...state,
                project: {
                    ...state.project,
                    scenes: state.project.scenes.map((scene) => ({
                        ...scene,
                        rooms: scene.rooms.map((room) => {
                            if (
                                (room.normativeStandard ??
                                    defaultStandard) === defaultStandard
                            ) {
                                return {
                                    ...room,
                                    normativeStandard: defaultStandard,
                                };
                            }

                            return {
                                ...room,
                                normativeStandard: defaultStandard,
                                normativeCategory: undefined,
                                normativeSection: undefined,
                                normativeActivity: undefined,
                                normativeLabel: undefined,
                                ugrLimit: undefined,
                                uniformityTarget: undefined,
                                colorRenderingRa: undefined,
                                specificRequirements: undefined,
                            };
                        }),
                    })),
                },
            };
        }),

    applyNormativeProfileToRooms: (opts) =>
        set((state) => {
            if (!state.project) return state;
            const scoped = opts.roomIds !== undefined;
            return {
                ...state,
                // Al aplicar a un ambiente puntual no tocamos el estándar por defecto
                // del proyecto (usado para ambientes nuevos) — solo ese ambiente cambia.
                ...(scoped ? {} : { defaultRoomNormativeStandard: opts.standard }),
                project: {
                    ...state.project,
                    scenes: state.project.scenes.map((scene) => ({
                        ...scene,
                        rooms: scene.rooms.map((room) => {
                            // Recintos (outer shells) and stairs have no lighting — skip them
                            const isAmbiente =
                                room.roomType === 'ambient' || room.roomType === 'corridor';
                            if (!isAmbiente) return room;
                            if (scoped && !opts.roomIds!.includes(room.id)) return room;
                            return {
                                ...room,
                                normativeStandard: opts.standard,
                                norma: opts.normaLux,
                                illuminanceLux: opts.normaLux,
                                ugrLimit: opts.ugrLimit ?? room.ugrLimit,
                                uniformityTarget: opts.uniformityTarget ?? room.uniformityTarget,
                                colorRenderingRa: opts.colorRenderingRa ?? room.colorRenderingRa,
                            };
                        }),
                    })),
                },
            };
        }),
});
