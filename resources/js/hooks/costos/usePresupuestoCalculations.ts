import type { PresupuestoRow } from '@/types/presupuestos';

interface PresupuestoCalculations {
    calculateParcial: (metrado: number, precioUnitario: number) => number;
    calculateTotal: (rows: PresupuestoRow[]) => number;
    applyFormulas: (rows: PresupuestoRow[]) => PresupuestoRow[];
}

/**
 * Custom hook for presupuesto calculations
 * Provides functions to calculate parcial, total budget, and apply formulas to rows
 * All calculations are rounded to 2 decimal places
 * 
 * **Validates: Requirements 3.4, 6.4, 9.4**
 */
export function usePresupuestoCalculations(): PresupuestoCalculations {
    /**
     * Calculate parcial for a single row
     * Formula: metrado * precio_unitario
     * Rounded to 2 decimal places
     */
    const calculateParcial = (metrado: number, precioUnitario: number): number => {
        const result = metrado * precioUnitario;
        return Math.round(result * 100) / 100;
    };

    /**
     * Calculate total budget by summing all parciales
     * Formula: sum of all row.parcial values
     * Rounded to 2 decimal places
     */
    const calculateTotal = (rows: PresupuestoRow[]): number => {
        const total = rows.reduce((sum, row) => sum + row.parcial, 0);
        return Math.round(total * 100) / 100;
    };

    /**
     * Apply formulas to all rows in a presupuesto
     * Recalculates parcial for each row based on metrado and precio_unitario
     * Returns a new array with updated parcial values
     */
    const applyFormulas = (rows: PresupuestoRow[]): PresupuestoRow[] => {
        return rows.map(row => ({
            ...row,
            parcial: calculateParcial(row.metrado, row.precio_unitario)
        }));
    };

    return {
        calculateParcial,
        calculateTotal,
        applyFormulas
    };
}
