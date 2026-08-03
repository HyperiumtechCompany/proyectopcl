import type { Conductor, ElectricalDevice, Fixture, JunctionBox, LightSwitch } from '@/pages/dialux/hooks/types';
import type { DxfElectricalEntities } from '../domain/types';

/**
 * Traslada las entidades ELÉCTRICAS de un nivel por (dx, dy) — la
 * transformación de la Fase 8 (sección 13.1) para las entidades que se
 * dibujan sueltas en cada lámina (nunca se mueve solo el fondo dejando los
 * dispositivos en coordenadas originales, sección 13.2).
 *
 * El fondo arquitectónico (recintos, muros, CAD importado) NO se traslada
 * aquí: se define una sola vez en su bloque (`emitters/levelBlock.ts`) y se
 * inserta dos veces —una por lámina— con la traslación puesta en el propio
 * `INSERT` (sección 12.2), así no se duplica la geometría del fondo por
 * cada lámina.
 */

function translateFixture(fixture: Fixture, dx: number, dy: number): Fixture {
    return { ...fixture, x: fixture.x + dx, y: fixture.y + dy };
}

function translateLightSwitch(lightSwitch: LightSwitch, dx: number, dy: number): LightSwitch {
    return { ...lightSwitch, x: lightSwitch.x + dx, y: lightSwitch.y + dy };
}

function translateElectricalDevice(device: ElectricalDevice, dx: number, dy: number): ElectricalDevice {
    return { ...device, x: device.x + dx, y: device.y + dy };
}

function translateJunctionBox(box: JunctionBox, dx: number, dy: number): JunctionBox {
    return { ...box, x: box.x + dx, y: box.y + dy };
}

function translateConductor(conductor: Conductor, dx: number, dy: number): Conductor {
    return { ...conductor, waypoints: conductor.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy })) };
}

export function translateElectricalEntities(entities: DxfElectricalEntities, dx: number, dy: number): DxfElectricalEntities {
    return {
        fixtures: entities.fixtures.map((item) => translateFixture(item, dx, dy)),
        lightSwitches: entities.lightSwitches.map((item) => translateLightSwitch(item, dx, dy)),
        electricalDevices: entities.electricalDevices.map((item) => translateElectricalDevice(item, dx, dy)),
        conductors: entities.conductors.map((item) => translateConductor(item, dx, dy)),
        junctionBoxes: entities.junctionBoxes.map((item) => translateJunctionBox(item, dx, dy)),
    };
}
