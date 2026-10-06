import { computeFichaTecnica } from '../sheets/ficha-tecnica/computeFichaTecnica';
import { computeMetrados } from '../sheets/metrados/computeMetrados';
import { validarValorizacion } from '../validation/validarValorizacion';
import { usePagos } from './usePagos';

/** Validaciones de negocio de la valorización activa (errores bloquean aprobar). */
export function useValidaciones() {
    const { input, presupuesto, periodos, control, acumulados, rfc, contrato, mesValorizacion } = usePagos();
    const { contratista, plazos } = input.fichaTecnica;
    const hallazgos = validarValorizacion({
        metrados: computeMetrados(presupuesto, input.metrados, periodos).filas,
        control,
        pagos: acumulados,
        rfc,
        contratoVigente: contrato.vigente,
        adelantos: { directo: contratista.adelantoDirecto.monto, materiales: contratista.adelantoMateriales.monto },
        plazos: { ...plazos, fechaTerminoVigente: computeFichaTecnica(input.fichaTecnica).fechaTerminoVigente },
        mesValorizacion,
    });

    return {
        hallazgos,
        errores: hallazgos.filter((h) => h.nivel === 'error'),
        avisos: hallazgos.filter((h) => h.nivel === 'aviso'),
    };
}
