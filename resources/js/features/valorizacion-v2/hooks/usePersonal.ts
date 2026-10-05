import { computeFichaTecnica } from '../sheets/ficha-tecnica/computeFichaTecnica';
import { computeAsistencia } from '../sheets/personal/computeAsistencia';
import { useValorizacionStore } from '../store/ValorizacionStoreProvider';

/** RH-EM: asistencia del personal clave en el mes de la valorización. */
export function usePersonal() {
    const input = useValorizacionStore((state) => state.input);
    const mes = input.periodo.mes.slice(0, 7);
    const { fechaTerminoVigente } = computeFichaTecnica(input.fichaTecnica);

    return {
        input,
        mes,
        asistencia: computeAsistencia(input.personal, mes, input.fichaTecnica.plazos.fechaInicioObra, fechaTerminoVigente, {
            residente: input.fichaTecnica.contratista.residente,
        }),
    };
}
