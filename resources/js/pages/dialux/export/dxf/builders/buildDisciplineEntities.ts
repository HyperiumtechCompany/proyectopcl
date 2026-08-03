import type { DxfDisciplineEntities, DxfEntitySpecialty, DxfLevelClassification, DxfLevelPackage } from '../domain/types';

/** `'shared'` (tableros/medidores/cajas compartidas) aparece en ambas láminas. */
function belongsTo(specialty: DxfEntitySpecialty | undefined, discipline: 'lighting' | 'outlets'): boolean {
    return specialty === discipline || specialty === 'shared';
}

/**
 * Filtra un nivel a solo lo que va en la lámina de alumbrado (sección 5.1):
 * luminarias e interruptores completos, más los dispositivos/cajas/conductores
 * que la clasificación (Fase 2) haya resuelto como `'lighting'` o `'shared'`.
 */
export function buildLightingEntities(
    level: DxfLevelPackage,
    classification: DxfLevelClassification,
): DxfDisciplineEntities {
    return {
        discipline: 'lighting',
        fixtures: level.electrical.fixtures,
        lightSwitches: level.electrical.lightSwitches,
        electricalDevices: level.electrical.electricalDevices.filter((device) =>
            belongsTo(classification.deviceSpecialty.get(device.id), 'lighting'),
        ),
        conductors: level.electrical.conductors.filter((conductor) =>
            belongsTo(classification.conductorDiscipline.get(conductor.id), 'lighting'),
        ),
        junctionBoxes: level.electrical.junctionBoxes.filter((box) =>
            belongsTo(classification.junctionBoxSpecialty.get(box.id), 'lighting'),
        ),
    };
}

/**
 * Filtra un nivel a solo lo que va en la lámina de tomacorrientes (sección 5.2).
 * No incluye luminarias ni interruptores de iluminación.
 */
export function buildOutletEntities(
    level: DxfLevelPackage,
    classification: DxfLevelClassification,
): DxfDisciplineEntities {
    return {
        discipline: 'outlets',
        fixtures: [],
        lightSwitches: [],
        electricalDevices: level.electrical.electricalDevices.filter((device) =>
            belongsTo(classification.deviceSpecialty.get(device.id), 'outlets'),
        ),
        conductors: level.electrical.conductors.filter((conductor) =>
            belongsTo(classification.conductorDiscipline.get(conductor.id), 'outlets'),
        ),
        junctionBoxes: level.electrical.junctionBoxes.filter((box) =>
            belongsTo(classification.junctionBoxSpecialty.get(box.id), 'outlets'),
        ),
    };
}
