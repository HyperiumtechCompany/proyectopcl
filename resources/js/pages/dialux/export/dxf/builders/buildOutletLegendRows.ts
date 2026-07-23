import {
    ELECTRICAL_DEVICE_DEFAULTS,
    type ElectricalDevice, type ElectricalDeviceType, type JunctionBox,
} from '@/pages/dialux/hooks/types';
import type { DxfDisciplineEntities, DxfLegendRow } from '../domain/types';
import { buildCableRows, groupBy } from './buildLightingLegendRows';

/**
 * Leyenda de tomacorrientes (plan maestro, sección 10). Igual que la de
 * alumbrado (Fase 6), se construye SOLO de entidades ya clasificadas como
 * 'outlets'/'shared' (Fase 2) — nunca mezcla luminarias ni interruptores de
 * iluminación (criterio de cierre).
 */

/**
 * Código por tipo (sección 10.2). `outlet_floor` y `outlet_waterproof`
 * comparten el mismo `label` por defecto ("T") en `ELECTRICAL_DEVICE_DEFAULTS`
 * — deben quedar visualmente relacionados pero NO idénticos, o la leyenda no
 * podría distinguir una toma común de una impermeable.
 */
const OUTLET_TYPE_CODES: Record<ElectricalDeviceType, string> = {
    outlet_floor: 'T',
    outlet_initial: 'TI',
    outlet_high_180: 'TA',
    outlet_floor_box: 'TP',
    outlet_waterproof: 'T-AP',
    outlet_ceiling: 'TC',
    outlet_rack: 'TR',
    water_heater_30l: 'TE',
    main_panel: 'TG',
    sub_panel: 'TD',
    meter: 'M',
    transfer_switch: 'ATS',
    arrival_panel: 'T.LL',
    junction_box: 'C',
    earth_pit: 'PAT',
    facp: 'FACP',
};

const OUTLET_TYPE_LABELS_ES: Record<ElectricalDeviceType, string> = {
    outlet_floor: 'Tomacorriente bajo',
    outlet_initial: 'Tomacorriente inicial',
    outlet_high_180: 'Tomacorriente alto',
    outlet_floor_box: 'Tomacorriente de piso',
    outlet_waterproof: 'Tomacorriente waterproof',
    outlet_ceiling: 'Tomacorriente de techo',
    outlet_rack: 'Toma para rack/comunicaciones',
    water_heater_30l: 'Salida para terma 30L',
    main_panel: 'Tablero general',
    sub_panel: 'Tablero de distribución',
    meter: 'Medidor',
    transfer_switch: 'Conmutador de transferencia',
    arrival_panel: 'Tablero de llegada',
    junction_box: 'Caja de pase',
    earth_pit: 'Pozo a tierra',
    facp: 'Panel de alarma contra incendios',
};

/** Caja/canalización efectiva: la de la instancia si la definió, si no la de `ELECTRICAL_DEVICE_DEFAULTS` (sección 10.3). */
function effectiveBoxLabel(device: ElectricalDevice): string {
    const defaults = ELECTRICAL_DEVICE_DEFAULTS[device.type].properties;
    const boxSize = device.properties.boxSize ?? defaults.boxSize;
    const boxMaterial = device.properties.boxMaterial ?? defaults.boxMaterial;
    if (boxSize && boxMaterial) return `${boxSize} (${boxMaterial})`;
    return boxSize ?? boxMaterial ?? '-';
}

/**
 * Identidad de agrupación: tipo + altura de montaje + caja/canalización
 * efectiva. Dos dispositivos del MISMO tipo con distinta altura o distinta
 * caja deben quedar en filas separadas (sección 10, "Diferenciar tomas con
 * el mismo código pero distinta altura/propiedad").
 */
function deviceGroupKey(device: ElectricalDevice): string {
    return `${device.type}|${device.mountingHeight}|${effectiveBoxLabel(device)}`;
}

function buildDeviceRows(devices: ElectricalDevice[]): DxfLegendRow[] {
    const groups = groupBy(devices, deviceGroupKey);

    return [...groups.values()].map((group) => {
        const representative = group[0]!;
        return {
            kind: representative.type === 'main_panel' || representative.type === 'sub_panel' ? 'panel' : 'outlet',
            symbolRef: { kind: 'device', deviceType: representative.type },
            code: OUTLET_TYPE_CODES[representative.type],
            description: OUTLET_TYPE_LABELS_ES[representative.type],
            technicalFields: [
                effectiveBoxLabel(representative),
                `${representative.mountingHeight.toFixed(2)}m`,
            ],
            quantity: group.length,
        };
    });
}

function buildJunctionBoxRows(junctionBoxes: JunctionBox[]): DxfLegendRow[] {
    const groups = groupBy(junctionBoxes, (box) => box.size);

    return [...groups.values()].map((group) => {
        const representative = group[0]!;
        return {
            kind: 'junctionBox',
            symbolRef: { kind: 'junctionBox' },
            code: 'C',
            description: 'Caja de pase',
            technicalFields: [representative.size],
            quantity: group.length,
        };
    });
}

/**
 * Filas de la leyenda de tomacorrientes: dispositivos (tomas, tableros,
 * medidor), cajas de pase legacy y cableado. Un nivel sin ninguno de estos
 * elementos produce un arreglo vacío.
 */
export function buildOutletLegendRows(entities: DxfDisciplineEntities): DxfLegendRow[] {
    return [
        ...buildDeviceRows(entities.electricalDevices),
        ...buildJunctionBoxRows(entities.junctionBoxes),
        ...buildCableRows(entities.conductors),
    ];
}
