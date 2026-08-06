import type { NormativeStandard } from '../roomLighting';
import type { Project, ProjectNormativeConfig, ProjectSiteSettings } from '../types';
import type { EditorSlice } from './sliceTypes';

export interface ProjectSlice {
    setProject: (project: Project) => void;
    setActiveScene: (sceneId: string) => void;
    setDefaultRoomNormativeStandard: (standard: NormativeStandard) => void;
    setProjectSiteSettings: (partial: Partial<ProjectSiteSettings>) => void;
    applyDefaultNormativeStandardToRooms: () => void;
    applyNormativeProfileToRooms: (opts: {
        standard: NormativeStandard;
        normaLux: number;
        ugrLimit?: number;
        uniformityTarget?: number;
        colorRenderingRa?: number;
        /** Altura del plano útil (m) verificada contra DIALux evo para la actividad elegida — ver `RawNormativeLeaf.workPlaneHeight`. `undefined` = no verificada, conserva la altura previa de cada ambiente. */
        usefulPlaneHeight?: number;
        normativeLabel?: string;
        normativeCategory?: string;
        normativeSection?: string;
        normativeActivity?: string;
        specificRequirements?: string | null;
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
    setProjectSiteSettings: (partial) =>
        set((state) => {
            if (!state.project) return state;
            return {
                project: {
                    ...state.project,
                    siteSettings: {
                        ...state.project.siteSettings,
                        ...partial,
                    },
                },
            };
        }),
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
                            const standardChanged =
                                room.normativeStandard !== defaultStandard;
                            if (!standardChanged) {
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
                                ambientConfigs: room.ambientConfigs
                                    ? Object.fromEntries(
                                          Object.entries(
                                              room.ambientConfigs,
                                          ).map(([key, config]) => [
                                              key,
                                              {
                                                  ...config,
                                                  normativeStandard:
                                                      defaultStandard,
                                                  normativeCategory: undefined,
                                                  normativeSection: undefined,
                                                  activity: undefined,
                                              },
                                          ]),
                                      )
                                    : room.ambientConfigs,
                            };
                        }),
                        walls: scene.walls.map((wall) =>
                            wall.normativeStandard === defaultStandard
                                ? wall
                                : {
                                      ...wall,
                                      normativeStandard: defaultStandard,
                                      normativeCategory: undefined,
                                      normativeSection: undefined,
                                      normativeActivity: undefined,
                                  },
                        ),
                    })),
                },
            };
        }),

    applyNormativeProfileToRooms: (opts) =>
        set((state) => {
            if (!state.project) return state;
            const scoped = opts.roomIds !== undefined;
            // La clasificación (baño, dormitorio, aula, etc.) nunca es global.
            // Exigir un alcance explícito evita imponer un único uso a todo el proyecto.
            if (!scoped || opts.roomIds!.length === 0) return state;
            return {
                ...state,
                // La norma elegida debe sobrevivir al desmontaje del panel y a
                // la recarga. El alcance solo controla qué ambientes cambian.
                defaultRoomNormativeStandard: scoped
                    ? state.defaultRoomNormativeStandard
                    : opts.standard,
                project: {
                    ...state.project,
                    defaultRoomNormativeStandard: scoped
                        ? state.project.defaultRoomNormativeStandard
                        : opts.standard,
                    scenes: state.project.scenes.map((scene) => ({
                        ...scene,
                        rooms: scene.rooms.map((room) => {
                            // Recintos (outer shells) and stairs have no lighting — skip them
                            if (scoped && !opts.roomIds!.includes(room.id))
                                return room;
                            const standardChanged =
                                room.normativeStandard !== opts.standard;
                            return {
                                ...room,
                                normativeStandard: opts.standard,
                                normativeCategory: opts.normativeCategory,
                                normativeSection: opts.normativeSection,
                                normativeActivity: opts.normativeActivity,
                                normativeLabel:
                                    opts.normativeLabel ??
                                    (standardChanged
                                        ? undefined
                                        : room.normativeLabel),
                                specificRequirements:
                                    opts.specificRequirements ??
                                    (standardChanged
                                        ? undefined
                                        : room.specificRequirements),
                                ambientConfigs: room.ambientConfigs
                                    ? Object.fromEntries(
                                          Object.entries(
                                              room.ambientConfigs,
                                          ).map(([key, config]) => [
                                              key,
                                              {
                                                  ...config,
                                                  normativeStandard:
                                                      opts.standard,
                                                  normativeCategory:
                                                      opts.normativeCategory,
                                                  normativeSection:
                                                      opts.normativeSection,
                                                  activity:
                                                      opts.normativeActivity,
                                                  illuminanceLux: opts.normaLux,
                                              },
                                          ]),
                                      )
                                    : room.ambientConfigs,
                                norma: opts.normaLux,
                                illuminanceLux: opts.normaLux,
                                ugrLimit: opts.ugrLimit ?? room.ugrLimit,
                                uniformityTarget:
                                    opts.uniformityTarget ??
                                    room.uniformityTarget,
                                colorRenderingRa:
                                    opts.colorRenderingRa ??
                                    room.colorRenderingRa,
                                usefulPlaneHeight:
                                    opts.usefulPlaneHeight ??
                                    room.usefulPlaneHeight,
                            };
                        }),
                        walls: scoped
                            ? scene.walls
                            : scene.walls.map((wall) => ({
                                  ...wall,
                                  normativeStandard: opts.standard,
                                  normativeCategory: opts.normativeCategory,
                                  normativeSection: opts.normativeSection,
                                  normativeActivity: opts.normativeActivity,
                                  illuminanceLux: opts.normaLux,
                              })),
                    })),
                },
            };
        }),
});
