import type Decimal from 'decimal.js';
import { evaluarAvance } from '../../lib/avance';
import type { EvaluacionAvance } from '../../lib/avance';
import { calcFechaFin } from '../../lib/dates';
import type { IsoDate } from '../../lib/dates';
import { D } from '../../lib/money';
import type { DecimalInput } from '../../lib/money';
import { plazoEnLetras } from '../../lib/spanishWords';
import type { FichaTecnica, ModificacionPlazo } from '../../types';
import { fmtPct } from '../../utils/format';

/** % acumulados que FT!E58/E59 leen de CONTROL GEN. AVAN. OBRA. (Fase 5). */
export interface AvanceAcumulado {
    programado: DecimalInput;
    ejecutado: DecimalInput;
}

export interface FichaTecnicaCalculada {
    plazoContractualTexto: string;
    plazoServicioTexto: string;
    plazoEjecucionTexto: string;
    ampliacionesDias: number;
    suspensionesDias: number;
    /** Plazo de ejecución + ampliaciones. */
    plazoVigenteDias: number;
    /** FT!E51 = inicio + plazo − 1. */
    fechaTerminoProgramado: IsoDate;
    /** Término programado corrido por ampliaciones y suspensiones. */
    fechaTerminoVigente: IsoDate;
    avance: {
        programado: Decimal;
        ejecutado: Decimal;
        evaluacion: EvaluacionAvance;
        /** "ADELANTADA EN 41.32%" */
        texto: string;
    } | null;
}

const totalDias = (items: ModificacionPlazo[]): number => items.reduce((acc, item) => acc + item.dias, 0);

/** Deriva todos los campos calculados de FT. Pura: mismo input → mismo output. */
export function computeFichaTecnica(ficha: FichaTecnica, avance: AvanceAcumulado | null = null): FichaTecnicaCalculada {
    const { plazos } = ficha;
    const ampliacionesDias = totalDias(plazos.ampliaciones);
    const suspensionesDias = totalDias(plazos.suspensiones);
    const plazoVigenteDias = plazos.plazoEjecucionDias + ampliacionesDias;

    let avanceCalculado: FichaTecnicaCalculada['avance'] = null;
    if (avance) {
        const evaluacion = evaluarAvance(avance.programado, avance.ejecutado);
        const texto = evaluacion.situacion === 'CULMINADA'
            ? 'CULMINADA'
            : `${evaluacion.situacion} EN ${fmtPct(evaluacion.diferencia.abs())}`;
        avanceCalculado = { programado: D(avance.programado), ejecutado: D(avance.ejecutado), evaluacion, texto };
    }

    return {
        plazoContractualTexto: plazoEnLetras(ficha.contratista.plazoContractualDias ?? plazos.plazoEjecucionDias),
        plazoServicioTexto: plazoEnLetras(ficha.supervision.plazoServicioDias),
        plazoEjecucionTexto: plazoEnLetras(plazos.plazoEjecucionDias),
        ampliacionesDias,
        suspensionesDias,
        plazoVigenteDias,
        fechaTerminoProgramado: calcFechaFin(plazos.fechaInicioObra, plazos.plazoEjecucionDias),
        fechaTerminoVigente: calcFechaFin(plazos.fechaInicioObra, plazoVigenteDias + suspensionesDias),
        avance: avanceCalculado,
    };
}
