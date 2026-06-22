import { useMemo, useState, useCallback } from 'react';
import type { Periodo, ViewMode, SortField, SortDir, FiltroState } from '../types';

// ✅ Definir el tipo MaterialItem si no está importado
interface MaterialItem {
    descripcion: string;
    unidad: string;
    tipo: string;
    precio: number;
    cantidad_total: number;
    costo_total: number;
    distribucion: Record<string, { cantidad: number; monto: number }>;
}

export const useCronogramaLogic = (materiales: MaterialItem[], periodos: Periodo[]) => {

    const [viewMode,  setViewMode]  = useState<ViewMode>('cantidad');
    const [sortField, setSortField] = useState<SortField>('descripcion');
    const [sortDir,   setSortDir]   = useState<SortDir>('asc');
    const [filtro,    setFiltro]    = useState<FiltroState>({ busqueda: '', soloConCant: false, tipoFiltro: '' });
    const [destacado, setDestacado] = useState<string | null>(null);

    const safeString = (value: any): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString();
        return '';
    };

    const getValorByMode = useCallback((material: MaterialItem, key: string): number => {
        // ✅ VALIDACIÓN: Si no hay distribucion o no existe la key, retornar 0
        if (!material?.distribucion || !material.distribucion[key]) return 0;
        const distribucion = material.distribucion[key];
        return viewMode === 'cantidad' ? (distribucion.cantidad || 0) : (distribucion.monto || 0);
    }, [viewMode]);

    const getTotalByMode = useCallback((material: MaterialItem): number => {
        // ✅ VALIDACIÓN: Si no hay material, retornar 0
        if (!material) return 0;
        return viewMode === 'cantidad' ? (material.cantidad_total || 0) : (material.costo_total || 0);
    }, [viewMode]);

    const materialesFiltrados = useMemo(() => {
        // ✅ VALIDACIÓN: Si no hay materiales, retornar array vacío
        if (!materiales || materiales.length === 0) return [];

        let lista = [...materiales];

        if (filtro.busqueda.trim()) {
            const q = filtro.busqueda.toLowerCase().trim();
            lista = lista.filter(m => {
                const descripcion = safeString(m.descripcion).toLowerCase();
                const unidad = safeString(m.unidad).toLowerCase();
                const tipo = safeString(m.tipo).toLowerCase();
                
                return descripcion.includes(q) || unidad.includes(q) || tipo.includes(q);
            });
        }

        if (filtro.soloConCant) {
            lista = lista.filter(m => (m.cantidad_total || 0) > 0);
        }

        if (filtro.tipoFiltro && filtro.tipoFiltro !== '') {
            lista = lista.filter(m => safeString(m.tipo) === filtro.tipoFiltro);
        }

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

    const totalesMensuales = useMemo(() => {
        // ✅ VALIDACIÓN: Si no hay periodos, retornar objeto vacío
        if (!periodos || periodos.length === 0) return {};

        const totales: Record<string, number> = {};
        periodos.forEach(p => {
            totales[p.key] = materialesFiltrados.reduce((sum, mat) => {
                // ✅ VALIDACIÓN: Si no hay distribucion o no existe la key, retornar 0
                if (!mat?.distribucion || !mat.distribucion[p.key]) return sum;
                const distribucion = mat.distribucion[p.key];
                const valor = viewMode === 'cantidad' ? (distribucion.cantidad || 0) : (distribucion.monto || 0);
                return sum + valor;
            }, 0);
        });
        return totales;
    }, [materialesFiltrados, periodos, viewMode]);

    const totalGeneral = useMemo(() =>
        materialesFiltrados.reduce((s, m) => s + (m.costo_total || 0), 0),
    [materialesFiltrados]);

    const curvaSData = useMemo(() => {
        // ✅ VALIDACIÓN: Si no hay materiales o periodos, retornar array vacío
        if (!materiales || materiales.length === 0 || !periodos || periodos.length === 0) return [];

        let acumulado = 0;
        const totalPresupuesto = materiales.reduce((s, m) => s + (m.costo_total || 0), 0);
        if (totalPresupuesto === 0) return [];

        return periodos.map(p => {
            const mensualMonto = materiales.reduce((sum, mat) => {
                // ✅ VALIDACIÓN: Si no hay distribucion, retornar 0
                if (!mat?.distribucion || !mat.distribucion[p.key]) return sum;
                return sum + (mat.distribucion[p.key]?.monto || 0);
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

    const mesPicoKey = useMemo(() => {
        // ✅ VALIDACIÓN: Si no hay materiales o periodos, retornar string vacío
        if (!materiales || materiales.length === 0 || !periodos || periodos.length === 0) return '';

        let maxVal = 0;
        let mesPico = '';
        periodos.forEach(p => {
            const mensualMonto = materiales.reduce((sum, mat) => {
                if (!mat?.distribucion || !mat.distribucion[p.key]) return sum;
                return sum + (mat.distribucion[p.key]?.monto || 0);
            }, 0);
            if (mensualMonto > maxVal) {
                maxVal = mensualMonto;
                mesPico = p.key;
            }
        });
        return mesPico;
    }, [materiales, periodos]);

    const maxMensualTotal = useMemo(() => {
        // ✅ VALIDACIÓN: Si no hay materiales o periodos, retornar 1
        if (!materiales || materiales.length === 0 || !periodos || periodos.length === 0) return 1;

        let maxVal = 0;
        periodos.forEach(p => {
            materiales.forEach(mat => {
                if (!mat?.distribucion || !mat.distribucion[p.key]) return;
                const distribucion = mat.distribucion[p.key];
                const valor = viewMode === 'cantidad' ? (distribucion.cantidad || 0) : (distribucion.monto || 0);
                if (valor > maxVal) maxVal = valor;
            });
        });
        return maxVal || 1;
    }, [materiales, periodos, viewMode]);

    const getIntensidad = useCallback((val: number): number => {
        if (!val || maxMensualTotal === 0) return 0;
        return Math.min(val / maxMensualTotal, 1);
    }, [maxMensualTotal]);

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