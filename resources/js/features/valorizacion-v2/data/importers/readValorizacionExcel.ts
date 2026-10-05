import type { WorkSheet } from 'xlsx';
import { cellDate, key, numberString, text } from '../../lib/import/cells';
import { parseCalendarioRows } from '../../lib/import/parseCalendarioRows';
import { parseFichaRows } from '../../lib/import/parseFichaRows';
import { parseMetradosRows } from '../../lib/import/parseMetradosRows';
import {
    parseControlPagosRows,
    parsePagoRows,
} from '../../lib/import/parsePagoRows';
import { parsePeriodoRows } from '../../lib/import/parsePeriodoRows';
import { parsePersonalRows } from '../../lib/import/parsePersonalRows';
import { parsePresupuestoRows } from '../../lib/import/parsePresupuestoRows';
import { remapPartidaCells } from '../../lib/import/remapPartidaCells';
import { D } from '../../lib/money';
import type { ValorizacionInput } from '../../types';
import { enlazarPorCodigo } from './enlazarPorCodigo';

export interface ValorizacionExcelResult {
    input: ValorizacionInput;
    secciones: Array<{ hoja: string; detalle: string }>;
    warnings: string[];
}

/** Lee una vez el expediente e importa entradas; las hojas de resultados se recalculan. */
export async function readValorizacionExcel(
    data: ArrayBuffer,
    actual: ValorizacionInput,
): Promise<ValorizacionExcelResult> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(data, { type: 'array' });
    const input = structuredClone(actual);
    const result: ValorizacionExcelResult = {
        input,
        secciones: [],
        warnings: [],
    };
    const sheet = (
        pattern: RegExp,
    ): { name: string; cells: WorkSheet; rows: unknown[][] } | null => {
        const name = workbook.SheetNames.find((name) =>
            pattern.test(key(name)),
        );
        if (!name) return null;
        const cells = workbook.Sheets[name];

        return {
            name,
            cells,
            rows: XLSX.utils.sheet_to_json<unknown[]>(cells, {
                header: 1,
                raw: true,
                defval: null,
                range: 0,
            }),
        };
    };
    const aviso = (name: string, warnings: string[]) =>
        result.warnings.push(
            ...warnings.map((warning) => `${name}: ${warning}`),
        );
    const presupuesto = sheet(/^PRESUPUESTO\b/);
    if (presupuesto) {
        const parsed = parsePresupuestoRows(presupuesto.rows);
        if (parsed.partidas.length === 0)
            throw new Error(
                'La hoja PRESUPUESTO no contiene partidas válidas. No se importó ningún dato.',
            );
        input.presupuesto = { fuente: 'excel', partidas: parsed.partidas };
        for (const campo of ['gastosGenerales', 'utilidad', 'igv'] as const) {
            if (parsed.parametros[campo] !== null)
                input.parametros[campo] = parsed.parametros[campo];
        }
        input.calendarios.programado.montos = remapPartidaCells(
            actual.calendarios.programado.montos,
            actual.presupuesto.partidas,
            parsed.partidas,
        );
        input.metrados.ejecutado = remapPartidaCells(
            actual.metrados.ejecutado,
            actual.presupuesto.partidas,
            parsed.partidas,
        );
        result.secciones.push({
            hoja: presupuesto.name,
            detalle: `${parsed.partidas.length} filas de presupuesto y tasas del pie`,
        });
        aviso(presupuesto.name, parsed.warnings);
        const dropped = [
            ...Object.keys(actual.calendarios.programado.montos),
            ...Object.keys(actual.metrados.ejecutado),
        ].filter((id) => {
            const old = actual.presupuesto.partidas.find(
                (partida) => partida.id === id,
            );

            return (
                !old ||
                !parsed.partidas.some(
                    (partida) => partida.codigo === old.codigo,
                )
            );
        });
        if (dropped.length)
            result.warnings.push(
                'Hay partidas anteriores que no existen en el nuevo presupuesto; sus valores de calendario o metrados no se conservarán. Puedes deshacer la importación completa.',
            );
    }
    const ft = sheet(/^(FT|FICHA\s*TECNICA)$/);
    if (ft) {
        const parsed = parseFichaRows(ft.rows, actual.fichaTecnica);
        if (parsed.campos > 0) {
            input.fichaTecnica = parsed.ficha;
            // El monto vigente enlazado en Excel vuelve al cálculo del contrato existente.
            let contratista = false;
            ft.rows.forEach((row, rowIndex) => {
                if (row.some((cell) => /^B\.\s/.test(key(cell))))
                    contratista = true;
                if (row.some((cell) => /^C\.\s/.test(key(cell))))
                    contratista = false;
                if (
                    contratista &&
                    row.some((cell) =>
                        key(cell).startsWith('MONTO DEL CONTRATO VIGENTE'),
                    ) &&
                    row.some(
                        (_, col) =>
                            ft.cells[
                                XLSX.utils.encode_cell({ r: rowIndex, c: col })
                            ]?.f,
                    )
                ) {
                    input.fichaTecnica.contratista.montoContratoVigente = null;
                }
            });
            result.secciones.push({
                hoja: ft.name,
                detalle: `${parsed.campos} datos de ficha técnica`,
            });
        }
        aviso(ft.name, parsed.warnings);
    }
    const mensual = sheet(/^VAL\.\s*MENSUAL$/);
    const pago = sheet(/^R\s*PAGO\s*MENSUAL$/);
    const periodo =
        (mensual && parsePeriodoRows(mensual.rows)) ||
        (pago && parsePeriodoRows(pago.rows));
    if (periodo) {
        input.periodo = periodo;
        result.secciones.push({
            hoja: 'Periodo',
            detalle: `Valorización N°${periodo.numero}, ${periodo.mes.slice(0, 7)}`,
        });
    } else {
        result.warnings.push(
            'No se identificó el número y mes de valorización; se conserva el periodo actual.',
        );
    }
    // Los códigos del Excel son los originales, aunque el árbol normalice saltos en la numeración.
    const partidas = presupuesto
        ? input.presupuesto.partidas.map((partida) => ({
              ...partida,
              codigo: partida.id.replace(/^p-/, ''),
          }))
        : input.presupuesto.partidas;
    const programado = sheet(/^CALEN.*PROG|^PROGRAMADO$/);
    if (programado) {
        const parsed = parseCalendarioRows(programado.rows);
        const linked = enlazarPorCodigo(parsed.montos, partidas);
        if (
            parsed.meses.length === 0 ||
            (Object.keys(parsed.montos).length > 0 && linked.enlazadas === 0)
        )
            throw new Error(
                'El calendario programado no pudo enlazarse con el presupuesto. No se importó ningún dato.',
            );
        input.calendarios.programado = { montos: linked.valores };
        result.secciones.push({
            hoja: programado.name,
            detalle: `${linked.enlazadas} partidas enlazadas, ${parsed.meses.length} meses programados`,
        });
        aviso(programado.name, [...parsed.warnings, ...linked.warnings]);
    } else {
        result.warnings.push(
            'Falta CALEN. PROG.: se conserva el calendario existente. El presupuesto solo no define la Curva S programada.',
        );
    }
    const metrados = sheet(/^METRADOS?$/);
    if (metrados) {
        const parsed = parseMetradosRows(metrados.rows);
        const linked = enlazarPorCodigo(parsed.metrados, partidas);
        if (
            parsed.warnings.some((warning) =>
                warning.startsWith('No se encontr'),
            ) ||
            (Object.keys(parsed.metrados).length > 0 && linked.enlazadas === 0)
        )
            throw new Error(
                'Los metrados no pudieron enlazarse con el presupuesto. No se importó ningún dato.',
            );
        input.metrados = { ejecutado: linked.valores };
        result.secciones.push({
            hoja: metrados.name,
            detalle: `${linked.enlazadas} partidas enlazadas, ${parsed.meses.length} meses ejecutados`,
        });
        aviso(metrados.name, [...parsed.warnings, ...linked.warnings]);
        const distintos = partidas.filter(
            (partida) =>
                partida.metrado !== null &&
                parsed.contratados[partida.codigo] !== undefined &&
                !D(partida.metrado).eq(parsed.contratados[partida.codigo]),
        );
        if (distintos.length)
            result.warnings.push(
                `METRADOS: ${distintos.length} metrados contratados difieren del presupuesto; se conserva el presupuesto como base del cálculo.`,
            );
    } else {
        result.warnings.push(
            'Falta METRADOS: se conservan los metrados existentes. La curva ejecutada y la valorización mensual necesitan esos datos.',
        );
    }
    const controlPagos = sheet(/^CONTROL DE PAGOS$/);
    if (controlPagos) {
        const ajustes = parseControlPagosRows(controlPagos.rows);
        for (const [mes, valores] of Object.entries(ajustes))
            input.pagos.porMes[mes] = {
                ...input.pagos.porMes[mes],
                ...valores,
            };
        if (Object.keys(ajustes).length)
            result.secciones.push({
                hoja: controlPagos.name,
                detalle: `${Object.keys(ajustes).length} meses de ajustes y comprobantes`,
            });
        if (
            controlPagos.rows.some(
                (row) =>
                    /^\d+$/.test(text(row[0])) &&
                    numberString(row[9]) !== null &&
                    D(numberString(row[9])!).gt(0),
            )
        ) {
            result.warnings.push(
                'CONTROL DE PAGOS: las penalidades agrupadas se importan en "Otros"; el resumen de pago del mes tiene prioridad cuando incluye el desglose.',
            );
        }
    }
    if (pago && periodo) {
        const ajustes = parsePagoRows(pago.rows);
        const mes = periodo.mes.slice(0, 7);
        input.pagos.porMes[mes] = { ...input.pagos.porMes[mes], ...ajustes };
        const detraccion = pago.rows
            .flat()
            .map(key)
            .map((value) =>
                /DETRACCIONES?\s*\((\d+(?:[.,]\d+)?)\s*%\)/.exec(value),
            )
            .find(Boolean);
        if (detraccion)
            input.pagos.porcentajeDetraccion = D(
                detraccion[1].replace(',', '.'),
            )
                .div(100)
                .toString();
        result.secciones.push({
            hoja: pago.name,
            detalle: 'Ajustes manuales del mes y porcentaje de detracción',
        });
    }
    const rfc = sheet(/^R\.\s*F\.\s*C\.?$/);
    if (rfc) {
        const retencion = rfc.rows
            .flat()
            .map(key)
            .map((value) =>
                /TOTAL DE RETENCION\s*\((\d+(?:[.,]\d+)?)\s*%\)/.exec(value),
            )
            .find(Boolean);
        if (retencion)
            input.pagos.rfc.porcentaje = D(retencion[1].replace(',', '.'))
                .div(100)
                .toString();
        const regla = rfc.rows
            .flat()
            .map(key)
            .find((value) => value.includes('SE PROGRAMO'));
        if (regla?.includes('PRIMER PAGO'))
            input.pagos.rfc.modo = 'primer-pago';
        else if (regla?.includes('PRORRATEADA'))
            input.pagos.rfc.modo = 'prorrateo-mitad';
        result.secciones.push({
            hoja: rfc.name,
            detalle: 'Configuración de garantía de fiel cumplimiento',
        });
    }
    const financiero = sheet(/^CONTROL FINANCIERO$/);
    if (financiero) {
        let count = 0;
        for (const row of financiero.rows) {
            if (!/^VALORIZACION N/.test(key(row[0]))) continue;
            const date = cellDate(row[1]);
            const facturable = numberString(row[2]);
            const devengado = numberString(row[3]);
            if (!date || facturable === null || devengado === null) continue;
            if (D(devengado).isZero() || D(devengado).eq(facturable)) {
                input.control.devengados[date.slice(0, 7)] = D(devengado).gt(0);
                count++;
            } else
                result.warnings.push(
                    `CONTROL FINANCIERO: devengado parcial en ${date.slice(0, 7)}; revisar manualmente, el control actual marca meses completos.`,
                );
        }
        if (count)
            result.secciones.push({
                hoja: financiero.name,
                detalle: `${count} meses de estado de devengado`,
            });
    }
    const rh = sheet(/^RH[-\s]*EM$/);
    if (rh && periodo) {
        const parsed = parsePersonalRows(
            rh.rows,
            actual.personal,
            periodo.mes.slice(0, 7),
            input.fichaTecnica.contratista.residente,
        );
        if (parsed) {
            input.personal = parsed.personal;
            result.secciones.push({
                hoja: rh.name,
                detalle: `${parsed.personal.personas.length} profesionales y asistencia del mes`,
            });
            aviso(rh.name, parsed.warnings);
        } else
            result.warnings.push(
                'RH-EM: no se identificó la tabla de personal; se conservaron los datos existentes.',
            );
    } else if (rh)
        result.warnings.push(
            'RH-EM: no se importó la asistencia porque no se identificó el periodo del archivo.',
        );
    if (
        !presupuesto &&
        !ft &&
        !programado &&
        !metrados &&
        !pago &&
        !controlPagos &&
        !rfc &&
        !financiero &&
        !rh
    )
        throw new Error(
            'No se encontraron hojas de una valorización compatibles en el archivo.',
        );
    if (result.secciones.length === 0)
        throw new Error('No se encontraron entradas válidas para importar.');
    if (input.presupuesto.partidas.length === 0 && (programado || metrados))
        throw new Error(
            'Primero se necesita un presupuesto para enlazar el calendario y los metrados.',
        );

    return result;
}
