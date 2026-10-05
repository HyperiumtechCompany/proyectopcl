import type { IsoDate } from '../lib/dates';
import type { RatioString } from '../lib/money';
import type { CalendariosInput, ControlInput, MetradosInput } from './calendario';
import type { FichaTecnica } from './ficha-tecnica';
import type { PagosInput } from './pagos';
import type { PresupuestoInput } from './partida';
import type { PersonalInput } from './personal';

/** Valorización que se está trabajando (N° y mes). */
export interface PeriodoValorizacion {
    numero: number;
    /** Primer día del mes valorizado: "2026-07-01". */
    mes: IsoDate;
}

/** Pie presupuestal (PRESUPUESTO!D157:D160), fracciones como string. */
export interface ParametrosPresupuesto {
    gastosGenerales: RatioString;
    utilidad: RatioString;
    igv: RatioString;
}

/**
 * Estado de ENTRADA completo de una valorización. Es lo único que se guarda;
 * cada hoja se deriva de aquí con funciones puras (sheets/<hoja>/compute*.ts).
 * Fases 1–7 completas: FT, presupuesto, calendarios, metrados, control, pagos y personal.
 */
export interface ValorizacionInput {
    periodo: PeriodoValorizacion;
    fichaTecnica: FichaTecnica;
    parametros: ParametrosPresupuesto;
    presupuesto: PresupuestoInput;
    calendarios: CalendariosInput;
    metrados: MetradosInput;
    control: ControlInput;
    pagos: PagosInput;
    personal: PersonalInput;
}
