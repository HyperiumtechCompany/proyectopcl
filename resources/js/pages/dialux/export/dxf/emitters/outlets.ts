import type { ElectricalDevice, JunctionBox } from '@/pages/dialux/hooks/types';
import { renderElectricalDeviceSymbol, renderJunctionBoxSymbol } from '../symbols/outletSymbols';
import type { DxfLines } from './primitives';

/**
 * Entidades de tomacorrientes/tableros por lámina — usa los mismos
 * renderers de símbolo de la Fase 5 que la leyenda de la Fase 7 (criterio de
 * cierre Fase 5). Ambos renderers ya dibujan su propia etiqueta de texto
 * como parte del símbolo (a diferencia de luminarias/interruptores), así que
 * no hace falta un `dxfText` aparte aquí.
 */

export function renderElectricalDeviceEntities(out: DxfLines, layer: string, devices: ElectricalDevice[]): void {
    for (const device of devices) {
        renderElectricalDeviceSymbol(out, layer, {
            x: device.x, y: device.y,
            // Negado: `rotation` se captura en espacio de pantalla (Y hacia
            // abajo), el DXF vive en espacio de mundo (Y hacia arriba) — ver
            // el mismo ajuste y motivo en `emitters/lighting.ts`.
            rotationDeg: -(device.rotation ?? 0),
            type: device.type,
            label: device.label,
        });
    }
}

export function renderJunctionBoxEntities(out: DxfLines, layer: string, junctionBoxes: JunctionBox[]): void {
    for (const box of junctionBoxes) {
        renderJunctionBoxSymbol(out, layer, { x: box.x, y: box.y });
    }
}
