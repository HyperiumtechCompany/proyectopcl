import type { Vertex } from '@/pages/dialux/hooks/types';
import type { IfcAPI } from 'web-ifc';
import { convexHull2D } from './convexHull2D';

/**
 * Fase 19 del plan maestro ("BIM/IFC", primer ciclo). Extrae el polígono de
 * planta + altura de un `IfcSpace` a partir de su geometría YA TESELADA por
 * `web-ifc` (`StreamMeshes`/`GetGeometry`) — nunca se interpreta a mano
 * `IfcExtrudedAreaSolid` ni ningún otro tipo de representación IFC: el
 * motor de geometría de `web-ifc` ya produce triángulos para CUALQUIER
 * representación (extrusión simple, BRep, etc.), así que este módulo
 * funciona para cualquier `IfcSpace` que `web-ifc` sepa teselar.
 *
 * **Convención de coordenadas verificada por spike (2026-08-05)**, no
 * documentada explícitamente en `web-ifc`: la malla tesselada + su
 * `flatTransformation` produce salida en METROS (con la conversión de
 * unidades del archivo ya aplicada, sin importar la unidad nativa del IFC)
 * y en un sistema **Y-arriba** (vertical = eje Y de salida), aunque IFC es
 * nativamente Z-arriba — `web-ifc` hace esta conversión internamente. Por
 * eso el mapeo a este editor (X,Y = plano horizontal, altura escalar
 * aparte) es: `domain.x = salida.x`, `domain.y = salida.z`,
 * `altura = rango de salida.y`. Verificado con dos salas de dimensiones
 * conocidas (4×3×2.8 m y 3×3×2.8 m) antes de construir el resto del
 * pipeline sobre este supuesto.
 *
 * **Limitación documentada explícitamente**: el polígono de planta se
 * aproxima con el CASCO CONVEXO (`convexHull2D`) de los vértices del corte
 * inferior de la malla (planta, no techo) — un espacio cóncavo (L/U/T) se
 * "rellena" a su casco convexo. Reconstruir el contorno cóncavo exacto
 * requiere extraer el borde real de la cara inferior de la malla, un
 * algoritmo sustancialmente más complejo, diferido a un ciclo posterior.
 */
export interface IfcSpaceFootprint {
    /** Polígono de planta en metros, plano XY de la escena (casco convexo). */
    vertices: Vertex[];
    /** Altura del espacio en metros. */
    height: number;
}

/** Tolerancia (m) para considerar un vértice "del piso" al recortar la malla — cubre el ruido de tesselación de una superficie nominalmente plana. */
const BOTTOM_SLICE_TOLERANCE_M = 0.05;

function applyFlatTransformation(x: number, y: number, z: number, m: ArrayLike<number>): { x: number; y: number; z: number } {
    return {
        x: x * m[0]! + y * m[4]! + z * m[8]! + m[12]!,
        y: x * m[1]! + y * m[5]! + z * m[9]! + m[13]!,
        z: x * m[2]! + y * m[6]! + z * m[10]! + m[14]!,
    };
}

/** `null` si el espacio no tiene geometría teselable, o si el casco convexo resultante es degenerado. */
export function extractSpaceFootprint(api: IfcAPI, modelId: number, spaceExpressId: number): IfcSpaceFootprint | null {
    let footprint: IfcSpaceFootprint | null = null;

    api.StreamMeshes(modelId, [spaceExpressId], (mesh) => {
        const worldPoints: Array<{ x: number; y: number; z: number }> = [];

        for (let g = 0; g < mesh.geometries.size(); g++) {
            const placedGeometry = mesh.geometries.get(g);
            const geometry = api.GetGeometry(modelId, placedGeometry.geometryExpressID);
            const vertexData = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
            const transform = placedGeometry.flatTransformation;

            // Stride 6: posición (xyz) + normal (xyz) por vértice — verificado por spike.
            for (let i = 0; i + 2 < vertexData.length; i += 6) {
                worldPoints.push(applyFlatTransformation(vertexData[i]!, vertexData[i + 1]!, vertexData[i + 2]!, transform));
            }
        }

        if (worldPoints.length === 0) {
            return;
        }

        let minVertical = Infinity;
        let maxVertical = -Infinity;
        for (const p of worldPoints) {
            if (p.y < minVertical) minVertical = p.y;
            if (p.y > maxVertical) maxVertical = p.y;
        }
        const height = maxVertical - minVertical;
        if (height <= 0) {
            return;
        }

        const floorPoints: Vertex[] = worldPoints
            .filter((p) => p.y <= minVertical + BOTTOM_SLICE_TOLERANCE_M)
            .map((p) => ({ x: p.x, y: p.z }));

        const hull = convexHull2D(floorPoints);
        if (hull.length < 3) {
            return;
        }

        footprint = { vertices: hull, height };
    });

    return footprint;
}
