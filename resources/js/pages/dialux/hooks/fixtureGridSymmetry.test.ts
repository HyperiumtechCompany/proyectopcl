import { describe, expect, it } from 'vitest';
import {
    checkGroupSymmetry,
    deriveFixtureGridModules,
    findAdjacentModuleSequence,
    isSequenceSymmetric,
    suggestMirrorCorrection,
    suggestUniformCorrection,
    type FixtureGridModule,
} from './fixtureGridSymmetry';
import type { Fixture } from './types';

let seq = 0;
function makeFixture(overrides: Partial<Fixture> & { x: number; y: number }): Fixture {
    seq += 1;
    return {
        id: `fx-${seq}`,
        name: `Fixture ${seq}`,
        z: 2.7,
        lumens: 4000,
        efficiency: 0.8,
        fixtureType: 'recessed',
        lightColor: '#fff5e1',
        ...overrides,
    };
}

/** Genera un grupo rectangular columns x rows dentro de [x0,x0+width] x [y0,y0+height], con metadata persistida. */
function makeModuleFixtures(
    groupId: string,
    roomId: string,
    x0: number,
    y0: number,
    width: number,
    height: number,
    columns: number,
    rows: number,
): Fixture[] {
    const fixtures: Fixture[] = [];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < columns; j++) {
            const x = columns > 1 ? x0 + (j / (columns - 1)) * width : x0 + width / 2;
            const y = rows > 1 ? y0 + (i / (rows - 1)) * height : y0 + height / 2;
            fixtures.push(
                makeFixture({ x, y, roomId, gridGroupId: groupId, gridRows: rows, gridColumns: columns }),
            );
        }
    }
    return fixtures;
}

describe('deriveFixtureGridModules', () => {
    it('agrupa por gridGroupId y usa gridRows/gridColumns persistidos', () => {
        const fixtures = makeModuleFixtures('g1', 'room-a', 0, 0, 3, 1, 3, 2);
        const modules = deriveFixtureGridModules(fixtures, 'room-a');
        expect(modules).toHaveLength(1);
        expect(modules[0]).toMatchObject({ groupId: 'g1', rows: 2, columns: 3 });
    });

    it('filtra por roomId', () => {
        const a = makeModuleFixtures('g1', 'room-a', 0, 0, 3, 1, 3, 2);
        const b = makeModuleFixtures('g2', 'room-b', 0, 0, 3, 1, 3, 2);
        const modules = deriveFixtureGridModules([...a, ...b], 'room-a');
        expect(modules.map((m) => m.groupId)).toEqual(['g1']);
    });

    it('sin roomId (undefined), incluye todos los grupos con gridGroupId', () => {
        const a = makeModuleFixtures('g1', 'room-a', 0, 0, 3, 1, 3, 2);
        const b = makeModuleFixtures('g2', 'room-b', 10, 10, 3, 1, 2, 2);
        const modules = deriveFixtureGridModules([...a, ...b], undefined);
        expect(modules.map((m) => m.groupId).sort()).toEqual(['g1', 'g2']);
    });

    it('infiere filas/columnas por clustering de coordenadas si no hay metadata (fixtures legacy)', () => {
        const fixtures = [
            makeFixture({ x: 0, y: 0, roomId: 'r', gridGroupId: 'legacy' }),
            makeFixture({ x: 2, y: 0, roomId: 'r', gridGroupId: 'legacy' }),
            makeFixture({ x: 0, y: 2, roomId: 'r', gridGroupId: 'legacy' }),
            makeFixture({ x: 2, y: 2, roomId: 'r', gridGroupId: 'legacy' }),
        ];
        const modules = deriveFixtureGridModules(fixtures, 'r');
        expect(modules[0]).toMatchObject({ rows: 2, columns: 2 });
    });
});

