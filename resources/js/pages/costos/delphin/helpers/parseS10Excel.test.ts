import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseS10AcuWorkbook, parseS10PresupuestoWorkbook } from './parseS10Excel';

// Libros sintéticos con la MISMA disposición de columnas que las exportaciones reales de S10
// (presupuestocliente_*.xls / acu_*.xls verificados el 2026-10-20).
function book(rows: Array<Record<string, string | number>>): XLSX.WorkBook {
    const ws: XLSX.WorkSheet = {};
    let maxR = 0;
    let maxC = 0;
    rows.forEach((row, r) => {
        for (const [col, v] of Object.entries(row)) {
            const c = XLSX.utils.decode_col(col);
            ws[XLSX.utils.encode_cell({ r, c })] = typeof v === 'number' ? { t: 'n', v } : { t: 's', v };
            maxR = Math.max(maxR, r);
            maxC = Math.max(maxC, c);
        }
    });
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return wb;
}

describe('parseS10PresupuestoWorkbook', () => {
    const wb = book([
        { B: 'S10', M: 'Página', P: 1 },
        { B: 'Presupuesto', D: '3302030', E: 'CREACIÓN DE LOS SERVICIOS…' },
        { B: 'Subpresupuesto', D: '001', E: 'ESTRUCTURAS' },
        { B: 'Cliente', D: 'GOBIERNO REGIONAL DE UCAYALI', K: 'Costo al', O: '02/06/2025' },
        { B: 'Item', D: 'Descripción', H: 'Und.', I: 'Metrado', K: 'Precio S/.', O: 'Parcial S/.' },
        { B: '01', D: 'ESTRUCTURAS', O: 2352.76 },
        { B: '01.01', D: '   OBRAS PROVISIONALES', O: 2352.76 },
        { B: '01.01.01', D: '      CONSTRUCCIÓN OFICINA TÉCNICA', H: 'm2', I: 12, K: 137.55, O: 1650.6 },
        { B: '01.01.02', D: '      LIMPIEZA DE TERRENO', H: 'm2', I: '1,250.00', K: 0.7, O: '875.00' },
        { D: 'COSTO DIRECTO', K: 2525.6 },
        { D: 'IGV', K: 454.61 },
        { D: 'SON :     DOS MIL…' },
    ]);

    it('reads the item tree, ignores the page header and the final totals', () => {
        const result = parseS10PresupuestoWorkbook(wb);
        expect(result.rows.map((r) => r.partida)).toEqual(['01', '01.01', '01.01.01', '01.01.02']);
        expect(result.totalPartidas).toBe(2);
        expect(result.warnings).toEqual([]);

        const [root, group, leaf, textNumbers] = result.rows;
        expect(root.parent_id).toBeNull();
        expect(leaf.parent_id).toBe(group.id);
        expect(leaf).toMatchObject({ descripcion: 'CONSTRUCCIÓN OFICINA TÉCNICA', unidad: 'm2', metrado: 12, precio_unitario: 137.55, parcial: 1650.6 });
        // Números exportados como texto con separador de miles.
        expect(textNumbers).toMatchObject({ metrado: 1250, precio_unitario: 0.7, parcial: 875 });
    });
});

describe('parseS10AcuWorkbook', () => {
    const header = { A: 'Código', C: 'Descripción Recurso', F: 'Unidad', H: 'Cuadrilla', I: 'Cantidad', J: 'Precio S/.', K: 'Parcial S/.' };
    const wb = book([
        { A: 'S10', J: 'Página :', K: 1 },
        { A: 'Subpresupuesto', C: '001', D: 'ESTRUCTURAS', J: 'Fecha presupuesto', K: '02/06/2025' },
        { A: 'Partida', C: '01.01.01', E: 'CONSTRUCCIÓN OFICINA TÉCNICA' },
        { A: 'Rendimiento', C: 'MO.', D: 7, E: 'EQ.', F: 7, I: 'Costo unitario directo por : m2', J: 137.55 },
        header,
        { D: 'Mano de Obra' },
        { A: '0147010002', C: 'OPERARIO', F: 'hh', H: 1, I: 1.1429, J: 29.9, K: 34.17 },
        { K: 34.17 },
        { D: 'Materiales' },
        { A: '0202010072', C: 'CLAVOS PARA MADERA', F: 'kg', I: 0.2315, J: 5.93, K: 1.37 },
        { K: 1.37 },
        { D: 'Equipos' },
        { A: '0337010001', C: 'HERRAMIENTAS MANUALES', F: '%MO', I: 3, J: 34.17, K: 1.03 },
        { K: 1.03 },
        { A: 'Partida', C: '01.01.02', E: 'RECOLECCIÓN DE RESIDUOS' },
        { A: 'Rendimiento', C: 'MO.', D: 20, E: 'EQ.', F: 20, I: 'Costo unitario directo por : und', J: 700 },
        header,
        { D: 'Subcontratos' },
        { A: '0402010003', C: 'SERVICIO DE RECOLECCIÓN', F: 'glb', I: 1, J: 700, K: 700 },
        { K: 700 },
    ]);

    it('reads each Partida block with rendimiento, unit and its sections (subtotal rows skipped)', () => {
        const { acus, warnings } = parseS10AcuWorkbook(wb);
        expect(warnings).toEqual([]);
        expect(acus.map((a) => a.partida_code)).toEqual(['01.01.01', '01.01.02']);

        const [oficina, residuos] = acus;
        expect(oficina).toMatchObject({ partida_desc: 'CONSTRUCCIÓN OFICINA TÉCNICA', unidad: 'm2', rendimiento: 7 });
        expect(oficina.mano_de_obra).toEqual([
            { codigo: '0147010002', proveedor: null, descripcion: 'OPERARIO', unidad: 'hh', recursos: 1, cantidad: 1.1429, precio_unitario: 29.9, precio_hora: 0, factor_desperdicio: 1 },
        ]);
        expect(oficina.materiales).toHaveLength(1);
        expect(oficina.equipos[0]).toMatchObject({ unidad: '%MO', cantidad: 3, precio_hora: 34.17, precio_unitario: 0 });

        expect(residuos).toMatchObject({ unidad: 'und', rendimiento: 20 });
        expect(residuos.subcontratos[0]).toMatchObject({ descripcion: 'SERVICIO DE RECOLECCIÓN', cantidad: 1, precio_unitario: 700 });
    });
});
