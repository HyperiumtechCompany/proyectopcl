import type {
    SiteElementStyle,
    SiteElementType,
    SiteLayer,
} from '../domain/types';

export const SITE_ELEMENT_DEFAULTS: Record<
    SiteElementType,
    {
        label: string;
        style: SiteElementStyle;
        heightM?: number;
    }
> = {
    terrain: {
        label: 'Terreno',
        style: {
            fillColor: '#d4c5a9',
            strokeColor: '#a89270',
            opacity: 0.4,
            pattern: 'solid',
        },
    },
    building_block: {
        label: 'Edificio',
        style: {
            fillColor: '#64748b',
            strokeColor: '#334155',
            opacity: 0.8,
        },
        heightM: 9,
    },
    street: {
        label: 'Calle',
        style: {
            fillColor: '#6b7280',
            strokeColor: '#4b5563',
            pattern: 'solid',
        },
    },
    green_area: {
        label: 'Área verde',
        style: {
            fillColor: '#22c55e',
            strokeColor: '#16a34a',
            opacity: 0.5,
            pattern: 'grass',
        },
    },
    fence: {
        label: 'Cerco',
        style: {
            fillColor: '#92400e',
            strokeColor: '#78350f',
            strokeWidth: 3,
        },
        heightM: 3,
    },
    pool: {
        label: 'Piscina',
        style: {
            fillColor: '#38bdf8',
            strokeColor: '#0284c7',
            opacity: 0.6,
            pattern: 'water',
        },
    },
    ramp: {
        label: 'Rampa',
        style: { fillColor: '#a8a29e', strokeColor: '#78716c' },
    },
    court: {
        label: 'Cancha',
        style: { fillColor: '#84cc16', strokeColor: '#65a30d' },
    },
    parking: {
        label: 'Estacionamiento',
        style: {
            fillColor: '#9ca3af',
            strokeColor: '#6b7280',
            pattern: 'hatch',
        },
    },
    tg_location: {
        label: 'TG',
        style: { fillColor: '#f59e0b', strokeColor: '#d97706' },
    },
    transformer: {
        label: 'Transformador',
        style: { fillColor: '#ef4444', strokeColor: '#dc2626' },
    },
    pole: {
        label: 'Poste',
        style: { fillColor: '#fbbf24', strokeColor: '#f59e0b' },
    },
    gate: {
        label: 'Portón',
        style: {
            fillColor: '#a16207',
            strokeColor: '#854d0e',
            strokeWidth: 4,
        },
    },
    custom_zone: {
        label: 'Zona',
        style: {
            fillColor: '#c084fc',
            strokeColor: '#a855f7',
            opacity: 0.3,
        },
    },
};

/** Capas por defecto de un emplazamiento nuevo, agrupadas por tipo de elemento. */
export function createDefaultSiteLayers(): SiteLayer[] {
    return [
        {
            id: 'layer-terrain',
            label: 'Terreno',
            types: ['terrain'],
            visible: true,
            locked: false,
        },
        {
            id: 'layer-buildings',
            label: 'Edificaciones',
            types: ['building_block'],
            visible: true,
            locked: false,
        },
        {
            id: 'layer-surfaces',
            label: 'Calles y áreas verdes',
            types: ['street', 'green_area', 'parking', 'court', 'ramp'],
            visible: true,
            locked: false,
        },
        {
            id: 'layer-perimeter',
            label: 'Cercos y accesos',
            types: ['fence', 'gate'],
            visible: true,
            locked: false,
        },
        {
            id: 'layer-installations',
            label: 'Instalaciones',
            types: ['pool'],
            visible: true,
            locked: false,
        },
        {
            id: 'layer-electrical',
            label: 'Red eléctrica',
            types: ['tg_location', 'transformer', 'pole'],
            visible: true,
            locked: false,
        },
        {
            id: 'layer-custom',
            label: 'Zonas personalizadas',
            types: ['custom_zone'],
            visible: true,
            locked: false,
        },
    ];
}