describe('findAdjacentModuleSequence', () => {
    it('encuentra una fila de 3 modulos adyacentes y alineados, ordenados por X', () => {
        const modules: FixtureGridModule[] = [
            { groupId: 'left', rows: 2, columns: 3, minX: 0, maxX: 3, minY: 0, maxY: 1 },
            { groupId: 'mid', rows: 6, columns: 2, minX: 3.2, maxX: 5.2, minY: 0, maxY: 1 },
            { groupId: 'right', rows: 2, columns: 4, minX: 5.4, maxX: 8.4, minY: 0, maxY: 1 },
        ];
        const seq = findAdjacentModuleSequence(modules, 'mid');
        expect(seq?.map((m) => m.groupId)).toEqual(['left', 'mid', 'right']);
    });

    it('excluye un modulo alineado pero con un hueco grande (no adyacente)', () => {
        const modules: FixtureGridModule[] = [
            { groupId: 'left', rows: 2, columns: 3, minX: 0, maxX: 3, minY: 0, maxY: 1 },
            { groupId: 'mid', rows: 6, columns: 2, minX: 3.2, maxX: 5.2, minY: 0, maxY: 1 },
            { groupId: 'far', rows: 2, columns: 2, minX: 30, maxX: 32, minY: 0, maxY: 1 },
        ];
        const seq = findAdjacentModuleSequence(modules, 'mid');
        expect(seq?.map((m) => m.groupId)).toEqual(['left', 'mid']);
    });

    it('modulo aislado (sin vecinos alineados+adyacentes) devuelve null', () => {
        const modules: FixtureGridModule[] = [
            { groupId: 'solo', rows: 2, columns: 2, minX: 0, maxX: 2, minY: 0, maxY: 2 },
            { groupId: 'other-room-ish', rows: 3, columns: 3, minX: 50, maxX: 53, minY: 50, maxY: 53 },
        ];
        expect(findAdjacentModuleSequence(modules, 'solo')).toBeNull();
    });

    it('tambien detecta secuencias verticales (columna), ordenadas por Y', () => {
        const modules: FixtureGridModule[] = [
            { groupId: 'top', rows: 2, columns: 2, minX: 0, maxX: 2, minY: 0, maxY: 2 },
            { groupId: 'bottom', rows: 2, columns: 2, minX: 0, maxX: 2, minY: 2.2, maxY: 4.2 },
        ];
        const seq = findAdjacentModuleSequence(modules, 'top');
        expect(seq?.map((m) => m.groupId)).toEqual(['top', 'bottom']);
    });

    it('grupo inexistente devuelve null', () => {
        const modules: FixtureGridModule[] = [
            { groupId: 'a', rows: 1, columns: 1, minX: 0, maxX: 1, minY: 0, maxY: 1 },
        ];
        expect(findAdjacentModuleSequence(modules, 'nope')).toBeNull();
    });
});

describe('isSequenceSymmetric', () => {
    it('secuencia uniforme (todas iguales) es simetrica', () => {
        const m = (id: string): FixtureGridModule => ({ groupId: id, rows: 2, columns: 3, minX: 0, maxX: 1, minY: 0, maxY: 1 });
        expect(isSequenceSymmetric([m('a'), m('b'), m('c')])).toBe(true);
    });

    it('secuencia espejo (extremos iguales, centro distinto) es simetrica', () => {
        const seq: FixtureGridModule[] = [
            { groupId: 'a', rows: 2, columns: 3, minX: 0, maxX: 1, minY: 0, maxY: 1 },
            { groupId: 'b', rows: 6, columns: 2, minX: 0, maxX: 1, minY: 0, maxY: 1 },
            { groupId: 'c', rows: 2, columns: 3, minX: 0, maxX: 1, minY: 0, maxY: 1 },
        ];
        expect(isSequenceSymmetric(seq)).toBe(true);
    });

    it('secuencia asimetrica (el ejemplo del usuario: 3x2 -- 2x6 -- 4x2) NO es simetrica', () => {
        const seq: FixtureGridModule[] = [
            { groupId: 'a', rows: 2, columns: 3, minX: 0, maxX: 1, minY: 0, maxY: 1 },
            { groupId: 'b', rows: 6, columns: 2, minX: 0, maxX: 1, minY: 0, maxY: 1 },
            { groupId: 'c', rows: 2, columns: 4, minX: 0, maxX: 1, minY: 0, maxY: 1 },
        ];
        expect(isSequenceSymmetric(seq)).toBe(false);
    });

    it('secuencia de 2 modulos distintos NO es simetrica', () => {
        const seq: FixtureGridModule[] = [
            { groupId: 'a', rows: 2, columns: 3, minX: 0, maxX: 1, minY: 0, maxY: 1 },
            { groupId: 'b', rows: 2, columns: 4, minX: 0, maxX: 1, minY: 0, maxY: 1 },
        ];
        expect(isSequenceSymmetric(seq)).toBe(false);
    });
});

