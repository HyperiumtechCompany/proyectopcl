import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { illuminanceFromFixture } from './directIlluminance';
import { buildGrid } from './lightingEngineCore';
import { isCorridorLikeRoom } from './roomLighting';
import type { Fixture, Room } from './useEditorStore';

const MIN_ADAPTIVE_SPACING_M = 0.1;

/**
 * NOTA (evaluado y descartado): se probó reemplazar el techo fijo de malla
 * (0.5 m) por la fórmula de espaciado de EN 12464-1 (`p = 0.2×5^log10(d)`,
 * la misma que ya usa `roomLighting.ts::getRoomMarginalZone`) esperando que
 * una malla más fina (Ventanilla pasó de 8×2 a 5×21 puntos) cerrara la
 * brecha de Ē en Ventanilla — en la práctica el promedio prácticamente no
 * se movió (85.7 vs 86.4 lx) y Caseta/SS.HH EMPEORARON (SS.HH dejó de
 * conformar). La brecha de Emax que motivó la hipótesis era real, pero no
 * explicaba el promedio: una malla más gruesa aproxima bien Ē aunque
 * subestime el pico puntual. Revertido — no dejar como "trabajo pendiente"
 * sin evidencia de que ayudaría.
 */

/**
 * Espaciado de malla adaptativo POR RECINTO (no por celda). DIALux evo usa
 * un refinamiento real por-celda (su propio glosario: "donde hay mayores
 * diferencias de iluminancia la rasterización se hace más fina, donde hay
 * menos diferencia, más gruesa") — replicar eso exigiría reescribir
 * renderizado de isolux, contornos y comparación de grillas, que hoy
 * asumen una malla rectangular uniforme (ver plan). Esta función es una
 * aproximación más simple y verificable: UN espaciado por recinto entero,
 * más fino cuanto más gradiente de luz tenga ese recinto en una pasada de
 * sondeo barata — nunca más grueso que `baseSpacing` (solo afina; es una
 * simplificación deliberada frente al comportamiento bidireccional real de
 * DIALux, que también engrosa zonas uniformes).
 *
 * Los pasillos/circulaciones (`isCorridorLikeRoom`) se excluyen del
 * refinamiento y devuelven `baseSpacing` sin tocar — coincide con el
 * comportamiento observado en DIALux evo (zona marginal 0 en áreas de
 * tránsito) y es el mismo criterio que ya usa `getRoomUsefulPlaneHeight`
 * para ese tipo de recinto.
 */
export function computeAdaptiveGridSpacing(
    room: Room,
    fixtures: Fixture[],
    usefulPlaneHeight: number,
    obstacles: OcclusionBox[],
    baseSpacing: number,
): number {
    if (baseSpacing <= 0 || isCorridorLikeRoom(room)) {
        return baseSpacing;
    }

    // Mismo enriquecimiento de Z que `calculateLightingResult` en
    // `lightingEngineCore.ts` — se duplica aquí (en vez de reusar esa
    // función) para que esta pasada de sondeo sea pura luz directa, sin
    // interreflexión/UGR/oclusión ponderada, y desacoplada del motor
    // completo.
    const enriched = fixtures.map((fixture) => ({
        ...fixture,
        z: fixture.z > 0 ? fixture.z : room.height - 0.1,
    }));

    const probe = buildGrid(room, baseSpacing, usefulPlaneHeight);
    const activeValues: number[] = [];
    for (const point of probe.points) {
        if (!point.active) {
            continue;
        }

        let sum = 0;
        for (const fixture of enriched) {
            sum += illuminanceFromFixture(point, fixture, obstacles);
        }
        activeValues.push(sum);
    }

    if (activeValues.length < 2) {
        return baseSpacing;
    }

    const mean = activeValues.reduce((sum, value) => sum + value, 0) / activeValues.length;
    if (mean <= 0) {
        return baseSpacing;
    }

    const min = Math.min(...activeValues);
    const max = Math.max(...activeValues);
    const coefficientOfVariation = (max - min) / mean;

    const finalSpacing = baseSpacing / (1 + coefficientOfVariation);
    return Math.min(baseSpacing, Math.max(MIN_ADAPTIVE_SPACING_M, finalSpacing));
}

/**
 * Resuelve `spacingM`/`marginalZoneOverride` para `calculateLightingResult`
 * según `meshPolicy` — agrupa la rama "adaptativo vs fijo" en un solo lugar
 * (usado por `runDirectPreviewEngine.ts`) en vez de repetirla inline.
 */
export function resolveMeshSpacing(
    room: Room,
    fixtures: Fixture[],
    usefulPlaneHeight: number,
    obstacles: OcclusionBox[],
    meshPolicy: { gridSpacingM: number; adaptive?: boolean },
): { spacingM: number; marginalZoneOverride: number | undefined } {
    if (!meshPolicy.adaptive) {
        return { spacingM: meshPolicy.gridSpacingM, marginalZoneOverride: undefined };
    }

    const spacingM = computeAdaptiveGridSpacing(
        room,
        fixtures,
        usefulPlaneHeight,
        obstacles,
        meshPolicy.gridSpacingM,
    );

    return {
        spacingM,
        marginalZoneOverride: isCorridorLikeRoom(room) ? 0 : spacingM / 2,
    };
}
