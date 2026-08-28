import { describe, expect, it } from 'vitest';
import {
    buildInitialMonomios,
    canMoveNode,
    flattenMonomiosForExport,
    flattenNodes,
    moveNode,
    moveNodeWithinSiblings,
    reorderNodeAmongSiblings,
    reconcileMonomiosWithCatalog,
} from './formulaPolinomicaTree';

const build = () => buildInitialMonomios(
    new Map([['10', 40], ['20', 30], ['30', 20], ['39', 10]]),
    ['10', '20', '30', '39'],
    new Map([
        ['10', 'Artefacto de alumbrado exterior'],
        ['20', 'Cemento'],
        ['30', 'Equipo'],
        ['39', 'Índice de Precios al Consumidor (INEI)'],
    ]),
);

describe('árbol de fórmula polinómica', () => {
    it('inicia cada índice como monomio independiente sin duplicarlo', () => {
        const monomios = build();
        expect(monomios).toHaveLength(4);
        expect(monomios.map((monomio) => monomio.nomenclatura)).toEqual(['AZ', 'CE', 'EQ', 'IP']);
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
        expect(rows[0].incidencia).toBe(100);
        expect(rows[1].incidencia).toBeCloseTo(44.44444, 5);
        expect(rows[2].incidencia).toBeCloseTo(55.55556, 5);
        expect(rows[3].incidencia).toBeCloseTo(33.33333, 5);
        expect(rows[4].incidencia).toBeCloseTo(22.22222, 5);
        expect(rows[5].incidencia).toBeCloseTo(22.22222, 5);
        expect(rows.filter((row) => !row.esMonomio && row.nro === null).slice(0, 3).reduce((sum, row) => sum + row.incidencia, 0)).toBeCloseTo(100, 5);
    });

    it('reconcilia un árbol guardado con el catálogo vigente sin perder su estructura', () => {
        let monomios = build();
        monomios = moveNode(monomios, 'i-20', 'i-10');
        monomios[1].root.code = '32';
        monomios[1].root.descripcion = 'Dinamita';
        monomios[1].nomenclatura = 'DI';

        const reconciled = reconcileMonomiosWithCatalog(monomios, new Map([
            ['10', 'Aparato sanitario con grifería'],
            ['20', 'Cemento asfáltico'],
            ['32', 'Flete terrestre'],
            ['39', 'Índice de Precios al Consumidor (INEI)'],
        ]));

        expect(reconciled[0].root.children[0].descripcion).toBe('Cemento asfáltico');
        expect(reconciled[1].root.descripcion).toBe('Flete terrestre');
        expect(reconciled[1].nomenclatura).toBe('FT');
        expect(reconciled[0].root.children[0].coefDefinido).toBe(monomios[0].root.children[0].coefDefinido);
    });

    it('permite ordenar manualmente monomios y filas sin cambiar su jerarquía', () => {
        let monomios = build();
        monomios = moveNode(monomios, 'i-30', 'i-10');
        monomios = moveNode(monomios, 'i-20', 'i-10');
        monomios = moveNodeWithinSiblings(monomios, 'i-39', -1);
        monomios = moveNodeWithinSiblings(monomios, 'i-20', -1);

        expect(monomios.map((monomio) => monomio.root.code)).toEqual(['39', '10']);
        expect(monomios[1].root.children.map((node) => node.code)).toEqual(['20', '30']);
        expect(monomios[1].root.children.every((node) => node.children.length === 0)).toBe(true);
    });

    it('reordena por arrastre solo entre hermanos y no agrupa elementos', () => {
        let monomios = build();
        monomios = moveNode(monomios, 'i-20', 'i-10');
        monomios = moveNode(monomios, 'i-30', 'i-10');

        const reorderedRoots = reorderNodeAmongSiblings(monomios, 'i-39', 'i-10', 'before');
        const reorderedChildren = reorderNodeAmongSiblings(reorderedRoots, 'i-30', 'i-20', 'before');
        const invalidCrossLevel = reorderNodeAmongSiblings(reorderedChildren, 'i-20', 'i-39', 'before');

        expect(reorderedChildren.map((monomio) => monomio.root.code)).toEqual(['39', '10']);
        expect(reorderedChildren[1].root.children.map((node) => node.code)).toEqual(['30', '20']);
        expect(invalidCrossLevel).toBe(reorderedChildren);
        expect(flattenNodes(reorderedChildren[1].root)).toHaveLength(3);
    });
});
