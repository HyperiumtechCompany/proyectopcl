import Decimal from 'decimal.js';

/** Ajusta solo diferencias de redondeo, nunca descuadres reales de distribución. */
export function ajustarResiduoMonetario(
    distribucion: Record<string, number>,
    clavesOrdenadas: string[],
    totalOficial: number,
    tolerancia = 0.01,
): Record<string, number> {
    const resultado = { ...distribucion };
    const suma = Object.values(resultado).reduce((total, monto) => total + monto, 0);
    const residuo = new Decimal(totalOficial).toDecimalPlaces(2).minus(suma);

    if (residuo.isZero() || residuo.abs().greaterThan(tolerancia)) {
        return resultado;
    }

    const ultimaKeyActiva = [...clavesOrdenadas]
        .reverse()
        .find((key) => (resultado[key] ?? 0) !== 0);

    if (ultimaKeyActiva) {
        resultado[ultimaKeyActiva] = new Decimal(resultado[ultimaKeyActiva])
            .plus(residuo)
            .toDecimalPlaces(2)
            .toNumber();
    }

    return resultado;
}
