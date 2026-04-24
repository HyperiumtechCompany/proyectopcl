import { useMemo, useState, useCallback } from 'react';
import { ItemValorizado, Periodo, ViewMode, TotalesColumna, DistribucionMes } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const useValorizadoLogic = (
    initialItems:     ItemValorizado[],
    periodos:         Periodo[],
    totalPresupuesto: number,
) => {
    // ── Estado ────────────────────────────────────────────────────────────────
    const [viewMode,    setViewMode]    = useState<ViewMode>('monto');
    const [searchTerm,  setSearchTerm]  = useState('');
    // Items EDITABLES — se inicializan desde props y el usuario puede modificar
    const [items, setItems] = useState<ItemValorizado[]>(() =>
        initialItems.map(item => ({
            ...item,
            distribucion: { ...item.distribucion },
        }))
    );

    // ── EDICIÓN INLINE de una celda ───────────────────────────────────────────
    /**
     * Cuando el usuario edita el monto de un mes:
     *   1. Actualiza el monto de esa celda
     *   2. Recalcula el porcentaje
     *   3. Si queda diferencia respecto al parcial total, se ajusta el último mes activo
     */
    const editarCelda = useCallback((
        itemId:     number,
        periodoKey: string,
        nuevoMonto: number,
    ) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;

            const nuevaDist = { ...item.distribucion };
            nuevaDist[periodoKey] = {
                monto:      Math.max(0, nuevoMonto),
                porcentaje: item.parcial > 0 ? (Math.max(0, nuevoMonto) / item.parcial) * 100 : 0,
            };

            return { ...item, distribucion: nuevaDist };
        }));
    }, []);

    /**
     * Redistribuir uniformemente entre los meses seleccionados
     */
    const redistribuirItem = useCallback((itemId: number) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;

            const claves = Object.keys(item.distribucion);
            const numMeses = claves.length;
            if (numMeses === 0 || item.parcial === 0) return item;

            const montoPorMes = item.parcial / numMeses;
            const pctPorMes   = 100 / numMeses;

            const nuevaDist: Record<string, DistribucionMes> = {};
            claves.forEach(k => {
                nuevaDist[k] = {
                    monto:      Math.round(montoPorMes * 100) / 100,
                    porcentaje: Math.round(pctPorMes * 10000) / 10000,
                };
            });

            return { ...item, distribucion: nuevaDist };
        }));
    }, []);

    /**
     * Limpiar distribución de un item (todo a 0)
     */
    const limpiarDistribucion = useCallback((itemId: number) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            const claves = Object.keys(item.distribucion);
            const nuevaDist: Record<string, DistribucionMes> = {};
            claves.forEach(k => { nuevaDist[k] = { monto: 0, porcentaje: 0 }; });
            return { ...item, distribucion: nuevaDist };
        }));
    }, []);

    // ── TOTALES POR COLUMNA ───────────────────────────────────────────────────
    const totalesFinales = useMemo<Record<string, TotalesColumna>>(() => {
        const totales: Record<string, TotalesColumna> = {};
        let acumMonto = 0;

        periodos.forEach(p => {
            const montoMes = items
                .filter(i => i.is_leaf)
                .reduce((acc, item) => acc + (item.distribucion?.[p.key]?.monto ?? 0), 0);

            acumMonto += montoMes;

            totales[p.key] = {
                monto:               montoMes,
                porcentaje:          totalPresupuesto > 0 ? (montoMes / totalPresupuesto) * 100 : 0,
                acumuladoMonto:      acumMonto,
                acumuladoPorcentaje: totalPresupuesto > 0 ? (acumMonto / totalPresupuesto) * 100 : 0,
            };
        });

        return totales;
    }, [items, periodos, totalPresupuesto]);

    // ── CURVA S DATA ──────────────────────────────────────────────────────────
    const curvaSData = useMemo(() => {
        return periodos.map(p => ({
            mes:          p.labelCal,
            mesLabel:     p.label,
            key:          p.key,
            mensual:      totalesFinales[p.key]?.monto ?? 0,
            acumulado:    totalesFinales[p.key]?.acumuladoMonto ?? 0,
            pctMensual:   totalesFinales[p.key]?.porcentaje ?? 0,
            pctAcumulado: totalesFinales[p.key]?.acumuladoPorcentaje ?? 0,
        }));
    }, [periodos, totalesFinales]);

    // ── FILTRADO ──────────────────────────────────────────────────────────────
    const itemsFiltrados = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        if (!q) return items;
        return items.filter(i =>
            String(i.descripcion ?? '').toLowerCase().includes(q) ||
            String(i.item ?? '').toLowerCase().includes(q)
        );
    }, [items, searchTerm]);

    // ── ACUMULADO TOTAL (último mes) ──────────────────────────────────────────
    const montoAcumuladoTotal = useMemo(() => {
        if (!periodos.length) return 0;
        const lastKey = periodos[periodos.length - 1].key;
        return totalesFinales[lastKey]?.acumuladoMonto ?? 0;
    }, [periodos, totalesFinales]);

    // ── SUMA DISTRIBUIDA vs PARCIAL (para validación) ─────────────────────────
    const getDesviacion = useCallback((item: ItemValorizado): number => {
        const sumaDist = Object.values(item.distribucion).reduce(
            (s, v) => s + (v.monto ?? 0), 0
        );
        return Math.abs(item.parcial - sumaDist);
    }, []);

    return {
        // Estado
        viewMode, setViewMode,
        searchTerm, setSearchTerm,
        // Items editables
        items,
        // Acciones de edición
        editarCelda,
        redistribuirItem,
        limpiarDistribucion,
        // Calculados
        itemsFiltrados,
        totalesFinales,
        curvaSData,
        montoAcumuladoTotal,
        getDesviacion,
    };
};