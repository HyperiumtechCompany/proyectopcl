import type Decimal from 'decimal.js';
import { formatDate } from '../../lib/dates';
import type { IsoDate } from '../../lib/dates';
import type { FichaTecnica } from '../../types';
import { fmtMoney } from '../../utils/format';
import type { ContratoResuelto } from './resolverContrato';

export interface ValidacionFicha {
    /** Campos obligatorios llenos / total. */
    completos: number;
    total: number;
    faltantes: Array<{ seccion: string; campo: string }>;
    /** Incoherencias entre datos (fechas fuera de orden, montos que no cuadran…). */
    alertas: string[];
}

const lleno = (valor: string | null | undefined) => typeof valor === 'string' && valor.trim() !== '';

/**
 * Completitud y coherencia de la Ficha Técnica para cualquier proyecto. Los
 * obligatorios son los datos que las demás hojas imprimen en sus cabeceras o
 * necesitan para calcular; las alertas avisan pero no bloquean.
 */
export function validarFicha(ficha: FichaTecnica, contrato: ContratoResuelto, contexto: { totalPresupuesto: Decimal; partidas: number; mesValorizacion: string; terminoVigente: IsoDate }): ValidacionFicha {
    const { datosGenerales: g, contratista: c, supervision: s, plazos: p } = ficha;
    const obligatorios: Array<[string, string, boolean]> = [
        ['A. Datos generales', 'Entidad', lleno(g.entidad)],
        ['A. Datos generales', 'Obra', lleno(g.obra)],
        ['A. Datos generales', 'Código único de inversión', lleno(g.cui)],
        ['A. Datos generales', 'Departamento', lleno(g.ubicacion.departamento)],
        ['A. Datos generales', 'Provincia', lleno(g.ubicacion.provincia)],
        ['A. Datos generales', 'Distrito', lleno(g.ubicacion.distrito)],
        ['B. Contratista ejecutor', 'Ejecutor', lleno(c.ejecutor)],
        ['B. Contratista ejecutor', 'Contrato', lleno(c.contrato)],
        ['B. Contratista ejecutor', 'Fecha de firma del contrato', c.fechaFirmaContrato !== null],
        ['B. Contratista ejecutor', 'Residente de obra', lleno(c.residente)],
        ['C. Supervisión', 'Contratista supervisor', lleno(s.contratista)],
        ['C. Supervisión', 'Supervisor de obra', lleno(s.supervisor)],
        ['D. Plazos', 'Fecha de inicio de ejecución', lleno(p.fechaInicioObra)],
        ['D. Plazos', 'Plazo de ejecución', p.plazoEjecucionDias > 0],
    ];
    const faltantes = obligatorios.filter(([, , ok]) => !ok).map(([seccion, campo]) => ({ seccion, campo }));

    const alertas: string[] = [];
    if (contexto.partidas === 0) {
        alertas.push('El presupuesto está vacío: los montos automáticos del contrato quedan en S/ 0.00. Importa o crea el presupuesto.');
    }
    if (!contrato.auto.principal && !contrato.principal.eq(contexto.totalPresupuesto) && contexto.partidas > 0) {
        alertas.push(`El contrato principal (${fmtMoney(contrato.principal)}) no coincide con el total del presupuesto (${fmtMoney(contexto.totalPresupuesto)}).`);
    }
    if (!contrato.auto.vigente && !contrato.vigente.eq(contrato.principal.add(contrato.adicionales).sub(contrato.deductivos))) {
        alertas.push('El contrato vigente escrito no es igual a principal + adicionales − deductivos de obra.');
    }

    // Orden cronológico del expediente.
    const secuencia: Array<[string, IsoDate | null]> = [
        ['aprobación del expediente', g.fechaAprobacionExpediente],
        ['buena pro', c.fechaBuenaPro],
        ['firma del contrato', c.fechaFirmaContrato],
        ['inicio de ejecución', p.fechaInicioObra],
    ];
    const conFecha = secuencia.filter((item): item is [string, IsoDate] => item[1] !== null && item[1] !== '');
    for (let i = 1; i < conFecha.length; i++) {
        if (conFecha[i][1] < conFecha[i - 1][1]) {
            alertas.push(`La fecha de ${conFecha[i][0]} (${formatDate(conFecha[i][1])}) es anterior a la de ${conFecha[i - 1][0]} (${formatDate(conFecha[i - 1][1])}).`);
        }
    }
    if (p.fechaEntregaTerreno && p.fechaEntregaTerreno > p.fechaInicioObra) {
        alertas.push(`La entrega de terreno (${formatDate(p.fechaEntregaTerreno)}) es posterior al inicio de ejecución (${formatDate(p.fechaInicioObra)}).`);
    }
    if (p.fechaTerminoReal && p.fechaTerminoReal < p.fechaInicioObra) {
        alertas.push('La fecha de término real es anterior al inicio de ejecución.');
    }
    if (contexto.mesValorizacion < p.fechaInicioObra.slice(0, 7) || contexto.mesValorizacion > contexto.terminoVigente.slice(0, 7)) {
        alertas.push('La valorización activa está fuera del plazo de la obra (revisa el inicio, el plazo o las ampliaciones).');
    }

    return { completos: obligatorios.length - faltantes.length, total: obligatorios.length, faltantes, alertas };
}
