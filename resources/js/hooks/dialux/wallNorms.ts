import type { Wall } from './types';

export type PeruWallMaterial = 'brick' | 'adobe';
export type PeruWallUse = 'housing' | 'generic';

export interface PeruWallPreset {
    material: PeruWallMaterial;
    use: PeruWallUse;
    label: string;
    minThickness: number;
    recommendedThickness: number;
    minHeight: number;
    recommendedHeight: number;
    mortarJointMin: number;
    mortarJointMax: number;
    notes: string[];
}

const BASE_JOINT_MIN = 0.01;
const BASE_JOINT_MAX = 0.015;

export const PERU_WALL_PRESETS: Record<
    PeruWallMaterial,
    Record<PeruWallUse, PeruWallPreset>
> = {
    brick: {
        housing: {
            material: 'brick',
            use: 'housing',
            label: 'Ladrillo - Vivienda',
            minThickness: 0.12,
            recommendedThickness: 0.13,
            minHeight: 2.3,
            recommendedHeight: 2.4,
            mortarJointMin: BASE_JOINT_MIN,
            mortarJointMax: BASE_JOINT_MAX,
            notes: [
                'Altura libre minima de ambientes de vivienda: 2.30 m.',
                'Para tabiqueria de ladrillo se usa 0.12 a 0.13 m como referencia practica.',
                'Las juntas de mortero se controlan entre 10 mm y 15 mm.',
            ],
        },
        generic: {
            material: 'brick',
            use: 'generic',
            label: 'Ladrillo - Generico',
            minThickness: 0.12,
            recommendedThickness: 0.13,
            minHeight: 2.3,
            recommendedHeight: 2.6,
            mortarJointMin: BASE_JOINT_MIN,
            mortarJointMax: BASE_JOINT_MAX,
            notes: [
                'Preset general para ladrillo en Peru.',
                'Las juntas de mortero se controlan entre 10 mm y 15 mm.',
            ],
        },
    },
    adobe: {
        housing: {
            material: 'adobe',
            use: 'housing',
            label: 'Adobe - Vivienda',
            minThickness: 0.4,
            recommendedThickness: 0.4,
            minHeight: 2.3,
            recommendedHeight: 2.4,
            mortarJointMin: BASE_JOINT_MIN,
            mortarJointMax: BASE_JOINT_MAX,
            notes: [
                'En adobe, la app adopta 0.40 m como minimo operativo.',
                'Para vivienda se mantiene la referencia de altura minima de ambientes de 2.30 m.',
                'Las juntas se muestran en el rango operativo de 10 mm a 15 mm.',
            ],
        },
        generic: {
            material: 'adobe',
            use: 'generic',
            label: 'Adobe - Generico',
            minThickness: 0.4,
            recommendedThickness: 0.45,
            minHeight: 2.3,
            recommendedHeight: 2.4,
            mortarJointMin: BASE_JOINT_MIN,
            mortarJointMax: BASE_JOINT_MAX,
            notes: [
                'En adobe, la app adopta 0.40 m como minimo operativo.',
                'Las juntas se muestran en el rango operativo de 10 mm a 15 mm.',
            ],
        },
    },
};

export function getPeruWallPreset(
    material: PeruWallMaterial = 'brick',
    use: PeruWallUse = 'housing',
): PeruWallPreset {
    return PERU_WALL_PRESETS[material][use];
}

export function getWallPresetFromWall(wall: Wall): PeruWallPreset {
    return getPeruWallPreset(
        wall.material ?? 'brick',
        wall.normativeUse ?? 'housing',
    );
}
