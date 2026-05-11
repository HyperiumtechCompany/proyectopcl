import { useMemo, useState, useCallback } from 'react';
import { MaterialItem, Periodo, ViewMode, SortField, SortDir, FiltroState } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL — toda la lógica de cálculo y estado de la UI
// ─────────────────────────────────────────────────────────────────────────────
export const useCronogramaLogic = (materiales: MaterialItem[], periodos: Periodo[]) => {

    // ── Estado de la UI ───────────────────────────────────────────────────────
    const [viewMode,  setViewMode]  = useState<ViewMode>('cantidad');
    const [sortField, setSortField] = useState<SortField>('descripcion');
    const [sortDir,   setSortDir]   = useState<SortDir>('asc');
    const [filtro,    setFiltro]    = useState<FiltroState>({ busqueda: '', soloConCant: false, tipoFiltro: '' });
    const [destacado, setDestacado] = useState<string | null>(null);

    // ── Helper para convertir a string seguro ─────────────────────────────────
    const safeString = (value: any): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString();
        return '';
    };

    // ── Obtener valor según modo de vista (cantidad o monto) ───────────────────
    const getValorByMode = useCallback((material: MaterialItem, key: string): number => {
        const distribucion = material.distribucion[key];
        if (!distribucion) return 0;
        return viewMode === 'cantidad' ? distribucion.cantidad : distribucion.monto;
    }, [viewMode]);

    // ── Obtener total de un material (cantidad o costo según modo) ─────────────
    const getTotalByMode = useCallback((material: MaterialItem): number => {
        return viewMode === 'cantidad' ? material.cantidad_total : material.costo_total;
    }, [viewMode]);

    // ── Ordenar y filtrar materiales ──────────────────────────────────────────
    const materialesFiltrados = useMemo(() => {
        let lista = [...materiales];

        // Filtro por búsqueda (con conversión segura)
        if (filtro.busqueda.trim()) {
            const q = filtro.busqueda.toLowerCase().trim();
            lista = lista.filter(m => {
                const descripcion = safeString(m.descripcion).toLowerCase();
                const unidad = safeString(m.unidad).toLowerCase();
                const tipo = safeString(m.tipo).toLowerCase();
                
                return descripcion.includes(q) || unidad.includes(q) || tipo.includes(q);
            });
        }

        // Filtro solo con cantidad > 0
        if (filtro.soloConCant) {
            lista = lista.filter(m => m.cantidad_total > 0);
        }

        // Filtro por tipo de material
        if (filtro.tipoFiltro && filtro.tipoFiltro !== '') {
            lista = lista.filter(m => safeString(m.tipo) === filtro.tipoFiltro);
        }

        // Ordenar
        lista.sort((a, b) => {
            let va: any;
            let vb: any;
            
            switch (sortField) {
                case 'descripcion':
                    va = safeString(a.descripcion).toLowerCase();
                    vb = safeString(b.descripcion).toLowerCase();
                    break;
                case 'precio':
                    va = a.precio || 0;
                    vb = b.precio || 0;
                    break;
                case 'cantidad_total':
                    va = a.cantidad_total || 0;
                    vb = b.cantidad_total || 0;
                    break;
                case 'costo_total':
                    va = a.costo_total || 0;
                    vb = b.costo_total || 0;
                    break;
                default:
                    va = safeString(a.descripcion).toLowerCase();
                    vb = safeString(b.descripcion).toLowerCase();
            }
            
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
                const distribucion = mat.distribucion[p.key];
                if (!distribucion) return sum;
                const valor = viewMode === 'cantidad' ? distribucion.cantidad : distribucion.monto;
                return sum + valor;
            }, 0);
        });
        return totales;
    }, [materialesFiltrados, periodos, viewMode]);

    // ── Total general (suma de costos totales) ────────────────────────────────
    const totalGeneral = useMemo(() =>
        materialesFiltrados.reduce((s, m) => s + (m.costo_total || 0), 0),
    [materialesFiltrados]);

    // ── Datos para la Curva S (acumulado mensual en montos) ───────────────────
    const curvaSData = useMemo(() => {
        let acumulado = 0;
        const totalPresupuesto = materiales.reduce((s, m) => s + (m.costo_total || 0), 0);
        if (totalPresupuesto === 0) return [];

        return periodos.map(p => {
            const mensualMonto = materiales.reduce((sum, mat) => {
                const distribucion = mat.distribucion[p.key];
                return sum + (distribucion?.monto || 0);
            }, 0);
            acumulado += mensualMonto;
            return {
                mes:          p.labelCal || p.label,
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
            const mensualMonto = materiales.reduce((sum, mat) => {
                const distribucion = mat.distribucion[p.key];
                return sum + (distribucion?.monto || 0);
            }, 0);
            if (mensualMonto > maxVal) {
                maxVal = mensualMonto;
                mesPico = p.key;
            }
        });
        return mesPico;
    }, [materiales, periodos]);

    // ── Intensidad de celda (para colorear) ───────────────────────────────────
    const maxMensualTotal = useMemo(() => {
        let maxVal = 0;
        periodos.forEach(p => {
            materiales.forEach(mat => {
                const distribucion = mat.distribucion[p.key];
                if (distribucion) {
                    const valor = viewMode === 'cantidad' ? distribucion.cantidad : distribucion.monto;
                    if (valor > maxVal) maxVal = valor;
                }
            });
        });
        return maxVal || 1;
    }, [materiales, periodos, viewMode]);

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
        
        // Helpers
        getValorByMode,
        getTotalByMode,
    };
};