import { decimalSeguro, redondearMoneda, sumarDecimales } from './calculos';

export interface VerificacionItem {
    concepto: string;
    esperado: number;
    calculado: number;
    diferencia: number;
    correcto: boolean;
}

const check = (concepto: string, esperado: unknown, calculado: unknown): VerificacionItem => {
    const expected = redondearMoneda(esperado);
    const actual = redondearMoneda(calculado);
    const diferencia = redondearMoneda(decimalSeguro(actual).minus(expected));

    return {
        concepto,
        esperado: expected,
        calculado: actual,
        diferencia,
        correcto: decimalSeguro(diferencia).abs().lessThanOrEqualTo(0.01),
    };
};

export function verificarSnapshotGastosGenerales(snapshot: Record<string, unknown>): VerificacionItem[] {
    const costoDirecto = snapshot.total_costo_directo;
    const gastosFijos = snapshot.total_gg_fijos;
    const gastosVariables = snapshot.total_gg_variables;
    const utilidad = snapshot.comp_iii_utilidad;
    const subtotal = snapshot.comp_iv_subtotal_sin_igv;
    const igv = snapshot.comp_v_igv;

    return [
        check('Gastos Generales = Fijos + Variables', snapshot.comp_ii_gastos_generales, sumarDecimales([gastosFijos, gastosVariables])),
        check('Subtotal sin IGV = CD + GG + Utilidad', subtotal, sumarDecimales([costoDirecto, snapshot.comp_ii_gastos_generales, utilidad])),
        check('Componente I con IGV = Subtotal + IGV', snapshot.comp_vi_valor_con_igv, sumarDecimales([subtotal, igv])),
        check(
            'Control Concurrente = base consolidada × porcentaje',
            snapshot.total_control_concurrente_financiado,
            redondearMoneda(
                decimalSeguro(snapshot.total_inversion_obra)
                    .minus(decimalSeguro(snapshot.total_control_concurrente_financiado))
                    .times(decimalSeguro(snapshot.control_concurrente_porcentaje))
                    .dividedBy(100),
            ),
        ),
    ];
}
