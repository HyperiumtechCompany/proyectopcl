import type { RoomNormativeRef } from './types';

/**
 * Resumen legible de un `RoomNormativeRef` (EM.010) — antes de este fix,
 * seleccionar un área en `NormativePicker` guardaba `ugrl`/`uo`/`ra` en
 * `room.normative` pero solo `emLux` tenía algún efecto visible en la UI
 * (vía "Lux req."); UGRL/Uo/Ra quedaban invisibles para el usuario aunque
 * los datos sí llegaban correctos desde la BD (verificado contra el Anexo
 * "Requisitos Mínimos de Iluminación" de la EM.010, RM N° 083-2019-VIVIENDA).
 */
export function formatNormativeSummary(normative: RoomNormativeRef): string {
    const parts = [`Em ${normative.emLux ?? '—'} lx`];
    if (normative.ugrl != null) parts.push(`UGR≤${normative.ugrl}`);
    if (normative.uo != null) parts.push(`Uo≥${normative.uo}`);
    if (normative.ra != null) parts.push(`Ra≥${normative.ra}`);
    return parts.join(' · ');
}
