import { polygonBBox } from './fixtureGrid';
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

/**
 * Observadores por defecto cuando el llamador no especifica ninguno: uno en
 * el punto medio de cada pared del recinto (bounding box), mirando hacia
 * adentro — el mismo criterio CIE 117/EN 12464-1 que ya usa la tabla UGR de
 * referencia por producto (`computeEngineUgrTable.ts::buildWallMidpointObserver`,
 * Fase 15), NO el centro geométrico del recinto.
 *
 * Antes este observador vivía en el centroide del recinto — para cualquier
 * ambiente pequeño con las luminarias más o menos centradas (el caso más
 * común, no un borde raro), el observador quedaba casi directamente DEBAJO
 * de ellas: horizDist chico, dz grande, disparando la exclusión H/R>2 de
 * `glareCalculation.ts` para TODAS las luminarias en TODAS las direcciones
 * de vista (esa exclusión no depende de hacia dónde mira el observador, solo
 * de su posición). Resultado: UGR quedaba "no evaluado" de forma sistemática
 * para cualquier ambiente chico y alto — no un caso límite, sino el caso
 * típico de una caseta de control o baño — mientras que DIALux real evalúa
 * ese mismo ambiente sin problema porque ubica su propio observador cerca de
 * una pared, no en el centro (confirmado comparando contra un export real:
 * mismo ambiente, mismas luminarias, RUG real=22 evaluado vs el nuestro
 * "no evaluado" con el observador en el centroide).
 * Devuelve `[]` si el recinto no tiene un polígono válido — sin observadores
 * no hay UGR que evaluar, comportamiento seguro por defecto.
 *
 * NO se desplaza al observador hacia adentro para "sacarlo" del muro de
 * oclusión (se intentó en la Ronda 25 y se revirtió el mismo día: acercarlo
 * a las luminarias disparaba la exclusión H/R>2 en casos límite, cambiando
 * el resultado por la puerta de atrás). El conflicto observador-dentro-del-
 * muro se resuelve en `glareCalculation.ts`: el muro que CONTIENE al
 * observador no puede ocluirle la vista.
 */
export function buildDefaultObservers(room: Room, eyeHeight: number = DEFAULT_UGR_EYE_HEIGHT): GlareObserver[] {
    if (room.vertices.length < 3) {
        return [];
    }

    const { minX, minY, maxX, maxY } = polygonBBox(room.vertices);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    return [
        { x: minX, y: midY, eyeHeight, viewDirectionDeg: 0 }, // pared izquierda, mira hacia +X (adentro)
        { x: maxX, y: midY, eyeHeight, viewDirectionDeg: 180 }, // pared derecha, mira hacia -X (adentro)
        { x: midX, y: minY, eyeHeight, viewDirectionDeg: 90 }, // pared inferior, mira hacia +Y (adentro)
        { x: midX, y: maxY, eyeHeight, viewDirectionDeg: 270 }, // pared superior, mira hacia -Y (adentro)
    ];
}
