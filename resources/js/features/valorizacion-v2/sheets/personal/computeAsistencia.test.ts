import { describe, expect, it } from 'vitest';
import { valorizacion02Jul2026 as fixture } from '../../data/fixtures/valorizacion02Jul2026';
import { computeAsistencia } from './computeAsistencia';

const nombresFT = { residente: fixture.fichaTecnica.contratista.residente };

describe('RH-EM — asistencia de personal clave', () => {
    it('julio 2026: 31 días de obra, domingos 5/12/19/26 y 31 días por persona (como el Excel)', () => {
        const asistencia = computeAsistencia(fixture.personal, '2026-07', '2026-06-20', '2026-08-18', nombresFT);
        expect(asistencia.dias).toHaveLength(31);
        expect(asistencia.dias[0].letra).toBe('X');
        expect(asistencia.dias.filter((d) => d.domingo).map((d) => d.dia)).toEqual([5, 12, 19, 26]);
        expect(asistencia.diasDeObra).toBe(31);
        expect(asistencia.filas.map((f) => f.diasAsistidos)).toEqual([31, 31]);
        expect(asistencia.filas[0].nombre).toBe('ING. RAMIREZ BLANCO GABRIEL AUGUSTO HERMOGENES');
    });

    it('faltas restan y los días fuera del plazo no cuentan', () => {
        const conFaltas = { ...fixture.personal, faltas: { 'rh-sst': ['2026-08-03', '2026-08-04'] } };
        const agosto = computeAsistencia(conFaltas, '2026-08', '2026-06-20', '2026-08-18', nombresFT);
        expect(agosto.diasDeObra).toBe(18);
        expect(agosto.filas.map((f) => f.diasAsistidos)).toEqual([18, 16]);
        expect(agosto.filas[1].dias['2026-08-25']).toBe('fuera');
        expect(agosto.filas[1].dias['2026-08-03']).toBe('falta');
    });
});
