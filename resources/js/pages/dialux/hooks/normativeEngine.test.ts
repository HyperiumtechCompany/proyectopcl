import { describe, expect, it } from 'vitest';
import {
    computeOverallStatus,
    evaluateCompliance,
    findBestMatchActivity,
    getNormData,
    NORMATIVE_STANDARDS_META,
    type ComplianceResult,
    type NormativeLeafOption,
    type NormativeStandardMeta,
} from './normativeEngine';
import type { Fixture, LightingResult, Room } from './types';

/**
 * Cobertura mínima de `normativeEngine.ts` (hallazgo de Fase 6,
 * planes/plan_agentes_skills_revision_normativa_dialux.md): es la pieza con
 * las citas normativas más específicas de todo el sistema
 * (`NORMATIVE_STANDARDS_META`) y, antes de este archivo, no tenía ningún
 * test — un refactor futuro podía invertir silenciosamente
 * `compliant`/`non_compliant` sin que nada lo detectara.
 */

function buildRoom(overrides: Partial<Room> = {}): Room {
    return {
        id: 'room-1',
        name: 'Aula de prueba',
        vertices: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 4 },
            { x: 0, y: 4 },
        ],
        height: 3,
        color: 'rgba(56,189,248,0.25)',
        ...overrides,
    };
}

function buildResult(overrides: Partial<LightingResult> = {}): LightingResult {
    return {
        avg_lux: 500,
        min_lux: 400,
        max_lux: 600,
        uniformity: 0.7,
        ugr: 18,
        grid_rows: 4,
        grid_cols: 5,
        grid_values: [],
        ...overrides,
    };
}

function buildFixture(overrides: Partial<Fixture> = {}): Fixture {
    return {
        id: 'fixture-1',
        name: 'Luminaria de prueba',
        x: 1,
        y: 1,
        z: 2.5,
        lumens: 2000,
        efficiency: 0.8,
        fixtureType: 'surface',
        lightColor: '#fff5e1',
        ...overrides,
    };
}

function buildNormative(overrides: Partial<NormativeLeafOption> = {}): NormativeLeafOption {
    return {
        title: 'Aula',
        label: 'Aula de enseñanza',
        illuminanceLux: 500,
        ugr: 19,
        uniformity: 0.6,
        ra: 80,
        specificRequirements: null,
        ...overrides,
    };
}

