import type { ResumenPresupuesto } from '../types';

export interface BudgetExportSummary {
    costoDirecto: number;
    gastosGeneralesPorcentaje: number;
    gastosGenerales: number;
    utilidadPorcentaje: number;
    utilidad: number;
    total: number;
    
    // Extensión cascada
    igv?: number;
    igvPorcentaje?: number;
    subTotalComponenteI?: number;
    componenteIIMonto?: number;
    subTotalComponenteII?: number;
    extrasTotal?: number;
    totalComponents?: number;
    supervision?: number;
    supervisionPorcentaje?: number;
    totalConsolidado?: number;
    controlConcurrente?: number;
    controlConcurrentePorcentaje?: number;
    totalInversion?: number;
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

    const base = {
        costoDirecto,
        gastosGeneralesPorcentaje,
        gastosGenerales,
        utilidadPorcentaje,
        utilidad,
        total: !isFiltered && resumen
            ? resumen.total
            : costoDirecto + gastosGenerales + utilidad,
    };

    if (isFiltered || !resumen) {
        return base;
    }

    return {
        ...base,
        igv: resumen.igv,
        igvPorcentaje: resumen.igvPorcentaje,
        subTotalComponenteI: resumen.subTotalComponenteI,
        componenteIIMonto: resumen.componenteIIMonto,
        subTotalComponenteII: resumen.subTotalComponenteII,
        extrasTotal: resumen.extrasTotal,
        totalComponents: resumen.totalComponents,
        supervision: resumen.supervision,
        supervisionPorcentaje: resumen.supervisionPorcentaje,
        totalConsolidado: resumen.totalConsolidado,
        controlConcurrente: resumen.controlConcurrente,
        controlConcurrentePorcentaje: resumen.controlConcurrentePorcentaje,
        totalInversion: resumen.totalInversion,
    };
}
