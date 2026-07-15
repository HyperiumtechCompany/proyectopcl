import {
    detectScaleFromExtents,
    mutateScene,
    normalizeScaleConfig,
    rescaleDxfEntities,
    rescaleDxfExtents,
    rescaleSceneEntities,
} from '../storeHelpers';
import type { DxfEntity, DxfExtents, ScaleConfig } from '../types';
import type { EditorSlice } from './sliceTypes';

export interface ScaleDxfSlice {
    setScaleConfig: (
        scaleConfig: ScaleConfig,
        rescaleObjects?: boolean,
    ) => void;
    rescaleScene: (ratio: number) => void;

    // --- DXF Entities ---
    setDxfEntities: (entities: DxfEntity[], extents?: DxfExtents) => void;
    setDxfData: (entities: DxfEntity[], extents: DxfExtents | null) => void;
    detectScaleFromExtents: (extents: DxfExtents) => ScaleConfig;
    applyCalibration: (
        cadDistance: number,
        realDistance: number,
    ) => ScaleConfig | null;
    resetCalibration: () => ScaleConfig | null;
}

export const createScaleDxfSlice: EditorSlice<ScaleDxfSlice> = (set) => ({
    setScaleConfig: (scaleConfig, rescaleObjects = false) => {
        const normalized = normalizeScaleConfig(scaleConfig);
        set((state) => {
            const scene = state.activeScene();
            if (!scene) return state;

            if (rescaleObjects) {
                const prevScale = normalizeScaleConfig(scene.scaleConfig);
                const prevEffective =
                    prevScale.factor * prevScale.calibrationFactor;
                const nextEffective =
                    normalized.factor * normalized.calibrationFactor;

                if (
                    prevEffective > 0 &&
                    nextEffective > 0 &&
                    prevEffective !== nextEffective
                ) {
                    const ratio = nextEffective / prevEffective;
                    const mutated = mutateScene(state, (s) => ({
                        ...rescaleSceneEntities(s, ratio),
                        scaleConfig: normalized,
                    }));
                    return {
                        ...state,
                        ...mutated,
                        dxfEntities: state.dxfEntities
                            ? rescaleDxfEntities(state.dxfEntities, ratio)
                            : state.dxfEntities,
                        dxfExtents: state.dxfExtents
                            ? rescaleDxfExtents(state.dxfExtents, ratio)
                            : state.dxfExtents,
                    };
                }
            }

            return { ...state, ...mutateScene(state, (s) => ({ ...s, scaleConfig: normalized })) };
        });
    },

    rescaleScene: (ratio) => {
        if (ratio === 1) return;
        set((state) => ({
            ...state,
            ...mutateScene(state, (s) => rescaleSceneEntities(s, ratio)),
            dxfEntities: state.dxfEntities ? rescaleDxfEntities(state.dxfEntities, ratio) : state.dxfEntities,
            dxfExtents: state.dxfExtents ? rescaleDxfExtents(state.dxfExtents, ratio) : state.dxfExtents,
        }));
    },
    setDxfEntities: (entities: DxfEntity[], extents?: DxfExtents) => {
        set({ dxfEntities: entities, dxfExtents: extents ?? null });
    },
    setDxfData: (entities: DxfEntity[], extents: DxfExtents | null) =>
        set({ dxfEntities: entities, dxfExtents: extents }),

    detectScaleFromExtents: (extents) => detectScaleFromExtents(extents),
    applyCalibration: (cadDistance, realDistance) => {
        if (!(cadDistance > 0) || !(realDistance > 0)) return null;
        let nextScale: ScaleConfig | null = null;
        set((state) => {
            const scene = state.activeScene();
            if (!scene) return state;
            const normalized = normalizeScaleConfig(scene.scaleConfig);
            const desiredEffectiveScale = realDistance / cadDistance;
            const baseFactor =
                normalized.factor > 0 ? normalized.factor : 1;

            nextScale = {
                ...normalized,
                calibrationFactor: desiredEffectiveScale / baseFactor,
                isCalibrated: true,
            };

            const prevEffective =
                normalized.factor * normalized.calibrationFactor;
            const nextEffective =
                nextScale.factor * nextScale.calibrationFactor;

            if (
                prevEffective > 0 &&
                nextEffective > 0 &&
                prevEffective !== nextEffective
            ) {
                const ratio = nextEffective / prevEffective;
                return {
                    ...state,
                    ...mutateScene(state, (s) => ({ ...rescaleSceneEntities(s, ratio), scaleConfig: nextScale! })),
                    dxfEntities: state.dxfEntities ? rescaleDxfEntities(state.dxfEntities, ratio) : state.dxfEntities,
                    dxfExtents: state.dxfExtents ? rescaleDxfExtents(state.dxfExtents, ratio) : state.dxfExtents,
                };
            }

            return { ...state, ...mutateScene(state, (s) => ({ ...s, scaleConfig: nextScale! })) };
        });
        return nextScale;
    },
    resetCalibration: () => {
        let nextScale: ScaleConfig | null = null;
        set((state) => {
            const scene = state.activeScene();
            if (!scene) return state;
            const normalized = normalizeScaleConfig(scene.scaleConfig);
            nextScale = {
                ...normalized,
                calibrationFactor: 1,
                isCalibrated: false,
            };

            const prevEffective =
                normalized.factor * normalized.calibrationFactor;
            const nextEffective =
                nextScale.factor * nextScale.calibrationFactor;

            if (
                prevEffective > 0 &&
                nextEffective > 0 &&
                prevEffective !== nextEffective
            ) {
                const ratio = nextEffective / prevEffective;
                return {
                    ...state,
                    ...mutateScene(state, (s) => ({ ...rescaleSceneEntities(s, ratio), scaleConfig: nextScale! })),
                    dxfEntities: state.dxfEntities ? rescaleDxfEntities(state.dxfEntities, ratio) : state.dxfEntities,
                    dxfExtents: state.dxfExtents ? rescaleDxfExtents(state.dxfExtents, ratio) : state.dxfExtents,
                };
            }

            return { ...state, ...mutateScene(state, (s) => ({ ...s, scaleConfig: nextScale! })) };
        });
        return nextScale;
    },
});
