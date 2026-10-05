import { describe, expect, it } from 'vitest';
import type { PartidaInput } from '../types/partida';
import { buildPartidaTree } from './partidaTree';
import { addChild, addSibling, fromCodigos, indent, moveSibling, nodeContext, outdent, removeNode, updatePartida, wouldLoseData } from './presupuestoOps';

const base: PartidaInput[] = fromCodigos([
    { codigo: '01', descripcion: 'OBRA', unidad: null, metrado: null, precioUnitario: null },
    { codigo: '01.01', descripcion: 'A', unidad: null, metrado: null, precioUnitario: null },
    { codigo: '01.01.01', descripcion: 'A1', unidad: 'm2', metrado: '2', precioUnitario: '10' },
    { codigo: '01.01.02', descripcion: 'A2', unidad: 'm3', metrado: '1', precioUnitario: '5' },
    { codigo: '01.02', descripcion: 'B', unidad: 'und', metrado: '3', precioUnitario: '7' },
]).partidas;

const id = (partidas: PartidaInput[], descripcion: string): string => partidas.find((p) => p.descripcion === descripcion)!.id;
const outline = (partidas: PartidaInput[]): string[] => partidas.map((p) => `${p.codigo} ${p.descripcion}`);

describe('fromCodigos', () => {
    it('asigna id estable y padre por prefijo; renumera huecos y lo reporta', () => {
        const { partidas, renumerados } = fromCodigos([
            { codigo: '01', descripcion: 'OBRA', unidad: null, metrado: null, precioUnitario: null },
            { codigo: '01.01', descripcion: 'A', unidad: 'und', metrado: '1', precioUnitario: '1' },
            { codigo: '01.03', descripcion: 'C', unidad: 'und', metrado: '1', precioUnitario: '1' },
        ]);
        expect(partidas[2]).toMatchObject({ id: 'p-01.03', parentId: 'p-01', codigo: '01.02' });
        expect(renumerados).toEqual([{ antes: '01.03', despues: '01.02' }]);
    });
});

describe('operaciones de rama', () => {
    it('agregar hijo a un título lo pone al final y renumera', () => {
        const { partidas, id: nuevo } = addChild(base, id(base, 'A'));
        expect(outline(partidas)).toEqual(['01 OBRA', '01.01 A', '01.01.01 A1', '01.01.02 A2', '01.01.03 NUEVA PARTIDA', '01.02 B']);
        expect(partidas.find((p) => p.id === nuevo)?.parentId).toBe(id(base, 'A'));
    });

    it('agregar hijo a una partida la convierte en título y borra sus datos', () => {
        expect(wouldLoseData(base, id(base, 'B'))).toBe(true);
        expect(wouldLoseData(base, id(base, 'A'))).toBe(false);
        const { partidas } = addChild(base, id(base, 'B'));
        const b = partidas.find((p) => p.descripcion === 'B')!;
        expect(b).toMatchObject({ unidad: null, metrado: null, precioUnitario: null });
        expect(buildPartidaTree(partidas).byId.get(b.id)?.esHoja).toBe(false);
    });

    it('agregar hermano arriba/abajo', () => {
        const arriba = addSibling(base, id(base, 'A2'), 'before').partidas;
        expect(outline(arriba).slice(2, 5)).toEqual(['01.01.01 A1', '01.01.02 NUEVA PARTIDA', '01.01.03 A2']);
        const abajo = addSibling(base, id(base, 'A'), 'after').partidas;
        expect(outline(abajo)).toContain('01.02 NUEVA PARTIDA');
        expect(outline(abajo)).toContain('01.03 B');
    });

    it('bajar nivel: entra como último hijo del hermano anterior', () => {
        const partidas = indent(base, id(base, 'B'));
        expect(outline(partidas)).toEqual(['01 OBRA', '01.01 A', '01.01.01 A1', '01.01.02 A2', '01.01.03 B']);
        // B conserva sus datos (sigue siendo hoja) y su id.
        expect(partidas.at(-1)).toMatchObject({ id: id(base, 'B'), metrado: '3' });
    });

    it('subir nivel: nieto → hijo → raíz, conservando su contenido', () => {
        const una = outdent(base, id(base, 'A1'));
        expect(outline(una)).toEqual(['01 OBRA', '01.01 A', '01.01.01 A2', '01.02 A1', '01.03 B']);
        const dos = outdent(una, id(base, 'A'));
        expect(outline(dos)).toEqual(['01 OBRA', '01.01 A1', '01.02 B', '02 A', '02.01 A2']);
    });

    it('mover entre hermanos y contexto del menú', () => {
        expect(outline(moveSibling(base, id(base, 'B'), -1)).slice(1, 3)).toEqual(['01.01 B', '01.02 A']);
        expect(nodeContext(base, id(base, 'A'))).toMatchObject({ hasParent: true, hasPrev: false, hasNext: true, subtreeSize: 3 });
        expect(nodeContext(base, id(base, 'OBRA'))).toMatchObject({ hasParent: false, subtreeSize: 5 });
    });

    it('editar y eliminar subárboles; los demás conservan su id', () => {
        expect(updatePartida(base, id(base, 'A1'), { metrado: '5' }).find((p) => p.descripcion === 'A1')?.metrado).toBe('5');
        const sinA = removeNode(base, id(base, 'A'));
        expect(outline(sinA)).toEqual(['01 OBRA', '01.01 B']);
        expect(sinA[1].id).toBe(id(base, 'B'));
    });
});
