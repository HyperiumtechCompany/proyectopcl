import type { ResumenPresupuesto } from '../types';

export interface BudgetExportSummary {
    costoDirecto: number;
    gastosGeneralesPorcentaje: number;
    gastosGenerales: number;
    utilidadPorcentaje: number;
    utilidad: number;
    total: number;
}

export function buildBudgetExportSummary(
    exportedDirectCost: number,
    resumen?: ResumenPresupuesto,
    isFiltered = false,
): BudgetExportSummary {
    const costoDirecto = !isFiltered && resumen
        ? resumen.costoDirecto
        : exportedDirectCost;
    const gastosGeneralesPorcentaje = resumen?.gastosGeneralesPorcentaje ?? 0;
    const utilidadPorcentaje = resumen?.utilidadPorcentaje ?? 0;
    const gastosGenerales = !isFiltered && resumen
        ? resumen.gastosGenerales
        : costoDirecto * gastosGeneralesPorcentaje / 100;
    const utilidad = !isFiltered && resumen
        ? resumen.utilidad
        : costoDirecto * utilidadPorcentaje / 100;

    return {
        costoDirecto,
        gastosGeneralesPorcentaje,
        gastosGenerales,
        utilidadPorcentaje,
        utilidad,
        total: !isFiltered && resumen
            ? resumen.total
            : costoDirecto + gastosGenerales + utilidad,
    };
}
