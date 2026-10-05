import { roundMoney } from '../lib/money';
import { periodosDeObra } from '../lib/periodos';
import { computeFichaTecnica } from '../sheets/ficha-tecnica/computeFichaTecnica';
import { resolverContrato } from '../sheets/ficha-tecnica/resolverContrato';
import { calendarioEjecutadoDesdeMetrados } from '../sheets/metrados/computeMetrados';
import { computePresupuesto } from '../sheets/presupuesto/computePresupuesto';
import { useValorizacionStore } from '../store/ValorizacionStoreProvider';

/**
 * Base común de todas las hojas: presupuesto calculado, contrato resuelto
 * (montos automáticos o escritos), meses de la obra (plazo de la FT + cualquier
 * mes con datos) y mes de la valorización activa.
 */
export function useValorizacionBase() {
    const input = useValorizacionStore((state) => state.input);
    const calculado = computePresupuesto(input.presupuesto, input.parametros);
    const contrato = resolverContrato(input.fichaTecnica, calculado.totales.total);
    // El total del presupuesto debe igualar el contrato PRINCIPAL (el vigente incluye adicionales).
    const presupuesto = { ...calculado, diferenciaContrato: roundMoney(calculado.totales.total.sub(contrato.principal)) };
    const ejecutado = calendarioEjecutadoDesdeMetrados(presupuesto, input.metrados);
    const mesesConDatos = new Set(
        [...Object.values(input.calendarios.programado.montos), ...Object.values(input.metrados.ejecutado)].flatMap((porMes) => Object.keys(porMes)),
    );
    const { fechaTerminoVigente } = computeFichaTecnica(input.fichaTecnica);

    return {
        input,
        presupuesto,
        contrato,
        parametros: input.parametros,
        calendarios: { programado: input.calendarios.programado, ejecutado },
        periodos: periodosDeObra(input.fichaTecnica.plazos.fechaInicioObra, fechaTerminoVigente, mesesConDatos),
        mesValorizacion: input.periodo.mes.slice(0, 7),
    };
}
