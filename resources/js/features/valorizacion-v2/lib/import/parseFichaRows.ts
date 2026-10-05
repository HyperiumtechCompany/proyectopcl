import { isIsoDate } from '../dates';
import type { FichaTecnica } from '../../types';
import { cellDate, key, numberString, text } from './cells';
import type { Cell } from './cells';

/** Lee entradas de FT por sección y etiqueta; los avances y términos calculados se omiten. */
export function parseFichaRows(
    rows: Cell[][],
    actual: FichaTecnica,
): { ficha: FichaTecnica; campos: number; warnings: string[] } {
    const ficha = structuredClone(actual);
    const warnings: string[] = [];
    let campos = 0;
    let seccion = '';
    const dias = (value: Cell): number | null => {
        const match =
            /\((\d+)\)/.exec(text(value)) ?? /^(\d+)\b/.exec(text(value));

        return match ? Number(match[1]) : null;
    };
    const assign = (target: object, field: string, value: unknown) => {
        Object.assign(target, { [field]: value });
        campos++;
    };
    const stringFields: Record<string, Record<string, string>> = {
        A: {
            ENTIDAD: 'entidad',
            OBRA: 'obra',
            'CODIGO UNICO DE INVERSION': 'cui',
            'APROBACION DEL EXPEDIENTE TECNICO': 'resolucionAprobacion',
        },
        B: {
            EJECUTOR: 'ejecutor',
            'REPRESENTANTE COMUN LEGAL': 'representanteLegal',
            'DOMICILIO LEGAL': 'domicilioLegal',
            'PROCESO DE SELECCION': 'procesoSeleccion',
            CONTRATO: 'contrato',
            'MODALIDAD DE EJECUCION': 'modalidadEjecucion',
            'SISTEMA DE CONTRATACION': 'sistemaContratacion',
            'RESIDENTE DE OBRA': 'residente',
        },
        C: {
            CONTRATISTA: 'contratista',
            'RUC N°': 'ruc',
            RUC: 'ruc',
            'REPRESENTANTE LEGAL': 'representanteLegal',
            'DOMICILIO LEGAL': 'domicilioLegal',
            'PROCESO DE SELECCION': 'procesoSeleccion',
            CONTRATO: 'contrato',
            'SUPERVISOR DE OBRA': 'supervisor',
        },
        E: { 'SITUACION DE LA OBRA': 'situacionObra' },
    };
    const dateFields: Record<string, Record<string, string>> = {
        A: {
            'FECHA DE APROBACION DE EXPEDIENTE TECNICO':
                'fechaAprobacionExpediente',
            'FECHA DE APROBACION DEL EXPEDIENTE TECNICO':
                'fechaAprobacionExpediente',
            'FECHA DE PRESUPUESTO BASE': 'fechaPresupuestoBase',
        },
        B: {
            'ADJUDICACION DE BUENA PRO': 'fechaBuenaPro',
            'FECHA DE FIRMA DEL CONTRATO': 'fechaFirmaContrato',
        },
        C: {
            'FECHA DE CUANTIA DE CONTRATACION': 'fechaCuantia',
            'FECHA DE FIRMA DEL CONTRATO': 'fechaFirmaContrato',
        },
        D: {
            'FECHA DE ENTREGA DE TERRENO': 'fechaEntregaTerreno',
            'FECHA DE INICIO DE EJECUCION DE OBRA': 'fechaInicioObra',
            'FECHA DE TERMINO REAL': 'fechaTerminoReal',
        },
    };
    const moneyFields: Record<string, Record<string, string>> = {
        B: {
            'VALOR REFERENCIAL (CON IGV)': 'valorReferencial',
            'MONTO DEL CONTRATO PRINCIPAL (INCL. IGV)':
                'montoContratoPrincipal',
            'MONTO DEL CONTRATO VIGENTE (INCL. IGV)': 'montoContratoVigente',
        },
        C: {
            'VALOR REFERENCIAL (INCL. IGV)': 'valorReferencial',
            'MONTO DEL CONTRATO ORIGINAL (INCL. IGV)': 'montoContratoOriginal',
            'MONTO DEL CONTRATO VIGENTE (INCL. IGV)': 'montoContratoVigente',
        },
    };
    const targets: Record<string, object> = {
        A: ficha.datosGenerales,
        B: ficha.contratista,
        C: ficha.supervision,
        D: ficha.plazos,
        E: ficha.estado,
    };

    for (const row of rows) {
        const heading = row.map(key).find((value) => /^[A-E]\.\s/.test(value));
        if (heading) {
            seccion = heading[0];
            continue;
        }
        const target = targets[seccion];
        if (!target) {
            continue;
        }
        const labelCol = row.findIndex((cell) => {
            const label = key(cell);

            return Boolean(
                stringFields[seccion]?.[label] ||
                dateFields[seccion]?.[label] ||
                moneyFields[seccion]?.[label] ||
                /^(PLAZO|ADELANTO|FECHA EFECTIVA|AMPLIACIONES|SUSPENSIONES|FORMA DE VALORIZACION)/.test(
                    label,
                ),
            );
        });
        const label = labelCol >= 0 ? key(row[labelCol]) : '';
        const value = row
            .slice(labelCol + 1)
            .find(
                (cell) =>
                    cell !== null &&
                    cell !== undefined &&
                    text(cell) !== '' &&
                    text(cell) !== ':',
            );
        if (labelCol >= 0 && value !== undefined) {
            const stringField = stringFields[seccion]?.[label];
            const dateField = dateFields[seccion]?.[label];
            const moneyField = moneyFields[seccion]?.[label];
            if (stringField) {
                assign(target, stringField, text(value));
            } else if (dateField) {
                const date = cellDate(value);
                if (date && isIsoDate(date)) {
                    assign(target, dateField, date);
                } else if (
                    /^[-–—]$/.test(text(value)) &&
                    dateField !== 'fechaInicioObra'
                ) {
                    assign(target, dateField, null);
                } else {
                    warnings.push(
                        `FT: fecha inválida en ${text(row[labelCol])}; se conservó el dato actual.`,
                    );
                }
            } else if (moneyField) {
                const amount = numberString(value);
                if (amount !== null) {
                    assign(target, moneyField, amount);
                } else {
                    warnings.push(
                        `FT: monto inválido en ${text(row[labelCol])}; se conservó el dato actual.`,
                    );
                }
            } else if (label.startsWith('PLAZO')) {
                const count = dias(value);
                if (count !== null && count > 0) {
                    const field =
                        seccion === 'B'
                            ? 'plazoContractualDias'
                            : seccion === 'C'
                              ? 'plazoServicioDias'
                              : 'plazoEjecucionDias';
                    assign(target, field, count);
                }
            } else if (
                seccion === 'B' &&
                /^(ADELANTO|FECHA EFECTIVA)/.test(label)
            ) {
                const adelanto = label.includes('DIRECTO')
                    ? ficha.contratista.adelantoDirecto
                    : ficha.contratista.adelantoMateriales;
                if (label.startsWith('FECHA')) {
                    const date = cellDate(value);
                    if (date && isIsoDate(date))
                        assign(adelanto, 'fechaEfectiva', date);
                } else if (key(value).includes('NO SE OTORGO')) {
                    assign(adelanto, 'monto', null);
                    adelanto.fechaEfectiva = null;
                } else {
                    const amount = numberString(value);
                    if (amount !== null) assign(adelanto, 'monto', amount);
                }
            } else if (
                seccion === 'D' &&
                /^(AMPLIACIONES|SUSPENSIONES)/.test(label)
            ) {
                const field = label.startsWith('AMPLIACIONES')
                    ? 'ampliaciones'
                    : 'suspensiones';
                const count = /^[-–—]$/.test(text(value)) ? 0 : dias(value);
                if (count !== null) {
                    assign(
                        ficha.plazos,
                        field,
                        count === 0
                            ? []
                            : [
                                  {
                                      id: `excel-${field}`,
                                      documento: 'Importado de FT',
                                      dias: count,
                                  },
                              ],
                    );
                } else {
                    warnings.push(
                        `FT: revisar ${text(row[labelCol])}; no se pudo leer el plazo.`,
                    );
                }
            } else if (label === 'FORMA DE VALORIZACION') {
                if (key(value) === 'MENSUAL')
                    assign(ficha.estado, 'formaValorizacion', 'MENSUAL');
                else
                    warnings.push(
                        'FT: el expediente no es mensual; revisar la forma de valorización.',
                    );
            }
        }
        if (seccion === 'A') {
            for (const cell of row) {
                const match =
                    /^(DEPARTAMENTO|PROVINCIA|DISTRITO|LOCALIDAD):\s*(.+)$/.exec(
                        key(cell),
                    );
                if (match) {
                    const field =
                        match[1].toLowerCase() as keyof FichaTecnica['datosGenerales']['ubicacion'];
                    assign(
                        ficha.datosGenerales.ubicacion,
                        field,
                        text(cell).split(':').slice(1).join(':').trim(),
                    );
                }
            }
        }
    }
    if (
        ficha.datosGenerales.fechaPresupuestoBase &&
        ficha.datosGenerales.fechaAprobacionExpediente &&
        ficha.datosGenerales.fechaPresupuestoBase >
            ficha.datosGenerales.fechaAprobacionExpediente
    ) {
        warnings.push(
            'FT: la fecha del presupuesto base es posterior a la aprobación del expediente; se conservó la fecha del Excel para revisión.',
        );
    }

    return { ficha, campos, warnings };
}
