import type { Project } from '@/pages/dialux/hooks/types';
import raw from './vinchosProject.json';

/**
 * Captura real del proyecto "Vinchos" (DialuxProject #1) tomada el
 * 2026-08-19 directo de la BD (tinker → `DialuxProject::data`). Un solo
 * recinto ("Recinto 1", reflectancias 0.7/0.5/0.2) con DOS ambientes
 * "Guarderías" derivados por muros-anillo (los muros de 25/27 vértices,
 * espesor 0.13 m — el mismo patrón de "anillo = recorrido perimetral del
 * muro" que Módulo 22, ver Ronda 25 en `occlusionBoxes.ts`), 12 luminarias
 * de 6000 lm con fotometría real a 2.8 m.
 *
 * Referencia externa para comparar (DIALux evo real, mismo proyecto,
 * captura del usuario 2026-08-19 — "Aula 1°/2° PRIMARIA"):
 *   - Aula 1° (43.80 m²): Ē=544 lx (≥500), Emin=276, Emax=711, Uo(g1)=0.51,
 *     zona marginal 0.105 m
 *   - Aula 2° (42.71 m²): Ē=567 lx (≥500), Emin=302, Emax=741, Uo(g1)=0.53,
 *     zona marginal 0.229 m
 *
 * No editar este JSON a mano — es una foto real, no un caso sintético.
 */
export function buildVinchosProject(): Project {
    return raw as unknown as Project;
}
