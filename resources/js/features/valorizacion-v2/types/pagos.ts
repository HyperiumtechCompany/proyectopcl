import type { IsoDate } from '../lib/dates';
import type { MoneyString, RatioString } from '../lib/money';
import type { MesKey } from './calendario';

/**
 * Ajustes MANUALES de cada valorización (R PAGO MENSUAL / CONTROL DE PAGOS).
 * Todo lo demás del flujo de pago se calcula. Montos con IGV; vacío = 0.
 */
export interface AjustesPago {
    reajusteMes: MoneyString;
    reintegroMesAnterior: MoneyString;
    deduccionReajusteDirecto: MoneyString;
    deduccionReajusteMateriales: MoneyString;
    amortizacionDirecto: MoneyString;
    amortizacionMateriales: MoneyString;
    penalidadAtraso: MoneyString;
    penalidadOtros: MoneyString;
    facturaNro: string;
    comprobanteNro: string;
    fechaPago: IsoDate | null;
}

/**
 * Retención de garantía de fiel cumplimiento (MYPE, Art. 114 Reglamento Ley
 * N°32069): % del contrato original retenido en el primer pago o prorrateado en
 * la primera mitad de los pagos.
 */
export interface ConfigRfc {
    porcentaje: RatioString;
    modo: 'primer-pago' | 'prorrateo-mitad';
}

/**
 * Valorización de adicionales, costos adicionales, mayores gastos generales,
 * intereses u otros (CONTROL DE PAGOS, segunda tabla). Todo es dato: el Excel
 * calcula efectivo = (Vn − (G + P)) / (1 + IGV) e IGV = efectivo × IGV.
 */
export interface AdicionalPago {
    id: string;
    mes: MesKey;
    concepto: string;
    monto: MoneyString;
    reajuste: MoneyString;
    amortizacionDirecto: MoneyString;
    amortizacionMateriales: MoneyString;
    retencion: MoneyString;
    penalidades: MoneyString;
    facturaNro: string;
    comprobanteNro: string;
    fechaPago: IsoDate | null;
}

export interface PagosInput {
    rfc: ConfigRfc;
    /** Detracción sobre el monto neto facturable (se redondea a entero). */
    porcentajeDetraccion: RatioString;
    porMes: Record<MesKey, Partial<AjustesPago>>;
    adicionales: AdicionalPago[];
}
