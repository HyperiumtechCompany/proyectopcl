import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { isSegmentOccluded } from '@/pages/dialux/domain/geometry/segmentOcclusion';
import { candela } from './photometricInterpolation';
import type { Fixture } from './types';

const MATH_PI = Math.PI;

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Punto de superficie genérico (posición + normal) — forma mínima que
 * necesita `illuminanceFromFixture` (Fase 4: "el mismo solver calcula
 * cualquier superficie mediante punto, normal y contexto"). `GridPoint`
 * (`lightingEngineCore.ts`) y `EnclosurePatch` (`roomPatches.ts`) son ambos
 * estructuralmente compatibles.
 */
export interface SurfacePoint {
    x: number;
    y: number;
    z: number;
    normal: Vector3;
}

/**
 * Kernel por lotes inyectable (Fase 12, "Rendimiento: Worker y WASM"):
 * misma semántica que sumar `illuminanceFromFixture` para cada punto × cada
 * luminaria, pero en una sola llamada — permite que `calculatePointByPoint`
 * (`lightingEngineCore.ts`) delegue a una implementación acelerada (ej.
 * `hooks/wasmDirectIlluminanceKernel.ts`) sin que este archivo ni
 * `lightingEngineCore.ts` sepan nada de WASM/Worker (se mantienen puros,
 * ver eslint.config.js §4.1). `points` viene SIEMPRE filtrado a los puntos
 * activos de la malla; el resultado debe tener el mismo largo y orden.
 */
export type DirectIlluminanceBatchKernel = (points: SurfacePoint[], fixtures: Fixture[], obstacles: OcclusionBox[]) => number[];

/**
 * Iluminancia directa (lux) que aporta `fixture` sobre `point`, según su
 * matriz fotométrica, la ley del inverso del cuadrado y el coseno de
 * incidencia (Lambert) respecto a `point.normal`. Compartida entre
 * `lightingEngineCore.ts` (puntos de malla) y `firstBounceReflection.ts`
 * (parches de la envolvente) — Fase 7.
 */
export function illuminanceFromFixture(point: SurfacePoint, fixture: Fixture, obstacles: OcclusionBox[]): number {
    const dx = point.x - fixture.x;
    const dy = point.y - fixture.y;
    const dz = point.z - fixture.z;
    const dist2 = dx * dx + dy * dy + dz * dz;

    if (dist2 < 1e-6) {
        return 0;
    }

    // Fase 6: oclusión — sin línea de vista directa, la luminaria no aporta
    // nada a este punto. `obstacles` viene vacío por defecto (ver
    // `calculateLightingResult`), así que este chequeo no tiene costo ni
    // efecto para ningún llamador que no pase obstáculos explícitamente.
    if (obstacles.length > 0 && isSegmentOccluded(point, { x: fixture.x, y: fixture.y, z: fixture.z }, obstacles)) {
        return 0;
    }

    const dist = Math.sqrt(dist2);
    // Coseno de incidencia (Lambert): producto punto entre la dirección
    // unitaria punto→luminaria y la normal de la superficie receptora. Con
    // `point.normal = (0,0,1)` (único caso que produce `buildGrid` hoy) esto
    // es exactamente `-dz/dist`, igual que la fórmula anterior.
    const cosIncident = Math.max(
        0,
        (-dx / dist) * point.normal.x + (-dy / dist) * point.normal.y + (-dz / dist) * point.normal.z,
    );

    if (cosIncident <= 0) {
        return 0;
    }

    const gammaDeg = (Math.acos(-dz / dist) * 180) / MATH_PI;
    const rawAzimuthDeg = (Math.atan2(dy, dx) * 180) / MATH_PI;
    const azimuthDeg = rawAzimuthDeg - (fixture.rotation ?? 0);

    return (candela(fixture, gammaDeg, azimuthDeg) * cosIncident) / dist2;
}

/** Área luminosa real (m²) de la luminaria, para el cálculo de luminancia (UGR, Fase 9). Fallback conservador si no hay dimensiones. */
export function luminousArea(fixture: Fixture): number {
    const dims = fixture.dimensions;
    if (dims && dims.length > 0 && dims.width > 0) {
        return dims.length * dims.width;
    }
    return 0.1;
}
