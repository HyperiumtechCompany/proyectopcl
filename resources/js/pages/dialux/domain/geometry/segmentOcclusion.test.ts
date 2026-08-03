import { describe, expect, it } from 'vitest';
import type { OcclusionBox } from './occlusionBoxes';
import { isSegmentOccluded } from './segmentOcclusion';

/**
 * Casos de prueba nombrados por el plan maestro (Fase 6, §11): "bloqueo
 * total por muro, media apertura, ventana transparente, punto cercano a
 * superficie, objeto delgado". Cada uno se prueba aquí directamente contra
 * el test de intersección segmento-caja, independiente de si la caja vino de
 * un muro o de una partición (`occlusionBoxes.test.ts` cubre esa parte).
 */

const FULL_WALL: OcclusionBox = { originX: 2, originY: -1, angleRad: Math.PI / 2, length: 2, thickness: 0.2, zMin: 0, zMax: 2.8 };

describe('isSegmentOccluded — bloqueo total', () => {
    it('un muro sólido entre el punto y la luminaria ocluye', () => {
        const point = { x: 0, y: 0, z: 0.8 };
        const fixture = { x: 4, y: 0, z: 2.5 };
        expect(isSegmentOccluded(point, fixture, [FULL_WALL])).toBe(true);
    });

    it('sin obstáculos en el camino, no ocluye', () => {
        const point = { x: 0, y: 0, z: 0.8 };
        const fixture = { x: 4, y: 0, z: 2.5 };
        expect(isSegmentOccluded(point, fixture, [])).toBe(false);
    });

    it('un muro que no está en el camino (misma habitación, lado opuesto) no ocluye', () => {
        const point = { x: 0, y: 5, z: 0.8 };
        const fixture = { x: 0, y: 6, z: 2.5 };
        expect(isSegmentOccluded(point, fixture, [FULL_WALL])).toBe(false);
    });
});

describe('isSegmentOccluded — media apertura (puerta) y ventana transparente', () => {
    // Simula una ventana: dos cajas (antepecho y dintel) dejan un hueco transparente en z=[0.9, 2.1].
    const sill: OcclusionBox = { originX: 2, originY: -0.1, angleRad: 0, length: 2, thickness: 0.2, zMin: 0, zMax: 0.9 };
    const lintel: OcclusionBox = { originX: 2, originY: -0.1, angleRad: 0, length: 2, thickness: 0.2, zMin: 2.1, zMax: 2.8 };
    const windowBoxes = [sill, lintel];

    it('un rayo que pasa por la altura del vidrio (entre antepecho y dintel) NO se bloquea', () => {
        const point = { x: 2.5, y: -2, z: 1.5 };
        const fixture = { x: 2.5, y: 2, z: 1.5 };
        expect(isSegmentOccluded(point, fixture, windowBoxes)).toBe(false);
    });

    it('un rayo que pasa por debajo del antepecho SÍ se bloquea', () => {
        const point = { x: 2.5, y: -2, z: 0.3 };
        const fixture = { x: 2.5, y: 2, z: 0.3 };
        expect(isSegmentOccluded(point, fixture, windowBoxes)).toBe(true);
    });

    it('un rayo que pasa por encima del dintel SÍ se bloquea', () => {
        const point = { x: 2.5, y: -2, z: 2.5 };
        const fixture = { x: 2.5, y: 2, z: 2.5 };
        expect(isSegmentOccluded(point, fixture, windowBoxes)).toBe(true);
    });

    it('media apertura: un rayo diagonal que cruza justo el borde del vano (entra por el hueco, tangente al dintel) no se bloquea', () => {
        const point = { x: 2.5, y: -2, z: 2.05 };
        const fixture = { x: 2.5, y: 2, z: 2.05 };
        expect(isSegmentOccluded(point, fixture, windowBoxes)).toBe(false);
    });
});

describe('isSegmentOccluded — punto cercano a superficie (tolerancia de auto-intersección)', () => {
    it('un punto de cálculo apoyado justo sobre la cara de un muro (mismo lado) no se autoocluye', () => {
        // El punto está en el borde exacto local x=0 de la caja (originX=2, angleRad=PI/2 → eje local a lo largo de Y).
        const point = { x: 2, y: -1, z: 1 };
        const fixture = { x: 2, y: -3, z: 1 }; // ambos del mismo lado, sin cruzar el muro
        expect(isSegmentOccluded(point, fixture, [FULL_WALL])).toBe(false);
    });

    it('una luminaria apoyada justo sobre la cara de la caja, con el punto del otro lado, SÍ se ocluye (el muro real sigue en medio)', () => {
        const point = { x: -1, y: 0, z: 1 };
        const fixture = { x: 5, y: 0, z: 1 };
        expect(isSegmentOccluded(point, fixture, [FULL_WALL])).toBe(true);
    });
});

describe('isSegmentOccluded — objeto delgado (partición fina)', () => {
    it('una partición de 0.03m de espesor sigue bloqueando correctamente un rayo perpendicular', () => {
        const thinPartition: OcclusionBox = { originX: 0, originY: 3, angleRad: 0, length: 5, thickness: 0.03, zMin: 0.15, zMax: 2.1 };
        const point = { x: 2, y: 0, z: 1 };
        const fixture = { x: 2, y: 6, z: 1 };
        expect(isSegmentOccluded(point, fixture, [thinPartition])).toBe(true);
    });

    it('un rayo casi paralelo a un objeto delgado, pero que pasa a un lado, no lo atraviesa por error', () => {
        const thinPartition: OcclusionBox = { originX: 0, originY: 3, angleRad: 0, length: 5, thickness: 0.03, zMin: 0.15, zMax: 2.1 };
        const point = { x: 2, y: 5, z: 1 };
        const fixture = { x: 2.01, y: 10, z: 1 }; // permanece del lado y>3.015 todo el trayecto
        expect(isSegmentOccluded(point, fixture, [thinPartition])).toBe(false);
    });
});

// Nota: "dos niveles superpuestos" (caso nombrado por el plan) no se prueba
// aquí — `isSegmentOccluded` es un primitivo geométrico puro que solo ve la
// lista de cajas que se le pasa; la separación por nivel es responsabilidad
// de quien arma esa lista (`runDirectPreviewEngine.ts`, que filtra obstáculos
// por `levelId` antes de llamar al motor — ver `runDirectPreviewEngine.test.ts`).
