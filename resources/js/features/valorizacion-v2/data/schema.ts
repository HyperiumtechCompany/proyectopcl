import { calcPlazo, isIsoDate, monthKey, todayInObra } from '../lib/dates';
import type { FichaTecnica, ValorizacionInput } from '../types';

/**
 * Versión del JSON guardado en valorizacion_v2_documentos.datos. Si cambia la
 * forma de ValorizacionInput, subir la versión y agregar la migración aquí.
 */
export const SCHEMA_VERSION = 1;

/** Datos del proyecto de Costos con los que se pre-llena la Ficha de una valorización nueva. */
export interface ProyectoBase {
    nombre: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    unidad_ejecutora?: string | null;
    codigo_cui?: string | null;
    departamento?: string | null;
    provincia?: string | null;
    distrito?: string | null;
    centro_poblado?: string | null;
}

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Mezcla `raw` sobre `defaults`: objetos recursivamente; arrays y escalares se toman de `raw` si existen. */
function mergeDefaults<T>(defaults: T, raw: unknown): T {
    if (!isPlain(defaults) || !isPlain(raw)) {
        return (raw === undefined || raw === null ? defaults : raw) as T;
    }
    const result: Plain = { ...defaults };
    for (const [key, value] of Object.entries(raw)) {
        result[key] = key in defaults ? mergeDefaults((defaults as Plain)[key], value) : value;
    }

    return result as T;
}

function fichaVacia(proyecto: ProyectoBase): FichaTecnica {
    const inicio = proyecto.fecha_inicio && isIsoDate(proyecto.fecha_inicio) ? proyecto.fecha_inicio : todayInObra();
    const plazo = proyecto.fecha_fin && isIsoDate(proyecto.fecha_fin) && proyecto.fecha_fin >= inicio ? calcPlazo(inicio, proyecto.fecha_fin) : 30;
    const sinAdelanto = { monto: null, fechaEfectiva: null };

    return {
        datosGenerales: {
            entidad: proyecto.unidad_ejecutora ?? '',
            obra: proyecto.nombre,
            cui: proyecto.codigo_cui ?? '',
            resolucionAprobacion: '',
            fechaAprobacionExpediente: null,
            fechaPresupuestoBase: null,
            ubicacion: {
                departamento: proyecto.departamento ?? '',
                provincia: proyecto.provincia ?? '',
                distrito: proyecto.distrito ?? '',
                localidad: proyecto.centro_poblado ?? '',
            },
        },
        contratista: {
            ejecutor: '',
            representanteLegal: '',
            domicilioLegal: '',
            procesoSeleccion: '',
            fechaBuenaPro: null,
            contrato: '',
            fechaFirmaContrato: null,
            modalidadEjecucion: '',
            sistemaContratacion: '',
            valorReferencial: null,
            montoContratoPrincipal: null,
            montoContratoVigente: null,
            modificacionesContrato: [],
            adelantoDirecto: sinAdelanto,
            adelantoMateriales: sinAdelanto,
            plazoContractualDias: null,
            residente: '',
        },
        supervision: {
            contratista: '',
            ruc: '',
            representanteLegal: '',
            domicilioLegal: '',
            procesoSeleccion: '',
            fechaCuantia: null,
            contrato: '',
            fechaFirmaContrato: null,
            valorReferencial: '0',
            montoContratoOriginal: '0',
            montoContratoVigente: '0',
            plazoServicioDias: plazo,
            supervisor: '',
        },
        plazos: { fechaEntregaTerreno: null, fechaInicioObra: inicio, plazoEjecucionDias: plazo, ampliaciones: [], suspensiones: [], fechaTerminoReal: null },
        estado: { formaValorizacion: 'MENSUAL', situacionObra: 'EN EJECUCIÓN' },
    };
}

/** Valorización nueva para un proyecto sin datos: FT con nombre y fechas del proyecto, todo lo demás vacío. */
export function crearInputVacio(proyecto: ProyectoBase): ValorizacionInput {
    const fichaTecnica = fichaVacia(proyecto);
    const inicio = fichaTecnica.plazos.fechaInicioObra;

    return {
        periodo: { numero: 1, mes: `${monthKey(inicio)}-01` },
        parametros: { gastosGenerales: '0.10', utilidad: '0.07', igv: '0.18' },
        fichaTecnica,
        presupuesto: { fuente: 'manual', partidas: [] },
        calendarios: { programado: { montos: {} } },
        metrados: { ejecutado: {} },
        control: { devengados: {} },
        pagos: { rfc: { porcentaje: '0.10', modo: 'primer-pago' }, porcentajeDetraccion: '0.04', porMes: {}, adicionales: [] },
        personal: {
            personas: [{ id: 'rh-residente', nombre: '', vinculoFT: 'residente', cargo: 'RESIDENTE DE OBRA', cantidad: 1, dni: '', cip: '' }],
            faltas: {},
        },
    };
}

/**
 * Lee el JSON guardado (de cualquier versión anterior) y lo completa con los
 * valores por defecto de la versión actual, para que agregar campos nuevos no
 * rompa documentos ya guardados.
 */
export function normalizarInput(raw: unknown, proyecto: ProyectoBase): ValorizacionInput {
    const base = crearInputVacio(proyecto);
    const merged = mergeDefaults(base, raw);
    // El término nunca puede quedar antes del inicio por datos incompletos.
    if (!isIsoDate(merged.fichaTecnica.plazos.fechaInicioObra)) {
        merged.fichaTecnica.plazos.fechaInicioObra = base.fichaTecnica.plazos.fechaInicioObra;
    }
    if (!isIsoDate(merged.periodo.mes)) {
        merged.periodo.mes = base.periodo.mes;
    }

    return merged;
}
