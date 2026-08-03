import type { ElectricalDeviceType } from '@/pages/dialux/hooks/types';
import type {
    DxfDiscipline,
    DxfEntitySpecialty,
    DxfExportWarning,
    DxfLevelClassification,
    DxfLevelPackage,
} from '../domain/types';

/**
 * Clasificación de dispositivos eléctricos por especialidad (plan maestro,
 * secciones 5.1/5.2). Los tipos `outlet_*`/`water_heater_30l` son siempre
 * tomacorrientes; `main_panel`/`sub_panel` alimentan ambos circuitos y
 * aparecen en los dos planos ("opcionalmente" en alumbrado, "relevantes" en
 * tomacorrientes). `meter` solo se menciona en la lámina de tomacorrientes.
 * `junction_box` se resuelve por conexión, no por tipo (ver Paso B).
 * Cualquier otro tipo (`transfer_switch`, `arrival_panel`, `earth_pit`,
 * `facp`) no pertenece a ninguna de las dos especialidades del modelo actual
 * y se registra como no clasificado en vez de asignarse arbitrariamente.
 */
const OUTLET_DEVICE_TYPES = new Set<ElectricalDeviceType>([
    'outlet_floor', 'outlet_initial', 'outlet_high_180', 'outlet_floor_box',
    'outlet_waterproof', 'outlet_ceiling', 'outlet_rack', 'water_heater_30l',
    'meter',
]);
const SHARED_DEVICE_TYPES = new Set<ElectricalDeviceType>(['main_panel', 'sub_panel']);

function isDefiniteDiscipline(specialty: DxfEntitySpecialty | null): specialty is DxfDiscipline {
    return specialty === 'lighting' || specialty === 'outlets';
}

/**
 * Clasifica cada dispositivo, caja de pase y conductor de un nivel en
 * `'lighting' | 'outlets' | 'shared' | 'unclassified'`, siguiendo el orden
 * de resolución de la sección 5.3: primero la especialidad inequívoca del
 * dispositivo de origen/destino; las cajas de pase y los conductores que no
 * puedan resolverse quedan `'unclassified'` con una advertencia explícita —
 * nunca se ocultan en silencio (criterio de cierre de la Fase 2).
 */
