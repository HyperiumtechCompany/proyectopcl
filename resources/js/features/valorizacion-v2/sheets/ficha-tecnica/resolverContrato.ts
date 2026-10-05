import type Decimal from 'decimal.js';
import { D } from '../../lib/money';
import type { DecimalInput } from '../../lib/money';
import type { FichaTecnica } from '../../types';

export interface ContratoResuelto {
    referencial: Decimal;
    principal: Decimal;
    adicionales: Decimal;
    deductivos: Decimal;
    vigente: Decimal;
    plazoContractualDias: number;
    /** true = el valor se calcula (el usuario no lo escribió). */
    auto: { referencial: boolean; principal: boolean; vigente: boolean; plazoContractual: boolean };
}

/**
 * Montos y plazo del contrato de obra para CUALQUIER proyecto: si la Ficha no
 * trae el valor, se deriva de los datos conectados (presupuesto, adicionales y
 * deductivos de obra, plazo de ejecución). Así una obra nueva nunca queda con
 * contrato en 0 y todas las hojas (garantía, financiero, tablero…) cuadran.
 */
export function resolverContrato(ficha: FichaTecnica, totalPresupuesto: DecimalInput): ContratoResuelto {
    const { contratista, plazos } = ficha;
    const referencial = contratista.valorReferencial === null ? D(totalPresupuesto) : D(contratista.valorReferencial);
    const principal = contratista.montoContratoPrincipal === null ? referencial : D(contratista.montoContratoPrincipal);
    const sumar = (tipo: 'adicional' | 'deductivo') => (contratista.modificacionesContrato ?? []).filter((m) => m.tipo === tipo).reduce((acc, m) => acc.add(D(m.monto)), D(0));
    const adicionales = sumar('adicional');
    const deductivos = sumar('deductivo');
    const vigente = contratista.montoContratoVigente === null ? principal.add(adicionales).sub(deductivos) : D(contratista.montoContratoVigente);

    return {
        referencial,
        principal,
        adicionales,
        deductivos,
        vigente,
        plazoContractualDias: contratista.plazoContractualDias ?? plazos.plazoEjecucionDias,
        auto: {
            referencial: contratista.valorReferencial === null,
            principal: contratista.montoContratoPrincipal === null,
            vigente: contratista.montoContratoVigente === null,
            plazoContractual: contratista.plazoContractualDias === null,
        },
    };
}
