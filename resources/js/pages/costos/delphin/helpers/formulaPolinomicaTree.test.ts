import { describe, expect, it } from 'vitest';
import {
    buildInitialMonomios,
    canMoveNode,
    flattenMonomiosForExport,
    flattenNodes,
    moveNode,
} from './formulaPolinomicaTree';

const build = () => buildInitialMonomios(
    new Map([['10', 40], ['20', 30], ['30', 20], ['39', 10]]),
    ['10', '20', '30', '39'],
    new Map([
        ['10', 'Artefacto de alumbrado exterior'],
        ['20', 'Cemento'],
        ['30', 'Equipo'],
        ['39', 'Gasto General y Utilidad'],
    ]),
);

describe('árbol de fórmula polinómica', () => {
    it('inicia cada índice como monomio independiente sin duplicarlo', () => {
        const monomios = build();
        expect(monomios).toHaveLength(4);
        expect(monomios.map((monomio) => monomio.nomenclatura)).toEqual(['AZ', 'CE', 'EQ', 'GU']);
        expect(monomios.reduce((sum, monomio) => sum + monomio.root.coefDefinido, 0)).toBeCloseTo(1, 3);
        expect(monomios.every((monomio) => monomio.root.children.length === 0)).toBe(true);
        expect(monomios.flatMap((monomio) => flattenNodes(monomio.root)).map((node) => node.code))
            .toEqual(['10', '20', '30', '39']);
    });

    it('limita cada nodo a dos hijos pero permite profundidad arbitraria', () => {
        let monomios = build();
        monomios = moveNode(monomios, 'i-20', 'i-10');
        monomios = moveNode(monomios, 'i-30', 'i-10');

        expect(canMoveNode(monomios, 'i-39', 'i-10')).toBe(false);
        expect(canMoveNode(monomios, 'i-39', 'i-20')).toBe(true);

        monomios = moveNode(monomios, 'i-39', 'i-20');
        expect(monomios[0].root.children[0].children[0].code).toBe('39');
    });

    it('exporta todo el árbol expandido una sola vez y conserva los niveles', () => {
        let monomios = build();
        monomios = moveNode(monomios, 'i-20', 'i-10');
        monomios = moveNode(monomios, 'i-30', 'i-20');

        const rows = flattenMonomiosForExport(monomios);
        expect(rows.map((row) => row.codigo)).toEqual(['10', '10', '20', '20', '30', '30', '39', '39']);
        expect(rows.map((row) => row.nivel)).toEqual([0, 1, 1, 2, 2, 3, 0, 1]);
        expect(rows.map((row) => row.esMonomio)).toEqual([true, false, true, false, true, false, true, false]);
    });
});
