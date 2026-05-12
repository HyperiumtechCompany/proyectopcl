import { useMemo, useState, useCallback } from 'react';
import { Material, Periodo, ViewMode, SortField, SortDir, FiltroState } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL — toda la lógica de cálculo y estado de la UI
// ─────────────────────────────────────────────────────────────────────────────
export const useCronogramaLogic = (materiales: Material[], periodos: Periodo[]) => {

    // ── Estado de la UI ───────────────────────────────────────────────────────
    const [viewMode,  setViewMode]  = useState<ViewMode>('cantidad');
    const [sortField, setSortField] = useState<SortField>('descripcion');
    const [sortDir,   setSortDir]   = useState<SortDir>('asc');
    const [filtro,    setFiltro]    = useState<FiltroState>({ busqueda: '', soloConCant: false });
    const [destacado, setDestacado] = useState<string | null>(null);

    // ── Ordenar y filtrar materiales ──────────────────────────────────────────
    const materialesFiltrados = useMemo(() => {
        let lista = [...materiales];

        // Filtro por búsqueda
        if (filtro.busqueda.trim()) {
            const q = filtro.busqueda.toLowerCase().trim();
            lista = lista.filter(m =>
                m.descripcion.toLowerCase().includes(q) ||
                m.unidad.toLowerCase().includes(q)
            );
        }

        // Filtro solo con cantidad > 0
        if (filtro.soloConCant) {
            lista = lista.filter(m => m.cantidad_total > 0);
        }

        // Ordenar
        lista.sort((a, b) => {
            let va: any = a[sortField];
            let vb: any = b[sortField];
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return lista;
    }, [materiales, filtro, sortField, sortDir]);

    // ── Totales mensuales (para el footer de la tabla) ────────────────────────
    const totalesMensuales = useMemo(() => {
        const totales: Record<string, number> = {};
        periodos.forEach(p => {
            totales[p.key] = materialesFiltrados.reduce((sum, mat) => {
                const cant = mat.mensual[p.key] || 0;
                return sum + (viewMode === 'monto' ? cant * mat.precio : cant);
            }, 0);
        });
        return totales;
    }, [materialesFiltrados, periodos, viewMode]);

    // ── Total general (solo montos) ────────────────────────────────────────────
    const totalGeneral = useMemo(() =>
        materialesFiltrados.reduce((s, m) => s + m.presupuesto, 0),
    [materialesFiltrados]);

    // ── Datos para la Curva S (acumulado mensual) ─────────────────────────────
    const curvaSData = useMemo(() => {
        let acumulado = 0;
        const totalPresupuesto = materiales.reduce((s, m) => s + m.presupuesto, 0);
        if (totalPresupuesto === 0) return [];

        return periodos.map(p => {
            const mensualMonto = materiales.reduce((sum, mat) => {
                return sum + (mat.mensual[p.key] || 0) * mat.precio;
            }, 0);
            acumulado += mensualMonto;
            return {
                mes:          p.label,
                key:          p.key,
                mensual:      mensualMonto,
                acumulado:    acumulado,
                porcentaje:   (acumulado / totalPresupuesto) * 100,
            };
        });
    }, [materiales, periodos]);

    // ── Mes pico (mayor inversión en un mes) ──────────────────────────────────
    const mesPicoKey = useMemo(() => {
        let maxVal = 0;
        let mesPico = '';
        periodos.forEach(p => {
            const v = totalesMensuales[p.key] || 0;
            if (v > maxVal) { maxVal = v; mesPico = p.key; }
        });
        return mesPico;
    }, [totalesMensuales, periodos]);

    // ── Intensidad de celda (para colorear) ───────────────────────────────────
    const maxMensualTotal = useMemo(() => {
        return Math.max(...Object.values(totalesMensuales), 1);
    }, [totalesMensuales]);

    const getIntensidad = useCallback((val: number): number => {
        if (!val || maxMensualTotal === 0) return 0;
        return Math.min(val / maxMensualTotal, 1);
    }, [maxMensualTotal]);

    // ── Toggle de ordenamiento ─────────────────────────────────────────────────
    const toggleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    }, [sortField]);

    return {
        // Estado
        viewMode, setViewMode,
        sortField, sortDir, toggleSort,
        filtro, setFiltro,
        destacado, setDestacado,

        // Datos calculados
        materialesFiltrados,
        totalesMensuales,
        totalGeneral,
        curvaSData,
        mesPicoKey,
        getIntensidad,
    };
};