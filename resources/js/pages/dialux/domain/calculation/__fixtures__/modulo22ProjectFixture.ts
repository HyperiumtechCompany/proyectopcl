import type { Project } from '@/pages/dialux/hooks/types';
import raw from './modulo22Project.json';

/**
 * Captura real del proyecto "Modulo 22" (DialuxProject #2) tomada el
 * 2026-08-06 después de: (1) reparar la fotometría de los productos FLIQ
 * 400.3040.01_FLIQZ 400.24 (#11) y TEGO IP65 FROSTED GLASS (#10) con sus
 * `.ldt` reales de fabricante (antes eran `synthetic`/`manual-curve` —
 * causa raíz #1 de la brecha contra DIALux evo), y (2) que el usuario
 * confirmara la composición base para testear: Caseta de Control 2
 * luminarias, SS.HH 1 luminaria, Ventanilla de atención 2 luminarias (5
 * total), todas a 4.670 m de montaje.
 *
 * Referencia externa para comparar (DIALux evo real, mismo proyecto,
 * exportado 2025-06-20, interreflexión/UGR con su propio motor):
 *   - CASETA DE CONTROL: Ē=203 lx (≥200), Uo=0.87, RUG,max=22 (≤25)
 *   - SS.HH:              Ē=206 lx (≥200), Uo=0.88, RUG,max=22 (≤25)
 *   - VENTANILLA/CIRCULACION 1: Ē=100 lx (≥100), Uo=0.60
 *
 * No editar este JSON a mano — es una foto real, no un caso sintético
 * construido a propósito. Para otro proyecto "dorado", exportar un nuevo
 * `.json` con el mismo procedimiento (tinker → `DialuxProject::data` +
 * metadatos) y añadir su propio wrapper/test junto a este.
 */
export function buildModulo22Project(): Project {
    return raw as unknown as Project;
}
