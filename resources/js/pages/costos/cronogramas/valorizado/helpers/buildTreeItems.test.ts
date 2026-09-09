import { describe, it, expect } from 'vitest';
import { buildTreeItems, parentCodes } from './buildTreeItems';
import type { ItemValorizado, Periodo } from '../types';

const periodos: Periodo[] = [
    { key: '2026-01', label: 'MES 1', labelCal: 'Ene 2026' },
    { key: '2026-02', label: 'MES 2', labelCal: 'Feb 2026' },
];

const leaf = (
    item: string,
    parcial: number,
    m1: number,
    m2: number,
): ItemValorizado =>
    ({
        id: item,
        item,
        descripcion: `Hoja ${item}`,
        parent_id: '0',
        und: 'und',
        metrado: 1,
        precio: parcial,
        parcial,
        is_leaf: true,
        distribucion: {
            '2026-01': { monto: m1, porcentaje: 0 },
            '2026-02': { monto: m2, porcentaje: 0 },
        },
    }) as ItemValorizado;

describe('parentCodes', () => {
    it('lista los ancestros', () => {
        expect(parentCodes('1.2.3')).toEqual(['1', '1.2']);
        expect(parentCodes('1')).toEqual([]);
    });
});

describe('buildTreeItems', () => {
    const items = [
        leaf('1.1.1', 100, 60, 40),
        leaf('1.1.2', 50, 50, 0),
        leaf('1.2.1', 200, 0, 200),
    ];
    const jerarquia = {
        '1': 'PROYECTO X',
        '1.1': 'OBRAS PRELIMINARES',
        '1.2': 'PAVIMENTO',
        // 1.1.1 / 1.1.2 / 1.2.1 son hojas — sus nombres vienen del propio item
    };

    const tree = buildTreeItems(items, periodos, jerarquia);
    const byCode = new Map(tree.map((t) => [t.item, t]));

    it('sintetiza las filas de grupo con su nombre real', () => {
        expect(byCode.get('1')?.descripcion).toBe('PROYECTO X');
        expect(byCode.get('1.1')?.descripcion).toBe('OBRAS PRELIMINARES');
        expect(byCode.get('1.2')?.descripcion).toBe('PAVIMENTO');
    });

    it('marca los grupos como no-hoja', () => {
        expect(byCode.get('1')?.is_leaf).toBe(false);
        expect(byCode.get('1.1')?.is_leaf).toBe(false);
        expect(byCode.get('1.1.1')?.is_leaf).toBe(true);
    });

    it('rollup del parcial = suma de hojas descendientes', () => {
        expect(byCode.get('1.1')?.parcial).toBe(150);
        expect(byCode.get('1.2')?.parcial).toBe(200);
        expect(byCode.get('1')?.parcial).toBe(350);
    });

    it('rollup de la distribución mensual', () => {
        expect(byCode.get('1.1')?.distribucion['2026-01'].monto).toBe(110);
        expect(byCode.get('1.1')?.distribucion['2026-02'].monto).toBe(40);
        expect(byCode.get('1')?.distribucion['2026-01'].monto).toBe(110);
        expect(byCode.get('1')?.distribucion['2026-02'].monto).toBe(240);
    });

    it('ordena por código WBS numérico', () => {
        expect(tree.map((t) => t.item)).toEqual([
            '1',
            '1.1',
            '1.1.1',
            '1.1.2',
            '1.2',
            '1.2.1',
        ]);
    });

    it('fallback "Partida X" si no hay nombre', () => {
        const t = buildTreeItems([leaf('9.9.9', 10, 10, 0)], periodos, {});
        expect(new Map(t.map((x) => [x.item, x])).get('9')?.descripcion).toBe(
            'Partida 9',
        );
    });
});
