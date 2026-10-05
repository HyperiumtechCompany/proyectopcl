import { computeFichaTecnica } from '../sheets/ficha-tecnica/computeFichaTecnica';
import { computeTablero } from '../sheets/tablero/computeTablero';
import { usePagos } from './usePagos';

/** Tablero de indicadores: el final de la cadena, junta resultados de todas las hojas. */
export function useTablero() {
    const pagos = usePagos();
    const { input, contrato, control, financiero, resumen, rfc, acumulados, mesValorizacion } = pagos;
    const { fechaTerminoVigente } = computeFichaTecnica(input.fichaTecnica);

    return {
        ...pagos,
        tablero: computeTablero({
            control,
            financiero,
            resumen,
            rfc,
            pagos: acumulados,
            mesValorizacion,
            inicioObra: input.fichaTecnica.plazos.fechaInicioObra,
            terminoVigente: fechaTerminoVigente,
            contratoVigente: contrato.vigente,
        }),
    };
}
