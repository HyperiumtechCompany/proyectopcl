import { describe, expect, it } from 'vitest';
import {
    planRotationToYaw,
    wallSnappedYaw,
    yawToPlanDirection,
} from './rotationHelpers';

const planDir = (deg: number) => ({
    x: Math.cos((deg * Math.PI) / 180),
    y: Math.sin((deg * Math.PI) / 180), // Y hacia abajo: horario en pantalla
});

describe('engine/rotationHelpers', () => {
    it('un objeto rotado a grados horarios en el 2D apunta en 3D a la misma dirección de plano', () => {
        for (const deg of [0, 30, 45, 90, 135, 200, -60]) {
            const got = yawToPlanDirection(planRotationToYaw(deg));
            const want = planDir(deg);
            expect(got.x).toBeCloseTo(want.x, 9);
            expect(got.y).toBeCloseTo(want.y, 9);
        }
    });

    it('coincide con la convención de los muros: -atan2(dy, dx)', () => {
        const wallAngle = Math.atan2(3, 4); // muro que baja hacia la derecha
        const dir = yawToPlanDirection(-wallAngle);
        expect(dir.x).toBeCloseTo(4 / 5, 9);
        expect(dir.y).toBeCloseTo(3 / 5, 9);
    });

    it('sobre un muro, el giro manual se suma al ángulo del muro en el mismo sentido', () => {
        const wallAngle = Math.PI / 6; // 30°
        const dir = yawToPlanDirection(wallSnappedYaw(wallAngle, 15));
        const want = planDir(45);
        expect(dir.x).toBeCloseTo(want.x, 9);
        expect(dir.y).toBeCloseTo(want.y, 9);
    });
});
