import { describe, expect, it } from 'vitest';
import { valorizacion02Jul2026 as fixture } from '../../data/fixtures/valorizacion02Jul2026';
import { crearInputVacio } from '../../data/schema';
import { D } from '../../lib/money';
import type { FichaTecnica } from '../../types';
import { resolverContrato } from './resolverContrato';
import { validarFicha } from './validarFicha';

const conContratista = (patch: Partial<FichaTecnica['contratista']>): FichaTecnica => ({ ...fixture.fichaTecnica, contratista: { ...fixture.fichaTecnica.contratista, ...patch } });

describe('resolverContrato — montos automáticos para cualquier proyecto', () => {
    it('sin montos escritos: referencial = principal = total del presupuesto; vigente suma adicionales y resta deductivos', () => {
        const ficha = conContratista({
            valorReferencial: null,
            montoContratoPrincipal: null,
            montoContratoVigente: null,
            plazoContractualDias: null,
            modificacionesContrato: [
                { id: 'a', documento: 'Adicional N°01', tipo: 'adicional', monto: '25000' },
                { id: 'd', documento: 'Deductivo N°01', tipo: 'deductivo', monto: '5000.50' },
            ],
        });
        const contrato = resolverContrato(ficha, '638827.47');
        expect([contrato.referencial, contrato.principal, contrato.vigente].map((v) => v.toFixed(2))).toEqual(['638827.47', '638827.47', '658826.97']);
        expect(contrato.plazoContractualDias).toBe(60);
        expect(contrato.auto).toEqual({ referencial: true, principal: true, vigente: true, plazoContractual: true });
    });

    it('un valor escrito manda sobre el cálculo', () => {
        const contrato = resolverContrato(conContratista({ montoContratoPrincipal: '600000', plazoContractualDias: 75 }), '638827.47');
        expect(contrato.principal.toFixed(2)).toBe('600000.00');
        expect(contrato.plazoContractualDias).toBe(75);
        expect(contrato.auto.principal).toBe(false);
    });
});

describe('validarFicha', () => {
    it('la Ficha del ejemplo está completa y sin alertas', () => {
        const contrato = resolverContrato(fixture.fichaTecnica, '638827.47');
        const v = validarFicha(fixture.fichaTecnica, contrato, { totalPresupuesto: D('638827.47'), partidas: 144, mesValorizacion: '2026-07', terminoVigente: '2026-08-18' });
        expect(v.faltantes).toEqual([]);
        expect(v.alertas).toEqual([]);
        expect(v.completos).toBe(v.total);
    });

    it('una obra nueva lista lo que falta y avisa el presupuesto vacío', () => {
        const input = crearInputVacio({ nombre: 'Obra nueva', fecha_inicio: '2026-03-02', fecha_fin: '2026-05-30' });
        const contrato = resolverContrato(input.fichaTecnica, 0);
        const v = validarFicha(input.fichaTecnica, contrato, { totalPresupuesto: D(0), partidas: 0, mesValorizacion: '2026-03', terminoVigente: '2026-05-30' });
        expect(v.faltantes.map((f) => f.campo)).toContain('Ejecutor');
        expect(v.faltantes.map((f) => f.campo)).not.toContain('Obra');
        expect(v.alertas[0]).toContain('presupuesto está vacío');
    });

    it('detecta fechas fuera de orden y contrato distinto al presupuesto', () => {
        const ficha = conContratista({ fechaFirmaContrato: '2026-05-01', montoContratoPrincipal: '600000' });
        const v = validarFicha(ficha, resolverContrato(ficha, '638827.47'), { totalPresupuesto: D('638827.47'), partidas: 144, mesValorizacion: '2026-07', terminoVigente: '2026-08-18' });
        expect(v.alertas.some((a) => a.includes('firma del contrato') && a.includes('buena pro'))).toBe(true);
        expect(v.alertas.some((a) => a.includes('no coincide con el total del presupuesto'))).toBe(true);
    });
});
