import type { ACU } from '@/types/presupuestos';

interface ACUCalculations {
    calculateManoDeObra: (
        cantidad: number,
        precioUnitario: number,
        rendimiento: number
    ) => number;
    calculateMateriales: (
        cantidad: number,
        precioUnitario: number,
        factorDesperdicio: number
    ) => number;
    calculateEquipos: (
        cantidad: number,
        precioHora: number,
        rendimiento: number
    ) => number;
    calculateCostoTotal: (acu: ACU) => number;
}

/**
 * Custom hook for ACU (Análisis de Costos Unitarios) calculations
 * Provides functions to calculate costs for mano de obra, materiales, and equipos
 * All calculations are rounded to 2 decimal places
 * 
 * **Validates: Requirements 4.4, 4.6, 6.4, 10.2, 10.3, 10.4, 10.5, 10.6**
 */
export function useACUCalculations(): ACUCalculations {
    /**
     * Calculate mano de obra cost
     * Formula: (cantidad * precio_unitario) / rendimiento
     * Rounded to 2 decimal places
     * 
     * @param cantidad - Quantity of labor
     * @param precioUnitario - Unit price per labor unit
     * @param rendimiento - Performance/yield factor (must be > 0)
     * @returns Calculated labor cost
     */
    const calculateManoDeObra = (
        cantidad: number,
        precioUnitario: number,
        rendimiento: number
    ): number => {
        if (rendimiento === 0) {
            return 0;
        }
        const result = (cantidad * precioUnitario) / rendimiento;
        return Math.round(result * 100) / 100;
    };

    /**
     * Calculate materiales cost
     * Formula: cantidad * precio_unitario * factor_desperdicio
     * Rounded to 2 decimal places
     * 
     * @param cantidad - Quantity of material
     * @param precioUnitario - Unit price per material unit
     * @param factorDesperdicio - Waste factor (typically >= 1.0)
     * @returns Calculated material cost
     */
    const calculateMateriales = (
        cantidad: number,
        precioUnitario: number,
        factorDesperdicio: number
    ): number => {
        const result = cantidad * precioUnitario * factorDesperdicio;
        return Math.round(result * 100) / 100;
    };

    /**
     * Calculate equipos cost
     * Formula: (cantidad * precio_hora) / rendimiento
     * Rounded to 2 decimal places
     * 
     * @param cantidad - Quantity of equipment usage
     * @param precioHora - Hourly price of equipment
     * @param rendimiento - Performance/yield factor (must be > 0)
     * @returns Calculated equipment cost
     */
    const calculateEquipos = (
        cantidad: number,
        precioHora: number,
        rendimiento: number
    ): number => {
        if (rendimiento === 0) {
            return 0;
        }
        const result = (cantidad * precioHora) / rendimiento;
        return Math.round(result * 100) / 100;
    };

    /**
     * Calculate total cost for an ACU
     * Formula: costo_mano_obra + costo_materiales + costo_equipos
     * Rounded to 2 decimal places
     * 
     * @param acu - ACU object with cost components
     * @returns Total unit cost
     */
    const calculateCostoTotal = (acu: ACU): number => {
        const total = acu.costo_mano_obra + acu.costo_materiales + acu.costo_equipos;
        return Math.round(total * 100) / 100;
    };

    return {
        calculateManoDeObra,
        calculateMateriales,
        calculateEquipos,
        calculateCostoTotal
    };
}
