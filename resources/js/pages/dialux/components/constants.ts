export const LUMINAIRE_BRANDS = [
    'Todas',
    'Philips',
    'Osram',
    'Ledvance',
    'GE',
    'Cree',
    'Zumtobel',
] as const;

export type LuminaireBrand = (typeof LUMINAIRE_BRANDS)[number];

export const WINDOW_MATERIALS = [
    'Todos',
    'Madera',
    'Aluminio',
    'PVC',
    'Vidrio',
    'Acero',
] as const;

export type WindowMaterial = (typeof WINDOW_MATERIALS)[number];
