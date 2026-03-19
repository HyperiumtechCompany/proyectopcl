/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PROJECT PARAMS STORE — Fuente Única de Verdad
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Centraliza todos los parámetros globales del proyecto para el sistema de costos.
 * Todos los módulos (GG Fijos, GG Variables, Cronogramas, etc.) leen de aquí.
 *
 * Se inicializa con datos del backend (Inertia props) y se actualiza via API.
 */
import axios from 'axios';
import { create } from 'zustand';
import { useConsolidadoStore } from './consolidadoStore';

export interface ProjectParams {
    id?: number;

    // ── Datos Generales ──
    nombre: string;
    uei: string | null;
    unidad_ejecutora: string | null;
    codigo_snip: string | null;
    codigo_cui: string | null;
    codigo_local: string | null;

    // ── Fechas y Duración (auto-calculados en backend) ──
    fecha_inicio: string | null;
    fecha_fin: string | null;
    duracion_dias: number;
    duracion_meses: number;

    // ── Ubicación (nombres resueltos) ──
    departamento: string | null;
    provincia: string | null;
    distrito: string | null;
    centro_poblado: string | null;

    // ── Parámetros Financieros ──
    costo_directo: number;
    utilidad_porcentaje: number;
    igv_porcentaje: number;
    jornada_laboral_horas: number;
    rmv: number;
}

interface ProjectParamsState {
    params: ProjectParams | null;
    isLoading: boolean;
    isSaving: boolean;
    lastError: string | null;

    // Actions
    initialize: (data: Record<string, any> | null) => void;
    fetchParams: (projectId: number) => Promise<void>;
    updateFinancialParams: (projectId: number, updates: Partial<ProjectParams>) => Promise<boolean>;
    updateCostoDirecto: (projectId: number, costoDirecto: number) => Promise<boolean>;

    // ── Computed Getters (for S10-like calculations) ──
    getDuracionDias: () => number;
    getDuracionMeses: () => number;
    getCostoDirecto: () => number;
    getUtilidadPorcentaje: () => number;
    getIgvPorcentaje: () => number;
    getRmv: () => number;
    getJornadaHoras: () => number;

    // ── Computed Financial ──
    getGastosGenerales: () => number;     // GG = Consolidado Base
    getTotalInversion: () => number;      // Total = Consolidado Base + Control Concurrente
    getUtilidad: () => number;            // costo_directo × utilidad% / 100
    getSubtotalSinIgv: () => number;     // CD + GG + U
    getIgv: () => number;                // subtotal × igv% / 100
    getTotalConIgv: () => number;        // subtotal + IGV
    getMontoContrato: () => number;      // = subtotal sin IGV (base para fianzas)
}

function parseNumber(val: any, fallback = 0): number {
    const n = Number(val);
    return isNaN(n) ? fallback : n;
}

function normalizeParams(data: Record<string, any>): ProjectParams {
    return {
        id: data.id,
        nombre: data.nombre || '',
        uei: data.uei || null,
        unidad_ejecutora: data.unidad_ejecutora || null,
        codigo_snip: data.codigo_snip || null,
        codigo_cui: data.codigo_cui || null,
        codigo_local: data.codigo_local || null,
        fecha_inicio: data.fecha_inicio || null,
        fecha_fin: data.fecha_fin || null,
        duracion_dias: parseNumber(data.duracion_dias),
        duracion_meses: parseNumber(data.duracion_meses),
        departamento: data.departamento || null,
        provincia: data.provincia || null,
        distrito: data.distrito || null,
        centro_poblado: data.centro_poblado || null,
        costo_directo: parseNumber(data.costo_directo),
        utilidad_porcentaje: parseNumber(data.utilidad_porcentaje, 10),
        igv_porcentaje: parseNumber(data.igv_porcentaje, 18),
        jornada_laboral_horas: parseNumber(data.jornada_laboral_horas, 8),
        rmv: parseNumber(data.rmv, 1025),
    };
}

export const useProjectParamsStore = create<ProjectParamsState>((set, get) => ({
    params: null,
    isLoading: false,
    isSaving: false,
    lastError: null,

    initialize: (data) => {
        if (!data) {
            set({ params: null });
            return;
        }
        set({ params: normalizeParams(data), lastError: null });
    },

    fetchParams: async (projectId) => {
        set({ isLoading: true, lastError: null });
        try {
            const response = await axios.get(
                `/costos/proyectos/${projectId}/presupuesto/params`
            );
            if (response.data?.success && response.data.data) {
                set({ params: normalizeParams(response.data.data) });
            }
        } catch (error: any) {
            set({ lastError: error?.message || 'Error fetching params' });
            console.error('Error fetching project params:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    updateFinancialParams: async (projectId, updates) => {
        set({ isSaving: true, lastError: null });
        try {
            const response = await axios.patch(
                `/costos/proyectos/${projectId}/presupuesto/params`,
                updates
            );
            if (response.data?.success && response.data.data) {
                set({ params: normalizeParams(response.data.data) });
                return true;
            }
            return false;
        } catch (error: any) {
            set({ lastError: error?.message || 'Error updating params' });
            console.error('Error updating project params:', error);
            return false;
        } finally {
            set({ isSaving: false });
        }
    },

    updateCostoDirecto: async (projectId, costoDirecto) => {
        return get().updateFinancialParams(projectId, { costo_directo: costoDirecto });
    },

    // ── Getters ──
    getDuracionDias: () => get().params?.duracion_dias ?? 0,
    getDuracionMeses: () => get().params?.duracion_meses ?? 0,
    getCostoDirecto: () => get().params?.costo_directo ?? 0,
    getUtilidadPorcentaje: () => get().params?.utilidad_porcentaje ?? 10,
    getIgvPorcentaje: () => get().params?.igv_porcentaje ?? 18,
    getRmv: () => get().params?.rmv ?? 1025,
    getJornadaHoras: () => get().params?.jornada_laboral_horas ?? 8,

    // ── Financial Computed ──
    /** Gastos Generales = Consolidado Base (GG Variables + GG Fijos + Supervisión) */
    getGastosGenerales: () => {
        try {
            return useConsolidadoStore.getState().getConsolidadoBase();
        } catch {
            return 0;
        }
    },

    /** Total de Inversión para la Obra = Consolidado Base + Control Concurrente */
    getTotalInversion: () => {
        try {
            return useConsolidadoStore.getState().getTotalInversion();
        } catch {
            return 0;
        }
    },

    getUtilidad: () => {
        const p = get().params;
        if (!p) return 0;
        return (p.costo_directo * p.utilidad_porcentaje) / 100;
    },

    getSubtotalSinIgv: () => {
        const cd = get().getCostoDirecto();
        const gg = get().getGastosGenerales();
        const u = get().getUtilidad();
        return cd + gg + u;
    },

    getIgv: () => {
        const subtotal = get().getSubtotalSinIgv();
        const igvPct = get().getIgvPorcentaje();
        return (subtotal * igvPct) / 100;
    },

    getTotalConIgv: () => {
        return get().getSubtotalSinIgv() + get().getIgv();
    },

    getMontoContrato: () => {
        // Base para fianzas = subtotal sin IGV
        return get().getSubtotalSinIgv();
    },
}));