export function classifyDxfLevelEntities(level: DxfLevelPackage): DxfLevelClassification {
    const warnings: DxfExportWarning[] = [];
    const fixtureIds = new Set(level.electrical.fixtures.map((fixture) => fixture.id));
    const switchIds = new Set(level.electrical.lightSwitches.map((lightSwitch) => lightSwitch.id));

    // Paso A: dispositivos con tipo conocido (todo salvo `junction_box`, resuelto en el Paso B).
    const deviceSpecialty = new Map<string, DxfEntitySpecialty>();
    for (const device of level.electrical.electricalDevices) {
        if (device.type === 'junction_box') continue;

        if (OUTLET_DEVICE_TYPES.has(device.type)) {
            deviceSpecialty.set(device.id, 'outlets');
        } else if (SHARED_DEVICE_TYPES.has(device.type)) {
            deviceSpecialty.set(device.id, 'shared');
        } else {
            deviceSpecialty.set(device.id, 'unclassified');
            warnings.push({
                code: 'unknown-device-type',
                message: `El dispositivo "${device.label || device.id}" (tipo "${device.type}") no corresponde a alumbrado ni a tomacorrientes; se registra como no clasificado.`,
                sceneId: level.sceneId,
                levelName: level.name,
            });
        }
    }

    function resolveKnown(
        id: string,
        junctionBoxSpecialty: ReadonlyMap<string, DxfEntitySpecialty>,
    ): DxfEntitySpecialty | null {
        if (fixtureIds.has(id)) return 'lighting';
        if (switchIds.has(id)) return 'lighting';
        if (deviceSpecialty.has(id)) return deviceSpecialty.get(id)!;
        if (junctionBoxSpecialty.has(id)) return junctionBoxSpecialty.get(id)!;
        return null;
    }

    // Paso B: cajas de paso (legacy `JunctionBox[]` + `ElectricalDevice` tipo `junction_box`),
    // clasificadas por la especialidad de los conductores que las tocan.
    const junctionBoxSpecialty = new Map<string, DxfEntitySpecialty>();
    const junctionBoxIds = new Set<string>([
        ...level.electrical.junctionBoxes.map((box) => box.id),
        ...level.electrical.electricalDevices
            .filter((device) => device.type === 'junction_box')
            .map((device) => device.id),
    ]);

    for (const boxId of junctionBoxIds) {
        const connectedDisciplines = new Set<DxfDiscipline>();

        for (const conductor of level.electrical.conductors) {
            let otherId: string | null = null;
            if (conductor.sourceId === boxId) otherId = conductor.targetId;
            else if (conductor.targetId === boxId) otherId = conductor.sourceId;
            if (otherId === null || junctionBoxIds.has(otherId)) continue;

            const otherSpecialty = resolveKnown(otherId, junctionBoxSpecialty);
            if (isDefiniteDiscipline(otherSpecialty)) {
                connectedDisciplines.add(otherSpecialty);
            }
        }

        if (connectedDisciplines.size === 0) {
            junctionBoxSpecialty.set(boxId, 'unclassified');
            warnings.push({
                code: 'unclassified-junction-box',
                message: `La caja de pase "${boxId}" no tiene ninguna conexión que permita determinar su especialidad.`,
                sceneId: level.sceneId,
                levelName: level.name,
            });
        } else if (connectedDisciplines.size === 1) {
            junctionBoxSpecialty.set(boxId, [...connectedDisciplines][0]!);
        } else {
            junctionBoxSpecialty.set(boxId, 'shared');
            warnings.push({
                code: 'shared-junction-box',
                message: `La caja de pase "${boxId}" conecta circuitos de alumbrado y de tomacorrientes; se incluye en ambos planos.`,
                sceneId: level.sceneId,
                levelName: level.name,
            });
        }
    }

    // Los `ElectricalDevice` de tipo `junction_box` comparten resultado con el Paso B,
    // pero `deviceSpecialty` es el mapa que consumen los filtros de dispositivos.
    for (const device of level.electrical.electricalDevices) {
        if (device.type === 'junction_box') {
            deviceSpecialty.set(device.id, junctionBoxSpecialty.get(device.id) ?? 'unclassified');
        }
    }

    // Paso C: conductores.
    const conductorDiscipline = new Map<string, DxfEntitySpecialty>();
    for (const conductor of level.electrical.conductors) {
        const sourceSpecialty = resolveKnown(conductor.sourceId, junctionBoxSpecialty);
        const targetSpecialty = resolveKnown(conductor.targetId, junctionBoxSpecialty);

        if (sourceSpecialty === null || targetSpecialty === null) {
            conductorDiscipline.set(conductor.id, 'unclassified');
            warnings.push({
                code: 'conductor-dangling-endpoint',
                message: `El conductor "${conductor.id}" referencia un extremo que no existe en este nivel.`,
                sceneId: level.sceneId,
                levelName: level.name,
            });
            continue;
        }

        const definiteDisciplines = new Set<DxfDiscipline>(
            [sourceSpecialty, targetSpecialty].filter(isDefiniteDiscipline),
        );

        if (definiteDisciplines.size === 1) {
            conductorDiscipline.set(conductor.id, [...definiteDisciplines][0]!);
        } else if (definiteDisciplines.size === 2) {
            conductorDiscipline.set(conductor.id, 'unclassified');
            warnings.push({
                code: 'conductor-mixed-disciplines',
                message: `El conductor "${conductor.id}" conecta un extremo de alumbrado con uno de tomacorrientes; no se puede asignar a una sola especialidad.`,
                sceneId: level.sceneId,
                levelName: level.name,
            });
        } else {
            // Ambos extremos existen pero son 'shared'/'unclassified': sin información suficiente.
            conductorDiscipline.set(conductor.id, 'unclassified');
            warnings.push({
                code: 'conductor-inconclusive-endpoints',
                message: `El conductor "${conductor.id}" no tiene extremos suficientemente clasificados para asignarle una especialidad.`,
                sceneId: level.sceneId,
                levelName: level.name,
            });
        }
    }

    return { deviceSpecialty, junctionBoxSpecialty, conductorDiscipline, warnings };
}
