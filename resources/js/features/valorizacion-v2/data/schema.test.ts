import { describe, expect, it } from 'vitest';
import { valorizacion02Jul2026 } from './fixtures/valorizacion02Jul2026';
import { crearInputVacio, normalizarInput } from './schema';

const proyecto = { nombre: 'I.E. Nº 32004 "San Pedro"', fecha_inicio: '2026-03-02', fecha_fin: '2026-05-30' };

describe('crearInputVacio', () => {
    it('usa nombre y fechas del proyecto; todo lo demás vacío', () => {
        const input = crearInputVacio(proyecto);
        expect(input.fichaTecnica.datosGenerales.obra).toBe(proyecto.nombre);
        expect(input.fichaTecnica.plazos.fechaInicioObra).toBe('2026-03-02');
        expect(input.fichaTecnica.plazos.plazoEjecucionDias).toBe(90);
        expect(input.periodo).toEqual({ numero: 1, mes: '2026-03-01' });
        expect(input.presupuesto.partidas).toEqual([]);
        expect(input.pagos.adicionales).toEqual([]);
    });

    it('sin fechas del proyecto usa hoy y 30 días', () => {
        const input = crearInputVacio({ nombre: 'Obra', fecha_inicio: null, fecha_fin: null });
        expect(input.fichaTecnica.plazos.plazoEjecucionDias).toBe(30);
    });
});

describe('normalizarInput', () => {
    it('el ejemplo guardado vuelve idéntico', () => {
        expect(normalizarInput(JSON.parse(JSON.stringify(valorizacion02Jul2026)), proyecto)).toEqual(valorizacion02Jul2026);
    });

    it('un documento de una versión anterior (sin pagos ni personal) se completa sin perder datos', () => {
        const viejo = JSON.parse(JSON.stringify(valorizacion02Jul2026));
        delete viejo.pagos;
        delete viejo.personal;
        delete viejo.control;
        viejo.fichaTecnica.contratista = { ejecutor: 'CONSORCIO X' };

        const normalizado = normalizarInput(viejo, proyecto);
        expect(normalizado.pagos.porcentajeDetraccion).toBe('0.04');
        expect(normalizado.personal.personas[0].vinculoFT).toBe('residente');
        expect(normalizado.control.devengados).toEqual({});
        expect(normalizado.fichaTecnica.contratista.ejecutor).toBe('CONSORCIO X');
        // Montos faltantes quedan en automático (se derivan del presupuesto).
        expect(normalizado.fichaTecnica.contratista.montoContratoVigente).toBeNull();
        expect(normalizado.fichaTecnica.contratista.modificacionesContrato).toEqual([]);
        expect(normalizado.presupuesto.partidas).toHaveLength(144);
    });

    it('basura o fechas inválidas no rompen la carga', () => {
        const normalizado = normalizarInput({ periodo: { numero: 3, mes: 'no-es-fecha' }, fichaTecnica: { plazos: { fechaInicioObra: '' } } }, proyecto);
        expect(normalizado.periodo.mes).toBe('2026-03-01');
        expect(normalizado.fichaTecnica.plazos.fechaInicioObra).toBe('2026-03-02');
        expect(normalizarInput(null, proyecto).presupuesto.partidas).toEqual([]);
    });
});
