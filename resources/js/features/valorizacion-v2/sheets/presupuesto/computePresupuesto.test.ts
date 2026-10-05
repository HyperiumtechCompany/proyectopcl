import { describe, expect, it } from 'vitest';
import { valorizacion02Jul2026 } from '../../data/fixtures/valorizacion02Jul2026';
import { buildPartidaTree, visibleIds } from '../../lib/partidaTree';
import type { PartidaTree } from '../../lib/partidaTree';
import { fromCodigos } from '../../lib/presupuestoOps';
import { computePresupuesto } from './computePresupuesto';

const { presupuesto, parametros } = valorizacion02Jul2026;

const byCodigo = (tree: PartidaTree, codigo: string) => tree.ordered.find((node) => node.codigo === codigo);
const codigos = (tree: PartidaTree, ids: Set<string>) => tree.ordered.filter((node) => ids.has(node.id)).map((node) => node.codigo);

describe('buildPartidaTree', () => {
    it('deriva jerarquía y niveles desde el código', () => {
        const tree = buildPartidaTree(presupuesto.partidas);
        expect(tree.roots.map((node) => node.codigo)).toEqual(['01']);
        expect(byCodigo(tree, '01.02.04.02')?.parentId).toBe(byCodigo(tree, '01.02.04')?.id);
        expect(byCodigo(tree, '01.02.04.02')?.nivel).toBe(4);
        // 01.08 tiene partidas directas en nivel 3 (sin subtítulo): profundidad variable.
        expect(byCodigo(tree, '01.08.01')?.esHoja).toBe(true);
        expect(tree.ordered[0].codigo).toBe('01');
    });

    it('toda partida sin hijos exige unidad, metrado y P.U.', () => {
        const { partidas } = fromCodigos([
            { codigo: '01', descripcion: 'OBRA', unidad: null, metrado: null, precioUnitario: null },
            { codigo: '01.01', descripcion: 'NUEVA', unidad: null, metrado: null, precioUnitario: null },
        ]);
        const tree = buildPartidaTree(partidas);
        expect(byCodigo(tree, '01.01')?.esHoja).toBe(true);
        expect(tree.issues).toEqual(['01.01 NUEVA: falta unidad, metrado, precio unitario.']);
    });
});

describe('visibleIds', () => {
    const tree = buildPartidaTree(presupuesto.partidas);

    it('oculta el contenido de títulos colapsados', () => {
        const visible = codigos(tree, visibleIds(tree, new Set([byCodigo(tree, '01.02')!.id]), ''));
        expect(visible).toContain('01.02');
        expect(visible).not.toContain('01.02.04.02');
        expect(visible).toContain('01.01.01.01');
    });

    it('la búsqueda ignora el colapso, conserva ancestros y no distingue tildes', () => {
        const visible = visibleIds(tree, new Set([byCodigo(tree, '01')!.id]), 'riego y compactacion de subrasante');
        expect(codigos(tree, visible)).toEqual(['01', '01.02', '01.02.03', '01.02.03.01']);
    });

    it('si coincide un título muestra todo su contenido', () => {
        const visible = visibleIds(tree, new Set(), 'seguridad y salud');
        expect(codigos(tree, visible)).toContain('01.11.05');
    });
});

describe('computePresupuesto — Val. N°02 (presupuesto completo del Excel)', () => {
    const result = computePresupuesto(presupuesto, parametros, valorizacion02Jul2026.fichaTecnica.contratista.montoContratoVigente);
    const total = (codigo: string) => result.porCodigo.get(codigo)?.total.toFixed(2);

    it('ROUND(metrado × P.U., 2) por partida, con empates hacia arriba', () => {
        expect(total('01.01.03.01')).toBe('2890.22'); // 135.50 × 21.33 = 2890.215
        expect(total('01.03.01.04')).toBe('2326.37'); // 547.38 × 4.25 = 2326.365
        expect(total('01.02.04.02')).toBe('109207.70');
        expect(total('01.12.01')).toBe('6023.00');
    });

    it('los 13 componentes cuadran con RESUMEN VAL.', () => {
        expect(total('01.01')).toBe('24540.72');
        expect(total('01.02')).toBe('195936.33');
        expect(total('01.03')).toBe('81286.85');
        expect(total('01.04')).toBe('22284.83');
        expect(total('01.05')).toBe('41213.67');
        expect(total('01.06')).toBe('18738.92');
        expect(total('01.07')).toBe('6001.05');
        expect(total('01.08')).toBe('18254.61');
        expect(total('01.09')).toBe('1224.00');
        expect(total('01.10')).toBe('10200.00');
        expect(total('01.11')).toBe('18340.56');
        expect(total('01.12')).toBe('6023.00');
        expect(total('01.13')).toBe('18672.73');
    });

    it('CD = suma de partidas y pie presupuestal coherente', () => {
        const hojas = result.filas.filter((fila) => fila.node.esHoja);
        const suma = hojas.reduce((acc, fila) => acc + Math.round(fila.total.toNumber() * 100), 0) / 100;
        expect(result.totales.costoDirecto.toNumber()).toBeCloseTo(suma, 2);
        expect(total('01')).toBe(result.totales.costoDirecto.toFixed(2));
        expect(result.componentes).toHaveLength(13);
    });

    it('CD y total cuadran con PRESUPUESTO y con el contrato vigente', () => {
        expect(result.totales.costoDirecto.toFixed(2)).toBe('462717.27');
        expect(result.totales.total.toFixed(2)).toBe('638827.47');
        expect(result.diferenciaContrato?.isZero()).toBe(true);
        expect(result.partidasCount).toBe(103);
        // Única observación real del expediente.
        expect(result.tree.issues).toEqual(['01.03.02.04 CURADO DE CONCRETO: falta unidad.']);
    });
});
