import {
    findLeniBuildingType,
    LENI_CONSTANT_ILLUMINANCE_FACTOR,
    LENI_DAYLIGHT_FACTORS,
    LENI_OCCUPANCY_FACTORS,
    type LeniDaylightControlType,
    type LeniOccupancyControlType,
} from './leniData';
import type { ProjectSiteSettings } from './types';

export interface LeniInputs {
    /** Potencia instalada total del ambiente/proyecto, en watts (P_n). Ya calculada aguas arriba — nunca recalculada aquí. */
    installedPowerWatts: number;
    /** Área útil del ambiente/proyecto, en m² (A). Ya calculada aguas arriba. */
    usefulAreaM2: number;
    leni: NonNullable<ProjectSiteSettings['leni']>;
}

export interface LeniResult {
    /** W_L en kWh/año. */
    lightingEnergyKwhYear: number;
    /** W_P en kWh/año — energía parásita de controles/standby, NO modelada (ver `parasiticEnergyModeled`). */
    parasiticEnergyKwhYear: number;
    parasiticEnergyModeled: false;
    /** LENI = (W_L + W_P) / A, en kWh/(m²·año). */
    leniKwhPerM2Year: number;
    buildingTypeLabel: string;
    occupancyControlType: LeniOccupancyControlType;
    daylightControlType: LeniDaylightControlType;
    constantIlluminanceControl: boolean;
    annualHoursDay: number;
    annualHoursNight: number;
    factorOccupancy: number;
    factorDaylight: number;
    factorConstantIlluminance: number;
}

/**
 * Motor LENI — método simplificado de EN 15193-1:2017 (cierre del hallazgo
 * bloqueante de `dialux-calc-reviewer`, "motor LENI/EN 15193 no existe").
 *
 * Fórmula (Entrada → Proceso → Resultado, mismo formato que exige
 * `planes/PLAN_MD_REVISION_MOTOR_DIALUX_HYPERIUMTECH.md` §3):
 *
 *   W_L = (P_n × F_C × [(t_D × F_O × F_D) + (t_N × F_O)]) / 1000   [kWh/año]
 *   LENI = (W_L + W_P) / A                                         [kWh/(m²·año)]
 *
 * `W_P` (energía parásita — standby de controles, baterías de emergencia en
 * carga) NO está modelada: no hay datos de consumo standby por control en
 * este sistema. Se reporta 0 con `parasiticEnergyModeled: false` explícito
 * — nunca se debe ocultar este supuesto ni tratar el resultado como
 * "conforme a EN 15193", ver `LeniResult` y el catálogo `leniData.ts`
 * (todos sus factores están `pending-confirmation`).
 *
 * Devuelve `null` si `leni.buildingType` no está definido — sin tipo de
 * edificio no hay horas de referencia ni causa para inventar un default.
 */
export function calculateLeni(inputs: LeniInputs): LeniResult | null {
    const { installedPowerWatts, usefulAreaM2, leni } = inputs;
    const buildingType = findLeniBuildingType(leni.buildingType);
    if (!buildingType || usefulAreaM2 <= 0) {
        return null;
    }

    const annualHoursDay = leni.annualOperatingHoursDay ?? buildingType.annualHoursDay;
    const annualHoursNight = leni.annualOperatingHoursNight ?? buildingType.annualHoursNight;
    const occupancyControlType = leni.occupancyControlType ?? 'manual';
    const daylightControlType = leni.daylightControlType ?? 'none';
    const constantIlluminanceControl = leni.constantIlluminanceControl ?? false;

    const factorOccupancy = LENI_OCCUPANCY_FACTORS[occupancyControlType].factor;
    const factorDaylight = LENI_DAYLIGHT_FACTORS[daylightControlType].factor;
    const factorConstantIlluminance = constantIlluminanceControl
        ? LENI_CONSTANT_ILLUMINANCE_FACTOR.enabled.factor
        : LENI_CONSTANT_ILLUMINANCE_FACTOR.disabled.factor;

    const effectiveHours = annualHoursDay * factorOccupancy * factorDaylight + annualHoursNight * factorOccupancy;
    const lightingEnergyKwhYear = (installedPowerWatts * factorConstantIlluminance * effectiveHours) / 1000;
    const parasiticEnergyKwhYear = 0;
    const leniKwhPerM2Year = (lightingEnergyKwhYear + parasiticEnergyKwhYear) / usefulAreaM2;

    return {
        lightingEnergyKwhYear,
        parasiticEnergyKwhYear,
        parasiticEnergyModeled: false,
        leniKwhPerM2Year,
        buildingTypeLabel: buildingType.label,
        occupancyControlType,
        daylightControlType,
        constantIlluminanceControl,
        annualHoursDay,
        annualHoursNight,
        factorOccupancy,
        factorDaylight,
        factorConstantIlluminance,
    };
}
