import { describe, expect, it } from 'vitest';
import { computeZonalFlux } from './computeZonalFlux';
import type { Fixture } from '@/pages/dialux/hooks/types';

/**
 * Verificación de la integral con un caso de solución matemática conocida:
 * un emisor Lambertiano ideal `I(γ) = I0·cos(γ)` (0 en γ>90°) tiene flujo
 * total hacia abajo EXACTO `Φ = π·I0` — identidad estándar de fotometría
 * (∫₀^2π∫₀^{π/2} I0·cosγ·sinγ dγ dφ = 2π·I0·[sin²γ/2]₀^{π/2} = π·I0). Si el
 * integrador numérico de `computeZonalFlux` no reproduce esto dentro de una
 * tolerancia chica, la fórmula está mal — no hace falta un archivo LDT real
 * para detectarlo.
 */
function buildLambertianWeb(peakCandela: number, referenceLumens?: number): NonNullable<Fixture['photometricWeb']> {
    const gammaAngles: number[] = [];
    const candela: number[] = [];
    for (let g = 0; g <= 90; g += 2.5) {
        gammaAngles.push(g);
        candela.push(peakCandela * Math.cos((g * Math.PI) / 180));
    }
    // Gamma > 90°: 0 (Lambertiano ideal, sin flujo hacia arriba).
    for (let g = 92.5; g <= 180; g += 2.5) {
        gammaAngles.push(g);
        candela.push(0);
    }
    return {
        c_angles: [0],
        gamma_angles: gammaAngles,
        candela: [candela],
        provenance: 'manufacturer',
        reference_lumens: referenceLumens,
    };
}

describe('computeZonalFlux', () => {
    it('devuelve null sin matriz fotométrica', () => {
        expect(computeZonalFlux(null, null)).toBeNull();
        expect(computeZonalFlux(undefined, null)).toBeNull();
    });

    it('devuelve null para fotometría no-manufacturer (sintética/manual) — nada real que verificar', () => {
        const web: NonNullable<Fixture['photometricWeb']> = {
            c_angles: [0],
            gamma_angles: [0, 90],
            candela: [[1000, 0]],
            provenance: 'synthetic',
        };
        expect(computeZonalFlux(web, null)).toBeNull();
    });

    it('Lambertiano ideal: flujo total hacia abajo ≈ π × pico (identidad conocida, tolerancia 0.5%)', () => {
        const web = buildLambertianWeb(1000);
        const result = computeZonalFlux(web, null);

        expect(result).not.toBeNull();
        const expected = Math.PI * 1000;
        expect(Math.abs(result!.downwardFluxLm - expected) / expected).toBeLessThan(0.005);
        // Lambertiano ideal declarado aquí no emite hacia arriba.
        expect(result!.upwardFluxLm).toBeCloseTo(0, 1);
        expect(result!.downwardFluxFractionPct).toBeCloseTo(100, 0);
    });

    it('LOR ≈ 100% cuando el flujo integrado coincide con reference_lumens (matriz internamente consistente)', () => {
        const totalExpected = Math.PI * 1000; // Lambertiano completo, ver test de arriba.
        const web = buildLambertianWeb(1000, totalExpected);
        const result = computeZonalFlux(web, null);

        expect(result!.lightOutputRatioPct).not.toBeNull();
        expect(result!.lightOutputRatioPct!).toBeCloseTo(100, 0);
    });

    it('LOR se aleja de 100% cuando reference_lumens NO coincide con lo que la matriz realmente integra — detecta la divergencia', () => {
        const totalExpected = Math.PI * 1000;
        const web = buildLambertianWeb(1000, totalExpected * 1.5); // declara 50% más flujo del que la matriz realmente tiene.
        const result = computeZonalFlux(web, null);

        expect(result!.lightOutputRatioPct!).toBeCloseTo(66.7, 0);
    });

    it('sin reference_lumens: LOR es null, no inventa un flujo de referencia', () => {
        const web = buildLambertianWeb(1000);
        const result = computeZonalFlux(web, null);
        expect(result!.lightOutputRatioPct).toBeNull();
    });

    it('pasa los valores DECLARADOS por el archivo (metadata) sin modificarlos, para comparar contra lo calculado', () => {
        const web = buildLambertianWeb(1000, Math.PI * 1000);
        const result = computeZonalFlux(web, { downward_flux_fraction_pct: 62.5, light_output_ratio_pct: 85.0 });
        expect(result!.declaredDownwardFluxFractionPct).toBe(62.5);
        expect(result!.declaredLightOutputRatioPct).toBe(85.0);
    });

    it('sin metadata declarada: los campos "declared" son null, no un valor inventado', () => {
        const web = buildLambertianWeb(1000);
        const result = computeZonalFlux(web, null);
        expect(result!.declaredDownwardFluxFractionPct).toBeNull();
        expect(result!.declaredLightOutputRatioPct).toBeNull();
    });

    it('desglose por zonas acumuladas es monótono creciente y termina en el flujo total', () => {
        const web = buildLambertianWeb(1000);
        const result = computeZonalFlux(web, null);
        const zones = result!.cumulativeZonesLm;
        for (let i = 1; i < zones.length; i++) {
            expect(zones[i]!.fluxLm).toBeGreaterThanOrEqual(zones[i - 1]!.fluxLm);
        }
        expect(zones[zones.length - 1]!.fluxLm).toBeCloseTo(result!.totalFluxLm, 6);
    });
});
