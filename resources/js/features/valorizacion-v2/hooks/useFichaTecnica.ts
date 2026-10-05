import { D } from '../lib/money';
import { avanceDelPlazo } from '../lib/periodos';
import { computeFichaTecnica } from '../sheets/ficha-tecnica/computeFichaTecnica';
import { validarFicha } from '../sheets/ficha-tecnica/validarFicha';
import { useControl } from './useControl';

/**
 * FT de entrada + todo lo derivado: textos de plazo, término vigente, avance
 * acumulado (FT!E58/E59, de CONTROL GEN. AVAN. OBRA.), contrato resuelto
 * (montos automáticos) y validación de completitud/coherencia.
 * Sin useMemo manual: el React Compiler del proyecto memoiza.
 */
export function useFichaTecnica() {
    const { input, control, contrato, presupuesto, mesValorizacion } = useControl();
    const ficha = input.fichaTecnica;
    const fila = control.meses.find((mes) => mes.periodo.key === mesValorizacion) ?? control.ultima;
    const calculada = computeFichaTecnica(ficha, fila ? { programado: fila.programado.pctAcumulado, ejecutado: fila.ejecutado?.pctAcumulado ?? D(0) } : null);

    return {
        ficha,
        calculada,
        contrato,
        tiempo: avanceDelPlazo(ficha.plazos.fechaInicioObra, calculada.fechaTerminoVigente, mesValorizacion),
        mesValorizacion,
        validacion: validarFicha(ficha, contrato, {
            totalPresupuesto: presupuesto.totales.total,
            partidas: input.presupuesto.partidas.length,
            mesValorizacion,
            terminoVigente: calculada.fechaTerminoVigente,
        }),
    };
}
