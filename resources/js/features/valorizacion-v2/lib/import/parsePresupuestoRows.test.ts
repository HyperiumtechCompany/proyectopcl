import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { presupuesto02Jul2026 } from '../../data/fixtures/presupuesto02Jul2026';
import { readPresupuestoExcel } from '../../data/importers/readPresupuestoExcel';
import { computePresupuesto } from '../../sheets/presupuesto/computePresupuesto';
import { parsePresupuestoRows } from './parsePresupuestoRows';

const EXCEL = resolve(process.cwd(), 'planes/costos/campo/valorizaciones/VALORIZACIÓN N°02 - JUL 2026 (1).xlsx');

describe('importar presupuesto desde el Excel real', () => {
    it('lee la hoja PRESUPUESTO completa y cuadra con el Excel', async () => {
        const buffer = readFileSync(EXCEL);
        const result = await readPresupuestoExcel(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

        expect(result.sheetName).toBe('PRESUPUESTO');
        expect(result.partidas).toHaveLength(144);
        expect(result.partidas).toEqual(presupuesto02Jul2026.partidas);
        expect(result.parametros).toEqual({ gastosGenerales: '0.1', utilidad: '0.07', igv: '0.18' });
        expect(result.excel).toEqual({ costoDirecto: '462717.27', total: '638827.47' });
        // Única observación real del expediente: 01.03.02.04 no tiene unidad.
        expect(result.warnings).toEqual(['01.03.02.04: partida sin unidad de medida.']);

        const calculado = computePresupuesto({ fuente: 'excel', partidas: result.partidas }, {
            gastosGenerales: result.parametros.gastosGenerales!,
            utilidad: result.parametros.utilidad!,
            igv: result.parametros.igv!,
        });
        expect(calculado.totales.costoDirecto.toFixed(2)).toBe('462717.27');
        expect(calculado.totales.total.toFixed(2)).toBe('638827.47');
        expect(calculado.porCodigo.get('01.06.04.01.01')?.node.nivel).toBe(5);
    });
});

describe('parsePresupuestoRows con matrices sueltas', () => {
    it('detecta cabecera en otra posición y avisa diferencias de total', () => {
        const result = parsePresupuestoRows([
            [],
            [null, 'Item', 'Descripción', 'Und.', 'Metrado', 'P.U.', 'Parcial'],
            [null, '01', 'OBRA', null, null, null, null],
            [null, '01.01', 'PARTIDA A', 'm2', '1,000.50', 2, 2000],
            [null, '01.01', 'REPETIDA', 'm2', 1, 1, 1],
            [null, 'Costo directo', null, null, null, null, 2001],
        ]);
        expect(result.partidas.map((p) => p.codigo)).toEqual(['01', '01.01']);
        expect(result.partidas[1].metrado).toBe('1000.5');
        expect(result.warnings.some((w) => w.includes('2000') && w.includes('2001.00'))).toBe(true);
        expect(result.warnings.some((w) => w.includes('repetido'))).toBe(true);
    });

    it('sin cabecera reconocible no inventa nada', () => {
        const result = parsePresupuestoRows([['a', 'b'], [1, 2]]);
        expect(result.partidas).toEqual([]);
        expect(result.warnings[0]).toContain('No se encontró la cabecera');
    });
});
