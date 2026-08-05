import { describe, expect, it } from 'vitest';
import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import type { SurfacePoint } from './directIlluminance';
import { skyIlluminanceAtSurfacePoint } from './skyIlluminance';
import type { SkyAperturePatch } from './windowSkyAperture';

const UP_POINT: SurfacePoint = { x: 0, y: 0, z: 0, normal: { x: 0, y: 0, z: 1 } };

function skylightPatch(z = 10): SkyAperturePatch {
    // Parche "cenital" sintético (no pasa por buildWindowSkyPatches) — normal
    // hacia adentro del recinto (hacia abajo, ya que está sobre el techo).
    return { x: 0, y: 0, z, normal: { x: 0, y: 0, z: -1 }, area: 1 };
}

describe('skyIlluminanceAtSurfacePoint', () => {
    it('en el cenit exacto (parche directamente arriba), usa L=1 y la fórmula área·cos·cos/dist²', () => {
        const value = skyIlluminanceAtSurfacePoint(UP_POINT, [skylightPatch(10)], 1, []);
        // cosPatch=1, cosPoint=1, área=1, dist²=100 → 1·1·1·1/100 = 0.01
        expect(value).toBeCloseTo(0.01, 9);
    });

    it('escala linealmente con la transmitancia del vidrio', () => {
        const full = skyIlluminanceAtSurfacePoint(UP_POINT, [skylightPatch(10)], 1, []);
        const half = skyIlluminanceAtSurfacePoint(UP_POINT, [skylightPatch(10)], 0.5, []);
        expect(half).toBeCloseTo(full / 2, 9);
    });

    it('es 0 con transmitancia 0 o negativa, sin evaluar los parches', () => {
        expect(skyIlluminanceAtSurfacePoint(UP_POINT, [skylightPatch(10)], 0, [])).toBe(0);
        expect(skyIlluminanceAtSurfacePoint(UP_POINT, [skylightPatch(10)], -1, [])).toBe(0);
    });

    it('excluye un parche que no "mira" hacia el punto (cosPatch <= 0)', () => {
        const patchBelowPointingDown: SkyAperturePatch = { x: 0, y: 0, z: -10, normal: { x: 0, y: 0, z: -1 }, area: 1 };
        expect(skyIlluminanceAtSurfacePoint(UP_POINT, [patchBelowPointingDown], 1, [])).toBe(0);
    });

    it('excluye un parche que el punto no puede "ver" (cosPoint <= 0)', () => {
        const downwardPoint: SurfacePoint = { x: 0, y: 0, z: 0, normal: { x: 0, y: 0, z: -1 } };
        expect(skyIlluminanceAtSurfacePoint(downwardPoint, [skylightPatch(10)], 1, [])).toBe(0);
    });

    it('un obstáculo entre el punto y el parche anula su contribución', () => {
        const obstacle: OcclusionBox = { originX: -1, originY: -1, angleRad: 0, length: 2, thickness: 2, zMin: 5, zMax: 6 };
        expect(skyIlluminanceAtSurfacePoint(UP_POINT, [skylightPatch(10)], 1, [obstacle])).toBe(0);
    });

    it('suma la contribución de varios parches', () => {
        const single = skyIlluminanceAtSurfacePoint(UP_POINT, [skylightPatch(10)], 1, []);
        const doubled = skyIlluminanceAtSurfacePoint(UP_POINT, [skylightPatch(10), skylightPatch(10)], 1, []);
        expect(doubled).toBeCloseTo(single * 2, 9);
    });
});
