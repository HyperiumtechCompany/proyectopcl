/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONSOLIDADO STORE — Cálculo Centralizado de Gastos y Total de Inversión
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Maneja la lógica de cálculo con dependencia circular:
 * - Consolidado Base = GG Fijos + GG Variables + Supervisión
 * - Control Concurrente (calculado usando Consolidado Base)
 * - Total Inversión = Consolidado Base + Control Concurrente
 *
 * El cálculo se realiza en 2 pasos para evitar dependencias circulares:
 * 1. getConsolidadoBase() - sin incluir Control Concurrente
 * 2. getTotalInversion() - incluye Control Concurrente
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useGastosGeneralesStore } from './gastosGeneralesStore';
import { useGGFijosStore } from './ggFijosStore';
import { useGGVariablesStore } from './ggVariablesStore';
import { useSupervisionStore } from './supervisionStore';

interface ConsolidadoState {
    // ── Estado de carga ──
    isCalculating: boolean;
    lastCalculatedAt: number | null;
    
    // ── Valor de Control Concurrente (calculado automáticamente o manual) ──
    controlConcurrenteCalculado: number;

    // ── Getters principales ──
    getGGVariablesTotal: () => number;
    getGGFijosTotal: () => number;
    getSupervisionTotal: () => number;
    getControlConcurrenteTotal: () => number;
    getControlConcurrenteCalculado: () => number;

    // ── Cálculos consolidados ──
    /** Consolidado BASE (sin Control Concurrente) = GG Variables + GG Fijos + Supervisión */
    getConsolidadoBase: () => number;

    /** Total de Inversión = Consolidado Base + Control Concurrente */
    getTotalInversion: () => number;
    
    /** Porcentaje de Control Concurrente = CC / Consolidado Base */
    getPorcentajeCC: () => number;

    // ── Acciones ──
    /** Establecer el valor calculado de Control Concurrente (2% del consolidado) */
    setControlConcurrenteCalculado: (value: number) => void;
    
    /** Forzar recálculo */
    recalculate: () => void;
}

// Helper para obtener valores numéricos seguros
const toNumber = (value: unknown, fallback = 0): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

