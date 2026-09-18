import { describe, expect, it } from 'vitest';
import {
    beamExponent,
    computeLuxGrid,
    illuminanceFrom,
    lumensForTargetLux,
    luxColor,
    peakIntensityCd,
    summarizeLux,
    type LuminaireSource,
} from './exteriorLighting';

const source = (over: Partial<LuminaireSource> = {}): LuminaireSource => ({
    x: 0,
    y: 6,
    z: 0,
    lumens: 10000,
    beamDeg: 60,
    maintenance: 1,
    ...over,
});

describe('site/domain/exteriorLighting', () => {
    it('el exponente hace que la intensidad caiga al 50 % en el ángulo de haz', () => {
        expect(beamExponent(60)).toBeCloseTo(1, 9); // cos 60° = 0.5 → n = 1 (lambertiano)
        for (const beam of [20, 35, 60, 75]) {
            const n = beamExponent(beam);
            expect(Math.pow(Math.cos((beam * Math.PI) / 180), n)).toBeCloseTo(0.5, 9);
        }
    });

    it('bajo la luminaria, E = I0 / h² (10 000 lm a 6 m, n = 1 → ~88.4 lx)', () => {
        const s = source();
        const n = beamExponent(s.beamDeg);
        const i0 = peakIntensityCd(s.lumens, n);
        expect(i0).toBeCloseTo((10000 * 2) / (2 * Math.PI), 6);
        expect(illuminanceFrom(s, n, i0, 0, 0, 0)).toBeCloseTo(i0 / 36, 6);
        expect(illuminanceFrom(s, n, i0, 0, 0, 0)).toBeCloseTo(88.42, 1);
        // Un punto a la altura de la cabeza (o más arriba) no recibe luz.
        expect(illuminanceFrom(s, n, i0, 0, 6, 0)).toBe(0);
    });

    it('conserva el flujo: integrar la iluminancia sobre el suelo recupera casi todo el flujo (sin mantenimiento)', () => {
        const s = source();
        const half = 100;
        const cell = 1;
        const cols = (2 * half) / cell;
        const spec = { minX: -half, minZ: -half, cell, cols, rows: cols };
        const values = computeLuxGrid([s], spec, () => 0);
        let flux = 0;
        for (const e of values) flux += e * cell * cell;
        // Fracción esperada dentro de 100 m: sin²(atan(100/6)) ≈ 0.9965 (n = 1); tolerancia por discretización.
        expect(flux / s.lumens).toBeGreaterThan(0.97);
        expect(flux / s.lumens).toBeLessThan(1.01);
    });

    it('el factor de mantenimiento escala el aporte y dos luminarias suman', () => {
        const spec = { minX: -1, minZ: -1, cell: 1, cols: 2, rows: 2 };
        const one = computeLuxGrid([source({ maintenance: 0.8 })], spec, () => 0);
        const full = computeLuxGrid([source({ maintenance: 1 })], spec, () => 0);
        expect(one[4]).toBeCloseTo(full[4] * 0.8, 4);
        const two = computeLuxGrid(
            [source({ maintenance: 1 }), source({ maintenance: 1 })],
            spec,
            () => 0,
        );
        expect(two[4]).toBeCloseTo(full[4] * 2, 4);
    });

    it('un suelo más alto (plataforma) recibe más luz que uno más bajo', () => {
        const spec = { minX: 0, minZ: 0, cell: 1, cols: 0, rows: 0 };
        const low = computeLuxGrid([source()], spec, () => 0);
        const high = computeLuxGrid([source()], spec, () => 3);
        expect(high[0]).toBeGreaterThan(low[0]);
    });

    it('resume el área elegida: promedio, mínimo, máximo y uniformidad', () => {
        const spec = { minX: 0, minZ: 0, cell: 2, cols: 1, rows: 1 };
        const values = new Float32Array([10, 20, 30, 40]);
        const all = summarizeLux(values, spec, () => true, [source(), source()]);
        expect(all.avgLux).toBeCloseTo(25, 6);
        expect(all.minLux).toBe(10);
        expect(all.maxLux).toBe(40);
        expect(all.uniformity).toBeCloseTo(10 / 25, 6);
        expect(all.luminaires).toBe(2);
        expect(all.fluxLm).toBe(20000);
        expect(all.areaM2).toBe(16);
        const some = summarizeLux(values, spec, (i, j) => i === 1 && j === 1, [source()]);
        expect(some.avgLux).toBe(40);
        const none = summarizeLux(values, spec, () => false, []);
        expect(none.avgLux).toBe(0);
        expect(none.minLux).toBe(0);
    });

    it('con fotometría real la iluminancia sigue la matriz, escala con el flujo y coincide con el modelo si la matriz es lambertiana', () => {
        // Matriz lambertiana: I(γ) = 1000 cd · cos γ, simétrica (un solo plano C).
        const gammas = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
        const web = {
            c_angles: [0],
            gamma_angles: gammas,
            candela: [gammas.map((g) => 1000 * Math.cos((g * Math.PI) / 180))],
            reference_lumens: 3141.59, // ≈ π·1000 lm (flujo de una fuente lambertiana de 1000 cd)
        };
        const withWeb = source({
            maintenance: 1,
            photometry: { web, scale: 1, orientationRad: 0 },
        });
        const generic = source({ lumens: Math.PI * 1000, beamDeg: 60, maintenance: 1 });
        const nG = beamExponent(60);
        const i0G = peakIntensityCd(generic.lumens, nG);
        for (const r of [0, 2, 5]) {
            const eWeb = illuminanceFrom(withWeb, 1, 0, r, 0, 0);
            const eGen = illuminanceFrom(generic, nG, i0G, r, 0, 0);
            expect(eWeb).toBeCloseTo(eGen, 0);
        }
        // Duplicar la escala duplica la iluminancia; el mantenimiento la multiplica.
        const doubled = source({ maintenance: 1, photometry: { web, scale: 2, orientationRad: 0 } });
        expect(illuminanceFrom(doubled, 1, 0, 3, 0, 0)).toBeCloseTo(
            2 * illuminanceFrom(withWeb, 1, 0, 3, 0, 0),
            6,
        );
        const maintained = source({ maintenance: 0.8, photometry: { web, scale: 1, orientationRad: 0 } });
        expect(illuminanceFrom(maintained, 1, 0, 3, 0, 0)).toBeCloseTo(
            0.8 * illuminanceFrom(withWeb, 1, 0, 3, 0, 0),
            6,
        );
    });

    it('una luminaria asimétrica rota con su orientación (C0 hacia el brazo)', () => {
        // Da luz solo hacia C0 (candela > 0 en el plano C 0°, 0 en el C 180°).
        const web = {
            c_angles: [0, 180],
            gamma_angles: [0, 45, 90],
            candela: [
                [800, 600, 0],
                [0, 0, 0],
            ],
        };
        const facingPlusZ = source({
            maintenance: 1,
            photometry: { web, scale: 1, orientationRad: 0 },
        });
        // Punto hacia +Z (rumbo 0 = atan2(-dx,-dz) con dz = source.z - pz < 0 → az 0): recibe luz.
        expect(illuminanceFrom(facingPlusZ, 1, 0, 0, 0, 3)).toBeGreaterThan(0);
        // Punto hacia -Z: plano C 180° sin luz.
        expect(illuminanceFrom(facingPlusZ, 1, 0, 0, 0, -3)).toBeCloseTo(0, 6);
        // Girada 180°, se invierte.
        const flipped = source({
            maintenance: 1,
            photometry: { web, scale: 1, orientationRad: Math.PI },
        });
        expect(illuminanceFrom(flipped, 1, 0, 0, 0, -3)).toBeGreaterThan(0);
        expect(illuminanceFrom(flipped, 1, 0, 0, 0, 3)).toBeCloseTo(0, 6);
    });

    it('lumensForTargetLux: el flujo necesario para un objetivo, y aplicarlo lo alcanza', () => {
        const s = source({ lumens: 5000, maintenance: 0.8 });
        const needed = lumensForTargetLux(s, 4, 10);
        expect(needed).not.toBeNull();
        const check = lumensForTargetLux({ ...s, lumens: needed as number }, 4, 10);
        expect(check).toBeCloseTo(needed as number, 6);
        // Bajo el poste (r = 0): 10 lx a 6 m con n = 1 y MF 0.8 → Φ = 10·36·2π/(2·0.8)
        const below = lumensForTargetLux(source({ maintenance: 0.8 }), 0, 10) as number;
        expect(below).toBeCloseTo((10 * 36 * 2 * Math.PI) / (2 * 0.8), 3);
        expect(lumensForTargetLux(s, 4, 0)).toBeNull();
    });

    it('la escala de color es transparente en oscuridad y cada vez más opaca con más lux', () => {
        expect(luxColor(0)[3]).toBe(0);
        expect(luxColor(200)[3]).toBeGreaterThan(luxColor(1)[3]);
        expect(luxColor(7.5)).toHaveLength(4);
    });
});
