import { normalizeTgOutputs, TG_DIMENSION_DEFAULTS } from '../domain/tgPanel';
import type {
    SiteElementConfig,
    SiteElementStyle,
    SiteElementType,
    SiteLayer,
    SubPanelMount,
} from '../domain/types';

/**
 * Color de leyenda por variante de montaje de `sub_panel` — la leyenda CAD
 * real del cliente le da un color propio a cada una (no todas son rojas).
 * `SiteElementConfigFields` lo aplica al elegir el montaje.
 */
export const SUB_PANEL_MOUNT_STYLE: Record<SubPanelMount, SiteElementStyle> = {
    freestanding: { fillColor: '#ef4444', strokeColor: '#b91c1c' },
    surface: { fillColor: '#ef4444', strokeColor: '#b91c1c' },
    // "Tablero de distribución (interruptores con caja moldeada)" en la leyenda del cliente.
    molded_case: { fillColor: '#ef4444', strokeColor: '#b91c1c' },
    // "Sub tablero de distribución (interruptores con Caja Riel Din)".
    din_rail: { fillColor: '#d946ef', strokeColor: '#a21caf' },
    // "Sub tablero estabilizado".
    stabilized: { fillColor: '#eab308', strokeColor: '#a16207' },
    // "Sub tablero de control de bombas".
    pump_control: { fillColor: '#38bdf8', strokeColor: '#0284c7' },
};