export const useConsolidadoStore = create<ConsolidadoState>()(
    subscribeWithSelector((set, get) => ({
        isCalculating: false,
        lastCalculatedAt: null,
        controlConcurrenteCalculado: 0,

        // ── Getters de componentes individuales ──

        getGGVariablesTotal: () => {
            try {
                // Intentar usar el store de GG Variables
                const store = useGGVariablesStore.getState();
                if (store && typeof store.getTotal === 'function') {
                    return store.getTotal();
                }
                return 0;
            } catch {
                return 0;
            }
        },

        getGGFijosTotal: () => {
            try {
                const store = useGGFijosStore.getState();
                if (store && typeof store.getTotal === 'function') {
                    return store.getTotal();
                }
                return 0;
            } catch {
                return 0;
            }
        },

        getSupervisionTotal: () => {
            try {
                const store = useSupervisionStore.getState();
                if (store && store.rows) {
                    // Usar la Seccion VIII (TOTAL) para alinear con el consolidado
                    const totalRow =
                        store.rows.find((r: any) => r.item === 'VIII') ?? store.rows[7];
                    const total = toNumber(totalRow?.total ?? totalRow?.subtotal ?? totalRow?.parcial, 0);
                    if (total > 0) return total;
                    // Fallback: suma de filas si no existe la seccion VIII
                    return store.rows.reduce((sum: number, row: any) => {
                        return sum + toNumber(row.total || row.subtotal || row.parcial, 0);
                    }, 0);
                }
                return 0;
            } catch {
                return 0;
            }
        },

        getControlConcurrenteTotal: () => {
            try {
                // El Control Concurrente también usa el GastosGeneralesStore
                // pero con la subsection 'control_concurrente'
                const store = useGastosGeneralesStore.getState();
                if (store && typeof store.calculateTotal === 'function') {
                    return store.calculateTotal();
                }
                return 0;
            } catch {
                return 0;
            }
        },

        getControlConcurrenteCalculado: () => {
            const { controlConcurrenteCalculado } = get();
            return controlConcurrenteCalculado;
        },

        // ── Cálculos consolidados ──

        getConsolidadoBase: () => {
            const { getGGVariablesTotal, getGGFijosTotal, getSupervisionTotal } = get();

            const ggVariables = getGGVariablesTotal();
            const ggFijos = getGGFijosTotal();
            const supervision = getSupervisionTotal();

            const total = ggVariables + ggFijos + supervision;

            return Number(total.toFixed(2));
        },

        getTotalInversion: () => {
            const { getConsolidadoBase, getControlConcurrenteTotal } = get();

            const consolidadoBase = getConsolidadoBase();
            const controlConcurrente = getControlConcurrenteTotal();

            const total = consolidadoBase + controlConcurrente;

            return Number(total.toFixed(2));
        },

        getPorcentajeCC: () => {
            const { getConsolidadoBase, getControlConcurrenteTotal } = get();
            const consolidadoBase = getConsolidadoBase();
            const controlConcurrente = getControlConcurrenteTotal();
            
            if (consolidadoBase > 0) {
                return controlConcurrente / consolidadoBase;
            }
            return 0;
        },

        setControlConcurrenteCalculado: (value: number) => {
            set({ controlConcurrenteCalculado: toNumber(value) });
        },

        // ── Acción para forzar recálculo ──

        recalculate: () => {
            set({ isCalculating: true, lastCalculatedAt: Date.now() });

            // Forzar actualización de todos los stores
            try {
                useGGVariablesStore.getState().getTotal?.();
                useGGFijosStore.getState().getTotal?.();
            } catch (e) {
                // Ignorar errores de stores no disponibles
            }

            set({ isCalculating: false });
        },
    }))
);

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HOOK PARA USAR EL CONSOLIDADO EN COMPONENTES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Uso:
 * const { consolidadoBase, controlConcurrente, totalInversion } = useConsolidado();
 */
import { useSyncExternalStore } from 'react';

export function useConsolidado() {
    // Suscribirse a cambios en los stores
    useGGVariablesStore((s) => s.isDirty);
    useGGFijosStore((s) => s.isDirty);
    useSupervisionStore((s) => s.isDirty);
    useGastosGeneralesStore((s) => s.isDirty);

    const store = useConsolidadoStore();

    return {
        ggVariables: store.getGGVariablesTotal(),
        ggFijos: store.getGGFijosTotal(),
        supervision: store.getSupervisionTotal(),
        controlConcurrente: store.getControlConcurrenteTotal(),
        controlConcurrenteCalculado: store.getControlConcurrenteCalculado(),
        consolidadoBase: store.getConsolidadoBase(),
        totalInversion: store.getTotalInversion(),
        porcentajeCC: store.getPorcentajeCC(),
        setControlConcurrenteCalculado: store.setControlConcurrenteCalculado,
        recalculate: store.recalculate,
    };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NOTA IMPORTANTE SOBRE LA LÓGICA DE CONTROL CONCURRENTE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * El Control Concurrente typicalmente se calcula como un porcentaje del
 * Consolidado Base (GG Variables + GG Fijos + Supervisión).
 *
 * Si el cálculo de Control Concurrente depende del Consolidado Base,
 * la lógica debe implementarse en el backend o en el store correspondiente.
 *
 * Ejemplo de implementación sugerida:
 *
 * // En el componente donde se calcula CC:
 * const consolidadoBase = useConsolidadoStore.getState().getConsolidadoBase();
 * const porcentajeCC = 0.05; // 5%
 * const controlConcurrente = consolidadoBase * porcentajeCC;
 *
 * Esto evita la dependencia circular porque:
 * 1. Primero se calcula el Consolidado Base (sin CC)
 * 2. Luego se calcula el CC usando el valor del paso 1
 * 3. Finalmente, el Total = Consolidado Base + CC
 */
