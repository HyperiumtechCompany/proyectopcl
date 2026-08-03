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
    updateComplianceSummary: (
        summary: ProjectNormativeConfig['complianceSummary'],
    ) => void;
}

export const createProjectSlice: EditorSlice<ProjectSlice> = (set) => ({
    setProject: (project) =>
        set((state) => ({
            project,
            defaultRoomNormativeStandard:
                project.defaultRoomNormativeStandard ??
                state.defaultRoomNormativeStandard,
        })),
    setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),
    setDefaultRoomNormativeStandard: (standard) =>
        set((state) => ({
            defaultRoomNormativeStandard: standard,
            project: state.project
                ? {
                      ...state.project,
                      defaultRoomNormativeStandard: standard,
                  }
                : null,
        })),
    setProjectNormativeConfig: (config) =>
        set({ projectNormativeConfig: config }),
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
                    defaultRoomNormativeStandard: defaultStandard,
                    scenes: state.project.scenes.map((scene) => ({
                        ...scene,
                        rooms: scene.rooms.map((room) => {
                            if (
                                (room.normativeStandard ?? defaultStandard) ===
                                defaultStandard
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
                // La norma elegida debe sobrevivir al desmontaje del panel y a
                // la recarga. El alcance solo controla qué ambientes cambian.
                defaultRoomNormativeStandard: opts.standard,
                project: {
                    ...state.project,
                    defaultRoomNormativeStandard: opts.standard,
                    scenes: state.project.scenes.map((scene) => ({
                        ...scene,
                        rooms: scene.rooms.map((room) => {
                            // Recintos (outer shells) and stairs have no lighting — skip them
                            const isAmbiente =
                                room.roomType === 'ambient' ||
                                room.roomType === 'corridor';
                            if (!isAmbiente) return room;
                            if (scoped && !opts.roomIds!.includes(room.id))
                                return room;
                            return {
                                ...room,
                                normativeStandard: opts.standard,
                                norma: opts.normaLux,
                                illuminanceLux: opts.normaLux,
                                ugrLimit: opts.ugrLimit ?? room.ugrLimit,
                                uniformityTarget:
                                    opts.uniformityTarget ??
                                    room.uniformityTarget,
                                colorRenderingRa:
                                    opts.colorRenderingRa ??
                                    room.colorRenderingRa,
                            };
                        }),
                    })),
                },
            };
        }),
});
