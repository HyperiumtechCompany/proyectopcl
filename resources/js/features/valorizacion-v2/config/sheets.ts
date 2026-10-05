import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * Registro único de hojas (orden = orden topológico del Excel, plan §2).
 * Para implementar una hoja nueva: crear sheets/<id>/ con su compute*.ts + test
 * y su <Nombre>Sheet.tsx, y agregar `component` aquí. Sin `component` la hoja
 * se muestra como "en construcción" con la fase en que llega.
 */

export type SheetGroupId = 'base' | 'programacion' | 'control' | 'pagos' | 'personal';

export interface SheetDefinition {
    id: string;
    label: string;
    excelSheet: string;
    group: SheetGroupId;
    phase: number;
    component?: LazyExoticComponent<ComponentType>;
}

export const SHEET_GROUPS: Array<{ id: SheetGroupId; label: string }> = [
    { id: 'base', label: 'Datos base' },
    { id: 'programacion', label: 'Programación y avance' },
    { id: 'control', label: 'Control de obra' },
    { id: 'pagos', label: 'Valorización y pagos' },
    { id: 'personal', label: 'Personal y resumen' },
];

export const SHEETS: SheetDefinition[] = [
    { id: 'ficha-tecnica', label: 'Ficha técnica', excelSheet: 'FT', group: 'base', phase: 1, component: lazy(() => import('../sheets/ficha-tecnica/FichaTecnicaSheet')) },
    { id: 'presupuesto', label: 'Presupuesto', excelSheet: 'PRESUPUESTO', group: 'base', phase: 2, component: lazy(() => import('../sheets/presupuesto/PresupuestoSheet')) },
    { id: 'calendario-programado', label: 'Calendario programado', excelSheet: 'CALEN. PROG.', group: 'programacion', phase: 3, component: lazy(() => import('../sheets/calendario/CalendarioProgramadoSheet')) },
    { id: 'metrados', label: 'Metrados ejecutados', excelSheet: 'METRADOS', group: 'programacion', phase: 4, component: lazy(() => import('../sheets/metrados/MetradosSheet')) },
    { id: 'calendario-valorizado', label: 'Calendario ejecutado', excelSheet: 'CALEN. VALO.', group: 'programacion', phase: 3, component: lazy(() => import('../sheets/calendario/CalendarioEjecutadoSheet')) },
    { id: 'valoracion-mensual', label: 'Valorización mensual', excelSheet: 'VAL. MENSUAL', group: 'programacion', phase: 4, component: lazy(() => import('../sheets/valorizacion-mensual/ValorizacionMensualSheet')) },
    { id: 'programado-vs-ejecutado', label: 'Programado vs ejecutado', excelSheet: 'PROG VS. EJEC', group: 'programacion', phase: 5, component: lazy(() => import('../sheets/control/ProgVsEjecSheet')) },
    { id: 'control-general', label: 'Control general', excelSheet: 'CONTROL GEN. AVAN. OBRA.', group: 'control', phase: 5, component: lazy(() => import('../sheets/control/ControlGeneralSheet')) },
    { id: 'curva-s', label: 'Curva S', excelSheet: 'CURVA S', group: 'control', phase: 5, component: lazy(() => import('../sheets/control/CurvaSSheet')) },
    { id: 'control-fisico', label: 'Avance físico', excelSheet: 'CONTROL AVAN. FISICO', group: 'control', phase: 5, component: lazy(() => import('../sheets/control/ControlFisicoSheet')) },
    { id: 'control-financiero', label: 'Avance financiero', excelSheet: 'CONTROL FINANCIERO', group: 'control', phase: 5, component: lazy(() => import('../sheets/control/ControlFinancieroSheet')) },
    { id: 'resumen-valoracion', label: 'Resumen por componentes', excelSheet: 'RESUMEN VAL.', group: 'pagos', phase: 6, component: lazy(() => import('../sheets/pagos/ResumenValorizacionSheet')) },
    { id: 'retencion-fc', label: 'Garantía fiel cumplimiento', excelSheet: 'R.F.C', group: 'pagos', phase: 6, component: lazy(() => import('../sheets/pagos/RetencionFCSheet')) },
    { id: 'resumen-pago', label: 'Resumen de pago', excelSheet: 'R PAGO MENSUAL', group: 'pagos', phase: 6, component: lazy(() => import('../sheets/pagos/ResumenPagoSheet')) },
    { id: 'pagos-acumulados', label: 'Pagos acumulados', excelSheet: 'PAGOS ACUMULADOS', group: 'pagos', phase: 6, component: lazy(() => import('../sheets/pagos/PagosAcumuladosSheet')) },
    { id: 'control-pagos', label: 'Control de pagos', excelSheet: 'CONTROL DE PAGOS', group: 'pagos', phase: 6, component: lazy(() => import('../sheets/pagos/ControlPagosSheet')) },
    { id: 'recursos-humanos', label: 'Personal clave', excelSheet: 'RH-EM', group: 'personal', phase: 7, component: lazy(() => import('../sheets/personal/RecursosHumanosSheet')) },
    { id: 'resumen-porcentajes', label: 'Tablero de indicadores', excelSheet: 'res % (reconstruida)', group: 'personal', phase: 7, component: lazy(() => import('../sheets/tablero/TableroSheet')) },
];

export const DEFAULT_SHEET_ID = 'ficha-tecnica';

export const findSheet = (id: string | null | undefined): SheetDefinition | undefined => SHEETS.find((sheet) => sheet.id === id);