describe('suggestMirrorCorrection / suggestUniformCorrection', () => {
    const asymmetric: FixtureGridModule[] = [
        { groupId: 'left', rows: 2, columns: 3, minX: 0, maxX: 1, minY: 0, maxY: 1 },
        { groupId: 'mid', rows: 6, columns: 2, minX: 0, maxX: 1, minY: 0, maxY: 1 },
        { groupId: 'right', rows: 2, columns: 4, minX: 0, maxX: 1, minY: 0, maxY: 1 },
    ];

    it('espejo: impone la forma del primer extremo al ultimo, no toca el centro', () => {
        const result = suggestMirrorCorrection(asymmetric);
        expect(result.corrections).toEqual(
            expect.arrayContaining([
                { groupId: 'left', rows: 2, columns: 3 },
                { groupId: 'right', rows: 2, columns: 3 },
            ]),
        );
        expect(result.corrections.find((c) => c.groupId === 'mid')).toBeUndefined();
        expect(result.corrections).toHaveLength(2);
    });

    it('uniforme: todos los modulos que no coinciden con la forma mas frecuente reciben correccion', () => {
        const withMajority: FixtureGridModule[] = [
            { groupId: 'a', rows: 2, columns: 3, minX: 0, maxX: 1, minY: 0, maxY: 1 },
            { groupId: 'b', rows: 2, columns: 3, minX: 0, maxX: 1, minY: 0, maxY: 1 },
            { groupId: 'c', rows: 6, columns: 2, minX: 0, maxX: 1, minY: 0, maxY: 1 },
        ];
        const result = suggestUniformCorrection(withMajority);
        expect(result.corrections).toEqual([{ groupId: 'c', rows: 2, columns: 3 }]);
    });

    it('las correcciones aplicadas producen una secuencia realmente simetrica/uniforme', () => {
        const mirror = suggestMirrorCorrection(asymmetric);
        const uniform = suggestUniformCorrection(asymmetric);
        const applyOverrides = (seq: FixtureGridModule[], corrections: typeof mirror.corrections) =>
            seq.map((m) => {
                const c = corrections.find((x) => x.groupId === m.groupId);
                return c ? { ...m, rows: c.rows, columns: c.columns } : m;
            });
        expect(isSequenceSymmetric(applyOverrides(asymmetric, mirror.corrections))).toBe(true);
        expect(isSequenceSymmetric(applyOverrides(asymmetric, uniform.corrections))).toBe(true);
    });
});

describe('checkGroupSymmetry (end-to-end)', () => {
    it('detecta la asimetria 3x2 -- 2x6 -- 4x2 y ofrece ambas correcciones', () => {
        const left = makeModuleFixtures('left', 'room-a', 0, 0, 3, 1, 3, 2);
        const mid = makeModuleFixtures('mid', 'room-a', 3.2, 0, 2, 1, 2, 6);
        const right = makeModuleFixtures('right', 'room-a', 5.4, 0, 3, 1, 4, 2);
        const result = checkGroupSymmetry([...left, ...mid, ...right], 'room-a', 'right');

        expect(result).not.toBeNull();
        expect(result!.sequence.map((m) => m.groupId)).toEqual(['left', 'mid', 'right']);
        expect(result!.mirror.corrections.length).toBeGreaterThan(0);
        expect(result!.uniform.corrections.length).toBeGreaterThan(0);
        expect(result!.suggestProgression).toBe(true);
    });

    it('devuelve null si la secuencia ya es simetrica', () => {
        const left = makeModuleFixtures('left', 'room-a', 0, 0, 3, 1, 3, 2);
        const mid = makeModuleFixtures('mid', 'room-a', 3.2, 0, 2, 1, 2, 6);
        const right = makeModuleFixtures('right', 'room-a', 5.4, 0, 3, 1, 3, 2);
        const result = checkGroupSymmetry([...left, ...mid, ...right], 'room-a', 'right');
        expect(result).toBeNull();
    });

    it('devuelve null si el grupo no tiene vecinos adyacentes (modulo aislado)', () => {
        const solo = makeModuleFixtures('solo', 'room-a', 0, 0, 3, 1, 3, 2);
        const result = checkGroupSymmetry(solo, 'room-a', 'solo');
        expect(result).toBeNull();
    });

    it('devuelve null si el grupo no existe', () => {
        const solo = makeModuleFixtures('solo', 'room-a', 0, 0, 3, 1, 3, 2);
        expect(checkGroupSymmetry(solo, 'room-a', 'nope')).toBeNull();
    });
});
