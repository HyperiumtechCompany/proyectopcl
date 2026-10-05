import type { IsoDate } from '../lib/dates';
import type { MoneyString } from '../lib/money';

/**
 * Hoja FT (Ficha Técnica) — fuente maestra L0.
 * Solo ENTRADAS: todo lo calculable (término programado, plazo en letras,
 * situación del avance…) vive en sheets/ficha-tecnica/computeFichaTecnica.ts.
 * Montos como string para que el estado sea JSON puro (persistencia en Fase 8).
 */

export interface Ubicacion {
    departamento: string;
    provincia: string;
    distrito: string;
    localidad: string;
}

export interface DatosGenerales {
    entidad: string;
    obra: string;
    cui: string;
    resolucionAprobacion: string;
    fechaAprobacionExpediente: IsoDate | null;
    fechaPresupuestoBase: IsoDate | null;
    ubicacion: Ubicacion;
}

/** Adicional o deductivo de obra aprobado: modifica el monto del contrato vigente. */
export interface ModificacionContrato {
    id: string;
    documento: string;
    tipo: 'adicional' | 'deductivo';
    monto: MoneyString;
}

/** Adelanto: monto null = "NO SE OTORGÓ ADELANTO". */
export interface Adelanto {
    monto: MoneyString | null;
    fechaEfectiva: IsoDate | null;
}

export interface ContratistaEjecutor {
    ejecutor: string;
    representanteLegal: string;
    domicilioLegal: string;
    procesoSeleccion: string;
    fechaBuenaPro: IsoDate | null;
    contrato: string;
    fechaFirmaContrato: IsoDate | null;
    modalidadEjecucion: string;
    sistemaContratacion: string;
    /**
     * Montos del contrato con IGV. null = AUTOMÁTICO: referencial = total del
     * presupuesto, principal = referencial, vigente = principal + adicionales −
     * deductivos (ver resolverContrato). Un valor escrito manda sobre el cálculo.
     */
    valorReferencial: MoneyString | null;
    montoContratoPrincipal: MoneyString | null;
    montoContratoVigente: MoneyString | null;
    modificacionesContrato: ModificacionContrato[];
    adelantoDirecto: Adelanto;
    adelantoMateriales: Adelanto;
    /** null = igual al plazo de ejecución. */
    plazoContractualDias: number | null;
    residente: string;
}

export interface Supervision {
    contratista: string;
    ruc: string;
    representanteLegal: string;
    domicilioLegal: string;
    procesoSeleccion: string;
    fechaCuantia: IsoDate | null;
    contrato: string;
    fechaFirmaContrato: IsoDate | null;
    valorReferencial: MoneyString;
    montoContratoOriginal: MoneyString;
    montoContratoVigente: MoneyString;
    plazoServicioDias: number;
    supervisor: string;
}

/** Ampliación o suspensión de plazo. */
export interface ModificacionPlazo {
    id: string;
    documento: string;
    dias: number;
}

export interface Plazos {
    fechaEntregaTerreno: IsoDate | null;
    fechaInicioObra: IsoDate;
    plazoEjecucionDias: number;
    ampliaciones: ModificacionPlazo[];
    suspensiones: ModificacionPlazo[];
    fechaTerminoReal: IsoDate | null;
}

export interface EstadoSituacional {
    formaValorizacion: 'MENSUAL' | 'QUINCENAL' | 'POR HITOS';
    situacionObra: string;
}

export interface FichaTecnica {
    datosGenerales: DatosGenerales;
    contratista: ContratistaEjecutor;
    supervision: Supervision;
    plazos: Plazos;
    estado: EstadoSituacional;
}