/** Config por defecto para un objeto recién colocado (los que la tienen). */
export function defaultConfigFor(
    type: SiteElementType,
): SiteElementConfig | undefined {
    switch (type) {
        case 'gate':
            return {
                kind: 'gate',
                variant: 'swing',
                state: 'closed',
                openAngleDeg: 0,
                widthM: 4,
            };
        case 'pole':
            return {
                kind: 'pole',
                heightM: 8,
                armLengthM: 1.5,
                armDirectionDeg: 0,
                fixtures: 1,
                lumens: 3000,
                beamAngleDeg: 60,
                maintenanceFactor: 0.8,
                wattage: 60,
            };
        case 'transformer':
            return {
                kind: 'transformer',
                mount: 'pad',
                widthM: 2,
                depthM: 2,
                heightM: 2.2,
            };
        case 'tg_location':
            return {
                kind: 'tg',
                mount: 'floor',
                ...TG_DIMENSION_DEFAULTS,
                outputs: normalizeTgOutputs(),
            };
        case 'fence':
            return {
                kind: 'fence',
                slope: 'flat',
                endElevationM: 0,
                fenceKind: 'wall',
                conform: 'stepped',
                thicknessM: 0.25,
                panelLengthM: 2.5,
                closed: false,
            };
        case 'ramp':
            return {
                kind: 'ramp',
                fromElevationM: 0,
                toElevationM: 1,
                widthM: 1.5,
                shape: 'straight',
            };
        case 'stair':
            return {
                kind: 'stair',
                fromElevationM: 0,
                toElevationM: 1,
                widthM: 1.2,
                run: 'straight',
            };
        case 'terrace_platform':
            return { kind: 'terrace_platform', taludAngleDeg: 75 };
        case 'sidewalk':
            return { kind: 'sidewalk', heightM: 0.14, material: 'paving' };
        case 'canopy':
            return {
                kind: 'canopy',
                heightM: 3.2,
                roof: 'flat',
                translucent: false,
                columnSpacingM: 4,
                columnDiameterM: 0.25,
            };
        case 'court':
            return {
                kind: 'court',
                sport: 'multi',
                covered: false,
                roof: 'arched',
                roofHeightM: 7,
            };
        case 'green_area':
            return {
                kind: 'green_area',
                form: 'flat',
                terraces: 4,
                terraceRiseM: 0.4,
            };
        case 'tree':
            return {
                kind: 'tree',
                species: 'broadleaf',
                heightM: 6,
                crownM: 4,
            };
        case 'outlet':
            return { kind: 'outlet', heightM: 0.4 };
        case 'sub_panel':
            return {
                kind: 'sub_panel',
                mount: 'surface',
                widthM: 0.6,
                depthM: 0.25,
                heightM: 1.8,
            };
        case 'ats':
            return { kind: 'ats', widthM: 0.8, depthM: 0.3, heightM: 1.9 };
        case 'earth_pit':
            return { kind: 'earth_pit' };
        case 'mt_cell_arrival':
            return {
                kind: 'mt_cell_arrival',
                widthM: 1.05,
                depthM: 0.85,
                heightM: 2.2,
            };
        case 'mt_cell_protection':
            return {
                kind: 'mt_cell_protection',
                widthM: 1.05,
                depthM: 0.85,
                heightM: 2.2,
            };
        case 'mt_cell_transformation':
            return {
                kind: 'mt_cell_transformation',
                widthM: 1.5,
                depthM: 1.05,
                heightM: 2.2,
            };
        case 'cable_vault':
            return {
                kind: 'cable_vault',
                widthM: 0.65,
                depthM: 0.65,
                heightM: 0.95,
            };
        case 'pull_box':
            return {
                kind: 'pull_box',
                widthM: 0.1,
                depthM: 0.1,
                heightM: 0.05,
            };
        case 'generator':
            return {
                kind: 'generator',
                widthM: 3,
                depthM: 1.2,
                heightM: 1.8,
            };
        default:
            return undefined;
    }
}

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
    stair: {
        label: 'Escalera',
        style: { fillColor: '#cbd5e1', strokeColor: '#94a3b8' },
    },
    contour: {
        label: 'Curva',
        style: { fillColor: 'transparent', strokeColor: '#b45309' },
    },
    spot_elevation: {
        label: 'Cota',
        style: { fillColor: '#f97316', strokeColor: '#c2410c' },
    },
    canopy: {
        label: 'Techado',
        style: {
            fillColor: '#94a3b8',
            strokeColor: '#475569',
            opacity: 0.6,
        },
    },
    sidewalk: {
        label: 'Vereda',
        style: { fillColor: '#d6d3d1', strokeColor: '#a8a29e' },
    },
    tree: {
        label: 'Árbol',
        style: { fillColor: '#16a34a', strokeColor: '#14532d' },
    },
    terrace_platform: {
        label: 'Plataforma',
        style: {
            fillColor: '#c9a876',
            strokeColor: '#92400e',
        },
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
        // Leyenda real del cliente: "Tablero General (TG)" = azul.
        label: 'TG',
        style: { fillColor: '#2563eb', strokeColor: '#1d4ed8' },
    },
    transformer: {
        label: 'Transformador',
        style: { fillColor: '#ef4444', strokeColor: '#dc2626' },
    },
    pole: {
        label: 'Poste',
        style: { fillColor: '#fbbf24', strokeColor: '#f59e0b' },
    },
    outlet: {
        label: 'Tomacorriente',
        style: { fillColor: '#38bdf8', strokeColor: '#0284c7' },
    },
    sub_panel: {
        // Color base al colocarlo (antes de elegir montaje); cada montaje
        // tiene su propio color de leyenda real — ver SUB_PANEL_MOUNT_STYLE.
        label: 'TD',
        style: { fillColor: '#ef4444', strokeColor: '#b91c1c' },
    },
    ats: {
        // Leyenda real del cliente: "Transferencia Automática (ATS)" = naranja.
        label: 'ATS',
        style: { fillColor: '#f97316', strokeColor: '#c2410c' },
    },
    generator: {
        // Leyenda real del cliente: "Grupo electrógeno (GE)" = morado.
        label: 'GE',
        style: { fillColor: '#a855f7', strokeColor: '#7e22ce' },
    },
    earth_pit: {
        // Mismo color que v1 (earth_pit: '#eab308').
        label: 'PAT',
        style: { fillColor: '#eab308', strokeColor: '#a16207' },
    },
    mt_cell_arrival: {
        label: 'Celda de llegada',
        style: { fillColor: '#ef4444', strokeColor: '#b91c1c' },
    },
    mt_cell_protection: {
        label: 'Celda de protección',
        style: { fillColor: '#ef4444', strokeColor: '#b91c1c' },
    },
    mt_cell_transformation: {
        label: 'Celda de transformación',
        style: { fillColor: '#ef4444', strokeColor: '#b91c1c' },
    },
    cable_vault: {
        // Mismo color que v1 (junction_box: '#22c55e').
        label: 'Buzón de registro',
        style: { fillColor: '#22c55e', strokeColor: '#15803d' },
    },
    pull_box: {
        label: 'Caja de pase',
        style: { fillColor: '#22c55e', strokeColor: '#15803d' },
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
            types: ['building_block', 'canopy'],
            visible: true,
            locked: false,
        },
        {
            id: 'layer-surfaces',
            label: 'Calles y áreas verdes',
            types: [
                'street',
                'green_area',
                'parking',
                'court',
                'sidewalk',
                'tree',
                'ramp',
                'stair',
            ],
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
            types: [
                'tg_location',
                'transformer',
                'pole',
                'outlet',
                'sub_panel',
                'ats',
                'earth_pit',
                'mt_cell_arrival',
                'mt_cell_protection',
                'mt_cell_transformation',
                'cable_vault',
                'pull_box',
                'generator',
            ],
            visible: true,
            locked: false,
        },
        {
            id: 'layer-topography',
            label: 'Topografía (curvas de nivel)',
            types: ['contour', 'spot_elevation'],
            visible: true,
            locked: false,
        },
        {
            id: 'layer-terraces',
            label: 'Plataformas / terrazas',
            types: ['terrace_platform'],
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
