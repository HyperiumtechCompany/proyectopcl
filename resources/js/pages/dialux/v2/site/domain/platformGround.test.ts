import { describe, expect, it } from 'vitest';
import { platformGroundAt, type PlatformSurface } from './platformGround';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
];
const surf = (verts: ReturnType<typeof rect>, topM: number): PlatformSurface => ({ vertices: verts, topM });

// Baja (-3.5) al sur, media (0) al norte, alta (3.5) más al norte; comparten bordes en y=0 e y=-20.
const low = surf(rect(0, 0, 60, 30), -3.5);
const mid = surf(rect(0, -20, 60, 0), 0);
const high = surf(rect(0, -50, 60, -20), 3.5);

describe('site/domain/platformGround', () => {
    it('un punto dentro de una plataforma toma su cota, sin importar taludes vecinos', () => {
        expect(platformGroundAt({ x: 30, y: 15 }, [low, mid, high], 1)).toBe(-3.5);
        expect(platformGroundAt({ x: 30, y: -10 }, [low, mid, high], 1)).toBe(0);
        expect(platformGroundAt({ x: 30, y: -35 }, [low, mid, high], 1)).toBe(3.5);
    });

    it('justo sobre el borde compartido (un cerco "al ras") queda en el nivel de ABAJO', () => {
        expect(platformGroundAt({ x: 30, y: 0 }, [low, mid, high], 1)).toBe(-3.5);
        expect(platformGroundAt({ x: 30, y: -20 }, [low, mid, high], 1)).toBe(0);
    });

    it('un punto a 0.5 m del borde, dentro de la baja, NO se sube por el talud de la media', () => {
        expect(platformGroundAt({ x: 30, y: 0.5 }, [low, mid, high], 1)).toBe(-3.5);
    });

    it('con plataformas anidadas manda la más alta que contiene el punto', () => {
        const ground = surf(rect(-100, -100, 100, 100), 0);
        const raised = surf(rect(0, 0, 20, 20), 3.5);
        expect(platformGroundAt({ x: 10, y: 10 }, [ground, raised], 1)).toBe(3.5);
        expect(platformGroundAt({ x: 50, y: 50 }, [ground, raised], 1)).toBe(0);
    });

    it('el cerco perimetral de una plataforma ALTA dentro de una grande se queda arriba (anidadas)', () => {
        const ground = surf(rect(-100, -100, 100, 100), 0);
        const raised = surf(rect(0, 0, 20, 20), 3.5);
        expect(platformGroundAt({ x: 0, y: 10 }, [ground, raised], 1)).toBe(3.5);
        expect(platformGroundAt({ x: 10, y: 0 }, [ground, raised], 1)).toBe(3.5);
    });

    it('un foso dentro de una plataforma: su borde queda en el nivel de arriba', () => {
        const ground = surf(rect(-100, -100, 100, 100), 0);
        const pit = surf(rect(0, 0, 20, 20), -3.5);
        expect(platformGroundAt({ x: 0, y: 10 }, [ground, pit], 1)).toBe(0);
    });

    it('fuera de toda plataforma no decide nada (manda el terreno)', () => {
        expect(platformGroundAt({ x: 500, y: 500 }, [low, mid, high], 1)).toBeNull();
    });
});
