import type { ValorizacionInput } from '../../types';
import { calendarios02Jul2026 } from './calendarios02Jul2026';
import { metrados02Jul2026 } from './metrados02Jul2026';
import { presupuesto02Jul2026 } from './presupuesto02Jul2026';

/**
 * Datos reales de "VALORIZACIÓN N°02 - JUL 2026 (1).xlsx" (hoja FT + pie de
 * PRESUPUESTO). Alimenta la página mientras no exista persistencia (Fase 8) y
 * sirve de oráculo para los tests: los totales calculados deben cuadrar con el Excel.
 */
export const valorizacion02Jul2026: ValorizacionInput = {
    periodo: { numero: 2, mes: '2026-07-01' },
    parametros: { gastosGenerales: '0.10', utilidad: '0.07', igv: '0.18' },
    presupuesto: presupuesto02Jul2026,
    calendarios: calendarios02Jul2026,
    metrados: metrados02Jul2026,
    // CONTROL FINANCIERO: la Val. N°01 (junio) ya está devengada; la N°02 aún no.
    control: { devengados: { '2026-06': true } },
    // R.F.C: 10 % del contrato retenido íntegro en la primera valorización (hoja R.F.C);
    // detracción 4 %; sin reajustes, amortizaciones ni penalidades.
    pagos: { rfc: { porcentaje: '0.10', modo: 'primer-pago' }, porcentajeDetraccion: '0.04', porMes: {}, adicionales: [] },
    // RH-EM: el residente se toma de la FT; asistencia completa en julio (sin faltas).
    personal: {
        personas: [
            { id: 'rh-residente', nombre: '', vinculoFT: 'residente', cargo: 'RESIDENTE DE OBRA', cantidad: 1, dni: '71535828', cip: '230440' },
            { id: 'rh-sst', nombre: 'ING. PAJUELO VASQUEZ, BAYLON ARTURO', cargo: 'ESPECIALISTA DE SEGURIDAD Y SALUD EN EL TRABAJO', cantidad: 1, dni: '22520709', cip: '86312' },
        ],
        faltas: {},
    },
    fichaTecnica: {
        datosGenerales: {
            entidad: 'MUNICIPALIDAD DISTRITAL DE PILLCO MARCA',
            obra: '"MEJORAMIENTO Y AMPLIACIÓN DE LOS SERVICIOS DE TRANSITABILIDAD VEHICULAR Y PEATONAL DEL JR LOS PINOS Y JR LOS CEDROS EN CAYHUAYNA Y CAYHUAYNA DEL DISTRITO DE PILLCO MARCA - PROVINCIA DE HUÁNUCO - DEPARTAMENTO DE HUÁNUCO" con CUI N°2536252',
            cui: '2536252',
            resolucionAprobacion: 'RESOLUCIÓN DE GERENCIA N°125-2026-MDPM/GM',
            fechaAprobacionExpediente: '2026-04-08',
            // El Excel muestra "Abr-27": posterior a la aprobación del expediente
            // (08/04/2026), probablemente un error de digitación de "Abr-26".
            fechaPresupuestoBase: '2026-04-01',
            ubicacion: { departamento: 'HUÁNUCO', provincia: 'HUÁNUCO', distrito: 'PILLCO MARCA', localidad: 'CAYHUAYNA' },
        },
        contratista: {
            ejecutor: 'CONSORCIO EJECUTOR LOS PINOS',
            representanteLegal: 'SR. CALLUPE JARA KENEDY ISAAC',
            domicilioLegal: 'BARRIO USHNOPATA Nº S/N CP MENOR HUANCACHUPA - PILLCO MARCA - HUÁNUCO',
            procesoSeleccion: 'LICITACIÓN PÚBLICA ABREVIADA DE OBRAS N°04-2026-MDPM/C-1',
            fechaBuenaPro: '2026-06-02',
            contrato: 'CONTRATO DE EJECUCIÓN DE OBRA N°004-2026-MDPM/GM',
            fechaFirmaContrato: '2026-06-19',
            modalidadEjecucion: 'ADMINISTRACIÓN INDIRECTA - CONTRATA',
            sistemaContratacion: 'PRECIOS UNITARIOS',
            valorReferencial: '638827.47',
            montoContratoPrincipal: '638827.47',
            montoContratoVigente: '638827.47',
            modificacionesContrato: [],
            adelantoDirecto: { monto: null, fechaEfectiva: null },
            adelantoMateriales: { monto: null, fechaEfectiva: null },
            plazoContractualDias: 60,
            residente: 'ING. RAMIREZ BLANCO GABRIEL AUGUSTO HERMOGENES',
        },
        supervision: {
            contratista: 'PROYECTA PCL S.A.C',
            ruc: '20607943355',
            representanteLegal: 'SR. JOSÉ EDUARDO NIEVES CUADROS (DNI N°47768125)',
            domicilioLegal: 'JR. BOLÍVAR HUÁNUCO - HUÁNUCO - HUÁNUCO',
            procesoSeleccion: 'CONTRATO MENOR',
            fechaCuantia: '2026-06-22',
            contrato: 'CONTRATO DE CONSULTORÍA DE OBRA N°010-2026-MDPM/GM',
            fechaFirmaContrato: '2026-07-02',
            valorReferencial: '41200.00',
            montoContratoOriginal: '41200.00',
            montoContratoVigente: '41200.00',
            plazoServicioDias: 90,
            supervisor: 'ING. CESAR RICARDO ZELADA RODRIGUEZ (CIP N°98469)',
        },
        plazos: {
            fechaEntregaTerreno: '2026-06-20',
            fechaInicioObra: '2026-06-20',
            plazoEjecucionDias: 60,
            ampliaciones: [],
            suspensiones: [],
            fechaTerminoReal: null,
        },
        estado: {
            formaValorizacion: 'MENSUAL',
            situacionObra: 'EN EJECUCIÓN',
        },
    },
};
