import type { FeederRoute } from './types';

/**
 * Tipos de cable ofrecidos para alimentadores exteriores. Solo nombre y
 * material: la sección, la ampacidad y el precio salen del catálogo de
 * conductores del proyecto (pantalla Catálogos) — aquí NO se inventan
 * valores de tablas de fabricante ni del CNE.
 */
export interface FeederCablePreset {
    id: string;
    label: string;
    material: 'copper' | 'aluminium';
    kinds: Array<FeederRoute['kind'] | 'flat'>;
    note: string;
}

export const FEEDER_CABLE_PRESETS: FeederCablePreset[] = [
    {
        id: 'CAAI',
        label: 'CAAI — autoportante de aluminio (red de baja tensión)',
        material: 'aluminium',
        kinds: ['aerial'],
        note: 'Cable autoportante de aluminio aislado, típico de redes aéreas de distribución en Perú.',
    },
    {
        id: 'NA2XSY',
        label: 'NA2XSY — aluminio XLPE (enterrado)',
        material: 'aluminium',
        kinds: ['underground', 'flat'],
        note: 'Aluminio con aislamiento XLPE y cubierta PVC.',
    },
    {
        id: 'N2XSY',
        label: 'N2XSY — cobre XLPE',
        material: 'copper',
        kinds: ['underground', 'aerial', 'flat'],
        note: 'Cobre con aislamiento XLPE y cubierta PVC.',
    },
    {
        id: 'NYY',
        label: 'NYY — cobre PVC (enterrado / bandeja)',
        material: 'copper',
        kinds: ['underground', 'flat'],
        note: 'Cobre con aislamiento y cubierta de PVC.',
    },
    {
        id: 'N2XOH',
        label: 'N2XOH — cobre libre de halógenos',
        material: 'copper',
        kinds: ['underground', 'flat'],
        note: 'Cobre XLPE con cubierta LSOH.',
    },
    {
        id: 'THW-90',
        label: 'THW-90 — cobre (en tubería)',
        material: 'copper',
        kinds: ['underground', 'flat'],
        note: 'Cobre en tubería; único tipo con ampacidades cargadas por defecto en el catálogo.',
    },
];

export function cablePresetsFor(kind: FeederRoute['kind'] | 'flat') {
    return FEEDER_CABLE_PRESETS.filter((preset) => preset.kinds.includes(kind));
}

/** Material y cable que se proponen al elegir el tipo de tendido (el usuario puede cambiarlos). */
export function defaultCableForKind(
    kind: FeederRoute['kind'],
): Pick<FeederRoute, 'conductorMaterial' | 'cableType'> {
    return kind === 'aerial'
        ? { conductorMaterial: 'aluminium', cableType: 'CAAI' }
        : {};
}
