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
 * Media longitud/ancho reales de la luminaria (m), para el muestreo de
 * oclusión de área (`OCCLUSION_SAMPLE_OFFSETS`, abajo). Reutiliza
 * `fixture.dimensions` cuando existe; si no, deriva un cuadrado equivalente
 * de `luminousArea` (el mismo fallback que ya usa esa función para UGR) — así
 * ninguna luminaria real queda tratada como un punto de tamaño cero.
 */
function fixtureLuminousHalfExtent(fixture: Fixture): { halfX: number; halfY: number } {
    const dims = fixture.dimensions;
    const length = dims ? Number(dims.length) : NaN;
    const width = dims ? Number(dims.width) : NaN;
    if (Number.isFinite(length) && length > 0 && Number.isFinite(width) && width > 0) {
        return { halfX: length / 2, halfY: width / 2 };
    }
    const halfSide = Math.sqrt(luminousArea(fixture)) / 2;
    return { halfX: halfSide, halfY: halfSide };
}

/**
 * Centro + 4 esquinas del rectángulo luminoso, como fracción de la media
 * longitud/ancho — CADA UNA se prueba de forma independiente contra
 * `obstacles` (ver `illuminanceFromFixture`) para producir una fracción de
 * visibilidad continua (0, 0.2, 0.4, 0.6, 0.8, 1) en vez de un corte binario
 * 0/1. No se orienta por `fixture.rotation` (mantener el muestreo simple y
 * barato) — para una luminaria aproximadamente cuadrada (el caso típico) el
 * error de orientación es despreciable frente al problema que resuelve.
 */
const OCCLUSION_SAMPLE_OFFSETS: ReadonlyArray<{ fx: number; fy: number }> = [
    { fx: 0, fy: 0 },
    { fx: 1, fy: 1 },
    { fx: -1, fy: 1 },
    { fx: 1, fy: -1 },
    { fx: -1, fy: -1 },
];

/**
 * Fracción de visibilidad [0,1] de `fixture` desde `point`, muestreando
 * `OCCLUSION_SAMPLE_OFFSETS` sobre su extensión luminosa real en vez de un
 * único rayo al centro (Ronda "sombra dura", 2026-08-21).
 *
 * Motivo físico: `isSegmentOccluded` con UN solo rayo centro→punto trata la
 * luminaria como una fuente puntual — el borde de cualquier sombra queda
 * matemáticamente afilado (un lado del corte 0 lx, el otro lado el valor
 * pleno), algo que ninguna luminaria real produce (siempre tiene área). En
 * un ambiente con oclusores cercanos al plano de trabajo (particiones,
 * columnas, muescas de muro) esto hace que el estadístico Emin sea
 * inestable frente a cambios de fracción de milímetro en la geometría: un
 * punto de malla que cae justo en ese borde matemático puede pasar de 0 lx a
 * su valor pleno con un desplazamiento mínimo — verificado empíricamente en
 * "Módulo VII" (proyecto real con particiones): variar solo el espaciado de
 * malla (0.1 → 0.5 m, sin tocar geometría) hizo que Emin oscilara de forma
 * NO monótona entre 27.9 y 58.3 lx para el mismo ambiente, evidencia de un
 * artefacto de muestreo, no de un valor físico estable. El muestreo de área
 * (5 rayos repartidos en el rectángulo luminoso real) reemplaza ese corte
 * binario por una rampa de penumbra continua — el mismo principio que usa
 * cualquier motor de render/lumínico profesional para sombras suaves de
 * fuentes de área, aplicado aquí a CUALQUIER proyecto con oclusión activa,
 * no una corrección puntual para este caso.
 */
export function fixtureVisibilityFraction(point: { x: number; y: number; z: number }, fixture: Fixture, obstacles: OcclusionBox[]): number {
    if (obstacles.length === 0) {
        return 1;
    }
    const { halfX, halfY } = fixtureLuminousHalfExtent(fixture);
    let visibleCount = 0;
    for (const sample of OCCLUSION_SAMPLE_OFFSETS) {
        const samplePoint = {
            x: fixture.x + sample.fx * halfX,
            y: fixture.y + sample.fy * halfY,
            z: fixture.z,
        };
        if (!isSegmentOccluded(point, samplePoint, obstacles)) {
            visibleCount += 1;
        }
    }
    return visibleCount / OCCLUSION_SAMPLE_OFFSETS.length;
}

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

    // Fase 6: oclusión — `obstacles` viene vacío por defecto (ver
    // `calculateLightingResult`), así que este chequeo no tiene costo ni
    // efecto para ningún llamador que no pase obstáculos explícitamente.
    // Con obstáculos, `fixtureVisibilityFraction` reemplaza el corte binario
    // original por una fracción de visibilidad de área — ver su doc arriba.
    let visibility = 1;
    if (obstacles.length > 0) {
        visibility = fixtureVisibilityFraction(point, fixture, obstacles);
        if (visibility <= 0) {
            return 0;
        }
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

    return (candela(fixture, gammaDeg, azimuthDeg) * cosIncident * visibility) / dist2;
}

/** Área luminosa real (m²) de la luminaria, para el cálculo de luminancia (UGR, Fase 9). Fallback conservador si no hay dimensiones. */
export function luminousArea(fixture: Fixture): number {
    const dims = fixture.dimensions;
    if (dims && dims.length > 0 && dims.width > 0) {
        return dims.length * dims.width;
    }
    return 0.1;
}
