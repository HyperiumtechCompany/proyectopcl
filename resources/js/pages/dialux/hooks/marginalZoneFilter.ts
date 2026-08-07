import { distanceToPolygonEdge } from '@/pages/dialux/geometry/polygonGeometry';
import type { GridPoint } from './lightingEngineCore';
import type { Vertex } from './types';

/**
 * Filtra los valores de una malla de cálculo a los puntos que quedan FUERA
 * de la zona marginal (franja de borde entre el plano útil y las paredes)
 * — la misma "zona marginal" que ya se calcula y reporta
 * (`getRoomMarginalZone`/`marginalZoneOverride`), pero hasta ahora nunca se
 * usaba para excluir puntos del promedio real, solo como metadato.
 *
 * No filtra `grid_values`/`grid_active` (la malla completa, usada por
 * isolux/contornos/comparación de resultados) — solo el subconjunto que
 * alimenta avg/min/max/uniformidad, igual que DIALux evo excluye la franja
 * de borde de su estadística "Ē" pero sigue coloreándola en el isolux.
 *
 * Nunca devuelve un array vacío: si el margen es tan grande que no queda
 * ningún punto dentro (recinto muy chico), el llamador debe usar los
 * valores sin filtrar — un promedio "sin puntos" no es un resultado válido.
 */
export function filterPointsOutsideMarginalZone(
    points: GridPoint[],
    values: Array<number | null>,
    roomVertices: Vertex[],
    marginalZone: number,
): number[] {
    if (marginalZone <= 0) {
        return values.filter((value): value is number => value !== null);
    }

    const filtered: number[] = [];
    for (let i = 0; i < points.length; i++) {
        const value = values[i];
        const point = points[i];
        if (
            value === null ||
            !point ||
            !point.active ||
            distanceToPolygonEdge(point, roomVertices) < marginalZone
        ) {
            continue;
        }
        filtered.push(value);
    }

    return filtered;
}
