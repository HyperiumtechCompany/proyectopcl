import type { HitKind } from './hitTest';

export type WireFamily = 'lighting' | 'outlets';

const PANEL_DEVICE_TYPES = new Set([
    'main_panel',
    'sub_panel',
    'arrival_panel',
]);

export function isPanelWireNode(electricalDeviceType?: string): boolean {
    return Boolean(
        electricalDeviceType && PANEL_DEVICE_TYPES.has(electricalDeviceType),
    );
}

export function wireFamilyFromShortcut(altKey: boolean): WireFamily {
    return altKey ? 'outlets' : 'lighting';
}

export function acceptsWireNode(
    family: WireFamily | null,
    kind: HitKind,
    electricalDeviceType?: string,
): boolean {
    // TG/TD son fronteras de circuito: pueden alimentar tanto alumbrado como
    // tomacorrientes. Deben ser seleccionables desde cualquiera de las dos
    // familias, en ambos sentidos (tablero -> carga y carga -> tablero).
    if (kind === 'electrical-device' && isPanelWireNode(electricalDeviceType)) {
        return true;
    }

    if (family === 'lighting') {
        return kind === 'fixture' || kind === 'switch';
    }

    if (family === 'outlets') {
        return (
            kind === 'electrical-device' &&
            Boolean(electricalDeviceType?.startsWith('outlet_'))
        );
    }

    return true;
}
