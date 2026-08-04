/**
 * Extraído de `MlightcadCanvas2D.tsx` (Fase 2, extracción conservadora — sin
 * tocar estado/efectos/interacción de ese componente). Datos estáticos puros,
 * sin lógica: mapeo de cursor por herramienta y los conjuntos de herramientas
 * de dibujo/interactivas.
 */

export const CURSOR_MAP: Record<string, string> = {
    select: 'default',
    room: 'crosshair',
    wall: 'crosshair',
    'education-wall': 'crosshair',
    window: 'cell',
    door: 'cell',
    canopy: 'crosshair',
    corridor: 'crosshair',
    stair: 'crosshair',
    fixture: 'cell',
    'fixture-grid': 'cell',
    switch: 'cell',
    wire: 'crosshair',
    measure: 'crosshair',
    'measure-area': 'crosshair',
    calibrate: 'crosshair',
    pan: 'grab',
    'elec-meter': 'cell',
    'elec-main-panel': 'cell',
    'elec-sub-panel': 'cell',
    'elec-transfer': 'cell',
    'elec-arrival': 'cell',
    'elec-junction-box': 'cell',
    'elec-earth-pit': 'cell',
    'elec-facp': 'cell',
    'elec-outlet-floor': 'cell',
    'elec-outlet-initial': 'cell',
    'elec-outlet-high-180': 'cell',
    'elec-outlet-floor-box': 'cell',
    'elec-outlet-waterproof': 'cell',
    'elec-outlet-ceiling': 'cell',
    'elec-outlet-rack': 'cell',
    'elec-water-heater': 'cell',
};

export const DRAWING_TOOLS = new Set([
    'room',
    'wall',
    'education-wall',
    'window',
    'door',
    'canopy',
    'corridor',
    'stair',
    'fixture',
    'fixture-grid',
    'switch',
    'wire',
    'measure',
    'measure-area',
    'calibrate',
    'pan',
    'elec-meter',
    'elec-main-panel',
    'elec-sub-panel',
    'elec-transfer',
    'elec-arrival',
    'elec-junction-box',
    'elec-earth-pit',
    'elec-facp',
    'elec-outlet-floor',
    'elec-outlet-initial',
    'elec-outlet-high-180',
    'elec-outlet-floor-box',
    'elec-outlet-waterproof',
    'elec-outlet-ceiling',
    'elec-outlet-rack',
    'elec-water-heater',
]);

export const INTERACTIVE_TOOLS = new Set([...DRAWING_TOOLS, 'select']);

/**
 * Herramientas que realmente necesitan OSNAP CAD (view.pick es costoso).
 * 'calibrate' excluido: solo necesita 2 puntos de referencia, el snap DXF
 * del store es suficiente y evita crashes con hatches sin boundaries.
 */
export const CAD_OSNAP_TOOLS = new Set([
    'measure',
    'calibrate',
    'room',
    'wall',
    'education-wall',
    'corridor',
    'stair',
    'canopy',
    'partition',
]);
