import Decimal from 'decimal.js';

/** Precisión única del motor monetario, con redondeo equivalente a Excel. */
export const DecimalGastosGenerales = Decimal.clone({
    precision: 40,
    rounding: Decimal.ROUND_HALF_UP,
});

export const TASAS_GASTOS_GENERALES = {
    asignacionFamiliar: 46,
    snp: 0.13,
    essalud: 0.09,
    cts: 0.083333,
    sencico: 0.002,
    itf: 0.00005,
    controlConcurrenteTope: 0.006,
    igv: 0.18,
    mesesPorAnio: 12,
} as const;

export function numeroSeguro(value: unknown, fallback = 0): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function decimalSeguro(value: unknown, fallback: Decimal.Value = 0): Decimal {
    try {
        if (value === null || value === undefined || value === '') {
            return new DecimalGastosGenerales(fallback);
        }

        const decimal = new DecimalGastosGenerales(value as Decimal.Value);
        return decimal.isFinite() ? decimal : new DecimalGastosGenerales(fallback);
    } catch {
        return new DecimalGastosGenerales(fallback);
    }
}

export function redondearDecimal(value: unknown, decimales = 2): number {
    return decimalSeguro(value).toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP).toNumber();
}

export function redondearMoneda(value: unknown): number {
    return redondearDecimal(value, 2);
}

export function sumarDecimales(values: Iterable<unknown>, decimales = 2): number {
    let total = new DecimalGastosGenerales(0);
    for (const value of values) total = total.plus(decimalSeguro(value));
    return total.toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP).toNumber();
}

export function multiplicarDecimales(values: Iterable<unknown>, decimales = 2): number {
    let total = new DecimalGastosGenerales(1);
    for (const value of values) total = total.times(decimalSeguro(value));
    return total.toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP).toNumber();
}

export function factorParticipacion(value: unknown): number {
    return decimalSeguro(value, 100).clamp(0, 100).dividedBy(100).toNumber();
}

export function calcularParcial(cantidad: unknown, tiempo: unknown, participacion: unknown, precio: unknown): number {
    return multiplicarDecimales([cantidad, tiempo, factorParticipacion(participacion), precio]);
}

export function calcularPorTasa(base: unknown, tasa: number): number {
    return redondearMoneda(DecimalGastosGenerales.max(decimalSeguro(base), 0).times(decimalSeguro(tasa)));
}

export function calcularSencico(base: unknown, porcentaje = 0.2): number {
    return redondearMoneda(DecimalGastosGenerales.max(decimalSeguro(base), 0).times(porcentaje).dividedBy(100));
}

export function calcularTopeControlConcurrente(base: unknown, porcentaje = 0.6): number {
    return redondearMoneda(DecimalGastosGenerales.max(decimalSeguro(base), 0).times(porcentaje).dividedBy(100));
}

export function calcularRemuneracion(input: {
    sueldoBasico: unknown;
    cantidad: unknown;
    meses: unknown;
    participacion: unknown;
    tasas?: Partial<{
        asignacionFamiliarFactor: number;
        snpPorcentaje: number;
        essaludPorcentaje: number;
        ctsPorcentaje: number;
        gratificacionPorcentaje: number;
        vacacionesPorcentaje: number;
    }>;
}) {
    const tasas = {
        asignacionFamiliarFactor: input.tasas?.asignacionFamiliarFactor ?? TASAS_GASTOS_GENERALES.asignacionFamiliar,
        snpPorcentaje: input.tasas?.snpPorcentaje ?? TASAS_GASTOS_GENERALES.snp * 100,
        essaludPorcentaje: input.tasas?.essaludPorcentaje ?? TASAS_GASTOS_GENERALES.essalud * 100,
        ctsPorcentaje: input.tasas?.ctsPorcentaje ?? TASAS_GASTOS_GENERALES.cts * 100,
        gratificacionPorcentaje: input.tasas?.gratificacionPorcentaje ?? (100 / TASAS_GASTOS_GENERALES.mesesPorAnio),
        vacacionesPorcentaje: input.tasas?.vacacionesPorcentaje ?? (100 / TASAS_GASTOS_GENERALES.mesesPorAnio),
    };
    const cantidad = DecimalGastosGenerales.max(decimalSeguro(input.cantidad), 0);
    const meses = DecimalGastosGenerales.max(decimalSeguro(input.meses), 0);
    const participacion = decimalSeguro(factorParticipacion(input.participacion));
    const sueldoBase = DecimalGastosGenerales.max(decimalSeguro(input.sueldoBasico), 0).times(cantidad).times(participacion);
    const asignacionFamiliar = decimalSeguro(tasas.asignacionFamiliarFactor).times(cantidad).times(participacion);
    const base = sueldoBase.plus(asignacionFamiliar);
    const gratificacion = base.times(tasas.gratificacionPorcentaje).dividedBy(100);
    const vacaciones = base.times(tasas.vacacionesPorcentaje).dividedBy(100);
    const essalud = sueldoBase.times(tasas.essaludPorcentaje).dividedBy(100);
    const snp = base.times(tasas.snpPorcentaje).dividedBy(100);
    const cts = base.plus(gratificacion).times(tasas.ctsPorcentaje).dividedBy(100);
    const totalMensual = sueldoBase.plus(asignacionFamiliar).plus(essalud).plus(cts).plus(vacaciones).plus(gratificacion);

    return {
        sueldoBase: redondearMoneda(sueldoBase), asignacionFamiliar: redondearMoneda(asignacionFamiliar),
        snp: redondearMoneda(snp), essalud: redondearMoneda(essalud), cts: redondearMoneda(cts),
        vacaciones: redondearMoneda(vacaciones), gratificacion: redondearMoneda(gratificacion),
        totalMensual: redondearMoneda(totalMensual), totalProyecto: redondearMoneda(totalMensual.times(meses)),
    };
}

export const formatoMoneda = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Precisión única del motor. ROUND_HALF_UP equivale al redondeo de Excel. */