describe('evaluateCompliance', () => {
    it('marca compliant cuando todos los parámetros cumplen holgadamente', () => {
        const room = buildRoom();
        const result = buildResult({ avg_lux: 600, uniformity: 0.75, ugr: 15 });
        const normative = buildNormative();

        const evaluations = evaluateCompliance(room, result, normative);
        const em = evaluations.find((e) => e.parameterId === 'em')!;
        const uo = evaluations.find((e) => e.parameterId === 'uo')!;
        const ugr = evaluations.find((e) => e.parameterId === 'ugr')!;

        expect(em.status).toBe('compliant');
        expect(uo.status).toBe('compliant');
        expect(ugr.status).toBe('compliant');
    });

    it('marca non_compliant cuando la iluminancia calculada es menor que la requerida', () => {
        const room = buildRoom();
        const result = buildResult({ avg_lux: 300 }); // requerido: 500
        const normative = buildNormative();

        const evaluations = evaluateCompliance(room, result, normative);
        const em = evaluations.find((e) => e.parameterId === 'em')!;

        expect(em.status).toBe('non_compliant');
        expect(em.calculatedValue).toBe(300);
        expect(em.requiredValue).toBe(500);
    });

    it('marca warning cuando el valor cumple pero está muy cerca del mínimo (dentro del 15%)', () => {
        const room = buildRoom();
        // 500 requerido; 520 cumple pero está a menos del 15% (575) del mínimo.
        const result = buildResult({ avg_lux: 520 });
        const normative = buildNormative({ illuminanceLux: 500 });

        const evaluations = evaluateCompliance(room, result, normative);
        const em = evaluations.find((e) => e.parameterId === 'em')!;

        expect(em.status).toBe('warning');
    });

    it('UGR usa <=: un valor mayor al límite es non_compliant, uno menor es compliant', () => {
        const room = buildRoom();
        const normative = buildNormative({ ugr: 19 });

        const tooGlary = evaluateCompliance(room, buildResult({ ugr: 25 }), normative);
        expect(tooGlary.find((e) => e.parameterId === 'ugr')!.status).toBe('non_compliant');

        const fine = evaluateCompliance(room, buildResult({ ugr: 10 }), normative);
        expect(fine.find((e) => e.parameterId === 'ugr')!.status).toBe('compliant');
    });

    it('needs_review cuando la norma no especifica uniformidad o UGR para la actividad', () => {
        const room = buildRoom();
        const result = buildResult();
        const normative = buildNormative({ uniformity: null, ugr: null });

        const evaluations = evaluateCompliance(room, result, normative);
        expect(evaluations.find((e) => e.parameterId === 'uo')!.status).toBe('needs_review');
        expect(evaluations.find((e) => e.parameterId === 'ugr')!.status).toBe('needs_review');
    });

    it('Ra: no se evalúa si la norma no lo exige; needs_review si se exige pero falta el dato de la luminaria', () => {
        const room = buildRoom(); // sin colorRenderingRa
        const result = buildResult();

        const sinRequisito = evaluateCompliance(room, result, buildNormative({ ra: null }));
        expect(sinRequisito.find((e) => e.parameterId === 'ra')).toBeUndefined();

        const conRequisito = evaluateCompliance(room, result, buildNormative({ ra: 80 }));
        const ra = conRequisito.find((e) => e.parameterId === 'ra')!;
        expect(ra.status).toBe('needs_review');
    });

    it('Ra: compliant/non_compliant cuando el dato de la luminaria está disponible', () => {
        const result = buildResult();
        const normative = buildNormative({ ra: 80 });

        // 80 requerido; 95 supera el umbral de "warning" (80×1.15=92).
        const bien = evaluateCompliance(buildRoom({ colorRenderingRa: 95 }), result, normative);
        expect(bien.find((e) => e.parameterId === 'ra')!.status).toBe('compliant');

        const mal = evaluateCompliance(buildRoom({ colorRenderingRa: 60 }), result, normative);
        expect(mal.find((e) => e.parameterId === 'ra')!.status).toBe('non_compliant');
    });

    it('Ra: cuando se pasan luminarias, usa el CRI real (peor caso) en vez de room.colorRenderingRa', () => {
        const result = buildResult();
        const normative = buildNormative({ ra: 80 });
        // `colorRenderingRa` quedó igual al requisito (bug histórico: la UI
        // copiaba `act.ra` ahí) — si el motor lo siguiera leyendo, esto
        // saldría "compliant" sin importar la luminaria real instalada.
        const room = buildRoom({ colorRenderingRa: 80 });

        const fixtures = [buildFixture({ cri: 90 }), buildFixture({ id: 'fixture-2', cri: 70 })];
        const evaluations = evaluateCompliance(room, result, normative, undefined, fixtures);
        const ra = evaluations.find((e) => e.parameterId === 'ra')!;

        // Peor caso entre las luminarias (70), no el valor stale del recinto (80).
        expect(ra.calculatedValue).toBe(70);
        expect(ra.status).toBe('non_compliant');
    });

    it('Ra: needs_review si se pasan luminarias pero ninguna tiene CRI cargado', () => {
        const result = buildResult();
        const normative = buildNormative({ ra: 80 });
        const room = buildRoom({ colorRenderingRa: 80 });

        const fixtures = [buildFixture(), buildFixture({ id: 'fixture-2' })];
        const evaluations = evaluateCompliance(room, result, normative, undefined, fixtures);
        const ra = evaluations.find((e) => e.parameterId === 'ra')!;

        expect(ra.status).toBe('needs_review');
    });

    it('normativeSource proviene de standardMeta.source cuando se provee, y de un valor genérico si no', () => {
        const room = buildRoom();
        const result = buildResult();
        const normative = buildNormative();
        const meta: NormativeStandardMeta = NORMATIVE_STANDARDS_META.en_12464_1;

        const conMeta = evaluateCompliance(room, result, normative, meta);
        expect(conMeta[0]!.normativeSource).toBe(meta.source);
        expect(conMeta[0]!.normativeSource).toBe('EN 12464-1:2021');

        const sinMeta = evaluateCompliance(room, result, normative);
        expect(sinMeta[0]!.normativeSource).toBe('Norma seleccionada');
    });
});

