import { describe, expect, it } from 'vitest';
import { buildDefaultStairConfig, getAllStairPresets, getStairPreset, validateStairConfig } from './stairNorms';
import type { StairConfig } from './types';

/**
 * Hasta esta ronda, `validateStairConfig()` no tenía ningún caller en producción
 * (ver planes/plan_cierre_brecha_paridad_dialux_evo.md, hallazgo bloqueante §-9.3):
 * el selector "Uso Normativo" del panel de escaleras no producía ninguna advertencia
 * sin importar el valor configurado. Estas pruebas cubren la lógica que ahora sí
 * se conecta desde StairConfigPanel.tsx.
 */

function buildConfig(overrides: Partial<StairConfig> = {}): StairConfig {
    return {
        normativeUse: 'housing',
        orientation: 'south',
        riserHeight: 0.175,
        treadDepth: 0.28,
        stairWidth: 1.0,
        stepCount: 1,
        flights: [
            { id: 'f1', stepCount: 10, direction: 'south', hasLanding: false, landingDepth: 0 },
        ],
        ...overrides,
    };
}

describe('validateStairConfig', () => {
    it('no reporta advertencias para una escalera dentro de los mínimos de vivienda (A.010)', () => {
        const config = buildConfig();
        expect(validateStairConfig(config, 'housing')).toEqual([]);
    });

    it('advierte cuando la contrahuella supera el máximo de la norma seleccionada', () => {
        const config = buildConfig({ riserHeight: 0.19 });
        const warnings = validateStairConfig(config, 'housing');
        expect(warnings.some((w) => w.includes('Contrahuella'))).toBe(true);
        expect(warnings.some((w) => w.includes('RNE A.010'))).toBe(true);
    });

    it('la misma escalera puede cumplir en un uso y NO cumplir en otro más estricto (education vs. housing)', () => {
        // riser 0.16 + huella 0.30 cumple ambas normas y la fórmula de Blondel (2*0.16+0.30=0.62m);
        // el ancho 1.0m cumple A.010 (mín. 0.90) pero no A.040 (mín. 1.20)
        const config = buildConfig({ riserHeight: 0.16, treadDepth: 0.30, stairWidth: 1.0 });

        expect(validateStairConfig(config, 'housing')).toEqual([]);

        const educationWarnings = validateStairConfig(config, 'education');
        expect(educationWarnings.some((w) => w.includes('Ancho'))).toBe(true);
    });

    it('advierte cuando un tramo excede el máximo de escalones sin descanso', () => {
        const config = buildConfig({
            flights: [
                { id: 'f1', stepCount: 25, direction: 'south', hasLanding: false, landingDepth: 0 },
            ],
        });
        const warnings = validateStairConfig(config, 'housing');
        expect(warnings.some((w) => w.includes('escalones supera el máximo'))).toBe(true);
    });

    it('advierte cuando el descanso de un tramo es menor al mínimo normativo', () => {
        const config = buildConfig({
            flights: [
                { id: 'f1', stepCount: 8, direction: 'south', hasLanding: true, landingDepth: 0.5 },
                { id: 'f2', stepCount: 8, direction: 'north', hasLanding: false, landingDepth: 0 },
            ],
        });
        const warnings = validateStairConfig(config, 'housing');
        expect(warnings.some((w) => w.includes('descanso'))).toBe(true);
    });

    it('aplica la fórmula de Blondel independientemente de la norma seleccionada', () => {
        const config = buildConfig({ riserHeight: 0.10, treadDepth: 0.25 });
        const warnings = validateStairConfig(config, 'generic');
        expect(warnings.some((w) => w.includes('Blondel'))).toBe(true);
    });

    it('usa el preset genérico si se pasa un uso normativo desconocido', () => {
        expect(getStairPreset('inexistente' as never)).toBe(getStairPreset('generic'));
    });
});

describe('getAllStairPresets / buildDefaultStairConfig', () => {
    it('expone un preset por cada uso normativo declarado', () => {
        const presets = getAllStairPresets();
        expect(presets.map((p) => p.use).sort()).toEqual(
            ['education', 'generic', 'health', 'housing', 'industry'].sort(),
        );
    });

    it('genera una configuración por defecto válida contra su propia norma', () => {
        const config = buildDefaultStairConfig('education', 3.0);
        expect(validateStairConfig(config, 'education')).toEqual([]);
    });
});
