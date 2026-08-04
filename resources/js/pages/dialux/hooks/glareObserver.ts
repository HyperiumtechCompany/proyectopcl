import { polygonCentroid } from '@/pages/dialux/geometry/polygonGeometry';
import type { Room } from './types';

/**
 * Observador de deslumbramiento (Fase 9 del plan maestro, §11: "Crear
 * observadores con posición, altura y dirección"). `viewDirectionDeg` sigue
 * la misma convención de ángulos que el resto del motor (0° = eje +X,
 * sentido antihorario, `atan2(dy,dx)`).
 */
export interface GlareObserver {
    x: number;
    y: number;
    eyeHeight: number;
    viewDirectionDeg: number;
}

/**
 * Altura de ojo estándar para UGR — verificada contra la documentación de
 * soporte de DIALux evo ("The UGR observer is at a height of 1.2 metres as
 * standard"), no inventada. Distinta del plano útil de trabajo
 * (`getRoomUsefulPlaneHeight`, típicamente 0.8m): el motor de Fase 0-8 usaba
 * el plano de trabajo como altura del observador para UGR por simplicidad,
 * una aproximación conocida que esta fase reemplaza en el nuevo camino
 * opcional (ver `lightingEngineCore.ts` — el camino por defecto/heredado NO
 * cambia, sigue usando el plano de trabajo, para no alterar los goldens de
 * Fase 0).
 */
export const DEFAULT_UGR_EYE_HEIGHT = 1.2;

/** Direcciones cardinales de vista por defecto, en grados. */
const DEFAULT_VIEW_DIRECTIONS_DEG = [0, 90, 180, 270];

/**
 * Observadores por defecto cuando el llamador no especifica ninguno: un
 * observador en el centroide del recinto, evaluado en las 4 direcciones
 * cardinales de vista — mismo criterio que las tablas UGR normativas
 * (EN 12464-1/CIE 117), que reportan el peor caso entre las direcciones
 * principales de vista del observador típico, no una sola dirección
 * arbitraria (plan §11 Fase 9: "evaluar varios observadores/direcciones").
 * Devuelve `[]` si el recinto no tiene un polígono válido — sin observadores
 * no hay UGR que evaluar, comportamiento seguro por defecto.
 */
export function buildDefaultObservers(room: Room, eyeHeight: number = DEFAULT_UGR_EYE_HEIGHT): GlareObserver[] {
    const centroid = polygonCentroid(room.vertices);
    if (!centroid) {
        return [];
    }

    return DEFAULT_VIEW_DIRECTIONS_DEG.map((viewDirectionDeg) => ({
        x: centroid.x,
        y: centroid.y,
        eyeHeight,
        viewDirectionDeg,
    }));
}
