/**
 * Catálogo de referencia para el motor LENI (EN 15193-1:2017, método
 * simplificado — Fase B del cierre de brechas de `dialux-calc-reviewer` /
 * `dialux-normativa-auditor`).
 *
 * TODOS los valores numéricos de este archivo están marcados
 * `pending-confirmation`: son estimaciones de conocimiento general sobre
 * horas de uso típicas y factores de control por tipo de edificio, NO una
 * transcripción verificada línea por línea del texto de la norma —
 * registrado en `.claude/skills/normativa-dialux/references/normativa.md`
 * §10, mismo mecanismo que ya usa el resto del proyecto para no presentar
 * un valor como "conforme" sin fuente citada y confirmada por un
 * especialista. Ningún consumidor de este catálogo (`leniCalculation.ts`,
 * `formal-pdf.blade.php`) debe mostrar la palabra "conforme"/"cumple"
 * junto al resultado LENI.
 */

export type LeniOccupancyControlType = 'manual' | 'auto-presence' | 'auto-presence-off';
export type LeniDaylightControlType = 'none' | 'photocell-on-off' | 'photocell-dimming';

export interface LeniBuildingTypeEntry {
    id: string;
    label: string;
    /** t_D: horas anuales de uso con ocupación diurna (referencial). */
    annualHoursDay: number;
    /** t_N: horas anuales de uso con ocupación nocturna (referencial). */
    annualHoursNight: number;
    source: string;
    edition: string;
    confirmationStatus: 'pending-confirmation';
}

/**
 * Horas anuales de uso por tipo de edificio — órdenes de magnitud
 * comúnmente citados para perfiles de ocupación tipo oficina/aula/comercio,
 * NO una transcripción de la tabla de EN 15193-1 Annex (pendiente de
 * verificación contra el texto real de la norma).
 */
export const LENI_BUILDING_TYPES: LeniBuildingTypeEntry[] = [
    {
        id: 'office',
        label: 'Oficina',
        annualHoursDay: 2250,
        annualHoursNight: 250,
        source: 'EN 15193-1 (perfil de ocupación tipo oficina, estimación general)',
        edition: '2017',
        confirmationStatus: 'pending-confirmation',
    },
    {
        id: 'classroom',
        label: 'Aula / educación',
        annualHoursDay: 1800,
        annualHoursNight: 0,
        source: 'EN 15193-1 (perfil de ocupación tipo educación, estimación general)',
        edition: '2017',
        confirmationStatus: 'pending-confirmation',
    },
    {
        id: 'retail',
        label: 'Comercio / retail',
        annualHoursDay: 3000,
        annualHoursNight: 500,
        source: 'EN 15193-1 (perfil de ocupación tipo comercio, estimación general)',
        edition: '2017',
        confirmationStatus: 'pending-confirmation',
    },
    {
        id: 'industrial',
        label: 'Industrial / almacén',
        annualHoursDay: 2500,
        annualHoursNight: 1500,
        source: 'EN 15193-1 (perfil de ocupación tipo industrial, estimación general)',
        edition: '2017',
        confirmationStatus: 'pending-confirmation',
    },
    {
        id: 'residential-common',
        label: 'Vivienda — áreas comunes',
        annualHoursDay: 1000,
        annualHoursNight: 1500,
        source: 'EN 15193-1 (perfil de ocupación tipo circulación residencial, estimación general)',
        edition: '2017',
        confirmationStatus: 'pending-confirmation',
    },
];

export function findLeniBuildingType(id: string | undefined): LeniBuildingTypeEntry | null {
    if (!id) return null;
    return LENI_BUILDING_TYPES.find((entry) => entry.id === id) ?? null;
}

interface LeniFactorEntry {
    factor: number;
    label: string;
    source: string;
    confirmationStatus: 'pending-confirmation';
}

/** F_O — factor de dependencia de ocupación por tipo de control. */
export const LENI_OCCUPANCY_FACTORS: Record<LeniOccupancyControlType, LeniFactorEntry> = {
    manual: {
        factor: 1,
        label: 'Manual (sin control automático)',
        source: 'EN 15193-1 método simplificado, F_O de referencia (estimación general)',
        confirmationStatus: 'pending-confirmation',
    },
    'auto-presence': {
        factor: 0.9,
        label: 'Automático — detector de presencia (mantiene encendido)',
        source: 'EN 15193-1 método simplificado, F_O de referencia (estimación general)',
        confirmationStatus: 'pending-confirmation',
    },
    'auto-presence-off': {
        factor: 0.75,
        label: 'Automático — detector de presencia con apagado total',
        source: 'EN 15193-1 método simplificado, F_O de referencia (estimación general)',
        confirmationStatus: 'pending-confirmation',
    },
};

/** F_D — factor de dependencia de luz natural por tipo de control. */
export const LENI_DAYLIGHT_FACTORS: Record<LeniDaylightControlType, LeniFactorEntry> = {
    none: {
        factor: 1,
        label: 'Sin control de luz natural',
        source: 'EN 15193-1 método simplificado, F_D de referencia (estimación general)',
        confirmationStatus: 'pending-confirmation',
    },
    'photocell-on-off': {
        factor: 0.9,
        label: 'Fotocélula todo/nada',
        source: 'EN 15193-1 método simplificado, F_D de referencia (estimación general)',
        confirmationStatus: 'pending-confirmation',
    },
    'photocell-dimming': {
        factor: 0.75,
        label: 'Fotocélula con regulación continua',
        source: 'EN 15193-1 método simplificado, F_D de referencia (estimación general)',
        confirmationStatus: 'pending-confirmation',
    },
};

/** F_C — factor de iluminación constante. */
export const LENI_CONSTANT_ILLUMINANCE_FACTOR: { enabled: LeniFactorEntry; disabled: LeniFactorEntry } = {
    disabled: {
        factor: 1,
        label: 'Sin iluminación constante',
        source: 'EN 15193-1 método simplificado, F_C de referencia (estimación general)',
        confirmationStatus: 'pending-confirmation',
    },
    enabled: {
        factor: 0.9,
        label: 'Con iluminación constante (compensa depreciación del flujo)',
        source: 'EN 15193-1 método simplificado, F_C de referencia (estimación general)',
        confirmationStatus: 'pending-confirmation',
    },
};