describe('computeOverallStatus — prioridad determinista', () => {
    const base: ComplianceResult = {
        parameterId: 'em', parameterName: 'Em', requiredValue: 500, calculatedValue: 500,
        unit: 'lux', status: 'compliant', message: '', normativeSource: 'x',
    };

    it('non_compliant gana sobre cualquier otro estado', () => {
        const results: ComplianceResult[] = [
            { ...base, status: 'compliant' },
            { ...base, status: 'warning' },
            { ...base, status: 'non_compliant' },
        ];
        expect(computeOverallStatus(results)).toBe('non_compliant');
    });

    it('warning gana sobre needs_review y compliant si no hay non_compliant', () => {
        const results: ComplianceResult[] = [
            { ...base, status: 'compliant' },
            { ...base, status: 'needs_review' },
            { ...base, status: 'warning' },
        ];
        expect(computeOverallStatus(results)).toBe('warning');
    });

    it('needs_review gana sobre compliant si es lo peor presente', () => {
        const results: ComplianceResult[] = [
            { ...base, status: 'compliant' },
            { ...base, status: 'needs_review' },
        ];
        expect(computeOverallStatus(results)).toBe('needs_review');
    });

    it('compliant solo si todos los parámetros son compliant', () => {
        const results: ComplianceResult[] = [{ ...base, status: 'compliant' }, { ...base, status: 'compliant' }];
        expect(computeOverallStatus(results)).toBe('compliant');
    });
});

describe('getNormData — normas sin catálogo cargado', () => {
    it('nfpa101 y ds024 devuelven catálogo vacío (documentado explícitamente en el código)', () => {
        expect(getNormData('nfpa101')).toEqual([]);
        expect(getNormData('ds024')).toEqual([]);
    });

    it('en_12464, ies_na, rne_peru y en_1838 sí tienen catálogo cargado', () => {
        expect(getNormData('en_12464_1').length).toBeGreaterThan(0);
        expect(getNormData('iesna_handbook').length).toBeGreaterThan(0);
        expect(getNormData('rne_peru').length).toBeGreaterThan(0);
        expect(getNormData('en_1838').length).toBeGreaterThan(0);
    });
});

describe('findBestMatchActivity', () => {
    it('devuelve null para nfpa101/ds024 sin importar el texto de búsqueda (catálogo vacío)', () => {
        expect(findBestMatchActivity('nfpa101', 'aula')).toBeNull();
        expect(findBestMatchActivity('ds024', 'mina')).toBeNull();
    });

    it('devuelve null cuando ninguna actividad coincide con la búsqueda en una norma con catálogo', () => {
        expect(findBestMatchActivity('en_12464_1', 'xyzxyz-no-deberia-existir-jamas')).toBeNull();
    });

    it('encuentra una actividad real por coincidencia parcial de texto', () => {
        // No fijamos el título exacto (depende del contenido de normativaData.ts),
        // solo confirmamos que una búsqueda genérica de "oficina" encuentra algo.
        const match = findBestMatchActivity('en_12464_1', 'oficina');
        expect(match).not.toBeNull();
        expect(match!.illuminanceLux).toBeGreaterThan(0);
    });
});

