import { describe, expect, it } from 'vitest';
import { evaluateEmergencyCompliance } from './emergencyCompliance';

/**
 * Suite de la Fase 14 ("Emergencia", plan maestro §11). Los valores (10 lx
 * RNE A.130, 1 lx / 0.5 lx EN 1838) fueron verificados con el agente
 * `chief-electrical-engineer-reviewer` contra el texto oficial de ambas
 * normas antes de implementar — ver `planes/fase14_progreso_dialux.md`.
 */
describe('evaluateEmergencyCompliance — evacuation-route', () => {
    it('evalúa RNE A.130 (obligatoria, 10 lx) y EN 1838 (referencia, 1 lx) por separado, nunca fusionadas', () => {
        const evaluations = evaluateEmergencyCompliance('evacuation-route', 5);

        expect(evaluations).toHaveLength(2);

        const a130 = evaluations.find((e) => e.standard === 'rne_a130')!;
        expect(a130.mandatory).toBe(true);
        expect(a130.requiredLux).toBe(10);
        expect(a130.status).toBe('fail'); // 5 lx < 10 lx exigido

        const en1838 = evaluations.find((e) => e.standard === 'en_1838')!;
        expect(en1838.mandatory).toBe(false);
        expect(en1838.requiredLux).toBe(1);
        expect(en1838.status).toBe('pass'); // 5 lx >= 1 lx de referencia

        // Nunca se fusionan en un solo status/valor "ganador".
        expect(a130.status).not.toBe(en1838.status);
    });

    it('con 10 lx exactos, RNE A.130 pasa (>=, no >)', () => {
        const [a130] = evaluateEmergencyCompliance('evacuation-route', 10);
        expect(a130!.status).toBe('pass');
    });

    it('sin resultado calculado (null), ambas evaluaciones quedan not-evaluated, nunca pass/fail por defecto', () => {
        const evaluations = evaluateEmergencyCompliance('evacuation-route', null);
        expect(evaluations.every((e) => e.status === 'not-evaluated')).toBe(true);
    });

    it('cada evaluación cita su fuente normativa completa', () => {
        const evaluations = evaluateEmergencyCompliance('evacuation-route', 5);
        for (const evaluation of evaluations) {
            expect(evaluation.source.length).toBeGreaterThan(0);
        }
        expect(evaluations.find((e) => e.standard === 'rne_a130')!.source).toContain('Art. 40');
    });
});

describe('evaluateEmergencyCompliance — antipanic-area', () => {
    it('solo evalúa EN 1838 (0.5 lx, referencia) — RNE A.130 no define esta categoría', () => {
        const evaluations = evaluateEmergencyCompliance('antipanic-area', 0.6);

        expect(evaluations).toHaveLength(1);
        expect(evaluations[0]!.standard).toBe('en_1838');
        expect(evaluations[0]!.mandatory).toBe(false);
        expect(evaluations[0]!.requiredLux).toBe(0.5);
        expect(evaluations[0]!.status).toBe('pass');
        // No se inventa un equivalente peruano — nunca aparece 'rne_a130' aquí.
        expect(evaluations.some((e) => e.standard === 'rne_a130')).toBe(false);
    });
});
