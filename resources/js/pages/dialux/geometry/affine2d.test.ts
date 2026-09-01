import { describe, expect, it } from 'vitest';
import { type Affine, invert, sampleAffine } from './affine2d';

function apply(m: Affine, p: { x: number; y: number }) {
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

describe('affine2d', () => {
    it('sampleAffine reconstruye zoom + pan + flip-Y de forma exacta', () => {
        const k = 42;
        const panX = 137;
        const panY = 89;
        const s2s = (p: { x: number; y: number }) => ({
            x: p.x * k + panX,
            y: -p.y * k + panY,
        });
        const m = sampleAffine(s2s)!;
        for (const p of [
            { x: 0, y: 0 },
            { x: 3.5, y: -2.1 },
            { x: -10, y: 7 },
        ]) {
            const got = apply(m, p);
            expect(got.x).toBeCloseTo(s2s(p).x, 6);
            expect(got.y).toBeCloseTo(s2s(p).y, 6);
        }
    });

    it('sampleAffine devuelve null si la cámara es degenerada', () => {
        expect(sampleAffine(() => ({ x: 5, y: 5 }))).toBeNull();
    });

    it('invert es la inversa real (ida y vuelta = identidad)', () => {
        const m: Affine = { a: 20, b: 0, c: 0, d: -20, e: 100, f: 400 };
        const inv = invert(m)!;
        for (const p of [
            { x: 0, y: 0 },
            { x: 4, y: 3 },
            { x: -7, y: 11 },
        ]) {
            const round = apply(inv, apply(m, p));
            expect(round.x).toBeCloseTo(p.x, 6);
            expect(round.y).toBeCloseTo(p.y, 6);
        }
    });

    it('invert devuelve null para una matriz singular', () => {
        expect(invert({ a: 0, b: 0, c: 0, d: 0, e: 1, f: 2 })).toBeNull();
    });
});
