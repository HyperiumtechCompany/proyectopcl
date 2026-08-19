import { describe, expect, it } from 'vitest';
import type { Fixture, Room } from '@/pages/dialux/hooks/useEditorStore';
import { buildRequirementEvaluations, resolveRaCalculated, resolveRaRequired } from './requirementEvaluations';

/**
 * Hallazgo bloqueante (planes/plan_cierre_brecha_paridad_dialux_evo.md Â§-9.4):
 * `buildRequirementEvaluations()` (el que alimenta el PDF exportado) no
 * evaluaba Ra/CRI en absoluto, mientras `evaluateCompliance()`
 * (`normativeEngine.ts`, el panel interactivo) sÃ­ lo hacÃ­a â€” el mismo
 * ambiente podÃ­a mostrar "Cumple" en el documento entregado y "No cumple"
 * en la pantalla que el proyectista ya revisÃ³. Estas pruebas cubren la
 * resoluciÃ³n del requisito/valor de Ra y su integraciÃ³n en la evaluaciÃ³n.
 */

function buildFixture(overrides: Partial<Fixture> = {}): Fixture {
    return {
        id: 'fixture-1',
        name: 'Panel LED',
        x: 0, y: 0, z: 2.8,
        lumens: 4000,
        efficiency: 0.8,
        fixtureType: 'panel',
        lightColor: '#fff5e1',
        roomId: 'room-1::ambient-1',
        ...overrides,
    };
}

function buildRoom(overrides: Partial<Room> = {}): Room {
    return {
        id: 'room-1',
        name: 'Ambiente de prueba',
        vertices: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 4 },
            { x: 0, y: 4 },
        ],
        height: 3,
        color: 'rgba(56,189,248,0.25)',
        illuminanceLux: 100,
        norma: 100,
        fixtureLumens: 4000,
        fixtureFlux: 4000,
        ...overrides,
    };
}

describe('resolveRaRequired', () => {
    it('sin normativeActivity/normativeStandard, no hay requisito de Ra', () => {
        expect(resolveRaRequired(buildRoom())).toBeNull();
    });

    it('con una actividad EN 12464-1 real que exige Ra, resuelve el mismo valor que usa el panel interactivo', () => {
        const room = buildRoom({
            normativeStandard: 'en_12464_1',
            normativeActivity: 'Vestibulos de entrada',
        });
        // EN 12464-1 exige Ra >= 60 para "Vestibulos de entrada" (normativaData.ts).
        expect(resolveRaRequired(room)).toBe(60);
    });
});

describe('resolveRaCalculated', () => {
    it('sin luminarias con CRI declarado, no hay valor calculado', () => {
        expect(resolveRaCalculated([buildFixture({ cri: undefined })])).toBeNull();
    });

    it('toma el peor caso (mÃ­nimo) entre las luminarias instaladas', () => {
        const fixtures = [
            buildFixture({ id: 'f1', cri: 90 }),
            buildFixture({ id: 'f2', cri: 70 }),
        ];
        expect(resolveRaCalculated(fixtures)).toBe(70);
    });
});

describe('buildRequirementEvaluations â€” mÃ©trica "ra"', () => {
    const inputs = { illuminanceLux: 100 };

    it('sin raRequired (actividad no regula Ra, o sin actividad asignada), no agrega ninguna fila de Ra', () => {
        const evaluations = buildRequirementEvaluations(inputs, null, null, null, undefined, null, null, null);
        expect(evaluations.some((e) => e.metric === 'ra')).toBe(false);
    });

    it('con raRequired pero ninguna luminaria declara CRI: not-evaluated, no fail decorativo', () => {
        const evaluations = buildRequirementEvaluations(inputs, null, null, null, 'EN 12464 Â· Vestibulos', null, 60, null);
        const ra = evaluations.find((e) => e.metric === 'ra')!;
        expect(ra.status).toBe('not-evaluated');
        expect(ra.calculatedValue).toBeNull();
    });

    it('luminaria instalada con CRI por debajo del mÃ­nimo exigido: falla explÃ­citamente (el bug que esto corrige)', () => {
        const evaluations = buildRequirementEvaluations(inputs, null, null, null, 'EN 12464 Â· Vestibulos', null, 60, 50);
        const ra = evaluations.find((e) => e.metric === 'ra')!;
        expect(ra.status).toBe('fail');
        expect(ra.calculatedValue).toBe(50);
        expect(ra.requiredValue).toBe(60);
    });

    it('luminaria instalada cumple el Ra exigido: pass', () => {
        const evaluations = buildRequirementEvaluations(inputs, null, null, null, 'EN 12464 Â· Vestibulos', null, 60, 80);
        const ra = evaluations.find((e) => e.metric === 'ra')!;
        expect(ra.status).toBe('pass');
    });

    it('sin fuente normativa citada (source undefined), nunca marca pass/fail aunque haya raRequired', () => {
        const evaluations = buildRequirementEvaluations(inputs, null, null, null, undefined, null, 60, 50);
        const ra = evaluations.find((e) => e.metric === 'ra')!;
        expect(ra.status).toBe('not-evaluated');
    });
});

