import { describe, expect, it } from 'vitest';
import {
    cercoPostOffsets,
    doorHandlePosition,
    gateLeafLayout,
    pointOnDoorFrame,
} from './doorGeometry';

describe('engine/doorGeometry', () => {
    it('el pomo queda del lado del extremo del vano en muros horizontales y verticales', () => {
        // Muro a lo largo de +X (angle 0): tangente = +X.
        const h0 = doorHandlePosition({ x: 5, y: 2, angle: 0 }, 0.8, 0.03);
        expect(h0.x).toBeCloseTo(5.8);
        expect(h0.z).toBeCloseTo(2.03);
        // Muro a lo largo de +Y del plano (angle 90°): la tangente en (x,z) es +Z.
        const h90 = doorHandlePosition({ x: 5, y: 2, angle: Math.PI / 2 }, 0.8, 0.03);
        expect(h90.x).toBeCloseTo(4.97);
        expect(h90.z).toBeCloseTo(2.8);
    });

    it('coincide con la tangente que usa rotation.y = -angle', () => {
        // Con rotation.y = θ, el eje local X apunta a (cos θ, 0, -sin θ); θ = -angle → (cos a, 0, sin a).
        for (const angle of [0.4, 1.2, 2.6, -1.1]) {
            const p = pointOnDoorFrame({ x: 0, y: 0, angle }, 1, 0);
            expect(p.x).toBeCloseTo(Math.cos(angle));
            expect(p.z).toBeCloseTo(Math.sin(angle));
        }
    });

    it('columnas del cerco: extremos incluidos y separación ≤ la pedida', () => {
        const offsets = cercoPostOffsets(10, 3);
        expect(offsets[0]).toBe(0);
        expect(offsets[offsets.length - 1]).toBeCloseTo(10);
        for (let i = 1; i < offsets.length; i++) {
            expect(offsets[i] - offsets[i - 1]).toBeLessThanOrEqual(3.5);
        }
        expect(cercoPostOffsets(0, 3)).toEqual([]);
        expect(cercoPostOffsets(1, 3)).toEqual([0, 1]);
    });

    it('un portón tiene dos hojas que no se solapan; una corredera, una', () => {
        const [a, b] = gateLeafLayout(4, 'gate');
        expect(a.center + a.width / 2).toBeLessThan(b.center - b.width / 2);
        expect(gateLeafLayout(4, 'sliding')).toHaveLength(1);
    });
});
